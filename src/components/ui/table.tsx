import type { HTMLAttributes, TableHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-white', className)} {...props} />
}

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        'w-full min-w-[720px] border-collapse bg-white text-sm [&_tbody_tr:hover]:bg-slate-50/70 [&_tbody_tr:nth-child(even)]:bg-slate-50/40',
        className,
      )}
      {...props}
    />
  )
}
