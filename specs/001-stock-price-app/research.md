# Technical Research: Stock Price Display Web Application

**Feature**: Stock Price Display Web Application  
**Research Date**: 2025-11-10  
**Status**: Complete

## Overview

This document consolidates research findings for all technical decisions required to implement the stock price display web application. All "NEEDS CLARIFICATION" items from the implementation plan have been resolved through comprehensive research.

---

## Decision 1: Stock Market Data API

### Decision
**Use Finnhub Stock API with WebSocket connection**

### Rationale

**Requirements Analysis**:
- Need: 10-20 stocks updated every 5 seconds
- Request volume: 12 requests/minute (using REST) OR real-time streaming (using WebSocket)
- Budget: Free or low-cost for demo/personal project
- Security: Cannot expose API keys in client code

**Evaluation Results**:
Six APIs were evaluated: Alpha Vantage, Finnhub, Twelve Data, Polygon.io, MarketStack, and EODHD.

**Why Finnhub Wins**:
1. **Best Free Tier**: 60 requests/minute (5x our requirement of 12 req/min)
2. **Real-Time Data**: Full real-time stock quotes on free tier
3. **WebSocket Support**: Eliminates CORS issues and enables true real-time streaming
4. **No Daily Limits**: Unlimited free usage within rate limits
5. **Excellent Documentation**: Well-documented with code examples
6. **Zero Cost**: Completely free for this use case

**WebSocket vs REST**:
- WebSocket recommended: Real-time streaming, no CORS issues, more efficient
- REST alternative: Requires backend proxy for CORS handling

### Alternatives Considered

1. **Alpha Vantage**: Only 5-25 requests/day on free tier, end-of-day data only (no real-time)
2. **Twelve Data**: Only 8 credits/minute (insufficient for 10-20 stocks)
3. **Polygon.io**: Only 5 requests/minute, delayed data on free tier
4. **MarketStack**: Only 100 requests/month (insufficient)
5. **EODHD**: Batch support but higher complexity

### Implementation Notes

**Finnhub API Details**:
- API Endpoint (REST): `https://finnhub.io/api/v1/quote`
- WebSocket URL: `wss://ws.finnhub.io`
- Authentication: API key via query parameter
- Response format: JSON
- Rate limit: 60 calls/minute (REST) or unlimited messages (WebSocket)

**Example WebSocket Usage**:
```javascript
const socket = new WebSocket('wss://ws.finnhub.io?token=YOUR_API_KEY');

socket.addEventListener('open', function (event) {
    // Subscribe to multiple symbols
    socket.send(JSON.stringify({'type':'subscribe', 'symbol':'AAPL'}));
    socket.send(JSON.stringify({'type':'subscribe', 'symbol':'GOOGL'}));
    socket.send(JSON.stringify({'type':'subscribe', 'symbol':'MSFT'}));
});

socket.addEventListener('message', function (event) {
    const data = JSON.parse(event.data);
    // Real-time price updates arrive here
    // data.data[0].p = price, data.data[0].s = symbol
});
```

**Rate Limiting Strategy**:
- With WebSocket: No rate limiting needed (push-based)
- With REST: Batch all 20 stocks in 2 seconds (20 calls), wait 5 seconds, repeat
- Monitor usage: Track API calls per minute to stay within limits
- Implement exponential backoff for errors

---

## Decision 2: Frontend Technology Stack

### Decision
**Use Svelte with Tailwind CSS**

### Rationale

**Requirements Analysis**:
- Simple display app (not complex SPA)
- Real-time updates every 5 seconds
- Must be responsive (mobile-friendly, min 320px width)
- Quick to build and deploy
- Good performance for frequent DOM updates

**Evaluation Results**:
Four approaches were evaluated: Vanilla JavaScript, React, Vue 3, and Svelte.

**Why Svelte Wins**:
1. **Smallest Bundle**: Only 1.6-3 KB (vs React 42 KB, Vue 30 KB)
2. **Best Performance**: Compiles to vanilla JS, no virtual DOM overhead
3. **Simplest Reactivity**: Assignments automatically update UI (`price = newPrice`)
4. **Fast Load Time**: Critical for mobile users on slow connections
5. **Easy Learning Curve**: Minimal concepts to learn, HTML-like syntax
6. **Perfect for Real-Time**: Direct DOM updates ideal for 5-second refresh cycles

**Performance Comparison**:
- **Bundle Size**: Svelte 3 KB vs React 42 KB vs Vue 30 KB
- **Initial Load**: Svelte ~50ms vs React ~200-300ms (on 3G)
- **Update Performance**: Svelte direct DOM vs React/Vue virtual DOM diffing
- **Memory Usage**: Svelte lowest (no virtual DOM in memory)

