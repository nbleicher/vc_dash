import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: ['bg-green-50', 'bg-green-500/20', 'bg-green-400/30', '!bg-green-400/30'],
  theme: {
    extend: {
      colors: {
        background: '#f4f7fb',
        surface: '#ffffff',
        border: '#dbe4ef',
        muted: '#64748b',
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        accent: '#eff6ff',
        danger: '#dc2626',
        warning: '#d97706',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
} satisfies Config
