import { useEffect, useState, useCallback } from 'react'
import { initDatabase, createSprint, addTask, getActiveSprint } from './lib/database'
import { parseBrainDump } from './lib/gemini'
import LandingScreen from './components/LandingScreen'
import SprintView from './components/SprintView'
import type { Sprint } from './types'
import './App.css'

type AppView = 'landing' | 'sprint'

function App() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('landing')
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // --- Render ---

  if (dbError) {
    return (
      <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex items-center justify-center p-6">
        <div className="bg-calm-card rounded-3xl shadow-lg px-10 py-10 max-w-md text-center">
          <p className="text-red-500 text-sm">Something went wrong initializing the database.</p>
          <p className="text-calm-text-light text-xs mt-2">{dbError}</p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex items-center justify-center">
        <div className="text-calm-text-light text-sm animate-pulse">
          Loading...
        </div>
      </div>
    )
  }

  if (view === 'sprint' && activeSprint) {
    return <SprintView sprint={activeSprint} onBack={handleBack} />
  }

  return (
    <LandingScreen
      onSubmit={handleSubmit}
      isLoading={isLoading}
      error={error}
      onDismissError={() => setError(null)}
    />
  )
}

export default App
