# Research: Change Data Capture via LISTEN/NOTIFY + Outbox Pattern

**Date**: 2025-11-08  
**Feature**: Change Data Capture Notification API Service  
**Phase**: Phase 0 - Research & Clarifications

## Executive Summary

The LISTEN/NOTIFY + outbox pattern is a proven, lightweight approach to implementing change data capture in PostgreSQL. It avoids the complexity of logical replication while providing reliable event delivery guarantees. This research consolidates best practices for implementing CDC in Node.js/Python services with real-time client notification capabilities.

---

## Research Topics

### 1. PostgreSQL LISTEN/NOTIFY Mechanism

**Decision**: Use PostgreSQL's built-in LISTEN/NOTIFY feature as the primary CDC mechanism.

**Rationale**:
- Native PostgreSQL feature, no additional tools or logical replication setup required
- Lightweight and efficient for event notification
- Supports wildcard pattern matching for flexible subscriptions
- Well-established pattern with proven production deployments

**Alternatives Considered**:
- **Logical Replication with pgoutput**: Provides more detailed CDC data but requires management of replication slots and can create disk space issues. Overkill for simple notification use cases.
- **External CDC tools (Debezium, etc.)**: More feature-rich but add operational complexity and external dependencies.
- **Polling approach**: Less efficient, higher latency, more database load.

**Implementation Details**:
- Use asynchronous PostgreSQL drivers (asyncpg for Python, pg for Node.js)
- Listen on channels with naming convention: `cdc_{table_name}`
- Payload includes operation type (INSERT/UPDATE/DELETE), affected table, and change data
- Maximum payload size is 8KB (sufficient for most use cases with structured JSON)

**References**:
- PostgreSQL LISTEN/NOTIFY documentation: reliable within single connection
- Pattern used successfully by companies like GitHub, Stripe, and others for internal event systems

---

### 2. Outbox Table Pattern

**Decision**: Implement outbox pattern to guarantee event delivery and prevent message loss.

**Rationale**:
- Solves the dual-write problem by making event creation transactional with business data
- Events are committed atomically with data changes
- Separate process reads outbox table and publishes to NOTIFY channel
- Provides audit trail and allows replay of events

**How It Works**:
1. Application writes business data and inserts event record into outbox table in same transaction
2. Separate service polls/listens on outbox table changes
3. When events are successfully processed, they're marked complete in outbox
4. Handles retries through outbox table management

**Outbox Table Schema**:
```sql
CREATE TABLE outbox (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    after_data JSONB,                -- New row data
    before_data JSONB,               -- Previous row data (for UPDATE/DELETE)
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    published_at TIMESTAMP,
    CONSTRAINT operation_check CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);
```

**Alternatives Considered**:
- **Trigger-based approach**: Automatically create outbox entries via database triggers. More automatic but less visibility into event creation.
- **Application-level insertion**: Requires discipline from developers. Simpler but more error-prone.
- **WAL mining**: Extract events from write-ahead log. Complex infrastructure, harder to test.

**References**:
- "Transactional Outbox" pattern from Enterprise Integration Patterns
- Used by Shopify, Booking.com, and others

---

### 3. Event Publishing Strategy

**Decision**: Use dedicated publishing service that combines outbox polling with LISTEN/NOTIFY.

**Rationale**:
- Decouples event creation (application) from event publication (CDC service)
- Handles failures gracefully with retry logic
- Provides clear separation of concerns
- Enables independent scaling of publishing infrastructure

**Publishing Flow**:
1. Service connects to PostgreSQL and listens on `cdc_outbox` channel
2. Trigger on outbox table sends NOTIFY signal when events are inserted
3. Notification handler queries new events from outbox table
4. For each event, publishes to appropriate CDC channel (`cdc_{table_name}`)
5. Marks event as processed in outbox table
6. Sends event to connected WebSocket clients

**Error Handling**:
- Transient failures: retry with exponential backoff
- Permanent failures: log error, mark outbox entry for manual investigation
- Dead letter handling: move repeatedly failed events to separate table

