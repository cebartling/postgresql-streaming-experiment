# Implementation Plan: Change Data Capture Notification API Service

**Branch**: `003-cdc-notification-api` | **Date**: 2025-11-08 | **Spec**: [spec.md](spec.md)
**Input**: "Implement the LISTEN/NOTIFY + outbox pattern in PostgreSQL as a lightweight way to push real-time change signals to clients."

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create an API service that listens to PostgreSQL NOTIFY events (generated from an outbox table pattern) and broadcasts real-time change notifications to connected web clients. The LISTEN/NOTIFY + outbox pattern provides a lightweight, PostgreSQL-native way to implement change data capture without requiring logical replication or external tools. The service will authenticate clients via API keys, route events to subscribers, and maintain an in-memory queue for temporarily unavailable clients.

## Technical Context

**Language/Version**: Node.js 18+ or Python 3.10+  
**Primary Dependencies**: WebSocket library (ws for Node or websockets for Python), PostgreSQL async driver (pg or asyncpg), Express/FastAPI for API  
**Storage**: PostgreSQL (outbox table pattern, no separate storage)  
**Testing**: Jest/Mocha (Node) or pytest (Python)  
**Target Platform**: Linux server (Docker-containerizable)  
**Project Type**: Single service (API backend)  
**Performance Goals**: 1,000+ concurrent connections, 1,000 events/second throughput, <2 second latency for 95th percentile  
**Constraints**: In-memory queue (memory-bounded), no persistent event store (events discarded after delivery or timeout)  
**Scale/Scope**: Single-region service initially, designed for horizontal scaling via state sharing in PostgreSQL

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Reliability First ✅
- **Status**: PASS
- **Rationale**: The LISTEN/NOTIFY + outbox pattern is specifically designed for reliable CDC. In-memory queuing with PostgreSQL as the source of truth ensures no events are lost during normal operation. All design decisions prioritize exactly-once or at-least-once semantics.

### Observability & Debuggability ✅
- **Status**: PASS with Requirements
- **Requirements**: 
  - Structured logging for all events (NOTIFY received, client subscriptions, delivery attempts)
  - Metrics: event lag, throughput, queue depth, client connection count, error rates
  - Trace IDs for correlating client connections to events
  - All database operations logged at appropriate levels
- **Rationale**: CDC systems require operational visibility. The plan includes extensive logging and metrics to understand system behavior and debug issues.

### Test Coverage (NON-NEGOTIABLE) ✅
- **Status**: PASS with Requirements
- **Requirements**:
  - Unit tests for subscription routing logic
  - Integration tests for PostgreSQL LISTEN/NOTIFY interaction
  - Contract tests for API endpoints and WebSocket message schemas
  - Test coverage target: 80% minimum
- **Rationale**: CDC is critical infrastructure. All business logic, event routing, and database interactions must be thoroughly tested.

### Simplicity & YAGNI ✅
- **Status**: PASS
- **Rationale**: LISTEN/NOTIFY + outbox is a proven, simple pattern that avoids external CDC tools. In-memory queuing keeps the design straightforward. No premature optimization or speculative features planned.

### Versioning & Compatibility ✅
- **Status**: PASS with Requirements
- **Requirements**:
  - API versioning (starting at v1)
  - WebSocket message schema versioning
  - Database schema versioning for outbox table
  - Document backward compatibility for rolling upgrades
- **Rationale**: CDC systems often run continuously in production. Clear versioning enables safe upgrades.

### Overall Gate Status: ✅ PASSED
All constitutional principles are satisfied. Ready to proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/                          # Data models
│   ├── subscription.ts              # Client subscription definition
│   ├── event.ts                     # CDC event structure
│   └── outbox.ts                    # Outbox table schema/interface
├── services/                        # Business logic
│   ├── postgresql-listener.ts       # LISTEN/NOTIFY listener
│   ├── event-router.ts              # Event routing to subscribers
│   ├── subscription-manager.ts      # Client subscription management
│   ├── api-key-validator.ts         # API key authentication
│   └── queue-manager.ts             # In-memory event queue
├── api/                             # HTTP API endpoints
│   ├── health.ts                    # Health check endpoint
│   ├── subscriptions.ts             # Subscription management endpoints
│   └── websocket.ts                 # WebSocket connection handler
├── config/
│   ├── database.ts                  # PostgreSQL connection config
│   └── environment.ts               # Environment variables
├── utils/
│   ├── logger.ts                    # Structured logging
│   ├── metrics.ts                   # Metrics collection
│   └── errors.ts                    # Error definitions
└── main.ts                          # Application entry point

