/**
 * Shared HTML email template for alerts. Inline styles only — email clients
 * strip <style> blocks and external stylesheets.
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

export function renderAlertHtml(a) {
  const direction = (a.direction ?? '').toUpperCase();
  const accent = direction === 'BEARISH' ? '#dc2626' : direction === 'BULLISH' ? '#16a34a' : '#4f46e5';
  const dirIcon = direction === 'BEARISH' ? '📉' : direction === 'BULLISH' ? '📈' : '';

  const chips = (a.tickers ?? []).filter(Boolean).map(t => `
    <span style="display:inline-block;background:#111827;color:#ffffff;border-radius:999px;
                 padding:5px 14px;margin:3px 4px 3px 0;font-size:13px;font-weight:600;
                 font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      ${escapeHtml(t)}
    </span>`).join('');

  const keywordsLine = (a.keywords ?? []).filter(Boolean).join(', ');
  const img = a.image ? `
    <img src="${escapeHtml(a.image)}" alt="" width="552"
         style="width:100%;max-width:552px;height:auto;border-radius:12px;margin:0 0 20px 0;display:block;" />` : '';

  const scoreBadge = a.scoreLabel ? `
    <span style="background:${accent};color:#ffffff;padding:5px 16px;border-radius:999px;
                 font-weight:700;font-size:14px;letter-spacing:0.2px;">
      ${escapeHtml(a.scoreLabel)}
    </span>` : '';

  const dirBadge = direction ? `
    <span style="color:${accent};font-weight:700;font-size:14px;margin-left:10px;">
      ${dirIcon} ${escapeHtml(direction)}
    </span>` : '';

  const metaLine = [a.source, fmtTimestamp(a.timestamp)].filter(Boolean).join(' &middot; ');

  const linkButton = a.link ? `
    <a href="${escapeHtml(a.link)}"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
              padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
              margin-top:4px;">
      View Original &rarr;
    </a>` : '';

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
            max-width:600px;margin:0 auto;background:#ffffff;color:#111827;
            border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
  <div style="padding:24px 28px;border-bottom:1px solid #f0f1f3;background:#fafafa;">
    <div style="font-size:20px;font-weight:800;line-height:1.3;margin-bottom:10px;">
      ${a.emoji ?? '🚨'} ${escapeHtml(a.headline ?? '')}
    </div>
    <div>${scoreBadge}${dirBadge}</div>
    ${metaLine ? `<div style="color:#6b7280;font-size:13px;margin-top:10px;">${metaLine}</div>` : ''}
  </div>
  <div style="padding:24px 28px;">
    ${img}
    <blockquote style="margin:0 0 20px 0;padding:16px 20px;background:#f9fafb;
                       border-left:4px solid ${accent};border-radius:0 10px 10px 0;
                       font-size:17px;line-height:1.55;color:#111827;font-weight:500;">
      ${escapeHtml(a.quote ?? '')}
    </blockquote>
    ${chips ? `<div style="margin-bottom:14px;">${chips}</div>` : ''}
    ${keywordsLine ? `<div style="color:#6b7280;font-size:13px;margin-bottom:22px;">
        <strong style="color:#374151;">Keywords:</strong> ${escapeHtml(keywordsLine)}
      </div>` : ''}
    ${linkButton}
  </div>
</div>`.trim();
}