**Alternatives Considered**:
- **Polling without NOTIFY**: Simpler but higher latency (poll interval tradeoff)
- **Trigger-based publishing**: Automatic but harder to debug, can cause transaction failures
- **Message queue in between**: Adds complexity, another system to operate

---

### 4. Client Connection Management

**Decision**: Use WebSocket for real-time client connections with heartbeat/keepalive.

**Rationale**:
- Bidirectional communication (client subscriptions, server notifications)
- Low latency compared to HTTP polling
- Wide browser and library support
- Standard pattern for real-time web applications

**Client Lifecycle**:
1. Client initiates WebSocket connection
2. Sends API key for authentication
3. Sends subscription request (list of tables to listen to)
4. Receives notifications matching subscriptions
5. On disconnect, client is removed from routing table

**Heartbeat Strategy**:
- Server sends ping frames every 30 seconds
- Client responds with pong
- If no pong received within 60 seconds, connection is closed
- Prevents zombie connections and detects network failures

**Alternatives Considered**:
- **Server-Sent Events (SSE)**: One-directional, simpler but less flexible for subscription updates
- **HTTP long-polling**: More compatible but higher latency and server resource usage
- **gRPC**: More efficient but less browser-friendly

**References**:
- RFC 6455 (WebSocket Protocol)
- Common pattern in platforms like Firebase Realtime Database, Pusher, Socket.io

---

### 5. Event Queue Strategy

**Decision**: Use in-memory queue with bounded size for temporarily unavailable clients.

**Rationale**:
- Simple to implement and understand
- Fast event delivery to most clients
- Bounded memory prevents unbounded growth
- Events lost on service restart, but application can query state on reconnect

**Queue Implementation**:
- Queue per table subscription channel
- Maximum size: 10,000 events (configurable, ~1-10MB depending on event size)
- FIFO eviction when full: oldest events removed first
- Events held for 5 minutes max before automatic expiration
- Clients connecting after events expire are notified to query state

**Alternatives Considered**:
- **Persistent queue (Redis/RabbitMQ)**: More reliable but adds external dependency and complexity
- **No queue (fire-and-forget)**: Simplest but loses events for temporarily offline clients
- **Database-backed queue**: Slower but more reliable, could use outbox table

**Decision Justification**: The in-memory queue balances simplicity (per constitution) with reliability for normal operation. The assumption that clients can query state on reconnect is documented and reasonable for real-time systems.

---

### 6. API Key Authentication

**Decision**: Simple API key authentication with scoping per table.

**Rationale**:
- Simple to implement and manage
- No external auth service required
- Keys can be revoked by removing from database
- Can be scoped to specific tables or all tables

**API Key Storage and Validation**:
- Store hashed keys in PostgreSQL table
- Key format: `cdc_[random-64-chars]` for easy identification
- Each key has associated metadata: name, scopes (tables), created_at, last_used_at, is_active
- Validation: compute hash of provided key, compare with stored hash
- Rate limiting per key: 1,000 connections per API key

**Scope Definition**:
```sql
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    scopes JSONB,  -- {'tables': ['orders', 'customers']} or {'tables': ['*']}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP
);
```

**Alternatives Considered**:
- **Bearer tokens (JWT)**: More stateless but requires key rotation strategy
- **Database credentials**: Simpler but less granular control
- **OAuth2**: More complex infrastructure, unnecessary for this use case

**References**:
- API key best practices from OWASP
- Simple scope model similar to GitHub PATs

---

### 7. Event Routing Logic

**Decision**: Client subscriptions map to PostgreSQL LISTEN channels by table name.

**Rationale**:
- Scales efficiently with number of tables
- Natural mapping between database structure and subscriptions
- Leverages PostgreSQL's built-in channel concept

