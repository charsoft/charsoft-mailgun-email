/**
 * @charsoft/mailgun-email
 *
 * Shared Mailgun email service for all Charsoft Training Partners apps.
 * Uses native fetch — no mailgun.js dependency needed.
 *
 * Usage:
 *   import { sendEmail, initMailgun } from '@charsoft/mailgun-email';
 *
 *   // Option A: auto-init from MAILGUN_API_KEY env var (default)
 *   await sendEmail({
 *     from: 'Charsoft <noreply@mg.charsoft.com>',
 *     to: 'user@example.com',
 *     subject: 'Hello',
 *     html: '<h1>Hi!</h1>',
 *   });
 *
 *   // Option B: explicit init (e.g. for tests or custom config)
 *   initMailgun({ apiKey: 'key-xxx', region: 'us' });
 */
export interface EmailMessage {
    /** Sender, e.g. "Charsoft <noreply@mg.charsoft.com>" */
    from: string;
    /** Recipient(s) — string or array */
    to: string | string[];
    /** Subject line */
    subject: string;
    /** HTML body */
    html?: string;
    /** Plain-text body (fallback) */
    text?: string;
    /** CC recipients */
    cc?: string | string[];
    /** BCC recipients */
    bcc?: string | string[];
    /** Reply-To address */
    replyTo?: string;
    /** File attachments */
    attachments?: Array<{
        filename: string;
        data: Buffer | Blob;
        contentType?: string;
    }>;
    /** Custom Mailgun tags for analytics */
    tags?: string[];
    /** Custom variables (appear in webhooks/events) */
    variables?: Record<string, string>;
}
export interface MailgunConfig {
    /** Mailgun API key (defaults to process.env.MAILGUN_API_KEY) */
    apiKey?: string;
    /** API region: 'us' (default) or 'eu' */
    region?: 'us' | 'eu';
    /** Override domain routing (optional — normally auto-detected from "from") */
    defaultDomain?: string;
    /** Enable console logging (default: true) */
    logging?: boolean;
}
export interface SendResult {
    ok: boolean;
    id?: string;
    message?: string;
    error?: string;
}
declare function resolveDomain(from: string, defaultDomain?: string): string;
export declare function initMailgun(config?: MailgunConfig): void;
export declare function sendEmail(message: EmailMessage): Promise<SendResult>;
export declare function sendFromCharsoft(message: Omit<EmailMessage, 'from'> & {
    fromName?: string;
    fromUser?: string;
}): Promise<SendResult>;
export declare function sendFromCharsoftAI(message: Omit<EmailMessage, 'from'> & {
    fromName?: string;
    fromUser?: string;
}): Promise<SendResult>;
export declare function sendFromCSL(message: Omit<EmailMessage, 'from'> & {
    fromName?: string;
    fromUser?: string;
}): Promise<SendResult>;
export { resolveDomain };
//# sourceMappingURL=index.d.ts.map