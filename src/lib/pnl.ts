import { Transaction, TaxLot, RealisedGain, TaxJurisdiction, Currency } from './types'
import { differenceInDays } from 'date-fns'

/**
 * Calculates tax lots and realised gains from a list of transactions.
 * Supports UK (Section 104 pool), US (FIFO), EU (FIFO).
 */
export function calculatePnL(
  transactions: Transaction[],
  jurisdiction: TaxJurisdiction
): { lots: TaxLot[]; realisedGains: RealisedGain[] } {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
  )

  if (jurisdiction === 'UK') {
    return calculateUK(sorted)
  }
  return calculateFIFO(sorted, jurisdiction)
}

function calculateFIFO(
  transactions: Transaction[],
  jurisdiction: TaxJurisdiction
): { lots: TaxLot[]; realisedGains: RealisedGain[] } {
  const lots: Record<string, TaxLot[]> = {}
  const realisedGains: RealisedGain[] = []

  for (const tx of transactions) {
    if (!lots[tx.ticker]) lots[tx.ticker] = []

    if (tx.type === 'BUY') {
      lots[tx.ticker].push({
        ticker: tx.ticker,
        quantity: tx.quantity,
        costBasis: tx.price * tx.quantity + (tx.fees ?? 0),
        acquiredAt: tx.executed_at,
        currency: tx.currency as Currency,
      })
    } else if (tx.type === 'SELL') {
      let qtyToSell = tx.quantity
      const proceeds = tx.price * tx.quantity - (tx.fees ?? 0)

      while (qtyToSell > 0 && lots[tx.ticker].length > 0) {
        const lot = lots[tx.ticker][0]
        const soldQty = Math.min(qtyToSell, lot.quantity)
        const lotCostPerShare = lot.costBasis / lot.quantity
        const costBasis = lotCostPerShare * soldQty
        const lotProceeds = (proceeds / tx.quantity) * soldQty
        const gain = lotProceeds - costBasis
        const daysDiff = differenceInDays(new Date(tx.executed_at), new Date(lot.acquiredAt))

        realisedGains.push({
          ticker: tx.ticker,
          quantity: soldQty,
          proceeds: lotProceeds,
          costBasis,
          gain,
          gainPct: costBasis > 0 ? (gain / costBasis) * 100 : 0,
          acquiredAt: lot.acquiredAt,
          soldAt: tx.executed_at,
          isShortTerm: jurisdiction === 'US' ? daysDiff <= 365 : daysDiff <= 365,
          currency: tx.currency as Currency,
        })

        if (soldQty === lot.quantity) {
          lots[tx.ticker].shift()
        } else {
          lot.quantity -= soldQty
          lot.costBasis = lot.costBasis - costBasis
        }
        qtyToSell -= soldQty
      }
    }
  }

  const openLots = Object.values(lots).flat()
  return { lots: openLots, realisedGains }
}

// UK Section 104 pool method
function calculateUK(
  transactions: Transaction[]
): { lots: TaxLot[]; realisedGains: RealisedGain[] } {
  const pools: Record<string, { quantity: number; pooledCost: number; currency: Currency }> = {}
  const realisedGains: RealisedGain[] = []

  for (const tx of transactions) {
    const currency = tx.currency as Currency
    if (!pools[tx.ticker]) {
      pools[tx.ticker] = { quantity: 0, pooledCost: 0, currency }
    }

    const pool = pools[tx.ticker]

    if (tx.type === 'BUY') {
      pool.quantity += tx.quantity
      pool.pooledCost += tx.price * tx.quantity + (tx.fees ?? 0)
    } else if (tx.type === 'SELL') {
      if (pool.quantity <= 0) continue
      const avgCost = pool.pooledCost / pool.quantity
      const costBasis = avgCost * tx.quantity
      const proceeds = tx.price * tx.quantity - (tx.fees ?? 0)
      const gain = proceeds - costBasis

      realisedGains.push({
        ticker: tx.ticker,
        quantity: tx.quantity,
        proceeds,
        costBasis,
        gain,
        gainPct: costBasis > 0 ? (gain / costBasis) * 100 : 0,
        acquiredAt: '', // pool method - no specific lot
        soldAt: tx.executed_at,
        isShortTerm: false, // UK doesn't distinguish
        currency,
      })

      pool.quantity -= tx.quantity
      pool.pooledCost -= costBasis
    }
  }

  const lots: TaxLot[] = Object.entries(pools)
    .filter(([, p]) => p.quantity > 0)
    .map(([ticker, p]) => ({
      ticker,
      quantity: p.quantity,
      costBasis: p.pooledCost,
      acquiredAt: '',
      currency: p.currency,
    }))

  return { lots, realisedGains }
}

export function getHoldings(transactions: Transaction[], lots: TaxLot[]) {
  const holdingsMap: Record<string, { quantity: number; costBasis: number; currency: Currency; name: string | null }> = {}

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      if (!holdingsMap[tx.ticker]) {
        holdingsMap[tx.ticker] = { quantity: 0, costBasis: 0, currency: tx.currency as Currency, name: tx.name }
      }
      holdingsMap[tx.ticker].quantity += tx.quantity
      holdingsMap[tx.ticker].costBasis += tx.price * tx.quantity + (tx.fees ?? 0)
    } else if (tx.type === 'SELL') {
      if (holdingsMap[tx.ticker]) {
        holdingsMap[tx.ticker].quantity -= tx.quantity
      }
    }
  }

  // Override with lot data for accuracy
  for (const lot of lots) {
    if (holdingsMap[lot.ticker]) {
      holdingsMap[lot.ticker].quantity = lot.quantity
      holdingsMap[lot.ticker].costBasis = lot.costBasis
    }
  }

  return Object.entries(holdingsMap)
    .filter(([, h]) => h.quantity > 0.0001)
    .map(([ticker, h]) => ({
      ticker,
      quantity: h.quantity,
      avgCost: h.quantity > 0 ? h.costBasis / h.quantity : 0,
      costBasis: h.costBasis,
      currency: h.currency,
      name: h.name,
    }))
}
