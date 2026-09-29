const DAY = 86_400_000

/** ISO 8601 week label, e.g. 2026-W40. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = d.getUTCDay() || 7 // Monday = 1 ... Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday) // Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface ReportWindow {
  /** Monday 00:00 UTC of the reported week. */
  start: Date
  /** The following Monday 00:00 UTC (exclusive). */
  end: Date
  /** Monday 00:00 UTC of the week before, for week-over-week comparisons. */
  prevStart: Date
  label: string
}

/** The last complete ISO week before `now` (a Monday run reports on the week that just ended). */
export function reportWindow(now: Date): ReportWindow {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const weekday = new Date(today).getUTCDay() || 7
  const end = new Date(today - (weekday - 1) * DAY)
  const start = new Date(end.getTime() - 7 * DAY)
  return { start, end, prevStart: new Date(start.getTime() - 7 * DAY), label: isoWeek(start) }
}

export const ymd = (date: Date) => date.toISOString().slice(0, 10)
