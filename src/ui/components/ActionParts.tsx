import { useState } from 'react'
import { addDays, currentWeekStart, formatMd, formatWeekRange, isDateStr, weekEnd, weekStartOf } from '../../domain/dates'
import { ACTION_STATUS_LABELS, type ActionStatus, type WeeklyAction } from '../../domain/types'
import { actions, useAppData } from '../../store/store'
import { ACTION_STATUS_OPTIONS } from './Badges'
import { useConfirm } from './Confirm'
import { Field, Segmented } from './Fields'
import { FormModal } from './Modal'

/** 週次行動の1行。状態はワンタップで切り替え、本文タップで編集 */
export function ActionItem({
  action,
  caseName,
  onEdit,
  showWeek,
}: {
  action: WeeklyAction
  caseName?: string
  onEdit: () => void
  showWeek?: boolean
}) {
  return (
    <li className={`action-item status-${action.status}`}>
      <button type="button" className="action-main" onClick={onEdit}>
        {caseName && <span className="action-case">{caseName}</span>}
        <span className="action-content">{action.content}</span>
        <span className="action-meta">
          {action.whom && <span className="whom">誰に:{action.whom}</span>}
          {showWeek && <span>{formatWeekRange(action.weekStart)}</span>}
          {action.dueDate && <span className="due">期限 {formatMd(action.dueDate)}</span>}
          {action.memo && <span className="action-memo">{action.memo}</span>}
        </span>
      </button>
      <Segmented<ActionStatus>
        size="sm"
        ariaLabel="状態"
        value={action.status}
        options={ACTION_STATUS_OPTIONS}
        onChange={(s) => actions.setActionStatus(action.id, s)}
      />
    </li>
  )
}

const NEXT_STATUS: Record<ActionStatus, ActionStatus> = { todo: 'doing', doing: 'done', done: 'todo' }

/** 4週間表示用の小さな行動カード。状態はタップするたびに 未着手→進行中→完了 と切り替わる */
export function ActionChip({ action, onEdit }: { action: WeeklyAction; onEdit: () => void }) {
  return (
    <li className={`action-chip status-${action.status}`}>
      <button type="button" className="action-chip-main" onClick={onEdit}>
        <span className="action-content">{action.content}</span>
        {action.whom && <span className="action-chip-due whom">誰に:{action.whom}</span>}
        {action.dueDate && <span className="action-chip-due">期限 {formatMd(action.dueDate)}</span>}
      </button>
      <button
        type="button"
        className={`status-pill pill-${action.status}`}
        onClick={() => actions.setActionStatus(action.id, NEXT_STATUS[action.status])}
        aria-label={`状態: ${ACTION_STATUS_LABELS[action.status]}(タップで変更)`}
      >
        {ACTION_STATUS_LABELS[action.status]}
      </button>
    </li>
  )
}

/**
 * 「誰に」の入力欄。自由入力で、その案件の関係者を候補として出す。
 * 候補は「氏名(役職)」ではなく氏名のみを入れる。
 */
export function WhomInput({
  caseId,
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  caseId: string
  value: string
  onChange: (v: string) => void
  ariaLabel?: string
  placeholder?: string
}) {
  const data = useAppData()
  const listId = `whom-${caseId || 'none'}`
  const contacts = data.contacts.filter((c) => c.caseId === caseId)
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={contacts.length ? listId : undefined}
        aria-label={ariaLabel}
        placeholder={placeholder ?? (contacts.length ? '関係者から選ぶか入力' : '例:〇〇部長')}
      />
      {contacts.length > 0 && (
        <datalist id={listId}>
          {contacts.map((c) => (
            <option key={c.id} value={c.name}>
              {c.title}
            </option>
          ))}
        </datalist>
      )}
    </>
  )
}

/** 週次行動の追加・編集フォーム。caseId を渡さない場合は案件を選択させる */
export function ActionFormModal({
  action,
  caseId,
  defaultWeek,
  onClose,
}: {
  action?: WeeklyAction
  caseId?: string
  defaultWeek?: string
  onClose: () => void
}) {
  const data = useAppData()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    caseId: action?.caseId ?? caseId ?? '',
    weekStart: action?.weekStart ?? defaultWeek ?? currentWeekStart(),
    content: action?.content ?? '',
    whom: action?.whom ?? '',
    status: action?.status ?? ('todo' as ActionStatus),
    dueDate: action?.dueDate ?? '',
    memo: action?.memo ?? '',
  })
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const selectableCases = data.cases.filter((c) => c.status !== 'done' || c.id === form.caseId)

  const changeWeek = (date: string) => {
    if (!isDateStr(date)) return
    const ws = weekStartOf(date)
    // 期限日が週の範囲外になったらクリア
    setForm((f) => ({ ...f, weekStart: ws, dueDate: f.dueDate && (f.dueDate < ws || f.dueDate > weekEnd(ws)) ? '' : f.dueDate }))
  }

  const submit = () => {
    if (!form.caseId) return setError('案件を選択してください')
    if (!form.content.trim()) return setError('行動内容を入力してください')
    actions.upsert('weeklyActions', { ...form, id: action?.id, content: form.content.trim(), whom: form.whom.trim(), memo: form.memo.trim() })
    onClose()
  }

  const del = action
    ? async () => {
        if (await confirm({ title: '行動を削除', message: `「${action.content}」を削除しますか?`, okLabel: '削除', danger: true })) {
          actions.remove('weeklyActions', action.id)
          onClose()
        }
      }
    : undefined

  return (
    <FormModal title={action ? '行動を編集' : '行動を追加'} onClose={onClose} onSubmit={submit} onDelete={del}>
      {!caseId && (
        <Field label="案件" required>
          <select value={form.caseId} onChange={(e) => set('caseId', e.target.value)}>
            <option value="">選択してください</option>
            {selectableCases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="週" required hint={formatWeekRange(form.weekStart)}>
        <div className="week-picker">
          <button type="button" className="btn btn-sm" onClick={() => changeWeek(addDays(form.weekStart, -7))} aria-label="前の週">
            ‹
          </button>
          <input type="date" value={form.weekStart} onChange={(e) => changeWeek(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={() => changeWeek(addDays(form.weekStart, 7))} aria-label="次の週">
            ›
          </button>
        </div>
      </Field>
      <Field label="行動内容" required>
        <textarea rows={2} value={form.content} onChange={(e) => set('content', e.target.value)} data-autofocus={!action || undefined} />
      </Field>
      <Field label="誰に" hint="その案件の関係者が候補に出ます(自由入力も可)">
        <WhomInput caseId={form.caseId} value={form.whom} onChange={(v) => set('whom', v)} />
      </Field>
      <Field label="状態">
        <Segmented value={form.status} options={ACTION_STATUS_OPTIONS} onChange={(v) => set('status', v)} />
      </Field>
      <Field label="期限日(任意)" hint="週の中の特定日を示したいときに設定">
        <div className="inline">
          <input
            type="date"
            value={form.dueDate}
            min={form.weekStart}
            max={weekEnd(form.weekStart)}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          {form.dueDate && (
            <button type="button" className="btn btn-sm" onClick={() => set('dueDate', '')}>
              クリア
            </button>
          )}
        </div>
      </Field>
      <Field label="メモ">
        <textarea rows={2} value={form.memo} onChange={(e) => set('memo', e.target.value)} />
      </Field>
      {error && <p className="form-error">{error}</p>}
    </FormModal>
  )
}
