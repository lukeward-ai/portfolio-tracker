import type { Portfolio } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function accountLabel(portfolio: Pick<Portfolio, 'name' | 'description'>): string {
  const broker = portfolio.description?.trim()
  const name = UUID_RE.test(portfolio.name.trim()) ? '' : portfolio.name.trim()
  const display = name || broker || 'Unnamed Account'
  if (!broker || broker === display) return display
  return `${broker} — ${name}`
}
