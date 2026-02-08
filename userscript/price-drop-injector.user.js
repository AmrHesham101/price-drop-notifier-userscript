// ==UserScript==
// @name         Price Drop Notifier Injector
// @namespace    http://example.com/
// @version      1.2
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

  // LocalStorage persistence to avoid re-showing widget for subscribed products
  const STORAGE_KEY = "pdn_subscribed_products";

  function getSubscribedProducts() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn("[PDN] localStorage read error:", e);
      return [];
    }
  }

  function isAlreadySubscribed(productUrl) {
    const subscribed = getSubscribedProducts();
    return subscribed.includes(productUrl);
  }

  function markAsSubscribed(productUrl) {
    try {
      const subscribed = getSubscribedProducts();
      if (!subscribed.includes(productUrl)) {
        subscribed.push(productUrl);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribed));
      }
    } catch (e) {
      console.warn("[PDN] localStorage write error:", e);
    }
  }

  /**
   * Extract product information from the current page
   */
  function extract() {
    // Title extraction - Amazon and eBay specific
    const amazonTitle = document.querySelector("#productTitle");
    const ebayTitle =
      document.querySelector(".x-item-title__mainTitle") ||
      document.querySelector("#itemTitle") ||
      document.querySelector(".it-ttl");
    const genericTitle =
      document.querySelector("h1") || document.querySelector("h2");
    const title = (
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

    return { name: title, price, url: location.href };
  }

  /**
   * Load widget build from server via GM_xmlhttpRequest (bypasses CSP)
   */
  function loadWidgetBuild() {
    return new Promise((resolve, reject) => {
      console.log(
        "[PDN] Fetching widget build from:",
        `${SERVER_URL}/build/price-drop-widget.min.js`,
      );
      GM_xmlhttpRequest({
        method: "GET",
        url: `${SERVER_URL}/build/price-drop-widget.min.js`,
        onload: function (response) {
          console.log(
            "[PDN] GM response status:",
            response.status,
            "Size:",
            response.responseText.length,
            "bytes",
          );
          if (response.status === 200) {
            // Inject build code inline (bypasses CSP)
            const script = document.createElement("script");
            script.textContent = response.responseText;
            script.id = "pdn-widget-build";
            document.head.appendChild(script);
            console.log(
              "[PDN] Script injected. Checking window.PriceDropWidget...",
              typeof window.PriceDropWidget,
            );

            // Give it a moment to execute
            setTimeout(() => {
              console.log(
                "[PDN] After timeout, window.PriceDropWidget:",
                typeof window.PriceDropWidget,
              );
              if (typeof window.PriceDropWidget !== "undefined") {
                console.log(
                  "[PDN] Widget available:",
                  Object.keys(window.PriceDropWidget),
                );
              }
              resolve();
            }, 100);
          } else {
            reject(new Error(`Failed to load build: ${response.status}`));
          }
        },
        onerror: function (error) {
          console.error("[PDN] GM_xmlhttpRequest error:", error);
          reject(error);
        },
      });
    });
  }

  async function inject() {
    const product = extract();

    // Check if user already subscribed to this product
    if (isAlreadySubscribed(product.url)) {
      console.log("[PDN] Already subscribed to this product, skipping widget injection");
      return;
    }

    try {
      // Load widget build
      await loadWidgetBuild();

      // Handle ESM/IIFE module structure
      const mod = unsafeWindow.PriceDropWidget || window.PriceDropWidget;

      // Handle ESM default export OR named exports OR direct global
      const api =
        (mod && (mod.default || mod.PriceDropWidget)) || // default export / nested
        mod; // direct

      console.log("[PDN] PriceDropWidget keys:", api && Object.keys(api));

      if (!api) {
        console.error("[PDN] PriceDropWidget missing");
        return;
      }

      if (typeof api.initFloating !== "function") {
        console.error(
          "[PDN] initFloating not found. Available:",
          Object.keys(api),
        );
        return;
      }

      console.log("[PDN] Initializing floating widget");
      // Initialize widget (renders UI)
      api.initFloating({ product });

      // Wait for widget to render in DOM
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Find the form and intercept submission
      const form = document.querySelector("#pdn-floating-form");
      const emailInput = document.querySelector("#pdn-email-floating");
      const submitBtn = document.querySelector("#pdn-submit-floating");
      const statusDiv = document.querySelector("#pdn-status-floating");

      if (!form || !emailInput || !submitBtn || !statusDiv) {
        console.error("[PDN] Widget elements not found in DOM");
        return;
      }

      console.log("[PDN] Intercepting form submission with GM_xmlhttpRequest");

      // Remove widget's original submit handler and add our own
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      // Get fresh references after cloning
      const newEmailInput = document.querySelector("#pdn-email-floating");
      const newSubmitBtn = document.querySelector("#pdn-submit-floating");
      const newStatusDiv = document.querySelector("#pdn-status-floating");

      newForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = newEmailInput.value.trim();

        if (!email) {
          newStatusDiv.textContent = "Please enter an email.";
          newStatusDiv.style.color = "#EF4444";
          return;
        }

        console.log("[PDN] Submitting via GM_xmlhttpRequest");
        newStatusDiv.textContent = "Submitting...";
        newStatusDiv.style.color = "#6B7280";
        newSubmitBtn.disabled = true;
        newSubmitBtn.style.opacity = "0.6";

        GM_xmlhttpRequest({
          method: "POST",
          url: `${SERVER_URL}/subscribe-price-drop`,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify({ email, product }),
          onload: function (response) {
            try {
              const result = JSON.parse(response.responseText);

              if// Save to localStorage to avoid showing widget again
                markAsSubscribed(product.url);

                setTimeout(() => {
                  newStatusDiv.textContent = "";
                  newSubmitBtn.disabled = false;
                  newSubmitBtn.style.opacity = "1";
                  
                  // Optionally hide the widget after successful subscription
                  const container = document.getElementById("pdn-widget-container");
                  if (container) {
                    container.style.opacity = "0.5";
                    container.style.pointerEvents = "none";
                  }";
                newEmailInput.value = "";

                setTimeout(() => {
                  newStatusDiv.textContent = "";
                  newSubmitBtn.disabled = false;
                  newSubmitBtn.style.opacity = "1";
                }, 3000);
              } else if (result && result.error) {
                if (result.error === "already_subscribed") {
                  newStatusDiv.textContent =
                    "Already subscribed to this product!";
                } else {
                  newStatusDiv.textContent = "Error: " + result.error;
                }
                newStatusDiv.style.color = "#EF4444";
                newSubmitBtn.disabled = false;
                newSubmitBtn.style.opacity = "1";
              } else {
                newStatusDiv.textContent = "Unexpected response";
                newStatusDiv.style.color = "#EF4444";
                newSubmitBtn.disabled = false;
                newSubmitBtn.style.opacity = "1";
              }
            } catch (error) {
              newStatusDiv.textContent = "Failed to parse server response";
              newStatusDiv.style.color = "#EF4444";
              newSubmitBtn.disabled = false;
              newSubmitBtn.style.opacity = "1";
              console.error("[PDN] Parse error:", error);
            }
          },
          onerror: function (error) {
            newStatusDiv.textContent = "Network error. Is the server running?";
            newStatusDiv.style.color = "#EF4444";
            newSubmitBtn.disabled = false;
            newSubmitBtn.style.opacity = "1";
            console.error("[PDN] Network error:", error);
          },
        });
      });

      console.log("[PDN] Widget ready with GM API injected");
    } catch (error) {
      console.error("Failed to load Price Drop Widget:", error);
    }
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
