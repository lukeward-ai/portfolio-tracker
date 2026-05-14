import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''

  if (query.length < 1) return NextResponse.json({ results: [] })

  try {
    const results = await yf.search(query, {}, { validateResult: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (results.quotes as any[])
      .filter((q: any) =>
        (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && q.isYahooFinance
      )
      .slice(0, 8)
      .map((q: any) => ({
        ticker: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchDisp ?? q.exchange ?? '',
        type: q.quoteType === 'ETF' ? 'ETF' : 'Stock',
        sector: q.sectorDisp ?? q.sector ?? null,
        industry: q.industryDisp ?? q.industry ?? null,
      }))
    return NextResponse.json({ results: quotes })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ results: [] })
  }
}
