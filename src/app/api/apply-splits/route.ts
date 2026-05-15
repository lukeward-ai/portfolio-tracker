import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

interface SplitEvent {
  date: Date
  numerator: number
  denominator: number
}

async function getSplitEvents(ticker: string, since: string): Promise<SplitEvent[]> {
  try {
    const result = await yf.chart(ticker, { period1: since, interval: '1d' }, { validateResult: false })
    return (result?.events?.splits ?? []) as SplitEvent[]
  } catch {
    return []
  }
}

function cumulativeSplitRatio(splits: SplitEvent[], afterDate: string): number {
  const tradeTime = new Date(afterDate).getTime()
  return splits
    .filter((s) => s.date.getTime() > tradeTime)
    .reduce((acc, s) => acc * (s.numerator / s.denominator), 1)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Fetch all unadjusted BUY transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, ticker, quantity, price, native_price, executed_at')
    .eq('user_id', user.id)
    .eq('split_adjusted', false)
    .eq('type', 'BUY')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!transactions?.length) return NextResponse.json({ adjusted: 0, tickers: [] })

  // Group transactions by ticker and find the earliest purchase date per ticker
  const byTicker = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    if (!byTicker.has(tx.ticker)) byTicker.set(tx.ticker, [])
    byTicker.get(tx.ticker)!.push(tx)
  }

  const adjustedTickers: string[] = []
  let adjusted = 0

  for (const [ticker, txs] of byTicker) {
    const earliest = txs.reduce((min, t) =>
      t.executed_at < min ? t.executed_at : min, txs[0].executed_at)

    const splits = await getSplitEvents(ticker, earliest.slice(0, 10))
    if (splits.length === 0) {
      // No splits — still mark as adjusted so we don't re-check
      await supabase
        .from('transactions')
        .update({ split_adjusted: true })
        .eq('user_id', user.id)
        .eq('ticker', ticker)
      continue
    }

    let tickerAdjusted = false

    for (const tx of txs) {
      const ratio = cumulativeSplitRatio(splits, tx.executed_at)
      if (ratio === 1) {
        await supabase
          .from('transactions')
          .update({ split_adjusted: true })
          .eq('id', tx.id)
        continue
      }

      const updates: Record<string, unknown> = {
        quantity: +(tx.quantity * ratio).toFixed(6),
        price: +(tx.price / ratio).toFixed(6),
        split_adjusted: true,
      }
      if (tx.native_price != null) {
        updates.native_price = +(tx.native_price / ratio).toFixed(6)
      }

      await supabase.from('transactions').update(updates).eq('id', tx.id)
      adjusted++
      tickerAdjusted = true
    }

    if (tickerAdjusted) adjustedTickers.push(ticker)

    // Small delay between tickers
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({ adjusted, tickers: adjustedTickers })
}
