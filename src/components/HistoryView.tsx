import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import type { Sprint, Task } from '../types'
import { getSprintHistory } from '../lib/database'

interface HistoryViewProps {
  onBack: () => void
}

// ── Helpers ──

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d')
}

function dateKey(dateStr: string): string {
  return format(new Date(dateStr), 'yyyy-MM-dd')
}

interface DateGroup {
  label: string
  key: string
  sprints: Sprint[]
  completedTasks: Task[]
  allTags: string[]
}

function groupSprintsByDate(sprints: Sprint[]): DateGroup[] {
  const map = new Map<string, DateGroup>()

  for (const sprint of sprints) {
    const key = dateKey(sprint.created_at)
    if (!map.has(key)) {
      map.set(key, {
        label: formatDateGroup(sprint.created_at),
        key,
        sprints: [],
        completedTasks: [],
        allTags: [],
      })
    }
    const group = map.get(key)!
    group.sprints.push(sprint)
    const completed = sprint.tasks.filter((t) => t.status === 'completed')
    group.completedTasks.push(...completed)
    for (const task of completed) {
      for (const tag of task.tags) {
        if (!group.allTags.includes(tag)) {
          group.allTags.push(tag)
        }
      }
    }
  }

  return Array.from(map.values())
}

// ── Highlight matching text ──

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-calm-accent/15 text-calm-text rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ── Generate markdown export ──

function generateMarkdown(groups: DateGroup[], searchQuery: string): string {
  const lines: string[] = ['# Task History', '']

  if (searchQuery.trim()) {
    lines.push(`> Filtered by: "${searchQuery}"`, '')
  }

  for (const group of groups) {
    lines.push(`## ${group.label}`, '')
    for (const task of group.completedTasks) {
      lines.push(`- [x] ${task.emoji} ${task.title}`)
      if (task.tags.length > 0) {
        lines.push(`  - Tags: ${task.tags.join(', ')}`)
      }
    }
    lines.push('')
  }

  lines.push('---', '*Exported from ADHD Sprint Planner*', '')
  return lines.join('\n')
}

// ── Toast notification ──

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        bg-calm-card border border-calm-border/60
        shadow-[0_4px_24px_rgba(0,0,0,0.1)] rounded-2xl
        px-6 py-3 text-sm text-calm-text font-medium"
      style={{ animation: 'slide-up-fade 300ms ease-out' }}
    >
      {message}
    </div>
  )
}

// ── Main component ──

