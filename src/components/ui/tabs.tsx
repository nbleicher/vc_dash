import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './button'

type TabItem<T extends string> = { key: T; label: ReactNode }

type Props<T extends string> = {
  value: T
  onChange: (v: T) => void
  items: TabItem<T>[]
  className?: string
}

export function Tabs<T extends string>({ value, onChange, items, className }: Props<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2 rounded-xl border border-border bg-slate-50 p-2', className)}>
      {items.map((item) => (
        <Button
          key={item.key}
          variant={value === item.key ? 'default' : 'ghost'}
          onClick={() => onChange(item.key)}
          className="h-9"
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}
