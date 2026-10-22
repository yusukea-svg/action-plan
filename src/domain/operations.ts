/**
 * データ操作(純粋関数)。UI からは store 経由で呼び出す。
 * どの関数も元のデータを変更せず、新しい AppData を返す。
 */
import { newId, nowIso } from './id'
import type { AppData, Case, ChildCollection, Collection, FinalGoal, WeeklyAction } from './types'
import { CHILD_COLLECTIONS } from './types'

type RecordOf<C extends Collection> = AppData[C][number]
/** 新規作成・更新時に UI から渡す値(id・更新日時はこちらで付ける) */
export type Draft<C extends Collection> = Omit<RecordOf<C>, 'id' | 'updatedAt'> & { id?: string }

/** レコードを追加、または同じIDのものを更新する */
export function upsert<C extends Collection>(data: AppData, collection: C, draft: Draft<C>): { data: AppData; record: RecordOf<C> } {
  const record = { ...draft, id: draft.id ?? newId(), updatedAt: nowIso() } as RecordOf<C>
  const list = data[collection] as RecordOf<C>[]
  const exists = list.some((r) => r.id === record.id)
  const next = exists ? list.map((r) => (r.id === record.id ? record : r)) : [...list, record]
  return { data: { ...data, [collection]: next }, record }
}

/** 複数レコードをまとめて追加・更新する(まとめて入力用) */
export function upsertMany<C extends Collection>(data: AppData, collection: C, drafts: Draft<C>[]): AppData {
  return drafts.reduce((d, draft) => upsert(d, collection, draft).data, data)
}

export function remove(data: AppData, collection: Collection, id: string): AppData {
  if (collection === 'cases') return removeCase(data, id)
  return { ...data, [collection]: (data[collection] as { id: string }[]).filter((r) => r.id !== id) }
}

/** 案件と、それに紐づく関係者・目標・行動をまとめて削除 */
export function removeCase(data: AppData, caseId: string): AppData {
  const next: AppData = { ...data, cases: data.cases.filter((c) => c.id !== caseId) }
  for (const col of CHILD_COLLECTIONS) {
    ;(next[col] as { caseId: string }[]) = (data[col] as { caseId: string }[]).filter((r) => r.caseId !== caseId)
  }
  return next
}

/** 最終目標を設定(1案件1件なので既存があれば更新) */
export function setFinalGoal(data: AppData, caseId: string, content: string, deadline: string): AppData {
  const existing = data.finalGoals.find((g) => g.caseId === caseId)
  return upsert(data, 'finalGoals', { id: existing?.id, caseId, content, deadline }).data
}

export function setActionStatus(data: AppData, actionId: string, status: WeeklyAction['status']): AppData {
  const a = data.weeklyActions.find((x) => x.id === actionId)
  if (!a || a.status === status) return data
  return upsert(data, 'weeklyActions', { ...a, status }).data
}

// ---- 参照系 ----

export function childrenOf<C extends ChildCollection>(data: AppData, collection: C, caseId: string): AppData[C] {
  return (data[collection] as { caseId: string }[]).filter((r) => r.caseId === caseId) as AppData[C]
}

export function finalGoalOf(data: AppData, caseId: string): FinalGoal | undefined {
  return data.finalGoals.find((g) => g.caseId === caseId)
}

export function caseById(data: AppData, id: string): Case | undefined {
  return data.cases.find((c) => c.id === id)
}

export function weekActionCounts(data: AppData, caseId: string, weekStart: string): { done: number; total: number } {
  const xs = data.weeklyActions.filter((a) => a.caseId === caseId && a.weekStart === weekStart)
  return { done: xs.filter((a) => a.status === 'done').length, total: xs.length }
}

/** 期限日 → 内容 の順で並べる(期限なしは後ろ) */
export function sortActions(xs: WeeklyAction[]): WeeklyAction[] {
  return [...xs].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    return a.content.localeCompare(b.content, 'ja')
  })
}

export function isEmpty(data: AppData): boolean {
  return data.cases.length === 0
}