export default function HistoryView({ onBack }: HistoryViewProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load sprint history on mount
  useEffect(() => {
    getSprintHistory()
      .then((history) => {
        setSprints(history)
      })
      .catch((err) => {
        console.error('Failed to load history:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── Filter logic ──
  const isTagSearch = debouncedQuery.startsWith('#')
  const searchTerm = isTagSearch
    ? debouncedQuery.slice(1).toLowerCase()
    : debouncedQuery.toLowerCase()

  const filteredSprints = useMemo(() => {
    if (!searchTerm) return sprints

    return sprints
      .map((sprint) => ({
        ...sprint,
        tasks: sprint.tasks.filter((task) => {
          if (isTagSearch) {
            return task.tags.some((tag) => tag.toLowerCase() === searchTerm)
          }
          return (
            task.title.toLowerCase().includes(searchTerm) ||
            task.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
          )
        }),
      }))
      .filter((sprint) => sprint.tasks.length > 0)
  }, [sprints, searchTerm, isTagSearch])

  const dateGroups = useMemo(
    () => groupSprintsByDate(filteredSprints),
    [filteredSprints]
  )

  const totalCompletedTasks = dateGroups.reduce(
    (sum, g) => sum + g.completedTasks.length,
    0
  )

  // ── Tag click handler ──
  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(`#${tag}`)
    searchRef.current?.focus()
  }, [])

  // ── Export handler ──
  const handleExport = useCallback(async () => {
    try {
      const markdown = generateMarkdown(dateGroups, debouncedQuery)
      const defaultName = `task-history-${format(new Date(), 'yyyy-MM-dd')}.md`

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (!filePath) return // User cancelled

      await writeTextFile(filePath, markdown)
      setToast('History exported!')
    } catch (err) {
      console.error('Export failed:', err)
      setToast('Export failed. Please try again.')
    }
  }, [dateGroups, debouncedQuery])

  // ── Render ──

  return (
    <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex justify-center p-6">
      <div className="w-full max-w-[700px]">
        {/* Header card */}
        <div className="bg-calm-card rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] px-8 py-8 sm:px-10 sm:py-10">
          {/* Top bar: back + title + export */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="text-calm-text-light hover:text-calm-text transition-colors duration-200
                text-sm font-medium flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            <h1 className="text-2xl font-medium text-calm-text">
              What You've Done
            </h1>

            <button
              onClick={handleExport}
              disabled={totalCompletedTasks === 0}
              className="text-sm font-medium text-calm-text-light
                border border-calm-border/80 rounded-xl px-4 py-2
                hover:bg-calm-border/10 hover:text-calm-text
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200 flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          </div>

          {/* Search input */}
          <div className="relative mb-8">
            {/* Search icon */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-calm-text-light/50 pointer-events-none">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks or tags..."
              className="w-full h-11 pl-10 pr-10 rounded-xl
                bg-white border border-calm-border/60
                text-sm text-calm-text placeholder-calm-text-light/50
                focus:outline-none focus:ring-2 focus:ring-calm-focus/30 focus:border-calm-focus
                transition-all duration-200"
            />

            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  searchRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2
                  w-5 h-5 rounded-full bg-calm-border/40
                  flex items-center justify-center
                  hover:bg-calm-border/70 transition-colors duration-150"
              >
                <svg
                  className="w-3 h-3 text-calm-text-light"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search tag indicator */}
          {isTagSearch && searchTerm && (
            <div className="mb-4 text-sm text-calm-text-light">
              Showing tasks tagged:{' '}
              <span className="font-medium text-calm-accent">#{searchTerm}</span>
            </div>
          )}

          {/* Content area */}
          <div
            className="overflow-y-auto pr-1"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            {/* Loading state */}
            {loading && (
              <div className="text-center py-16">
                <div className="text-calm-text-light text-sm animate-pulse">
                  Loading your history...
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && sprints.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-calm-text-light text-sm">
                  Nothing here yet. Complete your first sprint!
                </p>
              </div>
            )}

            {/* No search results */}
            {!loading && sprints.length > 0 && dateGroups.length === 0 && debouncedQuery && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-calm-text-light text-sm">
                  No tasks found for &ldquo;{debouncedQuery}&rdquo;
                </p>
              </div>
            )}

            {/* Date groups */}
            {!loading &&
              dateGroups.map((group) => (
                <div
                  key={group.key}
                  className="mb-8 last:mb-2"
                  style={{ animation: 'history-fade-in 400ms ease-out both' }}
                >
                  {/* Date header */}
                  <div className="mb-3">
                    <h2 className="text-base font-medium text-calm-text">
                      {group.label}
                    </h2>
                    <p className="text-xs text-calm-text-light/60 mt-0.5">
                      {group.completedTasks.length} task
                      {group.completedTasks.length !== 1 ? 's' : ''} completed
                    </p>
                  </div>

                  {/* Task list */}
                  <div className="flex flex-col gap-2">
                    {group.completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-xl bg-white
                          px-4 py-3 border border-calm-border/30
                          shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
                      >
                        {/* Check icon */}
                        <div className="shrink-0 w-5 h-5 rounded-full bg-[#7BC67E]/20
                          flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-[#7BC67E]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>

                        {/* Emoji + title */}
                        <span className="text-sm leading-snug text-calm-text/70 flex-1 min-w-0">
                          <span className="mr-1.5">{task.emoji}</span>
                          <HighlightText
                            text={task.title}
                            query={isTagSearch ? '' : debouncedQuery}
                          />
                        </span>

                        {/* Inline tags */}
                        {task.tags.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {task.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleTagClick(tag)}
                                className="text-[11px] leading-none px-2 py-1 rounded-full
                                  bg-calm-accent/8 text-calm-accent/70
                                  hover:bg-calm-accent/15 hover:text-calm-accent
                                  transition-colors duration-150"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tag pills for the group */}
                  {group.allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {group.allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className="text-xs px-2.5 py-1 rounded-full
                            bg-calm-bg-start/50 text-calm-text-light
                            hover:bg-calm-accent/10 hover:text-calm-accent
                            transition-colors duration-150"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
