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
