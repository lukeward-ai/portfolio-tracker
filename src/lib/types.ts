export type Currency = 'USD' | 'EUR' | 'GBP'
export type TaxJurisdiction = 'UK' | 'US' | 'EU' | 'OTHER'
export type TransactionType = 'BUY' | 'SELL'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  base_currency: Currency
  tax_jurisdiction: TaxJurisdiction
  created_at: string
}

export interface Portfolio {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
}

export interface Transaction {
  id: string
  portfolio_id: string
  user_id: string
  type: TransactionType
  ticker: string
  name: string | null
  quantity: number
  price: number
  currency: Currency
  fees: number
  notes: string | null
  executed_at: string
  created_at: string
}

export interface ImportBatch {
  id: string
  user_id: string
  portfolio_id: string
  file_name: string
  broker_format: string
  trade_count: number
  imported_at: string
}

export interface CashPosition {
  id: string
  portfolio_id: string
  user_id: string
  currency: Currency
  amount: number
  updated_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  ticker: string
  name: string | null
  added_at: string
}

export interface PriceData {
  ticker: string
  price: number
  currency: string
  change_percent: number
  previous_close: number
  market_cap: number | null
  name: string | null
  updated_at: string
}

export interface ExchangeRate {
  base: Currency
  target: Currency
  rate: number
}

export interface Holding {
  ticker: string
  name: string | null
  quantity: number
  avgCost: number
  costCurrency: Currency
  currentPrice: number | null
  currentValue: number | null
  unrealisedPnL: number | null
  unrealisedPnLPct: number | null
  changePercent: number | null
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalUnrealisedPnL: number
  totalUnrealisedPnLPct: number
  dayChange: number
  dayChangePct: number
  currency: Currency
}

export interface TaxLot {
  ticker: string
  quantity: number
  costBasis: number
  acquiredAt: string
  currency: Currency
}

export interface RealisedGain {
  ticker: string
  quantity: number
  proceeds: number
  costBasis: number
  gain: number
  gainPct: number
  acquiredAt: string
  soldAt: string
  isShortTerm: boolean
  currency: Currency
}

export interface TickerFundamentals {
  week52High: number | null
  week52Low: number | null
  trailingPE: number | null
  forwardPE: number | null
  dividendYield: number | null
  dividendRate: number | null
  beta: number | null
}

export interface TickerDetail extends TickerFundamentals {
  ticker: string
  name: string | null
  price: number
  change: number
  changePercent: number
  previousClose: number
  currency: string
  marketCap: number | null
  sector: string | null
  industry: string | null
  description: string | null
  recommendationKey: string | null
  recommendationMean: number | null
  numberOfAnalystOpinions: number | null
  news: TickerNews[]
}

export interface TickerNews {
  title: string
  url: string
  publishedAt: string
  source: string | null
}

export interface AnalysisDriver {
  ticker: string
  name: string | null
  impactValue: number
  impactPct: number
  direction: 'positive' | 'negative' | 'neutral'
}

export interface PortfolioAnalysis {
  headline: string
  summary: string
  keyDrivers: AnalysisDriver[]
  biggestWinner: AnalysisDriver | null
  biggestLoser: AnalysisDriver | null
  fxExposurePct: number
  fxNote: string
  realisedSummary: string
  disclaimer: string
  generatedAt: string
  dataAvailable: boolean
}

export type WatchlistLabel =
  | 'Momentum Strong'
  | 'Near 52W High'
  | 'High Yield'
  | 'Value Range'
  | 'Worth Watching'
  | 'Appears Elevated'
  | 'Insufficient Data'

export type MarketEventType = 'earnings' | 'dividend' | 'economic'
export type MarketEventImportance = 'high' | 'medium' | 'low'

export interface MarketEvent {
  id: string
  type: MarketEventType
  ticker: string | null
  name: string | null
  date: string
  title: string
  description: string | null
  importance: MarketEventImportance
  isConfirmed: boolean
  // earnings-specific
  epsEstimate: number | null
  // dividend-specific
  exDividendDate: string | null
  dividendAmount: number | null
  paymentDate: string | null
}

export interface PortfolioSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  portfolio_value: number
  holdings_value: number
  cash_balance: number
  net_contributions: number
  total_return: number
  total_return_percentage: number
  unrealised_gain_loss: number
  realised_gain_loss: number
  dividends_earned: number
  holdings_count: number
  metadata: {
    holdings?: Array<{
      ticker: string
      name: string | null
      quantity: number
      avg_cost: number
      market_value: number
      unrealised_gain_loss: number
      allocation_pct: number
      currency: string
    }>
  } | null
  created_at: string
  updated_at: string
}
