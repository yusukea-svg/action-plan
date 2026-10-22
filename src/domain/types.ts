/**
 * データ構造の定義。
 * 項目追加・形式変更時は SCHEMA_VERSION を上げ、migrate.ts に移行処理を追加する。
 */
export const SCHEMA_VERSION = 2

export type CaseStatus = 'active' | 'onhold' | 'done'
export type ActionStatus = 'todo' | 'doing' | 'done'

/** すべてのレコードが持つ共通項目 */
export interface BaseRecord {
  id: string
  /** ISO 8601 形式の更新日時 */
  updatedAt: string
}

export interface Case extends BaseRecord {
  /** 案件名(画面上の表記は「案件名」。v1 で会社名として作った項目をそのまま使っている) */
  companyName: string
  status: CaseStatus
  memo: string
}

export interface Contact extends BaseRecord {
  caseId: string
  name: string
  title: string
  contact: string
  memo: string
}

/** 最終目標(1案件につき1件) */
export interface FinalGoal extends BaseRecord {
  caseId: string
  content: string
  /** YYYY-MM-DD(未設定は空文字) */
  deadline: string
}

export interface MonthlyGoal extends BaseRecord {
  caseId: string
  /** YYYY-MM */
  month: string
  content: string
  /** 0〜100 */
  progress: number
}

export interface WeeklyAction extends BaseRecord {
  caseId: string
  /** 週の開始日(月曜日) YYYY-MM-DD */
  weekStart: string
  content: string
  /** 誰に(相手先の担当者など。v2 で追加) */
  whom: string
  status: ActionStatus
  /** 任意の期限日 YYYY-MM-DD(未設定は空文字) */
  dueDate: string
  memo: string
}

export interface AppData {
  version: number
  cases: Case[]
  contacts: Contact[]
  finalGoals: FinalGoal[]
  monthlyGoals: MonthlyGoal[]
  weeklyActions: WeeklyAction[]
}

/** 案件に紐づく子レコードのコレクション名 */
export type ChildCollection = 'contacts' | 'finalGoals' | 'monthlyGoals' | 'weeklyActions'
export type Collection = 'cases' | ChildCollection

export const COLLECTIONS: Collection[] = ['cases', 'contacts', 'finalGoals', 'monthlyGoals', 'weeklyActions']
export const CHILD_COLLECTIONS: ChildCollection[] = ['contacts', 'finalGoals', 'monthlyGoals', 'weeklyActions']

export const COLLECTION_LABELS: Record<Collection, string> = {
  cases: '案件',
  contacts: '関係者',
  finalGoals: '最終目標',
  monthlyGoals: '月別目標',
  weeklyActions: '週次行動',
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: '進行中',
  onhold: '保留',
  done: '完了',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
}

export function emptyData(): AppData {
  return { version: SCHEMA_VERSION, cases: [], contacts: [], finalGoals: [], monthlyGoals: [], weeklyActions: [] }
}
