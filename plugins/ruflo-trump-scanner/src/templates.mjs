/**
 * HTML email template for alerts.
 *
 * Email-client constraints this template is written around:
 *  - Inline styles only for anything load-bearing. Gmail strips <style> blocks
 *    in some clients; the <style> here carries *progressive* enhancement
 *    (dark mode) and nothing the layout depends on.
 *  - No flexbox/grid. Tables are the only reliable layout primitive.
 *  - Images must be absolute https. Gmail proxies them; relative URLs break.
 *  - A hidden preheader controls the inbox preview line.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtTimestamp(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(ts); }
}

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

function fmtPrice(q) {
  if (q.price == null) return '';
  const sign = q.changePct >= 0 ? '+' : '';
  return `$${q.price.toFixed(2)} · ${sign}${q.changePct.toFixed(2)}%`;
}

/** One card per ticker: symbol, instrument name, live price and day change. */
function renderQuoteCards(quotes) {
  if (!quotes?.length) return '';

  const rows = quotes.map(q => {
    const up = q.changePct != null && q.changePct >= 0;
    const priceColor = q.changePct == null ? '#6b7280' : up ? '#15803d' : '#b91c1c';
    const priceText = fmtPrice(q);

    return `
      <tr>
        <td style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff;"
            class="tsc-card">
          <div style="font-size:15px;font-weight:800;color:#111827;letter-spacing:0.3px;" class="tsc-strong">
            ${escapeHtml(q.ticker)}
          </div>
          ${q.name ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;" class="tsc-muted">
            ${escapeHtml(q.name)}
          </div>` : ''}
          ${priceText ? `<div style="font-size:13px;font-weight:600;color:${priceColor};margin-top:6px;">
            ${escapeHtml(priceText)}
          </div>` : ''}
        </td>
      </tr>
      <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>`;
  }).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 18px 0;border-collapse:separate;">
      ${rows}
    </table>`;
}

export function renderAlertHtml(a) {
  const direction = (a.direction ?? '').toUpperCase();
  const accent =
    direction === 'BEARISH' || direction === 'DECLINING' ? '#dc2626' :
    direction === 'BULLISH' || direction === 'IMPROVING' ? '#16a34a' : '#4f46e5';
  const dirIcon =
    direction === 'BEARISH' || direction === 'DECLINING' ? '📉' :
    direction === 'BULLISH' || direction === 'IMPROVING' ? '📈' : '';

  const quotes = a.quotes ?? [];

  // Fall back to plain chips when no quote data resolved.
  const chips = !quotes.length && (a.tickers ?? []).length
    ? `<div style="margin-bottom:16px;">` + (a.tickers ?? []).filter(Boolean).map(t => `
        <span style="display:inline-block;background:#111827;color:#ffffff;border-radius:999px;
                     padding:5px 14px;margin:3px 4px 3px 0;font-size:13px;font-weight:600;
                     font-family:${FONT};">${escapeHtml(t)}</span>`).join('') + `</div>`
    : '';

  const hero = a.image ? `
    <img src="${escapeHtml(a.image)}" alt="" width="552"
         style="width:100%;max-width:552px;height:auto;border-radius:12px;
                margin:0 0 20px 0;display:block;border:0;" />` : '';

  const scoreBadge = a.scoreLabel ? `
    <span style="background:${accent};color:#ffffff;padding:5px 16px;border-radius:999px;
                 font-weight:700;font-size:14px;letter-spacing:0.2px;display:inline-block;">
      ${escapeHtml(a.scoreLabel)}</span>` : '';

  const dirBadge = direction ? `
    <span style="color:${accent};font-weight:700;font-size:14px;margin-left:10px;">
      ${dirIcon} ${escapeHtml(direction)}</span>` : '';

  const metaLine = [a.source, fmtTimestamp(a.timestamp)].filter(Boolean).join(' &middot; ');
  const keywordsLine = (a.keywords ?? []).filter(Boolean).join(', ');

  const linkButton = a.link ? `
    <a href="${escapeHtml(a.link)}"
       style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;
              padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;
              font-family:${FONT};">Read the full story &rarr;</a>` : '';

  // Inbox preview line — shown by Gmail next to the subject, then hidden.
  const preheader = [a.scoreLabel, a.source, (a.quote ?? '').slice(0, 90)]
    .filter(Boolean).join(' · ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {
    .tsc-body   { background:#0b0d10 !important; }
    .tsc-card   { background:#15181d !important; border-color:#2a2f37 !important; }
    .tsc-shell  { background:#15181d !important; border-color:#2a2f37 !important; }
    .tsc-head   { background:#101317 !important; border-color:#2a2f37 !important; }
    .tsc-strong { color:#f3f4f6 !important; }
    .tsc-muted  { color:#9ca3af !important; }
    .tsc-quote  { background:#101317 !important; color:#e5e7eb !important; }
  }
  @media (max-width:600px) {
    .tsc-pad { padding:20px 18px !important; }
  }
</style>
</head>
<body class="tsc-body" style="margin:0;padding:24px 12px;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
   <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="tsc-shell"
           style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;
                  border-radius:16px;overflow:hidden;font-family:${FONT};color:#111827;">

      <tr><td class="tsc-head tsc-pad" style="padding:24px 28px;background:#fafafa;border-bottom:1px solid #f0f1f3;">
        <div class="tsc-strong" style="font-size:20px;font-weight:800;line-height:1.3;margin-bottom:10px;">
          ${a.emoji ?? '🚨'} ${escapeHtml(a.headline ?? '')}
        </div>
        <div>${scoreBadge}${dirBadge}</div>
        ${metaLine ? `<div class="tsc-muted" style="color:#6b7280;font-size:13px;margin-top:10px;">${metaLine}</div>` : ''}
      </td></tr>

      <tr><td class="tsc-pad" style="padding:24px 28px;">
        ${hero}
        <blockquote class="tsc-quote"
          style="margin:0 0 20px 0;padding:16px 20px;background:#f9fafb;
                 border-left:4px solid ${accent};border-radius:0 10px 10px 0;
                 font-size:17px;line-height:1.55;font-weight:500;">
          ${escapeHtml(a.quote ?? '')}
        </blockquote>

        ${renderQuoteCards(quotes)}
        ${chips}

        ${keywordsLine ? `<div class="tsc-muted" style="color:#6b7280;font-size:13px;margin-bottom:22px;">
          <strong style="color:#374151;">Signals:</strong> ${escapeHtml(keywordsLine)}</div>` : ''}

        ${linkButton}
      </td></tr>

      <tr><td class="tsc-head" style="padding:16px 28px;background:#fafafa;border-top:1px solid #f0f1f3;">
        <div class="tsc-muted" style="color:#9ca3af;font-size:11px;line-height:1.5;">
          Trump Trade Scanner · automated signal, not investment advice.<br>
          Prices are delayed and shown for context only.
        </div>
      </td></tr>

    </table>
   </td></tr>
  </table>
</body>
</html>`.trim();
}
