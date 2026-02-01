import type { Task } from '../types'

interface TaskCardProps {
  task: Task
  onToggle: (taskId: string) => void
  onHelp: (task: Task) => void
  justCompleted?: boolean
}

export default function TaskCard({ task, onToggle, onHelp, justCompleted }: TaskCardProps) {
  const isCompleted = task.status === 'completed'

  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-center gap-4 rounded-2xl px-4 py-4 text-left
        focus:outline-none focus:ring-2 focus:ring-offset-1
        group
        ${isCompleted ? 'opacity-60' : ''}
        ${justCompleted
          ? 'animate-[card-complete_400ms_ease-out]'
          : 'transition-all duration-200 ease-out'
        }`}
      style={{
        backgroundColor: 'var(--t-card-inner)',
        boxShadow: 'var(--t-shadow-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--t-border-light)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--t-shadow-sm-hover)'
        e.currentTarget.style.borderColor = 'var(--t-border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--t-shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--t-border-light)'
      }}
    >
      {/* Checkbox area */}
      <div className="shrink-0 relative w-6 h-6">
        {justCompleted && (
          <div
            className="absolute inset-[-4px] rounded-full pointer-events-none"
            style={{ border: '2px solid var(--t-green)', animation: 'check-burst 400ms ease-out forwards' }}
          />
        )}

        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center relative overflow-hidden
            ${isCompleted ? '' : 'transition-colors duration-200'}`}
          style={isCompleted ? undefined : { border: '2px solid var(--t-border)' }}
        >
          {isCompleted && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'var(--t-green)',
                ...(justCompleted ? { animation: 'check-fill 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' } : {}),
              }}
            />
          )}

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
            className="text-[15px] leading-snug transition-colors duration-300"
            style={{ color: isCompleted ? 'var(--t-text-faint)' : 'var(--t-text)' }}
          >
            {task.title}
          </span>
          {isCompleted && (
            <span
              className="absolute left-0 right-0 top-1/2 h-[1.5px] origin-left"
              style={{
                backgroundColor: 'var(--t-text-faint)',
                ...(justCompleted ? { animation: 'strikethrough 300ms ease-out 100ms both' } : {}),
              }}
            />
          )}
        </span>
      </div>

      {/* Help button */}
      <div
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={(e) => {
          e.stopPropagation()
          onHelp(task)
        }}
      >
        <span
          className="inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5
            transition-colors duration-150"
          style={{
            color: 'var(--t-text-light)',
            backgroundColor: 'var(--t-border-light)',
          }}
        >
          <span className="text-sm">{'\u{1FA84}'}</span> Help
        </span>
      </div>
    </button>
  )
}
