import { describe, it, expect } from 'vitest'
import { calculatePnL, getHoldings } from './pnl'
import type { Transaction, TransactionType, Currency } from './types'

let txCounter = 0
function tx(overrides: Partial<Transaction> & { type: TransactionType; ticker: string; quantity: number; price: number }): Transaction {
  txCounter++
  return {
    id: `tx-${String(txCounter).padStart(4, '0')}`,
    portfolio_id: 'p1',
    user_id: 'u1',
    name: null,
    currency: 'USD' as Currency,
    fees: 0,
    notes: null,
    executed_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z',
    ...overrides,
  }
}

describe('FIFO (EU/US)', () => {
  it('single buy creates one open lot with fees capitalised', () => {
    const { lots, realisedGains, warnings } = calculatePnL(
      [tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, fees: 5 })],
      'EU'
    )
    expect(lots).toHaveLength(1)
    expect(lots[0].quantity).toBe(10)
    expect(lots[0].costBasis).toBe(1005)
    expect(realisedGains).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('sells consume oldest lots first', () => {
    const { lots, realisedGains } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 200, executed_at: '2023-06-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 10, price: 300, executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'EU'
    )
    // Oldest lot ($100 cost) is consumed; the $200 lot remains
    expect(realisedGains).toHaveLength(1)
    expect(realisedGains[0].costBasis).toBe(1000)
    expect(realisedGains[0].gain).toBe(2000)
    expect(lots).toHaveLength(1)
    expect(lots[0].costBasis).toBe(2000)
  })

  it('partial lot consumption splits the lot proportionally', () => {
    const { lots, realisedGains } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 4, price: 150, executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'EU'
    )
    expect(realisedGains[0].quantity).toBe(4)
    expect(realisedGains[0].costBasis).toBe(400)
    expect(realisedGains[0].gain).toBeCloseTo(200)
    expect(lots[0].quantity).toBe(6)
    expect(lots[0].costBasis).toBe(600)
  })

  it('sell fees reduce proceeds', () => {
    const { realisedGains } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 10, price: 150, fees: 10, executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'EU'
    )
    expect(realisedGains[0].proceeds).toBe(1490)
    expect(realisedGains[0].gain).toBe(490)
  })

  it('oversell is flagged, matched portion still realises', () => {
    const { lots, realisedGains, warnings } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 5, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 8, price: 150, executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'EU'
    )
    expect(realisedGains).toHaveLength(1)
    expect(realisedGains[0].quantity).toBe(5)
    expect(lots).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('AAPL')
    expect(warnings[0]).toContain('exceeds')
  })

  it('sell with no position at all is flagged', () => {
    const { realisedGains, warnings } = calculatePnL(
      [tx({ type: 'SELL', ticker: 'AAPL', quantity: 5, price: 150 })],
      'EU'
    )
    expect(realisedGains).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })

  it('lots are segregated per portfolio — a sell cannot consume another account\'s shares', () => {
    const { lots, warnings } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, portfolio_id: 'p1', executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 10, price: 150, portfolio_id: 'p2', executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'EU'
    )
    // p1's lot untouched; p2's sell unmatched
    expect(lots).toHaveLength(1)
    expect(lots[0].quantity).toBe(10)
    expect(warnings).toHaveLength(1)
  })

  it('same-timestamp buy and sell resolves buy-first regardless of input order', () => {
    const buy = tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2024-01-01T12:00:00Z' })
    const sell = tx({ type: 'SELL', ticker: 'AAPL', quantity: 10, price: 150, executed_at: '2024-01-01T12:00:00Z' })

    const ascending = calculatePnL([buy, sell], 'EU')
    const descending = calculatePnL([sell, buy], 'EU')

    expect(ascending.realisedGains).toHaveLength(1)
    expect(descending.realisedGains).toHaveLength(1)
    expect(ascending.warnings).toHaveLength(0)
    expect(descending.warnings).toHaveLength(0)
    expect(ascending.realisedGains[0].gain).toBe(descending.realisedGains[0].gain)
  })

  it('short/long-term classification uses 365 days', () => {
    const { realisedGains } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'AAPL', quantity: 2, price: 100, executed_at: '2022-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 1, price: 150, executed_at: '2022-06-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'AAPL', quantity: 1, price: 150, executed_at: '2024-06-01T12:00:00Z' }),
      ],
      'US'
    )
    expect(realisedGains[0].isShortTerm).toBe(true)
    expect(realisedGains[1].isShortTerm).toBe(false)
  })
})

