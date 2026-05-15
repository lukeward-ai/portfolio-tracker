import type { MarketEvent, MarketEventType } from './types'

export function filterEventsByTimeframe(events: MarketEvent[], days: number): MarketEvent[] {
  if (days === 0) return events
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return events.filter((e) => {
    const d = new Date(e.date)
    return d >= now && d <= cutoff
  })
}

export function filterEventsByType(events: MarketEvent[], type: MarketEventType | 'all'): MarketEvent[] {
  if (type === 'all') return events
  return events.filter((e) => e.type === type)
}

export function sortEventsByDate(events: MarketEvent[]): MarketEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date))
}

export function getUpcomingEvents(events: MarketEvent[], limit?: number): MarketEvent[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const upcoming = events
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
  return limit ? upcoming.slice(0, limit) : upcoming
}

export function generateWhatToWatch(events: MarketEvent[]): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const next7 = new Date(now)
  next7.setDate(next7.getDate() + 7)

  const soon = events.filter((e) => {
    const d = new Date(e.date)
    return d >= now && d <= next7
  })

  if (soon.length === 0) {
    return 'No earnings or dividend events are scheduled in the next 7 days for your holdings or watchlist.'
  }

  const earnings = soon.filter((e) => e.type === 'earnings')
  const dividends = soon.filter((e) => e.type === 'dividend' && e.exDividendDate)
  const parts: string[] = []

  if (earnings.length > 0) {
    const names = earnings.map((e) => e.ticker ?? e.name).slice(0, 3).join(', ')
    const suffix = earnings.length > 3 ? ` and ${earnings.length - 3} more` : ''
    parts.push(`${names}${suffix} report${earnings.length === 1 ? 's' : ''} earnings in the next 7 days.`)
  }

  if (dividends.length > 0) {
    const names = dividends.map((e) => e.ticker).slice(0, 2).join(' and ')
    parts.push(`${names} ${dividends.length === 1 ? 'goes' : 'go'} ex-dividend soon.`)
  }

  if (earnings.length > 0) {
    parts.push('Earnings reports can cause significant price moves — review position sizing before results.')
  }

  return parts.join(' ')
}

export function eventTypeLabel(type: MarketEventType): string {
  if (type === 'earnings') return 'Earnings'
  if (type === 'dividend') return 'Dividend'
  return 'Economic'
}

export function eventTypeColor(type: MarketEventType): string {
  if (type === 'earnings') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400'
  if (type === 'dividend') return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
  return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400'
}
