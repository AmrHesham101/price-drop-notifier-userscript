# MVC Architecture Documentation

## Project Structure

```
server/
├── src/
│   ├── app.ts                          # Main Express server with middleware & CSP
│   ├── config/
│   │   ├── database.ts                 # MongoDB connection with retry logic
│   │   └── constants.ts                # Constants (timeouts, batch size, rate limits)
│   ├── models/
│   │   └── Subscription.model.ts       # Mongoose schema with compound indexes
│   ├── controllers/
│   │   ├── subscription.controller.ts  # POST /subscribe-price-drop with validation & logging
│   │   ├── extraction.controller.ts    # POST /api/extract with waterfall timing
│   │   └── admin.controller.ts         # Admin endpoints (trigger notify, etc.)
│   ├── services/
│   │   ├── scraper.service.ts          # Cheerio + Playwright with smart fallback
│   │   ├── email.service.ts            # Nodemailer with Ethereal.email for testing
│   │   └── notifier.service.ts         # Cursor streaming + batch processing
│   ├── routes/
│   │   ├── subscription.routes.ts      # Validators (email, URL, price validation)
│   │   ├── extraction.routes.ts        # URL validators
│   │   └── admin.routes.ts             # Admin route definitions
│   ├── utils.ts                        # parsePriceString, isValidUrl, randomDelay
│   └── types.ts                        # TypeScript interfaces
├── public/
│   ├── demo/
│   │   ├── index.html                  # CSP-strict demo with URL input
│   │   ├── demo.css                    # External CSS (no inline styles)
│   │   └── demo.js                     # External JS (no inline scripts)
│   └── embed/
│       ├── price-drop.html             # Standalone embed page
│       └── embed.css                   # Embed styles
widget/
├── src/
│   ├── index.ts                        # Widget logic with validation (8.26 KB)
│   └── styles.css                      # Widget styles (0.93 KB)
userscript/
├── price-drop-injector.user.js         # Build-based userscript (recommended)
├── price-drop-injector-inline.user.js  # Inline version
└── README.md                           # Userscript documentation
build/
├── price-drop-widget.min.js            # IIFE bundle (8.26 KB → 4 KB gzipped)
├── price-drop-widget.esm.js            # ESM bundle (8.27 KB)
├── price-drop-widget.min.css           # Styles (0.93 KB)
└── *.map                               # Source maps
docs/
├── BUNDLE_SIZE.md                      # Bundle analysis
├── MVC_ARCHITECTURE.md                 # This file
├── NOTES.md                            # Platform compatibility
├── ARTIFACTS_GUIDE.md                  # Screenshot/video guide
├── POSTMAN.md                          # API testing
```

## Architecture Layers

### 1. **Models** (Data Layer)

- **Subscription.model.ts**: Mongoose schema for subscriptions
  - **Fields**:
    - `email`: String (required, lowercase, validated)
    - `product`: Embedded schema
      - `name`: String (required, trimmed)
      - `price`: String (required, trimmed) - human-readable format
      - `url`: String (required, trimmed)
      - `lastSeenPrice`: Number (optional) - parsed numeric value for comparison
    - `lastNotifiedAt`: Date (optional) - when last email was sent
    - `lastCheckedAt`: Date (optional) - when last price check occurred
    - `createdAt`, `updatedAt`: Timestamps (auto-generated)
  - **Indexes**: Compound index on `email + product.url` for O(1) duplicate checks
  - **Validation**: Email regex validation, URL validation
  - **Tracking**: `lastCheckedAt` prevents redundant checks (5min cooldown), `lastNotifiedAt` tracks notification history

### 2. **Controllers** (Business Logic Layer)

- **subscription.controller.ts**:
  - `subscribe()`: Create new price drop subscription
    - Logs full request details (IP, User-Agent, timestamp)
    - Validates input using express-validator
    - **Price Parsing**: Uses `parsePriceString()` to extract numeric value from price string
    - Checks for duplicate subscriptions (409 conflict)
    - Simulates 8% server error for testing
    - Adds random 0.8-2.8s delay to simulate realistic processing
    - Prints waterfall timing breakdown (validation, processing, DB query, DB save)
    - Logs response with status code and latency
  - `getAllSubscriptions()`: Admin - list all subscriptions with timestamps
  - `deleteSubscription()`: Admin - remove subscription by ID

- **extraction.controller.ts**:
  - `extractProduct()`: Extract product info from URL
    - Logs full request details (IP, User-Agent, body)
    - Validates URL format
    - Calls `scrapeProduct()` service
    - Prints waterfall timing (validation, web scraping)
    - Returns extracted product (name, price, url)
    - Logs response with latency

- **admin.controller.ts**:
  - `triggerNotification()`: Manually trigger price checks for testing

### 3. **Services** (Application Services Layer)

