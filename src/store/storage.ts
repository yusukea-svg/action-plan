/**
 * ブラウザ保存(localStorage)。保存先を IndexedDB 等に変える場合はこのファイルだけ差し替える。
 */
import { migrate } from '../domain/migrate'
import { emptyData, type AppData } from '../domain/types'

const DATA_KEY = 'action-plan:data'
const META_KEY = 'action-plan:meta'

/** このブラウザ固有の情報(書き出し・読み込みの対象外) */
export interface LocalMeta {
  /** 最後にデータを変更した日時 */
  lastChangedAt: string
  /** 最後にバックアップ(Excel/JSON書き出し)した日時 */
  lastBackupAt: string
}

export function loadData(): AppData {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return emptyData()
  return migrate(JSON.parse(raw))
}

export function saveData(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

export function loadMeta(): LocalMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Partial<LocalMeta>
    return { lastChangedAt: m.lastChangedAt ?? '', lastBackupAt: m.lastBackupAt ?? '' }
  } catch {
    return { lastChangedAt: '', lastBackupAt: '' }
  }
}

export function saveMeta(meta: LocalMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}