describe('UK Section 104 pool', () => {
  it('pools all buys at average cost', () => {
    const { lots, realisedGains } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'VOD', quantity: 100, price: 1, currency: 'GBP', executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'BUY', ticker: 'VOD', quantity: 100, price: 3, currency: 'GBP', executed_at: '2023-06-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'VOD', quantity: 100, price: 4, currency: 'GBP', executed_at: '2024-01-01T12:00:00Z' }),
      ],
      'UK'
    )
    // Pool: 200 @ avg £2 → sell 100 costs £200, proceeds £400
    expect(realisedGains[0].costBasis).toBe(200)
    expect(realisedGains[0].gain).toBe(200)
    expect(lots[0].quantity).toBe(100)
    expect(lots[0].costBasis).toBe(200)
  })

  it('oversell is clamped — pool never goes negative', () => {
    const { lots, realisedGains, warnings } = calculatePnL(
      [
        tx({ type: 'BUY', ticker: 'VOD', quantity: 50, price: 2, currency: 'GBP', executed_at: '2023-01-01T12:00:00Z' }),
        tx({ type: 'SELL', ticker: 'VOD', quantity: 80, price: 4, currency: 'GBP', executed_at: '2024-01-01T12:00:00Z' }),
        // A later buy must start a fresh, uncorrupted pool
        tx({ type: 'BUY', ticker: 'VOD', quantity: 10, price: 5, currency: 'GBP', executed_at: '2024-06-01T12:00:00Z' }),
      ],
      'UK'
    )
    expect(realisedGains[0].quantity).toBe(50)
    expect(realisedGains[0].costBasis).toBe(100)
    // Proceeds prorated: sold 50 of the attempted 80 → 4*80 * (50/80) = 200
    expect(realisedGains[0].proceeds).toBeCloseTo(200)
    expect(warnings.length).toBeGreaterThan(0)
    expect(lots).toHaveLength(1)
    expect(lots[0].quantity).toBe(10)
    expect(lots[0].costBasis).toBe(50)
  })

  it('sell into an empty pool is skipped with a warning', () => {
    const { realisedGains, warnings } = calculatePnL(
      [tx({ type: 'SELL', ticker: 'VOD', quantity: 10, price: 4, currency: 'GBP' })],
      'UK'
    )
    expect(realisedGains).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

describe('getHoldings', () => {
  it('fully sold positions are excluded', () => {
    const transactions = [
      tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
      tx({ type: 'SELL', ticker: 'AAPL', quantity: 10, price: 150, executed_at: '2024-01-01T12:00:00Z' }),
      tx({ type: 'BUY', ticker: 'MSFT', quantity: 5, price: 300, executed_at: '2023-01-01T12:00:00Z' }),
    ]
    const { lots } = calculatePnL(transactions, 'EU')
    const holdings = getHoldings(transactions, lots)
    expect(holdings.map((h) => h.ticker)).toEqual(['MSFT'])
    expect(holdings[0].quantity).toBe(5)
  })

  it('holdings reflect remaining lot quantities and avg cost after partial sells', () => {
    const transactions = [
      tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 100, executed_at: '2023-01-01T12:00:00Z' }),
      tx({ type: 'BUY', ticker: 'AAPL', quantity: 10, price: 200, executed_at: '2023-06-01T12:00:00Z' }),
      tx({ type: 'SELL', ticker: 'AAPL', quantity: 15, price: 300, executed_at: '2024-01-01T12:00:00Z' }),
    ]
    const { lots } = calculatePnL(transactions, 'EU')
    const holdings = getHoldings(transactions, lots)
    // 5 left, all from the second ($200) lot
    expect(holdings[0].quantity).toBe(5)
    expect(holdings[0].costBasis).toBe(1000)
    expect(holdings[0].avgCost).toBe(200)
  })

  it('fractional dust below 0.0001 is filtered out', () => {
    const transactions = [
      tx({ type: 'BUY', ticker: 'AMC', quantity: 65.22527, price: 10, executed_at: '2023-01-01T12:00:00Z' }),
      tx({ type: 'SELL', ticker: 'AMC', quantity: 65.22527, price: 5, executed_at: '2024-01-01T12:00:00Z' }),
    ]
    const { lots } = calculatePnL(transactions, 'EU')
    const holdings = getHoldings(transactions, lots)
    expect(holdings).toHaveLength(0)
  })
})
