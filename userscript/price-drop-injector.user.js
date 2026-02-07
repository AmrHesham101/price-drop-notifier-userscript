// ==UserScript==
// @name         Price Drop Notifier Injector
// @namespace    http://example.com/
// @version      0.8
// @description  Floating widget for price drop notifications on Amazon and eBay
// @match        https://www.amazon.eg/*/dp/*
// @match        https://www.amazon.eg/dp/*
// @match        https://www.amazon.*/*/dp/*
// @match        https://www.amazon.*/dp/*
// @match        https://www.amazon.*/*/gp/product/*
// @match        https://www.amazon.*/gp/product/*
// @match        https://www.ebay.com/itm/*
// @match        https://www.ebay.com/p/*
// @match        https://www.ebay.*/itm/*
// @match        https://www.ebay.*/p/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const SERVER_URL = "http://localhost:3000";

  /**
   * Extract product information from the current page
   */
  function extractProduct() {
    // Title extraction - Amazon and eBay specific
    const amazonTitle = document.querySelector("#productTitle");
    const ebayTitle =
      document.querySelector(".x-item-title__mainTitle") ||
      document.querySelector("#itemTitle") ||
      document.querySelector(".it-ttl");
    const genericTitle =
      document.querySelector("h1") || document.querySelector("h2");
    const name = (
      amazonTitle?.textContent ||
      ebayTitle?.textContent ||
      genericTitle?.textContent ||
      document.title
    ).trim();

    // Price extraction - Amazon and eBay specific
    const priceSelectors = [
      "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
      "#corePrice_desktop .a-price .a-offscreen",
      ".priceToPay .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      ".a-price .a-offscreen",
      ".x-price-primary .ux-textspans",
      ".x-price-primary",
      "#prcIsum",
      ".display-price",
      ".notranslate",
      ".price",
    ];

    let price = "unknown";
    for (const sel of priceSelectors) {
      const priceEl = document.querySelector(sel);
      if (priceEl && priceEl.textContent?.trim()) {
        price = priceEl.textContent.trim();
        break;
      }
    }

    return { name, price, url: location.href };
  }

  /**
   * Load the widget bundle from the server (normal script tag)
   */
  function loadWidget() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${SERVER_URL}/build/price-drop-widget.min.js`;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load widget script"));
      document.head.appendChild(script);
    });
  }

  /**
   * Load widget content via GM_xmlhttpRequest and inject inline (bypasses CSP)
   */
  function loadWidgetViaGM() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `${SERVER_URL}/build/price-drop-widget.min.js`,
        onload: function (response) {
          if (response.status === 200) {
            try {
              // Inject script content inline (Tampermonkey can bypass CSP for this)
              const script = document.createElement("script");
              script.textContent = response.responseText;
              document.head.appendChild(script);
              resolve(true);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Failed to fetch widget: ${response.status}`));
          }
        },
        onerror: function (error) {
          reject(new Error("Network error loading widget"));
        },
      });
    });
  }

  /**
   * Fallback to iframe if script loading fails
   */
  function loadIframeFallback(product) {
    const iframe = document.createElement("iframe");
    const params = new URLSearchParams({
      name: product.name,
      price: product.price,
      url: product.url,
    });
    iframe.src = `${SERVER_URL}/embed/price-drop.html?${params.toString()}`;
    Object.assign(iframe.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      width: "400px",
      height: "500px",
      border: "none",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
      zIndex: "999999",
    });
    document.body.appendChild(iframe);
    console.log("Price Drop Notifier: Using iframe fallback due to CSP");
  }

  /**
   * Initialize the widget
   */
  async function inject() {
    // Prevent duplicate injection
    if (document.getElementById("pdn-floating-button")) {
      console.log("Price Drop Notifier: Already injected");
      return;
    }

    const product = extractProduct();
    console.log("Price Drop Notifier: Extracted product", product);

    // Try method 1: Normal script loading (works on pages without strict CSP)
    try {
      await loadWidget();
      if (window.PriceDropWidget && window.PriceDropWidget.initFloating) {
        window.PriceDropWidget.initFloating({ product });
        console.log("Price Drop Notifier: Loaded via normal script tag");
        return;
      }
    } catch (error) {
      console.warn(
        "Price Drop Notifier: Normal script load failed (CSP?), trying GM fetch...",
      );
    }

    // Try method 2: Fetch via GM_xmlhttpRequest and inject inline (bypasses CSP)
    try {
      await loadWidgetViaGM();
      if (window.PriceDropWidget && window.PriceDropWidget.initFloating) {
        window.PriceDropWidget.initFloating({ product });
        console.log(
          "Price Drop Notifier: Loaded via GM_xmlhttpRequest (CSP bypassed)",
        );
        return;
      }
    } catch (error) {
      console.warn(
        "Price Drop Notifier: GM fetch failed, trying iframe fallback...",
        error,
      );
    }

    // Try method 3: iframe fallback (last resort, might also be blocked by frame-src CSP)
    try {
      loadIframeFallback(product);
      console.log("Price Drop Notifier: Using iframe fallback");
    } catch (error) {
      console.error("Price Drop Notifier: All loading methods failed", error);
    }
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
