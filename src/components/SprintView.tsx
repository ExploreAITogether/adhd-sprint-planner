import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import type { Sprint } from '../types'
import { updateTaskStatus, updateSprintStatus, getSettings, updateSettings } from '../lib/database'
import { playCompleteSound, playSprintCompleteSound } from '../lib/sounds'
import TaskCard from './TaskCard'

interface SprintViewProps {
  sprint: Sprint
  onBack: () => void
}

// Small celebration particles that float up from the progress bar
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

export default function SprintView({ sprint, onBack }: SprintViewProps) {
  // ── Task status (optimistic local state) ──
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'pending' | 'completed'>>(() => {
    const initial: Record<string, 'pending' | 'completed'> = {}
    for (const task of sprint.tasks) {
      initial[task.id] = task.status
    }
    return initial
  })

  // ── Animation tracking ──
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const animTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Sound ──
  const [soundEnabled, setSoundEnabled] = useState(true)

  // ── Celebration ──
  const [celebrating, setCelebrating] = useState(false)
  const prevAllDone = useRef(false)

  // Load sound preference on mount
  useEffect(() => {
    getSettings().then((s) => setSoundEnabled(s.sound_enabled)).catch(() => {})
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = animTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
    }
  }, [])

  // ── Derived state ──
  const completedCount = Object.values(taskStatuses).filter((s) => s === 'completed').length
  const totalCount = sprint.tasks.length
  const allDone = completedCount === totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // ── Detect sprint completion transition ──
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      // Sprint just became complete — trigger celebration after task animation settles
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

  // ── Toggle handler with optimistic update + background DB write ──
  const handleToggle = useCallback((taskId: string) => {
    setTaskStatuses((prev) => {
      const wasCompleted = prev[taskId] === 'completed'
      const newStatus = wasCompleted ? 'pending' : 'completed'
      const now = new Date().toISOString()

      // Fire-and-forget database writes
      updateTaskStatus(taskId, newStatus, newStatus === 'completed' ? now : undefined).catch(
        (err) => console.error('Failed to update task:', err)
      )

      if (newStatus === 'completed') {
        // Trigger completion animation
        setJustCompleted((s) => new Set(s).add(taskId))

        // Play task completion sound
        playCompleteSound(soundEnabled)

        // Clear animation flag after animations finish
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

        // Check if this completes the sprint
        const allOthersComplete = Object.entries(prev).every(
          ([id, status]) => id === taskId || status === 'completed'
        )
        if (allOthersComplete) {
          updateSprintStatus(sprint.id, 'completed').catch((err) =>
            console.error('Failed to update sprint status:', err)
          )
        }
      } else {
        // Unchecking — remove animation immediately
        setJustCompleted((s) => {
          const next = new Set(s)
          next.delete(taskId)
          return next
        })
        setCelebrating(false)

        // Sprint is no longer complete
        updateSprintStatus(sprint.id, 'active').catch((err) =>
          console.error('Failed to update sprint status:', err)
        )
      }

      return { ...prev, [taskId]: newStatus }
    })
  }, [sprint.id, soundEnabled])

  // ── Sound toggle ──
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      updateSettings({ sound_enabled: next }).catch(() => {})
      return next
    })
  }, [])

  // ── Format the sprint date ──
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
        <div className="bg-calm-card rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] px-10 py-10 relative">
          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className="absolute top-5 right-6 text-lg opacity-40 hover:opacity-70 transition-opacity duration-200"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? '\u{1F50A}' : '\u{1F507}'}
          </button>

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
                justCompleted={justCompleted.has(task.id)}
              />
            ))}
          </div>

          {/* Progress section */}
          <div className="mt-8">
            {/* Celebration particles */}
            {celebrating && <CelebrationParticles />}

            {/* Progress text */}
            <p
              className={`text-center mb-3 transition-all duration-300
                ${celebrating
                  ? 'text-base font-medium text-calm-text'
                  : 'text-sm text-calm-text-light'
                }`}
            >
              {celebrating
                ? 'Nice sprint. All done. \u{2728}'
                : `${completedCount} of ${totalCount} done`}
            </p>

            {/* Progress bar */}
            <div className="w-full h-2 bg-[#E8E8E8] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Shimmer on completion */}
              {celebrating && (
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div
                    className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{ animation: 'shimmer 1.5s ease-in-out' }}
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
                className="w-full rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
                  py-3.5 px-7 text-base font-medium text-white
                  shadow-[0_2px_12px_rgba(107,165,201,0.3)]
                  hover:from-[#8FC0DE] hover:to-[#7BB2D3] hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(107,165,201,0.4)]
                  active:scale-[0.99]
                  focus:outline-none focus:ring-2 focus:ring-[#7EB5D6]/40 focus:ring-offset-2
                  transition-all duration-200 ease-out"
                style={celebrating
                  ? { animation: 'slide-up-fade 400ms ease-out 600ms both, gentle-pulse 2s ease-in-out 1.2s infinite' }
                  : undefined
                }
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
