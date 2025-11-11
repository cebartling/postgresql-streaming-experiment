# Quickstart Guide: Stock Price Display Web Application

**Feature**: Stock Price Display Web Application  
**Tech Stack**: Svelte + Tailwind CSS + Finnhub API  
**Deployment**: Netlify  
**Date**: 2025-11-10

## Overview

This guide will help you set up, develop, and deploy the stock price display application from scratch. Estimated setup time: **10-15 minutes**. Development time for MVP: **2-3 hours**.

---

## Prerequisites

- **Node.js**: v18+ and npm v9+ ([Download](https://nodejs.org/))
- **Git**: For version control ([Download](https://git-scm.com/))
- **Finnhub API Key**: Free account ([Sign up](https://finnhub.io/register))
- **Netlify Account** (optional, for deployment): Free tier ([Sign up](https://www.netlify.com/))
- **Code Editor**: VS Code recommended ([Download](https://code.visualstudio.com/))

---

## Step 1: Get Finnhub API Key

1. Go to [https://finnhub.io/register](https://finnhub.io/register)
2. Sign up for a free account
3. Verify your email
4. Navigate to Dashboard → API Keys
5. Copy your API key (format: `abc123def456...`)
6. Save it securely (you'll need it in Step 4)

**Free Tier Limits**:
- 60 API calls per minute
- Unlimited WebSocket messages
- Real-time US stock data

---

## Step 2: Create Svelte Project

### Option A: Using Vite (Recommended)

```bash
# Create new Svelte project
npm create vite@latest stock-price-app -- --template svelte

# Navigate to project directory
cd stock-price-app

# Install dependencies
npm install
```

### Option B: Using SvelteKit (Alternative)

```bash
# Create SvelteKit project
npm create svelte@latest stock-price-app

# Choose options:
# - Skeleton project
# - No TypeScript (or Yes if you prefer)
# - ESLint: Yes
# - Prettier: Yes

cd stock-price-app
npm install
```

**Recommended**: Use **Option A (Vite)** for simplicity.

---

## Step 3: Install Tailwind CSS

```bash
# Install Tailwind and dependencies
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind configuration
npx tailwindcss init -p
```

### Configure Tailwind

Edit `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Add Tailwind Directives

Create or edit `src/app.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import in `src/main.js`:

```javascript
import './app.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app'),
})

export default app
```

---

## Step 4: Configure Environment Variables

Create `.env` file in project root:

```bash
VITE_FINNHUB_API_KEY=your_api_key_here
```

**Example**:
```
VITE_FINNHUB_API_KEY=abc123def456ghi789
```

**Important**: 
- Add `.env` to `.gitignore` (should already be there)
- Never commit API keys to version control

### Access in Code

```javascript
const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
```

---

## Step 5: Project Structure

Create the following structure:

```
stock-price-app/
├── src/
│   ├── components/
│   │   ├── StockList.svelte
│   │   ├── StockItem.svelte
│   │   ├── MarketStatus.svelte
│   │   └── ConnectionStatus.svelte
│   ├── services/
│   │   └── finnhub.js
│   ├── stores/
│   │   └── stocks.js
│   ├── utils/
│   │   └── market-hours.js
│   ├── App.svelte
│   ├── main.js
│   └── app.css
├── public/
│   └── (favicon, etc.)
├── .env
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

Create directories:

```bash
mkdir -p src/components src/services src/stores src/utils
```

---

## Step 6: Implement Core Files

### 1. Create Svelte Stores (`src/stores/stocks.js`)

```javascript
import { writable, derived } from 'svelte/store';

export const stocks = writable([]);
export const marketStatus = writable({ status: 'closed', nextChange: null });
export const connectionStatus = writable('disconnected');
export const errorMessage = writable(null);
export const isLoading = writable(true);

export const isMarketOpen = derived(
  marketStatus,
  $marketStatus => $marketStatus.status === 'open'
);
```

### 2. Create Finnhub Service (`src/services/finnhub.js`)

```javascript
const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const WS_URL = `wss://ws.finnhub.io?token=${API_KEY}`;
const REST_URL = 'https://finnhub.io/api/v1/quote';

export class FinnhubService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  // Fetch initial quote data via REST
  async fetchQuote(symbol) {
    const response = await fetch(`${REST_URL}?symbol=${symbol}&token=${API_KEY}`);
    const data = await response.json();
    return {
      symbol,
      currentPrice: data.c,
      previousClose: data.pc,
      netChange: data.d,
      percentChange: data.dp,
      dayHigh: data.h,
      dayLow: data.l,
      openPrice: data.o,
      timestamp: data.t
    };
  }

  // Initialize WebSocket connection
  connect(onMessage, onError, onStatusChange) {
    this.socket = new WebSocket(WS_URL);

    this.socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      onStatusChange('connected');
      this.reconnectAttempts = 0;
    });

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'trade') {
        onMessage(message.data);
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      onError('Connection error');
      onStatusChange('error');
    });

    this.socket.addEventListener('close', (event) => {
      console.log('WebSocket closed:', event.code);
      onStatusChange('disconnected');
      
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectWithBackoff(onMessage, onError, onStatusChange);
      }
    });
  }

  // Subscribe to stock symbol
  subscribe(symbol) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  // Reconnect with exponential backoff
  reconnectWithBackoff(onMessage, onError, onStatusChange) {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect(onMessage, onError, onStatusChange);
    }, delay);
  }

  // Close connection
  disconnect() {
    if (this.socket) {
      this.socket.close(1000);
    }
  }
}
```

### 3. Create Market Hours Utility (`src/utils/market-hours.js`)

```javascript
export function getMarketStatus() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // Weekend
  if (day === 0 || day === 6) {
    return { status: 'closed', nextChange: getNextMarketOpen(etTime) };
  }

  // Weekday hours
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60;     // 4:00 PM
  const preMarket = 4 * 60;        // 4:00 AM
  const afterHours = 20 * 60;      // 8:00 PM

  if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
    return { status: 'open', nextChange: getNextMarketClose(etTime) };
  } else if (currentMinutes >= preMarket && currentMinutes < marketOpen) {
    return { status: 'pre-market', nextChange: getNextMarketOpen(etTime) };
  } else if (currentMinutes >= marketClose && currentMinutes < afterHours) {
    return { status: 'after-hours', nextChange: getNextMarketClose(etTime) };
  } else {
    return { status: 'closed', nextChange: getNextMarketOpen(etTime) };
  }
}

function getNextMarketOpen(etTime) {
  // Simplified: return tomorrow 9:30 AM ET
  const next = new Date(etTime);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 30, 0, 0);
  return next;
}

function getNextMarketClose(etTime) {
  // Return today 4:00 PM ET
  const next = new Date(etTime);
  next.setHours(16, 0, 0, 0);
  return next;
}
```

### 4. Create Main App Component (`src/App.svelte`)

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { stocks, marketStatus, connectionStatus, isLoading, errorMessage } from './stores/stocks.js';
  import { FinnhubService } from './services/finnhub.js';
  import { getMarketStatus } from './utils/market-hours.js';
  import StockList from './components/StockList.svelte';
  import MarketStatus from './components/MarketStatus.svelte';
  import ConnectionStatus from './components/ConnectionStatus.svelte';

  const WATCHLIST = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA', 
                     'JPM', 'BAC', 'V', 'WMT', 'DIS', 'JNJ', 'UNH', 'XOM'];
  
  const finnhub = new FinnhubService();
  let marketInterval;

  onMount(async () => {
    // Fetch initial data
    const initialStocks = await Promise.all(
      WATCHLIST.map(symbol => finnhub.fetchQuote(symbol))
    );
    stocks.set(initialStocks);
    isLoading.set(false);

    // Connect WebSocket
    finnhub.connect(
      (trades) => handleTrades(trades),
      (error) => errorMessage.set(error),
      (status) => connectionStatus.set(status)
    );

    // Subscribe to all symbols
    WATCHLIST.forEach(symbol => finnhub.subscribe(symbol));

    // Update market status every 60 seconds
    updateMarketStatus();
    marketInterval = setInterval(updateMarketStatus, 60000);
  });

  onDestroy(() => {
    finnhub.disconnect();
    if (marketInterval) clearInterval(marketInterval);
  });

  function handleTrades(trades) {
    trades.forEach(trade => {
      stocks.update(list => 
        list.map(stock => 
          stock.symbol === trade.s 
            ? { ...stock, currentPrice: trade.p, timestamp: Math.floor(trade.t / 1000) }
            : stock
        )
      );
    });
  }

  function updateMarketStatus() {
    marketStatus.set(getMarketStatus());
  }
</script>

<div class="min-h-screen bg-gray-100 py-8">
  <div class="container mx-auto px-4">
    <header class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900">Stock Price Monitor</h1>
      <p class="text-gray-600 mt-2">Real-time stock prices updated every few seconds</p>
    </header>

    <div class="mb-4 flex justify-between items-center">
      <MarketStatus />
      <ConnectionStatus />
    </div>

    {#if $isLoading}
      <div class="text-center py-12">
        <p class="text-xl text-gray-600">Loading stock data...</p>
      </div>
    {:else if $errorMessage}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {$errorMessage}
      </div>
    {:else}
      <StockList stocks={$stocks} />
    {/if}
  </div>
</div>
```

---

## Step 7: Create Components

### StockItem.svelte, StockList.svelte, MarketStatus.svelte, ConnectionStatus.svelte

See the `data-model.md` and component structure for full implementation details. The components should:

- **StockItem**: Display individual stock with price, change, and visual indicators
- **StockList**: Grid/list of all stocks
- **MarketStatus**: Show if market is open/closed
- **ConnectionStatus**: Show WebSocket connection state

---

## Step 8: Run Development Server

```bash
npm run dev
```

Open browser to `http://localhost:5173` (or URL shown in terminal).

**Expected Behavior**:
- See 15 stocks with current prices
- Prices update in real-time
- Market status indicator shows open/closed
- Connection status shows connected/disconnected

---

## Step 9: Deploy to Netlify

### Option A: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build project
npm run build

# Deploy
netlify deploy --prod
```

### Option B: Netlify Dashboard (Recommended)

1. Push code to GitHub repository
2. Go to [https://app.netlify.com](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect GitHub repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Add environment variable:
   - Key: `VITE_FINNHUB_API_KEY`
   - Value: Your Finnhub API key
7. Click "Deploy site"

**Result**: Site deployed to `https://your-site-name.netlify.app`

---

## Step 10: Verify Deployment

1. Open deployed URL
2. Check that stocks load
3. Verify real-time updates are working
4. Test on mobile device (responsive design)
5. Check browser console for errors

---

## Troubleshooting

### Issue: "WebSocket connection failed"
- **Solution**: Check API key is correct in `.env` file
- Verify API key format (no extra spaces/quotes)
- Ensure you're using `VITE_` prefix for Vite environment variables

### Issue: "No data loading"
- **Solution**: Check browser console for errors
- Verify internet connection
- Check Finnhub API status: [https://finnhub.io/status](https://finnhub.io/status)
- Ensure API key has not been rate-limited

### Issue: "Prices not updating"
- **Solution**: Check that market is open (9:30 AM - 4:00 PM ET, weekdays)
- Verify WebSocket connection status
- Check browser DevTools → Network → WS tab for WebSocket activity

### Issue: "Deployment build failed"
- **Solution**: Ensure all dependencies are in `package.json`
- Check for TypeScript errors if using TS
- Verify build command is correct: `npm run build`

---

## Configuration Options

### Change Stock Watchlist

Edit `src/App.svelte`:

```javascript
const WATCHLIST = ['YOUR', 'CUSTOM', 'SYMBOLS'];
```

### Adjust Styling

Edit Tailwind classes in components or customize `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      'stock-up': '#10b981',   // Green for price increases
      'stock-down': '#ef4444', // Red for price decreases
    }
  }
}
```

### Change Update Frequency (If Using Polling Instead of WebSocket)

Not applicable with WebSocket (real-time push). If switching to REST polling:

```javascript
setInterval(() => fetchAllQuotes(), 5000); // Every 5 seconds
```

---

## Performance Optimization

1. **Enable Production Build Optimizations**:
   ```bash
   npm run build
   ```
   Vite automatically minifies and tree-shakes code.

2. **Lazy Load Components** (if adding more features):
   ```javascript
   const ChartComponent = () => import('./components/Chart.svelte');
   ```

3. **Monitor Bundle Size**:
   ```bash
   npm run build -- --stats
   ```

---

## Next Steps

1. **Add Features**:
   - Historical price charts
   - User customizable watchlist
   - Price alerts
   - Dark mode

2. **Improve UX**:
   - Loading skeletons
   - Smooth animations for price changes
   - Sort/filter stocks

3. **Analytics**:
   - Add Google Analytics
   - Monitor user engagement

---

## Support & Resources

- **Svelte Docs**: [https://svelte.dev/docs](https://svelte.dev/docs)
- **Tailwind CSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Finnhub API Docs**: [https://finnhub.io/docs/api](https://finnhub.io/docs/api)
- **Netlify Docs**: [https://docs.netlify.com](https://docs.netlify.com)

---

## Summary

| Step | Time | Description |
|------|------|-------------|
| 1 | 2 min | Get Finnhub API key |
| 2 | 2 min | Create Svelte project |
| 3 | 2 min | Install Tailwind CSS |
| 4 | 1 min | Configure environment variables |
| 5 | 1 min | Set up project structure |
| 6 | 30 min | Implement core files |
| 7 | 2 hours | Create components and styling |
| 8 | 1 min | Run development server |
| 9 | 5 min | Deploy to Netlify |
| 10 | 2 min | Verify deployment |

**Total Time**: ~3 hours (including development)

Your stock price display application is now live! 🎉
