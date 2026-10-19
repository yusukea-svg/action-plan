import { ACTION_STATUS_LABELS, CASE_STATUS_LABELS, type ActionStatus, type CaseStatus } from '../../domain/types'

export const CASE_STATUS_OPTIONS = (Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((value) => ({
  value,
  label: CASE_STATUS_LABELS[value],
}))

export const ACTION_STATUS_OPTIONS = (Object.keys(ACTION_STATUS_LABELS) as ActionStatus[]).map((value) => ({
  value,
  label: ACTION_STATUS_LABELS[value],
}))

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`badge badge-case-${status}`}>{CASE_STATUS_LABELS[status]}</span>
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}
