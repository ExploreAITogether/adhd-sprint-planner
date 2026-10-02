import { useState, useEffect, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, isTomorrow } from 'date-fns'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { Sprint, Task, DayTheme, WeekDay } from '../types'
import {
  updateTaskStatus,
  updateSprintStatus,
  updateTaskTitle,
  deleteTask as dbDeleteTask,
  restoreTask,
  updateTaskPositions,
  addTask,
  getSettings,
  updateSettings,
} from '../lib/database'
import { playCompleteSound, playSprintCompleteSound } from '../lib/sounds'
import { useSpeechRecognition, type SpeechError } from '../hooks/useSpeechRecognition'
import TaskCard from './TaskCard'
import HelpPromptModal from './HelpPromptModal'
import WeeklyStrip from './WeeklyStrip'
import TodayThemeChip from './TodayThemeChip'
import Toast from './Toast'
import {
  HistoryIcon,
  MicIcon,
  PlusIcon,
  SettingsIcon,
  SoundOffIcon,
  SoundOnIcon,
  SparklesIcon,
  StopIcon,
} from './icons'

interface SprintViewProps {
  sprint: Sprint
  onBack: () => void
  onViewHistory: () => void
  onOpenSettings?: () => void
  onTaskToggle?: (taskId: string, newStatus: 'pending' | 'completed') => void
  onTaskEdit?: (taskId: string, newTitle: string) => void
  onTaskDelete?: (taskId: string) => void
  onTasksReorder?: (tasks: Task[]) => void
  onTaskAdd?: (task: Task) => void
  todayTheme?: DayTheme | null
  weekDays?: WeekDay[]
  onDayClick?: (dayOfWeek: number) => void
}

const PARTICLE_COLORS = ['#5B67DE', '#7F62D6', '#45A97C', '#F2A97E', '#8EC5F0', '#F5C451']

function CelebrationParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      left: 4 + Math.random() * 92,
      delay: Math.random() * 0.35,
      duration: 0.8 + Math.random() * 0.6,
      size: 4 + Math.random() * 5,
      round: i % 3 !== 0,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }))
  )

  return (
    <div className="relative h-0 overflow-visible pointer-events-none" aria-hidden="true">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: 24,
            width: p.size,
            height: p.size,
            borderRadius: p.round ? '9999px' : '2px',
            backgroundColor: p.color,
            animation: `float-up ${p.duration}s ease-out ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

// 8s gives unhurried time to notice and react; hovering pauses the countdown.
const UNDO_TOAST_MS = 8000

const KEYWORD_EMOJI_MAP: [RegExp, string][] = [
  [/\b(email|reply|inbox|mail)\b/i, '📧'],
  [/\b(call|phone|dial)\b/i, '📞'],
  [/\b(write|draft|blog|post)\b/i, '✏️'],
  [/\b(fix|bug|debug)\b/i, '🔧'],
  [/\b(clean|organize|tidy|declutter)\b/i, '🧹'],
  [/\b(exercise|run|gym|workout|walk)\b/i, '🏃'],
  [/\b(read|book|article)\b/i, '📖'],
  [/\b(buy|shop|purchase|order)\b/i, '🛒'],
  [/\b(cook|meal|food|dinner|lunch)\b/i, '🍳'],
  [/\b(meet|meeting|sync)\b/i, '🤝'],
  [/\b(plan|schedule|calendar)\b/i, '📅'],
  [/\b(learn|study|course)\b/i, '📚'],
  [/\b(design|sketch|draw)\b/i, '🎨'],
  [/\b(code|develop|program)\b/i, '💻'],
  [/\b(test|check|review)\b/i, '✅'],
]

function getEmojiForTask(title: string): string {
  for (const [pattern, emoji] of KEYWORD_EMOJI_MAP) {
    if (pattern.test(title)) return emoji
  }
  return '📌'
}

function voiceErrorMessage(error: SpeechError): string {
  switch (error) {
    case 'permission-denied':
      return 'Microphone access needed for voice input. Enable in system settings.'
    case 'no-speech':
      return "I didn't hear anything. Try again?"
    case 'network':
      return "You're offline. Voice recognition needs a network connection."
    case 'not-supported':
      return 'Voice input is not supported in this browser.'
    default:
      return 'Something went wrong with voice input. Try again?'
  }
}

export default function SprintView({
  sprint,
  onBack,
  onViewHistory,
  onOpenSettings,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onTasksReorder,
  onTaskAdd,
  todayTheme,
  weekDays,
  onDayClick,
}: SprintViewProps) {
  // Ordered, mutable task list — single source of truth for the sprint view
  const [tasks, setTasks] = useState<Task[]>(() =>
    [...(sprint.tasks ?? [])].sort((a, b) => a.position - b.position)
  )

  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const animTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [celebrating, setCelebrating] = useState(false)
  const prevAllDone = useRef(false)
  const [helpTask, setHelpTask] = useState<Task | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [deletedTaskInfo, setDeletedTaskInfo] = useState<{ task: Task; index: number } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputValue, setAddInputValue] = useState('')
  const [confirmingStartFresh, setConfirmingStartFresh] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const voiceBaseRef = useRef('')
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const clearErrorToast = useCallback(() => setErrorToast(null), [])
  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition()

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    getSettings().then((s) => setSoundEnabled(s.sound_enabled)).catch(() => {})
  }, [])

  useEffect(() => {
    const timers = animTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (transcript || interimTranscript) {
      const combined = `${voiceBaseRef.current}${transcript}${interimTranscript}`
      const timer = setTimeout(() => setAddInputValue(combined.slice(0, 120)), 0)
      return () => clearTimeout(timer)
    }
  }, [transcript, interimTranscript])

  useEffect(() => {
    if (speechError && speechError !== 'not-supported') {
      const timer = setTimeout(() => setErrorToast(voiceErrorMessage(speechError)), 0)
      return () => clearTimeout(timer)
    }
  }, [speechError])

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
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
      const timer = setTimeout(() => setCelebrating(false), 0)
      prevAllDone.current = allDone
      return () => clearTimeout(timer)
    }
    prevAllDone.current = allDone
  }, [allDone, soundEnabled])

  // ── Task toggle ──

  // Note: these handlers read `tasks` directly rather than using setTasks
  // updater functions, because React requires updaters to be pure — DB writes,
  // sounds, and sibling setState calls inside them double-fire under StrictMode.
  const handleToggle = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const wasCompleted = task.status === 'completed'
    const newStatus: Task['status'] = wasCompleted ? 'pending' : 'completed'
    const now = new Date().toISOString()
    const previousTasks = tasks

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? now : null }
          : t
      )
    )

    updateTaskStatus(taskId, newStatus, newStatus === 'completed' ? now : undefined).catch(
      (err) => {
        console.error('Failed to update task:', err)
        setTasks(previousTasks)
        onTaskToggle?.(taskId, wasCompleted ? 'completed' : 'pending')
        setErrorToast('Failed to update task. Change has been reverted.')
      }
    )

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

      // Check if this was the last pending task: if every *other* task is
      // already completed, toggling this one completes the entire sprint.
      const allOthersComplete = tasks.every(
        (t) => t.id === taskId || t.status === 'completed'
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
  }, [tasks, sprint.id, soundEnabled, onTaskToggle])

  // ── Task edit ──

  const handleStartEdit = useCallback((taskId: string) => {
    setEditingTaskId(taskId)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null)
  }, [])

  const handleEdit = useCallback((taskId: string, newTitle: string) => {
    const oldTask = tasks.find((t) => t.id === taskId)
    const oldTitle = oldTask?.title ?? newTitle

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t)))

    updateTaskTitle(taskId, newTitle).catch((err) => {
      console.error('Failed to update task title:', err)
      setTasks((current) =>
        current.map((t) => (t.id === taskId ? { ...t, title: oldTitle } : t))
      )
      onTaskEdit?.(taskId, oldTitle)
      setErrorToast('Failed to save edit. Change has been reverted.')
    })

    onTaskEdit?.(taskId, newTitle)
    setEditingTaskId(null)
  }, [tasks, onTaskEdit])

  // ── Task delete with undo ──

  const handleDelete = useCallback((taskId: string) => {
    // Play delete animation first
    setDeletingTaskId(taskId)

    // Delay removal to let the CSS slide-out animation finish (300ms matches
    // the task-slide-out keyframe duration defined in index.css).
    setTimeout(() => {
      setDeletingTaskId(null)

      const index = tasks.findIndex((t) => t.id === taskId)
      if (index === -1) return

      const task = tasks[index]

      setTasks((prev) => prev.filter((t) => t.id !== taskId))

      dbDeleteTask(taskId).catch((err) => {
        console.error('Failed to delete task:', err)
        setTasks((current) => {
          const restored = [...current]
          restored.splice(Math.min(index, current.length), 0, task)
          return restored
        })
        setDeletedTaskInfo(null)
        setErrorToast('Failed to delete task. It has been restored.')
      })

      onTaskDelete?.(taskId)
      setDeletedTaskInfo({ task, index })
    }, 300)
  }, [tasks, onTaskDelete])

  const handleUndo = useCallback(() => {
    if (!deletedTaskInfo) return

    const { task, index } = deletedTaskInfo

    // Restore to DB
    restoreTask(task).catch((err) => {
      console.error('Failed to restore task:', err)
      // Revert: remove the task from UI since DB restore failed
      setTasks((current) => current.filter((t) => t.id !== task.id))
      setErrorToast('Failed to restore task.')
    })

    // Restore to local state at original position, then notify parent with
    // the full restored list so it gets the task back via onTasksReorder.
    const restored = [...tasks]
    restored.splice(Math.min(index, tasks.length), 0, task)
    setTasks(restored)
    onTasksReorder?.(restored)

    setDeletedTaskInfo(null)
  }, [deletedTaskInfo, tasks, onTasksReorder])

  const handleUndoDone = useCallback(() => {
    setDeletedTaskInfo(null)
  }, [])

  // ── Drag and drop reorder ──

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(tasks, oldIndex, newIndex)
    const positioned = reordered.map((t, i) => ({ ...t, position: i }))
    const previousTasks = tasks

    setTasks(positioned)

    updateTaskPositions(positioned.map((t, i) => ({ id: t.id, position: i }))).catch(
      (err) => {
        console.error('Failed to update positions:', err)
        setTasks(previousTasks)
        onTasksReorder?.(previousTasks)
        setErrorToast('Failed to reorder tasks. Order has been reverted.')
      }
    )

    onTasksReorder?.(positioned)
  }, [tasks, onTasksReorder])

  // ── Other handlers ──

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      updateSettings({ sound_enabled: next }).catch(() => {})
      return next
    })
  }, [])

  const handleHelp = useCallback((task: Task) => {
    setHelpTask(task)
  }, [])

  // ── Start fresh (abandon partial sprint) ──

  const handleStartFresh = useCallback(() => {
    updateSprintStatus(sprint.id, 'abandoned').catch((err) =>
      console.error('Failed to abandon sprint:', err)
    )
    onBack()
  }, [sprint.id, onBack])

  // ── Add task ──

  const MAX_TASKS = 5

  const handleOpenAddInput = useCallback(() => {
    setShowAddInput(true)
    // Focus after render
    setTimeout(() => addInputRef.current?.focus(), 0)
  }, [])

  const handleCloseAddInput = useCallback(() => {
    if (isListening) stopListening()
    resetTranscript()
    voiceBaseRef.current = ''
    setShowAddInput(false)
    setAddInputValue('')
  }, [isListening, stopListening, resetTranscript])

  const handleAddVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening()
      addInputRef.current?.focus()
      return
    }

    setShowAddInput(true)
    setErrorToast(null)
    resetTranscript()
    voiceBaseRef.current = addInputValue.trim() ? `${addInputValue.trim()} ` : ''
    startListening()
    setTimeout(() => addInputRef.current?.focus(), 0)
  }, [addInputValue, isListening, resetTranscript, startListening, stopListening])

  const handleAddTaskSubmit = useCallback(async () => {
    const title = addInputValue.trim()
    if (!title) return
    if (tasks.length >= MAX_TASKS) return

    const emoji = getEmojiForTask(title)
    const nextPosition = tasks.length > 0 ? Math.max(...tasks.map((t) => t.position)) + 1 : 0

    try {
      const savedTask = await addTask(sprint.id, {
        title,
        emoji,
        tags: [],
        status: 'pending',
        completed_at: null,
        generated_prompt: null,
      }, nextPosition)

      setTasks((prev) => [...prev, savedTask])
      onTaskAdd?.(savedTask)
      setAddInputValue('')
      if (isListening) stopListening()
      resetTranscript()
      voiceBaseRef.current = ''
      // Keep input open for adding more
      addInputRef.current?.focus()
    } catch (err) {
      console.error('Failed to add task:', err)
      setErrorToast('Failed to add task. Please try again.')
    }
  }, [addInputValue, tasks, sprint.id, onTaskAdd, isListening, stopListening, resetTranscript])

  // Derive display-friendly date info. Wrapped in try-catch because
  // sprint.created_at could theoretically be an invalid ISO string.
  const sprintDateInfo = (() => {
    try {
      const date = new Date(sprint.created_at)
      const dateStr = format(date, 'EEEE, MMM d')
      let prefix: string | null = null
      if (isToday(date)) prefix = 'Today'
      else if (isYesterday(date)) prefix = 'Yesterday'
      else if (isTomorrow(date)) prefix = 'Tomorrow'
      return { prefix, dateStr }
    } catch {
      return null
    }
  })()

  const taskIds = tasks.map((t) => t.id)

  return (
    <div className="app-bg flex items-center justify-center p-5 sm:p-6">
      <div className="w-full max-w-[600px]">
        {/* Weekly day strip above the card */}
        {weekDays && weekDays.length > 0 && onDayClick && (
          <WeeklyStrip weekDays={weekDays} onDayClick={onDayClick} />
        )}

        <div className="glass-card px-5 py-7 sm:px-9 sm:py-9 relative">
          {/* Top-right toolbar: history, sound, settings */}
          <div className="absolute top-4 right-4 flex items-center gap-0.5">
            <button onClick={onViewHistory} className="icon-btn" aria-label="View history" title="History">
              <HistoryIcon />
            </button>
            <button
              onClick={toggleSound}
              className="icon-btn"
              aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
            </button>
            {onOpenSettings && (
              <button onClick={onOpenSettings} className="icon-btn" aria-label="Settings" title="Settings">
                <SettingsIcon />
              </button>
            )}
          </div>

          {/* Header */}
          <div className="text-center mb-6 pt-8 sm:pt-0 sm:px-14">
            {todayTheme && <TodayThemeChip theme={todayTheme} />}
            <h1 className="font-display text-[28px] sm:text-[32px] leading-tight font-medium">
              Your Sprint
            </h1>
            {sprintDateInfo && (
              <p className="text-sm mt-1.5" style={{ color: 'var(--t-text-light)' }}>
                {sprintDateInfo.prefix && (
                  <>
                    <span className="font-medium" style={{ color: 'var(--t-accent-text)' }}>
                      {sprintDateInfo.prefix}
                    </span>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                {sprintDateInfo.dateStr}
              </p>
            )}
          </div>

          {/* Progress — kept near the top so it's visible without scrolling */}
          {totalCount > 0 && (
            <div className="mb-5">
              {celebrating && <CelebrationParticles />}
              <div className="flex items-baseline justify-between mb-2 px-0.5" aria-live="polite">
                <span
                  className={`transition-all duration-300 ${celebrating ? 'text-[15px] font-semibold' : 'text-[13px] font-medium'}`}
                  style={{ color: celebrating ? 'var(--t-text)' : 'var(--t-text-light)' }}
                >
                  {celebrating ? 'Nice sprint. All done. \u{2728}' : `${completedCount} of ${totalCount} done`}
                </span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--t-text-faint)' }}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden relative"
                style={{ backgroundColor: 'var(--t-progress-bg)' }}
                role="progressbar"
                aria-label="Sprint progress"
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-valuenow={completedCount}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundImage: allDone
                      ? 'linear-gradient(90deg, var(--t-accent), var(--t-accent-end), var(--t-green))'
                      : 'linear-gradient(90deg, var(--t-accent), var(--t-accent-end))',
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
          )}

          {/* Task list with drag-and-drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2.5">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onHelp={handleHelp}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    justCompleted={justCompleted.has(task.id)}
                    isEditing={editingTaskId === task.id}
                    isDeleting={deletingTaskId === task.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Empty state after all tasks deleted */}
          {tasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2" aria-hidden="true">{'\u{1F343}'}</p>
              <p className="text-sm" style={{ color: 'var(--t-text-light)' }}>
                No tasks remaining. Start a new sprint?
              </p>
            </div>
          )}

          {/* Add task */}
          {tasks.length < MAX_TASKS && (
            <div className="mt-2.5">
              {showAddInput ? (
                <div
                  className={`field flex items-center gap-2 rounded-2xl pl-4 pr-2 py-2
                    ${isListening
                      ? 'field-recording'
                      : 'focus-within:border-[var(--t-focus)] focus-within:shadow-[0_0_0_4px_var(--t-accent-soft-strong)]'}`}
                >
                  <input
                    ref={addInputRef}
                    type="text"
                    value={addInputValue}
                    onChange={(e) => setAddInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTaskSubmit()
                      if (e.key === 'Escape') handleCloseAddInput()
                    }}
                    onBlur={(e) => {
                      // Don't close if clicking an inline add control.
                      if (e.relatedTarget?.getAttribute('data-add-btn')) return
                      if (e.relatedTarget?.getAttribute('data-voice-btn')) return
                      if (!addInputValue.trim()) handleCloseAddInput()
                    }}
                    aria-label="New task"
                    placeholder={isListening ? 'Listening...' : 'What else?'}
                    className="flex-1 min-w-0 bg-transparent text-[15px] outline-none focus-visible:outline-none placeholder:text-[var(--t-text-faint)]"
                    style={{ color: 'var(--t-text)', caretColor: 'var(--t-accent)' }}
                    maxLength={120}
                  />
                  {voiceSupported && (
                    <div className="relative shrink-0">
                      {isListening && (
                        <span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{ backgroundColor: 'var(--t-red)', opacity: 0.25, animation: 'recording-ring 1.5s ease-out infinite' }}
                        />
                      )}
                      <button
                        data-voice-btn="true"
                        onClick={handleAddVoiceToggle}
                        aria-label={isListening ? 'Stop recording task' : 'Record task by voice'}
                        title={isListening ? 'Stop recording' : 'Record task'}
                        className={`relative ${isListening ? 'btn w-8 h-8 !rounded-full' : 'icon-btn !w-8 !h-8'}`}
                        style={isListening
                          ? {
                              backgroundColor: 'var(--t-red)',
                              color: '#FFFFFF',
                              animation: 'recording-pulse 1.5s ease-in-out infinite',
                            }
                          : undefined
                        }
                      >
                        {isListening ? <StopIcon size={11} /> : <MicIcon size={16} />}
                      </button>
                    </div>
                  )}
                  <button
                    data-add-btn="true"
                    onClick={handleAddTaskSubmit}
                    disabled={!addInputValue.trim()}
                    className="btn btn-primary text-[13px] !rounded-xl px-3.5 h-8"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenAddInput}
                  className="btn btn-ghost w-full !justify-start text-sm h-11 px-4 !rounded-2xl border border-dashed"
                  style={{ borderColor: 'var(--t-border)' }}
                >
                  <PlusIcon size={16} />
                  Add task
                </button>
              )}
            </div>
          )}
          {tasks.length >= MAX_TASKS && (
            <p className="mt-3 text-center text-xs" style={{ color: 'var(--t-text-faint)' }}>
              Sprint full — {MAX_TASKS} tasks max
            </p>
          )}

          {/* Action buttons */}
          {(allDone || tasks.length === 0) && (
            <button
              onClick={onBack}
              className="btn btn-primary w-full h-[52px] !rounded-2xl text-[15px] mt-6"
              style={celebrating
                ? { animation: 'slide-up-fade 400ms ease-out 600ms both, gentle-pulse 2.4s ease-in-out 1.2s infinite' }
                : undefined}
            >
              <SparklesIcon size={17} />
              New Sprint
            </button>
          )}

          {/* Escape hatch from a partially-done sprint: marks it abandoned
              instead of leaving a stale active sprint lingering forever. */}
          {!allDone && tasks.length > 0 && (
            <div className="mt-5 flex justify-center">
              {confirmingStartFresh ? (
                <div
                  className="flex flex-wrap items-center justify-center gap-2 text-sm"
                  style={{ animation: 'slide-up-fade 200ms ease-out' }}
                >
                  <span className="mr-1" style={{ color: 'var(--t-text-light)' }}>
                    Leave the rest behind?
                  </span>
                  <button onClick={handleStartFresh} className="btn btn-soft text-sm px-3 py-1.5 !rounded-xl">
                    Yes, start fresh
                  </button>
                  <button onClick={() => setConfirmingStartFresh(false)} className="btn btn-ghost text-sm px-3 py-1.5 !rounded-xl">
                    Keep going
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingStartFresh(true)}
                  className="btn btn-ghost text-xs px-3 py-1.5 !rounded-xl"
                  style={{ color: 'var(--t-text-faint)' }}
                >
                  Start fresh instead
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {helpTask && (
        <HelpPromptModal
          task={helpTask}
          onClose={() => setHelpTask(null)}
        />
      )}

      {deletedTaskInfo && (
        <Toast
          message="Task removed"
          action={{ label: 'Undo', onClick: handleUndo }}
          durationMs={UNDO_TOAST_MS}
          pauseOnHover
          onDone={handleUndoDone}
        />
      )}

      {errorToast && (
        <Toast
          tone="error"
          message={errorToast}
          raised={!!deletedTaskInfo}
          onDone={clearErrorToast}
        />
      )}
    </div>
  )
}