tests/
├── unit/                            # Unit tests
│   ├── event-router.test.ts
│   ├── subscription-manager.test.ts
│   └── api-key-validator.test.ts
├── integration/                     # Integration tests
│   ├── postgresql-listener.test.ts
│   └── outbox-table.test.ts
├── contract/                        # Contract tests
│   ├── api-endpoints.test.ts
│   └── websocket-messages.test.ts
└── fixtures/
    └── test-database.ts

docs/
├── db/
│   └── outbox-schema.sql            # Outbox table SQL definition
└── api/
    └── openapi.yaml                 # API specification

.env.example                         # Environment variables template
package.json / pyproject.toml        # Dependency management
docker-compose.test.yml             # Test database setup
```

**Structure Decision**: Single service (Option 1) with clear separation between models, services, and API handlers. PostgreSQL configuration is externalized for flexibility. Testing includes unit, integration, and contract layers to satisfy constitutional test coverage requirements. Documentation includes database schema and API specification for reference.

## Complexity Tracking

No constitution violations. All design decisions follow established principles (Reliability, Observability, Test Coverage, Simplicity, Versioning).

---

## Phase 0: Research & Clarifications ✅ COMPLETE

**Output Files**:
- `research.md` - Comprehensive analysis of LISTEN/NOTIFY pattern, outbox pattern, event routing, and technology decisions

**Clarifications Resolved**:
- Event buffering strategy: In-memory queue with 10,000 event limit
- Authentication mechanism: API keys with table-level scoping
- Subscription granularity: Table-level (entire table subscriptions)

---

## Phase 1: Design & Contracts ✅ COMPLETE

**Output Files**:
- `data-model.md` - Complete entity definitions including Outbox, API Keys, Client Subscriptions, CDC Events
- `contracts/openapi.yaml` - REST API specification for HTTP endpoints (health, subscriptions, state queries)
- `contracts/websocket-messages.md` - WebSocket message protocol for real-time event delivery
- `quickstart.md` - 10-minute setup guide with code examples

**Key Deliverables**:
1. **Data Model**: 
   - Outbox table schema with constraints and indexes
   - API keys table with scoping and validation
   - Client subscription entity tracking
   - CDC event structure with versioning

2. **API Contracts**:
   - REST endpoints: `/health`, `/v1/subscriptions`, `/v1/state`
   - WebSocket protocol: auth, subscribe, cdc_event messages
   - Error handling with specific error codes
   - Backward compatibility strategy

3. **Getting Started**:
   - Database setup with DDL scripts
   - Service startup instructions
   - Client connection examples (JavaScript, Python)
   - Troubleshooting guide

---

## Phase 2: Task Generation (Next Step)

Run `/speckit.tasks` to:
- Break down implementation into specific, testable tasks
- Assign story points and priorities
- Define test coverage requirements
- Create dependency graph for parallel development

---

## Architecture Summary

**Pattern**: PostgreSQL LISTEN/NOTIFY + Outbox
- Applications insert events into outbox table (transactionally)
- Separate CDC service listens for outbox notifications
- Events published to PostgreSQL NOTIFY channels
- WebSocket connections subscribe to channels and receive events
- In-memory queue handles temporarily disconnected clients

**Scaling Model**:
- Stateless service (can run multiple instances)
- Shared state in PostgreSQL (outbox, api_keys tables)
- Horizontal scaling via load balancing
- Connection pooling to PostgreSQL

**Key Constraints**:
- In-memory queue limited to 10,000 events per subscription
- Events expire after 5 minutes if not delivered
- 8KB NOTIFY payload limit (sufficient for most changes)
- API key authentication required for all connections
