import { toDateStr } from '../domain/dates'

/** 例: 行動計画表_20261020.xlsx */
export function exportFileName(prefix: string, ext: string, now = new Date()): string {
  return `${prefix}_${toDateStr(now).replaceAll('-', '')}.${ext}`
}
