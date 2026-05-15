import fxRatesRaw from './fx-rates.json'

type FxRateMap = Record<string, { USD_EUR?: number; GBP_EUR?: number }>
const fxRates = fxRatesRaw as FxRateMap

// All rates in the file are X_EUR (units of EUR per 1 X).
// Cross-rate for any pair is derived via EUR.
function getRateToEUR(date: string, from: string): number {
  if (from === 'EUR') return 1
  const key = `${from}_EUR` as keyof (typeof fxRates)[string]
  const dateStr = date.slice(0, 10)
  for (let i = 0; i <= 7; i++) {
    const d = new Date(dateStr + 'T12:00:00Z')
    d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    const r = fxRates[k]?.[key]
    if (r != null) return r
  }
  return 1
}

// Returns how many `to` units equal 1 `from` unit.
export function getHistoricalRate(date: string, from: string, to: string): number {
  if (from === to) return 1
  const fromEUR = getRateToEUR(date, from)   // EUR per 1 from
  const toEUR = getRateToEUR(date, to)       // EUR per 1 to
  // from → EUR → to:  fromEUR / toEUR = `to` units per 1 `from`
  return toEUR > 0 ? fromEUR / toEUR : 1
}

// Returns the current cross-rate from currentRates (which has USD_EUR, GBP_EUR).
function getCurrentRate(from: string, to: string, currentRates: Record<string, number>): number {
  if (from === to) return 1
  const fromEUR = from === 'EUR' ? 1 : (currentRates[`${from}_EUR`] ?? 1)
  const toEUR   = to   === 'EUR' ? 1 : (currentRates[`${to}_EUR`]   ?? 1)
  return toEUR > 0 ? fromEUR / toEUR : 1
}

export interface HoldingFX {
  ticker: string
  /** Cost in the stock's native market currency (USD for US stocks, GBP for LSE) */
  costBasisNative: number
  nativeCurrency: string
  /** Cost in the user's base currency at the time of purchase (historical rate) */
  costBasisBase: number
  baseCurrency: string
  currentValueNative: number | null
  currentValueBase: number | null
  /** Base-currency gain/loss from exchange-rate movement since purchase */
  fxImpact: number | null
}

interface Lot {
  ticker: string
  quantity: number
  costBasis: number
  acquiredAt: string
  currency: string
}

interface Tx {
  ticker: string
  type: string
  quantity: number
  price: number
  fees?: number | null
  executed_at: string
  currency: string
  portfolio_id: string
}

export function computeAllHoldingsFX(
  lots: Lot[],
  transactions: Tx[],
  prices: Record<string, { price: number; currency: string }>,
  currentRates: Record<string, number>,
  jurisdiction: string,
  baseCurrency: string = 'EUR',
): HoldingFX[] {
  const tickers = [...new Set(lots.map((l) => l.ticker))]
  const results: HoldingFX[] = []

  for (const ticker of tickers) {
    const tickerLots = lots.filter((l) => l.ticker === ticker)
    const totalQty = tickerLots.reduce((s, l) => s + l.quantity, 0)
    const price = prices[ticker]
    const nativeCurrency = price?.currency?.toUpperCase() ?? tickerLots[0]?.currency?.toUpperCase() ?? 'USD'

    let costBasisNative = 0
    let costBasisBase = 0

    if (jurisdiction === 'UK') {
      // UK Section 104 pool: no per-lot dates — reconstruct from raw BUY transactions
      const buys = transactions.filter((t) => t.ticker === ticker && t.type === 'BUY')
      let totalBuyCostNative = 0
      let totalBuyCostBase = 0

      for (const tx of buys) {
        const txCost = tx.price * tx.quantity + (tx.fees ?? 0)
        const txCur = tx.currency.toUpperCase()

        if (txCur === nativeCurrency) {
          // Transaction is already in native currency
          const rate = getHistoricalRate(tx.executed_at, txCur, baseCurrency)
          totalBuyCostNative += txCost
          totalBuyCostBase += txCost * rate
        } else if (txCur === baseCurrency) {
          // Transaction stored in base currency — reverse-engineer native cost
          const rate = getHistoricalRate(tx.executed_at, baseCurrency, nativeCurrency)
          totalBuyCostBase += txCost
          totalBuyCostNative += txCost * rate
        } else {
          // Some other currency — convert both ways
          const toBase = getHistoricalRate(tx.executed_at, txCur, baseCurrency)
          const toNative = getHistoricalRate(tx.executed_at, txCur, nativeCurrency)
          totalBuyCostBase += txCost * toBase
          totalBuyCostNative += txCost * toNative
        }
      }

      // Scale to remaining open position (sells proportionally reduce pool)
      const poolCostBase = tickerLots.reduce((s, l) => {
        // Pool costBasis is stored in transaction currency — convert to base
        const lotCur = l.currency.toUpperCase()
        const rate = lotCur === baseCurrency ? 1 : getHistoricalRate(l.acquiredAt || new Date().toISOString(), lotCur, baseCurrency)
        return s + l.costBasis * rate
      }, 0)
      const proportion = totalBuyCostBase > 0 ? poolCostBase / totalBuyCostBase : 1
      costBasisBase = poolCostBase
      costBasisNative = totalBuyCostNative * proportion
    } else {
      // FIFO: each lot has an acquiredAt date
      for (const lot of tickerLots) {
        const lotCur = lot.currency.toUpperCase()
        const date = lot.acquiredAt || new Date().toISOString()

        if (lotCur === nativeCurrency) {
          costBasisNative += lot.costBasis
          costBasisBase += lot.costBasis * getHistoricalRate(date, lotCur, baseCurrency)
        } else if (lotCur === baseCurrency) {
          costBasisBase += lot.costBasis
          costBasisNative += lot.costBasis * getHistoricalRate(date, lotCur, nativeCurrency)
        } else {
          costBasisNative += lot.costBasis * getHistoricalRate(date, lotCur, nativeCurrency)
          costBasisBase += lot.costBasis * getHistoricalRate(date, lotCur, baseCurrency)
        }
      }
    }

    let currentValueNative: number | null = null
    let currentValueBase: number | null = null
    let fxImpact: number | null = null

    if (price) {
      const priceCur = price.currency.toUpperCase()
      const currentNativeToBase = getCurrentRate(priceCur, baseCurrency, currentRates)

      currentValueNative = price.price * totalQty
      currentValueBase = currentValueNative * currentNativeToBase

      if (priceCur === baseCurrency) {
        fxImpact = 0
      } else if (costBasisNative > 0) {
        // FX impact = current base value − what it would be worth at the historical avg rate
        // = currentValueNative × (currentRate − historicalAvgRate)
        // where historicalAvgRate = costBasisBase / costBasisNative
        const historicalAvgRate = costBasisBase / costBasisNative
        fxImpact = currentValueNative! * (currentNativeToBase - historicalAvgRate)
      }
    }

    results.push({
      ticker,
      costBasisNative,
      nativeCurrency,
      costBasisBase,
      baseCurrency,
      currentValueNative,
      currentValueBase,
      fxImpact,
    })
  }

  return results
}