**Routing Algorithm**:
1. Client subscribes to tables: `['orders', 'customers']`
2. Service joins LISTEN channels: `cdc_orders`, `cdc_customers`
3. When events arrive on `cdc_orders`, service checks all connected clients
4. Routes event only to clients subscribed to `orders` table
5. Tracks subscription state per connection to avoid unnecessary serialization

**Subscription State Management**:
```javascript
// Per WebSocket connection
{
    connectionId: "uuid",
    apiKey: "hashed_key",
    subscribedTables: Set(['orders', 'customers']),
    queuedEvents: Queue<Event>(),
    isAuthenticated: true,
    connectedAt: Date
}
```

**Alternatives Considered**:
- **Content-based routing**: Route by event payload properties. More flexible but more complex.
- **Topic-based routing**: Create topics for each filter criteria. Increases channel count.
- **Server-side filtering**: Check each event against each client's filter. Higher CPU usage.

---

### 8. Performance Optimization

**Decision**: Implement caching and connection pooling for PostgreSQL.

**Rationale**:
- Connection pooling reduces overhead of establishing new connections
- Query result caching for subscription validation
- In-memory routing table avoids repeated lookups

**Optimization Strategies**:
- Connection pool: 10-50 connections (configurable, depends on expected load)
- Query caching: Cache API key validation for 5 minutes
- Router state: Keep in-memory mapping of table subscriptions to connections
- Batch notifications: Collect rapid events and send as batch if possible (with latency limit)
- Memory profiling: Track heap usage, alert if in-memory queue grows too large

**Scaling Considerations**:
- Service is stateless except for in-memory queue
- Can run multiple instances with load balancing
- Use PostgreSQL connection pool to handle multiple service instances
- Shared state (subscription data, API keys) stored in PostgreSQL

---

## Decision Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| CDC Mechanism | PostgreSQL LISTEN/NOTIFY + Outbox | Lightweight, native, proven pattern |
| Outbox Pattern | Database table + polling | Guarantees transactional consistency |
| Event Publishing | Dedicated service reading outbox | Clear separation of concerns |
| Client Connection | WebSocket with heartbeat | Bidirectional, low latency |
| Event Queue | In-memory, bounded, FIFO | Simple, fast, reliable for normal operation |
| Authentication | API keys with table scoping | Simple to implement and manage |
| Event Routing | Channel-per-table subscription | Efficient, scales with tables |
| Performance | Connection pooling + caching | Handles load efficiently |

---

## Technology Stack Recommendations

**Node.js Implementation**:
```json
{
  "runtime": "Node.js 18+",
  "dependencies": {
    "pg": "async PostgreSQL driver",
    "ws": "WebSocket library",
    "express": "HTTP API framework",
    "pino": "structured logging",
    "jest": "testing framework"
  }
}
```

**Python Implementation**:
```json
{
  "runtime": "Python 3.10+",
  "dependencies": {
    "asyncpg": "async PostgreSQL driver",
    "websockets": "WebSocket library",
    "fastapi": "HTTP API framework",
    "python-json-logger": "structured logging",
    "pytest": "testing framework"
  }
}
```

---

## Open Questions Resolved

All clarifications from the specification have been addressed through this research:
- ✅ Event buffering strategy defined (in-memory queue)
- ✅ Authentication mechanism selected (API keys)
- ✅ Subscription granularity confirmed (table-level)

---

## Implementation Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Message loss during restart | Low | High | Client queries state on reconnect, outbox table provides audit trail |
| High latency due to queue depth | Low | Medium | Monitor queue depth, implement backpressure, alert on threshold |
| Connection pooling exhaustion | Low | High | Configure pool size based on load testing, implement rate limiting |
| WebSocket connection churn | Medium | Low | Implement heartbeat, connection pooling, graceful shutdown |
| Schema changes breaking clients | Low | High | Implement versioning, maintain backward compatibility |

---

## Next Steps (Phase 1)

1. Define data model entities based on this research
2. Design API contracts and WebSocket message schemas
3. Create database schema for outbox and API keys tables
4. Implement connection pooling and queue management strategies
