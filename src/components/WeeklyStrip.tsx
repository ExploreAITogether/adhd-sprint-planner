import type { WeekDay } from '../types'

interface WeeklyStripProps {
  weekDays: WeekDay[]
  onDayClick: (dayOfWeek: number) => void
}

export default function WeeklyStrip({ weekDays, onDayClick }: WeeklyStripProps) {
  return (
    <div className="flex justify-center gap-3 py-3 px-4">
      {weekDays.map((day) => (
        <button
          key={day.dayOfWeek}
          onClick={() => onDayClick(day.dayOfWeek)}
          className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 transition-all duration-200 cursor-pointer"
          style={{
            background: day.isToday
              ? 'var(--t-card)'
              : 'transparent',
            boxShadow: day.isToday
              ? '0 0 0 1.5px var(--t-accent), var(--t-shadow-sm)'
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
            className="text-xs font-medium leading-none"
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
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--t-border)' }} />
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