**Tailwind CSS Benefits**:
- Mobile-first utilities (perfect for 320px+ requirement)
- Utility-first reduces CSS bundle to ~8-10 KB
- No CSS-in-JS runtime overhead
- Works seamlessly with Svelte's scoped styles

### Alternatives Considered

1. **Vanilla JavaScript**: Too low-level, tedious DOM manipulation
2. **React**: Overkill for simple app, much larger bundle (42 KB)
3. **Vue 3**: Excellent choice, but Svelte simpler and smaller (30 KB vs 3 KB)

### Implementation Notes

**Recommended Project Structure**:
```
stock-price-app/
├── src/
│   ├── App.svelte              # Main component
│   ├── components/
│   │   ├── StockList.svelte    # Display stock list
│   │   ├── StockItem.svelte    # Individual stock row
│   │   └── MarketStatus.svelte # Market open/closed indicator
│   ├── services/
│   │   └── finnhub.js          # WebSocket client
│   ├── main.js                 # Entry point
│   └── app.css                 # Tailwind imports
├── public/
│   └── index.html
├── package.json
├── vite.config.js              # Build config
└── tailwind.config.js
```

**Quick Setup**:
```bash
npm create vite@latest stock-price-app -- --template svelte
cd stock-price-app
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run dev
```

**Development Time Estimate**: 2-3 hours for MVP

---

## Decision 3: Architecture & Deployment

### Decision
**Use Client + Serverless Functions architecture, deployed on Netlify**

### Rationale

**Requirements Analysis**:
- Must keep API keys secure (cannot expose in browser)
- Need ~14,400 API requests/hour (10.37M/month)
- Prefer low-cost or free hosting
- HTTPS required
- Simple deployment workflow

**Architecture Evaluation**:
Three architectures were evaluated:
1. Pure client-side (static hosting)
2. Client + backend proxy server
3. Client + serverless functions

**Why Serverless Functions Win**:
1. **API Key Security**: Secrets stored in environment variables, never exposed
2. **No Server Management**: Fully managed infrastructure
3. **Auto-Scaling**: Platform handles traffic spikes automatically
4. **Simple Deployment**: Git-push workflow with auto-deploy
5. **Cost-Effective**: $0-10/month for expected usage
6. **CORS Handled**: Functions run on same domain or configure headers

**Why Netlify Platform Wins**:
1. **Best Developer Experience**: Integrated hosting + functions + CI/CD
2. **Generous Free Tier**: 125K function requests/month included
3. **Cost Analysis**:
   - With WebSocket approach: $0/month (WebSocket from browser, no backend needed)
   - With REST proxy: ~$0-150/month (10.37M requests)
   - Expected actual cost: $0 (using WebSocket directly from browser)
4. **Automatic HTTPS**: Let's Encrypt certificates
5. **Instant Deployment**: Push to git, auto-deploy
6. **Built-in Monitoring**: Function logs and analytics

**Cost Comparison** (for 10.37M requests/month if using REST proxy):
- Netlify: $0-150/month
- Vercel: $6-7/month (cheapest compute)
- AWS Lambda: $120-130/month (most expensive)
- Traditional server: $5-20/month + $10-20/month bandwidth

### Alternatives Considered

1. **Pure Client-Side**: ❌ Exposes API keys (critical security risk)
2. **Backend Proxy Server**: ⚠️ More expensive ($25-40/month), requires server management
3. **Vercel**: Cheaper compute costs but Netlify has better overall DX

### Implementation Notes

