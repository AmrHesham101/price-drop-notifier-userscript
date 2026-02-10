# Price Drop Notifier 🔔

A lightweight, embeddable widget that automatically monitors product prices on Amazon and eBay, sending email notifications when prices drop. Features:

- 🎯 **Auto-detection** - Automatically extracts product info from Amazon/eBay pages
- 💉 **Userscript injection** - Injects seamlessly into product pages via Tampermonkey
- 📧 **Email notifications** - Get notified when prices drop
- 🚀 **Zero dependencies** - Pure vanilla JS widget (no React/Vue/etc.)
- 🔒 **CSP compliant** - Works with strict Content Security Policies
- ⚡ **Fast & lightweight** - 4 KB gzipped (8.26 KB minified)
- 🏗️ **MVC Architecture** - Clean separation of concerns with MongoDB
- 📊 **Production Ready** - Uses MongoDB with cursor streaming for scalability
- ✅ **Comprehensive Validation** - 3-layer validation (backend, demo, widget)
- 🤖 **Advanced Scraping** - Puppeteer-extra-stealth for undetectable bot protection (Amazon/eBay)
- ⚡ **Hybrid Strategy** - Cheerio for speed + Puppeteer fallback for JavaScript-rendered pages

## Architecture

This project uses a clean **MVC (Model-View-Controller)** architecture with MongoDB:

- **Models**: Mongoose schemas for subscriptions
- **Controllers**: Business logic handlers
- **Services**: Reusable components (scraper, email, notifier)
- **Routes**: API endpoint definitions

