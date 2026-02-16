import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground border-primary hover:bg-blue-700',
  secondary: 'bg-white text-foreground border-border hover:bg-slate-50',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-slate-100',
  danger: 'bg-white text-danger border-red-200 hover:bg-red-50',
}

export function Button({ className, variant = 'secondary', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
