// ==UserScript==
// @name         Price Drop Notifier Injector
// @namespace    http://example.com/
// @version      0.6
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

  function createFloatingButton() {
    const button = document.createElement("button");
    button.id = "pdn-floating-button";
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    `;

    // Styles for floating button
    Object.assign(button.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      backgroundColor: "#0E6F78",
      color: "white",
      border: "none",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
      fontSize: "14px",
      fontWeight: "bold",
    });

    button.onmouseenter = () => {
      button.style.transform = "scale(1.1)";
      button.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
    };
    button.onmouseleave = () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    };

    return button;
  }

  function createFloatingWidget(product) {
    const container = document.createElement("div");
    container.id = "pdn-floating-widget";

    // Styles for floating widget container
    Object.assign(container.style, {
      position: "fixed",
      bottom: "92px",
      right: "24px",
      width: "380px",
      maxWidth: "calc(100vw - 48px)",
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
      zIndex: "999998",
      display: "none",
      flexDirection: "column",
      overflow: "hidden",
      transition: "all 0.3s ease",
    });

    // Header with close button
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "16px",
      backgroundColor: "#0E6F78",
      color: "white",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    });

    const title = document.createElement("div");
    title.textContent = "💰 Price Drop Alert";
    title.style.fontWeight = "600";
    title.style.fontSize = "16px";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      color: "white",
      fontSize: "28px",
      cursor: "pointer",
      lineHeight: "1",
      padding: "0",
      width: "24px",
      height: "24px",
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content area - inline widget (no iframe)
    const content = document.createElement("div");
    content.id = "pdn-widget-content";
    Object.assign(content.style, {
      padding: "16px",
      fontFamily: "Arial, Helvetica, sans-serif",
    });

    // Create inline form widget
    content.innerHTML = `
      <form id="pdn-inline-form" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 13px; color: #6B7280; margin-bottom: 4px;">
          <div style="margin-bottom: 8px;"><strong>Product:</strong> ${product.name.substring(0, 80)}${product.name.length > 80 ? "..." : ""}</div>
          <div style="margin-bottom: 8px;"><strong>Current Price:</strong> ${product.price}</div>
        </div>
        <label style="font-size: 14px; color: #111827; font-weight: 500;">Email me if price drops:</label>
        <div style="display: flex; gap: 8px;">
          <input 
            type="email" 
            id="pdn-email-input" 
            placeholder="you@example.com" 
            required
            style="flex: 1; padding: 10px; border: 1px solid #D8DEE3; border-radius: 6px; font-size: 14px;"
          />
          <button 
            type="submit" 
            id="pdn-submit-btn"
            style="background: #0E6F78; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; white-space: nowrap;"
          >Notify me</button>
        </div>
        <div id="pdn-status" style="font-size: 13px; color: #6B7280; min-height: 18px;"></div>
      </form>
    `;

    container.appendChild(header);
    container.appendChild(content);

    return { container, content, closeBtn };
  }

  function inject() {
    const product = extract();

    // Create floating button
    const floatingButton = createFloatingButton();
    document.body.appendChild(floatingButton);

    // Create floating widget with inline form
    const {
      container: floatingWidget,
      content,
      closeBtn,
    } = createFloatingWidget(product);
    document.body.appendChild(floatingWidget);

    // Get form elements
    const form = content.querySelector("#pdn-inline-form");
    const emailInput = content.querySelector("#pdn-email-input");
    const submitBtn = content.querySelector("#pdn-submit-btn");
    const statusDiv = content.querySelector("#pdn-status");

    // Form submission handler
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();

      if (!email) {
        statusDiv.textContent = "Please enter an email.";
        statusDiv.style.color = "#EF4444";
        return;
      }

      // Show loading state
      statusDiv.textContent = "Submitting...";
      statusDiv.style.color = "#6B7280";
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.6";

      // Use GM_xmlhttpRequest to bypass CSP restrictions
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

            if (result && result.ok) {
              statusDiv.textContent =
                "✓ Subscribed! We'll email you if price drops.";
              statusDiv.style.color = "#10B981";
              emailInput.value = "";

              // Reset after 3 seconds
              setTimeout(() => {
                statusDiv.textContent = "";
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
              }, 3000);
            } else if (result && result.error) {
              if (result.error === "already_subscribed") {
                statusDiv.textContent = "Already subscribed to this product!";
              } else {
                statusDiv.textContent = "Error: " + result.error;
              }
              statusDiv.style.color = "#EF4444";
              submitBtn.disabled = false;
              submitBtn.style.opacity = "1";
            } else {
              statusDiv.textContent = "Unexpected response";
              statusDiv.style.color = "#EF4444";
              submitBtn.disabled = false;
              submitBtn.style.opacity = "1";
            }
          } catch (error) {
            statusDiv.textContent = "Failed to parse server response";
            statusDiv.style.color = "#EF4444";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            console.error("Price Drop Notifier parse error:", error);
          }
        },
        onerror: function (error) {
          statusDiv.textContent = "Network error. Is the server running?";
          statusDiv.style.color = "#EF4444";
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          console.error("Price Drop Notifier network error:", error);
        },
      });
    });

    // Toggle widget visibility
    let isOpen = false;
    floatingButton.onclick = () => {
      isOpen = !isOpen;
      if (isOpen) {
        floatingWidget.style.display = "flex";
        setTimeout(() => {
          floatingWidget.style.opacity = "1";
          floatingWidget.style.transform = "translateY(0)";
        }, 10);
      } else {
        floatingWidget.style.opacity = "0";
        floatingWidget.style.transform = "translateY(20px)";
        setTimeout(() => {
          floatingWidget.style.display = "none";
        }, 300);
      }
    };

    closeBtn.onclick = () => {
      isOpen = false;
      floatingWidget.style.opacity = "0";
      floatingWidget.style.transform = "translateY(20px)";
      setTimeout(() => {
        floatingWidget.style.display = "none";
      }, 300);
    };

    // Initial state for animation
    floatingWidget.style.opacity = "0";
    floatingWidget.style.transform = "translateY(20px)";
  }

  // wait for DOM ready-ish
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
