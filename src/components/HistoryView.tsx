import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import type { Sprint, Task } from '../types'
import { getSprintHistory, searchSprintHistory } from '../lib/database'
import Toast from './Toast'
import {
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  DownloadIcon,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from './icons'

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
      })
    }
    const group = map.get(key)
    if (!group) continue
    group.sprints.push(sprint)
    const completed = sprint.tasks.filter((t) => t.status === 'completed')
    group.completedTasks.push(...completed)
  }

  // Skip days with nothing completed — an empty "0 tasks completed" group
  // is just noise in a view about what you've done.
  return Array.from(map.values()).filter((group) => group.completedTasks.length > 0)
}

// ── Highlight matching text ──

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  // split() with a capturing group places matched text at odd indices, so the
  // index alone identifies matches. Re-testing with a `g` regex would be wrong:
  // its lastIndex persists between .test() calls, silently skipping matches.
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-sm px-0.5"
            style={{ backgroundColor: 'var(--t-accent-soft-strong)', color: 'var(--t-text)' }}
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

// ── Main component ──

const PAGE_SIZE = 50

export default function HistoryView({ onBack, onOpenSettings }: HistoryViewProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const searchRef = useRef<HTMLInputElement>(null)

  // Fetch the first page. State updates happen only in promise callbacks, so
  // this is safe to call directly from the mount effect.
  const fetchHistory = useCallback(() => {
    getSprintHistory(PAGE_SIZE, 0)
      .then(({ sprints: history, hasMore: more }) => {
        setSprints(history)
        setHasMore(more)
      })
      .catch((err) => {
        console.error('Failed to load history:', err)
        setLoadError('Failed to load sprint history. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [])

  // Retry path: reset to the loading state first, then fetch.
  const loadHistory = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    fetchHistory()
  }, [fetchHistory])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    getSprintHistory(PAGE_SIZE, sprints.length)
      .then(({ sprints: more, hasMore: stillMore }) => {
        setSprints((prev) => [...prev, ...more])
        setHasMore(stillMore)
      })
      .catch((err) => {
        console.error('Failed to load more history:', err)
        setToast({ message: 'Failed to load more. Please try again.', tone: 'error' })
      })
      .finally(() => setLoadingMore(false))
  }, [sprints.length])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const isTagSearch = debouncedQuery.startsWith('#')
  const searchTerm = isTagSearch
    ? debouncedQuery.slice(1).toLowerCase()
    : debouncedQuery.toLowerCase()

  // Search queries the whole database, not just the pages loaded so far —
  // otherwise older history is invisible until the user clicks "Load more".
  // Results are keyed by their query so stale responses are simply ignored.
  const [search, setSearch] = useState<{ term: string; tag: boolean; results: Sprint[] } | null>(null)

  useEffect(() => {
    if (!searchTerm) return

    let cancelled = false
    searchSprintHistory(searchTerm, isTagSearch)
      .then((results) => {
        if (!cancelled) setSearch({ term: searchTerm, tag: isTagSearch, results })
      })
      .catch((err) => {
        console.error('Failed to search history:', err)
        // The in-memory fallback below still covers loaded pages
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, isTagSearch])

  const searchResults =
    search && search.term === searchTerm && search.tag === isTagSearch
      ? search.results
      : null

  const filteredSprints = useMemo(() => {
    if (!searchTerm) return sprints
    if (searchResults) return searchResults

    // Fallback while the DB search is in flight (or failed): filter loaded pages
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
  }, [sprints, searchTerm, isTagSearch, searchResults])

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
      setToast({ message: 'History exported!', tone: 'success' })
    } catch (err) {
      console.error('Export failed:', err)
      setToast({ message: 'Export failed. Please try again.', tone: 'error' })
    }
  }, [dateGroups, debouncedQuery])

  return (
    <div className="app-bg flex justify-center p-5 sm:p-6">
      <div className="w-full max-w-[700px]">
        <div className="glass-card px-5 py-6 sm:px-9 sm:py-8">
          {/* Top bar: back · title · export + settings (in flow, so nothing overlaps) */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-6">
            <div>
              <button onClick={onBack} className="btn btn-ghost text-sm px-2.5 py-1.5 !rounded-xl -ml-2.5 !gap-1">
                <ChevronLeftIcon size={16} />
                Back
              </button>
            </div>

            <div className="text-center">
              <h1 className="font-display text-[26px] sm:text-[28px] leading-tight font-medium">
                What You've Done
              </h1>
              {!loading && !loadError && totalCompletedTasks > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-light)' }}>
                  {totalCompletedTasks} task{totalCompletedTasks !== 1 ? 's' : ''} completed
                  {debouncedQuery ? ' matching' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-1">
              <button
                onClick={handleExport}
                disabled={totalCompletedTasks === 0}
                className="btn btn-secondary text-[13px] px-3 h-9 !rounded-xl !gap-1.5"
                title="Export as Markdown"
              >
                <DownloadIcon size={15} />
                <span className="hidden sm:inline">Export</span>
              </button>
              {onOpenSettings && (
                <button onClick={onOpenSettings} className="icon-btn" aria-label="Settings" title="Settings">
                  <SettingsIcon />
                </button>
              )}
            </div>
          </div>

          {/* Search input */}
          <div className="relative mb-6">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t-text-faint)' }}>
              <SearchIcon size={16} />
            </div>

            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tasks or tags"
              placeholder="Search tasks, or #tag..."
              className="field w-full h-11 pl-11 pr-11 rounded-2xl text-sm"
            />

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  searchRef.current?.focus()
                }}
                className="icon-btn absolute right-2 top-1/2 -translate-y-1/2 !w-7 !h-7"
                aria-label="Clear search"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>

          {/* Search tag indicator */}
          {isTagSearch && searchTerm && (
            <div className="mb-4 text-sm flex items-center gap-2" style={{ color: 'var(--t-text-light)' }}>
              Showing tasks tagged
              <span className="chip !text-xs">#{searchTerm}</span>
            </div>
          )}

          {/* Content area */}
          <div
            className="overflow-y-auto -mx-1 px-1"
            style={{ maxHeight: 'calc(100vh - 260px)' }}
          >
            {loading && (
              <div className="flex justify-center py-16" role="status" aria-label="Loading your history">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, var(--t-accent), var(--t-accent-end))',
                    animation: 'breathe 1.6s ease-in-out infinite',
                  }}
                />
              </div>
            )}

            {!loading && loadError && (
              <EmptyState emoji={'\u{1F327}\u{FE0F}'} message={loadError} tone="error">
                <button onClick={loadHistory} className="btn btn-primary text-sm px-5 py-2.5 mt-4">
                  <RefreshIcon size={15} />
                  Retry
                </button>
              </EmptyState>
            )}

            {!loading && !loadError && sprints.length === 0 && (
              <EmptyState emoji={'\u{1F331}'} message="Nothing here yet. Finish your first task and it'll show up here." />
            )}

            {!loading && !loadError && sprints.length > 0 && dateGroups.length === 0 && debouncedQuery && (
              <EmptyState emoji={'\u{1F50D}'} message={`No tasks found for “${debouncedQuery}”`} />
            )}

            {!loading && !loadError &&
              dateGroups.map((group, groupIndex) => (
                <section
                  key={group.key}
                  className="mb-6 last:mb-2"
                  style={{ animation: `history-fade-in 400ms ease-out ${Math.min(groupIndex, 6) * 50}ms both` }}
                  aria-labelledby={`history-${group.key}`}
                >
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <h2 id={`history-${group.key}`} className="text-sm font-semibold">
                      {group.label}
                    </h2>
                    <span
                      className="text-[11px] font-semibold tabular-nums rounded-full px-2 py-0.5"
                      style={{ color: 'var(--t-green)', backgroundColor: 'var(--t-green-bg)' }}
                    >
                      {group.completedTasks.length} done
                    </span>
                  </div>

                  <ul className="surface rounded-2xl overflow-hidden">
                    {group.completedTasks.map((task, i) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 px-3.5 py-2.5"
                        style={i > 0 ? { borderTop: '1px solid var(--t-card-inner-border)' } : undefined}
                      >
                        <span
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--t-green-bg)', color: 'var(--t-green)' }}
                          aria-hidden="true"
                        >
                          <CheckIcon size={12} strokeWidth={3} />
                        </span>

                        <span className="text-base leading-none shrink-0" aria-hidden="true">{task.emoji}</span>

                        <span className="text-sm leading-snug flex-1 min-w-0">
                          <HighlightText
                            text={task.title}
                            query={isTagSearch ? '' : debouncedQuery}
                          />
                        </span>

                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1 shrink-0 max-w-[40%]">
                            {task.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleTagClick(tag)}
                                className="chip"
                                title={`Show tasks tagged #${tag}`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

            {/* Load more button */}
            {!loading && !loadError && hasMore && !debouncedQuery && (
              <div className="text-center py-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary text-sm px-6 py-2.5"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} durationMs={2500} onDone={clearToast} />}
    </div>
  )
}

function EmptyState({
  emoji,
  message,
  tone = 'neutral',
  children,
}: {
  emoji: string
  message: string
  tone?: 'neutral' | 'error'
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <span
        className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4"
        style={{ backgroundColor: 'var(--t-accent-soft)' }}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <p className="text-sm max-w-xs" style={{ color: tone === 'error' ? 'var(--t-red-text)' : 'var(--t-text-light)' }}>
        {message}
      </p>
      {children}
    </div>
  )
}
