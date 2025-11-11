# Data Model: Stock Price Display Web Application

**Feature**: Stock Price Display Web Application  
**Date**: 2025-11-10  
**Status**: Complete

## Overview

This document defines all data entities, structures, and state management for the stock price display application. The application is client-side only with real-time WebSocket data, so no backend database or persistence layer is required.

---

## Entity: Stock

Represents a single stock with its current market data.

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `symbol` | string | Yes | Stock ticker symbol (e.g., "AAPL", "GOOGL") | Uppercase, 1-5 characters, alphanumeric |
| `currentPrice` | number | Yes | Current trading price in USD | Positive number, max 2 decimal places |
| `previousClose` | number | Yes | Previous trading day's closing price | Positive number, max 2 decimal places |
| `netChange` | number | Yes | Change from previous close (currentPrice - previousClose) | Any number, max 2 decimal places |
| `percentChange` | number | Yes | Percentage change from previous close | Any number, max 2 decimal places |
| `dayHigh` | number | Yes | Highest price of the current trading day | Positive number, max 2 decimal places |
| `dayLow` | number | Yes | Lowest price of the current trading day | Positive number, max 2 decimal places |
| `openPrice` | number | Yes | Opening price of the current trading day | Positive number, max 2 decimal places |
| `timestamp` | number | Yes | Unix timestamp of last update (seconds since epoch) | Positive integer |
| `priceDirection` | enum | Yes | Price movement direction: "up", "down", or "unchanged" | One of: "up", "down", "unchanged" |

### Derived Fields (Calculated)

| Field Name | Calculation | Description |
|------------|-------------|-------------|
| `displayTimestamp` | `new Date(timestamp * 1000).toLocaleString()` | Human-readable timestamp |
| `formattedPrice` | `currentPrice.toFixed(2)` | Price formatted to 2 decimal places |
| `formattedChange` | `netChange >= 0 ? '+' + netChange.toFixed(2) : netChange.toFixed(2)` | Change with +/- sign |
| `formattedPercent` | `percentChange >= 0 ? '+' + percentChange.toFixed(2) + '%' : percentChange.toFixed(2) + '%'` | Percentage with +/- sign and % |

### Example

```json
{
  "symbol": "AAPL",
  "currentPrice": 148.85,
  "previousClose": 148.68,
  "netChange": 0.17,
  "percentChange": 0.11,
  "dayHigh": 149.99,
  "dayLow": 148.44,
  "openPrice": 149.42,
  "timestamp": 1731278400,
  "priceDirection": "up"
}
```

---

## Entity: MarketStatus

Represents the current status of the stock market.

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `status` | enum | Yes | Current market state | One of: "open", "closed", "pre-market", "after-hours" |
| `currentTime` | Date | Yes | Current local time | Valid Date object |
| `marketTime` | Date | Yes | Current Eastern Time (market timezone) | Valid Date object |
| `nextOpenTime` | Date | No | When market will next open (if currently closed) | Valid Date object, future time |
| `nextCloseTime` | Date | No | When market will next close (if currently open) | Valid Date object, future time |

### State Transitions

```
[Market Closed] 
  → 4:00 AM ET → [Pre-Market]
  → 9:30 AM ET → [Market Open]
  → 4:00 PM ET → [After-Hours]
  → 8:00 PM ET → [Market Closed]
```

### Example

```json
{
  "status": "open",
  "currentTime": "2025-11-10T14:30:00Z",
  "marketTime": "2025-11-10T09:30:00-05:00",
  "nextOpenTime": null,
  "nextCloseTime": "2025-11-10T16:00:00-05:00"
}
```

---

## Entity: WebSocketConnection

Represents the state of the Finnhub WebSocket connection.

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `socket` | WebSocket | Yes | WebSocket instance | Valid WebSocket object |
| `status` | enum | Yes | Connection state | One of: "connecting", "connected", "disconnected", "error" |
| `lastConnectedAt` | Date | No | Timestamp of last successful connection | Valid Date object |
| `reconnectAttempts` | number | Yes | Number of reconnection attempts | Non-negative integer |
| `subscribedSymbols` | string[] | Yes | List of subscribed stock symbols | Array of uppercase strings |

### State Transitions

```
[Disconnected]
  → connect() → [Connecting]
  → onopen → [Connected]
  → subscribe(symbols) → [Connected with subscriptions]
  → onerror → [Error]
  → close() → [Disconnected]
```

### Example

```json
{
  "socket": WebSocket { readyState: 1 },
  "status": "connected",
  "lastConnectedAt": "2025-11-10T14:30:00Z",
  "reconnectAttempts": 0,
  "subscribedSymbols": ["AAPL", "GOOGL", "MSFT", "AMZN", "META"]
}
```

---

## Entity: AppState

Represents the overall application state (UI state management).

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `stocks` | Stock[] | Yes | Array of all stocks being tracked | Array of Stock objects |
| `marketStatus` | MarketStatus | Yes | Current market status | Valid MarketStatus object |
| `connectionStatus` | WebSocketConnection | Yes | WebSocket connection state | Valid WebSocketConnection object |
| `errorMessage` | string | No | Current error message (if any) | String or null |
| `isLoading` | boolean | Yes | Whether initial data is loading | Boolean |
| `lastUpdateTime` | Date | No | Timestamp of last successful data update | Valid Date object |

### Example

```json
{
  "stocks": [ /* array of Stock objects */ ],
  "marketStatus": { "status": "open", /* ... */ },
  "connectionStatus": { "status": "connected", /* ... */ },
  "errorMessage": null,
  "isLoading": false,
  "lastUpdateTime": "2025-11-10T14:30:15Z"
}
```

