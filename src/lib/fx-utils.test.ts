import { describe, it, expect } from 'vitest'
import { getHistoricalRate, computeAllHoldingsFX, computePortfolioFxImpact } from './fx-utils'
import fxRatesRaw from './fx-rates.json'

const fxRates = fxRatesRaw as Record<string, { USD_EUR?: number; GBP_EUR?: number }>
const allDates = Object.keys(fxRates).sort()
const firstDate = allDates[0]
const lastDate = allDates[allDates.length - 1]

describe('getHistoricalRate', () => {
  it('same currency is always 1', () => {
    expect(getHistoricalRate('2024-01-15', 'USD', 'USD')).toBe(1)
    expect(getHistoricalRate('1990-01-01', 'GBP', 'GBP')).toBe(1)
  })

  it('returns the file rate for a known date', () => {
    const usdEur = fxRates[lastDate].USD_EUR!
    expect(getHistoricalRate(lastDate, 'USD', 'EUR')).toBeCloseTo(usdEur, 6)
  })

  it('derives cross rates via EUR', () => {
    const usdEur = fxRates[lastDate].USD_EUR!
    const gbpEur = fxRates[lastDate].GBP_EUR!
    expect(getHistoricalRate(lastDate, 'USD', 'GBP')).toBeCloseTo(usdEur / gbpEur, 6)
    expect(getHistoricalRate(lastDate, 'GBP', 'USD')).toBeCloseTo(gbpEur / usdEur, 6)
  })

  it('is inverse-consistent', () => {
    const there = getHistoricalRate('2023-05-10', 'GBP', 'USD')
    const back = getHistoricalRate('2023-05-10', 'USD', 'GBP')
    expect(there * back).toBeCloseTo(1, 6)
  })

  it('dates after the file ends fall forward to the latest real rate — never 1:1 parity', () => {
    const future = getHistoricalRate('2099-12-31', 'GBP', 'EUR')
    const latest = getHistoricalRate(lastDate, 'GBP', 'EUR')
    expect(future).toBeCloseTo(latest, 6)
    // GBP/EUR parity has never been ~1 in the file's era; guard against the old bug
    expect(Math.abs(future - 1)).toBeGreaterThan(0.05)
  })

  it('dates before the file starts fall back to the earliest real rate', () => {
    const ancient = getHistoricalRate('1980-01-01', 'USD', 'EUR')
    const earliest = getHistoricalRate(firstDate, 'USD', 'EUR')
    expect(ancient).toBeCloseTo(earliest, 6)
  })

  it('weekend/gap dates resolve to the nearest prior trading day', () => {
    // Find a date missing from the file inside its range (weekends aren't published)
    const present = new Set(allDates)
    let gap: string | null = null
    for (const d of allDates.slice(0, 200)) {
      const next = new Date(d + 'T12:00:00Z')
      next.setDate(next.getDate() + 1)
      const k = next.toISOString().slice(0, 10)
      if (!present.has(k) && k < lastDate) { gap = k; break }
    }
    expect(gap).not.toBeNull()
    const prior = allDates.filter((d) => d < gap!).pop()!
    expect(getHistoricalRate(gap!, 'USD', 'EUR')).toBeCloseTo(getHistoricalRate(prior, 'USD', 'EUR'), 6)
  })
})

describe('computeAllHoldingsFX', () => {
  const lot = {
    ticker: 'AAPL',
    quantity: 10,
    costBasis: 1000, // USD
    acquiredAt: '2023-01-05T12:00:00Z',
    currency: 'USD',
  }
  const buyTx = {
    ticker: 'AAPL', type: 'BUY', quantity: 10, price: 100, fees: 0,
    executed_at: '2023-01-05T12:00:00Z', currency: 'USD', portfolio_id: 'p1',
  }

  it('computes cost at historical rate and value at current rate', () => {
    const currentRates = { USD_EUR: 0.9, GBP_EUR: 1.15 }
    const [h] = computeAllHoldingsFX(
      [lot], [buyTx],
      { AAPL: { price: 150, currency: 'USD' } },
      currentRates, 'EU', 'EUR'
    )
    expect(h.costBasisNative).toBe(1000)
    expect(h.costBasisBase).toBeCloseTo(1000 * getHistoricalRate('2023-01-05', 'USD', 'EUR'), 4)
    expect(h.currentValueNative).toBe(1500)
    expect(h.currentValueBase).toBeCloseTo(1500 * 0.9, 4)
  })

  it('fxImpact is zero when native currency equals base', () => {
    const [h] = computeAllHoldingsFX(
      [{ ...lot, currency: 'EUR' }],
      [{ ...buyTx, currency: 'EUR' }],
      { AAPL: { price: 150, currency: 'EUR' } },
      { USD_EUR: 0.9 }, 'EU', 'EUR'
    )
    expect(h.fxImpact).toBe(0)
  })

  it('fxImpact reflects rate movement since purchase', () => {
    const histRate = getHistoricalRate('2023-01-05', 'USD', 'EUR')
    const currentRate = histRate + 0.05 // euro weakened vs USD → FX gain for EUR investor
    const [h] = computeAllHoldingsFX(
      [lot], [buyTx],
      { AAPL: { price: 150, currency: 'USD' } },
      { USD_EUR: currentRate }, 'EU', 'EUR'
    )
    expect(h.fxImpact).toBeCloseTo(1500 * 0.05, 4)
  })
})

describe('computePortfolioFxImpact', () => {
  it('empty and same-currency holdings produce 0', () => {
    expect(computePortfolioFxImpact([])).toBe(0)
    expect(
      computePortfolioFxImpact([{
        ticker: 'ASML', costBasisNative: 100, nativeCurrency: 'EUR', costBasisBase: 100,
        baseCurrency: 'EUR', currentValueNative: 120, currentValueBase: 120, fxImpact: 0,
      }])
    ).toBe(0)
  })

  it('applies blended purchase rate to current value', () => {
    const impact = computePortfolioFxImpact([{
      ticker: 'AAPL',
      costBasisNative: 1000, nativeCurrency: 'USD',
      costBasisBase: 900, // bought at 0.90
      baseCurrency: 'EUR',
      currentValueNative: 2000,
      currentValueBase: 1900, // current implied rate 0.95
      fxImpact: null,
    }])
    // 2000 × (0.95 − 0.90) = 100
    expect(impact).toBeCloseTo(100, 6)
  })
})
