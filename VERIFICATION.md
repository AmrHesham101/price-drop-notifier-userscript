# How to Verify the Userscript is Working

## Visual Indicators

### ✅ What You Should See

When you visit an Amazon or eBay product page, you should see:

1. **Widget Container** at the top of the page:
   - Light gray background (`#f9fafb`)
   - Rounded corners (8px border radius)
   - 12px padding around the widget
   - Located ABOVE the product images/title

2. **Widget Box** inside the container:
   - White background
   - Border and shadow effect
   - Product name displayed (auto-detected)
   - Price displayed (auto-detected)
   - Email input field
   - "Notify me" button

### 🔍 Quick Visual Test

On an Amazon product page (e.g., `https://www.amazon.eg/-/en/.../dp/B0FNNFWD6P`):

```
┌─────────────────────────────────────────────┐
│  [Light Gray Container - z-index: 9999]    │
│  ┌───────────────────────────────────────┐ │
│  │  [White Widget Box]                   │ │
│  │  Email me if this product gets cheaper│ │
│  │  [email input] [Notify me button]     │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
[Product images and details below...]
```

---

## Browser DevTools Verification

### Console Checks (Press F12 → Console)

**1. Check if widget loaded:**

```javascript
window.PriceDropWidget;
// ✅ Should return: {init: ƒ}
// ❌ If undefined: Script didn't load
```

**2. Check if container exists:**

```javascript
document.getElementById("pdn-widget-container");
// ✅ Should return: <div id="pdn-widget-container" style="...">
// ❌ If null: Script didn't inject
```

**3. Verify positioning:**

```javascript
const container = document.getElementById("pdn-widget-container");
console.log("z-index:", container.style.zIndex); // Should be: 9999
console.log("position:", container.style.position); // Should be: relative
console.log("background:", container.style.backgroundColor); // Should be: #f9fafb or rgb(249, 250, 251)
```

**4. Check widget root:**

```javascript
document.querySelector(".pdn-widget-root");
// ✅ Should return the widget element
// Check computed style:
const widget = document.querySelector(".pdn-widget-root");
console.log("Widget z-index:", getComputedStyle(widget).zIndex); // Should be: 9999
```

### Network Tab Checks (F12 → Network → Reload page)

**Expected requests:**

1. **Widget Script** (on page load):

   ```
   Request: http://localhost:3000/build/price-drop-widget.min.js
   Status: 200 OK
   Size: ~3.6KB
   Type: script
   ```

2. **Widget CSS** (loaded by widget):

   ```
   Request: http://localhost:3000/build/price-drop-widget.min.css
   Status: 200 OK
   Size: ~1KB
   Type: stylesheet
   ```

3. **Subscription** (after clicking "Notify me"):
   ```
   Request: POST http://localhost:3000/subscribe-price-drop
   Status: 200 OK (success) or 409 (already subscribed)
   Response: {"ok":true}
   ```

### Elements Tab Checks (F12 → Elements)

**Search for** (Ctrl+F in Elements tab):

- `pdn-widget-container` → Should find the container div
- `pdn-widget-root` → Should find the widget root
- `pdn-form` → Should find the form inside widget

**Inspect the container:**

```html
<div
  id="pdn-widget-container"
  style="min-height: 64px; margin: 16px 0px; position: relative; z-index: 9999; background-color: rgb(249, 250, 251); padding: 12px; border-radius: 8px;"
>
  <div class="pdn-widget-root" style="...z-index: 9999...">
    <form class="pdn-form">
      <!-- Widget content -->
    </form>
  </div>
</div>
```

---

## Tampermonkey Verification

### Check Script Status

1. **Click Tampermonkey icon** (puzzle piece near address bar)
2. You should see:
   ```
   Price Drop Notifier Injector (v0.2)  [✓]
   ```
3. The **checkmark** means it's active on this page
4. Number badge on icon shows active script count (should be ≥1)

### Script Dashboard

1. Click Tampermonkey → **Dashboard**
2. Find **"Price Drop Notifier Injector"**
3. Check:
   - ✅ **Enabled** toggle is ON
   - ✅ **Last modified** shows recent date
   - ✅ **@match** patterns include:
     ```
     https://www.amazon.*/*
     https://amazon.*/*
     https://www.ebay.*/*
     https://ebay.*/*
     ```

### Test on Multiple Pages

Visit these test URLs to verify matching:

- ✅ `https://www.amazon.com/...` (should inject)
- ✅ `https://www.amazon.eg/...` (should inject)
- ✅ `https://amazon.com/...` (should inject)
- ✅ `https://www.ebay.com/...` (should inject)
- ❌ `https://google.com` (should NOT inject)

---

## Common Issues & Solutions

### ❌ Widget Not Appearing

**Problem**: No gray box at top of page

**Check**:

