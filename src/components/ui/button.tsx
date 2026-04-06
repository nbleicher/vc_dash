import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground border-primary hover:bg-blue-700',
  secondary: 'bg-white text-foreground border-border hover:bg-slate-50',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-slate-100',
  danger: 'bg-white text-danger border-red-200 hover:bg-red-50',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-10 px-4 text-sm',
}

export function Button({ className, variant = 'secondary', size = 'md', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
