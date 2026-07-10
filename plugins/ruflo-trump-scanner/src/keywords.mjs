/**
 * Market-moving keyword engine.
 */

/**
 * Tuned against a live 47-article Google News window rather than picked a
 * priori. Distribution was median 20 / max 80, with a cliff between 52 and 55
 * where a named company (55) or explicit $TICKER (60) starts to dominate.
 *   40 -> 8 alerts (17%)   admits any two weak 20-pt sector hits
 *   50 -> 7 alerts (15%)   requires a company/ticker, or strong sector + market context
 *   55 -> 2 alerts (4%)    too tight; drops legitimate oil+stocks signals
 * 50 buys most of 40's recall while excluding the weakest pairs.
 */
const ALERT_THRESHOLD = 50;

/**
 * Word-boundary term matching.
 *
 * Previously this was `lower.includes(term)`, which matched substrings inside
 * unrelated words: the semiconductor term 'ai' fired on "gains", "financial"
 * and the publisher name "Investor's Business Daily"; the immigration term
 * 'wall' fired on "Wall Street". Those false positives were the bulk of all
 * non-zero scores. Anchoring on \b restricts matches to whole words, and
 * multi-word phrases ('made in america') still work because \b only needs to
 * hold at the two ends of the phrase.
 */
const termRegexCache = new Map();

function termRegex(term) {
  let re = termRegexCache.get(term);
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Trailing (?:e?s)? so 'stock market' still matches "stock markets" and
    // 'tariff' matches "tariffs" -- a bare \b after the term would demand a
    // boundary between "market" and "s" and silently miss every plural.
    re = new RegExp(`\\b${escaped}(?:e?s)?\\b`, 'i');
    termRegexCache.set(term, re);
  }
  return re;
}

function hasTerm(text, term) {
  return termRegex(term).test(text);
}

// Bug fix: build regex inside function, not as module-level /g constant
function extractTickers(text) {
  const found = [];
  const re = /\$([A-Z]{1,5})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    found.push(m[1]);
  }
  return found;
}

const COMPANY_TO_TICKER = {
  'apple': 'AAPL', 'tesla': 'TSLA', 'boeing': 'BA', 'lockheed': 'LMT',
  'raytheon': 'RTX', 'northrop': 'NOC', 'general dynamics': 'GD',
  'palantir': 'PLTR', 'oracle': 'ORCL', 'microsoft': 'MSFT',
  'amazon': 'AMZN', 'google': 'GOOGL', 'nvidia': 'NVDA',
  'pfizer': 'PFE', 'moderna': 'MRNA',
  'deere': 'DE', 'caterpillar': 'CAT', 'us steel': 'X',
  'nucor': 'NUE', 'exxon': 'XOM', 'chevron': 'CVX',
  'trump media': 'DJT', 'truth social': 'DJT',
};

const SECTOR_KEYWORDS = [
  { terms: ['defense', 'military', 'army', 'navy', 'weapons', 'missile', 'fighter jet', 'pentagon'], etf: 'ITA', direction: 'bullish', score: 35 },
  { terms: ['tariff', 'tariffs', 'china tariff', 'import tax'], etf: 'SOYB', direction: 'bearish', score: 30 },
  // 'wall' -> 'border wall': bare 'wall' matched "Wall Street" on every
  // market story, tagging them bullish-GEO (private prisons). Nonsense.
  { terms: ['border', 'immigration', 'border wall', 'deportation'], etf: 'GEO', direction: 'bullish', score: 25 },
  { terms: ['oil', 'drill', 'energy', 'lng', 'natural gas', 'pipeline'], etf: 'XOP', direction: 'bullish', score: 30 },
  { terms: ['steel', 'aluminum', 'manufacturing', 'made in america'], etf: 'SLX', direction: 'bullish', score: 28 },
  { terms: ['crypto', 'bitcoin', 'digital dollar', 'blockchain'], etf: 'BITX', direction: 'bullish', score: 32 },
  { terms: ['pharma', 'vaccine', 'drug price', 'fda', 'healthcare'], etf: 'XLV', direction: 'neutral', score: 20 },
  { terms: ['ai', 'artificial intelligence', 'semiconductor', 'chips'], etf: 'SOXX', direction: 'bullish', score: 30 },
  { terms: ['china', 'beijing', 'taiwan', 'trade war'], etf: 'FXI', direction: 'bearish', score: 35 },
  { terms: ['space', 'nasa', 'spacex', 'satellite'], etf: 'UFO', direction: 'bullish', score: 28 },
  { terms: ['bank', 'federal reserve', 'powell', 'interest rate'], etf: 'XLF', direction: 'bullish', score: 28 },
  { terms: ['infrastructure', 'road', 'bridge', 'construction'], etf: 'PAVE', direction: 'bullish', score: 22 },
  // The Google News query in news.mjs retrieves on 'stock market' and 'economy',
  // but neither term existed here — so the scanner fetched articles it had no
  // rule to score, and they came back a flat 0. These close that gap.
  { terms: ['stock market', 'stocks', 'equities', 's&p', 'dow jones', 'nasdaq', 'wall street'], etf: 'SPY', direction: 'neutral', score: 20 },
  { terms: ['economy', 'inflation', 'recession', 'gdp', 'jobs report', 'unemployment'], etf: 'SPY', direction: 'neutral', score: 20 },
];

