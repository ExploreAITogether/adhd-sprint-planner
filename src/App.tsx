import { useEffect, useState, useCallback } from 'react'
import { initDatabase, createSprint, addTask, getActiveSprint, getSprintById } from './lib/database'
import { parseBrainDump } from './lib/gemini'
import { ThemeProvider } from './contexts/ThemeContext'
import LandingScreen from './components/LandingScreen'
import SprintView from './components/SprintView'
import HistoryView from './components/HistoryView'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import type { Sprint, Task } from './types'
import './App.css'

type AppView = 'landing' | 'sprint' | 'history'

function AppContent() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('landing')
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        await initDatabase()
        setDbReady(true)

        // Check for an existing active sprint
        const existing = await getActiveSprint()
        if (existing && existing.tasks.length > 0) {
          setActiveSprint(existing)
          setView('sprint')
        }
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

      // 2. Create sprint in database
      const sprint = await createSprint(rawInput)

      // 3. Add each task to the database
      const savedTasks = []
      for (const task of parsedTasks) {
        const saved = await addTask(sprint.id, task)
        savedTasks.push(saved)
      }

      // 4. Update local state and switch view
      const fullSprint: Sprint = { ...sprint, tasks: savedTasks }
      setActiveSprint(fullSprint)
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
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null } : t
        ),
      }
    })
  }, [])

  const handleHistoryBack = useCallback(async () => {
    if (activeSprint) {
      try {
        const refreshed = await getSprintById(activeSprint.id)
        if (refreshed) {
          setActiveSprint(refreshed)
        }
      } catch (err) {
        console.error('Failed to refresh sprint:', err)
      }
      setView('sprint')
    } else {
      setView('landing')
    }
  }, [activeSprint])

  // --- Render ---

  if (dbError) {
    return (
      <div className="min-h-full flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}>
        <div className="rounded-3xl px-10 py-10 max-w-md text-center"
          style={{ backgroundColor: 'var(--t-card)', boxShadow: 'var(--t-shadow-card)' }}>
          <p className="text-sm" style={{ color: 'var(--t-red)' }}>Something went wrong initializing the database.</p>
          <p className="text-xs mt-2" style={{ color: 'var(--t-text-light)' }}>{dbError}</p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="min-h-full flex items-center justify-center"
        style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}>
        <div className="text-sm animate-pulse" style={{ color: 'var(--t-text-light)' }}>
          Loading...
        </div>
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
        />
      ) : (
        <LandingScreen
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          onDismissError={() => setError(null)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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
