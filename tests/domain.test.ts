import { describe, expect, it } from 'vitest'
import { addDays, formatWeekRange, isDateStr, weekStartOf } from '../src/domain/dates'
import { importStats, mergeData } from '../src/domain/merge'
import { migrate, UnsupportedVersionError } from '../src/domain/migrate'
import * as ops from '../src/domain/operations'
import { emptyData, SCHEMA_VERSION, type AppData } from '../src/domain/types'

function sample(): AppData {
  let d = emptyData()
  const c = ops.upsert(d, 'cases', { companyName: '株式会社A', status: 'active', memo: '' })
  d = c.data
  d = ops.upsert(d, 'contacts', { caseId: c.record.id, name: '山田', title: '部長', contact: '', memo: '' }).data
  d = ops.setFinalGoal(d, c.record.id, '受注', '2026-12-25')
  d = ops.upsert(d, 'monthlyGoals', { caseId: c.record.id, month: '2026-10', content: '提案', progress: 50 }).data
  d = ops.upsert(d, 'weeklyActions', {
    caseId: c.record.id,
    weekStart: '2026-10-19',
    content: '訪問',
    status: 'todo',
    dueDate: '2026-10-21',
    memo: '',
  }).data
  return d
}

describe('dates', () => {
  it('週は月曜始まり', () => {
    expect(weekStartOf('2026-10-20')).toBe('2026-10-19') // 火曜
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19') // 月曜
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19') // 日曜
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26')
  })
  it('日付計算と表示', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(formatWeekRange('2026-10-19')).toBe('10/19(月)〜10/25(日)')
    expect(isDateStr('2026-02-30')).toBe(false)
  })
})

describe('operations', () => {
  it('案件削除で子レコードも消える', () => {
    const d = sample()
    const after = ops.removeCase(d, d.cases[0]!.id)
    expect(after.cases).toHaveLength(0)
    expect(after.contacts).toHaveLength(0)
    expect(after.finalGoals).toHaveLength(0)
    expect(after.monthlyGoals).toHaveLength(0)
    expect(after.weeklyActions).toHaveLength(0)
  })
  it('最終目標は1案件1件', () => {
    let d = sample()
    d = ops.setFinalGoal(d, d.cases[0]!.id, '変更', '')
    expect(d.finalGoals).toHaveLength(1)
    expect(d.finalGoals[0]!.content).toBe('変更')
  })
})

describe('migrate', () => {
  it('壊れた値を補正し、親のない子レコードを除く', () => {
    const d = migrate({
      cases: [{ id: 'c1', companyName: 'A', status: '???' }, { id: 'c2', companyName: '' }],
      monthlyGoals: [{ caseId: 'c1', month: '2026-10', progress: 150 }],
      weeklyActions: [{ caseId: 'nope', weekStart: '2026-10-19' }],
    })
    expect(d.version).toBe(SCHEMA_VERSION)
    expect(d.cases).toHaveLength(1)
    expect(d.cases[0]!.status).toBe('active')
    expect(d.monthlyGoals[0]!.progress).toBe(100)
    expect(d.weeklyActions).toHaveLength(0)
  })
  it('新しすぎる形式は拒否', () => {
    expect(() => migrate({ version: SCHEMA_VERSION + 1, cases: [] })).toThrow(UnsupportedVersionError)
  })
})

describe('merge', () => {
  it('同じIDは更新日時が新しい方を採用し、片方にしかないものは残す', () => {
    const local = sample()
    const remote = structuredClone(local)
    const caseId = local.cases[0]!.id
    // remote 側で行動を更新(新しい)
    remote.weeklyActions[0] = { ...remote.weeklyActions[0]!, status: 'done', updatedAt: '2099-01-01T00:00:00.000Z' }
    // local 側で案件メモを更新(local が新しい)
    local.cases[0] = { ...local.cases[0]!, memo: 'local', updatedAt: '2099-01-01T00:00:00.000Z' }
    // remote 側だけに関係者を追加
    remote.contacts.push({ ...remote.contacts[0]!, id: 'new-contact', name: '佐藤' })

    const merged = mergeData(local, remote)
    expect(merged.weeklyActions[0]!.status).toBe('done')
    expect(merged.cases[0]!.memo).toBe('local')
    expect(merged.contacts.map((c) => c.name).sort()).toEqual(['佐藤', '山田'])
    expect(merged.cases.every((c) => c.id === caseId)).toBe(true)

    const stats = importStats(local, remote, 'merge')
    expect(stats.contacts.added).toBe(1)
    expect(stats.weeklyActions.updated).toBe(1)
    expect(stats.cases.kept).toBe(1)
  })
  it('全置換の件数', () => {
    const stats = importStats(sample(), emptyData(), 'replace')
    expect(stats.cases.after).toBe(0)
  })
})
