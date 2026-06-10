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

// 8s gives unhurried time to notice and react; hovering pauses the countdown.
const UNDO_TOAST_MS = 8000

function UndoToast({ message, onUndo, onDone }: { message: string; onUndo: () => void; onDone: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const startTimer = useCallback(() => {
    timerRef.current = setTimeout(onDone, UNDO_TOAST_MS)
  }, [onDone])

  useEffect(() => {
    startTimer()
    return () => clearTimeout(timerRef.current)
  }, [startTimer])

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        rounded-2xl px-5 py-3 text-sm font-medium flex items-center gap-3"
      style={{
        backgroundColor: 'var(--t-toast-bg)',
        border: '1px solid var(--t-toast-border)',
        boxShadow: 'var(--t-toast-shadow)',
        color: 'var(--t-text)',
        animation: 'slide-up-fade 300ms ease-out',
      }}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={startTimer}
    >
      <span>{message}</span>
      <button
        onClick={onUndo}
        className="text-sm font-semibold rounded-lg px-3 py-1 transition-colors duration-150"
        style={{
          color: 'var(--t-accent)',
          backgroundColor: 'var(--t-border-light)',
        }}
      >
        Undo
      </button>
    </div>
  )
}

function ErrorToast({ message, raised, onDone }: { message: string; raised?: boolean; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      className={`fixed ${raised ? 'bottom-20' : 'bottom-6'} left-1/2 -translate-x-1/2 z-50
        rounded-2xl px-5 py-3 text-sm font-medium`}
      style={{
        backgroundColor: 'var(--t-toast-bg)',
        border: '1px solid var(--t-toast-border)',
        boxShadow: 'var(--t-toast-shadow)',
        color: 'var(--t-red, #e53e3e)',
        animation: 'slide-up-fade 300ms ease-out',
      }}
    >
      {message}
    </div>
  )
}

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
    <div
      className="min-h-full flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}
    >
      <div className="w-full max-w-[600px]">
        {/* Weekly day strip above the card */}
        {weekDays && weekDays.length > 0 && onDayClick && (
          <WeeklyStrip weekDays={weekDays} onDayClick={onDayClick} />
        )}

        <div
          className="rounded-3xl px-8 py-8 sm:px-10 sm:py-10 relative"
          style={{
            backgroundColor: 'var(--t-card)',
            boxShadow: 'var(--t-shadow-card)',
            border: '1px solid var(--t-card-border)',
          }}
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
            {todayTheme && (
              <p
                className="mb-2 flex items-center justify-center gap-1.5"
                style={{ color: 'var(--t-text-light)', animation: 'slide-up-fade 300ms ease-out' }}
              >
                <span className="text-[28px] leading-none">{todayTheme.emoji}</span>
                <span className="text-sm font-medium">{todayTheme.name}</span>
              </p>
            )}
            <h1 className="text-2xl font-medium" style={{ color: 'var(--t-text)' }}>
              Your Sprint
            </h1>
            {sprintDateInfo && (
              <p className="text-sm mt-1.5" style={{ color: 'var(--t-text-light)' }}>
                {sprintDateInfo.prefix && (
                  <>
                    <span className="font-medium" style={{ color: 'var(--t-accent)' }}>
                      {sprintDateInfo.prefix}
                    </span>
                    <span> · </span>
                  </>
                )}
                {sprintDateInfo.dateStr}
              </p>
            )}
          </div>

          {/* Task list with drag-and-drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
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

          {/* Add task */}
          {tasks.length < MAX_TASKS && (
            <div className="mt-3">
              {showAddInput ? (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                  style={{
                    backgroundColor: 'var(--t-card-inner)',
                    border: isListening ? '1px solid var(--t-red)' : '1px solid var(--t-border)',
                    boxShadow: isListening ? '0 0 0 2px rgba(229,115,115,0.1)' : undefined,
                  }}
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
                    placeholder={isListening ? 'Listening...' : 'What else?'}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
                    style={{ color: 'var(--t-text)', caretColor: 'var(--t-accent)' }}
                    maxLength={120}
                  />
                  {voiceSupported && (
                    <div className="relative shrink-0">
                      {isListening && (
                        <span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{ backgroundColor: 'rgba(229,115,115,0.25)', animation: 'recording-ring 1.5s ease-out infinite' }}
                        />
                      )}
                      <button
                        data-voice-btn="true"
                        onClick={handleAddVoiceToggle}
                        aria-label={isListening ? 'Stop recording task' : 'Record task by voice'}
                        title={isListening ? 'Stop recording' : 'Record task'}
                        className="relative w-8 h-8 rounded-full flex items-center justify-center
                          transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={isListening
                          ? {
                              backgroundColor: 'var(--t-red)',
                              color: '#FFFFFF',
                              boxShadow: '0 2px 10px rgba(229,115,115,0.35)',
                              animation: 'recording-pulse 1.5s ease-in-out infinite',
                            }
                          : {
                              backgroundColor: 'var(--t-neutral-btn-bg)',
                              color: 'var(--t-text)',
                            }
                        }
                      >
                        {isListening ? (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <rect x="2" y="2" width="12" height="12" rx="2" />
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="9" y="1" width="6" height="12" rx="3" />
                            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  <button
                    data-add-btn="true"
                    onClick={handleAddTaskSubmit}
                    disabled={!addInputValue.trim()}
                    className="text-xs font-medium rounded-lg px-3 py-1.5 transition-opacity duration-150"
                    style={{
                      color: 'white',
                      background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                      opacity: addInputValue.trim() ? 1 : 0.4,
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenAddInput}
                  className="w-full text-left text-sm py-2 px-1 transition-colors duration-150 rounded-lg"
                  style={{ color: 'var(--t-text-faint)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--t-text-light)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--t-text-faint)'
                  }}
                >
                  + Add task
                </button>
              )}
            </div>
          )}
          {tasks.length >= MAX_TASKS && (
            <p className="mt-3 text-center text-xs" style={{ color: 'var(--t-text-faint)' }}>
              Sprint full — {MAX_TASKS} tasks max
            </p>
          )}

          {/* Empty state after all tasks deleted */}
          {tasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--t-text-light)' }}>
                No tasks remaining. Start a new sprint?
              </p>
            </div>
          )}

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
                : totalCount > 0
                  ? `${completedCount} of ${totalCount} done`
                  : ''}
            </p>

            {/* Progress bar */}
            {totalCount > 0 && (
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
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-3">
            {(allDone || tasks.length === 0) && (
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

            {/* Escape hatch from a partially-done sprint: marks it abandoned
                instead of leaving a stale active sprint lingering forever. */}
            {!allDone && tasks.length > 0 && (
              confirmingStartFresh ? (
                <div
                  className="flex items-center justify-center gap-3 text-sm py-1"
                  style={{ animation: 'slide-up-fade 200ms ease-out' }}
                >
                  <span style={{ color: 'var(--t-text-light)' }}>
                    Leave the rest behind?
                  </span>
                  <button
                    onClick={handleStartFresh}
                    className="font-medium rounded-lg px-3 py-1 transition-colors duration-150"
                    style={{ color: 'var(--t-accent)', backgroundColor: 'var(--t-border-light)' }}
                  >
                    Yes, start fresh
                  </button>
                  <button
                    onClick={() => setConfirmingStartFresh(false)}
                    className="rounded-lg px-3 py-1 transition-colors duration-150"
                    style={{ color: 'var(--t-text-light)' }}
                  >
                    Keep going
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingStartFresh(true)}
                  className="w-full text-center text-xs py-1.5 transition-colors duration-150"
                  style={{ color: 'var(--t-text-faint)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--t-text-light)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t-text-faint)' }}
                >
                  Start fresh instead
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {helpTask && (
        <HelpPromptModal
          task={helpTask}
          onClose={() => setHelpTask(null)}
        />
      )}

      {deletedTaskInfo && (
        <UndoToast
          message="Task removed"
          onUndo={handleUndo}
          onDone={handleUndoDone}
        />
      )}

      {errorToast && (
        <ErrorToast
          message={errorToast}
          raised={!!deletedTaskInfo}
          onDone={() => setErrorToast(null)}
        />
      )}
    </div>
  )
}
