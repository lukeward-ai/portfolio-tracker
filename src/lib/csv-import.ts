export interface ParsedRow {
  id: string
  date: string
  type: 'BUY' | 'SELL'
  ticker: string
  name: string | null
  quantity: number
  price: number
  currency: string
  fees: number
  valid: boolean
  error?: string
}

export type BrokerFormat = 'revolut' | 'trading212' | 'freetrade' | 'generic'

export interface ParseResult {
  rows: ParsedRow[]
  format: BrokerFormat
  totalRows: number
  validRows: number
  invalidRows: number
}

// ─── CSV tokeniser ─────────────────────────────────────────────────────────────

function tokenise(text: string): string[][] {
  const content = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = content.split('\n')
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (c === ',' && !inQuotes) {
          fields.push(current.trim().replace(/^"|"$/g, ''))
          current = ''
        } else {
          current += c
        }
      }
      fields.push(current.trim().replace(/^"|"$/g, ''))
      return fields
    })
}

// ─── Format detection ──────────────────────────────────────────────────────────

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function detectFormat(headers: string[]): BrokerFormat {
  const h = headers.map(normaliseHeader)
  if (h.some((x) => x === 'pricepershare') || h.some((x) => x === 'totalamount')) return 'revolut'
  if (h.some((x) => x === 'noofshares') || h.some((x) => x.startsWith('currencyprice'))) return 'trading212'
  if (h.some((x) => x === 'transactionvalue') && h.some((x) => x === 'shares')) return 'freetrade'
  return 'generic'
}

// ─── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()

  // ISO 8601: 2024-01-15 or 2024-01-15T10:30:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // Jan 15, 2024
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseNum(raw: string): number {
  if (!raw) return 0
  return parseFloat(raw.replace(/[^0-9.\-]/g, '')) || 0
}

function parseType(raw: string): 'BUY' | 'SELL' | null {
  const s = raw.toLowerCase().trim()
  if (s.includes('buy') || s === 'b') return 'BUY'
  if (s.includes('sell') || s === 's') return 'SELL'
  return null
}

let uid = 0

