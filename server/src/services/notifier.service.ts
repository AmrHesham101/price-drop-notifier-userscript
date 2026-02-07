/**
 * Notifier service
 *
 * Responsible for iterating over subscriptions, checking current prices,
 * updating the stored lastSeenPrice, and sending emails when a price drop
 * is detected.
 *
 * Uses cursor-based streaming, batch processing, per-domain rate limiting,
 * and intelligent scheduling to handle large volumes efficiently.
 */
import { Subscription } from '../models/Subscription.model';
import { fetchCurrentPrice } from './scraper.service';
import { sendPriceDropEmail } from './email.service';
import { parsePriceString, randomDelay } from '../utils';
import { NOTIFIER_INTERVAL, BATCH_SIZE, MIN_CHECK_INTERVAL, DOMAIN_DELAY_MS } from '../config/constants';

let notifierInterval: NodeJS.Timeout | null = null;

/**
 * Extract domain from URL for rate limiting purposes.
 * Used to group requests by hostname and enforce per-domain delays.
 * @param url - The product URL to extract domain from
 * @returns The hostname (e.g., 'www.amazon.com') or 'unknown' if invalid
 */
function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return 'unknown';
    }
}

/**
 * Check all subscriptions for price changes and notify users when prices drop.
 * Uses cursor-based iteration to avoid loading all documents into memory.
 * Processes in batches with delays to avoid triggering anti-bot measures.
 * Returns a summary object with counts for checked and notified subscriptions.
 */
export async function checkPriceDrops() {
    try {
        const now = new Date();
        const minCheckTime = new Date(now.getTime() - MIN_CHECK_INTERVAL);

        // Only check subscriptions that haven't been checked recently
        const query = {
            $or: [
                { lastCheckedAt: { $exists: false } },
                { lastCheckedAt: { $lt: minCheckTime } }
            ]
        };

        const totalCount = await Subscription.countDocuments(query);
        if (totalCount === 0) {
            console.log('No subscriptions ready to check');
            return { checked: 0, notified: 0 };
        }

        console.log(`Processing ${totalCount} subscriptions in batches of ${BATCH_SIZE}...`);
        let checked = 0;
        let notified = 0;
        let batchNum = 0;

        // Track last request time per domain for rate limiting
        const domainLastRequest = new Map<string, number>();

        // Use cursor to stream documents instead of loading all into memory
        const cursor = Subscription.find(query).cursor();

        let batch: any[] = [];
        for await (const sub of cursor) {
            batch.push(sub);

            // Process in batches
            if (batch.length >= BATCH_SIZE) {
                batchNum++;
                console.log(`Processing batch ${batchNum} (${batch.length} subscriptions)...`);
                const result = await processBatch(batch, domainLastRequest);
                checked += result.checked;
                notified += result.notified;
                batch = [];

                // Small delay between batches
                await randomDelay();
            }
        }

        // Process remaining subscriptions in final batch
        if (batch.length > 0) {
            batchNum++;
            console.log(`Processing final batch ${batchNum} (${batch.length} subscriptions)...`);
            const result = await processBatch(batch, domainLastRequest);
            checked += result.checked;
            notified += result.notified;
        }

        console.log(`Price check complete. Checked: ${checked}, Notified: ${notified}`);
        return { checked, notified };
    } catch (error) {
        console.error('Error in checkPriceDrops:', error);
        throw error;
    }
}

/**
 * Process a batch of subscriptions with per-domain rate limiting.
 * Enforces delays between requests to the same domain to avoid triggering
 * anti-bot detection. Updates lastCheckedAt for all processed subscriptions.
 * @param batch - Array of subscription documents to process
 * @param domainLastRequest - Map tracking last request timestamp per domain
 * @returns Object with counts of checked and notified subscriptions
 */
async function processBatch(
    batch: any[],
    domainLastRequest: Map<string, number>
): Promise<{ checked: number; notified: number }> {
    let checked = 0;
    let notified = 0;

    for (const sub of batch) {
        try {
            const domain = extractDomain(sub.product.url);
            const lastRequest = domainLastRequest.get(domain) || 0;
            const timeSinceLastRequest = Date.now() - lastRequest;

            // Rate limit: ensure minimum delay between requests to same domain
            if (timeSinceLastRequest < DOMAIN_DELAY_MS) {
                const waitTime = DOMAIN_DELAY_MS - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Random delay to appear more human-like
            await randomDelay();

            const currentPrice = await fetchCurrentPrice(sub.product.url);
            domainLastRequest.set(domain, Date.now());

            // Update lastCheckedAt regardless of result
            sub.lastCheckedAt = new Date();
            await sub.save();
            checked++;

            const claimedPrice = parsePriceString(sub.product.price);
            const lastSeenPrice = sub.product.lastSeenPrice ?? claimedPrice;

            if (currentPrice == null || lastSeenPrice == null) {
                console.log(`Skipping ${sub.product.url} - unable to compare prices`);
                continue;
            }

            // Persist the latest observed price for future comparisons
            if (currentPrice !== lastSeenPrice) {
                sub.product.lastSeenPrice = currentPrice;
                await sub.save();
            }

            // If the current price is lower, send a notification
            if (currentPrice < lastSeenPrice) {
                console.log(`Price drop detected for ${sub.product.name}: ${lastSeenPrice} → ${currentPrice}`);

                await sendPriceDropEmail({
                    to: sub.email,
                    productName: sub.product.name,
                    productUrl: sub.product.url,
                    oldPrice: lastSeenPrice,
                    newPrice: currentPrice,
                });

                // Track when we sent this notification
                sub.lastNotifiedAt = new Date();
                await sub.save();

                notified++;
            }
        } catch (error) {
            console.error(`Error checking subscription ${sub._id}:`, error);
        }
    }

    return { checked, notified };
}

/**
 * Start periodic price checks. Will run immediately and then every NOTIFIER_INTERVAL ms.
 * Calling twice will have no effect (singleton interval).
 */
export function startPeriodicChecks() {
    if (notifierInterval) {
        console.log('Notifier already running');
        return;
    }

    console.log(`Starting periodic price checks (every ${NOTIFIER_INTERVAL / 60000} minutes)`);

    // Run immediately on start
    checkPriceDrops().catch(err => console.error('Initial price check failed:', err));

    // Then run periodically
    notifierInterval = setInterval(() => {
        checkPriceDrops().catch(err => console.error('Periodic price check failed:', err));
    }, NOTIFIER_INTERVAL);
}

/**
 * Stop the periodic checks if running.
 */
export function stopPeriodicChecks() {
    if (notifierInterval) {
        clearInterval(notifierInterval);
        notifierInterval = null;
        console.log('Periodic price checks stopped');
    }
}
