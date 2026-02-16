import type { TopPage } from '../types'

type Props = {
  topPage: TopPage
  setTopPage: (p: TopPage) => void
}

export function TopNav({ topPage, setTopPage }: Props) {
  return (
    <nav className="side-nav" aria-label="Primary">
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
    </nav>
  )
}
