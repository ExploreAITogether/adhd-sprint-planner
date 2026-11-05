import type { DayTheme } from '../types'

// Small pill above a view's heading showing today's day theme.
export default function TodayThemeChip({ theme }: { theme: DayTheme }) {
  return (
    <p
      className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1 mb-3 text-[13px] font-medium"
      style={{
        color: 'var(--t-accent-text)',
        backgroundColor: 'var(--t-accent-soft)',
        animation: 'slide-up-fade 300ms ease-out',
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[15px] leading-none"
        style={{ backgroundColor: 'var(--t-card-inner)' }}
        aria-hidden="true"
      >
        {theme.emoji}
      </span>
      <span>
        <span className="sr-only">Today's theme: </span>
        {theme.name}
      </span>
    </p>
  )
}
