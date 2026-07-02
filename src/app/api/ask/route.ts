import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { fetchAllTransactions } from '@/lib/fetch-transactions'
import type { Currency, TaxJurisdiction } from '@/lib/types'

export const maxDuration = 30

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildRates(rows: Array<{ base: string; target: string; rate: number }>): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const r of rows) rates[`${r.base}_${r.target}`] = r.rate
  return rates
}

function convert(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount
  const rate = rates[`${from}_${to}`]
  return rate ? amount * rate : amount
}

function fmt(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return new Response('No messages', { status: 400 })

  const [
    { data: profile },
    transactions,
    { data: priceRows },
    { data: rateRows },
    { data: portfolios },
    { data: snapshotPage1 },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    fetchAllTransactions(supabase, user.id),
    supabase.from('price_cache').select('*'),
    supabase.from('exchange_rate_cache').select('base, target, rate'),
    supabase.from('portfolios').select('*').eq('user_id', user.id),
    supabase.from('portfolio_snapshots')
      .select('snapshot_date,portfolio_value,net_contributions,total_return,total_return_percentage')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: true })
      .range(0, 999),
  ])

  // Fetch remaining snapshot pages
  let allSnapshots = [...(snapshotPage1 ?? [])]
  if ((snapshotPage1?.length ?? 0) === 1000) {
    const { data: page2 } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date,portfolio_value,net_contributions,total_return,total_return_percentage')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: true })
      .range(1000, 1999)
    allSnapshots = allSnapshots.concat(page2 ?? [])
    if ((page2?.length ?? 0) === 1000) {
      const { data: page3 } = await supabase
        .from('portfolio_snapshots')
        .select('snapshot_date,portfolio_value,net_contributions,total_return,total_return_percentage')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .range(2000, 2999)
      allSnapshots = allSnapshots.concat(page3 ?? [])
    }
  }

  // Sample one snapshot per month for Claude context
  const monthlySnapshots: typeof allSnapshots = []
  let lastMonth = ''
  for (const s of allSnapshots) {
    const month = s.snapshot_date.slice(0, 7)
    if (month !== lastMonth) { monthlySnapshots.push(s); lastMonth = month }
  }

  const baseCurrency = (profile?.base_currency ?? 'EUR') as Currency
  const jurisdiction = (profile?.tax_jurisdiction ?? 'EU') as TaxJurisdiction
  const rates = buildRates(rateRows ?? [])

  const txs = transactions
  const { lots, realisedGains } = calculatePnL(txs, jurisdiction)
  const holdings = getHoldings(txs, lots)

  const priceMap: Record<string, { price: number; currency: string; change_percent?: number; name?: string }> = {}
  for (const p of priceRows ?? []) priceMap[p.ticker] = p

  const portfolioMap = Object.fromEntries((portfolios ?? []).map((p) => [p.id, p.name]))

  // Build holdings context
  let totalValue = 0
  let totalCost = 0
  let totalUnrealised = 0

  const holdingLines = holdings.map((h) => {
    const price = priceMap[h.ticker]
    const costBase = convert(h.costBasis, h.currency, baseCurrency, rates)
    totalCost += costBase

    if (!price) return `  ${h.ticker}: ${h.quantity.toFixed(4)} shares, cost basis ${fmt(costBase, baseCurrency)} — no current price`

    const priceCur = price.currency.toUpperCase() as Currency
    const mv = convert(price.price * h.quantity, priceCur, baseCurrency, rates)
    const pnl = mv - costBase
    const pct = costBase > 0 ? (pnl / costBase) * 100 : 0
    totalValue += mv
    totalUnrealised += pnl

    return `  ${h.ticker}${price.name ? ` (${price.name})` : ''}: ${h.quantity.toFixed(4)} shares @ ${price.currency} ${price.price.toFixed(2)}, market value ${fmt(mv, baseCurrency)}, cost ${fmt(costBase, baseCurrency)}, unrealised P&L ${pnl >= 0 ? '+' : ''}${fmt(pnl, baseCurrency)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)${price.change_percent != null ? `, today ${price.change_percent >= 0 ? '+' : ''}${price.change_percent.toFixed(2)}%` : ''}`
  }).join('\n')

  // Realised gains summary
  const realisedTotal = realisedGains.reduce((s, g) => s + convert(g.gain, g.currency, baseCurrency, rates), 0)
  const realisedByTicker: Record<string, { gain: number; proceeds: number }> = {}
  for (const g of realisedGains) {
    const gainBase = convert(g.gain, g.currency, baseCurrency, rates)
    const procBase = convert(g.proceeds, g.currency, baseCurrency, rates)
    if (!realisedByTicker[g.ticker]) realisedByTicker[g.ticker] = { gain: 0, proceeds: 0 }
    realisedByTicker[g.ticker].gain += gainBase
    realisedByTicker[g.ticker].proceeds += procBase
  }
  const realisedLines = Object.entries(realisedByTicker)
    .sort((a, b) => b[1].gain - a[1].gain)
    .map(([t, r]) => `  ${t}: ${r.gain >= 0 ? '+' : ''}${fmt(r.gain, baseCurrency)} (proceeds ${fmt(r.proceeds, baseCurrency)})`)
    .join('\n')

  // Recent transactions (last 20)
  const recentTxs = [...txs]
    .sort((a, b) => b.executed_at.localeCompare(a.executed_at))
    .slice(0, 20)
    .map((t) => `  ${t.executed_at.slice(0, 10)} ${t.type} ${t.quantity} ${t.ticker} @ ${t.currency} ${t.price} [${portfolioMap[t.portfolio_id] ?? 'unknown'}]`)
    .join('\n')

  const totalReturn = totalUnrealised + realisedTotal
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0
  const winCount = Object.values(realisedByTicker).filter((r) => r.gain > 0).length
  const lossCount = Object.values(realisedByTicker).filter((r) => r.gain < 0).length

  const firstSnapshot = allSnapshots[0]
  const lastSnapshot = allSnapshots[allSnapshots.length - 1]

  const historyLines = monthlySnapshots
    .map((s) => `  ${s.snapshot_date}: portfolio ${fmt(s.portfolio_value, baseCurrency)}, invested ${fmt(s.net_contributions, baseCurrency)}, gain ${s.total_return >= 0 ? '+' : ''}${fmt(s.total_return, baseCurrency)} (${s.total_return_percentage >= 0 ? '+' : ''}${s.total_return_percentage.toFixed(1)}%)`)
    .join('\n')

  const systemPrompt = `You are a personal portfolio assistant for ${profile?.full_name ?? 'this investor'}. You have full access to their live portfolio data including full historical monthly values. Answer questions concisely and helpfully. Use numbers from the data provided. Format currency values clearly.

FORMATTING RULES (strictly follow):
- Never use markdown tables. Use bullet points or plain sentences instead.
- Use **bold** only for key figures or stock names, sparingly.
- Keep responses short — 3 to 8 lines maximum unless the question genuinely needs more detail.
- Write in a natural, conversational tone. No formal headers or sections.
- Use bullet points (- item) when listing multiple items.
- Do not add disclaimers or caveats unless directly relevant.

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}
BASE CURRENCY: ${baseCurrency}
TAX JURISDICTION: ${jurisdiction} (${jurisdiction === 'UK' ? 'Section 104 pool' : 'FIFO'} method)

PORTFOLIO SUMMARY:
  Total market value: ${fmt(totalValue, baseCurrency)}
  Total invested (cost basis): ${fmt(totalCost, baseCurrency)}
  Unrealised P&L: ${totalUnrealised >= 0 ? '+' : ''}${fmt(totalUnrealised, baseCurrency)}
  Realised P&L all time: ${realisedTotal >= 0 ? '+' : ''}${fmt(realisedTotal, baseCurrency)}
  Total return: ${totalReturn >= 0 ? '+' : ''}${fmt(totalReturn, baseCurrency)} (${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%)
  Open positions: ${holdings.length}
  Closed trades: ${winCount + lossCount} (${winCount} wins, ${lossCount} losses, ${winCount + lossCount > 0 ? Math.round((winCount / (winCount + lossCount)) * 100) : 0}% win rate)

CURRENT HOLDINGS:
${holdingLines}

REALISED P&L BY TICKER (all time):
${realisedLines}

RECENT TRANSACTIONS (last 20):
${recentTxs}

ACCOUNTS: ${Object.values(portfolioMap).join(', ')}

PORTFOLIO HISTORY (monthly snapshots, first entry per month):
  First recorded: ${firstSnapshot?.snapshot_date ?? 'unknown'} — ${firstSnapshot ? fmt(firstSnapshot.portfolio_value, baseCurrency) : 'unknown'}
  Latest recorded: ${lastSnapshot?.snapshot_date ?? 'unknown'} — ${lastSnapshot ? fmt(lastSnapshot.portfolio_value, baseCurrency) : 'unknown'}
${historyLines}`

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  })
}
