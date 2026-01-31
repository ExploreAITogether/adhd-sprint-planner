import type { Task } from '../types'

interface TaskCardProps {
  task: Task
  onToggle: (taskId: string) => void
  justCompleted?: boolean
}

export default function TaskCard({ task, onToggle, justCompleted }: TaskCardProps) {
  const isCompleted = task.status === 'completed'

  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-center gap-4 rounded-2xl bg-white px-4 py-4 text-left
        shadow-[0_1px_8px_rgba(0,0,0,0.04)] border border-calm-border/40
        hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] hover:border-calm-border/60
        focus:outline-none focus:ring-2 focus:ring-calm-focus/30 focus:ring-offset-1
        group
        ${isCompleted ? 'opacity-60' : ''}
        ${justCompleted
          ? 'animate-[card-complete_400ms_ease-out]'
          : 'transition-all duration-200 ease-out'
        }`}
    >
      {/* Checkbox area */}
      <div className="shrink-0 relative w-6 h-6">
        {/* Burst ring — only on fresh completion */}
        {justCompleted && (
          <div
            className="absolute inset-[-4px] rounded-full border-2 border-[#7BC67E] pointer-events-none"
            style={{ animation: 'check-burst 400ms ease-out forwards' }}
          />
        )}

        {/* Checkbox circle */}
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center relative overflow-hidden
            ${isCompleted
              ? ''
              : 'border-2 border-calm-border hover:border-calm-focus transition-colors duration-200'
            }`}
        >
          {/* Green fill */}
          {isCompleted && (
            <div
              className="absolute inset-0 rounded-full bg-[#7BC67E]"
              style={justCompleted
                ? { animation: 'check-fill 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' }
                : undefined
              }
            />
          )}

          {/* Checkmark */}
          {isCompleted && (
            <svg
              className="w-3.5 h-3.5 text-white relative z-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline
                points="20 6 9 17 4 12"
                style={justCompleted
                  ? { strokeDasharray: 24, animation: 'check-draw 250ms ease-out 150ms both' }
                  : undefined
                }
              />
            </svg>
          )}
        </div>
      </div>

      {/* Emoji + Title with animated strikethrough */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <span className="text-lg leading-none shrink-0">{task.emoji}</span>
        <span className="relative inline-flex items-center">
          <span
            className={`text-[15px] leading-snug transition-colors duration-300
              ${isCompleted ? 'text-calm-text-light/60' : 'text-calm-text'}`}
          >
            {task.title}
          </span>
          {/* Strikethrough line */}
          {isCompleted && (
            <span
              className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-calm-text-light/50 origin-left"
              style={justCompleted
                ? { animation: 'strikethrough 300ms ease-out 100ms both' }
                : undefined
              }
            />
          )}
        </span>
      </div>

      {/* Help button */}
      {!isCompleted && (
        <div
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => {
            e.stopPropagation()
            // Help functionality will be added in a later phase
          }}
        >
          <span
            className="inline-flex items-center gap-1 text-xs text-calm-text-light/70
              bg-calm-border/30 rounded-lg px-2.5 py-1.5
              hover:bg-calm-border/50 hover:text-calm-text-light
              transition-colors duration-150"
          >
            <span className="text-sm">{'\u{1FA84}'}</span> Help
          </span>
        </div>
      )}
    </button>
  )
}
