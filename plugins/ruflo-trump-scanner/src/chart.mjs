/**
 * Intraday sparkline for the alert email hero, rendered by QuickChart.
 *
 * Why a chart rather than the article's photo: the link resolver frequently
 * lands on msn.com, an aggregator that serves a JavaScript shell with zero
 * <meta property> tags — no og:image, no twitter:image. Preferring a real
 * publisher isn't possible either; for those headlines MSN is the only result
 * clearing the title-overlap guard. So when og:image is unavailable we draw
 * the thing the alert is actually about: the tickers' intraday move.
 *
 * QuickChart renders a PNG from a config passed in the URL. Gmail proxies
 * remote images, so the URL must be absolute https and reasonably short
 * (~2000 chars); series are downsampled upstream in quotes.mjs to keep it so.
 *
 * Returns null when there is nothing worth drawing. Never throws.
 */

const ENDPOINT = 'https://quickchart.io/chart';
const MAX_SERIES = 3;
const MAX_URL_LEN = 1900;

// Distinct, colour-blind-safe-ish lines; readable on white and on dark.
const COLORS = ['#2563eb', '#dc2626', '#059669'];

/** Resample a series to exactly `n` points, preserving first and last. */
function resample(values, n) {
  if (values.length <= n) return values;
  const step = (values.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => values[Math.round(i * step)]);
}

function buildAt(usable, points) {
  // Percent-normalised against each series' own open, so instruments at very
  // different price levels (SPY ~$750, BITX ~$12) share one readable axis.
  const datasets = usable.map((q, i) => {
    const s = resample(q.series, points);
    const open = s[0];
    return {
      label: q.ticker,
      data: s.map(v => Number((((v - open) / open) * 100).toFixed(2))),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
    };
  });

  const longest = Math.max(...datasets.map(d => d.data.length));

  const config = {
    type: 'line',
    data: { labels: Array.from({ length: longest }, () => ''), datasets },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: true, text: 'Intraday % change', font: { size: 12 }, color: '#6b7280' },
      },
      scales: {
        x: { display: false },
        y: { ticks: { font: { size: 10 } }, grid: { color: '#eef0f3' } },
      },
    },
  };

  return `${ENDPOINT}?w=600&h=260&bkg=white&c=${encodeURIComponent(JSON.stringify(config))}`;
}

/**
 * buildChartUrl(quotes)
 * quotes: [{ ticker, series: number[], changePct }]
 *
 * The config travels in the query string, so three full-resolution series blow
 * past Gmail's practical URL ceiling and the chart vanishes — silently, on
 * exactly the multi-ticker alerts that most deserve one. So step the
 * resolution down until it fits rather than giving up at full detail.
 */
export function buildChartUrl(quotes = []) {
  const usable = quotes
    .filter(q => Array.isArray(q.series) && q.series.length >= 3)
    .slice(0, MAX_SERIES);

  if (!usable.length) return null;

  for (const points of [24, 18, 14, 10, 8]) {
    const url = buildAt(usable, points);
    if (url.length <= MAX_URL_LEN) return url;
  }
  return null;   // even 8 points won't fit — no chart rather than a broken one
}
