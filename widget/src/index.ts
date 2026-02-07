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

// Expose to global for IIFE build
if (typeof window !== 'undefined') {
    (window as any).PriceDropWidget = { init };
}
