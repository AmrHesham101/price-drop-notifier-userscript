import { Subscription } from '../models/Subscription.model';
import { fetchCurrentPrice } from './scraper.service';
import { sendPriceDropEmail } from './email.service';
import { parsePriceString } from '../utils';
import { NOTIFIER_INTERVAL } from '../config/constants';

let notifierInterval: NodeJS.Timeout | null = null;

export async function checkPriceDrops() {
    try {
        const subscriptions = await Subscription.find({});

        if (subscriptions.length === 0) {
            console.log('No subscriptions to check');
            return { checked: 0, notified: 0 };
        }

        console.log(`Checking ${subscriptions.length} subscriptions for price drops...`);
        let notified = 0;

        for (const sub of subscriptions) {
            try {
                const currentPrice = await fetchCurrentPrice(sub.product.url);
                const claimedPrice = parsePriceString(sub.product.price);
                const lastSeenPrice = sub.product.lastSeenPrice ?? claimedPrice;

                if (currentPrice == null || lastSeenPrice == null) {
                    console.log(`Skipping ${sub.product.url} - unable to compare prices`);
                    continue;
                }

                // Update last seen price
                if (currentPrice !== lastSeenPrice) {
                    sub.product.lastSeenPrice = currentPrice;
                    await sub.save();
                }

                // Check for price drop
                if (currentPrice < lastSeenPrice) {
                    console.log(`Price drop detected for ${sub.product.name}: ${lastSeenPrice} → ${currentPrice}`);

                    await sendPriceDropEmail({
                        to: sub.email,
                        productName: sub.product.name,
                        productUrl: sub.product.url,
                        oldPrice: lastSeenPrice,
                        newPrice: currentPrice,
                    });

                    notified++;
                }
            } catch (error) {
                console.error(`Error checking subscription ${sub._id}:`, error);
            }
        }

        console.log(`Price check complete. Checked: ${subscriptions.length}, Notified: ${notified}`);
        return { checked: subscriptions.length, notified };
    } catch (error) {
        console.error('Error in checkPriceDrops:', error);
        throw error;
    }
}

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

export function stopPeriodicChecks() {
    if (notifierInterval) {
        clearInterval(notifierInterval);
        notifierInterval = null;
        console.log('Periodic price checks stopped');
    }
}
