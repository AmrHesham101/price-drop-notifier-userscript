# MVC Architecture Documentation

## Project Structure

```
server/
├── src/
│   ├── app.ts                    # Main application entry point
│   ├── config/
│   │   ├── database.ts          # MongoDB connection config
│   │   └── constants.ts         # Application constants
│   ├── models/
│   │   └── Subscription.model.ts # Mongoose subscription model
│   ├── controllers/
│   │   ├── subscription.controller.ts  # Subscription business logic
│   │   ├── extraction.controller.ts    # Product extraction logic
│   │   └── admin.controller.ts         # Admin operations
│   ├── services/
│   │   ├── scraper.service.ts   # Web scraping (Cheerio/Playwright)
│   │   ├── email.service.ts     # Email notifications (Nodemailer)
│   │   └── notifier.service.ts  # Price monitoring scheduler
│   ├── routes/
│   │   ├── subscription.routes.ts # Subscription endpoints
│   │   ├── extraction.routes.ts   # Extraction endpoints
│   │   └── admin.routes.ts        # Admin endpoints
│   ├── utils.ts                 # Utility functions
│   └── types.ts                 # TypeScript type definitions
```

## Architecture Layers

### 1. **Models** (Data Layer)

- **Subscription.model.ts**: Mongoose schema for subscriptions
  - Fields: email, product (name, price, url, lastSeenPrice), lastNotifiedAt, lastCheckedAt, timestamps
  - Indexes: Compound index on email + product.url for fast duplicate checks
  - Methods: Custom validation, exists check
  - Tracking: lastCheckedAt prevents redundant checks, lastNotifiedAt tracks notification history

### 2. **Controllers** (Business Logic Layer)

- **subscription.controller.ts**:
  - `subscribe()`: Create new price drop subscription
  - `getAllSubscriptions()`: Admin - list all subscriptions
  - `deleteSubscription()`: Admin - remove subscription

- **extraction.controller.ts**:
  - `extractProduct()`: Extract product info from URL

- **admin.controller.ts**:
  - `triggerNotification()`: Manually trigger price checks

### 3. **Services** (Application Services Layer)

- **scraper.service.ts**:
  - `scrapeProduct()`: Main scraping function
  - `extractFromHtml()`: Parse HTML with Cheerio
  - `fetchCurrentPrice()`: Get current price from product page

- **email.service.ts**:
  - `initEmailService()`: Initialize Nodemailer transporter
  - `sendPriceDropEmail()`: Send formatted price drop alerts

- **notifier.service.ts**:
  - `checkPriceDrops()`: Batch process subscriptions with cursor-based streaming
  - `processBatch()`: Handle batch with per-domain rate limiting
  - `extractDomain()`: Extract domain for rate limit tracking
  - `startPeriodicChecks()`: Start 10-minute interval checks
  - `stopPeriodicChecks()`: Stop scheduler
  - **Features**: Cursor streaming (memory efficient), batch processing (20 per batch), domain rate limiting (2s delay), smart scheduling (skip recently checked)

### 4. **Routes** (API Layer)

- **subscription.routes.ts**:
  - `POST /subscribe-price-drop`: Subscribe to product
  - `GET /subscriptions`: Get all subscriptions
  - `DELETE /subscriptions/:id`: Delete subscription

- **extraction.routes.ts**:
  - `POST /api/extract`: Extract product from URL

- **admin.routes.ts**:
  - `POST /admin/trigger-notify`: Trigger price check

### 5. **Config** (Configuration Layer)

- **database.ts**: MongoDB connection with Mongoose
- **constants.ts**: Environment variables, timeouts, user agents, batch size, rate limits
  - `NOTIFIER_INTERVAL`: 10 minutes (periodic check frequency)
  - `BATCH_SIZE`: 20 subscriptions per batch
  - `MIN_CHECK_INTERVAL`: 5 minutes (prevents redundant checks)
  - `DOMAIN_DELAY_MS`: 2 seconds (rate limiting per domain)

## Data Flow

### Subscription Flow:

```
User Request → Route → Validator → Controller → Model → MongoDB
                                              ↓
                                         Response
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
                   Scraper Service → Product Page
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
2. **Testability**: Services can be tested independently
3. **Maintainability**: Easy to locate and fix bugs
4. **Scalability**: Can add features without affecting existing code
5. **Reusability**: Services can be reused across controllers
6. **Type Safety**: Full TypeScript support with Mongoose schemas

## MongoDB Advantages over JSON Files

1. **Concurrent Access**: No race conditions
2. **Query Performance**: Indexed lookups (email + URL)
3. **Data Integrity**: Schema validation at database level
4. **Transactions**: ACID compliance for critical operations
5. **Scalability**: Can handle millions of subscriptions with cursor streaming
6. **Backup/Restore**: Built-in MongoDB tools
7. **Production Ready**: No file system dependencies
8. **Memory Efficiency**: Cursor-based iteration prevents loading all documents
9. **Smart Queries**: Filter by lastCheckedAt to avoid redundant checks

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
