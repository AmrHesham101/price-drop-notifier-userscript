# Artifacts Guide

This document explains how to create the required proof artifacts for the project submission.

## 📸 Required Screenshots & Videos

### 1. Network Waterfall Screenshot

**Purpose:** Show POST request timing and load sequence

**How to Capture:**

1. **Start the server:**
   ```powershell
   npm run dev
   ```

2. **Open demo page:**
   ```
   http://localhost:3000/demo/
   ```

3. **Open Chrome DevTools:**
   - Press `F12`
   - Go to **Network** tab
   - Check "Preserve log"
   - Refresh page (`Ctrl+R`)

4. **Trigger subscription:**
   - Enter email in widget
   - Click "Notify me"
   - Watch POST request appear

5. **Capture screenshot:**
   - **Recommended:** Screenshot entire Network waterfall showing:
     - GET /demo/index.html
     - GET /build/price-drop-widget.min.js (~7.92 KB)
     - GET /build/price-drop-widget.min.css (~0.93 KB)
     - POST /subscribe-price-drop (with timing)
   - Save as: `screenshots/network-waterfall.png`

**What to Highlight:**
- Total load time (<250ms)
- Bundle sizes (7.92 KB JS, 0.93 KB CSS)
- POST request status (200 OK)
- Response time (0.8-2.8s with simulated delay)

---

### 2. Userscript Working on Amazon/eBay

**Amazon Screenshot:**

1. **Navigate to Amazon product:**
   ```
   https://www.amazon.com/dp/B0FNNFWD6P
   ```

2. **Widget should appear at top:**
   - Product name auto-filled
   - Price auto-detected
   - Email input ready

