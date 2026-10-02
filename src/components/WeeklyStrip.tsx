import type { WeekDay } from '../types'

interface WeeklyStripProps {
  weekDays: WeekDay[]
  onDayClick: (dayOfWeek: number) => void
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function WeeklyStrip({ weekDays, onDayClick }: WeeklyStripProps) {
  return (
    <nav
      className="flex justify-center mb-4"
      style={{ animation: 'slide-up-fade 300ms ease-out' }}
      aria-label="Weekly day themes"
    >
      <div className="glass-card !rounded-2xl flex gap-0.5 p-1.5">
        {weekDays.map((day) => {
          const dayName = DAY_NAMES[day.dayOfWeek - 1]
          const themeLabel = day.theme ? day.theme.name : 'Open'
          const ariaLabel = `${dayName}, ${themeLabel}${day.isToday ? ' (today)' : ''}${day.hasCompletedTasks ? ', has completed tasks' : ''}`

          return (
            <button
              key={day.dayOfWeek}
              onClick={() => onDayClick(day.dayOfWeek)}
              aria-label={ariaLabel}
              aria-current={day.isToday ? 'date' : undefined}
              title={day.theme ? `${dayName}: ${day.theme.name}` : `Set a theme for ${dayName}`}
              className="flex flex-col items-center gap-1 rounded-xl min-w-[44px] min-h-[44px] px-2 pt-1.5 pb-1
                transition-colors duration-150 cursor-pointer hover:bg-[var(--t-neutral-btn-bg)]"
              style={day.isToday
                ? {
                    backgroundColor: 'var(--t-card-inner)',
                    boxShadow: '0 0 0 1.5px var(--t-accent-glow), var(--t-shadow-sm)',
                  }
                : undefined}
            >
              <span
                className="text-[10px] leading-none font-semibold tracking-wider uppercase"
                style={{ color: day.isToday ? 'var(--t-accent-text)' : 'var(--t-text-faint)' }}
              >
                {day.label}
              </span>

              <span className="text-lg leading-none h-6 flex items-center justify-center">
                {day.theme ? (
                  day.theme.emoji
                ) : (
                  <span
                    className="w-4 h-4 rounded-full border border-dashed"
                    style={{ borderColor: 'var(--t-text-faint)', opacity: 0.6 }}
                    aria-hidden="true"
                  />
                )}
              </span>

              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: day.hasCompletedTasks ? 'var(--t-green)' : 'transparent',
                }}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
