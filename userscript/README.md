# Price Drop Notifier - Userscript

This userscript automatically injects the Price Drop Notifier widget into Amazon and eBay product pages.

## Features

- 🔍 **Auto-detects** product name, price, and URL from the current page
- 🎯 **Seamless integration** - Widget appears at the top of product pages
- ✅ **Clean reset** - After subscribing, the form clears for the next product
- 🔄 **Smart fallback** - Uses iframe if direct script injection fails

## Installation

### 1. Install a Userscript Manager

Choose one of these browser extensions:

- **Chrome/Edge**: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
- **Safari**: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)

### 2. Install the Userscript

1. Make sure your Price Drop Notifier server is running on `http://localhost:3000`
2. Click on the Tampermonkey icon in your browser
3. Click **"Create a new script"**
4. Delete the default content
5. Copy the entire content of `price-drop-injector.user.js`
6. Paste it into the editor
7. Save (Ctrl+S or Cmd+S)

### 3. Usage

1. Start your server: `npm run dev`
2. Visit any Amazon or eBay product page
3. The Price Drop Notifier widget will automatically appear at the top
4. Enter your email and click "Notify me"
5. After subscribing, the form clears automatically for the next product

## Supported Sites

- ✅ Amazon (all country domains: .com, .eg, .uk, .de, etc.)
- ✅ eBay (all country domains)

## How It Works

1. **Detection**: The script detects when you're on a product page
2. **Extraction**: It extracts the product name, price, and URL using platform-specific selectors
3. **Injection**: It injects the widget at the top of the page
4. **Auto-fill**: The widget is pre-filled with the detected product info
5. **Subscribe**: You just enter your email and subscribe
6. **Reset**: After subscribing, the form clears for the next product

## Troubleshooting

### Widget doesn't appear

- Make sure the server is running on `localhost:3000`
- Check the browser console for errors (F12)
- Verify the userscript is enabled in Tampermonkey

### Product info not detected

- The page structure might have changed
- Check browser console for extraction errors
- Try refreshing the page

### CORS errors

- Make sure you're accessing the page over HTTPS
- The server needs to be running locally
- Check that the widget script is loading correctly

## Development

To modify the userscript:

1. Edit `price-drop-injector.user.ts` (TypeScript version)
2. Manually copy changes to `price-drop-injector.user.js`
3. Update the `@version` number in the userscript header
4. Tampermonkey will detect the version change and update automatically

## Configuration

To change the server URL (for production deployment):

```javascript
const widgetSrc = "http://localhost:3000/build/price-drop-widget.min.js";
// Change to:
const widgetSrc = "https://your-domain.com/build/price-drop-widget.min.js";
```

Also update the iframe fallback URL:

```javascript
const src = 'http://localhost:3000/embed/price-drop.html?name=' + ...
// Change to:
const src = 'https://your-domain.com/embed/price-drop.html?name=' + ...
```
