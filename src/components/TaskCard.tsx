import type { Task } from '../types'

interface TaskCardProps {
  task: Task
  onToggle: (taskId: string) => void
}

export default function TaskCard({ task, onToggle }: TaskCardProps) {
  const isCompleted = task.status === 'completed'

  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-center gap-4 rounded-2xl bg-white px-4 py-4 text-left
        shadow-[0_1px_8px_rgba(0,0,0,0.04)] border border-calm-border/40
        transition-all duration-200 ease-out
        hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] hover:border-calm-border/60
        focus:outline-none focus:ring-2 focus:ring-calm-focus/30 focus:ring-offset-1
        group
        ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Checkbox */}
      <div className="shrink-0">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
            transition-all duration-200
            ${isCompleted
              ? 'bg-[#7BC67E] border-[#7BC67E]'
              : 'border-calm-border hover:border-calm-focus'
            }`}
        >
          {isCompleted && (
            <svg
              className="w-3.5 h-3.5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Emoji + Title */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <span className="text-lg leading-none shrink-0">{task.emoji}</span>
        <span
          className={`text-[15px] leading-snug transition-all duration-200
            ${isCompleted
              ? 'line-through text-calm-text-light/60'
              : 'text-calm-text'
            }`}
        >
          {task.title}
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
            <span className="text-sm">&#x1FA84;</span> Help
          </span>
        </div>
      )}
    </button>
  )
}
