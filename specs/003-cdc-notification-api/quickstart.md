# Quickstart Guide: CDC Notification API Service

**Version**: 1.0.0  
**Last Updated**: 2025-11-08

This guide walks through setting up and using the Change Data Capture Notification API service in 10 minutes.

---

## Prerequisites

- PostgreSQL 12+ database
- Node.js 18+ or Python 3.10+
- Docker (optional, for containerized deployment)
- curl or similar HTTP client for testing
- WebSocket client library or browser console

---

## Part 1: Database Setup (3 minutes)

### Step 1.1: Create Outbox Table

Connect to your PostgreSQL database and run:

```sql
-- Outbox table for CDC events
CREATE TABLE IF NOT EXISTS outbox (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    after_data JSONB,
    before_data JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    published_at TIMESTAMP,
    CONSTRAINT operation_check CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_outbox_processed ON outbox(processed) WHERE processed = FALSE;
CREATE INDEX idx_outbox_created_at ON outbox(created_at DESC);
```

### Step 1.2: Create API Keys Table

```sql
-- API authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '{"tables": ["*"]}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

### Step 1.3: Create Notification Trigger

```sql
-- Trigger to notify when new outbox events arrive
CREATE OR REPLACE FUNCTION notify_outbox_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('cdc_outbox', json_build_object(
        'id', NEW.id,
        'table_name', NEW.table_name,
        'operation', NEW.operation
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_notify ON outbox;
CREATE TRIGGER outbox_notify 
AFTER INSERT ON outbox
FOR EACH ROW 
EXECUTE FUNCTION notify_outbox_change();
```

### Step 1.4: Create Demo Table

```sql
-- Example table to track changes
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 1.5: Insert Sample API Key

```sql
-- Generate API key (for demo purposes)
-- In production, use a secure random key generator
INSERT INTO api_keys (name, key_hash, scopes, is_active)
VALUES (
    'demo-key',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',  -- SHA256("")
    '{"tables": ["*"]}',
    true
);

-- Verify:
SELECT * FROM api_keys;
```

---

## Part 2: Service Setup (4 minutes)

### Step 2.1: Clone and Install (Node.js example)

```bash
# Clone repository
cd ~/projects
git clone <repo-url> postgresql-cdc-api
cd postgresql-cdc-api

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
LOG_LEVEL=info
WEBSOCKET_PORT=3000
API_PORT=3000
NODE_ENV=development
EOF
```

### Step 2.2: Start the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

**Expected output**:
```
[INFO] CDC Notification API Service started
[INFO] Listening on http://localhost:3000
[INFO] PostgreSQL LISTEN setup: cdc_outbox
[INFO] Waiting for connections...
```

---

## Part 3: Testing (3 minutes)

### Step 3.1: Health Check

```bash
curl -s http://localhost:3000/health | jq
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T10:30:00Z",
  "services": {
    "postgresql": {
      "status": "healthy",
      "lag": 0.5
    },
    "websocket": {
      "status": "healthy",
      "activeConnections": 0
    }
  }
}
```

### Step 3.2: WebSocket Connection (Browser Console)

Open browser developer console and run:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/v1/stream');

ws.onopen = () => {
    // Authenticate with API key
    ws.send(JSON.stringify({
        type: 'auth',
        apiKey: 'cdc_[your-api-key-here]'
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};
```

### Step 3.3: Subscribe to Table Changes

In the same browser console:

```javascript
// After receiving auth_success message:
ws.send(JSON.stringify({
    type: 'subscribe',
    tables: ['orders']
}));
```

### Step 3.4: Generate Test Data

In PostgreSQL:

```sql
-- Insert record and outbox event
BEGIN;
INSERT INTO orders (customer_id, total, status)
VALUES (123, 99.99, 'pending');

INSERT INTO outbox (table_name, operation, after_data)
VALUES ('orders', 'INSERT', jsonb_build_object(
    'id', (SELECT max(id) FROM orders),
    'customer_id', 123,
    'total', 99.99,
    'status', 'pending',
    'created_at', now()
));
COMMIT;
```

**You should see in browser console**:
```
Received: {
  type: "cdc_event",
  eventId: "evt_...",
  tableName: "orders",
  operation: "INSERT",
  data: {
    id: 1,
    customer_id: 123,
    total: 99.99,
    status: "pending",
    created_at: "2025-11-08T10:30:00Z"
  },
  timestamp: "2025-11-08T10:30:00Z",
  version: 1
}
```

---

## Part 4: Application Integration (2 minutes)

### Step 4.1: Node.js Example

```javascript
const WebSocket = require('ws');

const API_KEY = 'cdc_[your-key]';
const WS_URL = 'ws://localhost:3000/v1/stream';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    // Step 1: Authenticate
    ws.send(JSON.stringify({
        type: 'auth',
        apiKey: API_KEY
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.type === 'auth_success') {
        console.log('Authenticated! Subscribing to orders...');
        // Step 2: Subscribe
        ws.send(JSON.stringify({
            type: 'subscribe',
            tables: ['orders']
        }));
    }
    
    if (message.type === 'cdc_event') {
        console.log(`${message.operation} on ${message.tableName}:`, message.data);
        // Handle event
        handleOrderChange(message);
    }
    
    if (message.type === 'error') {
        console.error(`Error: ${message.message}`);
    }
});

ws.on('close', () => {
    console.log('Disconnected, reconnecting in 3 seconds...');
    setTimeout(() => {
        // Reconnect with exponential backoff
        ws = new WebSocket(WS_URL);
    }, 3000);
});

function handleOrderChange(event) {
    switch(event.operation) {
        case 'INSERT':
            console.log('New order:', event.data);
            break;
        case 'UPDATE':
            console.log('Order updated:', event.data);
            break;
        case 'DELETE':
            console.log('Order deleted:', event.beforeData);
            break;
    }
}
```

### Step 4.2: Python Example

```python
import asyncio
import json
import websockets
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_KEY = 'cdc_[your-key]'
WS_URL = 'ws://localhost:3000/v1/stream'

async def connect_to_cdc():
    uri = WS_URL
    async with websockets.connect(uri) as websocket:
        # Authenticate
        await websocket.send(json.dumps({
            'type': 'auth',
            'apiKey': API_KEY
        }))
        
        # Wait for auth response
        response = json.loads(await websocket.recv())
        if response['type'] == 'auth_success':
            logger.info(f"Authenticated! Connection ID: {response['connectionId']}")
            
            # Subscribe to orders
            await websocket.send(json.dumps({
                'type': 'subscribe',
                'tables': ['orders']
            }))
        
        # Listen for events
        async for message in websocket:
            event = json.loads(message)
            
            if event['type'] == 'cdc_event':
                handle_order_change(event)
            elif event['type'] == 'error':
                logger.error(f"Error: {event['message']}")
            elif event['type'] == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))

def handle_order_change(event):
    operation = event['operation']
    table = event['tableName']
    data = event['data']
    
    logger.info(f"{operation} on {table}: {data}")

if __name__ == '__main__':
    asyncio.run(connect_to_cdc())
```

---

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution**:
- Verify service is running: `curl http://localhost:3000/health`
- Check port configuration in `.env`
- Verify firewall allows connections

### Authentication Failed

```
auth_failure: invalid_api_key
```

**Solution**:
- Verify API key in database: `SELECT * FROM api_keys WHERE is_active = true;`
- Check key hasn't expired
- Ensure correct key format: `cdc_[64-char-random]`

### No Events Received

**Solution**:
- Verify subscription was confirmed: check for `subscription_confirmed` message
- Verify outbox events are being created: `SELECT COUNT(*) FROM outbox WHERE processed = false;`
- Check service logs for errors
- Verify table name spelling matches exactly

### Queue Full (Too Many Queued Events)

**Solution**:
- Implement faster event processing on client
- Reconnect to reset queue
- Monitor event rate with `/health` endpoint

---

## Next Steps

1. **Production Deployment**:
   - Use Docker container for service
   - Set up PostgreSQL connection pooling
   - Configure authentication with real API keys
   - Set up monitoring and alerting

2. **Advanced Features**:
   - Implement event filtering by row criteria
   - Add event replay capability for new subscribers
   - Set up dead letter handling for failed events

3. **Monitoring**:
   - Track event latency with `/health` endpoint
   - Monitor queue depths and connection counts
   - Set up alerts for service degradation

---

## Documentation References

- [OpenAPI Specification](contracts/openapi.yaml)
- [WebSocket Message Schema](contracts/websocket-messages.md)
- [Data Model](data-model.md)
- [Implementation Plan](plan.md)
- [Research & Design Decisions](research.md)
