/**
 * Alert dispatcher — email, webhook (Discord/Slack/generic), ntfy.sh.
 * All config from environment variables only.
 */

import nodemailer from 'nodemailer';

function cfg() {
  return {
    smtpHost:    process.env.SMTP_HOST,
    smtpPort:    Number(process.env.SMTP_PORT ?? 587),
    smtpUser:    process.env.SMTP_USER,
    smtpPass:    process.env.SMTP_PASS,
    emailTo:     process.env.ALERT_EMAIL_TO,
    emailFrom:   process.env.ALERT_EMAIL_FROM ?? process.env.SMTP_USER,
    webhookUrl:  process.env.ALERT_WEBHOOK_URL,
    ntfyTopic:   process.env.NTFY_TOPIC,
  };
}

async function sendEmail(c, subject, body) {
  if (!c.smtpHost || !c.smtpUser || !c.smtpPass || !c.emailTo) return;
  const t = nodemailer.createTransport({
    host: c.smtpHost, port: c.smtpPort,
    secure: c.smtpPort === 465,
    auth: { user: c.smtpUser, pass: c.smtpPass },
  });
  await t.sendMail({ from: c.emailFrom, to: c.emailTo, subject, text: body });
}

async function sendWebhook(c, subject, body) {
  if (!c.webhookUrl) return;
  let payload;
  if (c.webhookUrl.includes('discord.com')) {
    payload = { content: `**${subject}**\n\`\`\`\n${body}\n\`\`\`` };
  } else if (c.webhookUrl.includes('hooks.slack.com')) {
    payload = { text: `*${subject}*\n${body}` };
  } else {
    payload = { subject, body };
  }
  await fetch(c.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

async function sendNtfy(c, subject, body) {
  if (!c.ntfyTopic) return;
  await fetch(`https://ntfy.sh/${c.ntfyTopic}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'Title': subject, 'Priority': 'urgent', 'Tags': 'rotating_light,chart_with_upwards_trend' },
    body,
  });
}

export async function dispatch(subject, body) {
  const c = cfg();
  console.log(`\n${'='.repeat(60)}\n${subject}\n${'='.repeat(60)}\n${body}\n${'='.repeat(60)}\n`);
  await Promise.all([
    sendEmail(c, subject, body).catch(e => console.error('Email failed:', e.message)),
    sendWebhook(c, subject, body).catch(e => console.error('Webhook failed:', e.message)),
    sendNtfy(c, subject, body).catch(e => console.error('ntfy failed:', e.message)),
  ]);
}
