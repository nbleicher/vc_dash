import type { TopPage } from '../types'

type Props = {
  topPage: TopPage
  setTopPage: (p: TopPage) => void
  todayKey: string
  lastSnapshotLabel: string
  onSignOut: () => void
}

export function TopNav({ topPage, setTopPage, todayKey, lastSnapshotLabel, onSignOut }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1>VC Dashboard</h1>
        <p className="muted topbar-meta">Date: {todayKey} (EST) | As of last snapshot: {lastSnapshotLabel}</p>
      </div>
      <div className="topbar-actions">
        <div className="row gap-sm wrap topbar-nav">
          <button className={topPage === 'dashboard' ? 'active-btn' : ''} onClick={() => setTopPage('dashboard')}>
            Dashboard
          </button>
          <button className={topPage === 'tasks' ? 'active-btn' : ''} onClick={() => setTopPage('tasks')}>
            Tasks
          </button>
          <button className={topPage === 'metrics' ? 'active-btn' : ''} onClick={() => setTopPage('metrics')}>
            Metrics
          </button>
          <button className={topPage === 'vault' ? 'active-btn' : ''} onClick={() => setTopPage('vault')}>
            Vault
          </button>
          <button className={topPage === 'settings' ? 'active-btn' : ''} onClick={() => setTopPage('settings')}>
            Settings
          </button>
        </div>
        <button className="topbar-signout" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  )
}