const SENTIMENT_BOOSTERS = [
  { terms: ['great company', 'incredible', 'tremendous', 'will do great', 'going to be huge', 'i love'], multiplier: 1.5, direction: 'bullish' },
  { terms: ['just signed', 'executive order', "we're buying", 'just bought'], multiplier: 1.8, direction: 'bullish' },
  { terms: ['disaster', 'scam', 'fake', 'failing', 'terrible', 'worst ever'], multiplier: 1.5, direction: 'bearish' },
  { terms: ['investigation', 'fraud', 'corrupt', 'criminal'], multiplier: 1.6, direction: 'bearish' },
];

export function scanPost(postId, text, postedAt) {
  const lower = text.toLowerCase();
  const matches = [];

  // 1. Explicit $TICKER — regex built fresh each call (no lastIndex bug)
  for (const ticker of extractTickers(text)) {
    matches.push({ keyword: `$${ticker}`, category: 'ticker', score: 60, direction: 'bullish', extractedTicker: ticker });
  }

  // 2. Company name → ticker
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (hasTerm(lower, name)) {
      matches.push({ keyword: name, category: 'ticker', score: 55, direction: 'bullish', extractedTicker: ticker });
    }
  }

  // 3. Sector keywords
  for (const sector of SECTOR_KEYWORDS) {
    for (const term of sector.terms) {
      if (hasTerm(lower, term)) {
        matches.push({ keyword: term, category: 'sector', score: sector.score, direction: sector.direction, extractedTicker: sector.etf });
        break;
      }
    }
  }

  // 4. Sentiment multipliers
  let multiplier = 1;
  for (const s of SENTIMENT_BOOSTERS) {
    for (const term of s.terms) {
      if (hasTerm(lower, term)) {
        multiplier = Math.max(multiplier, s.multiplier);
        matches.push({ keyword: term, category: 'sentiment', score: 15, direction: s.direction });
        break;
      }
    }
  }

  const baseScore = matches.reduce((sum, m) => sum + m.score, 0);
  const totalScore = Math.min(100, Math.round(baseScore * multiplier));
  const sorted = [...matches].sort((a, b) => b.score - a.score);
  const topCategory = sorted[0]?.category ?? 'none';

  return { postId, postText: text, postedAt, matches: sorted, totalScore, topCategory, alert: totalScore >= ALERT_THRESHOLD };
}

export function computeDirection(matches) {
  const bullishCount = matches.filter(m => m.direction === 'bullish').length;
  const bearishCount = matches.filter(m => m.direction === 'bearish').length;
  return bullishCount >= bearishCount ? 'BULLISH' : 'BEARISH';
}

export function formatAlert(result) {
  const tickers = [...new Set(result.matches.map(m => m.extractedTicker).filter(Boolean))];
  const bullishCount = result.matches.filter(m => m.direction === 'bullish').length;
  const bearishCount = result.matches.filter(m => m.direction === 'bearish').length;
  const dir = bullishCount >= bearishCount ? '📈 BULLISH' : '📉 BEARISH';

  return [
    `🚨 TRUMP TRADE SIGNAL [Score: ${result.totalScore}/100] ${dir}`,
    `Posted: ${result.postedAt}`,
    ``,
    `"${result.postText.slice(0, 280)}"`,
    ``,
    `Tickers/ETFs: ${tickers.join(', ') || 'see keywords'}`,
    `Keywords: ${result.matches.map(m => m.keyword).join(', ')}`,
    ``,
    `Act fast — retail flow follows within minutes.`,
  ].join('\n');
}
