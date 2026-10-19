/**
 * Excel(.xlsx)の書き出し・読み込み。SheetJS を使い、ブラウザ内で完結する。
 *
 * シート構成(1行1レコード):
 *   案件 / 関係者 / 最終目標 / 月別目標 / 週次行動  … 読み込み対象
 *   案件別サマリー                                    … 見やすさ用(読み込み対象外)
 *   情報                                              … 形式バージョンなど
 *
 * 列定義は COLUMNS にまとめている。項目を追加する場合はここに列を足し、
 * 必要なら migrate.ts で旧形式からの移行を書く。
 */
import * as XLSX from 'xlsx'
import { formatMonth, formatWeekRange, formatYmd } from '../domain/dates'
import { exportFileName } from './filename'
import { newId } from '../domain/id'
import { migrate } from '../domain/migrate'
import { finalGoalOf, sortActions } from '../domain/operations'
import {
  ACTION_STATUS_LABELS,
  CASE_STATUS_LABELS,
  CHILD_COLLECTIONS,
  COLLECTION_LABELS,
  COLLECTIONS,
  SCHEMA_VERSION,
  type AppData,
  type Collection,
} from '../domain/types'

interface Column {
  key: string
  header: string
  /** 書き出し時の変換 */
  out?: (v: unknown) => string | number
  /** 読み込み時の変換 */
  in?: (v: unknown) => unknown
  width?: number
}

const labelMap = (labels: Record<string, string>) => ({
  out: (v: unknown) => labels[String(v)] ?? String(v ?? ''),
  in: (v: unknown) => {
    const s = cellText(v)
    return Object.entries(labels).find(([, label]) => label === s)?.[0] ?? s
  },
})

const dateCol = { in: (v: unknown) => cellDate(v) }
const monthCol = { in: (v: unknown) => cellDate(v).slice(0, 7) }

const ID: Column = { key: 'id', header: 'ID', width: 38 }
const CASE_ID: Column = { key: 'caseId', header: '案件ID', width: 38 }
const COMPANY: Column = { key: '__company', header: '会社名', width: 24 }
const UPDATED: Column = {
  key: 'updatedAt',
  header: '更新日時',
  width: 26,
  // Excel が日時に変換してしまった場合(シリアル値)も読めるようにする
  in: (v) => {
    const d = typeof v === 'number' ? XLSX.SSF.parse_date_code(v) : null
    return d ? new Date(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S)).toISOString() : cellText(v)
  },
}

export const COLUMNS: Record<Collection, Column[]> = {
  cases: [
    ID,
    { key: 'companyName', header: '会社名', width: 24 },
    { key: 'status', header: 'ステータス', width: 10, ...labelMap(CASE_STATUS_LABELS) },
    { key: 'memo', header: 'メモ', width: 40 },
    UPDATED,
  ],
  contacts: [
    ID,
    CASE_ID,
    COMPANY,
    { key: 'name', header: '氏名', width: 16 },
    { key: 'title', header: '役職', width: 16 },
    { key: 'contact', header: '連絡先', width: 24 },
    { key: 'memo', header: 'メモ', width: 30 },
    UPDATED,
  ],
  finalGoals: [
    ID,
    CASE_ID,
    COMPANY,
    { key: 'content', header: '内容', width: 40 },
    { key: 'deadline', header: '期限', width: 12, ...dateCol },
    UPDATED,
  ],
  monthlyGoals: [
    ID,
    CASE_ID,
    COMPANY,
    { key: 'month', header: '年月', width: 10, ...monthCol },
    { key: 'content', header: '目標内容', width: 40 },
    { key: 'progress', header: '達成度(%)', width: 10, out: (v) => Number(v) || 0, in: (v) => cellText(v).replace('%', '') },
    UPDATED,
  ],
  weeklyActions: [
    ID,
    CASE_ID,
    COMPANY,
    { key: 'weekStart', header: '週(開始日)', width: 12, ...dateCol },
    { key: 'content', header: '行動内容', width: 40 },
    { key: 'status', header: '状態', width: 10, ...labelMap(ACTION_STATUS_LABELS) },
    { key: 'dueDate', header: '期限日', width: 12, ...dateCol },
    { key: 'memo', header: 'メモ', width: 30 },
    UPDATED,
  ],
}

const INFO_SHEET = '情報'
const SUMMARY_SHEET = '案件別サマリー'

// ---------------- 書き出し ----------------

export function buildWorkbook(data: AppData, now = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const companyOf = new Map(data.cases.map((c) => [c.id, c.companyName]))

  for (const col of COLLECTIONS) {
    const columns = COLUMNS[col]
    const rows = (data[col] as unknown as Record<string, unknown>[]).map((r) =>
      columns.map((c) => {
        const v = c.key === '__company' ? companyOf.get(String(r.caseId)) : r[c.key]
        return c.out ? c.out(v) : String(v ?? '')
      }),
    )
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...rows])
    ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 14 }))
    XLSX.utils.book_append_sheet(wb, ws, COLLECTION_LABELS[col])
  }

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), SUMMARY_SHEET)

  const info = XLSX.utils.aoa_to_sheet([
    ['項目', '値'],
    ['アプリ', '行動計画表'],
    ['形式バージョン', SCHEMA_VERSION],
    ['書き出し日時', now.toISOString()],
    ['注意', `「${SUMMARY_SHEET}」シートは閲覧用です。読み込み時には使われません。`],
    ['注意', 'ID・案件ID・更新日時の列は消さないでください。Excelで内容を直した場合は、更新日時も新しくすると統合時に優先されます。'],
  ])
  info['!cols'] = [{ wch: 16 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, info, INFO_SHEET)
  return wb
}

