import type { WeekDay } from '../types'

interface WeeklyStripProps {
  weekDays: WeekDay[]
  onDayClick: (dayOfWeek: number) => void
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function WeeklyStrip({ weekDays, onDayClick }: WeeklyStripProps) {
  return (
    <div
      className="flex justify-center gap-2 py-3 px-4"
      style={{ animation: 'slide-up-fade 300ms ease-out' }}
      role="navigation"
      aria-label="Weekly day themes"
    >
      {weekDays.map((day) => {
        const dayName = DAY_NAMES[day.dayOfWeek - 1]
        const themeLabel = day.theme ? day.theme.name : 'Open'
        const ariaLabel = `${dayName}, ${themeLabel}${day.isToday ? ' (today)' : ''}${day.hasCompletedTasks ? ', has completed tasks' : ''}`

        return (
          <button
            key={day.dayOfWeek}
            onClick={() => onDayClick(day.dayOfWeek)}
            aria-label={ariaLabel}
            className="flex flex-col items-center gap-0.5 rounded-xl min-w-[44px] min-h-[44px] px-2 py-1.5 transition-all duration-200 cursor-pointer"
            style={{
              background: day.isToday
                ? 'var(--t-card)'
                : 'transparent',
              boxShadow: day.isToday
                ? '0 0 0 2px var(--t-accent-glow), 0 0 12px var(--t-accent-glow), 0 0 20px var(--t-accent-glow-strong)'
                : 'none',
              animation: day.isToday
                ? 'day-glow-pulse 3.5s ease-in-out infinite'
                : 'none',
            }}
            onMouseEnter={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.background = 'var(--t-card)'
                e.currentTarget.style.boxShadow = 'var(--t-shadow-sm)'
              }
            }}
            onMouseLeave={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            {/* Day letter */}
            <span
              className={`text-xs leading-none ${day.isToday ? 'font-semibold' : 'font-medium'}`}
              style={{
                color: day.isToday
                  ? 'var(--t-accent)'
                  : 'var(--t-text-light)',
              }}
            >
              {day.label}
            </span>

            {/* Emoji or placeholder */}
            <span className="text-xl leading-none h-7 flex items-center justify-center">
              {day.theme ? (
                day.theme.emoji
              ) : (
                <span
                  className="text-sm"
                  style={{ color: 'var(--t-text-faint)' }}
                  aria-hidden="true"
                >
                  —
                </span>
              )}
            </span>

            {/* Completed indicator */}
            <div className="h-3 flex items-center justify-center">
              {day.hasCompletedTasks ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="opacity-80"
                  aria-hidden="true"
                >
                  <circle cx="5" cy="5" r="4" fill="var(--t-green)" />
                  <path
                    d="M3.2 5.2L4.4 6.4L6.8 4"
                    stroke="white"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'var(--t-border)' }}
                  aria-hidden="true"
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
