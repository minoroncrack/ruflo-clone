/**
 * Fincept Terminal MCP bridge for Ruflo
 *
 * Provides typed wrappers around Fincept Terminal's MCP tool surface.
 * Requires a running Fincept Terminal instance with MCP server enabled.
 */

export interface FinceptConfig {
  mcpEndpoint: string;
  defaultBroker: string;
  paperTradingDefault: boolean;
}

export const DEFAULT_CONFIG: FinceptConfig = {
  mcpEndpoint: process.env.FINCEPT_MCP_ENDPOINT ?? 'localhost:3001',
  defaultBroker: process.env.FINCEPT_DEFAULT_BROKER ?? 'alpaca',
  paperTradingDefault: process.env.FINCEPT_PAPER_DEFAULT !== 'false',
};

// ── Research ─────────────────────────────────────────────────────────────────

export interface EquityResearchRequest {
  ticker: string;
  depth?: 'quick' | 'full';
  agentStyle?: string; // e.g. 'buffett', 'graham', 'lynch'
}

export interface EquityResearchResult {
  ticker: string;
  recommendation: 'buy' | 'hold' | 'sell';
  priceTarget: number;
  dcfValue: number;
  currentPrice: number;
  upside: number;
  summary: string;
  risks: string[];
  agentCommentary?: string;
}

// ── Trading ──────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

export interface TradeRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType?: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  broker?: string;
  paper?: boolean;
}

export interface TradeResult {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  fillPrice: number;
  broker: string;
  paper: boolean;
  timestamp: string;
  status: 'filled' | 'partial' | 'pending' | 'rejected';
}

// ── Quant / Risk ─────────────────────────────────────────────────────────────

export interface RiskDecision {
  ticker: string;
  maxPositionPct: number;
  stopLoss: number;
  takeProfit: number;
  expectedSharpe: number;
  var95_1d: number;
  approved: boolean;
  reason?: string;
}

export interface PortfolioRisk {
  var95: number;
  var99: number;
  cvar95: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  beta: number;
  stressTests: Record<string, number>;
}

// ── Macro ────────────────────────────────────────────────────────────────────

export type MacroRegime = 'expansion' | 'slowdown' | 'contraction' | 'recovery';

export interface MacroContext {
  regime: MacroRegime;
  indicators: MacroIndicator[];
  sectorImplications: Record<string, 'positive' | 'neutral' | 'negative'>;
  risks: string[];
}

export interface MacroIndicator {
  name: string;
  source: string;
  current: number;
  prior: number;
  consensus?: number;
  unit: string;
  trend: 'rising' | 'falling' | 'stable';
}

// ── MCP tool name constants ───────────────────────────────────────────────────

export const FINCEPT_MCP_TOOLS = {
  // Research
  EQUITY_RESEARCH: 'mcp__fincept-terminal__equity_research',
  DCF_MODEL: 'mcp__fincept-terminal__dcf_model',
  EDGAR_FILINGS: 'mcp__fincept-terminal__edgar_filings',
  NEWS_SEARCH: 'mcp__fincept-terminal__news_search',
  MARKETS_DATA: 'mcp__fincept-terminal__markets_data',

  // Trading
  LIVE_TRADE: 'mcp__fincept-terminal__live_trade',
  PAPER_TRADE: 'mcp__fincept-terminal__paper_trade',
  CRYPTO_TRADE: 'mcp__fincept-terminal__crypto_trade',
  BROKER_ACCOUNT: 'mcp__fincept-terminal__broker_account',
  WATCHLIST: 'mcp__fincept-terminal__watchlist',

  // Portfolio
  PORTFOLIO_OPTIMIZE: 'mcp__fincept-terminal__portfolio_optimize',
  PORTFOLIO_RISK: 'mcp__fincept-terminal__portfolio_risk',

  // Quant
  QUANTLIB_PRICE: 'mcp__fincept-terminal__quantlib_price',
  QUANTLIB_RISK: 'mcp__fincept-terminal__quantlib_risk',
  SURFACE_ANALYTICS: 'mcp__fincept-terminal__surface_analytics',
  QUANT_LAB: 'mcp__fincept-terminal__quant_lab',
  PYTHON_EXEC: 'mcp__fincept-terminal__python_exec',

  // Macro data
  DBNOMICS: 'mcp__fincept-terminal__dbnomics',
  FRED_DATA: 'mcp__fincept-terminal__fred_data',
  IMF_DATA: 'mcp__fincept-terminal__imf_data',
  WORLD_BANK: 'mcp__fincept-terminal__world_bank',
  GOV_DATA: 'mcp__fincept-terminal__gov_data',
  GEOPOLITICS: 'mcp__fincept-terminal__geopolitics',

  // AI Agents
  RUN_AGENT: 'mcp__fincept-terminal__run_agent',
  AGENT_DISCOVERY: 'mcp__fincept-terminal__agent_discovery',

  // System
  WORKSPACE: 'mcp__fincept-terminal__workspace',
  DASHBOARD: 'mcp__fincept-terminal__dashboard',
  SETTINGS: 'mcp__fincept-terminal__settings',
} as const;

export type FinceptMcpTool = (typeof FINCEPT_MCP_TOOLS)[keyof typeof FINCEPT_MCP_TOOLS];

// ── Built-in AI agents ────────────────────────────────────────────────────────

export const FINCEPT_INVESTOR_AGENTS = [
  'buffett', 'graham', 'lynch', 'munger', 'klarman', 'marks',
  'templeton', 'dalio', 'simons', 'soros',
] as const;

export const FINCEPT_ECONOMIC_AGENTS = [
  'macro-analyst', 'central-bank-watcher', 'yield-curve', 'inflation-tracker',
] as const;

export const FINCEPT_GEOPOLITICAL_AGENTS = [
  'geopolitical-risk', 'sanctions-monitor', 'regime-change',
] as const;

export type FinceptInvestorAgent = (typeof FINCEPT_INVESTOR_AGENTS)[number];
export type FinceptEconomicAgent = (typeof FINCEPT_ECONOMIC_AGENTS)[number];
export type FinceptGeopoliticalAgent = (typeof FINCEPT_GEOPOLITICAL_AGENTS)[number];
