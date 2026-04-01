import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { TopPage } from '../types'

const items: Array<{ path: string; key: TopPage; label: string }> = [
  { path: '/dashboard', key: 'dashboard', label: 'Dashboard' },
  { path: '/agent', key: 'agent', label: 'Agent' },
  { path: '/tasks', key: 'tasks', label: 'Tasks' },
  { path: '/metrics', key: 'metrics', label: 'Metrics' },
  { path: '/eod', key: 'eod', label: 'EOD' },
  { path: '/vault', key: 'vault', label: 'Vault' },
  { path: '/settings', key: 'settings', label: 'Settings' },
]

const navLinkClass =
  'inline-flex min-h-[44px] shrink-0 items-center rounded-md border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function TopNav() {
  const [mobileOpenRequested, setMobileOpenRequested] = useState(false)
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null)
  const location = useLocation()
  const mobileOpen = mobileOpenRequested && mobileOpenPath === location.pathname

  return (
    <>
      {/* Desktop nav */}
      <nav
        className="hidden w-full items-center justify-start gap-2 overflow-x-auto whitespace-nowrap pr-1 md:flex"
        aria-label="Primary"
      >
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `${navLinkClass} ${
                isActive
                  ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile: hamburger button */}
      <div className="flex min-h-[44px] items-center md:hidden">
        <button
          type="button"
          onClick={() => {
            const nextOpen = !mobileOpen
            setMobileOpenRequested(nextOpen)
            setMobileOpenPath(nextOpen ? location.pathname : null)
          }}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            aria-hidden
            onClick={() => {
              setMobileOpenRequested(false)
              setMobileOpenPath(null)
            }}
          />
          <nav
            className="mobile-modal-scroll fixed left-0 top-0 z-50 h-full w-[min(280px,85vw)] border-r border-slate-200 bg-white shadow-lg md:hidden"
            aria-label="Primary mobile"
          >
            <div className="flex flex-col gap-1 p-3 pt-16">
              {items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => {
                    setMobileOpenRequested(false)
                    setMobileOpenPath(null)
                  }}
                  className={({ isActive }) =>
                    `block min-h-[44px] rounded-md border px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}
    </>
  )
}