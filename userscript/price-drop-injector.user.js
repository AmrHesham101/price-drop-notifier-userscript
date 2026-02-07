// ==UserScript==
// @name         Price Drop Notifier Injector
// @namespace    http://example.com/
// @version      0.7
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
// @grant        none
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
   * Load the widget bundle from the server
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

    try {
      // Try loading widget from server
      await loadWidget();

      // Check if widget loaded successfully
      if (window.PriceDropWidget && window.PriceDropWidget.initFloating) {
        window.PriceDropWidget.initFloating({ product });
        console.log("Price Drop Notifier: Floating widget initialized");
      } else {
        throw new Error("Widget not found on window object");
      }
    } catch (error) {
      // CSP blocked script or other error - fallback to iframe
      console.warn(
        "Price Drop Notifier: Script load failed, using iframe",
        error,
      );
      loadIframeFallback(product);
    }
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
