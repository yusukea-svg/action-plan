import type { BaseRecord, FinalGoal } from './types'

/** a の方が新しければ true(同時刻なら false) */
export function isNewer(a: BaseRecord, b: BaseRecord): boolean {
  return new Date(a.updatedAt).getTime() > new Date(b.updatedAt).getTime()
}

/** 同じIDが複数あれば更新日時が新しい方だけ残す(順序は最初の出現位置) */
export function dedupeById<T extends BaseRecord>(xs: T[]): T[] {
  const map = new Map<string, T>()
  for (const x of xs) {
    const prev = map.get(x.id)
    if (!prev || isNewer(x, prev)) map.set(x.id, x)
  }
  return [...map.values()]
}

/** 最終目標は1案件1件。複数あれば更新日時が新しい方を残す */
export function onePerCase(goals: FinalGoal[]): FinalGoal[] {
  const map = new Map<string, FinalGoal>()
  for (const g of goals) {
    const prev = map.get(g.caseId)
    if (!prev || isNewer(g, prev)) map.set(g.caseId, g)
  }
  return [...map.values()]
}
