import type { Sprint } from '../types'

interface SprintViewProps {
  sprint: Sprint
  onBack: () => void
}

export default function SprintView({ sprint, onBack }: SprintViewProps) {
  const completedCount = sprint.tasks.filter((t) => t.status === 'completed').length
  const totalCount = sprint.tasks.length

  return (
    <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="bg-calm-card rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] px-10 py-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium text-calm-text">
              Your sprint
            </h1>
            <p className="text-sm text-calm-text-light mt-2">
              {completedCount} of {totalCount} tasks done
            </p>
          </div>

          {/* Task list */}
          <div className="space-y-3">
            {sprint.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-calm-border/60 bg-white px-5 py-4
                  transition-all duration-200"
              >
                {/* Emoji */}
                <span className="text-xl leading-none mt-0.5 shrink-0">{task.emoji}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-base text-calm-text leading-snug">
                    {task.title}
                  </p>
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-medium text-calm-text-light/60 bg-calm-border/30 rounded-full px-2.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div className="shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    task.status === 'completed'
                      ? 'bg-green-400 border-green-400'
                      : 'border-calm-border'
                  }`} />
                </div>
              </div>
            ))}
          </div>

          {/* Back button (temporary) */}
          <button
            onClick={onBack}
            className="mt-8 w-full rounded-xl border border-calm-border/80 bg-white
              py-3 px-6 text-sm font-medium text-calm-text-light
              hover:bg-calm-border/10 hover:text-calm-text
              transition-all duration-200"
          >
            &#x2190; New brain dump
          </button>
        </div>
      </div>
    </div>
  )
}