1. Server running? → `npm run dev` → Visit `http://localhost:3000`
2. Tampermonkey icon shows "0"? → Script not matching URL pattern
3. Console errors? → Press F12, check for red errors

**Solutions**:

```javascript
// Check if on product page
console.log("Current URL:", location.href);
console.log("Is Amazon?", location.href.includes("amazon"));
console.log("Is eBay?", location.href.includes("ebay"));

// Check script injection
console.log("Container:", document.getElementById("pdn-widget-container"));
```

### ❌ Widget Behind Other Elements

**Problem**: Widget exists but you can't see it

**Fix**: The widget now has `z-index: 9999` in both:

- Container div (`#pdn-widget-container`)
- Widget root (`.pdn-widget-root`)

**Verify**:

```javascript
const container = document.getElementById("pdn-widget-container");
console.log("Container z-index:", container.style.zIndex); // Should be 9999

const widget = document.querySelector(".pdn-widget-root");
console.log("Widget z-index:", getComputedStyle(widget).zIndex); // Should be 9999
```

### ❌ Product Info Not Detected

**Problem**: Shows "unknown" for price or wrong product name

**Debug**:

```javascript
// Test product detection manually
function testExtract() {
  const amazonTitle = document.querySelector("#productTitle");
  const amazonPrice = document.querySelector(
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
  );

  console.log("Title element:", amazonTitle);
  console.log("Title text:", amazonTitle?.textContent?.trim());
  console.log("Price element:", amazonPrice);
  console.log("Price text:", amazonPrice?.textContent?.trim());
}
testExtract();
```

### ❌ CORS Errors

**Problem**: Console shows `blocked by CORS policy`

**Cause**: Widget tries to load from different origin

**Solution**: Must access widget from same origin as server

- ✅ Widget: `http://localhost:3000/build/...`
- ✅ Page: Via userscript injection (same context)
- ❌ Direct cross-origin iframe won't work

### ❌ Subscription Fails

**Problem**: Clicking "Notify me" doesn't work

**Check Network Tab**:

```
POST /subscribe-price-drop
Status: 400 → Check request body (invalid email/URL?)
Status: 409 → Already subscribed
Status: 500 → Server error (check server console)
Status: [CORS] → Server not running or different origin
```

**Check Request Payload** (Network tab → POST request → Payload):

```json
{
  "email": "test@example.com",
  "product": {
    "name": "...",
    "price": "...",
    "url": "..."
  }
}
```

---

## Success Checklist

Use this checklist to verify everything works:

- [ ] Server running: `npm run dev` shows "running on http://localhost:3000"
- [ ] Tampermonkey icon shows "1" (script active)
- [ ] Visit Amazon product page
- [ ] Gray container box appears at top
- [ ] White widget box inside with form
- [ ] Product name auto-filled
- [ ] Product price auto-filled
- [ ] Console: `window.PriceDropWidget` returns object
- [ ] Console: `document.getElementById('pdn-widget-container')` returns element
- [ ] Console: `getComputedStyle(document.querySelector('.pdn-widget-root')).zIndex` returns "9999"
- [ ] Enter email → Click "Notify me"
- [ ] Network tab shows POST to `/subscribe-price-drop` with 200 status
- [ ] Success message: "✓ Subscribed! We'll email you if price drops."
- [ ] Form clears after 3 seconds
- [ ] Check file: `server/data/subscriptions.json` has new entry

---

## Advanced Debugging

### Enable Verbose Logging

Add to userscript (top of inject function):

```javascript
console.log("[PDN] Starting injection...");
console.log("[PDN] Product extracted:", product);
console.log("[PDN] Insert target:", insertTarget);
console.log("[PDN] Placeholder created:", placeholder);
```

### Monitor Widget Lifecycle

```javascript
// Check widget initialization
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.id === "pdn-widget-container") {
        console.log("✅ Widget container added to DOM");
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Test Subscription Data

Check stored subscriptions:

```powershell
# View subscriptions file
Get-Content server/data/subscriptions.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected format:

```json
[
  {
    "email": "user@example.com",
    "product": {
      "url": "https://www.amazon.eg/.../dp/B0FNNFWD6P",
      "name": "Xiaomi Redmi 15C Smartphone...",
      "price": "EGP6,555.00"
    },
    "createdAt": "2026-02-07T..."
  }
]
```

---

## Visual Position Test

The widget should be **above everything** on the page due to `z-index: 9999`.

**Test stacking**:

1. Open page with widget injected
2. Scroll around
3. Widget should stay in its position (not fixed/sticky, just high z-index)
4. No other page elements should overlay the widget

**If elements overlap**, increase z-index in:

- `userscript/price-drop-injector.user.js` line ~58: `placeholder.style.zIndex = '99999';`
- `widget/src/styles.css` line 1: `z-index:99999`
- Rebuild: `npm run build:widget`
- Hard refresh page: Ctrl+Shift+R
