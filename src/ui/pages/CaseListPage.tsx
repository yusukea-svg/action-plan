import { useMemo, useState } from 'react'
import { currentWeekStart, formatYmd, todayStr } from '../../domain/dates'
import { finalGoalOf, weekActionCounts } from '../../domain/operations'
import type { Case, CaseStatus } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { CASE_STATUS_OPTIONS, CaseStatusBadge } from '../components/Badges'
import { Empty, Field, Segmented } from '../components/Fields'
import { FormModal } from '../components/Modal'
import { href, navigate } from '../router'

type Filter = 'all' | CaseStatus
const STATUS_ORDER: Record<CaseStatus, number> = { active: 0, onhold: 1, done: 2 }

export function CaseListPage() {
  const data = useAppData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const week = currentWeekStart()
  const today = todayStr()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.cases
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) => !q || c.companyName.toLowerCase().includes(q) || c.memo.toLowerCase().includes(q))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.companyName.localeCompare(b.companyName, 'ja'))
      .map((c) => ({ c, goal: finalGoalOf(data, c.id), counts: weekActionCounts(data, c.id, week) }))
  }, [data, query, filter, week])

  return (
    <div className="page">
      <div className="page-header">
        <h1>案件一覧</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + 案件を追加
        </button>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="会社名・メモで検索" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="検索" />
        <Segmented<Filter>
          ariaLabel="ステータス絞り込み"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'すべて' }, ...CASE_STATUS_OPTIONS]}
        />
      </div>

      {data.cases.length === 0 ? (
        <Empty>まだ案件がありません。「+ 案件を追加」から登録してください。</Empty>
      ) : rows.length === 0 ? (
        <Empty>条件に合う案件がありません。</Empty>
      ) : (
        <div className="case-table" role="table">
          <div className="case-row case-row-head" role="row">
            <span role="columnheader">会社名</span>
            <span role="columnheader">ステータス</span>
            <span role="columnheader">最終目標の期限</span>
            <span role="columnheader">今週の行動</span>
          </div>
          {rows.map(({ c, goal, counts }) => (
            <a key={c.id} className="case-row" role="row" href={href({ name: 'case', id: c.id, tab: 'info' })}>
              <span className="case-name" role="cell">
                {c.companyName}
              </span>
              <span role="cell">
                <CaseStatusBadge status={c.status} />
              </span>
              <span role="cell" className={`case-deadline ${goal?.deadline && goal.deadline < today && c.status !== 'done' ? 'overdue' : ''}`}>
                <span className="mobile-label">期限 </span>
                {goal?.deadline ? formatYmd(goal.deadline) : '—'}
              </span>
              <span role="cell" className="case-week">
                <span className="mobile-label">今週 </span>
                {counts.total ? (
                  <span className={counts.done === counts.total ? 'all-done' : ''}>
                    {counts.done}/{counts.total}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </a>
          ))}
        </div>
      )}

      {creating && (
        <CaseFormModal
          onClose={() => setCreating(false)}
          onSaved={(c) => navigate({ name: 'case', id: c.id, tab: 'info' })}
        />
      )}
    </div>
  )
}

/** 案件の追加・基本情報の編集 */
export function CaseFormModal({ target, onClose, onSaved }: { target?: Case; onClose: () => void; onSaved?: (c: Case) => void }) {
  const [form, setForm] = useState({
    companyName: target?.companyName ?? '',
    status: target?.status ?? ('active' as CaseStatus),
    memo: target?.memo ?? '',
  })
  const [error, setError] = useState('')

  const submit = () => {
    const companyName = form.companyName.trim()
    if (!companyName) return setError('会社名を入力してください')
    const c = actions.upsert('cases', { ...form, companyName, memo: form.memo.trim(), id: target?.id })
    onClose()
    onSaved?.(c)
  }

  return (
    <FormModal title={target ? '基本情報を編集' : '案件を追加'} onClose={onClose} onSubmit={submit}>
      <Field label="会社名" required>
        <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} data-autofocus />
      </Field>
      <Field label="ステータス">
        <Segmented
          value={form.status}
          options={CASE_STATUS_OPTIONS}
          onChange={(status) => setForm({ ...form, status })}
          ariaLabel="ステータス"
        />
      </Field>
      <Field label="メモ">
        <textarea rows={4} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}
