# Stock Market Data API Research & Recommendation

## Executive Summary

For a web application requiring current prices for 10-20 stocks with updates every 5 seconds (12 requests/minute), **Finnhub is the recommended API** despite its CORS limitations. It offers the best balance of free tier rate limits (60 calls/minute), real-time data, and comprehensive documentation. However, you'll need a backend proxy to handle CORS restrictions.

**Alternative approach**: If you need pure browser-based access without backend infrastructure, consider using a managed CORS proxy or a different API structure entirely.

---

## API Comparison Table

| Criteria | Alpha Vantage | Finnhub | Twelve Data | Polygon.io (Massive) | MarketStack | EODHD |
|----------|---------------|---------|-------------|----------------------|------------|-------|
| **Free Tier Limit** | 25 req/day or 5 req/min* | 60 req/min | 8 credits/min (800/day) | 5 req/min | 100 req/month | 100k req/day |
| **Real-Time Data** | End-of-day only (free) | Yes, full real-time | Yes, real-time | Delayed data (free) | End-of-day (free) | Yes, real-time |
| **Batch Requests** | 100 symbols (premium only) | No, single symbol | No (free tier) | No | Up to 100 symbols | Batch support |
| **CORS Support** | No (free tier) | Workaround available | Unknown | Unknown | Unknown | Unknown |
| **Browser Use** | Requires proxy | Requires proxy | Requires proxy | Requires proxy | Requires proxy | Requires proxy |
| **Data Format** | JSON/CSV | JSON | JSON | JSON | JSON | JSON |
| **Documentation** | Excellent | Excellent | Excellent | Excellent | Good | Good |
| **Per-Minute Cost** | 5 req/min | 60 req/min | 8 credits/min | 5 req/min | ~3.3 req/min | Variable |
| **WebSocket Support** | No | Yes | Yes | Yes | No | No |

*Alpha Vantage has conflicting information; most recent sources show 25 req/day, while older sources cite 5 req/min. Free tier does NOT support real-time data.

---

## Detailed API Evaluation

### 1. Finnhub (RECOMMENDED)

**Overview**: Finnhub provides institutional-grade financial data with excellent free tier limits and comprehensive API coverage.

**Free Tier Specifications:**
- **Rate Limit**: 60 API calls per minute (with internal 30 calls/second cap)
- **Data**: Real-time stock quotes, forex, crypto, company fundamentals
- **Real-Time**: Full real-time access on free tier
- **Format**: JSON

**Strengths:**
- Best free tier rate limit (60 req/min = 3,600 req/hour)
- Full real-time data on free tier
- Excellent documentation with code examples
- WebSocket support for streaming real-time quotes
- No daily call limits on free tier
- Simple authentication (query parameter or header)