---

## Data Flow & State Updates

### Initial Load

```
1. Initialize AppState with empty stocks array
2. Set isLoading = true
3. Create WebSocket connection to Finnhub
4. On connection open:
   a. Subscribe to all predefined symbols
   b. Fetch initial quote data for each symbol
   c. Populate stocks array
   d. Set isLoading = false
5. Calculate and set marketStatus
```

### Real-Time Updates (WebSocket Messages)

```
1. Receive WebSocket message with price update
2. Parse JSON to extract: symbol, price, timestamp
3. Find matching Stock in stocks array by symbol
4. Update Stock fields:
   a. currentPrice = new price
   b. Calculate netChange = currentPrice - previousClose
   c. Calculate percentChange = (netChange / previousClose) * 100
   d. Determine priceDirection by comparing to previous currentPrice
   e. Update timestamp
5. Trigger UI re-render for that stock
6. Update lastUpdateTime in AppState
```

### Error Handling

```
1. On WebSocket error:
   a. Set connectionStatus.status = "error"
   b. Set errorMessage with user-friendly description
   c. Attempt reconnection with exponential backoff
   d. Increment reconnectAttempts

2. On network failure:
   a. Show "Data may be stale" warning
   b. Keep displaying last known prices
   c. Continue attempting reconnection

3. On invalid data:
   a. Log error to console
   b. Ignore invalid update
   c. Keep previous valid data
```

### Market Status Updates

```
1. Every 60 seconds (or on initial load):
   a. Get current Eastern Time
   b. Determine if within market hours:
      - Regular hours: 9:30 AM - 4:00 PM ET (weekdays)
      - Pre-market: 4:00 AM - 9:30 AM ET (weekdays)
      - After-hours: 4:00 PM - 8:00 PM ET (weekdays)
      - Closed: All other times
   c. Update marketStatus.status
   d. Calculate nextOpenTime or nextCloseTime
   e. Trigger UI re-render
```

---

## Validation Rules

### Stock Symbol Validation

```javascript
function isValidSymbol(symbol) {
  return /^[A-Z]{1,5}$/.test(symbol);
}
```

### Price Validation

```javascript
function isValidPrice(price) {
  return typeof price === 'number' && 
         price >= 0 && 
         !isNaN(price) && 
         isFinite(price);
}
```

### Timestamp Validation

```javascript
function isValidTimestamp(timestamp) {
  return typeof timestamp === 'number' && 
         timestamp > 0 && 
         timestamp < Date.now() / 1000 + 86400; // Not more than 1 day in future
}
```

---

## Predefined Stock Watchlist

The application will track these 15 stocks (as determined in research.md):

```javascript
const WATCHLIST = [
  'AAPL',  // Apple
  'GOOGL', // Alphabet/Google
  'MSFT',  // Microsoft
  'AMZN',  // Amazon
  'META',  // Meta/Facebook
  'NVDA',  // NVIDIA
  'TSLA',  // Tesla
  'JPM',   // JPMorgan Chase
  'BAC',   // Bank of America
  'V',     // Visa
  'WMT',   // Walmart
  'DIS',   // Disney
  'JNJ',   // Johnson & Johnson
  'UNH',   // UnitedHealth
  'XOM'    // Exxon Mobil
];
```

---

## State Management Approach (Svelte)

### Svelte Stores

```javascript
// stores.js
import { writable, derived } from 'svelte/store';

// Main application state
export const stocks = writable([]);
export const marketStatus = writable({ status: 'closed' });
export const connectionStatus = writable({ status: 'disconnected' });
export const errorMessage = writable(null);
export const isLoading = writable(true);
export const lastUpdateTime = writable(null);

// Derived stores
export const stocksWithDirection = derived(stocks, $stocks => 
  $stocks.map(stock => ({
    ...stock,
    priceDirection: stock.netChange > 0 ? 'up' : 
                     stock.netChange < 0 ? 'down' : 'unchanged'
  }))
);

export const isMarketOpen = derived(marketStatus, $status => 
  $status.status === 'open'
);
```

### Usage in Svelte Components

```svelte
<script>
  import { stocks, marketStatus, connectionStatus } from './stores.js';
</script>

{#each $stocks as stock}
  <StockItem {stock} />
{/each}

<MarketStatus status={$marketStatus} />
<ConnectionIndicator status={$connectionStatus} />
```

---

## No Backend Persistence

**Important**: This application does not require a backend database or persistence layer.

**Rationale**:
- All data is fetched in real-time from Finnhub
- No user accounts or personalization
- No historical data storage required
- No need to save state between sessions

**Future Enhancement**: If historical price tracking or user customization is added, consider:
- LocalStorage for client-side persistence (watchlist customization)
- IndexedDB for historical price data
- Backend database if multi-device sync needed

---

## Summary

| Entity | Purpose | Persistence |
|--------|---------|-------------|
| **Stock** | Individual stock data with current price | In-memory only (Svelte store) |
| **MarketStatus** | Market open/closed state | In-memory, calculated every 60s |
| **WebSocketConnection** | WebSocket state tracking | In-memory only |
| **AppState** | Overall UI state | In-memory (Svelte stores) |

**Total Data Size in Memory**: ~5-10 KB (15 stocks × ~300 bytes each + overhead)

**State Update Frequency**:
- Real-time: Stock prices (via WebSocket push)
- Every 60 seconds: Market status recalculation
- On connection events: WebSocket status
