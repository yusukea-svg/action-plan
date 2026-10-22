import { useMemo, useState } from 'react'
import { addDays, currentWeekStart, formatMd, formatWeekRange, isDateStr, weekEnd, weekStartOf } from '../../domain/dates'
import { sortActions } from '../../domain/operations'
import { ACTION_STATUS_LABELS } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { useConfirm } from '../components/Confirm'
import { Empty, Field, Segmented } from '../components/Fields'
import { href, navigate } from '../router'

interface Row {
  key: number
  content: string
  dueDate: string
}

type WeekCount = '2' | '4' | '6' | '8'
let rowSeq = 0
const TRAILING = -1
const emptyRow = (): Row => ({ key: ++rowSeq, content: '', dueDate: '' })

/**
 * 1つの案件について、複数週の行動を1画面でまとめて登録する。
 * 各週の最後の行に入力すると次の空行が自動で増える。登録後もこの画面に残るので、続けて別の案件を入力できる。
 */
export function BulkEntryPage({ initialCaseId }: { initialCaseId?: string }) {
  const data = useAppData()
  const confirm = useConfirm()
  const [caseId, setCaseId] = useState(initialCaseId ?? '')
  const [startWeek, setStartWeek] = useState(currentWeekStart())
  const [count, setCount] = useState<WeekCount>('4')
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const weeks = useMemo(() => Array.from({ length: Number(count) }, (_, i) => addDays(startWeek, i * 7)), [startWeek, count])
  const selectableCases = data.cases
    .filter((c) => c.status !== 'done' || c.id === caseId)
    .sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'))
  const selected = data.cases.find((c) => c.id === caseId)

  /** 入力済みの行(表示範囲外の週に入力したものも含む) */
  const filled = Object.entries(rows).flatMap(([week, rs]) => rs.filter((r) => r.content.trim()).map((r) => ({ week, ...r })))
  const pending = filled.filter((r) => weeks.includes(r.week))
  const hiddenPending = filled.length - pending.length

  // 末尾に必ず空行(key = TRAILING)が1つある状態で表示する
  const rowsOf = (week: string): Row[] => [...(rows[week] ?? []), { key: TRAILING, content: '', dueDate: '' }]

  const updateRow = (week: string, row: Row, patch: Partial<Row>) => {
    setMessage('')
    setRows((prev) => {
      const current = prev[week] ?? []
      // 末尾の空行に入力したら正式な行として追加する(次の空行は rowsOf が自動で足す)
      const next = row.key === TRAILING ? [...current, { ...emptyRow(), ...patch }] : current.map((r) => (r.key === row.key ? { ...r, ...patch } : r))
      return { ...prev, [week]: next }
    })
  }

  const removeRow = (week: string, row: Row) => {
    setRows((prev) => ({ ...prev, [week]: (prev[week] ?? []).filter((r) => r.key !== row.key) }))
  }

  const changeStart = (date: string) => {
    if (isDateStr(date)) setStartWeek(weekStartOf(date))
  }

  const submit = () => {
    setError('')
    if (!caseId) return setError('案件を選択してください')
    if (pending.length === 0) return setError('行動内容を1件以上入力してください')
    actions.upsertMany(
      'weeklyActions',
      pending.map((r) => ({
        caseId,
        weekStart: r.week,
        content: r.content.trim(),
        status: 'todo' as const,
        dueDate: r.dueDate && r.dueDate >= r.week && r.dueDate <= weekEnd(r.week) ? r.dueDate : '',
        memo: '',
      })),
    )
    // 登録した週の入力だけ消す(表示範囲外の入力は残す)
    setRows((prev) => Object.fromEntries(Object.entries(prev).filter(([w]) => !weeks.includes(w))))
    setMessage(`${selected?.companyName ?? ''}に ${pending.length}件の行動を登録しました。続けて別の案件も入力できます。`)
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
        <Field label="案件" required>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">選択してください</option>
            {selectableCases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
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
        <p className="field-hint">各週の欄に入力すると、次の入力欄が自動で増えます。期限日は任意です。状態は「未着手」で登録されます。</p>
        {data.cases.length === 0 && (
          <p className="form-error">
            先に<a href={href({ name: 'list' })}>案件一覧</a>で案件を登録してください。
          </p>
        )}
      </section>

      {weeks.map((week) => {
        const existing = selected ? sortActions(data.weeklyActions.filter((a) => a.caseId === caseId && a.weekStart === week)) : []
        return (
          <section key={week} className={`card bulk-week ${week === currentWeekStart() ? 'is-current' : ''}`}>
            <div className="card-header">
              <h2>
                {formatWeekRange(week)}
                {week === currentWeekStart() && <span className="chip">今週</span>}
              </h2>
            </div>
            {existing.length > 0 && (
              <ul className="bulk-existing">
                {existing.map((a) => (
                  <li key={a.id}>
                    <span className={`status-dot dot-${a.status}`} aria-hidden />
                    <span className="bulk-existing-text">{a.content}</span>
                    <span className="muted">
                      {ACTION_STATUS_LABELS[a.status]}
                      {a.dueDate && ` ・期限 ${formatMd(a.dueDate)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="bulk-rows">
              {rowsOf(week).map((row, i) => {
                const isTrailing = row.key === TRAILING
                // 末尾の空行が正式な行に変わってもフォーカスが外れないよう、位置をキーにする
                return (
                  <div key={i} className="bulk-row">
                    <input
                      value={row.content}
                      placeholder={isTrailing ? '行動内容を入力' : ''}
                      onChange={(e) => updateRow(week, row, { content: e.target.value })}
                      aria-label={`${formatWeekRange(week)} の行動内容`}
                    />
                    <input
                      type="date"
                      className="bulk-due"
                      value={row.dueDate}
                      min={week}
                      max={weekEnd(week)}
                      onChange={(e) => updateRow(week, row, { dueDate: e.target.value })}
                      aria-label="期限日(任意)"
                      title="期限日(任意)"
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeRow(week, row)}
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
          </section>
        )
      })}

      {!selected && caseId === '' && data.cases.length > 0 && <Empty>案件を選ぶと、登録済みの行動も週ごとに表示されます。</Empty>}

      <div className="bulk-footer">
        <div className="bulk-footer-inner">
          <span className="muted">
            {pending.length}件を入力中
            {hiddenPending > 0 && `(表示範囲外に${hiddenPending}件)`}
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