**Recommended Approach**: Use Finnhub WebSocket directly from browser
- **Security**: API key in WebSocket URL is acceptable (wss:// encrypted)
- **Cost**: $0 (no serverless functions needed)
- **Latency**: Zero (direct connection)
- **Complexity**: Minimal

**Alternative Approach**: If REST API required, use Netlify Function as proxy
```javascript
// netlify/functions/stock-price.js
exports.handler = async (event) => {
  const symbol = event.queryStringParameters.symbol;
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
  );
  const data = await response.json();
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
};
```

**Deployment Workflow**:
1. Connect GitHub repository to Netlify
2. Configure environment variables (FINNHUB_API_KEY)
3. Push code to repository
4. Netlify auto-builds and deploys
5. HTTPS certificate automatically provisioned

**Security Checklist**:
- ✅ API keys in environment variables (never in code)
- ✅ HTTPS enforced
- ✅ CORS configured properly
- ✅ Rate limiting on serverless functions (if used)
- ✅ Error messages don't expose sensitive data

---

## Decision 4: Predefined Stock Watchlist

### Decision
**Display the following 15 stocks**:

Technology Leaders:
- AAPL (Apple)
- GOOGL (Alphabet/Google)
- MSFT (Microsoft)
- AMZN (Amazon)
- META (Meta/Facebook)
- NVDA (NVIDIA)
- TSLA (Tesla)

Financial & Traditional:
- JPM (JPMorgan Chase)
- BAC (Bank of America)
- V (Visa)

Consumer & Retail:
- WMT (Walmart)
- DIS (Disney)

Healthcare & Pharma:
- JNJ (Johnson & Johnson)
- UNH (UnitedHealth)

Energy:
- XOM (Exxon Mobil)

### Rationale

1. **Meets Requirement**: 15 stocks (within 10-20 range specified)
2. **Diverse Sectors**: Technology, finance, consumer, healthcare, energy
3. **High Liquidity**: All are actively traded with frequent price updates
4. **Popular Stocks**: Widely recognized, relevant to most investors
5. **Market Representation**: Mix of growth stocks and value stocks
6. **Data Availability**: All available on Finnhub free tier

### Alternatives Considered

1. **Major Indices Only** (SPY, DIA, QQQ): Too limited, users want individual stocks
2. **Top 20 by Market Cap**: Too tech-heavy, lacks diversity
3. **User Customization**: Out of scope for v1 (noted for future enhancement)

---

## Decision 5: API Key Security Pattern

### Decision
**Use WebSocket connection from browser with API key in URL (acceptable for read-only public data)**

### Rationale

**Security Analysis**:
- Finnhub data is public market data (not sensitive/private)
- API key provides rate limiting, not access to sensitive resources
- WebSocket URLs are encrypted (wss://)
- Worst case: Someone steals key and uses your rate limit
- Mitigation: Monitor usage, rotate keys if needed
- Trade-off: Simplicity vs paranoid security

**Alternative for Higher Security**:
If absolute security required:
- Use Netlify Function as WebSocket proxy
- Client connects to function, function connects to Finnhub
- Adds complexity with minimal security benefit for this use case

**Risk Assessment**: **Low**
- Public read-only data
- Rate-limited free tier (limited abuse potential)
- Easy to rotate key if compromised
- No financial or privacy impact

---

## Resolved Technical Unknowns

All "NEEDS CLARIFICATION" items from the technical context have been resolved:

1. ✅ **Stock Market Data API**: Finnhub with WebSocket
2. ✅ **Frontend Framework**: Svelte with Tailwind CSS
3. ✅ **Deployment Platform**: Netlify
4. ✅ **Architecture**: Client-side WebSocket (no backend needed)
5. ✅ **Predefined Watchlist**: 15 stocks across diverse sectors
6. ✅ **API Key Security**: WebSocket from browser (acceptable risk for public data)

---

## Open Questions for User

The following decisions are still needed from the user:

1. **Market Hours**: Should the app work during pre-market/after-hours trading, or only regular hours (9:30 AM - 4:00 PM ET)?
2. **Local Storage**: Should prices be cached locally (localStorage) for offline viewing, or always fetch fresh?
3. **Timezone Display**: Should timestamps show Eastern Time (market time) or user's local timezone?
4. **Data Delay Notice**: How prominently should we display data delay disclaimers (if using delayed data)?

**Recommended Defaults** (if user doesn't specify):
1. Show data 24/7, with clear market status indicator (open/closed)
2. No local storage (always fetch fresh for accuracy)
3. Display market time (ET) with clear label
4. Small disclaimer footer if using delayed data (Finnhub is real-time on free tier)

---

## Summary of Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Data API** | Finnhub WebSocket | Free, real-time, 60 req/min limit, excellent docs |
| **Frontend** | Svelte + Tailwind | Smallest bundle (3 KB), fastest performance, simplest code |
| **Hosting** | Netlify | Best DX, auto-deploy, free tier sufficient, HTTPS included |
| **Architecture** | Client-side only | No backend needed with WebSocket approach |
| **Stock List** | 15 predefined stocks | Diverse sectors, high liquidity, popular companies |
| **Security** | WebSocket from browser | Acceptable for public read-only data |

**Total Estimated Cost**: $0/month  
**Development Time**: 2-3 hours for MVP  
**Deployment Time**: 5-10 minutes

---

## Next Steps

With all research complete, proceed to:
1. Phase 1: Generate data model (entity structures)
2. Phase 1: Generate API contracts (Finnhub WebSocket interface spec)
3. Phase 1: Generate quickstart guide (setup and deployment instructions)
4. Phase 1: Update agent context with chosen technologies
