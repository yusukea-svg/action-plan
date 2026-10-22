import { daysBetween } from '../domain/dates'
import { isEmpty } from '../domain/operations'
import { useAppData, useLoadError, useLocalMeta } from '../store/store'
import { ConfirmProvider } from './components/Confirm'
import { DeadlineAlert } from './components/DeadlineAlert'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { CaseListPage } from './pages/CaseListPage'
import { DataPage } from './pages/DataPage'
import { BulkEntryPage } from './pages/BulkEntryPage'
import { ThisWeekPage } from './pages/ThisWeekPage'
import { href, useRoute, type Route } from './router'

/** 最終バックアップからこの日数を過ぎ、かつ未保存の変更があれば書き出しを促す */
export const BACKUP_REMIND_DAYS = 7

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: { name: 'list' }, label: '案件一覧', icon: '▤' },
  { route: { name: 'week' }, label: '週次行動', icon: '✓' },
  { route: { name: 'data' }, label: 'データ管理', icon: '⇅' },
]

export function App() {
  const route = useRoute()
  const section = route.name === 'case' ? 'list' : route.name === 'bulk' ? 'week' : route.name

  return (
    <ConfirmProvider>
      <header className="app-header">
        <a className="brand" href={href({ name: 'list' })}>
          行動計画表
        </a>
        <nav className="top-nav">
          {NAV.map((n) => (
            <a key={n.route.name} href={href(n.route)} className={section === n.route.name ? 'is-active' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <LoadErrorBanner />
        <BackupBanner hidden={route.name === 'data'} />
        <DeadlineAlert />
        {route.name === 'list' && <CaseListPage />}
        {route.name === 'case' && <CaseDetailPage key={route.id} id={route.id} tab={route.tab} />}
        {route.name === 'week' && <ThisWeekPage />}
        {route.name === 'bulk' && <BulkEntryPage key={route.caseId ?? ''} initialCaseId={route.caseId} />}
        {route.name === 'data' && <DataPage />}
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <a key={n.route.name} href={href(n.route)} className={section === n.route.name ? 'is-active' : ''}>
            <span className="bottom-nav-icon" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </a>
        ))}
      </nav>
    </ConfirmProvider>
  )
}

function BackupBanner({ hidden }: { hidden: boolean }) {
  const data = useAppData()
  const meta = useLocalMeta()
  if (hidden || isEmpty(data)) return null
  const changedSinceBackup = !meta.lastBackupAt || meta.lastChangedAt > meta.lastBackupAt
  const days = meta.lastBackupAt ? daysBetween(meta.lastBackupAt) : null
  if (!changedSinceBackup || (days !== null && days < BACKUP_REMIND_DAYS)) return null
  return (
    <div className="notice notice-warn banner">
      <span>
        {days === null ? 'まだバックアップがありません。' : `最後のバックアップから${days}日経っています。`}
        データはこのブラウザにのみ保存されています。
      </span>
      <a className="btn btn-sm" href={href({ name: 'data' })}>
        書き出す
      </a>
    </div>
  )
}

function LoadErrorBanner() {
  const error = useLoadError()
  if (!error) return null
  return (
    <div className="notice notice-error banner">
      <span>
        保存データを読み込めませんでした:{error}
        <br />
        データ管理からバックアップを読み込むと復旧できます(それまで編集は保存されません)。
      </span>
    </div>
  )
}
