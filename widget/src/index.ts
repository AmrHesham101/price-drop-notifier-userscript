const CSS_CLASS = 'pdn-widget-root';

// Server URL - change for production deployment
const SERVER_URL = 'http://localhost:3000';

type Product = { name: string; price: string; url: string };

// In-memory email storage
let savedEmailInMemory = '';

function createRoot() {
    const root = document.createElement('div');
    root.className = CSS_CLASS;
    root.innerHTML = `
    <form class="pdn-form" novalidate>
      <label class="pdn-label">Email me if this product gets cheaper</label>
      <div class="pdn-row">
        <input class="pdn-input" type="email" name="email" placeholder="you@example.com" required />
        <button class="pdn-btn" type="submit">Notify me</button>
      </div>
      <div class="pdn-status" aria-live="polite"></div>
    </form>
  `;
    return root;
}

function applyStyles() {
    if (document.getElementById('pdn-widget-styles')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${SERVER_URL}/build/price-drop-widget.min.css`;
    link.id = 'pdn-widget-styles';
    document.head.appendChild(link);
}

function parseProductFromPage(): Product {
    const url = location.href;

    // Title extraction - Amazon and eBay specific
    const amazonTitle = document.querySelector('#productTitle');
    const ebayTitle = document.querySelector('.x-item-title__mainTitle, #itemTitle, .it-ttl');
    const genericTitle = document.querySelector('h1, h2');
    const name = (amazonTitle?.textContent || ebayTitle?.textContent || genericTitle?.textContent || document.title).trim();

    // Price selectors - Amazon and eBay specific
    const priceSelectors = [
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#corePrice_desktop .a-price .a-offscreen',
        '.priceToPay .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        '.x-price-primary .ux-textspans',
        '.x-price-primary',
        '#prcIsum',
        '.display-price',
        '.notranslate',
        '.price'
    ];

    let price = '';
    for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && (el.textContent || '').trim()) {
            price = (el.textContent || '').trim();
            break;
        }
    }
    if (!price) price = 'unknown';
    return { name, price, url };
}

async function postSubscribe(email: string, product: Product) {
    const endpoint = `${SERVER_URL}/subscribe-price-drop`;
    const payload = { email, product };

    // Regular fetch - userscript will intercept form submission before this runs on CSP sites
    console.log('[PDN Widget] Using regular fetch');
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    } catch (err) {
        throw err;
    }
}

export function init(container: HTMLElement | string, options?: { product?: Product }) {
    const mount = typeof container === 'string' ? document.querySelector(container) : container;
    if (!mount) return;
    applyStyles();
    const root = createRoot();
    mount.appendChild(root);

    const form = root.querySelector('form') as HTMLFormElement;
    const input = form.querySelector('input[name=email') as HTMLInputElement;
    const status = root.querySelector('.pdn-status') as HTMLElement;

    const product = options?.product ?? parseProductFromPage();

    // Restore saved email from memory
    if (savedEmailInMemory) {
        input.value = savedEmailInMemory;
    }

    // Save email to memory on input
    input.addEventListener('input', () => {
        const email = input.value.trim();
        if (email && email.includes('@')) {
            savedEmailInMemory = email;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = input.value.trim();
        if (!email) {
            status.textContent = 'Please enter an email.';
            root.classList.add('pdn-error');
            setTimeout(() => root.classList.remove('pdn-error'), 900);
            return;
        }
        status.textContent = 'Submitting...';
        root.classList.add('pdn-submitting');
        try {
            const json = await postSubscribe(email, product);
            if (json && json.ok) {
                status.textContent = '✓ Subscribed! We\'ll email you if price drops.';
                root.classList.add('pdn-success');

                // Keep success message, clear input after delay
                setTimeout(() => {
                    input.value = '';
                    status.textContent = '';
                    root.classList.remove('pdn-success');
                }, 3000);
            } else if (json && json.error) {
                if (json.error === 'already_subscribed') {
                    status.textContent = 'Already subscribed to this product!';
                } else {
                    status.textContent = 'Error: ' + json.error;
                }
                root.classList.add('pdn-error');
                setTimeout(() => {
                    root.classList.remove('pdn-error');
                    status.textContent = '';
                }, 3000);
            } else {
                status.textContent = 'Unexpected response';
                root.classList.add('pdn-error');
                setTimeout(() => {
                    root.classList.remove('pdn-error');
                    status.textContent = '';
                }, 3000);
            }
        } catch (err) {
            status.textContent = 'Network error';
            root.classList.add('pdn-error');
            setTimeout(() => {
                root.classList.remove('pdn-error');
                status.textContent = '';
            }, 3000);
        } finally {
            root.classList.remove('pdn-submitting');
        }
    });
}

/**
 * Initialize a floating button + widget (for userscript injection)
 * @param options - Product data to pre-fill
 */
export function initFloating(options?: { product?: Product }) {
    const product = options?.product ?? parseProductFromPage();

    // Create floating button
    const button = document.createElement('button');
    button.id = 'pdn-floating-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    `;

    Object.assign(button.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#0E6F78',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '999999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
    });

    button.onmouseenter = () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    };
    button.onmouseleave = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    };

    // Create floating widget container
    const container = document.createElement('div');
    container.id = 'pdn-floating-widget';
    Object.assign(container.style, {
        position: 'fixed',
        bottom: '92px',
        right: '24px',
        width: '380px',
        maxWidth: 'calc(100vw - 48px)',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        zIndex: '999998',
        display: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(20px)',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '16px',
        backgroundColor: '#0E6F78',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    });

    const title = document.createElement('div');
    title.textContent = '💰 Price Drop Alert';
    title.style.fontWeight = '600';
    title.style.fontSize = '16px';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    Object.assign(closeBtn.style, {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '28px',
        cursor: 'pointer',
        lineHeight: '1',
        padding: '0',
        width: '24px',
        height: '24px',
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content area
    const content = document.createElement('div');
    Object.assign(content.style, {
        padding: '16px',
        fontFamily: 'Arial, Helvetica, sans-serif',
    });

    // Create form
    content.innerHTML = `
      <form id="pdn-floating-form" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 13px; color: #6B7280; margin-bottom: 4px;">
          <div style="margin-bottom: 8px;"><strong>Product:</strong> ${product.name.substring(0, 80)}${product.name.length > 80 ? '...' : ''}</div>
          <div style="margin-bottom: 8px;"><strong>Current Price:</strong> ${product.price}</div>
        </div>
        <label style="font-size: 14px; color: #111827; font-weight: 500;">Email me if price drops:</label>
        <div style="display: flex; gap: 8px;">
          <input 
            type="email" 
            id="pdn-email-floating" 
            placeholder="you@example.com" 
            required
            style="flex: 1; padding: 10px; border: 1px solid #D8DEE3; border-radius: 6px; font-size: 14px;"
          />
          <button 
            type="submit" 
            id="pdn-submit-floating"
            style="background: #0E6F78; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; white-space: nowrap;"
          >Notify me</button>
        </div>
        <div id="pdn-status-floating" style="font-size: 13px; color: #6B7280; min-height: 18px;"></div>
      </form>
    `;

    container.appendChild(header);
    container.appendChild(content);
    document.body.appendChild(button);
    document.body.appendChild(container);

    // Get form elements
    const form = content.querySelector('#pdn-floating-form') as HTMLFormElement;
    const emailInput = content.querySelector('#pdn-email-floating') as HTMLInputElement;
    const submitBtn = content.querySelector('#pdn-submit-floating') as HTMLButtonElement;
    const statusDiv = content.querySelector('#pdn-status-floating') as HTMLElement;

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            statusDiv.textContent = 'Please enter an email.';
            statusDiv.style.color = '#EF4444';
            return;
        }

        statusDiv.textContent = 'Submitting...';
        statusDiv.style.color = '#6B7280';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';

        try {
            const result = await postSubscribe(email, product);

            if (result && result.ok) {
                statusDiv.textContent = '✓ Subscribed! We\'ll email you if price drops.';
                statusDiv.style.color = '#10B981';
                emailInput.value = '';

                setTimeout(() => {
                    statusDiv.textContent = '';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }, 3000);
            } else if (result && result.error) {
                if (result.error === 'already_subscribed') {
                    statusDiv.textContent = 'Already subscribed to this product!';
                } else {
                    statusDiv.textContent = 'Error: ' + result.error;
                }
                statusDiv.style.color = '#EF4444';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            } else {
                statusDiv.textContent = 'Unexpected response';
                statusDiv.style.color = '#EF4444';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        } catch (error) {
            statusDiv.textContent = 'Network error. Is the server running?';
            statusDiv.style.color = '#EF4444';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            console.error('Price Drop Notifier error:', error);
        }
    });

    // Toggle widget
    let isOpen = false;
    button.onclick = () => {
        isOpen = !isOpen;
        if (isOpen) {
            container.style.display = 'flex';
            setTimeout(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            }, 10);
        } else {
            container.style.opacity = '0';
            container.style.transform = 'translateY(20px)';
            setTimeout(() => {
                container.style.display = 'none';
            }, 300);
        }
    };

    closeBtn.onclick = () => {
        isOpen = false;
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        setTimeout(() => {
            container.style.display = 'none';
        }, 300);
    };
}

// Expose to global for IIFE build
if (typeof window !== 'undefined') {
    (window as any).PriceDropWidget = { init, initFloating, parseProductFromPage };
}
