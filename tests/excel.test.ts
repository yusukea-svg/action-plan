import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import * as ops from '../src/domain/operations'
import { emptyData, type AppData } from '../src/domain/types'
import { buildWorkbook, readWorkbook } from '../src/io/excel'

function sample(): AppData {
  let d = emptyData()
  for (const name of ['株式会社A', 'B商事']) {
    const c = ops.upsert(d, 'cases', { companyName: name, status: name === 'B商事' ? 'onhold' : 'active', memo: '複数行\nメモ' })
    d = c.data
    d = ops.upsert(d, 'contacts', { caseId: c.record.id, name: '山田', title: '部長', contact: '03-0000-0000', memo: '' }).data
    d = ops.setFinalGoal(d, c.record.id, '年内受注', '2026-12-25')
    d = ops.upsert(d, 'monthlyGoals', { caseId: c.record.id, month: '2026-10', content: '提案書提出', progress: 40 }).data
    d = ops.upsert(d, 'weeklyActions', {
      caseId: c.record.id,
      weekStart: '2026-10-19',
      content: '訪問',
      status: 'doing',
      dueDate: '2026-10-21',
      memo: 'メモ',
    }).data
    d = ops.upsert(d, 'weeklyActions', { caseId: c.record.id, weekStart: '2026-10-26', content: '見積', status: 'todo', dueDate: '', memo: '' }).data
  }
  return d
}

const roundTrip = (wb: XLSX.WorkBook) => readWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)

describe('excel', () => {
  it('書き出したファイルを読み込むと同じデータに戻る', () => {
    const d = sample()
    const back = roundTrip(buildWorkbook(d))
    expect(back).toEqual(d)
  })

  it('サマリーシートと情報シートを含む', () => {
    const wb = buildWorkbook(sample())
    expect(wb.SheetNames).toEqual(['案件', '関係者', '最終目標', '月別目標', '週次行動', '案件別サマリー', '情報'])
  })

  it('Excel上で日付セルに変換された値・手入力行も読める', () => {
    const d = sample()
    const wb = buildWorkbook(d)
    const ws = wb.Sheets['週次行動']!
    // 週(開始日)を Excel の日付シリアル値に置き換える(2026-10-19 = 46314)
    ws['D2'] = { t: 'n', v: 46314, z: 'yyyy/m/d' }
    // ID・案件IDなしで会社名だけ書いた行を追加
    XLSX.utils.sheet_add_aoa(ws, [['', '', 'B商事', '2026/10/19', '電話', '未着手', '', '', '']], { origin: -1 })
    const back = roundTrip(wb)
    expect(back.weeklyActions.find((a) => a.id === d.weeklyActions[0]!.id)?.weekStart).toBe('2026-10-19')
    const added = back.weeklyActions.find((a) => a.content === '電話')
    expect(added?.caseId).toBe(d.cases.find((c) => c.companyName === 'B商事')!.id)
    expect(added?.weekStart).toBe('2026-10-19')
    expect(added?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('案件シートがないファイルはエラー', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet1')
    expect(() => roundTrip(wb)).toThrow('「案件」シートが見つかりません')
  })
})
