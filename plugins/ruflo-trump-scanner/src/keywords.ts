/**
 * Market-moving keyword engine.
 *
 * Score: how likely a Trump statement moves a stock.
 * Rules are ordered by specificity — more specific matches score higher.
 */

export interface KeywordMatch {
  keyword: string;
  category: 'ticker' | 'sector' | 'policy' | 'sentiment';
  score: number;           // 0-100
  direction: 'bullish' | 'bearish' | 'neutral';
  extractedTicker?: string;
}

export interface ScanResult {
  postId: string;
  postText: string;
  postedAt: string;
  matches: KeywordMatch[];
  totalScore: number;
  topCategory: string;
  alert: boolean;          // true when totalScore >= ALERT_THRESHOLD
}

const ALERT_THRESHOLD = 40;

// Ticker-pattern: $XXX or known company names mapped to tickers
const TICKER_PATTERN = /\$([A-Z]{1,5})\b/g;

const COMPANY_TO_TICKER: Record<string, string> = {
  'apple': 'AAPL', 'tesla': 'TSLA', 'boeing': 'BA', 'lockheed': 'LMT',
  'raytheon': 'RTX', 'northrop': 'NOC', 'general dynamics': 'GD',
  'palantir': 'PLTR', 'oracle': 'ORCL', 'microsoft': 'MSFT',
  'amazon': 'AMZN', 'google': 'GOOGL', 'nvidia': 'NVDA',
  'pfizer': 'PFE', 'moderna': 'MRNA', 'johnson & johnson': 'JNJ',
  'deere': 'DE', 'caterpillar': 'CAT', 'us steel': 'X',
  'nucor': 'NUE', 'exxon': 'XOM', 'chevron': 'CVX',
  'truth social': 'DJT', 'trump media': 'DJT',
};

// Sector keywords → implied tickers/ETFs
const SECTOR_KEYWORDS: Array<{ terms: string[]; etf: string; direction: 'bullish' | 'bearish'; score: number }> = [
  { terms: ['defense', 'military', 'army', 'navy', 'weapons', 'missile', 'fighter jet', 'pentagon', 'nato'], etf: 'ITA', direction: 'bullish', score: 35 },
  { terms: ['tariff', 'tariffs', 'china tariff', 'import tax'], etf: 'SOYB', direction: 'bearish', score: 30 },
  { terms: ['border', 'immigration', 'wall', 'deportation'], etf: 'GEO', direction: 'bullish', score: 25 },
  { terms: ['oil', 'drill', 'energy', 'lng', 'natural gas', 'pipeline'], etf: 'XOP', direction: 'bullish', score: 30 },
  { terms: ['steel', 'aluminum', 'manufacturing', 'made in america'], etf: 'SLX', direction: 'bullish', score: 28 },
  { terms: ['crypto', 'bitcoin', 'digital dollar', 'blockchain'], etf: 'BITX', direction: 'bullish', score: 32 },
  { terms: ['pharma', 'vaccine', 'drug price', 'fda', 'healthcare'], etf: 'XLV', direction: 'neutral', score: 20 },
  { terms: ['ai', 'artificial intelligence', 'tech', 'semiconductor', 'chips'], etf: 'SOXX', direction: 'bullish', score: 30 },
  { terms: ['china', 'beijing', 'taiwan', 'trade war', 'communist'], etf: 'FXI', direction: 'bearish', score: 35 },
  { terms: ['russia', 'ukraine', 'nato', 'war', 'peace deal'], etf: 'RSX', direction: 'neutral', score: 25 },
  { terms: ['bank', 'interest rate', 'fed', 'federal reserve', 'powell'], etf: 'XLF', direction: 'bullish', score: 28 },
  { terms: ['infrastructure', 'road', 'bridge', 'construction'], etf: 'PAVE', direction: 'bullish', score: 22 },
  { terms: ['space', 'nasa', 'spacex', 'satellite'], etf: 'UFO', direction: 'bullish', score: 28 },
];

// Policy sentiment modifiers
const SENTIMENT_BOOSTERS: Array<{ terms: string[]; multiplier: number; direction: 'bullish' | 'bearish' }> = [
  { terms: ['great company', 'great deal', 'incredible', 'best ever', 'tremendous', 'will do great', 'going to be huge'], multiplier: 1.5, direction: 'bullish' },
  { terms: ['disaster', 'scam', 'fake', 'failing', 'terrible', 'worst ever', 'going bankrupt'], multiplier: 1.5, direction: 'bearish' },
  { terms: ['i love', "we're buying", 'just bought', 'signed deal', 'executive order'], multiplier: 1.8, direction: 'bullish' },
  { terms: ['investigation', 'fraud', 'corrupt', 'criminal'], multiplier: 1.6, direction: 'bearish' },
];

export function scanPost(postId: string, text: string, postedAt: string): ScanResult {
  const lower = text.toLowerCase();
  const matches: KeywordMatch[] = [];

  // 1. Explicit tickers ($XXX)
  const tickerMatches = [...text.matchAll(TICKER_PATTERN)];
  for (const m of tickerMatches) {
    matches.push({
      keyword: m[0],
      category: 'ticker',
      score: 60,
      direction: 'bullish',
      extractedTicker: m[1],
    });
  }

  // 2. Company name → ticker
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (lower.includes(name)) {
      matches.push({
        keyword: name,
        category: 'ticker',
        score: 55,
        direction: 'bullish',
        extractedTicker: ticker,
      });
    }
  }

  // 3. Sector keywords
  for (const sector of SECTOR_KEYWORDS) {
    for (const term of sector.terms) {
      if (lower.includes(term)) {
        matches.push({
          keyword: term,
          category: 'sector',
          score: sector.score,
          direction: sector.direction,
          extractedTicker: sector.etf,
        });
        break; // one hit per sector
      }
    }
  }

  // 4. Sentiment multipliers
  let multiplier = 1;
  for (const sentiment of SENTIMENT_BOOSTERS) {
    for (const term of sentiment.terms) {
      if (lower.includes(term)) {
        multiplier = Math.max(multiplier, sentiment.multiplier);
        matches.push({
          keyword: term,
          category: 'sentiment',
          score: 15,
          direction: sentiment.direction,
        });
        break;
      }
    }
  }

  const baseScore = matches.reduce((sum, m) => sum + m.score, 0);
  const totalScore = Math.min(100, Math.round(baseScore * multiplier));
  const topCategory = matches.length > 0
    ? matches.sort((a, b) => b.score - a.score)[0].category
    : 'none';

  return {
    postId,
    postText: text,
    postedAt,
    matches,
    totalScore,
    topCategory,
    alert: totalScore >= ALERT_THRESHOLD,
  };
}

export function formatAlert(result: ScanResult): string {
  const tickers = [...new Set(result.matches.map(m => m.extractedTicker).filter(Boolean))];
  const directions = result.matches.map(m => m.direction);
  const dominantDir = directions.filter(d => d === 'bullish').length >= directions.filter(d => d === 'bearish').length
    ? '📈 BULLISH'
    : '📉 BEARISH';

  return [
    `🚨 TRUMP TRADE SIGNAL [Score: ${result.totalScore}/100] ${dominantDir}`,
    `Posted: ${result.postedAt}`,
    ``,
    `"${result.postText.slice(0, 280)}"`,
    ``,
    `Tickers/ETFs: ${tickers.join(', ') || 'see keywords below'}`,
    `Keywords hit: ${result.matches.map(m => m.keyword).join(', ')}`,
    ``,
    `Act fast — retail flow follows within minutes.`,
  ].join('\n');
}
