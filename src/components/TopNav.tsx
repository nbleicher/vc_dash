import { Button } from './ui'
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
    <nav className="flex flex-wrap items-center gap-2" aria-label="Primary">
      {items.map((item) => (
        <Button
          key={item.key}
          variant={topPage === item.key ? 'default' : 'secondary'}
          onClick={() => setTopPage(item.key)}
          className="h-9"
        >
          {item.label}
        </Button>
      ))}
    </nav>
  )
}
