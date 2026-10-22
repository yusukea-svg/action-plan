/**
 * 期限が近いもの(期限切れを含む)を集める。画面上部のお知らせに使う。
 * 対象:週次行動の期限日(完了以外)、最終目標の期限(完了済み案件を除く)。
 */
import { addDays, parseDateStr } from './dates'
import type { AppData } from './types'

export const DEADLINE_ALERT_DAYS = 3

export interface DeadlineItem {
  kind: 'action' | 'finalGoal'
  /** 行動ID または 最終目標ID */
  id: string
  caseId: string
  caseName: string
  title: string
  whom: string
  date: string
  /** 今日まであと何日か(0=今日、負数=期限切れ) */
  daysLeft: number
}

function diffDays(from: string, to: string): number {
  return Math.round((parseDateStr(to).getTime() - parseDateStr(from).getTime()) / 86_400_000)
}

export function upcomingDeadlines(data: AppData, today: string, days = DEADLINE_ALERT_DAYS): DeadlineItem[] {
  const limit = addDays(today, days)
  const caseMap = new Map(data.cases.map((c) => [c.id, c]))
  const items: DeadlineItem[] = []

  for (const a of data.weeklyActions) {
    const c = caseMap.get(a.caseId)
    if (!c || !a.dueDate || a.status === 'done' || a.dueDate > limit) continue
    items.push({
      kind: 'action',
      id: a.id,
      caseId: c.id,
      caseName: c.companyName,
      title: a.content,
      whom: a.whom,
      date: a.dueDate,
      daysLeft: diffDays(today, a.dueDate),
    })
  }

  for (const g of data.finalGoals) {
    const c = caseMap.get(g.caseId)
    if (!c || c.status === 'done' || !g.deadline || g.deadline > limit) continue
    items.push({
      kind: 'finalGoal',
      id: g.id,
      caseId: c.id,
      caseName: c.companyName,
      title: g.content || '最終目標',
      whom: '',
      date: g.deadline,
      daysLeft: diffDays(today, g.deadline),
    })
  }

  return items.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.caseName.localeCompare(b.caseName, 'ja')))
}

/** 例: 「今日」「あと2日」「3日超過」 */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return '今日'
  if (daysLeft > 0) return `あと${daysLeft}日`
  return `${-daysLeft}日超過`
}
