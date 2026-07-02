/**
 * Appends missing daily FX rates to src/lib/fx-rates.json using the
 * ECB-backed Frankfurter API (no key needed).
 *
 * Run with: node scripts/update-fx-rates.mjs
 * Then commit + push — the rates ship with the next deploy.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FX_PATH = resolve(__dirname, '../src/lib/fx-rates.json')

const rates = JSON.parse(readFileSync(FX_PATH, 'utf-8'))
const dates = Object.keys(rates).sort()
const lastDate = dates[dates.length - 1]
const today = new Date().toISOString().slice(0, 10)

if (lastDate >= today) {
  console.log(`Already up to date (last entry: ${lastDate})`)
  process.exit(0)
}

// Fetch from the day after the last entry through today.
// Frankfurter serves EUR-base rates: EUR→USD and EUR→GBP; the file stores
// the inverse (USD_EUR = EUR per 1 USD), so invert.
const from = new Date(new Date(lastDate + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
const url = `https://api.frankfurter.dev/v1/${from}..${today}?base=EUR&symbols=USD,GBP`
console.log(`Fetching ${from} → ${today} ...`)

const res = await fetch(url)
if (!res.ok) {
  console.error(`Frankfurter API error: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const data = await res.json()

let added = 0
for (const [date, r] of Object.entries(data.rates ?? {})) {
  if (rates[date]) continue
  const entry = {}
  if (r.USD) entry.USD_EUR = +(1 / r.USD).toFixed(5)
  if (r.GBP) entry.GBP_EUR = +(1 / r.GBP).toFixed(5)
  if (Object.keys(entry).length === 0) continue
  rates[date] = entry
  added++
}

if (added === 0) {
  console.log('No new rates published yet (ECB publishes business days ~16:00 CET)')
  process.exit(0)
}

// Rewrite with sorted keys, compact like the original file
const sorted = Object.fromEntries(Object.entries(rates).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(FX_PATH, JSON.stringify(sorted))

const newLast = Object.keys(sorted).sort().pop()
console.log(`✓ Added ${added} days — file now ends ${newLast}`)
console.log('Commit and push to deploy the new rates.')
