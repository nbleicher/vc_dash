import { ZONE } from './constants'

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function estParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(formatted.map((part) => [part.type, part.value]))
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

export function estDateKey(date: Date): string {
  const p = estParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function formatDateKey(dateKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  if (!yearRaw || !monthRaw || !dayRaw) return dateKey
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return dateKey
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
}

export function formatWeekRangeLabel(weekKey: string): string {
  const dates = monFriDatesForWeek(weekKey)
  const [, startMonth, startDay] = dates[0].split('-').map(Number)
  const [, endMonth, endDay] = dates[dates.length - 1].split('-').map(Number)
  return `${startMonth}/${startDay}-${endMonth}/${endDay}`
}

export function weekKeyFromDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey
  return weekKeyMonFri(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return 'N/A'
  const d = new Date(normalizeIsoTimestamp(ts))
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: ZONE,
  }).format(d)
}

/** Normalize ISO strings so Date() parses correctly (e.g. strip redundant Z when offset present). */
export function normalizeIsoTimestamp(ts: string): string {
  if (!ts) return ts
  return ts.replace(/([+-]\d{2}:\d{2})Z$/i, '$1')
}

export function mondayFor(date: Date): Date {
  const p = estParts(date)
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  const day = base.getUTCDay()
  const delta = day === 0 ? -6 : 1 - day
  base.setUTCDate(base.getUTCDate() + delta)
  return base
}

export function weekKeyMonFri(date: Date): string {
  const monday = mondayFor(date)
  const y = monday.getUTCFullYear()
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(monday.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monFriDatesForWeek(weekKey: string): string[] {
  const [y, m, d] = weekKey.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const out: string[] = []
  for (let i = 0; i < 5; i += 1) {
    const c = new Date(base)
    c.setUTCDate(base.getUTCDate() + i)
    const ky = c.getUTCFullYear()
    const km = String(c.getUTCMonth() + 1).padStart(2, '0')
    const kd = String(c.getUTCDate()).padStart(2, '0')
    out.push(`${ky}-${km}-${kd}`)
  }
  return out
}

export function computeMetrics(
  calls: number,
  sales: number
): { marketing: number; cpa: number | null; cvr: number | null } {
  const marketing = calls * 15
  const cpa = sales > 0 ? marketing / sales : marketing
  const cvr = calls > 0 ? sales / calls : null
  return { marketing, cpa, cvr }
}

export function formatNum(v: number | null, digits = 2): string {
  if (v === null || Number.isNaN(v)) return 'N/A'
  return v.toFixed(digits)
}

export function formatPctDelta(delta: number | null): string {
  if (delta === null || Number.isNaN(delta)) return 'N/A'
  if (delta === 0) return '0.00% on target'
  return delta > 0 ? `+${delta.toFixed(2)}% over` : `${Math.abs(delta).toFixed(2)}% under`
}

export function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}