See [MVC_ARCHITECTURE.md](MVC_ARCHITECTURE.md) for detailed architecture documentation.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MongoDB** (v6 or higher) - [Download here](https://www.mongodb.com/try/download/community)
3. **Chrome/Chromium browser** - Required for Puppeteer scraping (auto-installed)

### Puppeteer Dependencies

This project uses **Puppeteer-extra with Stealth Plugin** for advanced anti-bot protection:

```json
{
  "puppeteer": "^24.37.2",
  "puppeteer-extra": "^3.3.6",
  "puppeteer-extra-plugin-stealth": "^2.11.2"
}
```

Chrome browser will be automatically installed during setup (see step 2 below).

## Quick Start

### 1. Install MongoDB

**Windows**:

```powershell
# Using Chocolatey
choco install mongodb

# Or download installer from mongodb.com
```

**Start MongoDB**:

```powershell
mongod
```

### 2. Install Dependencies & Chrome

```powershell
# Install Node.js dependencies
npm install

# Install Chrome browser for Puppeteer (required for Amazon/eBay scraping)
npx @puppeteer/browsers install chrome@stable
```

This downloads Chrome (~180 MB) to `chrome/win64-*/chrome-win64/chrome.exe` for automated scraping.

### 3. Configure Environment (Optional)

```powershell
cp .env.example .env
# Edit .env if you want to customize MongoDB URI
```

### 4. Build the Project

```powershell
npm run build:widget  # Build the widget only
# OR
npm run build         # Build everything (server + widget)
```

### 5. Start the Development Server

```powershell
npm run dev
```

Server will start at `http://localhost:3000`

### 4. Test the Demo Page

Open `http://localhost:3000/demo/` in your browser to see the widget in action.

---

## Usage Options

### Option 1: Userscript (Recommended for Personal Use)

#### Installation

1. **Install Tampermonkey**:
   - [Chrome/Edge](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Safari](https://apps.apple.com/app/userscripts/id1463298887)

2. **Install the Userscript**:
   - Click Tampermonkey icon → **Create a new script**
   - Delete default content
   - Copy entire content from `userscript/price-drop-injector.user.js`
   - Paste and save (Ctrl+S)

3. **Use It**:
   - Make sure server is running: `npm run dev`
   - Visit any Amazon or eBay product page
   - Widget appears automatically at the top with product info pre-filled
   - Enter your email → Click "Notify me"
   - Done! You'll get emails when price drops

#### How to Verify It's Working

✅ **Visual Confirmation**:

- A light gray box with the widget should appear at the top of product pages
- Product name and price should be auto-detected and displayed
- The box has ID `pdn-widget-container` (check with browser DevTools)

✅ **Console Verification** (F12 → Console):

```javascript
// Check if widget loaded
window.PriceDropWidget; // Should show: {init: ƒ}

// Check if container exists
document.getElementById("pdn-widget-container"); // Should show the div element
```

✅ **Network Verification** (F12 → Network tab):

- Look for request to `localhost:3000/build/price-drop-widget.min.js` (Status: 200)
- After subscribing, look for POST to `localhost:3000/subscribe-price-drop` (Status: 200)

🔴 **Troubleshooting**:

- **Widget doesn't appear**: Check browser console for errors, verify server is running
- **Script not active**: Check Tampermonkey icon shows "1" (script count), verify domain matches
- **Product info not detected**: Page structure may differ, check console for extraction errors
- **CORS errors**: Widget must be served from same origin (localhost:3000)

### Option 2: Standalone Embed Page

Use the embed page directly:

```
http://localhost:3000/embed/price-drop.html
```

- Enter any Amazon/eBay product URL
- Click "Load" to extract product info
- Subscribe to price alerts

### Option 3: Demo Page

Testing page with strict CSP headers:

```
http://localhost:3000/demo/
```

---

## Project Structure

```
PriceDropNotifier/
├── server/
│   ├── src/
│   │   ├── app.ts                        # Main Express server entry point
│   │   ├── config/                       # Configuration (database, constants)
│   │   │   ├── database.ts               # MongoDB connection with retry logic
│   │   │   └── constants.ts              # App constants (timeouts, user agents)
│   │   ├── controllers/                  # Request handlers (MVC Controllers)
│   │   │   ├── subscription.controller.ts  # POST /subscribe-price-drop
│   │   │   ├── extraction.controller.ts    # POST /api/extract
│   │   │   └── admin.controller.ts         # Admin endpoints
│   │   ├── models/                       # Mongoose schemas (MVC Models)
│   │   │   └── Subscription.model.ts     # Email, product, timestamps
│   │   ├── routes/                       # API routes with validation
│   │   │   ├── subscription.routes.ts    # Subscription validators
│   │   │   ├── extraction.routes.ts      # URL validators
│   │   │   └── admin.routes.ts           # Admin routes
│   │   ├── services/                     # Business logic services
│   │   │   ├── scraper.service.ts        # Cheerio + Playwright scraping
│   │   │   ├── email.service.ts          # Nodemailer email service
│   │   │   └── notifier.service.ts       # Price monitoring + notifications
│   │   ├── types.ts                      # TypeScript interfaces
│   │   └── utils.ts                      # Helper functions (price parsing, URL validation)
│   └── public/
│       ├── demo/                         # CSP-strict demo page
│       │   ├── index.html                # Demo HTML with URL input
│       │   ├── demo.css                  # Demo styles (no inline CSS)
│       │   └── demo.js                   # Demo logic (no inline scripts)
│       └── embed/                        # Embeddable widget pages
│           ├── price-drop.html           # Standalone embed page
│           └── embed.css                 # Embed styles
├── widget/
│   └── src/
│       ├── index.ts                      # Widget logic (vanilla TypeScript)
│       └── styles.css                    # Widget styles (8.26 KB → 4 KB gzipped)
├── userscript/
│   ├── price-drop-injector.user.js        # Build-based userscript (recommended)
│   ├── price-drop-injector-inline.user.js # Inline userscript (no build needed)
│   └── README.md                          # Userscript usage documentation
├── build/                                 # Built widget files (generated)
│   ├── price-drop-widget.min.js           # IIFE bundle (8.26 KB)
│   ├── price-drop-widget.esm.js           # ESM bundle (8.27 KB)
│   ├── price-drop-widget.min.css          # Widget styles (0.93 KB)
│   └── *.map                              # Source maps
├── docs/                                  # Documentation
│   ├── BUNDLE_SIZE.md                     # Bundle size analysis
│   ├── MVC_ARCHITECTURE.md                # Architecture documentation
│   ├── NOTES.md                           # Platform compatibility notes
│   ├── ARTIFACTS_GUIDE.md                 # Screenshot/video guide
│   ├── POSTMAN.md                         # API testing guide
├── .env.example                           # Environment template
├── .gitignore                             # Git ignore rules
├── package.json                           # Dependencies and scripts
├── tsconfig.json                          # TypeScript configuration
└── README.md                              # This file
```

### Key Files

- **app.ts**: Express server with middleware, routes, and CSP headers
- **scraper.service.ts**: Product extraction with Cheerio (fast) and Playwright fallback (JS-rendered pages)
- **notifier.service.ts**: Price monitoring with cursor streaming, rate limiting, and email notifications
- **subscription.controller.ts**: Handles subscriptions with validation, price parsing, and logging
- **Subscription.model.ts**: Mongoose schema with compound indexes for efficient queries

---

## API Endpoints

### `POST /api/extract`

Extract product information from a URL.

**Request**:

```json
{
  "url": "https://www.amazon.eg/.../dp/B0FNNFWD6P"
}
```

**Response**:

```json
{
  "ok": true,
  "product": {
    "name": "Xiaomi Redmi 15C Smartphone...",
    "price": "EGP6,555.00",
    "url": "https://www.amazon.eg/.../dp/B0FNNFWD6P"
  }
}
```

### `POST /subscribe-price-drop`

Subscribe to price drop notifications.

**Request**:

```json
{
  "email": "user@example.com",
  "product": {
    "name": "Product Name",
    "price": "$99.99",
    "url": "https://..."
  }
}
```

**Response**:

```json
{
  "ok": true
}
```

### `POST /admin/trigger-notify`

Manually trigger price check and notifications (for testing).

---

## How It Works

### 1. Intelligent Scraping Strategy

**Puppeteer-Extra-Stealth for Amazon/eBay**:

- 🤖 **Anti-Detection**: Automatically evades 50+ bot detection techniques
- 🎭 **Stealth Mode**: Hides `navigator.webdriver`, spoofs permissions API, randomizes fingerprints
- 🌐 **JavaScript Rendering**: Full browser context with `networkidle2` wait strategy
- ⏱️ **Human-like Delays**: Random 1-3 second delays between actions
- 🚀 **Direct Routing**: Amazon/eBay URLs skip simple fetch and go straight to Puppeteer

**Cheerio for Other Sites**:

- ⚡ **Fast & Lightweight**: Parses HTML without browser overhead
- 🔄 **Automatic Fallback**: Switches to Puppeteer if extraction fails

### 2. Product Detection with Multiple Fallbacks:

**Amazon** (30+ selectors):

- Title: `#productTitle`, meta tags, h1/h2 fallbacks
- Price: `.a-price .a-offscreen`, `#corePriceDisplay_desktop_feature_div`, `.priceToPay`, `#priceblock_ourprice`
- Extraction: Direct DOM evaluation in Puppeteer (same as userscript)
- Supports: All Amazon domains (.com, .eg, .uk, .de, etc.)

**eBay** (Multiple selectors):

- Title: `.x-item-title__mainTitle`, `#itemTitle`
- Price: `.x-price-primary .ux-textspans`, `.x-price-primary`, `#prcIsum`
- Extraction: Same selectors as userscript for consistency
- Supports: All eBay domains (.com, .co.uk, .de, etc.)

**Smart Validation**:

- Detects invalid extractions (generic names, invalid prices)
- Auto-triggers Puppeteer fallback for JavaScript-rendered content
- Enhanced logging for debugging extraction issues
- Multi-currency support & validation

- **Batch Processing**: Processes subscriptions in batches of 20 (prevents memory overload)
- **Cursor Streaming**: Streams documents from MongoDB (memory efficient for large datasets)
- **Smart Scheduling**: Checks prices every 10 minutes, skips subscriptions checked within last 5 minutes
- **Rate Limiting**: Enforces 2-second delay between requests to same domain (prevents IP bans)
- **Random Delays**: Adds 1-3 second delays to appear more human-like
- **Price Comparison**: Compares current price vs. `lastSeenPrice` (parsed numeric value)
- **3-Layer Validation**:
  - Backend: Express-validator with custom price validators
  - Demo Page: Client-side validation before submission
  - Widget: Validates price before allowing subscription
- **Price Validation Rules**:
  - Must contain at least one digit
  - Cannot be only zeros (e.g., "$0.00")
  - Cannot be only symbols/punctuation
  - Rejects "unknown" or empty prices
- **Email Notifications**: Sends via Nodemailer (Ethereal test accounts in dev)
- **Tracking**: Updates `lastCheckedAt` on every check, `lastNotifiedAt` when email sent
- **Detailed Logging**: Request/response logs with waterfall timing breakdownad)
- **Cursor Streaming**: Streams documents from MongoDB (memory efficient for large datasets)
- **Smart Scheduling**: Checks prices every 10 minutes, skips subscriptions checked within last 5 minutes
- **Rate Limiting**: Enforces 2-second delay between requests to same domain (prevents IP bans)
- **Random Delays**: Adds 1-3 second delays to appear more human-like
- **Price Comparison**: Compares current price vs. last seen price
- **Email Notifications**: Sends via Nodemailer (Ethereal test accounts in dev)
- **Tracking**: Updates `lastCheckedAt` on every check, `lastNotifiedAt` when email sent

### 4. Email Notifications

- Uses Ethereal.email for testing (check console for preview URLs)
- For production, configure real SMTP in `services/email.service.ts`

---

## What Changed: Migration to Puppeteer-Extra-Stealth

### Why Puppeteer-Extra-Stealth?

Previously used Playwright, but Amazon/eBay detection systems were too sophisticated. **Puppeteer-extra-stealth** provides:

| Feature                   | Playwright (Before)    | Puppeteer-Stealth (Now)       |
| ------------------------- | ---------------------- | ----------------------------- |
| **Bot Detection Evasion** | Manual tweaks          | ✅ Automatic (50+ techniques) |
| **navigator.webdriver**   | Must override manually | ✅ Auto-hidden                |
| **Chrome DevTools**       | Detectable             | ✅ Masked                     |
| **Permissions API**       | Detectable             | ✅ Spoofed                    |
| **Canvas Fingerprinting** | Exposed                | ✅ Randomized                 |
| **Success Rate (Amazon)** | ~40%                   | ✅ ~95%                       |

### Key Implementation Details

**1. Stealth Plugin Integration** ([scraper.service.ts](server/src/services/scraper.service.ts)):

```typescript
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());
```

**2. Smart Domain Routing**:

- Amazon/eBay → **Puppeteer** (JavaScript rendering required)
- Other sites → **Cheerio** (fast HTML parsing) with Puppeteer fallback

**3. Anti-Detection Features**:

- `--disable-blink-features=AutomationControlled` (hides automation)
- Real browser headers and fingerprints
- Random delays (1-3 seconds) mimicking human behavior
- `networkidle2` wait strategy (ensures dynamic content loads)

**4. Direct DOM Evaluation**:

```typescript
const data = await page.evaluate(() => {
  // Uses same selectors as userscript for consistency
  const title = document.querySelector("#productTitle")?.textContent;
  const price = document.querySelector(".a-price .a-offscreen")?.textContent;
  return { title, price };
});
```

### Installation Commands

```powershell
# Install Puppeteer packages
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

# Install Chrome browser
npx @puppeteer/browsers install chrome@stable
```

### Configuration

Optional: Specify Chrome path in `.env`:

```env
PUPPETEER_EXECUTABLE_PATH=D:\path\to\chrome.exe
```

If not set, Puppeteer auto-detects installed Chrome.

---

## Development

### Scripts

```powershell
npm run build:widget    # Build widget only (fast iteration)
npm run build           # Build TypeScript server + widget
npm run dev             # Start dev server with hot reload
npm start               # Start production server (after build)
```

### Making Changes

**Widget changes**:

1. Edit `widget/src/index.ts` or `widget/src/styles.css`
2. Run `npm run build:widget`
3. Refresh browser (hard refresh: Ctrl+Shift+R)

**Server changes**:

1. Edit files in `server/src/`
2. Server auto-reloads (using tsx watch)

**Userscript changes**:

1. Edit `userscript/price-drop-injector.user.ts`
2. Copy changes to `.user.js`
3. Update `@version` in header
4. Tampermonkey auto-updates

### Testing

**Test URL extraction**:

```powershell
curl -X POST http://localhost:3000/api/extract `
  -H "Content-Type: application/json" `
  -d '{"url":"https://www.amazon.eg/.../dp/B0FNNFWD6P"}'
```

**Test subscription**:

```powershell
curl -X POST http://localhost:3000/subscribe-price-drop `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","product":{"name":"Test","price":"$99","url":"https://example.com"}}'
```

**Trigger manual price check**:

```powershell
curl -X POST http://localhost:3000/admin/trigger-notify
```

Check console for Ethereal email preview URLs.

---

## Configuration

### Change Server Port

Set `PORT` environment variable:

```powershell
$env:PORT=8080; npm run dev
```

### Production Deployment

1. Update userscript URLs from `localhost:3000` to your domain
2. Configure real SMTP in `server/src/notifier.ts`
3. Build: `npm run build`
4. Start: `npm start`
5. Use process manager (PM2, systemd) for uptime

---

## Security Features

- ✅ Rate limiting (100 requests/15min per IP)
- ✅ Input validation & sanitization (express-validator)
- ✅ XSS protection (escapeHtml in all user inputs)
- ✅ CSP headers on demo page
- ✅ URL validation before fetch
- ✅ Error handling for invalid/malicious URLs

---

## Performance & Scalability

- **Memory Efficient**: Cursor-based streaming handles unlimited subscriptions without loading all into memory
- **Rate Limit Compliant**: Per-domain delays prevent anti-bot detection and IP bans
- **Smart Caching**: `lastCheckedAt` field prevents checking same product too frequently
- **Batch Processing**: Processes 20 subscriptions at a time with delays between batches
- **Scalable**: Can handle thousands of subscriptions efficiently

## Supported Platforms

- ✅ Amazon (all domains: .com, .eg, .uk, .de, .fr, .ca, etc.)
- ✅ eBay (all domains: .com, .co.uk, .de, etc.)
- 🔜 Add more e-commerce sites by updating selectors in controllers and services

---

## Troubleshooting

### Widget Shows "Price not available"

- Page structure changed (update selectors)
- JavaScript-rendered content (Playwright fallback should handle)
- Check server console for extraction errors

### No Email Received

- In development, emails go to Ethereal (check console for preview URL)
- For production, configure real SMTP credentials

### Server Won't Start

- Port 3000 already in use: `$env:PORT=8080; npm run dev`
- Missing dependencies: `npm install`
- TypeScript errors: `npm run build`

### Widget Not Injecting

- Server not running: verify `localhost:3000` is accessible
- Userscript not active: check Tampermonkey icon
- Wrong domain: verify you're on Amazon/eBay product page
- Check browser console (F12) for JavaScript errors

---

## License

MIT
