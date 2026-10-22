import { describe, expect, it } from 'vitest'
import { daysLeftLabel, upcomingDeadlines } from '../src/domain/deadlines'
import * as ops from '../src/domain/operations'
import { emptyData, type AppData, type WeeklyAction } from '../src/domain/types'

const TODAY = '2026-10-22'

function build(): AppData {
  let d = emptyData()
  const a = ops.upsert(d, 'cases', { companyName: 'A案件', status: 'active', memo: '' })
  d = a.data
  const done = ops.upsert(d, 'cases', { companyName: '完了案件', status: 'done', memo: '' })
  d = done.data
  const act = (content: string, dueDate: string, status: WeeklyAction['status'] = 'todo', caseId = a.record.id) =>
    (d = ops.upsert(d, 'weeklyActions', { caseId, weekStart: '2026-10-19', content, whom: '', status, dueDate, memo: '' }).data)
  act('今日', '2026-10-22')
  act('3日後', '2026-10-25')
  act('4日後', '2026-10-26')
  act('期限切れ', '2026-10-20')
  act('完了済み', '2026-10-23', 'done')
  act('期限なし', '')
  d = ops.setFinalGoal(d, a.record.id, '受注', '2026-10-24')
  d = ops.setFinalGoal(d, done.record.id, '完了案件の目標', '2026-10-23')
  return d
}

describe('upcomingDeadlines', () => {
  it('3日以内と期限切れを、完了済みを除いて日付順に返す', () => {
    const items = upcomingDeadlines(build(), TODAY)
    expect(items.map((i) => i.title)).toEqual(['期限切れ', '今日', '受注', '3日後'])
    expect(items.map((i) => i.daysLeft)).toEqual([-2, 0, 2, 3])
    expect(items.find((i) => i.title === '受注')?.kind).toBe('finalGoal')
  })
  it('表示ラベル', () => {
    expect(daysLeftLabel(0)).toBe('今日')
    expect(daysLeftLabel(2)).toBe('あと2日')
    expect(daysLeftLabel(-1)).toBe('1日超過')
  })
})
