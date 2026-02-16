import type { HTMLAttributes, TableHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto rounded-xl border border-border', className)} {...props} />
}

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('min-w-[720px] w-full border-collapse bg-white text-sm', className)} {...props} />
}
