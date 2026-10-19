import { useMemo, useState } from 'react'
import { addDays, currentMonth, currentWeekStart, formatDateTime, formatMonth, formatWeekRange, formatYmd } from '../../domain/dates'
import { caseById, childrenOf, finalGoalOf, sortActions } from '../../domain/operations'
import type { Case, Contact, MonthlyGoal, WeeklyAction } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { ActionFormModal, ActionItem } from '../components/ActionParts'
import { CaseStatusBadge, ProgressBar } from '../components/Badges'
import { useConfirm } from '../components/Confirm'
import { Empty, Field } from '../components/Fields'
import { FormModal } from '../components/Modal'
import { href, navigate, type CaseTab } from '../router'
import { CaseFormModal } from './CaseListPage'

const TAB_LABELS: Record<CaseTab, string> = { info: '基本情報・関係者', goals: '目標', actions: '週次行動' }

export function CaseDetailPage({ id, tab }: { id: string; tab: CaseTab }) {
  const data = useAppData()
  const c = caseById(data, id)

  if (!c) {
    return (
      <div className="page">
        <Empty>
          案件が見つかりません。<a href={href({ name: 'list' })}>案件一覧へ戻る</a>
        </Empty>
      </div>
    )
  }

  return (
    <div className="page">
      <a className="back-link" href={href({ name: 'list' })}>
        ‹ 案件一覧
      </a>
      <div className="page-header">
        <h1>
          {c.companyName} <CaseStatusBadge status={c.status} />
        </h1>
      </div>
      <nav className="tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as CaseTab[]).map((t) => (
          <a
            key={t}
            role="tab"
            aria-selected={t === tab}
            className={`tab ${t === tab ? 'is-active' : ''}`}
            href={href({ name: 'case', id, tab: t })}
            onClick={(e) => {
              e.preventDefault()
              navigate({ name: 'case', id, tab: t }, true)
            }}
          >
            {TAB_LABELS[t]}
          </a>
        ))}
      </nav>
      {tab === 'info' && <InfoTab c={c} />}
      {tab === 'goals' && <GoalsTab caseId={id} />}
      {tab === 'actions' && <ActionsTab caseId={id} />}
    </div>
  )
}

// ---------------- 基本情報・関係者 ----------------

