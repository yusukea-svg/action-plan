import { useMemo, useState } from 'react'
import { addDays, currentWeekStart, formatWeekRange } from '../../domain/dates'
import { sortActions } from '../../domain/operations'
import type { Case, WeeklyAction } from '../../domain/types'
import { useAppData } from '../../store/store'
import { ActionFormModal, ActionItem } from '../components/ActionParts'
import { Empty } from '../components/Fields'
import { href } from '../router'

export function ThisWeekPage() {
  const data = useAppData()
  const thisWeek = currentWeekStart()
  const [week, setWeek] = useState(thisWeek)
  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState<WeeklyAction | 'new' | null>(null)
  const isThisWeek = week === thisWeek

  const caseMap = useMemo(() => new Map(data.cases.map((c) => [c.id, c])), [data.cases])
  const caseName = (id: string) => caseMap.get(id)?.companyName ?? ''

  const weekActions = data.weeklyActions.filter((a) => a.weekStart === week)
  const done = weekActions.filter((a) => a.status === 'done').length
  const doing = weekActions.filter((a) => a.status === 'doing').length

  // 案件ごとにまとめる(案件名順)
  const groups = useMemo(() => {
    const byCase = new Map<string, WeeklyAction[]>()
    for (const a of weekActions) {
      if (hideDone && a.status === 'done') continue
      byCase.set(a.caseId, [...(byCase.get(a.caseId) ?? []), a])
    }
    return [...byCase.entries()]
      .map(([caseId, xs]) => ({ c: caseMap.get(caseId) as Case, items: sortActions(xs) }))
      .filter((g) => g.c)
      .sort((a, b) => a.c.companyName.localeCompare(b.c.companyName, 'ja'))
  }, [weekActions, hideDone, caseMap])

  // 先週以前の未完了(完了済み案件のものは除く)。今週を表示しているときだけ出す
  const carryOver = isThisWeek
    ? data.weeklyActions
        .filter((a) => a.weekStart < thisWeek && a.status !== 'done' && caseMap.get(a.caseId)?.status !== 'done')
        .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
    : []

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isThisWeek ? '今週の行動' : '週の行動'}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')} disabled={data.cases.length === 0}>
          + 行動を追加
        </button>
      </div>

      <div className="week-nav">
        <button type="button" className="btn" onClick={() => setWeek(addDays(week, -7))} aria-label="前の週">
          ‹ 前週
        </button>
        <div className="week-nav-label">
          <strong>{formatWeekRange(week)}</strong>
          {!isThisWeek && (
            <button type="button" className="link-btn" onClick={() => setWeek(thisWeek)}>
              今週に戻る
            </button>
          )}
        </div>
        <button type="button" className="btn" onClick={() => setWeek(addDays(week, 7))} aria-label="次の週">
          次週 ›
        </button>
      </div>

      <div className="summary">
        <div>
          <span className="summary-num">{weekActions.length}</span>
          <span className="summary-label">全体</span>
        </div>
        <div>
          <span className="summary-num">{weekActions.length - done - doing}</span>
          <span className="summary-label">未着手</span>
        </div>
        <div>
          <span className="summary-num">{doing}</span>
          <span className="summary-label">進行中</span>
        </div>
        <div>
          <span className="summary-num accent">{done}</span>
          <span className="summary-label">完了</span>
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
        完了を隠す
      </label>

      {carryOver.length > 0 && (
        <section className="card carry-over">
          <div className="card-header">
            <h2>先週以前からの持ち越し(未完了)</h2>
            <span className="muted">{carryOver.length}件</span>
          </div>
          <ul className="action-list">
            {carryOver.map((a) => (
              <ActionItem key={a.id} action={a} caseName={caseName(a.caseId)} showWeek onEdit={() => setEditing(a)} />
            ))}
          </ul>
        </section>
      )}

      {weekActions.length === 0 ? (
        <Empty>この週の行動は登録されていません。</Empty>
      ) : groups.length === 0 ? (
        <Empty>すべて完了しています。</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.c.id} className="card">
            <div className="card-header">
              <h2>
                <a href={href({ name: 'case', id: g.c.id, tab: 'actions' })}>{g.c.companyName}</a>
              </h2>
            </div>
            <ul className="action-list">
              {g.items.map((a) => (
                <ActionItem key={a.id} action={a} onEdit={() => setEditing(a)} />
              ))}
            </ul>
          </section>
        ))
      )}

      {editing && (
        <ActionFormModal action={editing === 'new' ? undefined : editing} defaultWeek={week} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
