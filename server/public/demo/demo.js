// Demo Page Script - CSP Compliant (No inline scripts)

(function() {
    'use strict';

    // Sample product data for demo
    const sampleProduct = {
        name: 'Xiaomi Redmi 15C Smartphone',
        price: '$299.99',
        url: window.location.href
    };

    // Wait for widget to load
    function initWidget() {
        if (typeof window.PriceDropWidget !== 'undefined') {
            const container = document.getElementById('widget-container');
            
            if (container) {
                // Initialize the widget with sample product
                window.PriceDropWidget.init(container, sampleProduct);
                console.log('✅ Widget initialized with demo product');
            }
        } else {
            console.warn('⚠️ Widget not loaded yet, retrying...');
            setTimeout(initWidget, 500);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        initWidget();
    }

    // Add CSP violation listener for debugging
    document.addEventListener('securitypolicyviolation', (e) => {
        console.error('🔒 CSP Violation:', {
            violatedDirective: e.violatedDirective,
            blockedURI: e.blockedURI,
            documentURI: e.documentURI
        });
    });

})();
