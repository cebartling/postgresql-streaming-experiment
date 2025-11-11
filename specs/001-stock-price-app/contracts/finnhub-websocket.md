# API Contract: Finnhub WebSocket Integration

**Service**: Finnhub Stock API  
**Protocol**: WebSocket (WSS)  
**Version**: v1  
**Date**: 2025-11-10

## Overview

This contract defines the WebSocket integration with Finnhub for real-time stock price updates. The application uses WebSocket streaming to receive live price data for 15 predefined stocks.

---

## Connection

### WebSocket URL

```
wss://ws.finnhub.io?token={API_KEY}
```

**Parameters**:
- `token` (required): Finnhub API key for authentication

**Example**:
```
wss://ws.finnhub.io?token=abc123def456
```

### Connection Lifecycle

```
1. Create WebSocket connection with API key in URL
2. Wait for 'open' event
3. Send subscription messages for each stock symbol
4. Receive real-time price updates via 'message' events
5. Handle 'error' and 'close' events
6. Implement reconnection logic with exponential backoff
```

---

## Message Types

### 1. Subscribe Message (Client → Server)

**Purpose**: Subscribe to real-time trades for a specific stock symbol.

**Direction**: Client sends to Finnhub

**Format**:
```json
{
  "type": "subscribe",
  "symbol": "AAPL"
}
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be "subscribe" |
| `symbol` | string | Yes | Stock ticker symbol (e.g., "AAPL", "GOOGL") |

**Example** (subscribing to multiple symbols):
```javascript
socket.send(JSON.stringify({'type':'subscribe', 'symbol':'AAPL'}));
socket.send(JSON.stringify({'type':'subscribe', 'symbol':'GOOGL'}));
socket.send(JSON.stringify({'type':'subscribe', 'symbol':'MSFT'}));
```

**Validation**:
- Symbol must be a valid US stock ticker
- Maximum 50 symbols can be subscribed per connection (free tier)
- Symbol is case-sensitive (use uppercase)

---

### 2. Unsubscribe Message (Client → Server)

**Purpose**: Unsubscribe from a stock symbol's updates.

**Direction**: Client sends to Finnhub

**Format**:
```json
{
  "type": "unsubscribe",
  "symbol": "AAPL"
}
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be "unsubscribe" |
| `symbol` | string | Yes | Stock ticker symbol to unsubscribe from |

**Use Case**: Not needed for this application (static watchlist), but available for future enhancements.

---

### 3. Trade Update Message (Server → Client)

**Purpose**: Real-time trade data for subscribed symbols.

**Direction**: Finnhub sends to client

**Format**:
```json
{
  "type": "trade",
  "data": [
    {
      "s": "AAPL",
      "p": 148.85,
      "t": 1731278400123,
      "v": 100
    }
  ]
}
```

**Top-Level Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always "trade" for trade updates |
| `data` | array | Array of trade objects (can contain multiple trades) |

**Trade Object Fields**:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `s` | string | Stock symbol | "AAPL" |
| `p` | number | Last trade price | 148.85 |
| `t` | number | Unix timestamp in milliseconds | 1731278400123 |
| `v` | number | Volume (number of shares traded) | 100 |

**Example with Multiple Trades**:
```json
{
  "type": "trade",
  "data": [
    {"s": "AAPL", "p": 148.85, "t": 1731278400123, "v": 100},
    {"s": "AAPL", "p": 148.86, "t": 1731278400456, "v": 50},
    {"s": "GOOGL", "p": 2845.50, "t": 1731278400789, "v": 200}
  ]
}
```

**Processing Logic**:
```javascript
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'trade') {
    message.data.forEach(trade => {
      updateStockPrice(trade.s, trade.p, trade.t);
    });
  }
});
```

---

### 4. Ping Message (Server → Client)

**Purpose**: Heartbeat to keep connection alive.

**Direction**: Finnhub sends to client

**Format**:
```json
{
  "type": "ping"
}
```

**Client Response**: No response required. Finnhub automatically sends pings; client should not close connection on ping.

---

## Error Handling

### Connection Errors

**Event**: `onerror`

**Handling**:
```javascript
socket.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
  // Set connection status to 'error'
  // Display user-friendly error message
  // Attempt reconnection with exponential backoff
});
```

**Common Errors**:
- Invalid API key: Connection fails immediately
- Network issues: Connection drops unexpectedly
- Rate limit exceeded: Connection may be throttled

---

### Connection Close

**Event**: `onclose`

**Handling**:
```javascript
socket.addEventListener('close', (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  
  // Attempt reconnection if not intentional close
  if (event.code !== 1000) { // 1000 = normal closure
    reconnect WithBackoff();
  }
});
```

**Close Codes**:
- `1000`: Normal closure (intentional disconnect)
- `1006`: Abnormal closure (connection lost)
- `1008`: Policy violation (e.g., invalid API key)

---

### Reconnection Strategy

**Exponential Backoff**:
```javascript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY = 1000; // 1 second

function reconnectWithBackoff() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    showError('Unable to connect to stock data service');
    return;
  }
  
  const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  
  setTimeout(() => {
    initializeWebSocket();
  }, delay);
}
```

**Backoff Schedule**:
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds
- Attempt 6+: 30 seconds (capped)

---

## Rate Limits

**Free Tier Limits**:
- Maximum 50 symbols subscribed per connection
- 60 WebSocket messages per second (internal Finnhub limit)
- Unlimited total messages (no daily/monthly limit)

