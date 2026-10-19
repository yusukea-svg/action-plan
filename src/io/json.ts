/** JSONバックアップ。アプリ内部の形式をそのまま保存するので、Excelより確実に復元できる */
import { migrate } from '../domain/migrate'
import type { AppData } from '../domain/types'
import { exportFileName } from './filename'

export function downloadJson(data: AppData) {
  const blob = new Blob([JSON.stringify({ app: 'action-plan', exportedAt: new Date().toISOString(), ...data }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName('行動計画表_バックアップ', 'json')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseJson(text: string): AppData {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('JSONファイルとして読み込めませんでした。')
  }
  if (!obj || typeof obj !== 'object' || !Array.isArray((obj as { cases?: unknown }).cases)) {
    throw new Error('このアプリのバックアップファイルではないようです。')
  }
  return migrate(obj)
}