**Limitations:**
- No batch endpoint for multiple symbols in single call
- CORS restrictions on REST API (GitHub issue #286 reports persistent CORS errors)
- Requires separate API calls per symbol
- For your use case (10-20 stocks every 5 seconds), you'd need 12 req/min, which is well within limits

**CORS Workaround:**
- Use WebSocket connections (no CORS issues, ideal for real-time updates)
- Use backend proxy to relay requests from browser
- Use query parameter authentication instead of headers to avoid CORS preflight

**Cost**: Free with commercial use allowed, no paid tiers mentioned

**Data Example:**
```json
{
  "c": 148.85,          // Current price
  "d": 0.17,            // Change
  "dp": 0.11,           // Percent change
  "h": 149.99,          // High
  "l": 148.44,          // Low
  "o": 149.42,          // Open
  "pc": 148.68,         // Previous close
  "t": 1701432000       // Timestamp
}
```

---

### 2. Twelve Data

**Overview**: Modern financial data API with real-time quotes and technical indicators.

**Free Tier Specifications:**
- **Rate Limit**: 8 API credits/minute (800 credits/day)
- **Per-Request Cost**: 1 credit for basic time series data
- **Data**: Real-time US market data, forex, crypto
- **Real-Time**: Yes, full real-time on free tier
- **Format**: JSON

**Strengths:**
- Real-time data on free tier
- Good documentation
- WebSocket support
- Fair monthly allowance (800 credits/day)

**Limitations:**
- Credit-based system is less transparent than pure rate limits
- Batch requests only on Pro plan ($229/month+) - NOT available on free tier
- WebSocket limited to 8 credits (8 symbols max on free tier)
- For 10-20 stocks: 1 credit per stock = 10-20 credits per call
- Your 12 req/min = 120-240 credits/min needed (exceeds 8 credit/min limit)

**Verdict**: Does NOT meet your requirements. You'd need paid plan for batch requests.

---

### 3. Alpha Vantage

**Overview**: Widely-used free API for stock, forex, and crypto data.

**Free Tier Specifications:**
- **Rate Limit**: 25 API calls/day (conflicting sources; some cite 5 calls/min)
- **Real-Time Data**: End-of-day only (real-time requires premium)
- **Batch Requests**: 100 symbols (PREMIUM ONLY - $49.99/month minimum)
- **Format**: JSON/CSV

**Strengths:**
- Established platform with large user base
- Good documentation
- CSV export option
- Reasonably priced premium tiers ($49.99-$199.99/month)

**Limitations:**
- Free tier is end-of-day data only (not suitable for real-time updates)
- Very restrictive free tier limits (25 req/day)
- Batch quotes require premium subscription
- For real-time + batch functionality: must pay at least $49.99/month
- Does NOT meet your real-time requirements on free tier

**Verdict**: Not suitable for real-time demo/personal project without paid plan.

---

### 4. Polygon.io (Now Massive.com)

**Overview**: Market data platform (recently rebranded to Massive.com, but service continues).

**Free Tier Specifications:**
- **Rate Limit**: 5 API calls/minute
- **Real-Time Data**: No real-time on free tier (delayed/end-of-day)
- **Batch Requests**: Not available
- **Format**: JSON

**Strengths:**
- Large data provider
- Standardized API format
- Multiple asset classes

**Limitations:**
- Very restrictive rate limit (5 req/min)
- No real-time data on free tier
- No batch request support
- Recent rebranding (uncertainty about service continuation)

**Verdict**: Free tier doesn't meet real-time requirement. 5 req/min is too low for your needs (you need 12 req/min minimum).

---

### 5. MarketStack

**Overview**: End-of-day stock market data API with global coverage.

**Free Tier Specifications:**
- **Rate Limit**: 100 requests/month (~3.3 req/min)
- **Real-Time Data**: End-of-day only
- **Batch Requests**: Up to 100 symbols per request
- **Format**: JSON

**Strengths:**
- Large number of global exchanges
- Batch request support
- Reasonable pricing for paid plans

**Limitations:**
- Extremely limited free tier (100 req/month)
- End-of-day only (no real-time)
- For your needs: 12 req/min = 17,280 req/month (173x over free tier limit)
- Would consume free tier in less than 10 minutes

**Verdict**: Free tier insufficient for any serious use. Requires paid plan immediately.

---

### 6. EODHD (EOD Historical Data)

**Overview**: Historical and real-time stock data API with global coverage.

**Free Tier Specifications:**
- **Rate Limit**: 100,000 requests/day
- **Real-Time Data**: Yes
- **Batch Requests**: Yes, batch support
- **Format**: JSON

**Strengths:**
- Exceptional free tier limit (100k req/day ≈ 1,388 req/min average)
- Real-time data
- Batch request support
- Global coverage

**Limitations:**
- Less information available about CORS support
- Less common choice among web developers
- Documentation appears less comprehensive than Finnhub

**Verdict**: Could work but less proven for browser-based applications.

---

## Recommendation: Finnhub

### Why Finnhub is the Best Choice

**1. Rate Limits Suit Your Use Case**
- Your requirement: 12 requests/minute (10-20 stocks × 1 req each, every 5 seconds)
- Finnhub free tier: 60 requests/minute
- **Headroom**: 5x safety margin

**2. Real-Time Data**
- You need current prices with 5-second updates
- Finnhub provides genuine real-time data on free tier
- Alpha Vantage requires paid plan for real-time
- Polygon.io doesn't offer real-time on free tier

**3. Documentation & Community**
- Excellent API documentation with examples
- Active GitHub repository with issue support
- Multiple implementation examples available
- Well-known in fintech community

**4. WebSocket Alternative**
- While no batch REST endpoint exists, WebSocket provides elegant solution
- Subscribe to multiple stocks in single connection
- Real-time push updates (better than polling)
- No CORS issues with WebSocket

**5. Scalability**
- Free tier allows 3,600 requests/hour
- Your demo needs only ~720 requests/hour
- 5x safety margin for growth or additional features

### Implementation Strategy

Choose one of these approaches based on your architecture:

#### **Option A: WebSocket (Recommended for Browser)**
```javascript
// No CORS issues, real-time push updates, single connection
const socket = new WebSocket('wss://ws.finnhub.io?token=YOUR_API_KEY');

socket.addEventListener('open', () => {
  // Subscribe to multiple stocks in one connection
  socket.send(JSON.stringify({type: 'subscribe', symbol: 'AAPL'}));
  socket.send(JSON.stringify({type: 'subscribe', symbol: 'MSFT'}));
  socket.send(JSON.stringify({type: 'subscribe', symbol: 'GOOGL'}));
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'trade') {
    console.log(`${data.data[0].s}: $${data.data[0].p}`);
  }
});
```

#### **Option B: Backend Proxy (if you prefer REST)**
```javascript
// Backend handles CORS, forward requests to Finnhub
app.get('/api/stock/:symbol', async (req, res) => {
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${req.params.symbol}&token=${API_KEY}`
  );
  const data = await response.json();
  res.json(data);
});
```

#### **Option C: Query Parameter + Simple GET (Browser without proxy)**
```javascript
// Use query parameter auth, simple GET to avoid CORS preflight
fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${API_KEY}`)
  .then(r => r.json())
  .then(data => console.log(data));
```