function InfoTab({ c }: { c: Case }) {
  const data = useAppData()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [contact, setContact] = useState<Contact | 'new' | null>(null)
  const contacts = childrenOf(data, 'contacts', c.id)

  const deleteCase = async () => {
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
      navigate({ name: 'list' }, true)
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>基本情報</h2>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            編集
          </button>
        </div>
        <dl className="dl">
          <dt>会社名</dt>
          <dd>{c.companyName}</dd>
          <dt>ステータス</dt>
          <dd>
            <CaseStatusBadge status={c.status} />
          </dd>
          <dt>メモ</dt>
          <dd className="pre">{c.memo || '—'}</dd>
          <dt>更新日時</dt>
          <dd className="muted">{formatDateTime(c.updatedAt)}</dd>
        </dl>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>関係者</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setContact('new')}>
            + 追加
          </button>
        </div>
        {contacts.length === 0 ? (
          <Empty>関係者は未登録です。</Empty>
        ) : (
          <ul className="list">
            {contacts.map((p) => (
              <li key={p.id}>
                <button type="button" className="list-item" onClick={() => setContact(p)}>
                  <span className="list-title">
                    {p.name}
                    {p.title && <span className="muted"> / {p.title}</span>}
                  </span>
                  {p.contact && <span className="list-sub">{p.contact}</span>}
                  {p.memo && <span className="list-sub pre">{p.memo}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="danger-zone">
        <button type="button" className="btn btn-danger-ghost" onClick={deleteCase}>
          この案件を削除
        </button>
      </div>

      {editing && <CaseFormModal target={c} onClose={() => setEditing(false)} />}
      {contact && <ContactFormModal caseId={c.id} target={contact === 'new' ? undefined : contact} onClose={() => setContact(null)} />}
    </>
  )
}

function ContactFormModal({ caseId, target, onClose }: { caseId: string; target?: Contact; onClose: () => void }) {
  const confirm = useConfirm()
  const [form, setForm] = useState({
    name: target?.name ?? '',
    title: target?.title ?? '',
    contact: target?.contact ?? '',
    memo: target?.memo ?? '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const submit = () => {
    if (!form.name.trim()) return setError('氏名を入力してください')
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as typeof form
    actions.upsert('contacts', { ...trimmed, caseId, id: target?.id })
    onClose()
  }
  const del = target
    ? async () => {
        if (await confirm({ title: '関係者を削除', message: `「${target.name}」を削除しますか?`, okLabel: '削除', danger: true })) {
          actions.remove('contacts', target.id)
          onClose()
        }
      }
    : undefined

  return (
    <FormModal title={target ? '関係者を編集' : '関係者を追加'} onClose={onClose} onSubmit={submit} onDelete={del}>
      <Field label="氏名" required>
        <input value={form.name} onChange={set('name')} data-autofocus={!target || undefined} />
      </Field>
      <Field label="役職">
        <input value={form.title} onChange={set('title')} />
      </Field>
      <Field label="連絡先" hint="電話番号・メールアドレスなど">
        <input value={form.contact} onChange={set('contact')} />
      </Field>
      <Field label="メモ">
        <textarea rows={3} value={form.memo} onChange={set('memo')} />
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}

// ---------------- 目標 ----------------

function GoalsTab({ caseId }: { caseId: string }) {
  const data = useAppData()
  const goal = finalGoalOf(data, caseId)
  const [editingFinal, setEditingFinal] = useState(false)
  const [monthly, setMonthly] = useState<MonthlyGoal | 'new' | null>(null)
  const monthlyGoals = [...childrenOf(data, 'monthlyGoals', caseId)].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
  const thisMonth = currentMonth()

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>最終目標</h2>
          <button type="button" className="btn btn-sm" onClick={() => setEditingFinal(true)}>
            {goal ? '編集' : '設定'}
          </button>
        </div>
        {goal && (goal.content || goal.deadline) ? (
          <dl className="dl">
            <dt>内容</dt>
            <dd className="pre">{goal.content || '—'}</dd>
            <dt>期限</dt>
            <dd>{goal.deadline ? formatYmd(goal.deadline) : '—'}</dd>
          </dl>
        ) : (
          <Empty>最終目標は未設定です。</Empty>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <h2>月別目標</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setMonthly('new')}>
            + 追加
          </button>
        </div>
        {monthlyGoals.length === 0 ? (
          <Empty>月別目標は未登録です。</Empty>
        ) : (
          <ul className="list">
            {monthlyGoals.map((g) => (
              <li key={g.id}>
                <button type="button" className={`list-item ${g.month === thisMonth ? 'is-current' : ''}`} onClick={() => setMonthly(g)}>
                  <span className="list-title">
                    {formatMonth(g.month)}
                    {g.month === thisMonth && <span className="chip">今月</span>}
                  </span>
                  <span className="list-sub pre">{g.content}</span>
                  <span className="progress-row">
                    <ProgressBar value={g.progress} />
                    <span className="progress-num">{g.progress}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingFinal && (
        <FinalGoalModal caseId={caseId} content={goal?.content ?? ''} deadline={goal?.deadline ?? ''} onClose={() => setEditingFinal(false)} />
      )}
      {monthly && (
        <MonthlyGoalModal
          caseId={caseId}
          target={monthly === 'new' ? undefined : monthly}
          existingMonths={monthlyGoals.map((g) => g.month)}
          onClose={() => setMonthly(null)}
        />
      )}
    </>
  )
}

function FinalGoalModal(props: { caseId: string; content: string; deadline: string; onClose: () => void }) {
  const [content, setContent] = useState(props.content)
  const [deadline, setDeadline] = useState(props.deadline)
  const submit = () => {
    actions.setFinalGoal(props.caseId, content.trim(), deadline)
    props.onClose()
  }
  return (
    <FormModal title="最終目標" onClose={props.onClose} onSubmit={submit}>
      <Field label="内容">
        <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} data-autofocus />
      </Field>
      <Field label="期限">
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
    </FormModal>
  )
}

function MonthlyGoalModal({
  caseId,
  target,
  existingMonths,
  onClose,
}: {
  caseId: string
  target?: MonthlyGoal
  existingMonths: string[]
  onClose: () => void
}) {
  const confirm = useConfirm()
  const [month, setMonth] = useState(target?.month ?? currentMonth())
  const [content, setContent] = useState(target?.content ?? '')
  const [progress, setProgress] = useState(target?.progress ?? 0)
  const [error, setError] = useState('')
  const duplicate = month !== target?.month && existingMonths.includes(month)

  const submit = () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('年月を入力してください')
    if (!content.trim()) return setError('目標内容を入力してください')
    actions.upsert('monthlyGoals', { id: target?.id, caseId, month, content: content.trim(), progress })
    onClose()
  }
  const del = target
    ? async () => {
        if (await confirm({ title: '月別目標を削除', message: `${formatMonth(target.month)}の目標を削除しますか?`, okLabel: '削除', danger: true })) {
          actions.remove('monthlyGoals', target.id)
          onClose()
        }
      }
    : undefined

  return (
    <FormModal title={target ? '月別目標を編集' : '月別目標を追加'} onClose={onClose} onSubmit={submit} onDelete={del}>
      <Field label="年月" required hint={duplicate ? 'この月の目標は既にあります(複数登録もできます)' : undefined}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <Field label="目標内容" required>
        <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} data-autofocus={!target || undefined} />
      </Field>
      <Field label={`達成度 ${progress}%`}>
        <div className="progress-input">
          <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={progress}
            onChange={(e) => setProgress(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))))}
            aria-label="達成度(%)"
          />
        </div>
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}

// ---------------- 週次行動 ----------------

function ActionsTab({ caseId }: { caseId: string }) {
  const data = useAppData()
  const [editing, setEditing] = useState<WeeklyAction | 'new' | null>(null)
  const [showPast, setShowPast] = useState(false)
  const thisWeek = currentWeekStart()

  const groups = useMemo(() => {
    const byWeek = new Map<string, WeeklyAction[]>()
    for (const a of childrenOf(data, 'weeklyActions', caseId)) {
      byWeek.set(a.weekStart, [...(byWeek.get(a.weekStart) ?? []), a])
    }
    return [...byWeek.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([week, xs]) => ({ week, items: sortActions(xs) }))
  }, [data, caseId])

  // 来週以降・今週・先週は常に表示、それより前は折りたたむ
  const recentFrom = addDays(thisWeek, -7)
  const visible = groups.filter((g) => showPast || g.week >= recentFrom)
  const hiddenCount = groups.length - visible.length

  return (
    <>
      <div className="section-actions">
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + 行動を追加
        </button>
      </div>
      {groups.length === 0 && <Empty>週次行動は未登録です。</Empty>}
      {visible.map((g) => {
        const done = g.items.filter((a) => a.status === 'done').length
        return (
          <section key={g.week} className={`card week-group ${g.week === thisWeek ? 'is-current' : ''}`}>
            <div className="card-header">
              <h2>
                {formatWeekRange(g.week)}
                {g.week === thisWeek && <span className="chip">今週</span>}
              </h2>
              <span className="muted">
                完了 {done}/{g.items.length}
              </span>
            </div>
            <ul className="action-list">
              {g.items.map((a) => (
                <ActionItem key={a.id} action={a} onEdit={() => setEditing(a)} />
              ))}
            </ul>
          </section>
        )
      })}
      {hiddenCount > 0 && (
        <button type="button" className="btn btn-block" onClick={() => setShowPast(true)}>
          それ以前の週を表示({hiddenCount}週分)
        </button>
      )}
      {editing && (
        <ActionFormModal caseId={caseId} action={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
