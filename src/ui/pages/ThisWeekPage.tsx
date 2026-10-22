import { useMemo, useState, type CSSProperties } from 'react'
import { addDays, currentWeekStart, formatMd, formatWeekRange, weekEnd } from '../../domain/dates'
import { sortActions } from '../../domain/operations'
import type { Case, WeeklyAction } from '../../domain/types'
import { useAppData } from '../../store/store'
import { ActionChip, ActionFormModal, ActionItem } from '../components/ActionParts'
import { Empty, Segmented } from '../components/Fields'
import { href } from '../router'

type Span = '1' | '4'
const SPAN_KEY = 'action-plan:week-span'

/** 表示期間(1週/4週)はこのブラウザに覚えておく */
function loadSpan(): Span {
  try {
    return localStorage.getItem(SPAN_KEY) === '4' ? '4' : '1'
  } catch {
    return '1'
  }
}

type Editing = { action?: WeeklyAction; caseId?: string; week: string } | null

export function ThisWeekPage() {
  const data = useAppData()
  const thisWeek = currentWeekStart()
  const [week, setWeek] = useState(thisWeek)
  const [span, setSpanState] = useState<Span>(loadSpan)
  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const isThisWeek = week === thisWeek
  const weeks = useMemo(() => Array.from({ length: Number(span) }, (_, i) => addDays(week, i * 7)), [week, span])
  const lastWeek = weeks[weeks.length - 1]!

  const setSpan = (s: Span) => {
    setSpanState(s)
    try {
      localStorage.setItem(SPAN_KEY, s)
    } catch {
      /* 保存できなくても表示には影響しない */
    }
  }

  const caseMap = useMemo(() => new Map(data.cases.map((c) => [c.id, c])), [data.cases])
  const caseName = (id: string) => caseMap.get(id)?.companyName ?? ''

  const rangeActions = data.weeklyActions.filter((a) => a.weekStart >= week && a.weekStart <= lastWeek)
  const done = rangeActions.filter((a) => a.status === 'done').length
  const doing = rangeActions.filter((a) => a.status === 'doing').length

  // 先週以前の未完了(完了済み案件のものは除く)。今週から表示しているときだけ出す
  const carryOver = isThisWeek
    ? data.weeklyActions
        .filter((a) => a.weekStart < thisWeek && a.status !== 'done' && caseMap.get(a.caseId)?.status !== 'done')
        .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
    : []

  const title = span === '4' ? (isThisWeek ? '今週から4週間の行動' : '4週間の行動') : isThisWeek ? '今週の行動' : '週の行動'
  const rangeLabel = span === '4' ? `${formatMd(week)}〜${formatMd(weekEnd(lastWeek))}` : formatWeekRange(week)

  return (
    <div className={`page ${span === '4' ? 'page-wide' : ''}`}>
      <div className="page-header">
        <h1>{title}</h1>
        <div className="header-buttons">
          <a className="btn" href={href({ name: 'bulk' })}>
            まとめて入力
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing({ week })}
            disabled={data.cases.length === 0}
          >
            + 行動を追加
          </button>
        </div>
      </div>

      <div className="view-controls">
        <Segmented<Span>
          ariaLabel="表示期間"
          value={span}
          onChange={setSpan}
          options={[
            { value: '1', label: '1週' },
            { value: '4', label: '4週' },
          ]}
        />
        <label className="checkbox">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          完了を隠す
        </label>
      </div>

      <div className="week-nav">
        <button type="button" className="btn" onClick={() => setWeek(addDays(week, -7))} aria-label="前の週">
          ‹ 前週
        </button>
        <div className="week-nav-label">
          <strong>{rangeLabel}</strong>
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
          <span className="summary-num">{rangeActions.length}</span>
          <span className="summary-label">全体</span>
        </div>
        <div>
          <span className="summary-num">{rangeActions.length - done - doing}</span>
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

      {carryOver.length > 0 && (
        <section className="card carry-over">
          <div className="card-header">
            <h2>先週以前からの持ち越し(未完了)</h2>
            <span className="muted">{carryOver.length}件</span>
          </div>
          <ul className="action-list">
            {carryOver.map((a) => (
              <ActionItem key={a.id} action={a} caseName={caseName(a.caseId)} showWeek onEdit={() => setEditing({ action: a, week: a.weekStart })} />
            ))}
          </ul>
        </section>
      )}

      {span === '4' ? (
        <MultiWeekGrid
          data={data}
          weeks={weeks}
          thisWeek={thisWeek}
          hideDone={hideDone}
          onEdit={(a) => setEditing({ action: a, week: a.weekStart })}
          onAdd={(caseId, w) => setEditing({ caseId, week: w })}
        />
      ) : (
        <OneWeekList
          actions={rangeActions}
          caseMap={caseMap}
          hideDone={hideDone}
          onEdit={(a) => setEditing({ action: a, week: a.weekStart })}
        />
      )}

      {editing && (
        <ActionFormModal action={editing.action} caseId={editing.caseId} defaultWeek={editing.week} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/** 1週表示:案件ごとのカード */
function OneWeekList({
  actions,
  caseMap,
  hideDone,
  onEdit,
}: {
  actions: WeeklyAction[]
  caseMap: Map<string, Case>
  hideDone: boolean
  onEdit: (a: WeeklyAction) => void
}) {
  const groups = useMemo(() => {
    const byCase = new Map<string, WeeklyAction[]>()
    for (const a of actions) {
      if (hideDone && a.status === 'done') continue
      byCase.set(a.caseId, [...(byCase.get(a.caseId) ?? []), a])
    }
    return [...byCase.entries()]
      .map(([caseId, xs]) => ({ c: caseMap.get(caseId) as Case, items: sortActions(xs) }))
      .filter((g) => g.c)
      .sort((a, b) => a.c.companyName.localeCompare(b.c.companyName, 'ja'))
  }, [actions, hideDone, caseMap])

  if (actions.length === 0) return <Empty>この週の行動は登録されていません。</Empty>
  if (groups.length === 0) return <Empty>すべて完了しています。</Empty>
  return (
    <>
      {groups.map((g) => (
        <section key={g.c.id} className="card">
          <div className="card-header">
            <h2>
              <a href={href({ name: 'case', id: g.c.id, tab: 'actions' })}>{g.c.companyName}</a>
            </h2>
          </div>
          <ul className="action-list">
            {g.items.map((a) => (
              <ActionItem key={a.id} action={a} onEdit={() => onEdit(a)} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/**
 * 複数週表示:行=会社、列=週 の一覧表(スマホでは会社ごとのカードに週を縦に並べる)。
 * 進行中・保留の案件は行動がなくても表示し、空欄から直接追加できるようにする。
 */
function MultiWeekGrid({
  data,
  weeks,
  thisWeek,
  hideDone,
  onEdit,
  onAdd,
}: {
  data: ReturnType<typeof useAppData>
  weeks: string[]
  thisWeek: string
  hideDone: boolean
  onEdit: (a: WeeklyAction) => void
  onAdd: (caseId: string, week: string) => void
}) {
  const rows = useMemo(() => {
    const first = weeks[0]!
    const last = weeks[weeks.length - 1]!
    const inRange = data.weeklyActions.filter((a) => a.weekStart >= first && a.weekStart <= last)
    return data.cases
      .filter((c) => c.status !== 'done' || inRange.some((a) => a.caseId === c.id))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'))
      .map((c) => ({
        c,
        cells: weeks.map((w) =>
          sortActions(inRange.filter((a) => a.caseId === c.id && a.weekStart === w && !(hideDone && a.status === 'done'))),
        ),
      }))
  }, [data, weeks, hideDone])

  if (data.cases.length === 0) return <Empty>まだ案件がありません。</Empty>
  if (rows.length === 0) return <Empty>表示する案件がありません(完了済みの案件は行動がある場合のみ表示します)。</Empty>

  const cols = { '--weeks': weeks.length } as CSSProperties
  return (
    <div className="mw-grid" style={cols}>
      <div className="mw-row mw-head">
        <div className="mw-case">会社名</div>
        {weeks.map((w) => (
          <div key={w} className={`mw-cell ${w === thisWeek ? 'is-current' : ''}`}>
            {formatWeekRange(w)}
            {w === thisWeek && <span className="chip">今週</span>}
          </div>
        ))}
      </div>
      {rows.map(({ c, cells }) => (
        <div key={c.id} className="mw-row">
          <div className="mw-case">
            <a href={href({ name: 'case', id: c.id, tab: 'actions' })}>{c.companyName}</a>
          </div>
          {cells.map((items, i) => {
            const w = weeks[i]!
            return (
              <div key={w} className={`mw-cell ${w === thisWeek ? 'is-current' : ''}`}>
                <div className="mw-cell-label">
                  {formatWeekRange(w)}
                  {w === thisWeek && <span className="chip">今週</span>}
                </div>
                {items.length > 0 && (
                  <ul className="chip-list">
                    {items.map((a) => (
                      <ActionChip key={a.id} action={a} onEdit={() => onEdit(a)} />
                    ))}
                  </ul>
                )}
                <button type="button" className="mw-add" onClick={() => onAdd(c.id, w)} aria-label={`${c.companyName} ${formatWeekRange(w)} に追加`}>
                  + 追加
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