function nextId() {
  return `row-${++uid}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Format parsers ────────────────────────────────────────────────────────────

function parseRevolut(headers: string[], data: string[][]): ParsedRow[] {
  const h = headers.map(normaliseHeader)
  const idx = (name: string) => h.indexOf(name)

  const iDate = idx('date')
  const iTicker = idx('ticker')
  const iType = idx('type')
  const iQty = idx('quantity')
  const iPrice = idx('pricepershare')
  const iTotal = idx('totalamount')
  const iCurrency = idx('currency')
  const iFees = h.findIndex((x) => x.includes('fee'))

  return data.map((row) => {
    const date = parseDate(row[iDate] ?? '')
    const type = parseType(row[iType] ?? '')
    const ticker = (row[iTicker] ?? '').trim().toUpperCase()
    const quantity = parseNum(row[iQty] ?? '')
    const price = parseNum(row[iPrice] ?? '') || (quantity > 0 ? parseNum(row[iTotal] ?? '') / quantity : 0)
    const currency = (row[iCurrency] ?? 'USD').toUpperCase()
    const fees = iFees >= 0 ? parseNum(row[iFees] ?? '') : 0

    const errors: string[] = []
    if (!date) errors.push('invalid date')
    if (!type) errors.push('unknown type')
    if (!ticker) errors.push('missing ticker')
    if (quantity <= 0) errors.push('invalid quantity')
    if (price <= 0) errors.push('invalid price')

    return {
      id: nextId(), date: date ?? '', type: type ?? 'BUY', ticker, name: null,
      quantity, price, currency, fees,
      valid: errors.length === 0, error: errors.join(', ') || undefined,
    }
  })
}

function parseTrading212(headers: string[], data: string[][]): ParsedRow[] {
  const h = headers.map(normaliseHeader)
  const idx = (name: string) => h.findIndex((x) => x.includes(name))

  const iAction = idx('action')
  const iTime = idx('time')
  const iTicker = idx('ticker')
  const iShares = idx('noofshares')
  const iPrice = idx('price')
  const iCurrency = h.findIndex((x) => x.startsWith('currency') && x.includes('price'))
  const iFees = h.findIndex((x) => x.includes('chargingcommission') || x.includes('commission'))

  return data.map((row) => {
    const rawAction = row[iAction] ?? ''
    const type = parseType(rawAction)
    const date = parseDate(row[iTime] ?? '')
    const ticker = (row[iTicker] ?? '').trim().toUpperCase()
    const quantity = parseNum(row[iShares] ?? '')
    const price = parseNum(row[iPrice] ?? '')
    const currency = ((iCurrency >= 0 ? row[iCurrency] : '') || 'GBP').toUpperCase()
    const fees = iFees >= 0 ? Math.abs(parseNum(row[iFees] ?? '')) : 0

    // Skip non-trade rows (dividends, deposits, etc.)
    if (!type && !rawAction.toLowerCase().includes('buy') && !rawAction.toLowerCase().includes('sell')) {
      return { id: nextId(), date: '', type: 'BUY' as const, ticker: '', name: null, quantity: 0, price: 0, currency: 'GBP', fees: 0, valid: false, error: 'not a trade row' }
    }

    const errors: string[] = []
    if (!date) errors.push('invalid date')
    if (!type) errors.push('unknown type')
    if (!ticker) errors.push('missing ticker')
    if (quantity <= 0) errors.push('invalid quantity')
    if (price <= 0) errors.push('invalid price')

    return {
      id: nextId(), date: date ?? '', type: type ?? 'BUY', ticker, name: null,
      quantity, price, currency, fees,
      valid: errors.length === 0, error: errors.join(', ') || undefined,
    }
  })
}

function parseFreetrade(headers: string[], data: string[][]): ParsedRow[] {
  const h = headers.map(normaliseHeader)
  const idx = (name: string) => h.findIndex((x) => x.includes(name))

  const iType = idx('type')
  const iTime = h.findIndex((x) => x === 'timestamp' || x.includes('date'))
  const iTitle = idx('title')
  const iShares = h.findIndex((x) => x === 'shares' || x === 'quantity')
  const iPrice = idx('price')
  const iCurrency = idx('currency')

  return data.map((row) => {
    const type = parseType(row[iType] ?? '')
    const date = parseDate(row[iTime] ?? '')
    const name = (row[iTitle] ?? '').trim() || null
    const quantity = parseNum(row[iShares] ?? '')
    const price = parseNum(row[iPrice] ?? '')
    const currency = ((iCurrency >= 0 ? row[iCurrency] : '') || 'GBP').toUpperCase()

    // Freetrade may not include ticker — use first word of title as fallback
    const ticker = name?.split(' ')[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''

    const errors: string[] = []
    if (!date) errors.push('invalid date')
    if (!type) errors.push('unknown type')
    if (!ticker) errors.push('missing ticker')
    if (quantity <= 0) errors.push('invalid quantity')
    if (price <= 0) errors.push('invalid price')

    return {
      id: nextId(), date: date ?? '', type: type ?? 'BUY', ticker, name,
      quantity, price, currency, fees: 0,
      valid: errors.length === 0, error: errors.join(', ') || undefined,
    }
  })
}

function parseGeneric(headers: string[], data: string[][]): ParsedRow[] {
  const h = headers.map(normaliseHeader)

  function find(...candidates: string[]): number {
    for (const c of candidates) {
      const i = h.findIndex((x) => x.includes(c))
      if (i >= 0) return i
    }
    return -1
  }

  const iDate = find('date', 'time', 'timestamp', 'datetime')
  const iType = find('type', 'action', 'side', 'direction')
  const iTicker = find('ticker', 'symbol', 'stock', 'isin')
  const iName = find('name', 'description', 'title')
  const iQty = find('quantity', 'shares', 'qty', 'units', 'amount')
  const iPrice = find('price', 'rate', 'pricepershare')
  const iCurrency = find('currency', 'ccy')
  const iFees = find('fee', 'commission', 'charge')

  return data.map((row) => {
    const date = iDate >= 0 ? parseDate(row[iDate] ?? '') : null
    const type = iType >= 0 ? parseType(row[iType] ?? '') : null
    const ticker = iTicker >= 0 ? (row[iTicker] ?? '').trim().toUpperCase() : ''
    const name = iName >= 0 ? (row[iName] ?? '').trim() || null : null
    const quantity = iQty >= 0 ? parseNum(row[iQty] ?? '') : 0
    const price = iPrice >= 0 ? parseNum(row[iPrice] ?? '') : 0
    const currency = (iCurrency >= 0 ? (row[iCurrency] ?? '') : 'USD').toUpperCase() || 'USD'
    const fees = iFees >= 0 ? Math.abs(parseNum(row[iFees] ?? '')) : 0

    const errors: string[] = []
    if (!date) errors.push('invalid date')
    if (!type) errors.push('unknown type')
    if (!ticker) errors.push('missing ticker')
    if (quantity <= 0) errors.push('invalid quantity')
    if (price <= 0) errors.push('invalid price')

    return {
      id: nextId(), date: date ?? '', type: type ?? 'BUY', ticker, name,
      quantity, price, currency, fees,
      valid: errors.length === 0, error: errors.join(', ') || undefined,
    }
  })
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function parseCSVFile(text: string): ParseResult {
  const rows = tokenise(text)
  if (rows.length < 2) return { rows: [], format: 'generic', totalRows: 0, validRows: 0, invalidRows: 0 }

  const [headerRow, ...dataRows] = rows
  const format = detectFormat(headerRow)

  let parsed: ParsedRow[]
  if (format === 'revolut') parsed = parseRevolut(headerRow, dataRows)
  else if (format === 'trading212') parsed = parseTrading212(headerRow, dataRows)
  else if (format === 'freetrade') parsed = parseFreetrade(headerRow, dataRows)
  else parsed = parseGeneric(headerRow, dataRows)

  // Filter out completely empty rows
  const nonEmpty = parsed.filter((r) => r.ticker || r.date || r.quantity)

  return {
    rows: nonEmpty,
    format,
    totalRows: nonEmpty.length,
    validRows: nonEmpty.filter((r) => r.valid).length,
    invalidRows: nonEmpty.filter((r) => !r.valid).length,
  }
}

export const FORMAT_LABELS: Record<BrokerFormat, string> = {
  revolut: 'Revolut',
  trading212: 'Trading 212',
  freetrade: 'Freetrade',
  generic: 'Generic CSV',
}