**Application Usage**:
- 15 symbols subscribed (well within 50 limit)
- Real-time push (no polling, no rate limit concerns)
- Expected: 1-10 messages per second (varies with trading volume)

**Monitoring**:
- Track message count per minute
- Log warning if approaching limits
- No action needed for this application (well under limits)

---

## Data Mapping

### Finnhub Response → Application Data Model

```javascript
function mapToStockModel(trade, previousData) {
  return {
    symbol: trade.s,
    currentPrice: trade.p,
    previousClose: previousData.previousClose, // From initial REST call
    netChange: trade.p - previousData.previousClose,
    percentChange: ((trade.p - previousData.previousClose) / previousData.previousClose) * 100,
    dayHigh: Math.max(trade.p, previousData.dayHigh),
    dayLow: Math.min(trade.p, previousData.dayLow),
    openPrice: previousData.openPrice, // From initial REST call
    timestamp: Math.floor(trade.t / 1000), // Convert ms to seconds
    priceDirection: trade.p > previousData.currentPrice ? 'up' : 
                     trade.p < previousData.currentPrice ? 'down' : 'unchanged'
  };
}
```

**Note**: WebSocket only provides current price. Other fields (previousClose, dayHigh, dayLow, openPrice) must be fetched initially via REST API.

---

## Initial Data Fetch (REST API)

**Purpose**: Get full quote data (open, high, low, previous close) for each symbol before WebSocket streaming.

**Endpoint**: `GET https://finnhub.io/api/v1/quote`

**Parameters**:
- `symbol` (required): Stock ticker
- `token` (required): API key

**Example Request**:
```
GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=abc123
```

**Example Response**:
```json
{
  "c": 148.85,  // Current price
  "d": 0.17,    // Change
  "dp": 0.11,   // Percent change
  "h": 149.99,  // High
  "l": 148.44,  // Low
  "o": 149.42,  // Open
  "pc": 148.68, // Previous close
  "t": 1731278400 // Timestamp (seconds)
}
```

**Usage**:
1. On app initialization, fetch quote for each symbol via REST
2. Populate initial stock data with full fields
3. Open WebSocket connection
4. WebSocket trades update only `currentPrice` and `timestamp`
5. Recalculate derived fields (netChange, percentChange, priceDirection)

---

## Complete Integration Flow

```
1. Application Initialization
   ├─ Fetch initial quotes via REST API for all 15 symbols
   ├─ Populate stock data with full fields (open, high, low, previousClose)
   └─ Display initial prices to user

2. WebSocket Connection
   ├─ Create WebSocket: wss://ws.finnhub.io?token=API_KEY
   ├─ Wait for 'open' event
   └─ Subscribe to all 15 symbols

3. Real-Time Updates
   ├─ Receive 'message' events with trade data
   ├─ Parse JSON and extract price updates
   ├─ Update only currentPrice and timestamp
   ├─ Recalculate netChange, percentChange, priceDirection
   └─ Trigger UI re-render

4. Error Handling
   ├─ On 'error': Log, show user message, attempt reconnect
   ├─ On 'close': Check close code, reconnect if abnormal
   └─ On invalid data: Log, ignore, keep previous valid data

5. Cleanup (on app unmount)
   ├─ Unsubscribe from all symbols (optional)
   └─ Close WebSocket connection normally (code 1000)
```

---

## Security Considerations

**API Key Exposure**:
- ⚠️ API key is visible in WebSocket URL (browser DevTools)
- ✅ Acceptable for public read-only data (stock prices)
- ✅ WebSocket uses WSS (encrypted)
- ✅ Worst case: Key abuse uses your rate limit (no financial impact)
- ✅ Mitigation: Monitor usage, rotate key if compromised

**Alternative (Higher Security)**:
- Use Netlify Function as WebSocket proxy
- Client connects to function, function connects to Finnhub
- Adds complexity with minimal benefit for this use case

---

## Testing & Validation

### Connection Test

```javascript
const testConnection = () => {
  const socket = new WebSocket('wss://ws.finnhub.io?token=YOUR_KEY');
  
  socket.addEventListener('open', () => {
    console.log('✅ Connection successful');
    socket.send(JSON.stringify({'type':'subscribe', 'symbol':'AAPL'}));
  });
  
  socket.addEventListener('message', (event) => {
    console.log('✅ Message received:', JSON.parse(event.data));
  });
  
  socket.addEventListener('error', (error) => {
    console.error('❌ Connection error:', error);
  });
};
```

### Expected Behavior

**During Market Hours**:
- Receive 1-10 messages per second per symbol (varies with trading volume)
- Each message contains 1 or more trades
- Prices update in real-time

**After Market Hours**:
- Very few messages (low after-hours volume)
- Possible to receive no messages for minutes
- Show "Market Closed" status to users

---

## Summary

| Aspect | Details |
|--------|---------|
| **Protocol** | WebSocket (WSS) |
| **URL** | `wss://ws.finnhub.io?token={API_KEY}` |
| **Authentication** | API key in query parameter |
| **Message Format** | JSON |
| **Update Frequency** | Real-time push (1-10 msgs/sec per symbol) |
| **Rate Limit** | 60 msgs/sec, 50 symbols max |
| **Error Handling** | Exponential backoff reconnection |
| **Initial Data** | REST API `/quote` endpoint |
| **Security** | WSS encryption, public read-only data |

**Integration Complexity**: Low  
**Latency**: <100ms (real-time)  
**Reliability**: High (auto-reconnect)
