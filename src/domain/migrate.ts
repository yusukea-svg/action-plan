import { isDateStr, isMonthStr } from './dates'
import { newId, nowIso } from './id'
import { dedupeById, onePerCase } from './records'
import {
  SCHEMA_VERSION,
  type ActionStatus,
  type AppData,
  type BaseRecord,
  type Case,
  type CaseStatus,
  type Contact,
  type FinalGoal,
  type MonthlyGoal,
  type WeeklyAction,
} from './types'

/**
 * 旧バージョンのデータを最新形式へ移行する。
 * バージョン N → N+1 の変換を MIGRATIONS[N] に追加していく。
 *
 * 例(将来 v2 で案件に「業種」を追加する場合):
 *   1: (d) => ({ ...d, version: 2, cases: d.cases.map((c) => ({ ...c, industry: '' })) }),
 */
type RawData = Record<string, unknown> & { version: number }
const MIGRATIONS: Record<number, (d: RawData) => RawData> = {}

export class UnsupportedVersionError extends Error {
  constructor(version: number) {
    super(`このデータ(形式バージョン ${version})は、このアプリ(バージョン ${SCHEMA_VERSION})より新しい形式です。アプリを更新してください。`)
  }
}

export function migrate(input: unknown): AppData {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  let d: RawData = { ...obj, version: typeof obj.version === 'number' ? obj.version : 1 }
  if (d.version > SCHEMA_VERSION) throw new UnsupportedVersionError(d.version)
  while (d.version < SCHEMA_VERSION) {
    const step = MIGRATIONS[d.version]
    if (!step) throw new Error(`バージョン ${d.version} からの移行処理がありません`)
    d = step(d)
  }
  return sanitize(d)
}

// ---- 値の正規化(壊れた値・欠けた項目を既定値で補う) ----

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const id = (v: unknown): string => str(v) || newId()
const iso = (v: unknown): string => {
  const s = str(v)
  return s && !Number.isNaN(new Date(s).getTime()) ? new Date(s).toISOString() : nowIso()
}
const date = (v: unknown): string => {
  const s = str(v)
  return isDateStr(s) ? s : ''
}
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(str(v)) ? (str(v) as T) : fallback
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

const CASE_STATUSES: readonly CaseStatus[] = ['active', 'onhold', 'done']
const ACTION_STATUSES: readonly ActionStatus[] = ['todo', 'doing', 'done']

export function sanitizeCase(r: Record<string, unknown>): Case {
  return {
    id: id(r.id),
    updatedAt: iso(r.updatedAt),
    companyName: str(r.companyName),
    status: oneOf(r.status, CASE_STATUSES, 'active'),
    memo: str(r.memo),
  }
}

export function sanitizeContact(r: Record<string, unknown>): Contact {
  return {
    id: id(r.id),
    updatedAt: iso(r.updatedAt),
    caseId: str(r.caseId),
    name: str(r.name),
    title: str(r.title),
    contact: str(r.contact),
    memo: str(r.memo),
  }
}

export function sanitizeFinalGoal(r: Record<string, unknown>): FinalGoal {
  return { id: id(r.id), updatedAt: iso(r.updatedAt), caseId: str(r.caseId), content: str(r.content), deadline: date(r.deadline) }
}

export function sanitizeMonthlyGoal(r: Record<string, unknown>): MonthlyGoal {
  const p = Number(r.progress)
  return {
    id: id(r.id),
    updatedAt: iso(r.updatedAt),
    caseId: str(r.caseId),
    month: isMonthStr(str(r.month)) ? str(r.month) : '',
    content: str(r.content),
    progress: Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : 0,
  }
}

export function sanitizeWeeklyAction(r: Record<string, unknown>): WeeklyAction {
  return {
    id: id(r.id),
    updatedAt: iso(r.updatedAt),
    caseId: str(r.caseId),
    weekStart: date(r.weekStart),
    content: str(r.content),
    status: oneOf(r.status, ACTION_STATUSES, 'todo'),
    dueDate: date(r.dueDate),
    memo: str(r.memo),
  }
}

function sanitize(d: RawData): AppData {
  const cases = dedupeById(arr(d.cases).map(sanitizeCase).filter((c) => c.companyName))
  const caseIds = new Set(cases.map((c) => c.id))
  const owned = <T extends BaseRecord & { caseId: string }>(xs: T[]) => dedupeById(xs.filter((x) => caseIds.has(x.caseId)))
  return {
    version: SCHEMA_VERSION,
    cases,
    contacts: owned(arr(d.contacts).map(sanitizeContact)),
    finalGoals: onePerCase(owned(arr(d.finalGoals).map(sanitizeFinalGoal))),
    monthlyGoals: owned(arr(d.monthlyGoals).map(sanitizeMonthlyGoal)).filter((g) => g.month),
    weeklyActions: owned(arr(d.weeklyActions).map(sanitizeWeeklyAction)).filter((a) => a.weekStart),
  }
}