---

## Alternative Options

### If Finnhub Doesn't Work

**Use EODHD as fallback:**
- Generous free tier (100k req/day)
- Real-time data
- Batch support
- Less documentation than Finnhub but more than sufficient

**Use Twelve Data for higher quotas:**
- If you need more than 60 req/min eventually
- But note: batch requests require Pro plan ($229/month)
- Credit system is more flexible than hard rate limits

---

## Sample API Request/Response

### Finnhub REST Quote Endpoint

**Request:**
```bash
GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=YOUR_API_KEY
```

**Response:**
```json
{
  "c": 189.95,                    // Current price
  "d": 1.45,                      // Change in price
  "dp": 0.77,                     // Percent change
  "h": 190.95,                    // Day high
  "l": 188.52,                    // Day low
  "o": 189.56,                    // Open price
  "pc": 188.50,                   // Previous close
  "t": 1701432000                 // Unix timestamp
}
```

### Batch Request Pattern (Multiple calls)

```javascript
// Since Finnhub doesn't support batch REST, make parallel requests
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];
const API_KEY = 'YOUR_API_KEY';

const quotes = await Promise.all(
  symbols.map(symbol =>
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`)
      .then(r => r.json())
  )
);

// Result: Array of quote objects
quotes.forEach((quote, idx) => {
  console.log(`${symbols[idx]}: $${quote.c}`);
});
```

### WebSocket Real-Time Example

```javascript
const socket = new WebSocket('wss://ws.finnhub.io?token=YOUR_API_KEY');

const handleMessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'trade') {
    message.data.forEach(trade => {
      console.log({
        symbol: trade.s,
        price: trade.p,
        volume: trade.v,
        timestamp: trade.t
      });
    });
  }
};

