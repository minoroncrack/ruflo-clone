/**
 * Alert dispatcher — email (rich HTML) + ntfy.sh (click/attach/markdown).
 * All config from environment variables only.
 */

import nodemailer from 'nodemailer';
import { recordFeed } from './feed.mjs';
import { renderAlertHtml } from './templates.mjs';

function cfg() {
  return {
    smtpHost:  process.env.SMTP_HOST,
    smtpPort:  Number(process.env.SMTP_PORT ?? 587),
    smtpUser:  process.env.SMTP_USER,
    smtpPass:  process.env.SMTP_PASS,
    emailTo:   process.env.ALERT_EMAIL_TO,
    emailFrom: process.env.ALERT_EMAIL_FROM ?? process.env.SMTP_USER,
    ntfyTopic: process.env.NTFY_TOPIC,
  };
}

async function sendEmail(c, subject, body, html) {
  if (!c.smtpHost || !c.smtpUser || !c.smtpPass || !c.emailTo) return;
  const t = nodemailer.createTransport({
    host: c.smtpHost, port: c.smtpPort,
    secure: c.smtpPort === 465,
    auth: { user: c.smtpUser, pass: c.smtpPass },
    // Without these an unresponsive SMTP peer stalls dispatch() indefinitely.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await t.sendMail({ from: c.emailFrom, to: c.emailTo, subject, text: body, html });
}

async function sendNtfy(c, subject, body, opts) {
  if (!c.ntfyTopic) return;
  // JSON publish endpoint (not header-based) so UTF-8/emoji in the title survives —
  // HTTP headers are restricted to ISO-8859-1 and throw on emoji otherwise.
  // Bounded so a stalled ntfy connection cannot wedge dispatch() — the email
  // has already been sent by the time this runs, and Promise.all would hang.
  await fetch('https://ntfy.sh', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: c.ntfyTopic,
      title: subject,
      message: body,
      priority: 5,
      markdown: true,
      tags: opts.tags ?? ['rotating_light', 'chart_with_upwards_trend'],
      ...(opts.link  ? { click: opts.link }   : {}),
      ...(opts.image ? { attach: opts.image } : {}),
    }),
  });
}

/**
 * dispatch(subject, body, opts?)
 * opts: { headline, emoji, scoreLabel, direction, source, timestamp, quote,
 *         tickers, keywords, link, image, tags }
 * All opts fields are optional — omit for a plain-text-style email/notification.
 */
export async function dispatch(subject, body, opts = {}) {
  const c = cfg();
  console.log(`\n${'='.repeat(60)}\n${subject}\n${'='.repeat(60)}\n${body}\n${'='.repeat(60)}\n`);
  recordFeed(subject, body, opts);
  const html = renderAlertHtml({ headline: opts.headline ?? subject, quote: body, ...opts });
  await Promise.all([
    sendEmail(c, subject, body, html).catch(e => console.error('Email failed:', e.message)),
    sendNtfy(c, subject, body, opts).catch(e => console.error('ntfy failed:', e.message)),
  ]);
}
