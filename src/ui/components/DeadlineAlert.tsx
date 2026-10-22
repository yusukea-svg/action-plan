import { useState } from 'react'
import { formatMd, todayStr } from '../../domain/dates'
import { DEADLINE_ALERT_DAYS, daysLeftLabel, upcomingDeadlines } from '../../domain/deadlines'
import { actions, useAppData } from '../../store/store'
import { href } from '../router'

const COLLAPSE_KEY = 'action-plan:deadline-collapsed'
const PREVIEW_COUNT = 5

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** 画面上部に出す「期限が近いもの」の一覧(3日以内+期限切れ) */
export function DeadlineAlert() {
  const data = useAppData()
  const [collapsed, setCollapsedState] = useState(loadCollapsed)
  const [showAll, setShowAll] = useState(false)
  const items = upcomingDeadlines(data, todayStr())
  if (items.length === 0) return null

  const overdue = items.filter((i) => i.daysLeft < 0).length
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT)

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v)
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0')
    } catch {
      /* 保存できなくても表示には影響しない */
    }
  }

  return (
    <section className={`deadline-alert ${overdue ? 'has-overdue' : ''}`} aria-label="期限が近いもの">
      <button type="button" className="deadline-head" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
        <span className="deadline-icon" aria-hidden>
          !
        </span>
        <span className="deadline-title">
          期限まで{DEADLINE_ALERT_DAYS}日以内 <strong>{items.length}件</strong>
          {overdue > 0 && <span className="deadline-overdue-count">(うち期限切れ {overdue}件)</span>}
        </span>
        <span className="deadline-toggle">{collapsed ? '表示' : '閉じる'}</span>
      </button>
      {!collapsed && (
        <>
          <ul className="deadline-list">
            {visible.map((i) => (
              <li key={`${i.kind}-${i.id}`} className="deadline-item">
                <span className={`deadline-badge ${i.daysLeft <= 0 ? 'urgent' : ''}`}>{daysLeftLabel(i.daysLeft)}</span>
                <a className="deadline-body" href={href({ name: 'case', id: i.caseId, tab: i.kind === 'action' ? 'actions' : 'goals' })}>
                  <span className="deadline-meta">
                    {formatMd(i.date)} ・ {i.caseName}
                    {i.kind === 'finalGoal' && <span className="deadline-kind">最終目標</span>}
                  </span>
                  <span className="deadline-text">
                    {i.title}
                    {i.whom && <span className="muted">(誰に:{i.whom})</span>}
                  </span>
                </a>
                {i.kind === 'action' && (
                  <button type="button" className="btn btn-sm deadline-done" onClick={() => actions.setActionStatus(i.id, 'done')}>
                    完了
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length > PREVIEW_COUNT && (
            <button type="button" className="link-btn deadline-more" onClick={() => setShowAll(!showAll)}>
              {showAll ? '少なく表示' : `ほか${items.length - PREVIEW_COUNT}件を表示`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
