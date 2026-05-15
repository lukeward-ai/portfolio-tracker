import { NextRequest, NextResponse } from 'next/server'
import type { MarketEvent } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function fetchTickerEvents(ticker: string): Promise<MarketEvent[]> {
  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ['calendarEvents'],
    }, { validateResult: false })

    const events: MarketEvent[] = []
    const cal = summary?.calendarEvents

    if (!cal) return events

    // Earnings dates
    const earningsDates: Date[] = cal.earnings?.earningsDate ?? []
    for (const d of earningsDates) {
      const dateStr = new Date(d).toISOString().split('T')[0]
      if (dateStr < new Date().toISOString().split('T')[0]) continue
      const epsEstimate = cal.earnings?.earningsAverage ?? null
      events.push({
        id: `earnings-${ticker}-${dateStr}`,
        type: 'earnings',
        ticker,
        name: null,
        date: dateStr,
        title: `${ticker} Earnings Report`,
        description: epsEstimate != null
          ? `EPS estimate: $${Number(epsEstimate).toFixed(2)}`
          : 'Earnings date per Yahoo Finance. Confirm with official filings.',
        importance: 'high',
        isConfirmed: false,
        epsEstimate: epsEstimate != null ? Number(epsEstimate) : null,
        exDividendDate: null,
        dividendAmount: null,
        paymentDate: null,
      })
    }

    // Ex-dividend date
    if (cal.exDividendDate) {
      const exDate = new Date(cal.exDividendDate).toISOString().split('T')[0]
      if (exDate >= new Date().toISOString().split('T')[0]) {
        const dividendAmount = cal.dividendDate ? null : null
        events.push({
          id: `dividend-ex-${ticker}-${exDate}`,
          type: 'dividend',
          ticker,
          name: null,
          date: exDate,
          title: `${ticker} Ex-Dividend Date`,
          description: 'Shares must be held before this date to receive the dividend.',
          importance: 'medium',
          isConfirmed: true,
          epsEstimate: null,
          exDividendDate: exDate,
          dividendAmount,
          paymentDate: cal.dividendDate
            ? new Date(cal.dividendDate).toISOString().split('T')[0]
            : null,
        })
      }
    }

    // Dividend payment date (if different from ex-date and in future)
    if (cal.dividendDate) {
      const payDate = new Date(cal.dividendDate).toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      if (payDate >= today) {
        events.push({
          id: `dividend-pay-${ticker}-${payDate}`,
          type: 'dividend',
          ticker,
          name: null,
          date: payDate,
          title: `${ticker} Dividend Payment`,
          description: 'Expected dividend payment date.',
          importance: 'low',
          isConfirmed: true,
          epsEstimate: null,
          exDividendDate: cal.exDividendDate
            ? new Date(cal.exDividendDate).toISOString().split('T')[0]
            : null,
          dividendAmount: null,
          paymentDate: payDate,
        })
      }
    }

    return events
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []

  if (tickers.length === 0) {
    return NextResponse.json({ events: [] })
  }

  const results = await Promise.allSettled(
    tickers.map((t) => fetchTickerEvents(t))
  )

  const allEvents: MarketEvent[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value)
    }
  }

  // Sort by date ascending
  allEvents.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ events: allEvents })
}
