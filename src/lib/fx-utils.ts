import fxRatesRaw from './fx-rates.json'

type FxRateMap = Record<string, { USD_EUR?: number; GBP_EUR?: number }>
const fxRates = fxRatesRaw as FxRateMap

export function getHistoricalRate(date: string, from: string, to: string = 'EUR'): number {
  if (from === to) return 1
  const key = `${from}_${to}` as keyof (typeof fxRates)[string]
  const dateStr = date.slice(0, 10)
  // Walk back up to 7 calendar days to find the nearest trading day rate
  for (let i = 0; i <= 7; i++) {
    const d = new Date(dateStr + 'T12:00:00Z')
    d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    const r = fxRates[k]?.[key]
    if (r != null) return r
  }
  return 1
}

export interface HoldingFX {
  ticker: string
  costBasisEURAtPurchase: number
  costBasisNative: number
  nativeCurrency: string
  currentValueNative: number | null
  currentValueEUR: number | null
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
): HoldingFX[] {
  const currentUSDEUR = currentRates['USD_EUR'] ?? 0.86
  const currentGBPEUR = currentRates['GBP_EUR'] ?? 1.15

  const tickers = [...new Set(lots.map((l) => l.ticker))]
  const results: HoldingFX[] = []

  for (const ticker of tickers) {
    const tickerLots = lots.filter((l) => l.ticker === ticker)
    const totalQty = tickerLots.reduce((s, l) => s + l.quantity, 0)
    const price = prices[ticker]
    const nativeCurrency = price?.currency?.toUpperCase() ?? tickerLots[0]?.currency?.toUpperCase() ?? 'USD'

    let costBasisEURAtPurchase = 0
    let costBasisNative = 0

    if (jurisdiction === 'UK') {
      // UK pool: lots have no acquiredAt date — use raw BUY transactions
      const buys = transactions.filter(
        (t) => t.ticker === ticker && t.type === 'BUY',
      )
      let totalBuyCostNative = 0
      let totalBuyCostEUR = 0

      for (const tx of buys) {
        const txCost = tx.price * tx.quantity + (tx.fees ?? 0)
        const txCur = tx.currency.toUpperCase()

        if (txCur === 'EUR') {
          const rate = getHistoricalRate(tx.executed_at, 'USD', 'EUR')
          totalBuyCostEUR += txCost
          totalBuyCostNative += rate > 0 ? txCost / rate : txCost
        } else if (txCur === 'USD') {
          const rate = getHistoricalRate(tx.executed_at, 'USD', 'EUR')
          totalBuyCostNative += txCost
          totalBuyCostEUR += txCost * rate
        } else if (txCur === 'GBP') {
          const rate = getHistoricalRate(tx.executed_at, 'GBP', 'EUR')
          totalBuyCostNative += txCost
          totalBuyCostEUR += txCost * rate
        }
      }

      // Scale to remaining open position (sells reduce the pool proportionally)
      const poolCostEUR = tickerLots.reduce((s, l) => s + l.costBasis, 0)
      const proportion = totalBuyCostEUR > 0 ? poolCostEUR / totalBuyCostEUR : 1
      costBasisEURAtPurchase = poolCostEUR // pool cost IS the EUR cost (Tom's T212 stores EUR)
      costBasisNative = totalBuyCostNative * proportion
    } else {
      // FIFO: each lot has an acquiredAt date and currency
      for (const lot of tickerLots) {
        const lotCur = lot.currency.toUpperCase()
        if (lotCur === 'EUR') {
          const rate = lot.acquiredAt
            ? getHistoricalRate(lot.acquiredAt, 'USD', 'EUR')
            : currentUSDEUR
          costBasisEURAtPurchase += lot.costBasis
          costBasisNative += rate > 0 ? lot.costBasis / rate : lot.costBasis
        } else if (lotCur === 'USD') {
          const rate = lot.acquiredAt
            ? getHistoricalRate(lot.acquiredAt, 'USD', 'EUR')
            : currentUSDEUR
          costBasisNative += lot.costBasis
          costBasisEURAtPurchase += lot.costBasis * rate
        } else if (lotCur === 'GBP') {
          const rate = lot.acquiredAt
            ? getHistoricalRate(lot.acquiredAt, 'GBP', 'EUR')
            : currentGBPEUR
          costBasisNative += lot.costBasis
          costBasisEURAtPurchase += lot.costBasis * rate
        }
      }
    }

    let currentValueNative: number | null = null
    let currentValueEUR: number | null = null
    let fxImpact: number | null = null

    if (price) {
      const priceCur = price.currency.toUpperCase()
      if (priceCur === 'USD') {
        currentValueNative = price.price * totalQty
        currentValueEUR = currentValueNative * currentUSDEUR
        // FX impact = what EUR cost would be at current rate − original EUR cost
        fxImpact = costBasisNative * currentUSDEUR - costBasisEURAtPurchase
      } else if (priceCur === 'GBP') {
        currentValueNative = price.price * totalQty
        currentValueEUR = currentValueNative * currentGBPEUR
        fxImpact = costBasisNative * currentGBPEUR - costBasisEURAtPurchase
      } else {
        // EUR-priced stock — no FX impact
        currentValueNative = price.price * totalQty
        currentValueEUR = currentValueNative
        fxImpact = 0
      }
    }

    results.push({
      ticker,
      costBasisEURAtPurchase,
      costBasisNative,
      nativeCurrency,
      currentValueNative,
      currentValueEUR,
      fxImpact,
    })
  }

  return results
}
