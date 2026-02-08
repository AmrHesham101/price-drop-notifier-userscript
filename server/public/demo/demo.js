// Demo Page Script - CSP Compliant (No inline scripts)

(function () {
  "use strict";

  let extractedProduct = null;

  // Extract product from URL using server API
  async function extractProduct(url) {
    const statusDiv = document.getElementById("extract-status");
    const extractBtn = document.getElementById("extract-btn");
    const productCard = document.getElementById("product-card");

    try {
      statusDiv.textContent = "Extracting product info...";
      statusDiv.className = "extract-status loading";
      extractBtn.disabled = true;
      extractBtn.textContent = "Loading...";

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (result.ok && result.product) {
        extractedProduct = result.product;

        // Check if price extraction failed
        const priceDigits = result.product.price.replace(/[^0-9]/g, "");
        if (
          result.product.price.toLowerCase() === "unknown" ||
          priceDigits.length === 0 ||
          parseInt(priceDigits, 10) === 0 ||
          /^[^a-zA-Z0-9]+$/.test(result.product.price)
        ) {
          statusDiv.textContent =
            "⚠️ Unable to extract valid price from this page. Cannot subscribe.";
          statusDiv.className = "extract-status error";

          // Hide product card and clear widget
          productCard.classList.remove("visible");
          const widgetContainer = document.getElementById("widget-container");
          if (widgetContainer) {
            widgetContainer.innerHTML = "";
          }

          extractBtn.disabled = false;
          extractBtn.textContent = "Load Product";
          return;
        }

        // Update product display
        document.getElementById("product-title").textContent =
          result.product.name;
        document.getElementById("product-price").textContent =
          result.product.price;
        document.getElementById("product-link").href = result.product.url;

        // Show product card
        productCard.classList.add("visible");

        statusDiv.textContent = "✓ Product loaded successfully!";
        statusDiv.className = "extract-status success";

        // Initialize widget with extracted product
        initWidget(result.product);

        setTimeout(() => {
          statusDiv.textContent = "";
        }, 3000);
      } else {
        throw new Error(result.error || "Failed to extract product");
      }
    } catch (error) {
      statusDiv.textContent = "✗ Error: " + error.message;
      statusDiv.className = "extract-status error";

      // Hide product card and clear widget on error
      productCard.classList.remove("visible");
      const widgetContainer = document.getElementById("widget-container");
      if (widgetContainer) {
        widgetContainer.innerHTML = "";
      }

      console.error("Extraction error:", error);
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = "Load Product";
    }
  }

  // Initialize widget with product data
  function initWidget(product) {
    if (typeof window.PriceDropWidget !== "undefined") {
      const container = document.getElementById("widget-container");

      if (container) {
        // Clear previous widget
        container.innerHTML = "";

        // Initialize the widget with extracted product (pass as options object)
        window.PriceDropWidget.init(container, {
          product: product || extractedProduct,
        });
        console.log("✅ Widget initialized with product:", product);
      }
    } else {
      console.warn("⚠️ Widget not loaded yet, retrying...");
      setTimeout(() => initWidget(product), 500);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    const extractBtn = document.getElementById("extract-btn");
    const urlInput = document.getElementById("product-url");

    if (extractBtn && urlInput) {
      extractBtn.addEventListener("click", () => {
        const url = urlInput.value.trim();
        if (url) {
          extractProduct(url);
        } else {
          const status = document.getElementById("extract-status");
          status.textContent = "Please enter a URL";
          status.className = "extract-status error";
        }
      });

      // Allow pressing Enter in input to trigger extraction
      urlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          extractBtn.click();
        }
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setupEventListeners();
      // Auto-load the default URL
      const urlInput = document.getElementById("product-url");
      if (urlInput && urlInput.value) {
        document.getElementById("extract-btn").click();
      }
    });
  } else {
    setupEventListeners();
    // Auto-load the default URL
    const urlInput = document.getElementById("product-url");
    if (urlInput && urlInput.value) {
      document.getElementById("extract-btn").click();
    }
  }

  // Add CSP violation listener for debugging
  document.addEventListener("securitypolicyviolation", (e) => {
    console.error("🔒 CSP Violation:", {
      violatedDirective: e.violatedDirective,
      blockedURI: e.blockedURI,
      documentURI: e.documentURI,
    });
  });
})();
