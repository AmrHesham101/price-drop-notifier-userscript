/**
 * Email service
 *
 * Wraps Nodemailer initialization and provides a single function to send
 * price-drop notification emails. In development the service uses
 * Ethereal test accounts so emails can be previewed in-browser.
 */
import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let etherealAccountInfo: any = null;

/**
 * Initialize the email transporter. Uses Nodemailer's test account when
 * no production SMTP configuration is provided.
 */
export async function initEmailService() {
    try {
        const account = await nodemailer.createTestAccount();
        etherealAccountInfo = account;

        transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: account.user,
                pass: account.pass,
            },
        });

        console.log('✓ Email service initialized (Ethereal test account)');
        console.log('  Preview emails at: https://ethereal.email');
    } catch (error) {
        console.warn('✗ Failed to initialize email service:', error);
        transporter = null;
    }
}

/** Payload for the price-drop email */
export interface PriceDropEmail {
    to: string;
    productName: string;
    productUrl: string;
    oldPrice: number;
    newPrice: number;
}

/**
 * Send a formatted price-drop notification email.
 * Returns an Ethereal preview URL in development, or null otherwise.
 */
export async function sendPriceDropEmail(data: PriceDropEmail): Promise<string | null> {
    if (!transporter) {
        console.log(`[Email disabled] Would send to ${data.to}: ${data.productName} dropped from ${data.oldPrice} to ${data.newPrice}`);
        return null;
    }

    try {
        const info = await transporter.sendMail({
            from: 'Price Drop Notifier <no-reply@example.com>',
            to: data.to,
            subject: `🔔 Price Drop Alert: ${data.productName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0E6F78;">Price Drop Detected! 🎉</h2>
                    <p><strong>${data.productName}</strong></p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p style="margin: 8px 0;">
                            <span style="text-decoration: line-through; color: #6B7280;">Old Price: $${data.oldPrice.toFixed(2)}</span>
                        </p>
                        <p style="margin: 8px 0; color: #10B981; font-size: 18px; font-weight: bold;">
                            New Price: $${data.newPrice.toFixed(2)}
                        </p>
                        <p style="margin: 8px 0; color: #0E6F78; font-weight: bold;">
                            You save: $${(data.oldPrice - data.newPrice).toFixed(2)} (${(((data.oldPrice - data.newPrice) / data.oldPrice) * 100).toFixed(1)}%)
                        </p>
                    </div>
                    <a href="${data.productUrl}" 
                       style="display: inline-block; background: #0E6F78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                        View Product
                    </a>
                    <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">
                        You're receiving this because you subscribed to price drop notifications for this product.
                    </p>
                </div>
            `,
            text: `
Price Drop Alert!

${data.productName}

Old Price: $${data.oldPrice.toFixed(2)}
New Price: $${data.newPrice.toFixed(2)}
You save: $${(data.oldPrice - data.newPrice).toFixed(2)}

View product: ${data.productUrl}
            `.trim(),
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`✓ Email sent to ${data.to}. Preview: ${previewUrl}`);
        return previewUrl as string;
    } catch (error) {
        console.error('Failed to send email:', error);
        return null;
    }
}
