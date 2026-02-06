import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import type { Sprint, Task } from '../types'
import { getSprintHistory } from '../lib/database'

interface HistoryViewProps {
  onBack: () => void
  onOpenSettings?: () => void
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
            className="rounded-sm px-0.5"
            style={{ backgroundColor: 'var(--t-tag-bg)', color: 'var(--t-text)' }}
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
        rounded-2xl px-6 py-3 text-sm font-medium"
      style={{
        backgroundColor: 'var(--t-toast-bg)',
        border: '1px solid var(--t-toast-border)',
        boxShadow: 'var(--t-toast-shadow)',
        color: 'var(--t-text)',
        animation: 'slide-up-fade 300ms ease-out',
      }}
    >
      {message}
    </div>
  )
}

// ── Main component ──

export default function HistoryView({ onBack, onOpenSettings }: HistoryViewProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadHistory = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    getSprintHistory()
      .then((history) => {
        setSprints(history)
      })
      .catch((err) => {
        console.error('Failed to load history:', err)
        setLoadError('Failed to load sprint history. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

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

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(`#${tag}`)
    searchRef.current?.focus()
  }, [])

  const handleExport = useCallback(async () => {
    try {
      const markdown = generateMarkdown(dateGroups, debouncedQuery)
      const defaultName = `task-history-${format(new Date(), 'yyyy-MM-dd')}.md`

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (!filePath) return

      await writeTextFile(filePath, markdown)
      setToast('History exported!')
    } catch (err) {
      console.error('Export failed:', err)
      setToast('Export failed. Please try again.')
    }
  }, [dateGroups, debouncedQuery])

  return (
    <div
      className="min-h-full flex justify-center p-6"
      style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}
    >
      <div className="w-full max-w-[700px]">
        <div
          className="rounded-3xl px-8 py-8 sm:px-10 sm:py-10 relative"
          style={{ backgroundColor: 'var(--t-card)', boxShadow: 'var(--t-shadow-card)', border: '1px solid var(--t-card-border)' }}
        >
          {/* Settings gear - top right */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150"
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

          {/* Top bar: back + title + export */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="text-sm font-medium flex items-center gap-1.5 transition-colors duration-200"
              style={{ color: 'var(--t-text-light)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--t-text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t-text-light)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            <h1 className="text-2xl font-medium" style={{ color: 'var(--t-text)' }}>
              What You've Done
            </h1>

            <button
              onClick={handleExport}
              disabled={totalCompletedTasks === 0}
              className="text-sm font-medium rounded-xl px-4 py-2
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200 flex items-center gap-1.5"
              style={{
                color: 'var(--t-text-light)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--t-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
                e.currentTarget.style.color = 'var(--t-text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--t-text-light)'
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          </div>

          {/* Search input */}
          <div className="relative mb-8">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t-text-faint)' }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                text-sm
                focus:outline-none focus:ring-2
                transition-all duration-200"
              style={{
                backgroundColor: 'var(--t-input-bg)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--t-border)',
                color: 'var(--t-text)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--t-focus)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168, 197, 218, 0.2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--t-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  searchRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2
                  w-5 h-5 rounded-full flex items-center justify-center
                  transition-colors duration-150"
                style={{ backgroundColor: 'var(--t-border-light)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--t-border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--t-border-light)' }}
              >
                <svg className="w-3 h-3" style={{ color: 'var(--t-text-light)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search tag indicator */}
          {isTagSearch && searchTerm && (
            <div className="mb-4 text-sm" style={{ color: 'var(--t-text-light)' }}>
              Showing tasks tagged:{' '}
              <span className="font-medium" style={{ color: 'var(--t-accent)' }}>#{searchTerm}</span>
            </div>
          )}

          {/* Content area */}
          <div
            className="overflow-y-auto pr-1"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            {loading && (
              <div className="text-center py-16">
                <div className="text-sm animate-pulse" style={{ color: 'var(--t-text-light)' }}>
                  Loading your history...
                </div>
              </div>
            )}

            {!loading && loadError && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">&#x26A0;&#xFE0F;</p>
                <p className="text-sm mb-4" style={{ color: 'var(--t-red, #e53e3e)' }}>
                  {loadError}
                </p>
                <button
                  onClick={loadHistory}
                  className="rounded-xl py-2.5 px-5 text-sm font-medium text-white
                    active:scale-[0.98] transition-all duration-200"
                  style={{
                    background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !loadError && sprints.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">&#x1F4CB;</p>
                <p className="text-sm" style={{ color: 'var(--t-text-light)' }}>
                  Nothing here yet. Complete your first sprint!
                </p>
              </div>
            )}

            {!loading && !loadError && sprints.length > 0 && dateGroups.length === 0 && debouncedQuery && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">&#x1F50D;</p>
                <p className="text-sm" style={{ color: 'var(--t-text-light)' }}>
                  No tasks found for &ldquo;{debouncedQuery}&rdquo;
                </p>
              </div>
            )}

            {!loading && !loadError &&
              dateGroups.map((group) => (
                <div
                  key={group.key}
                  className="mb-8 last:mb-2"
                  style={{ animation: 'history-fade-in 400ms ease-out both' }}
                >
                  <div className="mb-3">
                    <h2 className="text-base font-medium" style={{ color: 'var(--t-text)' }}>
                      {group.label}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-faint)' }}>
                      {group.completedTasks.length} task
                      {group.completedTasks.length !== 1 ? 's' : ''} completed
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {group.completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          backgroundColor: 'var(--t-card-inner)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'var(--t-border-light)',
                          boxShadow: 'var(--t-shadow-sm)',
                        }}
                      >
                        <div
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--t-green-bg)' }}
                        >
                          <svg className="w-3 h-3" style={{ color: 'var(--t-green)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>

                        <span className="text-sm leading-snug flex-1 min-w-0" style={{ color: 'var(--t-text-light)' }}>
                          <span className="mr-1.5">{task.emoji}</span>
                          <HighlightText
                            text={task.title}
                            query={isTagSearch ? '' : debouncedQuery}
                          />
                        </span>

                        {task.tags.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {task.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleTagClick(tag)}
                                className="text-[11px] leading-none px-2 py-1 rounded-full
                                  transition-colors duration-150"
                                style={{
                                  backgroundColor: 'var(--t-tag-bg)',
                                  color: 'var(--t-tag-text)',
                                }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {group.allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {group.allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className="text-xs px-2.5 py-1 rounded-full transition-colors duration-150"
                          style={{
                            backgroundColor: 'var(--t-border-light)',
                            color: 'var(--t-text-light)',
                          }}
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

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
