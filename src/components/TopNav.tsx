import type { TopPage } from '../types'

type Props = {
  topPage: TopPage
  setTopPage: (p: TopPage) => void
}

export function TopNav({ topPage, setTopPage }: Props) {
  const items: Array<{ key: TopPage; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'metrics', label: 'Metrics' },
    { key: 'vault', label: 'Vault' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <nav className="flex w-full items-center justify-start gap-2 overflow-x-auto whitespace-nowrap pr-1" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => setTopPage(item.key)}
          className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition ${
            topPage === item.key
              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
