# Data Model: Change Data Capture Notification API Service

**Date**: 2025-11-08  
**Phase**: Phase 1 - Design  
**Feature**: Change Data Capture Notification API Service

## Overview

This document defines the data structures, entities, and their relationships for the CDC notification API service. The model focuses on outbox pattern implementation, client subscription management, and event routing.

---

## Core Entities

### 1. Outbox Table

**Purpose**: Transactional event log ensuring no data loss during database operations.

**Entity Name**: `outbox`

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-----------|-------------|
| id | SERIAL | PRIMARY KEY | Unique event identifier |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When event was created |
| table_name | VARCHAR(255) | NOT NULL | Source table for change |
| operation | VARCHAR(10) | NOT NULL, CHECK IN ('INSERT', 'UPDATE', 'DELETE') | Operation type |
| after_data | JSONB | NULLABLE | Row data after operation |
| before_data | JSONB | NULLABLE | Row data before operation (UPDATE/DELETE only) |
| processed | BOOLEAN | DEFAULT FALSE | Whether event has been published |
| error_message | TEXT | NULLABLE | Error details if publication failed |
| published_at | TIMESTAMP | NULLABLE | When event was successfully published |

**Validation Rules**:
- `after_data` MUST be present for INSERT and UPDATE operations
- `before_data` MUST be present for UPDATE and DELETE operations
- `after_data` MUST be NULL for DELETE operations
- `table_name` MUST match registered source table name
- Only unprocessed events are eligible for publication

**State Transitions**:
```
[New Event] 
    ↓ (publication attempt)
[Being Published]
    ↓ (success)
[Processed] (published_at set, processed = true)
    
[Being Published]
    ↓ (failure)
[Error] (error_message set, published_at NULL, processed = false)
    ↓ (retry after backoff)
[Being Published]
```

**Indexes**:
- PRIMARY KEY on `id` (clustered)
- INDEX on `processed` (for polling unprocessed events)
- INDEX on `created_at DESC` (for time-based queries)
- INDEX on `(table_name, processed)` (for subscription filtering)

---

### 2. API Keys

**Purpose**: Secure authentication of clients and permission scoping.

**Entity Name**: `api_keys`

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-----------|-------------|
| id | SERIAL | PRIMARY KEY | Unique key identifier |
| name | VARCHAR(255) | NOT NULL | Human-readable name |
| key_hash | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hash of actual key |
| scopes | JSONB | NOT NULL | Permissions: `{"tables": ["*"]}` or `{"tables": ["orders", "customers"]}` |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation time |
| last_used_at | TIMESTAMP | NULLABLE | Last successful authentication |
| is_active | BOOLEAN | DEFAULT TRUE | Whether key is enabled |
| expires_at | TIMESTAMP | NULLABLE | Optional expiration date |

**Validation Rules**:
- `key_hash` MUST be SHA-256 hash (64 hex characters)
- `scopes` MUST contain at least one table or wildcard
- `name` MUST be 1-255 characters
- `created_at` MUST be set to current timestamp
- `expires_at`, if set, MUST be in future

**Scope Format**:
```json
{
  "tables": ["*"]  // access to all tables
}
```
or
```json
{
  "tables": ["orders", "customers", "products"]
}
```

**Indexes**:
- PRIMARY KEY on `id` (clustered)
- UNIQUE INDEX on `key_hash` (for authentication lookup)
- INDEX on `is_active` (for filtering disabled keys)
- INDEX on `expires_at` (for cleanup queries)

---

### 3. Client Subscriptions (In-Memory)

**Purpose**: Track active client connections and their subscription interests.

**Entity Name**: `ClientSubscription` (application-level, not database)

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| connectionId | UUID | Unique WebSocket connection identifier |
| apiKeyId | UUID | Reference to authenticated API key |
| subscribedTables | Set<String> | Set of table names client listens to |
| isAuthenticated | Boolean | Whether client has passed auth |
| connectedAt | DateTime | Connection establishment time |
| lastHeartbeatAt | DateTime | Last successful heartbeat |
| inMemoryQueue | Queue<Event> | Events queued for this client (max 10,000) |
| metadata | Object | Client context (user agent, IP, etc.) |

**Validation Rules**:
- `connectionId` MUST be unique
- `apiKeyId` MUST reference valid, active API key
- `subscribedTables` MUST have at least one table, all must exist
- `inMemoryQueue` size MUST NOT exceed 10,000 events
- Events in queue MUST have age < 5 minutes

**Lifecycle**:
```
[New Connection]
    ↓ (client sends AUTH)
[Authenticated] (apiKeyId set, isAuthenticated = true)
    ↓ (client sends SUBSCRIBE)
[Ready] (subscribedTables populated)
    ↓ (events arrive matching subscriptions)
[Sending Events]
    ↓ (client disconnects or timeout)
[Closed] (removed from memory)
```

---

### 4. CDC Event (In-Transit)

**Purpose**: Represents a change event being broadcast to clients.

**Entity Name**: `CDCEvent`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| eventId | UUID | Unique event identifier (from outbox.id) |
| tableName | String | Source table name |
| operation | Enum | INSERT, UPDATE, or DELETE |
| afterData | Object | Row state after operation (null for DELETE) |
| beforeData | Object | Row state before operation (null for INSERT) |
| timestamp | DateTime | When change occurred (from outbox.created_at) |
| version | Integer | Event schema version (currently 1) |

