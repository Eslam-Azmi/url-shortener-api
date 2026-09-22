# High-Performance URL Shortener API

A production-ready URL shortener API built with Node.js and Express. It features lightning-fast redirects using Redis in-memory caching, deep analytics tracking via PostgreSQL, and built-in rate limiting to prevent spam and abuse.

## 🚀 Features

* **In-Memory Caching:** Utilizes Upstash Redis to cache popular links, bypassing the database for sub-millisecond redirect speeds.
* **Deep Analytics:** Tracks total clicks, geographical location (via Vercel Edge networks), operating system, browser, and referring domains.
* **Collision Prevention:** Custom loop logic ensures every randomly generated 6-character short code is globally unique.
* **Rate Limiting:** Protects endpoints from spam and abuse using a strict 15-minute rolling window limit.
* **Graceful Degradation:** If Redis is unavailable, the API automatically falls back to serving redirects directly from PostgreSQL instead of failing the request — the cache is a performance layer, not a single point of failure.
* **Serverless Ready:** Configured to run seamlessly on Vercel's serverless edge network.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Primary Database:** PostgreSQL (Neon Serverless)
* **Caching Layer:** Redis (Upstash REST API)
* **Middleware:** `express-rate-limit`, `express-useragent`

## 🧠 Design Decisions

A few notes on the reasoning behind key choices, since the "why" matters as much as the "what":

* **Cache-aside pattern with a 1-hour TTL:** on a redirect, the API checks Redis first; on a cache miss it falls back to PostgreSQL, serves the result, and populates the cache for next time. This balances performance (hot links resolve from memory) against freshness (stale entries expire automatically rather than persisting forever).
* **`short_code` as the primary key:** since every lookup and redirect is keyed by `short_code`, making it the PK guarantees both uniqueness and a fast, indexed lookup path without a separate index.
* **Rate limiting only on `POST /shorten`:** link creation is the endpoint worth protecting from abuse (spam, mass link generation). Redirects are intentionally left unthrottled so real traffic to existing links is never blocked.
* **Separate `clicks` table instead of a single counter:** the `urls.clicks` column gives an O(1) total count, while the dedicated `clicks` table preserves per-click detail (referrer, user agent, country, timestamp) for real analytics rather than just a number.
* **Redis calls are independently try/caught:** a Redis outage or network failure never bubbles up as a 500 — each cache read and write is wrapped separately, so a cache failure just means a redirect resolves from PostgreSQL instead of memory, slightly slower but still correct.

## 📡 API Endpoints

### 1. Create a Short Link
`POST /shorten`
Generates a new short code or returns the existing one if the URL was already shortened.

**Request Body:**
```json
{
  "longUrl": "https://github.com/Eslam-Azmi"
}
```

**Response (200 OK):**
```json
{
  "message": "Data successfully saved to database!",
  "originalUrl": "https://github.com/Eslam-Azmi",
  "shortUrl": "http://localhost:3000/aB3x9Y"
}
```

### 2. Redirect
`GET /:shortCode`
Redirects the user to the original URL. If the link is not cached in Redis, it fetches it from PostgreSQL, updates the cache, and logs the click analytics.

### 3. View Analytics Dashboard
`GET /status/:shortCode`
Returns the core link details along with a rolling history of the 50 most recent clicks.

**Response (200 OK):**
```json
{
  "url": {
    "short_code": "aB3x9Y",
    "original_url": "https://github.com/Eslam-Azmi",
    "clicks": 142
  },
  "recent_activity": [
    {
      "clicked_at": "2026-09-22T12:00:00.000Z",
      "referrer": "Direct",
      "user_agent": "Windows 10.0 Chrome",
      "ip_country": "EG"
    }
  ]
}
```

## 💻 Local Setup Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Eslam-Azmi/url-shortener.git
   cd url-shortener
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your connection strings. This file is git-ignored by default — never commit real credentials.
   ```env
   DATABASE_URL=your_neon_postgresql_url
   UPSTASH_REDIS_REST_URL=your_upstash_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
