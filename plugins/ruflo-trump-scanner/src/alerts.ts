/**
 * Alert dispatcher.
 *
 * Supported channels:
 *  - Email (nodemailer / SMTP)
 *  - Webhook (POST to any URL — works with Zapier, Discord, Slack, ntfy.sh)
 *  - Console (always on)
 *
 * Configure via environment variables — no hardcoded credentials.
 */

import nodemailer from 'nodemailer';

export interface AlertConfig {
  // Email
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  emailTo?: string;
  emailFrom?: string;

  // Webhook
  webhookUrl?: string;   // POST JSON { subject, body } — Discord, Slack, ntfy, Zapier

  // ntfy.sh (simple push to phone)
  ntfyTopic?: string;    // e.g. "trump-scanner-abc123" → ntfy.sh/trump-scanner-abc123
}

function loadConfig(): AlertConfig {
  return {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    emailTo: process.env.ALERT_EMAIL_TO,
    emailFrom: process.env.ALERT_EMAIL_FROM ?? process.env.SMTP_USER,
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    ntfyTopic: process.env.NTFY_TOPIC,
  };
}

async function sendEmail(config: AlertConfig, subject: string, body: string): Promise<void> {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.emailTo) return;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });

  await transporter.sendMail({
    from: config.emailFrom,
    to: config.emailTo,
    subject,
    text: body,
  });
}

async function sendWebhook(config: AlertConfig, subject: string, body: string): Promise<void> {
  if (!config.webhookUrl) return;

  // Discord format
  if (config.webhookUrl.includes('discord.com')) {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${subject}**\n\`\`\`\n${body}\n\`\`\`` }),
    });
    return;
  }

  // Slack format
  if (config.webhookUrl.includes('hooks.slack.com')) {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${subject}*\n${body}` }),
    });
    return;
  }

  // Generic JSON
  await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, body }),
  });
}

async function sendNtfy(config: AlertConfig, subject: string, body: string): Promise<void> {
  if (!config.ntfyTopic) return;

  await fetch(`https://ntfy.sh/${config.ntfyTopic}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Title': subject,
      'Priority': 'urgent',
      'Tags': 'rotating_light,chart_with_upwards_trend',
    },
    body,
  });
}

export async function dispatch(subject: string, body: string): Promise<void> {
  const config = loadConfig();

  // Always log to console
  console.log(`\n${'='.repeat(60)}`);
  console.log(subject);
  console.log('='.repeat(60));
  console.log(body);
  console.log('='.repeat(60) + '\n');

  const tasks = [
    sendEmail(config, subject, body).catch(e => console.error('Email alert failed:', e.message)),
    sendWebhook(config, subject, body).catch(e => console.error('Webhook alert failed:', e.message)),
    sendNtfy(config, subject, body).catch(e => console.error('ntfy alert failed:', e.message)),
  ];

  await Promise.all(tasks);
}
