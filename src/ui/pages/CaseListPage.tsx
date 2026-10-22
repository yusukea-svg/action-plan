import { useMemo, useState } from 'react'
import { currentWeekStart, formatYmd, todayStr } from '../../domain/dates'
import { finalGoalOf, weekActionCounts } from '../../domain/operations'
import type { Case, CaseStatus } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { CASE_STATUS_OPTIONS, CaseStatusBadge } from '../components/Badges'
import { useConfirm } from '../components/Confirm'
import { Empty, Field, Segmented } from '../components/Fields'
import { FormModal } from '../components/Modal'
import { href, navigate } from '../router'

type Filter = 'all' | CaseStatus
const STATUS_ORDER: Record<CaseStatus, number> = { active: 0, onhold: 1, done: 2 }

export function CaseListPage() {
  const data = useAppData()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
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

  const deleteCase = async (c: Case) => {
    const ok = await confirm({
      title: '案件を削除',
      message: (
        <>
          「{c.companyName}」を削除しますか?
          <br />
          関係者・目標・週次行動もすべて削除され、元に戻せません。
        </>
      ),
      okLabel: '削除する',
      danger: true,
    })
    if (ok) {
      actions.remove('cases', c.id)
      setMessage(`「${c.companyName}」を削除しました。`)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>案件一覧</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + 案件を追加
        </button>
      </div>

      {message && <p className="notice notice-ok">{message}</p>}

      <div className="toolbar">
        <input type="search" placeholder="案件名・メモで検索" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="検索" />
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
            <span role="columnheader">案件名</span>
            <span role="columnheader">ステータス</span>
            <span role="columnheader">最終目標の期限</span>
            <span role="columnheader">今週の行動</span>
            <span role="columnheader" aria-label="削除" />
          </div>
          {rows.map(({ c, goal, counts }) => {
            const open = () => navigate({ name: 'case', id: c.id, tab: 'info' })
            return (
              // 行全体をタップで詳細へ。× ボタンだけは削除
              <div key={c.id} className="case-row is-link" role="row" onClick={open}>
                <span className="case-name" role="cell">
                  <a href={href({ name: 'case', id: c.id, tab: 'info' })} onClick={(e) => e.stopPropagation()}>
                    {c.companyName}
                  </a>
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
                <span role="cell" className="case-delete">
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={`「${c.companyName}」を削除`}
                    title="削除"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteCase(c)
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <AddCasesModal
          onClose={() => setCreating(false)}
          onSaved={(added) => {
            setMessage('')
            if (added.length === 1) navigate({ name: 'case', id: added[0]!.id, tab: 'info' })
            else setMessage(`${added.length}件の案件を追加しました。`)
          }}
        />
      )}
    </div>
  )
}

const TRAILING = -1
let rowSeq = 0

/** 案件をまとめて追加。名前欄は入力すると次の欄が自動で増え、× で行を消せる */
function AddCasesModal({ onClose, onSaved }: { onClose: () => void; onSaved: (added: Case[]) => void }) {
  const data = useAppData()
  const [names, setNames] = useState<{ key: number; value: string }[]>([])
  const [status, setStatus] = useState<CaseStatus>('active')
  const [error, setError] = useState('')
  const rows = [...names, { key: TRAILING, value: '' }]
  const existing = new Set(data.cases.map((c) => c.companyName))

  const change = (key: number, value: string) => {
    setError('')
    setNames((prev) => (key === TRAILING ? [...prev, { key: ++rowSeq, value }] : prev.map((n) => (n.key === key ? { ...n, value } : n))))
  }
  const removeRow = (key: number) => setNames((prev) => prev.filter((n) => n.key !== key))

  const submit = () => {
    // 空欄と、同じ名前の重複入力は除く
    const unique = [...new Set(names.map((n) => n.value.trim()).filter(Boolean))]
    if (unique.length === 0) return setError('案件名を入力してください')
    const added = unique.map((companyName) => actions.upsert('cases', { companyName, status, memo: '' }))
    onClose()
    onSaved(added)
  }

  const count = new Set(names.map((n) => n.value.trim()).filter(Boolean)).size

  return (
    <FormModal title="案件を追加" onClose={onClose} onSubmit={submit} submitLabel={count > 1 ? `${count}件を追加` : '追加'}>
      <Field label="案件名" required hint="入力すると次の欄が増えます。複数の案件をまとめて追加できます。">
        <div className="name-rows">
          {rows.map((row, i) => (
            // 末尾の空欄が正式な行に変わってもフォーカスが外れないよう、位置をキーにする
            <div key={i} className="name-row">
              <input
                value={row.value}
                placeholder={row.key === TRAILING ? (names.length ? '続けて入力' : '例:株式会社〇〇 新規導入') : ''}
                onChange={(e) => change(row.key, e.target.value)}
                aria-label={`案件名 ${i + 1}`}
                data-autofocus={i === 0 || undefined}
                onKeyDown={(e) => {
                  // Enter は送信ではなく次の欄へ移動(最後の空欄で Enter なら送信)
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && row.key !== TRAILING) {
                    e.preventDefault()
                    const inputs = (e.currentTarget.closest('.name-rows') as HTMLElement).querySelectorAll('input')
                    inputs[i + 1]?.focus()
                  }
                }}
              />
              {row.key !== TRAILING ? (
                <button type="button" className="icon-btn" aria-label="この行を消す" onClick={() => removeRow(row.key)}>
                  ×
                </button>
              ) : (
                <span />
              )}
              {row.value.trim() && existing.has(row.value.trim()) && <span className="field-hint name-dup">同じ名前の案件が既にあります</span>}
            </div>
          ))}
        </div>
      </Field>
      <Field label="ステータス">
        <Segmented value={status} options={CASE_STATUS_OPTIONS} onChange={setStatus} ariaLabel="ステータス" />
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}

/** 案件の基本情報の編集 */
export function CaseFormModal({ target, onClose }: { target: Case; onClose: () => void }) {
  const [form, setForm] = useState({ companyName: target.companyName, status: target.status, memo: target.memo })
  const [error, setError] = useState('')

  const submit = () => {
    const companyName = form.companyName.trim()
    if (!companyName) return setError('案件名を入力してください')
    actions.upsert('cases', { ...form, companyName, memo: form.memo.trim(), id: target.id })
    onClose()
  }

  return (
    <FormModal title="基本情報を編集" onClose={onClose} onSubmit={submit}>
      <Field label="案件名" required>
        <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} data-autofocus />
      </Field>
      <Field label="ステータス">
        <Segmented value={form.status} options={CASE_STATUS_OPTIONS} onChange={(status) => setForm({ ...form, status })} ariaLabel="ステータス" />
      </Field>
      <Field label="メモ">
        <textarea rows={4} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}
