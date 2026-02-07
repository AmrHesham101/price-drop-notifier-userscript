# Price Drop Notifier 🔔

A lightweight, embeddable widget that automatically monitors product prices on Amazon and eBay, sending email notifications when prices drop. Features:

- 🎯 **Auto-detection** - Automatically extracts product info from Amazon/eBay pages
- 💉 **Userscript injection** - Injects seamlessly into product pages via Tampermonkey
- 📧 **Email notifications** - Get notified when prices drop
- 🚀 **Zero dependencies** - Pure vanilla JS widget (no React/Vue/etc.)
- 🔒 **CSP compliant** - Works with strict Content Security Policies
- ⚡ **Fast & lightweight** - <4KB minified widget
- 🏗️ **MVC Architecture** - Clean separation of concerns with MongoDB
- 📊 **Production Ready** - Uses MongoDB for scalable data storage

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

### 2. Install Dependencies

```powershell
npm install
```

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
│   │   ├── index.ts          # Express server & API routes
│   │   ├── notifier.ts       # Background price checker & email sender
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── utils.ts          # Helper functions
│   ├── public/
│   │   ├── assets/           # Static assets
│   │   ├── demo/             # Demo page files
│   │   └── embed/            # Embeddable widget page
│   └── data/
│       └── subscriptions.json # Subscription storage
├── widget/
│   └── src/
│       ├── index.ts          # Widget logic (vanilla JS)
│       └── styles.css        # Widget styles
├── userscript/
│   ├── price-drop-injector.user.js   # Compiled userscript (use this)
│   ├── price-drop-injector.user.ts   # TypeScript source
│   └── README.md                     # Userscript documentation
├── build/                    # Built widget files
│   ├── price-drop-widget.min.js      # IIFE bundle
│   ├── price-drop-widget.esm.js      # ESM bundle
│   └── price-drop-widget.min.css     # Widget styles
└── package.json
```

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

### 1. Product Detection

The system uses platform-specific CSS selectors:

**Amazon**:

- Title: `#productTitle`
- Price: `#corePriceDisplay_desktop_feature_div .a-price .a-offscreen`, `.priceToPay .a-offscreen`

**eBay**:

- Title: `.x-item-title__mainTitle`, `#itemTitle`
- Price: `.x-price-primary`, `#prcIsum`

### 2. Data Extraction

- **Cheerio**: Fast DOM parsing for static HTML
- **Playwright**: Fallback for JavaScript-rendered pages
- Extracts first matching price (avoids related products)

### 3. Price Monitoring

- Background worker checks prices every 15 minutes
- Compares current price vs. last seen price
- Sends email via Nodemailer (Ethereal test accounts in dev)

### 4. Email Notifications

- Uses Ethereal.email for testing (check console for preview URLs)
- For production, configure real SMTP in `notifier.ts`

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

## Supported Platforms

- ✅ Amazon (all domains: .com, .eg, .uk, .de, .fr, .ca, etc.)
- ✅ eBay (all domains: .com, .co.uk, .de, etc.)
- 🔜 Add more e-commerce sites by updating selectors in `index.ts` and `notifier.ts`

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
