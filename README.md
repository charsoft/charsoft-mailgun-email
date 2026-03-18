# @charsoft/mailgun-email

Shared Mailgun email service for all Charsoft Training Partners apps.

## Why

Instead of each app having its own Nodemailer + Gmail/SMTP setup, all apps share one Mailgun integration. One API key, one pattern, three sending domains.

## Install

```bash
# From the local source (recommended for private use)
npm install ../charsoft-mailgun-email

# Or via git URL in package.json
"@charsoft/mailgun-email": "file:../charsoft-mailgun-email"
```

## Quick Start

```js
import { sendEmail } from '@charsoft/mailgun-email';

// Domain is auto-detected from the "from" address
await sendEmail({
  from: 'Charsoft <noreply@mg.charsoft.com>',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello!</h1>',
});
```

## Domain Routing

The sending domain is automatically resolved from your `from` address:

| From address contains | Routes through |
|---|---|
| `@charsoft.com` or `@mg.charsoft.com` | `mg.charsoft.com` |
| `@charsoft.ai` or `@mg.charsoft.ai` | `mg.charsoft.ai` |
| `@cslleesburg.org` or `@mg.cslleesburg.org` | `mg.cslleesburg.org` |

## Convenience Helpers

```js
import { sendFromCharsoft, sendFromCharsoftAI, sendFromCSL } from '@charsoft/mailgun-email';

// These set the "from" domain automatically
await sendFromCharsoft({ to: '...', subject: '...', html: '...' });
await sendFromCharsoftAI({ to: '...', subject: '...', html: '...' });
await sendFromCSL({ to: '...', subject: '...', html: '...' });

// Customize the sender name/user
await sendFromCSL({
  fromName: 'CSL Conscious Giving',
  fromUser: 'giving',  // giving@mg.cslleesburg.org
  to: '...',
  subject: '...',
  html: '...',
});
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAILGUN_API_KEY` | Yes | — | Your Mailgun API key (same key works for all domains) |
| `MAILGUN_API_REGION` | No | `us` | API region: `us` or `eu` |

## Attachments

```js
import { sendEmail } from '@charsoft/mailgun-email';
import fs from 'fs';

await sendEmail({
  from: 'Charsoft AI <noreply@mg.charsoft.ai>',
  to: 'user@example.com',
  subject: 'Your report',
  html: '<p>See attached.</p>',
  attachments: [{
    filename: 'report.pdf',
    data: fs.readFileSync('./report.pdf'),
    contentType: 'application/pdf',
  }],
});
```

## Tags & Analytics

```js
await sendEmail({
  from: 'CSL Leesburg <noreply@mg.cslleesburg.org>',
  to: 'user@example.com',
  subject: 'Pledge Confirmation',
  html: '...',
  tags: ['pledge-confirmation', 'conscious-giving'],
  variables: { pledgeId: '12345' },
});
```

Tags appear in Mailgun analytics. Variables appear in webhook events.

## Migration Cheat Sheet

Replacing Nodemailer in an existing app:

1. `npm install @charsoft/mailgun-email`
2. `npm uninstall nodemailer`
3. Replace your `email.js` / `mailService.ts`:

**Before:**
```js
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { ... } });
await transporter.sendMail({ from, to, subject, html });
```

**After:**
```js
import { sendEmail } from '@charsoft/mailgun-email';
await sendEmail({ from: 'App Name <noreply@mg.charsoft.com>', to, subject, html });
```

4. Remove old env vars: `GMAIL_USER`, `GMAIL_PASSWORD`, `SMTP_HOST`, etc.
5. Add one env var: `MAILGUN_API_KEY`
6. Push. Done.
