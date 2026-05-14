import type { Portfolio } from './types'

export function accountLabel(portfolio: Pick<Portfolio, 'name' | 'description'>): string {
  const broker = portfolio.description?.trim()
  const name = portfolio.name.trim()
  if (!broker || broker === name) return name
  return `${broker} — ${name}`
}