3. **Capture full page:**
   - Show URL bar (proves it's Amazon)
   - Show widget at top of page
   - Save as: `screenshots/amazon-widget.png`

**eBay Screenshot:**

1. **Navigate to eBay product:**
   ```
   https://www.ebay.com/itm/123456789
   ```

2. **Widget should appear:**
   - Product title extracted
   - Price displayed
   - Form functional

3. **Capture:**
   - URL bar visible (proves eBay)
   - Widget rendered correctly
   - Save as: `screenshots/ebay-widget.png`

---

### 3. Bundle Size Proof

**Option A: File Explorer Screenshot**

```powershell
Get-ChildItem -Path build -File | Select-Object Name, @{Name='Size(KB)';Expression={[math]::Round($_.Length/1KB, 2)}}
```

Screenshot PowerShell output showing:
```
Name                         Size(KB)
----                         --------
price-drop-widget.min.js         7.92
price-drop-widget.min.css        0.93
```

Save as: `screenshots/bundle-size.png`

**Option B: DevTools Screenshot**

1. Open Network tab
2. Load demo page
3. Find `price-drop-widget.min.js`
4. Screenshot showing size: **7.92 KB** (8,105 bytes)

---

### 4. Lighthouse Score Screenshot

**How to Run Lighthouse:**

1. **Open demo page:**
   ```
   http://localhost:3000/demo/
   ```

2. **Open Chrome DevTools:**
   - Press `F12`
   - Go to **Lighthouse** tab

3. **Configure audit:**
   - Categories: Performance, Accessibility, Best Practices, SEO
   - Device: Desktop
   - Click "Analyze page load"

4. **Capture results:**
   - Screenshot showing scores (should be 90+)
   - Save as: `screenshots/lighthouse-score.png`

**Expected Scores:**
- Performance: 95-100
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

---

### 5. Video Walkthrough (5 minutes)

**Recording Tools:**
- **Windows:** OBS Studio, Xbox Game Bar (`Win+G`)
- **Mac:** QuickTime Screen Recording
- **Cross-platform:** Loom, ScreenToGif

**Script:**

```
[0:00-0:30] Introduction
- "Hi, this is the Price Drop Notifier project"
- "I'll demo the userscript, widget, and CSP bypass"

[0:30-1:30] Demo Page
- Open http://localhost:3000/demo/
- Show widget rendering
- Enter email, submit form
- Show success message
- Open DevTools → Network tab
- Point out bundle sizes (7.92 KB)

[1:30-3:00] Amazon Userscript
- Navigate to Amazon product page
- Show Tampermonkey icon (script active)
- Widget appears at top
- Product info auto-filled
- Submit subscription
- Open DevTools Console
- Show logs: "[PDN] Widget loaded"

[3:00-4:00] eBay CSP Bypass
- Navigate to eBay product page
- Widget appears despite strict CSP
- Explain GM_xmlhttpRequest bypass
- Show Network tab (POST via GM API)
- Show success message

[4:00-5:00] Code Walkthrough
- Open VSCode
- Show widget/src/index.ts (pure vanilla JS)
- Show userscript/price-drop-injector.user.js
- Highlight CSP bypass in inject() function
- Show MVC structure in server/src/

[5:00] Conclusion
- "Widget: 4KB gzipped, no frameworks"
- "Works on Amazon & eBay with CSP bypass"
- "Production-ready with MongoDB backend"
```

Save as: `demo-video.mp4`

---

## 📊 Testing Documentation

### Email Validation Test

```javascript
// Test in browser console
window.PriceDropWidget.init(document.body, {
  name: 'Test Product',
  price: '$99.99',
  url: 'https://example.com'
});

// Try invalid emails:
// - "invalid" → Should show error
// - "test@" → Should show error  
// - "test@example.com" → Should succeed
```

### Timeout/Abort Test

```javascript
// Simulate network timeout (server/src/utils.ts)
export function randomDelay(): number {
    return 15000; // Increase to 15 seconds
}

// Widget should show timeout error after 10s
```

### DOM Extraction Test

```javascript
// Test on different Amazon pages
const testUrls = [
  'https://www.amazon.com/dp/B0FNNFWD6P',
  'https://www.amazon.eg/dp/B0FNNFWD6P',
  'https://www.amazon.co.uk/gp/product/B0FNNFWD6P'
];

// For each URL, verify:
// - Product title extracted
// - Price detected
// - URL captured
```

---

## 📁 File Organization

Create an `artifacts/` folder:

```
artifacts/
├── screenshots/
│   ├── network-waterfall.png
│   ├── amazon-widget.png
│   ├── ebay-widget.png
│   ├── bundle-size.png
│   └── lighthouse-score.png
├── demo-video.mp4
└── README.md (this file)
```

---

## 🎯 Submission Checklist

- [ ] Network waterfall screenshot (with bundle sizes)
- [ ] Amazon userscript screenshot
- [ ] eBay userscript screenshot
- [ ] Bundle size proof (PowerShell or DevTools)
- [ ] Lighthouse score screenshot
- [ ] 5-minute demo video
- [ ] NOTES.md (where it works/fails) ✅
- [ ] BUNDLE_SIZE.md (gzipped size proof) ✅
- [ ] Code comments explaining decisions ✅

---

## 💡 Tips

### High-Quality Screenshots
- Use 1920x1080 or higher resolution
- Ensure text is readable
- Highlight key information with annotations

### Video Best Practices
- Use 1080p or 720p resolution
- Enable microphone (explain what you're doing)
- Keep it concise (under 5 minutes)
- Use slow, deliberate movements
- Pause briefly on important screens

### Debugging Before Recording
- Test everything works first
- Clear browser cache
- Restart server for clean state
- Close unnecessary tabs/windows

---

## 🚀 Ready to Record?

1. ✅ Ensure server running: `npm run dev`
2. ✅ MongoDB running: `mongod`
3. ✅ Build widget: `npm run build:widget`
4. ✅ Tampermonkey script installed and enabled
5. ✅ Test on both Amazon and eBay
6. 🎬 Start recording!

Good luck! 🎉
