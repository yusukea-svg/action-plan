import { useMemo, useState } from 'react'
import { addDays, currentWeekStart, formatMd, formatWeekRange, isDateStr, weekEnd, weekStartOf } from '../../domain/dates'
import { sortActions } from '../../domain/operations'
import { ACTION_STATUS_LABELS, type Case } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { WhomInput } from '../components/ActionParts'
import { CaseStatusBadge } from '../components/Badges'
import { useConfirm } from '../components/Confirm'
import { Empty, Field, Segmented } from '../components/Fields'
import { href, navigate } from '../router'

interface Row {
  key: number
  content: string
  whom: string
  dueDate: string
}

type WeekCount = '2' | '4' | '6' | '8'
let rowSeq = 0
const TRAILING = -1
const emptyRow = (): Row => ({ key: ++rowSeq, content: '', whom: '', dueDate: '' })
/** 入力行は「案件ID|週」ごとに持つ */
const cellKey = (caseId: string, week: string) => `${caseId}|${week}`

/**
 * 複数の案件 × 複数週の行動を1画面でまとめて登録する。
 * 各欄の最後の行に入力すると次の空行が自動で増える。登録後もこの画面に残る。
 */
export function BulkEntryPage({ initialCaseId }: { initialCaseId?: string }) {
  const data = useAppData()
  const confirm = useConfirm()
  const [selectedIds, setSelectedIds] = useState<string[]>(initialCaseId ? [initialCaseId] : [])
  const [startWeek, setStartWeek] = useState(currentWeekStart())
  const [count, setCount] = useState<WeekCount>('4')
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const thisWeek = currentWeekStart()

  const weeks = useMemo(() => Array.from({ length: Number(count) }, (_, i) => addDays(startWeek, i * 7)), [startWeek, count])
  const byName = (a: Case, b: Case) => a.companyName.localeCompare(b.companyName, 'ja')
  const selectableCases = data.cases.filter((c) => c.status !== 'done' || selectedIds.includes(c.id)).sort(byName)
  // 選んだ案件は案件名順に表示する
  const selectedCases = data.cases.filter((c) => selectedIds.includes(c.id)).sort(byName)

  /** 入力済みの行(選択を外した案件・表示範囲外の週のものも含む) */
  const filled = Object.entries(rows).flatMap(([key, rs]) => {
    const [caseId = '', week = ''] = key.split('|')
    return rs.filter((r) => r.content.trim()).map((r) => ({ caseId, week, ...r }))
  })
  const pending = filled.filter((r) => selectedIds.includes(r.caseId) && weeks.includes(r.week))
  const hiddenPending = filled.length - pending.length
  const pendingCases = new Set(pending.map((r) => r.caseId)).size

  // 末尾に必ず空行(key = TRAILING)が1つある状態で表示する
  const rowsOf = (key: string): Row[] => [...(rows[key] ?? []), { key: TRAILING, content: '', whom: '', dueDate: '' }]

  const updateRow = (key: string, row: Row, patch: Partial<Row>) => {
    setMessage('')
    setRows((prev) => {
      const current = prev[key] ?? []
      // 末尾の空行に入力したら正式な行として追加する(次の空行は rowsOf が自動で足す)
      const next = row.key === TRAILING ? [...current, { ...emptyRow(), ...patch }] : current.map((r) => (r.key === row.key ? { ...r, ...patch } : r))
      return { ...prev, [key]: next }
    })
  }

  const removeRow = (key: string, row: Row) => {
    setRows((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((r) => r.key !== row.key) }))
  }

  const toggleCase = (id: string) => {
    setError('')
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const selectAllActive = () => setSelectedIds(data.cases.filter((c) => c.status === 'active').map((c) => c.id))

  const changeStart = (date: string) => {
    if (isDateStr(date)) setStartWeek(weekStartOf(date))
  }

  const submit = () => {
    setError('')
    if (selectedIds.length === 0) return setError('案件を選択してください')
    if (pending.length === 0) return setError('行動内容を1件以上入力してください')
    actions.upsertMany(
      'weeklyActions',
      pending.map((r) => ({
        caseId: r.caseId,
        weekStart: r.week,
        content: r.content.trim(),
        whom: r.whom.trim(),
        status: 'todo' as const,
        dueDate: r.dueDate && r.dueDate >= r.week && r.dueDate <= weekEnd(r.week) ? r.dueDate : '',
        memo: '',
      })),
    )
    // 登録した欄の入力だけ消す(選択外・表示範囲外の入力は残す)
    const done = new Set(pending.map((r) => cellKey(r.caseId, r.week)))
    setRows((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !done.has(k))))
    setMessage(`${pendingCases}件の案件に、合計${pending.length}件の行動を登録しました。`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const leave = async () => {
    if (
      filled.length > 0 &&
      !(await confirm({
        title: '入力内容を破棄',
        message: `登録していない入力が${filled.length}件あります。破棄して戻りますか?`,
        okLabel: '破棄して戻る',
        danger: true,
      }))
    )
      return
    navigate(initialCaseId ? { name: 'case', id: initialCaseId, tab: 'actions' } : { name: 'week' })
  }

  return (
    <div className="page">
      <button type="button" className="back-link link-plain" onClick={leave}>
        ‹ 戻る
      </button>
      <div className="page-header">
        <h1>行動をまとめて入力</h1>
      </div>

      {message && <p className="notice notice-ok">{message}</p>}

      <section className="card bulk-settings">
        <div className="field">
          <span className="field-label">
            案件<span className="required">必須</span>
            <span className="muted bulk-selected-count">{selectedIds.length}件選択中</span>
          </span>
          {selectableCases.length > 0 ? (
            <>
              <div className="case-picker" role="group" aria-label="案件を選択">
                {selectableCases.map((c) => (
                  <label key={c.id} className={`case-pick ${selectedIds.includes(c.id) ? 'is-selected' : ''}`}>
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCase(c.id)} />
                    {c.companyName}
                    {c.status !== 'active' && <CaseStatusBadge status={c.status} />}
                  </label>
                ))}
              </div>
              <div className="inline">
                <button type="button" className="btn btn-sm" onClick={selectAllActive}>
                  進行中をすべて選択
                </button>
                {selectedIds.length > 0 && (
                  <button type="button" className="btn btn-sm" onClick={() => setSelectedIds([])}>
                    選択を解除
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="form-error">
              先に<a href={href({ name: 'list' })}>案件一覧</a>で案件を登録してください。
            </p>
          )}
        </div>
        <div className="bulk-settings-row">
          <Field label="開始週">
            <div className="week-picker">
              <button type="button" className="btn btn-sm" onClick={() => setStartWeek(addDays(startWeek, -7))} aria-label="前の週">
                ‹
              </button>
              <input type="date" value={startWeek} onChange={(e) => changeStart(e.target.value)} />
              <button type="button" className="btn btn-sm" onClick={() => setStartWeek(addDays(startWeek, 7))} aria-label="次の週">
                ›
              </button>
            </div>
          </Field>
          <Field label="週数">
            <Segmented<WeekCount>
              value={count}
              onChange={setCount}
              options={(['2', '4', '6', '8'] as const).map((v) => ({ value: v, label: `${v}週` }))}
            />
          </Field>
        </div>
        <p className="field-hint">
          案件を複数選ぶと、案件ごとに入力欄が並びます。各欄に入力すると次の入力欄が自動で増えます。「誰に」と期限日は任意です。状態は「未着手」で登録されます。
        </p>
      </section>

      {selectedCases.length === 0 && data.cases.length > 0 && <Empty>案件を選ぶと、週ごとの入力欄が表示されます。</Empty>}

      {selectedCases.map((c) => (
        <section key={c.id} className="card bulk-case">
          <div className="card-header bulk-case-header">
            <h2>{c.companyName}</h2>
            <button type="button" className="btn btn-sm" onClick={() => toggleCase(c.id)}>
              選択を外す
            </button>
          </div>
          {weeks.map((week) => {
            const key = cellKey(c.id, week)
            const existing = sortActions(data.weeklyActions.filter((a) => a.caseId === c.id && a.weekStart === week))
            return (
              <div key={week} className={`bulk-week ${week === thisWeek ? 'is-current' : ''}`}>
                <h3 className="bulk-week-title">
                  {formatWeekRange(week)}
                  {week === thisWeek && <span className="chip">今週</span>}
                </h3>
                {existing.length > 0 && (
                  <ul className="bulk-existing">
                    {existing.map((a) => (
                      <li key={a.id}>
                        <span className={`status-dot dot-${a.status}`} aria-hidden />
                        <span className="bulk-existing-text">
                          {a.content}
                          {a.whom && <span className="muted">(誰に:{a.whom})</span>}
                        </span>
                        <span className="muted">
                          {ACTION_STATUS_LABELS[a.status]}
                          {a.dueDate && ` ・期限 ${formatMd(a.dueDate)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="bulk-rows">
                  {rowsOf(key).map((row, i) => {
                    const isTrailing = row.key === TRAILING
                    // 末尾の空行が正式な行に変わってもフォーカスが外れないよう、位置をキーにする
                    return (
                      <div key={i} className="bulk-row">
                        <input
                          value={row.content}
                          placeholder={isTrailing ? '行動内容を入力' : ''}
                          onChange={(e) => updateRow(key, row, { content: e.target.value })}
                          aria-label={`${c.companyName} ${formatWeekRange(week)} の行動内容`}
                        />
                        <div className="bulk-whom">
                          <WhomInput caseId={c.id} value={row.whom} onChange={(v) => updateRow(key, row, { whom: v })} ariaLabel="誰に" placeholder="誰に" />
                        </div>
                        <input
                          type="date"
                          className="bulk-due"
                          value={row.dueDate}
                          min={week}
                          max={weekEnd(week)}
                          onChange={(e) => updateRow(key, row, { dueDate: e.target.value })}
                          aria-label="期限日(任意)"
                          title="期限日(任意)"
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeRow(key, row)}
                          aria-label="この行を消す"
                          disabled={isTrailing}
                          style={{ visibility: isTrailing ? 'hidden' : 'visible' }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <div className="bulk-footer">
        <div className="bulk-footer-inner">
          <span className="muted">
            {pendingCases > 1 ? `${pendingCases}案件・` : ''}
            {pending.length}件を入力中
            {hiddenPending > 0 && `(選択外・表示範囲外に${hiddenPending}件)`}
          </span>
          {error && <span className="form-error">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending.length === 0}>
            {pending.length}件を登録
          </button>
        </div>
      </div>
    </div>
  )
}