function buildSummarySheet(data: AppData): XLSX.WorkSheet {
  const aoa: (string | number)[][] = []
  const cases = [...data.cases].sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'))
  for (const c of cases) {
    const goal = finalGoalOf(data, c.id)
    aoa.push([`■ ${c.companyName}`, `ステータス: ${CASE_STATUS_LABELS[c.status]}`])
    if (c.memo) aoa.push(['メモ', c.memo])
    const contacts = data.contacts.filter((p) => p.caseId === c.id)
    if (contacts.length) aoa.push(['関係者', contacts.map((p) => [p.name, p.title].filter(Boolean).join('/')).join('、')])
    aoa.push(['最終目標', goal?.content ?? '', goal?.deadline ? `期限 ${formatYmd(goal.deadline)}` : ''])
    const monthly = data.monthlyGoals.filter((g) => g.caseId === c.id).sort((a, b) => (a.month < b.month ? -1 : 1))
    for (const g of monthly) aoa.push(['月別目標', formatMonth(g.month), g.content, `${g.progress}%`])
    const acts = data.weeklyActions.filter((a) => a.caseId === c.id)
    const weeks = [...new Set(acts.map((a) => a.weekStart))].sort()
    for (const w of weeks) {
      for (const a of sortActions(acts.filter((x) => x.weekStart === w))) {
        aoa.push(['週次行動', formatWeekRange(w), a.content, ACTION_STATUS_LABELS[a.status], a.dueDate ? `期限 ${formatYmd(a.dueDate)}` : '', a.memo])
      }
    }
    aoa.push([])
  }
  if (aoa.length === 0) aoa.push(['案件はありません'])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 30 }]
  return ws
}

export function downloadExcel(data: AppData) {
  XLSX.writeFile(buildWorkbook(data), exportFileName('行動計画表', 'xlsx'), { compression: true })
}

// ---------------- 読み込み ----------------

export class ImportError extends Error {}

export function readWorkbook(buf: ArrayBuffer): AppData {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'array' })
  } catch {
    throw new ImportError('Excelファイルとして読み込めませんでした。')
  }

  const caseSheet = wb.Sheets[COLLECTION_LABELS.cases]
  if (!caseSheet) throw new ImportError(`「${COLLECTION_LABELS.cases}」シートが見つかりません。このアプリで書き出したファイルを選んでください。`)

  const raw: Record<string, unknown> = { version: readVersion(wb) }
  for (const col of COLLECTIONS) {
    const ws = wb.Sheets[COLLECTION_LABELS[col]]
    raw[col] = ws ? sheetToRecords(ws, COLUMNS[col]) : []
  }
  linkByCompanyName(raw)
  // 値の検証・移行は JSON と共通の migrate() で行う
  return migrate(raw)
}

/**
 * Excel上で手入力された行への配慮:
 * IDが空の案件にはIDを振り、案件IDが空の子レコードは会社名で案件と紐づける。
 */
function linkByCompanyName(raw: Record<string, unknown>) {
  const cases = raw.cases as Record<string, unknown>[]
  const idByName = new Map<string, string>()
  for (const c of cases) {
    if (!c.id) c.id = newId()
    if (c.companyName && !idByName.has(String(c.companyName))) idByName.set(String(c.companyName), String(c.id))
  }
  for (const col of CHILD_COLLECTIONS) {
    for (const r of raw[col] as Record<string, unknown>[]) {
      if (!r.caseId && r.__company) r.caseId = idByName.get(String(r.__company)) ?? ''
      delete r.__company
    }
  }
  for (const c of cases) delete c.__company
}

function readVersion(wb: XLSX.WorkBook): number {
  const ws = wb.Sheets[INFO_SHEET]
  if (!ws) return SCHEMA_VERSION
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  const v = Number(rows.find((r) => r[0] === '形式バージョン')?.[1])
  return Number.isFinite(v) && v > 0 ? v : SCHEMA_VERSION
}

function sheetToRecords(ws: XLSX.WorkSheet, columns: Column[]): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
  return rows
    .map((row) => {
      const r: Record<string, unknown> = {}
      for (const c of columns) {
        if (c.key === '__company') continue
        const v = row[c.header]
        r[c.key] = c.in ? c.in(v) : cellText(v)
      }
      // 案件ID が空でも会社名が書かれていれば、後で案件と紐づける
      r.__company = cellText(row[COMPANY.header])
      return r
    })
    .filter((r) => Object.entries(r).some(([k, v]) => k !== '__company' && v !== '' && v != null))
}

function cellText(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/** Excel上で日付に変換された値(シリアル値)・「2026/10/20」形式も YYYY-MM-DD にそろえる */
function cellDate(v: unknown): string {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = cellText(v)
  const m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/)
  if (!m) return s
  return m[3] ? `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3].padStart(2, '0')}` : `${m[1]}-${m[2]!.padStart(2, '0')}`
}
