import { useEffect, useState, useCallback } from 'react'
import { initDatabase, createSprintWithTasks, getActiveSprint, getSprintById, getWeekDays, setDayTheme, clearDayTheme } from './lib/database'
import { parseBrainDump } from './lib/gemini'
import { ThemeProvider } from './contexts/ThemeContext'
import LandingScreen from './components/LandingScreen'
import SprintView from './components/SprintView'
import HistoryView from './components/HistoryView'
import SettingsModal from './components/SettingsModal'
import ThemeEditorModal from './components/ThemeEditorModal'
import ErrorBoundary from './components/ErrorBoundary'
import Toast from './components/Toast'
import type { Sprint, Task, WeekDay } from './types'
import './App.css'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type AppView = 'landing' | 'sprint' | 'history'

function AppContent() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('landing')
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [weekDays, setWeekDays] = useState<WeekDay[]>([])
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<number | null>(null)
  const [appToast, setAppToast] = useState<string | null>(null)
  // Brain-dump draft lives here so it survives a detour to History
  const [landingDraft, setLandingDraft] = useState('')

  const clearAppToast = useCallback(() => setAppToast(null), [])

  const refreshWeekDays = useCallback(async () => {
    try {
      const days = await getWeekDays()
      setWeekDays(days)
    } catch (err) {
      console.error('Failed to load week days:', err)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        await initDatabase()
        setDbReady(true)

        // Check for an existing active sprint
        const existing = await getActiveSprint()
        if (existing && existing.tasks && existing.tasks.length > 0) {
          setActiveSprint(existing)
          setView('sprint')
        }

        // Load week data
        const days = await getWeekDays()
        setWeekDays(days)
      } catch (err) {
        setDbError(String(err))
      }
    }
    init()
  }, [])

  const handleSubmit = useCallback(async (rawInput: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Parse brain dump with AI
      const parsedTasks = await parseBrainDump(rawInput)

      if (parsedTasks.length === 0) {
        setError("Hmm, I couldn't find any tasks in there. Try being a bit more specific?")
        setIsLoading(false)
        return
      }

      // 2. Create sprint + tasks in the database as one near-atomic write
      const fullSprint: Sprint = await createSprintWithTasks(rawInput, parsedTasks)

      // 3. Update local state and switch view
      setActiveSprint(fullSprint)
      setLandingDraft('')
      setView('sprint')
    } catch (err) {
      console.error('Failed to process brain dump:', err)
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    setActiveSprint(null)
    setView('landing')
    setError(null)
  }, [])

  const handleViewHistory = useCallback(() => {
    setView('history')
  }, [])

  const handleTaskToggle = useCallback((taskId: string, newStatus: Task['status']) => {
    setActiveSprint((prev) => {
      if (!prev?.tasks) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null } : t
        ),
      }
    })
    // Refresh week strip so completed-task checkmark updates
    refreshWeekDays()
  }, [refreshWeekDays])

  const handleTaskEdit = useCallback((taskId: string, newTitle: string) => {
    setActiveSprint((prev) => {
      if (!prev?.tasks) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, title: newTitle } : t
        ),
      }
    })
  }, [])

  const handleTaskDelete = useCallback((taskId: string) => {
    setActiveSprint((prev) => {
      if (!prev?.tasks) return prev
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }
    })
  }, [])

  const handleTasksReorder = useCallback((reorderedTasks: Task[]) => {
    setActiveSprint((prev) => {
      if (!prev) return prev
      return { ...prev, tasks: reorderedTasks }
    })
  }, [])

  const handleTaskAdd = useCallback((task: Task) => {
    setActiveSprint((prev) => {
      if (!prev) return prev
      return { ...prev, tasks: [...(prev.tasks ?? []), task] }
    })
  }, [])

  const handleHistoryBack = useCallback(async () => {
    if (activeSprint) {
      try {
        const refreshed = await getSprintById(activeSprint.id)
        if (refreshed) {
          setActiveSprint(refreshed)
          setView('sprint')
        } else {
          // Sprint was deleted or no longer exists
          setActiveSprint(null)
          setView('landing')
        }
      } catch (err) {
        console.error('Failed to refresh sprint:', err)
        // Keep current sprint data and navigate back to sprint view
        setView('sprint')
      }
    } else {
      setView('landing')
    }
  }, [activeSprint])

  // ── Day theme handlers ──

  const handleDayClick = useCallback((dayOfWeek: number) => {
    setSelectedDayForEdit(dayOfWeek)
    setThemeEditorOpen(true)
  }, [])

  const handleThemeSave = useCallback(async (emoji: string, name: string) => {
    if (selectedDayForEdit === null) return
    try {
      await setDayTheme(selectedDayForEdit, name, emoji)
      await refreshWeekDays()
    } catch (err) {
      console.error('Failed to save day theme:', err)
      setAppToast('Failed to save day theme. Please try again.')
    }
    setThemeEditorOpen(false)
    setSelectedDayForEdit(null)
  }, [selectedDayForEdit, refreshWeekDays])

  const handleThemeClear = useCallback(async () => {
    if (selectedDayForEdit === null) return
    try {
      await clearDayTheme(selectedDayForEdit)
      await refreshWeekDays()
    } catch (err) {
      console.error('Failed to clear day theme:', err)
      setAppToast('Failed to clear day theme. Please try again.')
    }
    setThemeEditorOpen(false)
    setSelectedDayForEdit(null)
  }, [selectedDayForEdit, refreshWeekDays])

  const handleThemeEditorClose = useCallback(() => {
    setThemeEditorOpen(false)
    setSelectedDayForEdit(null)
  }, [])

  const selectedDayTheme = selectedDayForEdit !== null
    ? weekDays.find((d) => d.dayOfWeek === selectedDayForEdit)?.theme ?? null
    : null

  const todayTheme = weekDays.find((d) => d.isToday)?.theme ?? null

  // --- Render ---

  if (dbError) {
    return (
      <div className="app-bg flex items-center justify-center p-6">
        <div className="glass-card px-10 py-10 max-w-md text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--t-red-text)' }}>Something went wrong initializing the database.</p>
          <p className="text-xs mt-2 break-words" style={{ color: 'var(--t-text-light)' }}>{dbError}</p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="app-bg flex items-center justify-center" role="status" aria-label="Loading">
        <span
          className="w-3 h-3 rounded-full"
          style={{
            backgroundImage: 'linear-gradient(135deg, var(--t-accent), var(--t-accent-end))',
            animation: 'breathe 1.6s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  return (
    <>
      {view === 'history' ? (
        <HistoryView onBack={handleHistoryBack} onOpenSettings={() => setShowSettings(true)} />
      ) : view === 'sprint' && activeSprint ? (
        <SprintView
          sprint={activeSprint}
          onBack={handleBack}
          onViewHistory={handleViewHistory}
          onOpenSettings={() => setShowSettings(true)}
          onTaskToggle={handleTaskToggle}
          onTaskEdit={handleTaskEdit}
          onTaskDelete={handleTaskDelete}
          onTasksReorder={handleTasksReorder}
          onTaskAdd={handleTaskAdd}
          todayTheme={todayTheme}
          weekDays={weekDays}
          onDayClick={handleDayClick}
        />
      ) : (
        <LandingScreen
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          onDismissError={() => setError(null)}
          onOpenSettings={() => setShowSettings(true)}
          onViewHistory={handleViewHistory}
          initialInput={landingDraft}
          onInputChange={setLandingDraft}
          weekDays={weekDays}
          onDayClick={handleDayClick}
          todayTheme={todayTheme}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <ThemeEditorModal
        isOpen={themeEditorOpen}
        dayOfWeek={selectedDayForEdit ?? 1}
        dayName={selectedDayForEdit !== null ? DAY_NAMES[selectedDayForEdit - 1] : ''}
        currentTheme={selectedDayTheme}
        onSave={handleThemeSave}
        onClear={handleThemeClear}
        onClose={handleThemeEditorClose}
      />

      {appToast && <Toast tone="error" message={appToast} onDone={clearAppToast} />}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