- **scraper.service.ts**:
  - `scrapeProduct()`: Main scraping function
    - Validates URL format using `isValidUrl()`
    - Primary: Fast Cheerio-based HTML parsing
    - **Smart Validation**: `isInvalidExtraction()` detects bad results
      - Checks for generic names ("Amazon.com", "eBay", etc.)
      - Validates price has digits and non-zero value
      - Ensures name length > 10 characters
    - **Automatic Fallback**: Triggers Playwright if extraction looks invalid
    - Logs extraction sources and selected values
  - `extractFromHtml()`: Parse HTML with Cheerio
    - **30+ Price Selectors**: Amazon, eBay, generic meta tags
    - **Multi-platform**: Amazon (.com, .eg, .uk, etc.), eBay (all domains)
    - Logs which selector matched and extracted price
    - Logs all title sources (amazonTitle, ebayTitle, ogTitle, titleTag)
  - `scrapeWithPlaywright()`: JavaScript-rendered page scraping
    - Launches headless Chromium browser
    - Waits for DOM content loaded
    - Extracts full rendered HTML
    - Logs page content length and extraction results
    - Falls back gracefully if browser fails
  - `fetchCurrentPrice()`: Get current price for monitoring
    - Uses same selector logic as scrapeProduct
    - 10-second timeout with abort controller
    - Returns numeric value or null

- **email.service.ts**:
  - `initEmailService()`: Initialize Nodemailer transporter
    - Uses Ethereal.email for development testing
    - Logs preview URLs to console
  - `sendPriceDropEmail()`: Send formatted price drop alerts
    - HTML + plain text formats
    - Includes product name, old price, new price, product link

- **notifier.service.ts**:
  - `checkPriceDrops()`: Batch process subscriptions with cursor-based streaming
    - Filters by `lastCheckedAt` (5-minute cooldown)
    - Processes in batches of 20
    - Updates `lastCheckedAt` for all checked subscriptions
  - `processBatch()`: Handle batch with per-domain rate limiting
    - Tracks last request time per domain
    - Enforces 2-second delay between requests to same domain
    - Compares `currentPrice` vs `lastSeenPrice`
    - Sends email if price dropped
    - Updates `lastSeenPrice` and `lastNotifiedAt`
  - `extractDomain()`: Extract domain for rate limit tracking
  - `startPeriodicChecks()`: Start 10-minute interval checks
  - `stopPeriodicChecks()`: Stop scheduler
  - **Features**: Cursor streaming (memory efficient), batch processing (20 per batch), domain rate limiting (2s delay), smart scheduling (skip recently checked)

### 4. **Routes** (API Layer)

- **subscription.routes.ts**:
  - `POST /subscribe-price-drop`: Subscribe to product
    - **Validators**:
      - `email`: Email format validation + normalization
      - `product.url`: URL format validation
      - `product.name`: Required, string, trimmed, XSS-escaped
      - `product.price`: **3-layer validation**
        - Must not be empty
        - Cannot be "unknown"
        - Must contain at least one digit
        - Cannot be only zeros (e.g., "$0.00")
        - Cannot be only symbols/punctuation
  - `GET /subscriptions`: Get all subscriptions (admin)
  - `DELETE /subscriptions/:id`: Delete subscription (admin)

- **extraction.routes.ts**:
  - `POST /api/extract`: Extract product from URL
    - **Validator**: URL format validation

- **admin.routes.ts**:
  - `POST /admin/trigger-notify`: Trigger price check (manual testing)

### 5. **Config** (Configuration Layer)

- **database.ts**: MongoDB connection with Mongoose
  - Connection with retry logic
  - Event handlers for connected, error, disconnected
  - Graceful shutdown on SIGINT

- **constants.ts**: Environment variables, timeouts, user agents, batch size, rate limits
  - `PORT`: Server port (default: 3000)
  - `MONGODB_URI`: Database connection string
  - `USER_AGENT`: Realistic browser user agent for scraping
  - `PLAYWRIGHT_TIMEOUT`: 30 seconds (page load timeout)
  - `NOTIFIER_INTERVAL`: 10 minutes (periodic check frequency)
  - `BATCH_SIZE`: 20 subscriptions per batch
  - `MIN_CHECK_INTERVAL`: 5 minutes (prevents redundant checks)
  - `DOMAIN_DELAY_MS`: 2 seconds (rate limiting per domain)

- **utils.ts**: Utility functions
  - `isValidUrl()`: Validates http/https URLs
  - `parsePriceString()`: Extracts numeric value from formatted price
    - Examples: "$1,299.00" → 1299, "EGP749.29" → 749.29, "USD 99.99" → 99.99
    - Handles all currencies ($, £, €, EGP, USD, etc.)
    - Removes thousands separators
  - `randomDelay()`: Returns 800-2800ms random delay

## Data Flow

### Subscription Flow:

