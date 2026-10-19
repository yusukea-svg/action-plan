/**
 * 日付ユーティリティ。日付はすべてローカル時刻の YYYY-MM-DD 文字列で扱う(タイムゾーンずれ防止)。
 * 週は月曜日始まり。
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function isDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toDateStr(parseDateStr(s)) === s
}

export function isMonthStr(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

export function todayStr(now = new Date()): string {
  return toDateStr(now)
}

export function addDays(s: string, days: number): string {
  const d = parseDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** 指定日を含む週の月曜日 */
export function weekStartOf(s: string): string {
  const d = parseDateStr(s)
  const diff = (d.getDay() + 6) % 7 // 月=0 ... 日=6
  d.setDate(d.getDate() - diff)
  return toDateStr(d)
}

export function currentWeekStart(now = new Date()): string {
  return weekStartOf(toDateStr(now))
}

export function weekEnd(weekStart: string): string {
  return addDays(weekStart, 6)
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 例: 10/20(月) */
export function formatMd(s: string): string {
  if (!s) return ''
  const d = parseDateStr(s)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`
}

/** 例: 2026/10/20 */
export function formatYmd(s: string): string {
  return s ? s.replaceAll('-', '/') : ''
}

/** 例: 10/20(月)〜10/26(日) */
export function formatWeekRange(weekStart: string): string {
  return `${formatMd(weekStart)}〜${formatMd(weekEnd(weekStart))}`
}

/** 例: 2026年10月 */
export function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${y}年${Number(mo)}月`
}

export function currentMonth(now = new Date()): string {
  return toDateStr(now).slice(0, 7)
}

/** 例: 2026/10/20 14:05 */
export function formatDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${toDateStr(d).replaceAll('-', '/')} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function daysBetween(fromIso: string, to = new Date()): number {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86_400_000)
}
