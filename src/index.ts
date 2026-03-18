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

// ---------------------------------------------------------------------------
// Domain routing
// ---------------------------------------------------------------------------

const DOMAIN_MAP: Record<string, string> = {
  'charsoft.com':       'mg.charsoft.com',
  'mg.charsoft.com':    'mg.charsoft.com',
  'charsoft.ai':        'mg.charsoft.ai',
  'mg.charsoft.ai':     'mg.charsoft.ai',
  'cslleesburg.org':    'mg.cslleesburg.org',
  'mg.cslleesburg.org': 'mg.cslleesburg.org',
};

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
// Config singleton
// ---------------------------------------------------------------------------

let currentConfig: Required<Pick<MailgunConfig, 'region' | 'logging'>> & { apiKey?: string; defaultDomain?: string } = {
  region: 'us',
  logging: true,
};
let isInitialized = false;

export function initMailgun(config: MailgunConfig = {}): void {
  const apiKey = config.apiKey || process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[mailgun-email] No API key provided. ' +
      'Either pass apiKey in config or set MAILGUN_API_KEY environment variable.'
    );
  }

  currentConfig = {
    apiKey,
    region: config.region || (process.env.MAILGUN_API_REGION as 'us' | 'eu') || 'us',
    defaultDomain: config.defaultDomain,
    logging: config.logging ?? true,
  };
  isInitialized = true;

  if (currentConfig.logging) {
    console.log(`[mailgun-email] Initialised (region: ${currentConfig.region})`);
  }
}

function ensureConfig(): string {
  if (!isInitialized) initMailgun();
  return currentConfig.apiKey!;
}

// ---------------------------------------------------------------------------
// sendEmail — native fetch, no dependencies
// ---------------------------------------------------------------------------

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = ensureConfig();
  const domain = resolveDomain(message.from, currentConfig.defaultDomain);
  const baseUrl = currentConfig.region === 'eu'
    ? 'https://api.eu.mailgun.net'
    : 'https://api.mailgun.net';

  // Use FormData when attachments present, URLSearchParams otherwise
  const hasAttachments = message.attachments && message.attachments.length > 0;
  let body: FormData | URLSearchParams;

  if (hasAttachments) {
    const form = new FormData();
    form.append('from', message.from);
    form.append('to', Array.isArray(message.to) ? message.to.join(', ') : message.to);
    form.append('subject', message.subject);
    if (message.html) form.append('html', message.html);
    if (message.text) form.append('text', message.text);
    if (message.cc) form.append('cc', Array.isArray(message.cc) ? message.cc.join(', ') : message.cc);
    if (message.bcc) form.append('bcc', Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc);
    if (message.replyTo) form.append('h:Reply-To', message.replyTo);
    if (message.tags?.length) {
      for (const tag of message.tags) form.append('o:tag', tag);
    }
    if (message.variables) {
      for (const [key, value] of Object.entries(message.variables)) form.append(`v:${key}`, value);
    }
    for (const att of message.attachments!) {
      const blob = att.data instanceof Blob ? att.data : new Blob([new Uint8Array(att.data)], { type: att.contentType || 'application/octet-stream' });
      form.append('attachment', blob, att.filename);
    }
    body = form;
  } else {
    const form = new URLSearchParams();
    form.append('from', message.from);
    form.append('to', Array.isArray(message.to) ? message.to.join(', ') : message.to);
    form.append('subject', message.subject);
    if (message.html) form.append('html', message.html);
    if (message.text) form.append('text', message.text);
    if (message.cc) form.append('cc', Array.isArray(message.cc) ? message.cc.join(', ') : message.cc);
    if (message.bcc) form.append('bcc', Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc);
    if (message.replyTo) form.append('h:Reply-To', message.replyTo);
    if (message.tags?.length) {
      for (const tag of message.tags) form.append('o:tag', tag);
    }
    if (message.variables) {
      for (const [key, value] of Object.entries(message.variables)) form.append(`v:${key}`, value);
    }
    body = form;
  }

  try {
    const resp = await fetch(`${baseUrl}/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      },
      body,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (currentConfig.logging) {
        console.error(`[mailgun-email] FAILED via ${domain} (${resp.status}): ${errText}`);
      }
      return { ok: false, error: `${resp.status}: ${errText}` };
    }

    const data = await resp.json() as { id?: string; message?: string };

    if (currentConfig.logging) {
      const toStr = Array.isArray(message.to) ? message.to[0] : message.to;
      console.log(`[mailgun-email] Sent via ${domain} → ${toStr} | ${data.id || 'ok'}`);
    }

    return { ok: true, id: data.id, message: data.message || 'Queued' };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    if (currentConfig.logging) {
      console.error(`[mailgun-email] FAILED via ${domain}: ${errorMessage}`);
    }
    return { ok: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function sendFromCharsoft(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'Charsoft';
  return sendEmail({ ...message, from: `${name} <${user}@mg.charsoft.com>` });
}

export function sendFromCharsoftAI(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'Charsoft AI';
  return sendEmail({ ...message, from: `${name} <${user}@mg.charsoft.ai>` });
}

export function sendFromCSL(
  message: Omit<EmailMessage, 'from'> & { fromName?: string; fromUser?: string }
): Promise<SendResult> {
  const user = message.fromUser || 'noreply';
  const name = message.fromName || 'CSL Leesburg';
  return sendEmail({ ...message, from: `${name} <${user}@mg.cslleesburg.org>` });
}

export { resolveDomain };
