/**
 * @charsoft/mailgun-email
 *
 * Shared Mailgun email service for all Charsoft Training Partners apps.
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

import Mailgun from 'mailgun.js';
import formData from 'form-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  attachments?: Attachment[];
  /** Custom Mailgun tags for analytics */
  tags?: string[];
  /** Custom variables (appear in webhooks/events) */
  variables?: Record<string, string>;
}

export interface Attachment {
  /** Original filename */
  filename: string;
  /** File content — Buffer or readable stream */
  data: Buffer | NodeJS.ReadableStream;
  /** MIME type (optional, auto-detected if omitted) */
  contentType?: string;
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

// ---------------------------------------------------------------------------
// Domain routing
// ---------------------------------------------------------------------------

/**
 * Map of sender-address domain patterns to Mailgun sending domains.
 * The "from" address domain is matched against these patterns.
 */
const DOMAIN_MAP: Record<string, string> = {
  'charsoft.com':    'mg.charsoft.com',
  'mg.charsoft.com': 'mg.charsoft.com',

  'charsoft.ai':     'mg.charsoft.ai',
  'mg.charsoft.ai':  'mg.charsoft.ai',

  'cslleesburg.org':    'mg.cslleesburg.org',
  'mg.cslleesburg.org': 'mg.cslleesburg.org',
};

/**
 * Extract the Mailgun sending domain from a "from" address.
 *
 * Accepts formats like:
 *   - "user@charsoft.com"
 *   - "Display Name <user@mg.charsoft.ai>"
 */
function resolveDomain(from: string, defaultDomain?: string): string {
  const match = from.match(/@([a-zA-Z0-9.-]+)/);
  if (!match) {
    if (defaultDomain) return defaultDomain;
    throw new Error(
      `[mailgun-email] Cannot extract domain from "from" address: "${from}". ` +
      `Provide a valid email or set defaultDomain in config.`
    );
  }

  const senderDomain = match[1].toLowerCase();
  const mgDomain = DOMAIN_MAP[senderDomain];

  if (mgDomain) return mgDomain;
  if (defaultDomain) return defaultDomain;

  throw new Error(
    `[mailgun-email] Unknown sender domain "${senderDomain}". ` +
    `Known domains: ${Object.keys(DOMAIN_MAP).join(', ')}. ` +
    `Either use a known domain in your "from" address or set defaultDomain in config.`
  );
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let mgClient: ReturnType<InstanceType<typeof Mailgun>['client']> | null = null;
let currentConfig: MailgunConfig = { logging: true };

/**
 * Explicitly initialise the Mailgun client.
 * If you don't call this, sendEmail() will auto-init from env vars.
 */
export function initMailgun(config: MailgunConfig = {}): void {
  const apiKey = config.apiKey || process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    throw new Error(
      '[mailgun-email] No API key provided. ' +
      'Either pass apiKey in config or set MAILGUN_API_KEY environment variable.'
    );
  }

  const region = config.region || (process.env.MAILGUN_API_REGION as 'us' | 'eu') || 'us';

  const mg = new Mailgun(formData);
  mgClient = mg.client({
    username: 'api',
    key: apiKey,
    url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
  });

  currentConfig = { ...config, apiKey, region, logging: config.logging ?? true };

  if (currentConfig.logging) {
    console.log(`[mailgun-email] Initialised (region: ${region})`);
  }
}

/** Ensure the client is initialised, auto-init if needed. */
function ensureClient(): NonNullable<typeof mgClient> {
  if (!mgClient) {
    initMailgun();
  }
  return mgClient!;
}

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

/**
 * Send an email through Mailgun.
 *
 * The sending domain is automatically resolved from the "from" address:
 *   - *@charsoft.com  or *@mg.charsoft.com  → mg.charsoft.com
 *   - *@charsoft.ai   or *@mg.charsoft.ai   → mg.charsoft.ai
 *   - *@cslleesburg.org or *@mg.cslleesburg.org → mg.cslleesburg.org
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const client = ensureClient();
  const domain = resolveDomain(message.from, currentConfig.defaultDomain);

  // Build the Mailgun message payload
  const payload: Record<string, any> = {
    from: message.from,
    to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
    subject: message.subject,
  };

  if (message.html) payload.html = message.html;
  if (message.text) payload.text = message.text;
  if (message.cc) payload.cc = Array.isArray(message.cc) ? message.cc.join(', ') : message.cc;
  if (message.bcc) payload.bcc = Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc;
  if (message.replyTo) payload['h:Reply-To'] = message.replyTo;

  // Tags for Mailgun analytics
  if (message.tags?.length) {
    payload['o:tag'] = message.tags;
  }

  // Custom variables (visible in Mailgun events/webhooks)
  if (message.variables) {
    for (const [key, value] of Object.entries(message.variables)) {
      payload[`v:${key}`] = value;
    }
  }

  // Attachments
  if (message.attachments?.length) {
    payload.attachment = message.attachments.map((att) => ({
      filename: att.filename,
      data: att.data,
      ...(att.contentType ? { contentType: att.contentType } : {}),
    }));
  }

  try {
    const result = await client.messages.create(domain, payload as any);

    if (currentConfig.logging) {
      const toStr = Array.isArray(message.to) ? message.to[0] : message.to;
      console.log(`[mailgun-email] Sent via ${domain} → ${toStr} | ${result.id || 'ok'}`);
    }

    return {
      ok: true,
      id: result.id,
      message: result.message || 'Queued',
    };
  } catch (err: any) {
    const errorMessage = err?.message || err?.details || String(err);

    if (currentConfig.logging) {
      console.error(`[mailgun-email] FAILED via ${domain}: ${errorMessage}`);
    }

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Send from Charsoft (mg.charsoft.com).
 * Shorthand that sets the "from" domain automatically.
 */
export function sendFromCharsoft(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'Charsoft';
  return sendEmail({ ...message, from: `${name} <${user}@mg.charsoft.com>` });
}

/**
 * Send from Charsoft AI (mg.charsoft.ai).
 */
export function sendFromCharsoftAI(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'Charsoft AI';
  return sendEmail({ ...message, from: `${name} <${user}@mg.charsoft.ai>` });
}

/**
 * Send from CSL Leesburg (mg.cslleesburg.org).
 */
export function sendFromCSL(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'CSL Leesburg';
  return sendEmail({ ...message, from: `${name} <${user}@mg.cslleesburg.org>` });
}

// Re-export for convenience
export { resolveDomain };
