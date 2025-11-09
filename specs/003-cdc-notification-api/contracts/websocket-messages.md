# WebSocket Message Schema Contract

**Version**: 1.0.0  
**Last Updated**: 2025-11-08  
**Feature**: Change Data Capture Notification API Service

## Overview

This document defines the WebSocket message protocol for real-time CDC event delivery. All messages are JSON-encoded and include a `type` field to distinguish message categories.

---

## Connection Lifecycle

### 1. Initial Connection (Client → Server)

WebSocket connection established at: `ws://localhost:3000/v1/stream` (HTTP upgrade required)

**Client Action**: Establish WebSocket connection
```
GET /v1/stream HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: [base64-encoded-key]
Sec-WebSocket-Version: 13
```

### 2. Authentication (Client → Server)

**Message Type**: `auth`

```json
{
  "type": "auth",
  "apiKey": "cdc_[64-character-random-string]"
}
```

**Fields**:
- `type` (string, required): Must be `"auth"`
- `apiKey` (string, required): API key from authentication configuration

**Server Response on Success**:
```json
{
  "type": "auth_success",
  "connectionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Authentication successful"
}
```

**Server Response on Failure**:
```json
{
  "type": "auth_failure",
  "error": "invalid_api_key",
  "message": "The provided API key is invalid or has expired",
  "timestamp": "2025-11-08T10:30:00Z"
}
```

Connection closed immediately after auth failure.

### 3. Subscription (Client → Server)

**Message Type**: `subscribe`

```json
{
  "type": "subscribe",
  "tables": ["orders", "customers"]
}
```

**Fields**:
- `type` (string, required): Must be `"subscribe"`
- `tables` (array of strings, required): Table names to listen to
  - Minimum 1 table
  - Maximum 100 tables per subscription
  - Must be allowed by API key scopes

**Server Response on Success**:
```json
{
  "type": "subscription_confirmed",
  "subscriptionId": "sub_550e8400-e29b-41d4-a716-446655440000",
  "status": "confirmed",
  "tables": ["orders", "customers"],
  "message": "Successfully subscribed to 2 tables"
}
```

**Server Response on Failure**:
```json
{
  "type": "subscription_rejected",
  "subscriptionId": "sub_550e8400-e29b-41d4-a716-446655440000",
  "status": "rejected",
  "error": "permission_denied",
  "message": "API key does not have permission to subscribe to 'products' table",
  "details": {
    "deniedTables": ["products"],
    "allowedTables": ["orders", "customers"]
  }
}
```

---

## Event Delivery

### CDC Event (Server → Client)

**Message Type**: `cdc_event`

```json
{
  "type": "cdc_event",
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440000",
  "tableName": "orders",
  "operation": "INSERT",
  "data": {
    "id": 12345,
    "customer_id": 67890,
    "total": 99.99,
    "status": "pending",
    "created_at": "2025-11-08T10:30:00Z"
  },
  "timestamp": "2025-11-08T10:30:00Z",
  "version": 1
}
```

**Fields**:
- `type` (string, required): Always `"cdc_event"`
- `eventId` (string, required, UUID format): Globally unique event identifier
- `tableName` (string, required): Source table name
- `operation` (string, required): One of `"INSERT"`, `"UPDATE"`, `"DELETE"`
- `data` (object, required): Row data after operation
  - For INSERT/UPDATE: complete row data
  - For DELETE: null (use `beforeData` to see deleted row)
- `beforeData` (object, optional): Previous row state
  - Only present for UPDATE and DELETE operations
  - For UPDATE: fields that changed
  - For DELETE: complete deleted row
- `timestamp` (string, required): ISO 8601 datetime when change occurred
- `version` (integer, required): Schema version (currently 1)

**INSERT Example**:
```json
{
  "type": "cdc_event",
  "eventId": "evt_123",
  "tableName": "products",
  "operation": "INSERT",
  "data": {
    "id": 999,
    "name": "New Product",
    "price": 29.99
  },
  "timestamp": "2025-11-08T10:30:00Z",
  "version": 1
}
```

**UPDATE Example**:
```json
{
  "type": "cdc_event",
  "eventId": "evt_124",
  "tableName": "orders",
  "operation": "UPDATE",
  "data": {
    "id": 12345,
    "status": "shipped",
    "updated_at": "2025-11-08T10:31:00Z"
  },
  "beforeData": {
    "status": "pending",
    "updated_at": "2025-11-08T10:30:00Z"
  },
  "timestamp": "2025-11-08T10:31:00Z",
  "version": 1
}
```

**DELETE Example**:
```json
{
  "type": "cdc_event",
  "eventId": "evt_125",
  "tableName": "customers",
  "operation": "DELETE",
  "data": null,
  "beforeData": {
    "id": 67890,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "timestamp": "2025-11-08T10:32:00Z",
  "version": 1
}
```

---

## Connection Management

### Heartbeat/Ping (Server → Client)

**Message Type**: `ping`

Sent every 30 seconds to detect dead connections.