```
User Request → Route → Validator (3-layer validation) → Controller
                                                             ↓
                                              Log request details
                                                             ↓
                                              Parse price string
                                                             ↓
                                              Check duplicates
                                                             ↓
                                              Model → MongoDB
                                                             ↓
                                              Log response + waterfall
                                                             ↓
                                              Response (200/400/409/500)
```

### Price Check Flow:

```
Scheduler (10min) → Notifier Service (batch processor)
                         ↓
                   Filter: lastCheckedAt > 5min ago
                         ↓
                   Cursor Stream (memory efficient)
                         ↓
         Process batches of 20 ──→ Rate limit by domain (2s delay)
                         ↓
                   Scraper Service → Fetch HTML
                         ↓
                   Cheerio Extraction (fast)
                         ↓
                   isInvalidExtraction()?
                         ↓
                   YES → Playwright Fallback (JS-rendered pages)
                   NO  → Use Cheerio result
                         ↓
              Parse price string → numeric value
                         ↓
              Update lastCheckedAt in MongoDB
                         ↓
            Compare: currentPrice < lastSeenPrice?
                         ↓
              YES: Email Service + Update lastNotifiedAt
              NO:  Update lastSeenPrice if changed
```

## Benefits of MVC Architecture

1. **Separation of Concerns**: Each layer has clear responsibility
   - Models: Data structure and validation
   - Controllers: Request handling and business logic
   - Services: Reusable application logic
   - Routes: API endpoints and input validation

2. **Testability**: Services can be tested independently
   - Mock database connections
   - Test scraping logic without HTTP requests
   - Validate email formatting without sending emails

3. **Maintainability**: Easy to locate and fix bugs
   - Clear file structure
   - Single Responsibility Principle
   - Consistent naming conventions

4. **Scalability**: Can add features without affecting existing code
   - Add new scrapers without touching controllers
   - Add new validation rules in routes
   - Extend models without changing services

5. **Reusability**: Services can be reused across controllers
   - `parsePriceString()` used in controllers and notifier
   - `scrapeProduct()` used by extraction and notifier
   - `sendPriceDropEmail()` reusable for different notification types

6. **Type Safety**: Full TypeScript support with Mongoose schemas
   - Compile-time type checking
   - IntelliSense autocomplete
   - Prevents runtime type errors

7. **Detailed Logging**: Request/response tracking for debugging
   - Full request details logged (IP, User-Agent, body)
   - Response logging with status codes and latency
   - Waterfall timing breakdown for performance analysis

## MongoDB Advantages over JSON Files

1. **Concurrent Access**: No race conditions
   - Multiple server instances can safely read/write
   - Atomic updates prevent data corruption

2. **Query Performance**: Indexed lookups (email + URL)
   - O(1) duplicate detection with compound index
   - Fast filtering by `lastCheckedAt` timestamp
   - Efficient sorting and pagination

3. **Data Integrity**: Schema validation at database level
   - Mongoose enforces types and required fields
   - Email format validation before save
   - URL validation prevents invalid data

4. **Transactions**: ACID compliance for critical operations
   - Guaranteed consistency
   - Rollback on errors
   - Safe concurrent updates

5. **Scalability**: Can handle millions of subscriptions with cursor streaming
   - Batch processing (20 at a time)
   - Memory-efficient cursor iteration
   - No "load entire file" bottleneck

6. **Backup/Restore**: Built-in MongoDB tools
   - `mongodump` / `mongorestore`
   - Point-in-time recovery
   - Replication for high availability

7. **Production Ready**: No file system dependencies
   - Works in containerized environments
   - Cloud-native (MongoDB Atlas)
   - No file locking issues

8. **Memory Efficiency**: Cursor-based iteration prevents loading all documents
   - Processes one document at a time
   - Constant memory usage regardless of database size
   - Handles 1 million+ subscriptions without OOM errors

9. **Smart Queries**: Filter by `lastCheckedAt` to avoid redundant checks
   - `{ lastCheckedAt: { $lt: fiveMinutesAgo } }`
   - Only checks subscriptions that need checking
   - Reduces unnecessary scraping requests

10. **Price Tracking**: Numeric `lastSeenPrice` enables price comparisons
    - Store both human-readable string ("EGP749.29") and parsed number (749.29)
    - Efficient numeric comparisons for price drop detection
    - Handles multi-currency scenarios

## Environment Setup

1. Install MongoDB:

   ```bash
   # Windows (with Chocolatey)
   choco install mongodb

   # Or download from mongodb.com
   ```

2. Start MongoDB:

   ```bash
   mongod
   ```

3. Configure environment:

   ```bash
   cp .env.example .env
   # Edit MONGODB_URI if needed
   ```

4. Run server:
   ```bash
   npm run dev
   ```

## API Testing

Use the existing Postman collection with the same endpoints. All functionality remains identical from the API consumer perspective.