**Validation Rules**:
- `eventId` MUST be globally unique
- `tableName` MUST match registered source table
- `operation` MUST be one of: INSERT, UPDATE, DELETE
- `afterData` required for INSERT, UPDATE; null for DELETE
- `beforeData` required for UPDATE, DELETE; null for INSERT
- `timestamp` MUST be before current time

**JSON Serialization** (WebSocket format):
```json
{
  "type": "cdc_event",
  "eventId": "12345",
  "tableName": "orders",
  "operation": "INSERT",
  "data": {
    "id": 123,
    "customer_id": 456,
    "total": 99.99,
    "created_at": "2025-11-08T10:30:00Z"
  },
  "timestamp": "2025-11-08T10:30:00Z",
  "version": 1
}
```

---

## Relationships

```
Outbox Events 
    ↓ (published via PostgreSQL NOTIFY)
CDC Events (in-transit)
    ↓ (routed to matching subscribers)
Client Subscriptions
    ↓ (queued and delivered)
Connected WebSocket Clients
```

**API Key Scope Validation**:
```
Client authenticates with API Key
    ↓ (lookup key_hash in api_keys table)
Retrieve permitted `scopes.tables` list
    ↓ (validate against subscription request)
Only allow subscriptions to scoped tables
```

---

## Schema Definition

### PostgreSQL DDL

```sql
-- Outbox table for transactional event capture
CREATE TABLE outbox (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    after_data JSONB,
    before_data JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    published_at TIMESTAMP,
    CONSTRAINT operation_check CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT after_data_check CHECK (
        (operation = 'DELETE' AND after_data IS NULL) OR
        (operation IN ('INSERT', 'UPDATE') AND after_data IS NOT NULL)
    ),
    CONSTRAINT before_data_check CHECK (
        (operation = 'INSERT' AND before_data IS NULL) OR
        (operation IN ('UPDATE', 'DELETE') AND before_data IS NOT NULL)
    )
);

CREATE INDEX idx_outbox_processed ON outbox(processed) WHERE processed = FALSE;
CREATE INDEX idx_outbox_created_at ON outbox(created_at DESC);
CREATE INDEX idx_outbox_table_processed ON outbox(table_name, processed);

-- API Keys table
CREATE TABLE api_keys (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '{"tables": ["*"]}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP,
    CONSTRAINT key_hash_format CHECK (key_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT scopes_validation CHECK (scopes ? 'tables')
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Trigger to notify on new outbox entries
CREATE FUNCTION notify_outbox_change() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('cdc_outbox', json_build_object(
        'id', NEW.id,
        'table_name', NEW.table_name,
        'operation', NEW.operation
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER outbox_notify AFTER INSERT ON outbox
FOR EACH ROW EXECUTE FUNCTION notify_outbox_change();
```

---

## Constraints and Rules

### Data Integrity

1. **Outbox Immutability**: Once inserted, outbox records are never modified, only marked as processed
2. **Event Ordering**: Events for a single table maintain insertion order (guaranteed by id sequence)
3. **Atomic Publication**: An event is either fully processed or marked with error; no partial states
4. **Key Expiration**: Expired API keys are treated as inactive

### Business Rules

1. **Scope Validation**: Clients can only subscribe to tables listed in their API key scopes
2. **Queue Overflow**: When in-memory queue reaches 10,000 events, oldest events are dropped
3. **Event TTL**: Events in client queue expire after 5 minutes if not delivered
4. **Heartbeat Required**: Clients must respond to heartbeat within 60 seconds or connection is closed
5. **Schema Version**: Events include version number for forward/backward compatibility

---

## Migration Path

### Version 1.0 (Current)

- Outbox table with basic JSONB fields
- API key authentication with table scoping
- In-memory client subscription tracking
- Simple event routing by table name

### Future Enhancements

- Row-level filtering in subscriptions (beyond table-level)
- Dead letter table for permanently failed events
- Event replay capability for new subscribers
- Multiple outbox tables for different domains
- Compression for large payloads

---

## Index Strategy

### Outbox Indexes

| Index | Reason | Query Pattern |
|-------|--------|---------------|
| PRIMARY KEY (id) | Unique identification | Find specific event |
| (processed) WHERE processed=FALSE | Fast unprocessed query | Polling for new events |
| (created_at DESC) | Time-based queries | Recent events, pagination |
| (table_name, processed) | Scoped filtering | Events by table + status |

### API Keys Indexes

| Index | Reason | Query Pattern |
|-------|--------|---------------|
| PRIMARY KEY (id) | Unique identification | By key ID |
| UNIQUE (key_hash) | Auth lookup | Validate provided key |
| (is_active) | Filter active keys | Only check active keys |
| (expires_at) | Cleanup queries | Find expired keys |

---

## Scalability Considerations

1. **Outbox Growth**: Archive old processed events after 30 days to keep active table lean
2. **API Keys**: Cache key validation in application for 5 minutes to reduce queries
3. **In-Memory Queues**: Monitor total heap usage, implement alerts at 80% threshold
4. **Connection Pooling**: Pool size should be 2-3x expected concurrent subscriptions
5. **Partitioning**: Consider partitioning outbox table by table_name for very high volume