```json
{
  "type": "ping",
  "timestamp": "2025-11-08T10:30:00Z"
}
```

**Client Must Respond With**:

**Message Type**: `pong`

```json
{
  "type": "pong",
  "timestamp": "2025-11-08T10:30:00Z"
}
```

If no `pong` is received within 60 seconds, server closes connection.

### Connection Status (Server → Client)

**Message Type**: `connection_status`

Sent periodically to report connection health.

```json
{
  "type": "connection_status",
  "status": "healthy",
  "queuedEventsCount": 0,
  "activeSubscriptions": 2,
  "uptime": 3600,
  "timestamp": "2025-11-08T10:30:00Z"
}
```

**Fields**:
- `status` (string): One of `"healthy"`, `"degraded"`, `"critical"`
- `queuedEventsCount` (integer): Events waiting in client's queue
- `activeSubscriptions` (integer): Number of active table subscriptions
- `uptime` (integer): Connection uptime in seconds
- `timestamp` (string): Server time

---

## Error Handling

### Error Message (Server → Client)

**Message Type**: `error`

```json
{
  "type": "error",
  "error": "internal_error",
  "message": "An unexpected error occurred processing your request",
  "requestId": "req_550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-11-08T10:30:00Z"
}
```

**Fields**:
- `type` (string, required): Always `"error"`
- `error` (string, required): Machine-readable error code
- `message` (string, required): Human-readable description
- `requestId` (string, optional): Trace ID for debugging
- `timestamp` (string, required): Error occurrence time

**Possible Error Codes**:

| Code | Meaning | Recovery |
|------|---------|----------|
| `invalid_message` | Malformed JSON or missing required fields | Resend with correct format |
| `unauthenticated` | Not authenticated or auth expired | Reconnect and re-authenticate |
| `permission_denied` | API key lacks permission | Use API key with broader scopes |
| `table_not_found` | Requested table doesn't exist | Check table name spelling |
| `invalid_operation` | Unsupported message type or operation | Check protocol documentation |
| `server_error` | Unexpected server error | Reconnect, contact support if persistent |
| `service_degraded` | Service is operating in degraded mode | Retry with backoff |
| `rate_limited` | Too many requests from API key | Implement backoff |

---

## Client Responsibilities

### Message Handling

1. **Authentication**:
   - Must send `auth` message immediately after connection
   - Wait for `auth_success` before sending other messages
   - If `auth_failure` received, close connection

2. **Subscriptions**:
   - Must send `subscribe` message after successful auth
   - Can update subscriptions by sending another `subscribe` message (replaces previous)
   - Track `subscriptionId` for reference

3. **Event Processing**:
   - Process incoming `cdc_event` messages as they arrive
   - Events may arrive out of order across different tables
   - Events for same table maintain order

4. **Heartbeat**:
   - Respond to `ping` with `pong` within 60 seconds
   - If unable to respond, connection may be closed

### Backoff Strategy

```
Connection failed:
  wait 1 second
  retry
  if fails:
    wait 2 seconds
    retry
  if fails:
    wait 4 seconds
    retry
  if fails:
    wait 8 seconds (max backoff)
    retry every 8 seconds
```

### Queued Events

When client reconnects, server may have queued events:
- Events held up to 5 minutes
- Maximum 10,000 events per subscription
- When queue full, oldest events are dropped
- Client should query current state on reconnect to catch up

---

## Message Ordering Guarantees

### Same Table: Ordered Delivery

Events for the same table are delivered in order:
```
Event 1: INSERT order #100
Event 2: UPDATE order #100 (status=shipped)
Event 3: DELETE order #100
```

### Different Tables: No Guaranteed Order

Events from different tables may arrive in any order:
```
Event 1: INSERT product #1
Event 2: INSERT order #100 (may arrive before or after)
Event 3: UPDATE product #1
```

---

## Example Client Flow

```
Client                              Server
  |                                   |
  |--- WebSocket Connect ------------>|
  |                                   |
  |--- auth {"apiKey":"..."} ------->|
  |<------ auth_success {"connectionId":"..."} ---|
  |                                   |
  |--- subscribe {"tables":["orders"]} ---|
  |<------ subscription_confirmed --|
  |                                   |
  |                                   |
  |<------ cdc_event {"operation":"INSERT"...} -|
  |                                   |
  |<------ ping -------|
  |--- pong --------->|
  |                                   |
  |<------ cdc_event {"operation":"UPDATE"...} -|
  |                                   |
  |                                   |
```

---

## Version Compatibility

### Current Version

- **Schema Version**: 1
- **Protocol Version**: 1.0.0

### Future Compatibility

- New event fields will be added with new schema versions
- Clients should ignore unknown fields (forward compatibility)
- Breaking changes will increment schema version
- Clients must implement version negotiation

### Negotiation Example (for future versions)

```json
{
  "type": "protocol_version",
  "requestedVersion": 2,
  "supportedVersions": [1, 2]
}
```
