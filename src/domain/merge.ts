/**
 * 読み込んだデータを既存データに取り込む。
 *
 * - merge:   IDで突き合わせ、同じIDなら更新日時が新しい方を採用。片方にしか無いものは残す。
 * - replace: 読み込んだデータで全置換。
 *
 * 将来「差分を一覧で選ぶ画面」を作る場合は、diffData() の結果(レコードごとの判定)を UI に出し、
 * 選ばれた側を applyDecisions のような関数で組み立てればよい。
 */
import { dedupeById, isNewer, onePerCase } from './records'
import { COLLECTIONS, type AppData, type BaseRecord, type Collection } from './types'
import { CHILD_COLLECTIONS } from './types'

export type ImportMode = 'merge' | 'replace'

/** レコード単位の判定 */
export type RecordDecision = 'added' | 'updated' | 'keptLocal' | 'same'

export interface RecordDiff {
  collection: Collection
  id: string
  decision: RecordDecision
}

export interface CollectionStats {
  /** 読み込みファイル内の件数 */
  incoming: number
  /** 新規追加される件数 */
  added: number
  /** 読み込み側が新しく、上書きされる件数 */
  updated: number
  /** 手元の方が新しい(または同じ)ため手元を残す件数 */
  kept: number
  /** 取り込み後の件数 */
  after: number
}

export type ImportStats = Record<Collection, CollectionStats>

export function diffData(local: AppData, incoming: AppData): RecordDiff[] {
  const out: RecordDiff[] = []
  for (const col of COLLECTIONS) {
    const localMap = new Map((local[col] as BaseRecord[]).map((r) => [r.id, r]))
    for (const r of incoming[col] as BaseRecord[]) {
      const l = localMap.get(r.id)
      const decision: RecordDecision = !l ? 'added' : isNewer(r, l) ? 'updated' : r.updatedAt === l.updatedAt ? 'same' : 'keptLocal'
      out.push({ collection: col, id: r.id, decision })
    }
  }
  return out
}

export function mergeData(local: AppData, incoming: AppData): AppData {
  const result = { ...local }
  for (const col of COLLECTIONS) {
    ;(result[col] as BaseRecord[]) = dedupeById([...(local[col] as BaseRecord[]), ...(incoming[col] as BaseRecord[])])
  }
  result.finalGoals = onePerCase(result.finalGoals)
  // 親案件が無い子レコードは除外(通常は発生しない)
  const caseIds = new Set(result.cases.map((c) => c.id))
  for (const col of CHILD_COLLECTIONS) {
    ;(result[col] as { caseId: string }[]) = (result[col] as { caseId: string }[]).filter((r) => caseIds.has(r.caseId))
  }
  return result
}

export function applyImport(local: AppData, incoming: AppData, mode: ImportMode): AppData {
  return mode === 'replace' ? incoming : mergeData(local, incoming)
}

export function importStats(local: AppData, incoming: AppData, mode: ImportMode): ImportStats {
  const after = applyImport(local, incoming, mode)
  const diffs = mode === 'merge' ? diffData(local, incoming) : []
  const stats = {} as ImportStats
  for (const col of COLLECTIONS) {
    const ds = diffs.filter((d) => d.collection === col)
    const n = (incoming[col] as unknown[]).length
    stats[col] = {
      incoming: n,
      added: mode === 'merge' ? ds.filter((d) => d.decision === 'added').length : n,
      updated: ds.filter((d) => d.decision === 'updated').length,
      kept: ds.filter((d) => d.decision === 'keptLocal' || d.decision === 'same').length,
      after: (after[col] as unknown[]).length,
    }
  }
  return stats
}
