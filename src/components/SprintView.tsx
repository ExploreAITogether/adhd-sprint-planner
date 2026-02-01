import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import type { Sprint, Task } from '../types'
import { updateTaskStatus, updateSprintStatus, getSettings, updateSettings } from '../lib/database'
import { playCompleteSound, playSprintCompleteSound } from '../lib/sounds'
import TaskCard from './TaskCard'
import HelpPromptModal from './HelpPromptModal'

interface SprintViewProps {
  sprint: Sprint
  onBack: () => void
  onViewHistory: () => void
  onOpenSettings?: () => void
  onTaskToggle?: (taskId: string, newStatus: 'pending' | 'completed') => void
}

function CelebrationParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      left: 8 + Math.random() * 84,
      delay: Math.random() * 0.3,
      duration: 0.7 + Math.random() * 0.5,
      size: 3 + Math.random() * 5,
      color: ['#7EB5D6', '#7BC67E', '#E8E0F0', '#6BA5C9', '#8B97F8'][i % 5],
    }))
  )

  return (
    <div className="relative h-0 overflow-visible pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `float-up ${p.duration}s ease-out ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

export default function SprintView({ sprint, onBack, onViewHistory, onOpenSettings, onTaskToggle }: SprintViewProps) {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'pending' | 'completed'>>(() => {
    const initial: Record<string, 'pending' | 'completed'> = {}
    for (const task of sprint.tasks) {
      initial[task.id] = task.status
    }
    return initial
  })

  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const animTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [celebrating, setCelebrating] = useState(false)
  const prevAllDone = useRef(false)
  const [helpTask, setHelpTask] = useState<Task | null>(null)

  useEffect(() => {
    getSettings().then((s) => setSoundEnabled(s.sound_enabled)).catch(() => {})
  }, [])

  useEffect(() => {
    const timers = animTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
    }
  }, [])

  const completedCount = Object.values(taskStatuses).filter((s) => s === 'completed').length
  const totalCount = sprint.tasks.length
  const allDone = completedCount === totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      const timer = setTimeout(() => {
        setCelebrating(true)
        playSprintCompleteSound(soundEnabled)
      }, 500)
      return () => clearTimeout(timer)
    }
    if (!allDone && prevAllDone.current) {
      setCelebrating(false)
    }
    prevAllDone.current = allDone
  }, [allDone, soundEnabled])

  const handleToggle = useCallback((taskId: string) => {
    setTaskStatuses((prev) => {
      const wasCompleted = prev[taskId] === 'completed'
      const newStatus = wasCompleted ? 'pending' : 'completed'
      const now = new Date().toISOString()

      updateTaskStatus(taskId, newStatus, newStatus === 'completed' ? now : undefined).catch(
        (err) => console.error('Failed to update task:', err)
      )

      // Notify parent so activeSprint state stays in sync with DB
      onTaskToggle?.(taskId, newStatus)

      if (newStatus === 'completed') {
        setJustCompleted((s) => new Set(s).add(taskId))
        playCompleteSound(soundEnabled)

        const existing = animTimers.current.get(taskId)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
          setJustCompleted((s) => {
            const next = new Set(s)
            next.delete(taskId)
            return next
          })
          animTimers.current.delete(taskId)
        }, 700)
        animTimers.current.set(taskId, timer)

        const allOthersComplete = Object.entries(prev).every(
          ([id, status]) => id === taskId || status === 'completed'
        )
        if (allOthersComplete) {
          updateSprintStatus(sprint.id, 'completed').catch((err) =>
            console.error('Failed to update sprint status:', err)
          )
        }
      } else {
        setJustCompleted((s) => {
          const next = new Set(s)
          next.delete(taskId)
          return next
        })
        setCelebrating(false)

        updateSprintStatus(sprint.id, 'active').catch((err) =>
          console.error('Failed to update sprint status:', err)
        )
      }

      return { ...prev, [taskId]: newStatus }
    })
  }, [sprint.id, soundEnabled, onTaskToggle])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      updateSettings({ sound_enabled: next }).catch(() => {})
      return next
    })
  }, [])

  const handleHelp = useCallback((task: Task) => {
    setHelpTask({
      ...task,
      status: taskStatuses[task.id] ?? task.status,
    })
  }, [taskStatuses])

  const sprintDate = (() => {
    try {
      return format(new Date(sprint.created_at), 'EEEE, MMMM d')
    } catch {
      return ''
    }
  })()

  return (
    <div
      className="min-h-full flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}
    >
      <div className="w-full max-w-[600px]">
        <div
          className="rounded-3xl px-8 py-8 sm:px-10 sm:py-10 relative"
          style={{ backgroundColor: 'var(--t-card)', boxShadow: 'var(--t-shadow-card)' }}
        >
          {/* Top-right buttons: sound + settings */}
          <div className="absolute top-5 right-5 flex items-center gap-1">
            <button
              onClick={toggleSound}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 text-lg"
              style={{ color: 'var(--t-text-faint)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--t-text-light)'
                e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--t-text-faint)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? '\u{1F50A}' : '\u{1F507}'}
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150"
                style={{ color: 'var(--t-text-faint)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-light)'
                  e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-faint)'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                aria-label="Settings"
                title="Settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium" style={{ color: 'var(--t-text)' }}>
              Your Sprint
            </h1>
            {sprintDate && (
              <p className="text-sm mt-1.5" style={{ color: 'var(--t-text-light)' }}>
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
                onHelp={handleHelp}
                justCompleted={justCompleted.has(task.id)}
              />
            ))}
          </div>

          {/* Progress section */}
          <div className="mt-8">
            {celebrating && <CelebrationParticles />}

            <p
              className={`text-center mb-3 transition-all duration-300
                ${celebrating ? 'text-base font-medium' : 'text-sm'}`}
              style={{ color: celebrating ? 'var(--t-text)' : 'var(--t-text-light)' }}
            >
              {celebrating
                ? 'Nice sprint. All done. \u{2728}'
                : `${completedCount} of ${totalCount} done`}
            </p>

            {/* Progress bar */}
            <div
              className="w-full h-2 rounded-full overflow-hidden relative"
              style={{ backgroundColor: 'var(--t-progress-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                }}
              />
              {celebrating && (
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div
                    className="w-full h-full"
                    style={{
                      background: 'linear-gradient(to right, transparent, var(--t-shimmer), transparent)',
                      animation: 'shimmer 1.5s ease-in-out',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-3">
            {allDone && (
              <button
                onClick={onBack}
                className="w-full rounded-xl py-3.5 px-7 text-base font-medium text-white
                  hover:scale-[1.02] active:scale-[0.99]
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  transition-all duration-200 ease-out"
                style={{
                  background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                  boxShadow: `0 2px 12px var(--t-accent-shadow)`,
                  ...(celebrating
                    ? { animation: 'slide-up-fade 400ms ease-out 600ms both, gentle-pulse 2s ease-in-out 1.2s infinite' }
                    : {}),
                }}
              >
                New Sprint
              </button>
            )}

            <button
              onClick={onViewHistory}
              className="w-full rounded-xl py-3 px-6 text-sm font-medium
                transition-all duration-200"
              style={{
                backgroundColor: 'var(--t-card-inner)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--t-border)',
                color: 'var(--t-text-light)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--t-text)'
                e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--t-text-light)'
                e.currentTarget.style.backgroundColor = 'var(--t-card-inner)'
              }}
            >
              View History
            </button>
          </div>
        </div>
      </div>

      {helpTask && (
        <HelpPromptModal
          task={helpTask}
          onClose={() => setHelpTask(null)}
        />
      )}
    </div>
  )
}