socket.addEventListener('message', handleMessage);
```

---

## Rate Limiting Strategy

### For Your Use Case (10-20 stocks, every 5 seconds)

**Request Volume Analysis:**
- 10-20 stocks = 1 request per stock (no batch support)
- Every 5 seconds = 12 requests/minute
- Per hour: 720 requests
- Per day: 17,280 requests

**Finnhub Free Tier Capacity:**
- 60 requests/minute
- 3,600 requests/hour
- Unlimited per day
- Your usage: ~12 req/min (20% utilization)
- Safety margin: 5x

### Rate Limiting Implementation

**1. WebSocket Approach (Recommended):**
```javascript
// Subscribe once, receive real-time pushes
// No rate limiting needed, data pushed automatically
// Perfect for polling every 5 seconds - just use latest cached data
let cachedPrices = {};

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'trade') {
    message.data.forEach(trade => {
      cachedPrices[trade.s] = trade.p;
    });
  }
});

// Display latest prices every 5 seconds (no API call needed)
setInterval(() => {
  updateUI(cachedPrices);
}, 5000);
```

**2. REST Polling with Rate Limiter:**
```javascript
class FinnhubRateLimiter {
  constructor(maxPerMinute = 60) {
    this.maxPerMinute = maxPerMinute;
    this.requestTimes = [];
  }
  
  async throttle() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.requestTimes = this.requestTimes.filter(t => t > oneMinuteAgo);
    
    // If at limit, wait
    if (this.requestTimes.length >= this.maxPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = (oldestRequest + 60000) - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestTimes.push(Date.now());
  }
  
  async getQuote(symbol) {
    await this.throttle();
    
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
    );
    return response.json();
  }
}

// Usage
const limiter = new FinnhubRateLimiter(60);
const symbols = ['AAPL', 'MSFT', 'GOOGL'];

setInterval(async () => {
  const prices = await Promise.all(
    symbols.map(s => limiter.getQuote(s))
  );
  updateUI(prices);
}, 5000);
```

**3. Exponential Backoff for Error Handling:**
```javascript
async function fetchWithRetry(symbol, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
      );
      
      if (response.status === 429) { // Rate limited
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
```

---

## Implementation Checklist

- [ ] Sign up for Finnhub free tier account
- [ ] Obtain API key
- [ ] Choose implementation approach:
  - [ ] WebSocket (recommended for real-time updates)
  - [ ] Backend proxy (if you need REST endpoint)
  - [ ] Simple browser fetch (if CORS workaround sufficient)
- [ ] Implement rate limiter/caching strategy
- [ ] Test with 5-second polling interval
- [ ] Verify you stay within 60 req/min limit
- [ ] Add error handling for API failures
- [ ] Consider HTTPS requirement for WebSocket in production
- [ ] Set up monitoring to track API usage

---

## Cost Analysis

| Service | Free Tier | Cost to Scale | Recommendation |
|---------|-----------|---------------|-----------------|
| Finnhub | 60 req/min | Free forever | Best for demo |
| EODHD | 100k req/day | ~$99-199/month | Good fallback |
| Twelve Data | 8 credits/min | $229+/month for batch | Overkill for your needs |
| Alpha Vantage | 25 req/day | $49.99+/month | Not viable free tier |
| Polygon | 5 req/min | Paid plans available | Rate limit too low |
| MarketStack | 100 req/month | $99+/month | Too restrictive |

**Bottom Line**: Finnhub's free tier meets all your requirements indefinitely. No paid plan needed unless you want to scale significantly beyond 10-20 stocks.

---

## Conclusion

**Finnhub** is the clear winner for your requirements:
1. Free tier (60 req/min) easily accommodates your 12 req/min usage
2. Real-time data available on free tier
3. Excellent documentation and community support
4. WebSocket option for elegant real-time solution without CORS issues
5. No hidden costs or future paywall

Use the **WebSocket approach** if possible for the best user experience and zero CORS issues. Fall back to backend proxy if REST endpoint is required.
