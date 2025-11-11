/**
 * Stock Market API Examples - Finnhub Implementation
 * Demonstrates multiple approaches to fetching stock prices using Finnhub API
 */

// ============================================================================
// APPROACH 1: WebSocket Real-Time (RECOMMENDED)
// ============================================================================
// Best for: Real-time updates, no CORS issues, optimal performance
// Rate limit impact: None (subscription-based, not request-based)

class FinnhubWebSocketClient {
  constructor(apiKey, symbols = []) {
    this.apiKey = apiKey;
    this.symbols = symbols;
    this.socket = null;
    this.prices = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

        this.socket.addEventListener('open', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;

          // Subscribe to all symbols
          this.symbols.forEach(symbol => {
            this.subscribe(symbol);
          });

          resolve();
        });

        this.socket.addEventListener('message', (event) => {
          this.handleMessage(JSON.parse(event.data));
        });

        this.socket.addEventListener('close', () => {
          console.log('WebSocket closed');
          this.attemptReconnect();
        });

        this.socket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  subscribe(symbol) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'subscribe',
          symbol: symbol
        })
      );
    }
  }

  unsubscribe(symbol) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'unsubscribe',
          symbol: symbol
        })
      );
    }
  }

  addSymbol(symbol) {
    if (!this.symbols.includes(symbol)) {
      this.symbols.push(symbol);
      this.subscribe(symbol);
    }
  }

  handleMessage(message) {
    // Trade messages
    if (message.type === 'trade') {
      message.data.forEach(trade => {
        this.prices[trade.s] = {
          price: trade.p,
          volume: trade.v,
          timestamp: new Date(trade.t * 1000),
          bid: trade.bp,
          ask: trade.ap,
          bidSize: trade.bs,
          askSize: trade.as
        };

        console.log(`${trade.s}: $${trade.p} (Vol: ${trade.v})`);
      });
    }

    // Quote messages
    if (message.type === 'quote') {
      message.data.forEach(quote => {
        this.prices[quote.s] = {
          price: quote.p,
          bid: quote.b,
          ask: quote.a,
          timestamp: new Date(quote.t * 1000)
        };
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  getPrices() {
    return { ...this.prices };
  }

  getPrice(symbol) {
    return this.prices[symbol];
  }

  close() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

// Usage Example
async function exampleWebSocket() {
  const apiKey = 'YOUR_FINNHUB_API_KEY';
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

  const client = new FinnhubWebSocketClient(apiKey, symbols);

  try {
    await client.connect();

    // Display prices every 5 seconds
    setInterval(() => {
      const prices = client.getPrices();
      console.log('\n--- Stock Prices ---');
      Object.entries(prices).forEach(([symbol, data]) => {
        console.log(`${symbol}: $${data.price.toFixed(2)}`);
      });
    }, 5000);
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

// ============================================================================
// APPROACH 2: REST API with Rate Limiter (Backend/Proxy Recommended)
// ============================================================================
// Best for: When WebSocket not available, REST API preferred
// Rate limit impact: 12 requests/minute = 20% of free tier

class FinnhubRateLimiter {
  constructor(maxRequestsPerMinute = 60) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.requestTimestamps = [];
  }

  async waitForRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => ts > oneMinuteAgo
    );

    // If we've hit the limit, wait
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = oldestTimestamp + 60000 - now;

      if (waitTime > 0) {
        console.log(`Rate limit: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  getUsage() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimestamps.filter(
      ts => ts > oneMinuteAgo
    ).length;

    return {
      used: recentRequests,
      limit: this.maxRequestsPerMinute,
      available: this.maxRequestsPerMinute - recentRequests
    };
  }
}

class FinnhubRESTClient {
  constructor(apiKey, rateLimiter = null) {
    this.apiKey = apiKey;
    this.rateLimiter = rateLimiter || new FinnhubRateLimiter(60);
    this.baseUrl = 'https://finnhub.io/api/v1';
  }

  async getQuote(symbol) {
    await this.rateLimiter.waitForRateLimit();

    const response = await fetch(
      `${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getQuotes(symbols) {
    // Parallel requests with rate limiting
    const quotes = await Promise.all(
      symbols.map(symbol => this.getQuote(symbol))
    );

    return Object.fromEntries(
      symbols.map((symbol, index) => [symbol, quotes[index]])
    );
  }

  async getCompanyProfile(symbol) {
    await this.rateLimiter.waitForRateLimit();

    const response = await fetch(
      `${this.baseUrl}/stock/profile2?symbol=${symbol}&token=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  getRateLimitStatus() {
    return this.rateLimiter.getUsage();
  }
}

// Usage Example
async function exampleREST() {
  const apiKey = 'YOUR_FINNHUB_API_KEY';
  const client = new FinnhubRESTClient(apiKey);

  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

  // Fetch quotes every 5 seconds
  setInterval(async () => {
    try {
      const quotes = await client.getQuotes(symbols);

      console.log('\n--- Stock Quotes ---');
      Object.entries(quotes).forEach(([symbol, data]) => {
        console.log(
          `${symbol}: $${data.c.toFixed(2)} (${data.d > 0 ? '+' : ''}${data.d.toFixed(2)})`
        );
      });

      const usage = client.getRateLimitStatus();
      console.log(
        `\nRate Limit: ${usage.used}/${usage.limit} (${usage.available} available)`
      );
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  }, 5000);
}

// ============================================================================
// APPROACH 3: Backend Proxy (Node.js Express)
// ============================================================================
// Best for: Production web apps, CORS handling, API key protection

// backend.js (Node.js Express)
/*
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60 // 60 requests per minute
});

app.use(limiter);

// Proxy quote endpoint
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const response = await fetch(
      `${BASE_URL}/quote?symbol=${req.params.symbol}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch quote'
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Proxy quotes endpoint (batch)
app.post('/api/quotes', async (req, res) => {
  const symbols = req.body.symbols; // Array of symbols

  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: 'symbols must be an array' });
  }

  try {
    const quotes = await Promise.all(
      symbols.map(symbol =>
        fetch(
          `${BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        ).then(r => r.json())
      )
    );

    const result = Object.fromEntries(
      symbols.map((symbol, index) => [symbol, quotes[index]])
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on port 3000');
});
*/

// ============================================================================
// APPROACH 4: Browser-Based Fetch (Simple GET, CORS Workaround)
// ============================================================================
// Best for: Quick demos, doesn't require backend
// Note: May experience CORS issues; requires authentication via query param

async function fetchQuoteFromBrowser(symbol, apiKey) {
  // Using query parameter for auth (avoids CORS preflight)
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function fetchMultipleQuotes(symbols, apiKey) {
  const quotes = await Promise.all(
    symbols.map(symbol => fetchQuoteFromBrowser(symbol, apiKey))
  );

  return Object.fromEntries(
    symbols.map((symbol, index) => [symbol, quotes[index]])
  );
}

// Usage Example
async function exampleBrowserFetch() {
  const apiKey = 'YOUR_FINNHUB_API_KEY';
  const symbols = ['AAPL', 'MSFT', 'GOOGL'];

  setInterval(async () => {
    try {
      const quotes = await fetchMultipleQuotes(symbols, apiKey);

      console.log('\n--- Stock Quotes ---');
      Object.entries(quotes).forEach(([symbol, data]) => {
        const change = data.d > 0 ? '+' : '';
        const changePercent = data.dp > 0 ? '+' : '';

        console.log(`${symbol}:`);
        console.log(`  Price: $${data.c.toFixed(2)}`);
        console.log(`  Change: ${change}${data.d.toFixed(2)} (${changePercent}${data.dp.toFixed(2)}%)`);
        console.log(`  High: $${data.h.toFixed(2)}, Low: $${data.l.toFixed(2)}`);
      });
    } catch (error) {
      console.error('Error:', error);
    }
  }, 5000);
}

// ============================================================================
// UTILITY: Dashboard Component (React/Vue Compatible)
// ============================================================================

class StockDashboard {
  constructor(container, client, updateIntervalMs = 5000) {
    this.container = container;
    this.client = client;
    this.updateInterval = updateIntervalMs;
    this.symbols = [];
    this.startPolling();
  }

  addSymbol(symbol) {
    if (!this.symbols.includes(symbol)) {
      this.symbols.push(symbol);
      this.render();
    }
  }

  removeSymbol(symbol) {
    this.symbols = this.symbols.filter(s => s !== symbol);
    this.render();
  }

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.update();
    }, this.updateInterval);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  async update() {
    if (this.symbols.length === 0) return;

    try {
      if (this.client.getPrice) {
        // WebSocket client
        this.render();
      } else {
        // REST client
        await this.client.getQuotes(this.symbols);
        this.render();
      }
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  render() {
    const prices = this.client.getPrices();

    let html = '<div class="stock-dashboard">';

    this.symbols.forEach(symbol => {
      const data = prices[symbol];

      if (data) {
        const changeClass = (data.d || 0) > 0 ? 'positive' : 'negative';
        const changeSign = (data.d || 0) > 0 ? '+' : '';

        html += `
          <div class="stock-card">
            <div class="symbol">${symbol}</div>
            <div class="price">$${(data.price || data.c).toFixed(2)}</div>
            <div class="change ${changeClass}">
              ${changeSign}${((data.d || 0).toFixed(2))} (${changeSign}${((data.dp || 0).toFixed(2))}%)
            </div>
          </div>
        `;
      }
    });

    html += '</div>';
    this.container.innerHTML = html;
  }

  destroy() {
    this.stopPolling();
  }
}

// ============================================================================
// ERROR HANDLING & RETRY LOGIC
// ============================================================================

async function fetchWithRetry(
  fetchFn,
  maxRetries = 3,
  backoffMs = 1000
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delayMs = backoffMs * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Usage
async function robustFetch(symbol, apiKey) {
  return fetchWithRetry(
    () => fetchQuoteFromBrowser(symbol, apiKey),
    3,
    1000
  );
}

// ============================================================================
// EXPORTS (for Node.js)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FinnhubWebSocketClient,
    FinnhubRESTClient,
    FinnhubRateLimiter,
    StockDashboard,
    fetchWithRetry
  };
}
