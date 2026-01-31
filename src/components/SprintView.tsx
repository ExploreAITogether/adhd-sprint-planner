import { useState } from 'react'
import { format } from 'date-fns'
import type { Sprint } from '../types'
import TaskCard from './TaskCard'

interface SprintViewProps {
  sprint: Sprint
  onBack: () => void
}

export default function SprintView({ sprint, onBack }: SprintViewProps) {
  // Local toggle state — database updates will be added in Phase 4
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'pending' | 'completed'>>(
    () => {
      const initial: Record<string, 'pending' | 'completed'> = {}
      for (const task of sprint.tasks) {
        initial[task.id] = task.status
      }
      return initial
    }
  )

  const handleToggle = (taskId: string) => {
    setTaskStatuses((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === 'completed' ? 'pending' : 'completed',
    }))
  }

  const completedCount = Object.values(taskStatuses).filter((s) => s === 'completed').length
  const totalCount = sprint.tasks.length
  const allDone = completedCount === totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Format the sprint date
  const sprintDate = (() => {
    try {
      return format(new Date(sprint.created_at), 'EEEE, MMMM d')
    } catch {
      return ''
    }
  })()

  return (
    <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex items-center justify-center p-6">
      <div className="w-full max-w-[600px]">
        <div className="bg-calm-card rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] px-10 py-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium text-calm-text">
              Your Sprint
            </h1>
            {sprintDate && (
              <p className="text-sm text-calm-text-light/70 mt-1.5">
                {sprintDate}
              </p>
            )}
          </div>

          {/* Task list */}
          <div className="flex flex-col gap-3">
            {sprint.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={{ ...task, status: taskStatuses[task.id] ?? task.status }}
                onToggle={handleToggle}
              />
            ))}
          </div>

          {/* Progress section */}
          <div className="mt-8">
            {/* Progress text */}
            <p className="text-sm text-center text-calm-text-light mb-3">
              {allDone ? 'All done! \u{1F389}' : `${completedCount} of ${totalCount} done`}
            </p>

            {/* Progress bar */}
            <div className="w-full h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-3">
            {allDone && (
              <button
                onClick={onBack}
                className="w-full rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
                  py-3.5 px-7 text-base font-medium text-white
                  shadow-[0_2px_12px_rgba(107,165,201,0.3)]
                  hover:from-[#8FC0DE] hover:to-[#7BB2D3] hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(107,165,201,0.4)]
                  active:scale-[0.99]
                  focus:outline-none focus:ring-2 focus:ring-[#7EB5D6]/40 focus:ring-offset-2
                  transition-all duration-200 ease-out"
              >
                New Sprint
              </button>
            )}

            <button
              onClick={() => {
                // History view will be added in a later phase
              }}
              className="w-full rounded-xl border border-calm-border/80 bg-white
                py-3 px-6 text-sm font-medium text-calm-text-light
                hover:bg-calm-border/10 hover:text-calm-text
                transition-all duration-200"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
