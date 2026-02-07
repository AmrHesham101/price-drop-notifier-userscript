# Testing with Postman

## Prerequisites

1. **MongoDB Atlas** - Ensure your `.env` file has your MongoDB Atlas credentials:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.k2co0g2.mongodb.net/price-drop-notifier?retryWrites=true&w=majority&appName=Cluster0
   ```

2. **Start the server**:
   ```powershell
   npm run dev
   ```

   Server should start on `http://localhost:3000` and show:
   ```
   ✓ MongoDB connected successfully
   ✓ Email service initialized (Ethereal test account)
   🚀 Server running on http://localhost:3000
   ```

3. **Port Configuration** - If port 3000 is in use, set `PORT` in `.env`:
   ```env
   PORT=3001
   ```

## Import Collection

Import the collection file `postman/PriceDropNotifier.postman_collection.json` into Postman.

## Available Endpoints

### 1. Health Check
**GET** `http://localhost:3000/health`

Check if server is running and healthy.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-07T12:00:00.000Z"
}
```

---

### 2. Subscribe to Price Drop
**POST** `http://localhost:3000/subscribe-price-drop`

Subscribe an email to receive notifications when product price drops.

**Request Body:**
```json
{
  "email": "user@example.com",
  "product": {
    "name": "iPhone 15 Pro",
    "price": "USD 999.99",
    "url": "https://www.amazon.com/dp/B0EXAMPLE"
  }
}
```

**Responses:**
- `200`: `{ "ok": true }` - Successfully subscribed
- `400`: `{ "ok": false, "errors": [...] }` - Validation error
- `409`: `{ "ok": false, "error": "already_subscribed" }` - Already subscribed
- `500`: `{ "ok": false, "error": "server_error" }` - Server error (8% simulated)

---

### 3. Extract Product Info
**POST** `http://localhost:3000/api/extract`

Extract product information from a URL using server-side scraping.

**Request Body:**
```json
{
  "url": "https://www.amazon.com/dp/B0CHX2F5QT"
}
```

**Response:**
```json
{
  "ok": true,
  "product": {
    "name": "Apple iPhone 15 Pro (256 GB) - Blue Titanium",
    "price": "$999.00",
    "url": "https://www.amazon.com/dp/B0CHX2F5QT"
  }
}
```

**Supported Sites:**
- Amazon (all regions)
- eBay (all regions)

---

### 4. Get All Subscriptions (Admin)
**GET** `http://localhost:3000/subscriptions`

Retrieve all subscriptions from MongoDB.

**Response:**
```json
{
  "ok": true,
  "subscriptions": [
    {
      "_id": "65c1234567890abcdef12345",
      "email": "user@example.com",
      "product": {
        "name": "iPhone 15 Pro",
        "price": "USD 999.99",
        "url": "https://www.amazon.com/dp/B0EXAMPLE"
      },
      "createdAt": "2026-02-07T12:00:00.000Z",
      "updatedAt": "2026-02-07T12:00:00.000Z"
    }
  ]
}
```

---

### 5. Delete Subscription (Admin)
**DELETE** `http://localhost:3000/subscriptions/:id`

Delete a specific subscription by MongoDB `_id`.

**Example:**
```
DELETE http://localhost:3000/subscriptions/65c1234567890abcdef12345
```

**Response:**
```json
{
  "ok": true,
  "message": "Subscription deleted"
}
```

---

### 6. Trigger Price Check (Admin)
**POST** `http://localhost:3000/admin/trigger-notify`

Manually trigger price drop checks for all subscriptions.

**Response:**
```json
{
  "ok": true,
  "result": {
    "checked": 5,
    "notified": 2
  }
}
```

This checks all subscriptions, compares current prices with last seen prices, and sends email notifications for price drops.

---

## Testing Examples

### Test Flow 1: Subscribe to Product

1. **Extract product info**:
   ```
   POST /api/extract
   Body: { "url": "https://www.amazon.com/dp/B0CHX2F5QT" }
   ```

2. **Subscribe with extracted info**:
   ```
   POST /subscribe-price-drop
   Body: {
     "email": "test@example.com",
     "product": { ...from extract response }
   }
   ```

3. **Verify subscription**:
   ```
   GET /subscriptions
   ```

### Test Flow 2: Duplicate Subscription

1. Subscribe with same email + URL twice
2. Second request should return `409 Conflict` with `already_subscribed` error

### Test Flow 3: Manual Price Check

1. Subscribe to a product
2. Trigger price check:
   ```
   POST /admin/trigger-notify
   ```
3. Check console logs for price comparison results
4. Check Ethereal email preview URL in console

### Test Flow 4: Delete Subscription

1. Get all subscriptions: `GET /subscriptions`
2. Copy a subscription `_id`
3. Delete: `DELETE /subscriptions/{_id}`
4. Verify: `GET /subscriptions` (should not include deleted)

---

## Data Storage

All subscriptions are stored in **MongoDB Atlas**:
- Database: `price-drop-notifier`
- Collection: `subscriptions`
- Indexes: `{ email: 1, 'product.url': 1 }` for fast duplicate checks

You can view data using:
- MongoDB Compass
- MongoDB Atlas web interface
- Mongo shell: `mongosh "mongodb+srv://..."`

---

## Troubleshooting

### Connection Refused
- Verify server is running: `npm run dev`
- Check port matches (default 3000)
- Check MongoDB connection in console logs

### MongoDB Connection Failed
- Verify `.env` file has correct `MONGODB_URI`
- Check MongoDB Atlas: Network Access allows your IP
- Check Database Access has user credentials
- Test connection with `mongosh` CLI

### Validation Errors
- Ensure `email` is valid format
- Ensure `product.url` is valid URL
- Ensure `Content-Type: application/json` header is set

### CORS Errors (if testing from browser)
Server has CORS enabled for all origins (`Access-Control-Allow-Origin: *`)

### Rate Limiting
Server limits to 100 requests per 15 minutes per IP. If exceeded, wait or restart server.

---

## MVC Architecture

The backend follows MVC (Model-View-Controller) pattern:

- **Models**: `server/src/models/Subscription.model.ts` (Mongoose schema)
- **Controllers**: `server/src/controllers/*.controller.ts` (Business logic)
- **Routes**: `server/src/routes/*.routes.ts` (API endpoints)
- **Services**: `server/src/services/*.service.ts` (Reusable components)

See [MVC_ARCHITECTURE.md](MVC_ARCHITECTURE.md) for detailed documentation.

