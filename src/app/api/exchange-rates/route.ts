import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const CURRENCIES = ['USD', 'EUR', 'GBP']

export async function GET() {
  const supabase = createAdminClient()

  // Check cache (max 1 hour old)
  const { data: cached } = await supabase
    .from('exchange_rate_cache')
    .select('*')
    .gt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (cached && cached.length >= 6) {
    const rates: Record<string, number> = {}
    for (const row of cached) {
      rates[`${row.base}_${row.target}`] = row.rate
    }
    return NextResponse.json({ rates })
  }

  try {
    // Use open.er-api.com (free, no key needed for basic rates)
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()

    if (data.result !== 'success') throw new Error('Exchange rate fetch failed')

    const usdRates = data.rates as Record<string, number>
    const rates: Record<string, number> = {}
    const upserts = []

    for (const base of CURRENCIES) {
      for (const target of CURRENCIES) {
        if (base === target) continue
        // Convert through USD
        const rate = base === 'USD'
          ? usdRates[target]
          : (1 / usdRates[base]) * usdRates[target]

        rates[`${base}_${target}`] = rate
        upserts.push({
          id: `${base}_${target}`,
          base,
          target,
          rate,
          updated_at: new Date().toISOString(),
        })
      }
    }

    await supabase.from('exchange_rate_cache').upsert(upserts)

    return NextResponse.json({ rates })
  } catch (err) {
    console.error('Exchange rate error:', err)
    // Fallback approximate rates
    return NextResponse.json({
      rates: {
        USD_EUR: 0.92, USD_GBP: 0.79,
        EUR_USD: 1.09, EUR_GBP: 0.86,
        GBP_USD: 1.27, GBP_EUR: 1.16,
      }
    })
  }
}
