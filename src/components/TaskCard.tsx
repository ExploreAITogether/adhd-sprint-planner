import { useEffect, useRef, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'

interface TaskCardProps {
  task: Task
  onToggle: (taskId: string) => void
  onHelp: (task: Task) => void
  onEdit: (taskId: string, newTitle: string) => void
  onDelete: (taskId: string) => void
  justCompleted?: boolean
  isEditing?: boolean
  onStartEdit: (taskId: string) => void
  onCancelEdit: () => void
  isDeleting?: boolean
}

const TaskCard = memo(function TaskCard({
  task,
  onToggle,
  onHelp,
  onEdit,
  onDelete,
  justCompleted,
  isEditing,
  onStartEdit,
  onCancelEdit,
  isDeleting,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed'
  const editRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Focus + select the edit input once it has mounted.
  useEffect(() => {
    if (!isEditing) return
    const timer = setTimeout(() => {
      editRef.current?.focus()
      editRef.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [isEditing])

  const handleEditSave = () => {
    const trimmed = editRef.current?.value.trim() ?? ''
    if (trimmed && trimmed !== task.title) {
      onEdit(task.id, trimmed)
    }
    onCancelEdit()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelEdit()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'var(--t-card-inner)',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'var(--t-shadow-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: isDragging ? 'var(--t-accent)' : 'var(--t-card-inner-border)',
      }}
      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-4 sm:px-4 text-left
        group relative
        ${isDragging ? 'z-10 scale-[1.02]' : ''}
        ${isCompleted && !isDragging ? 'opacity-60' : ''}
        ${isDeleting ? 'animate-[task-slide-out_300ms_ease-in_forwards]' : ''}
        ${justCompleted
          ? 'animate-[card-complete_400ms_ease-out]'
          : 'transition-all duration-200 ease-out'
        }`}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = 'var(--t-shadow-sm-hover)'
          e.currentTarget.style.borderColor = 'var(--t-border)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = 'var(--t-shadow-sm)'
          e.currentTarget.style.borderColor = 'var(--t-card-inner-border)'
        }
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none
          opacity-0 group-hover:opacity-60 group-focus-within:opacity-60 hover:!opacity-100 transition-opacity duration-200
          flex items-center justify-center w-5 h-8 -ml-1 rounded
          task-action-touch"
        style={{ color: 'var(--t-text-faint)' }}
        title="Drag to reorder"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="2" r="1.5" />
          <circle cx="7" cy="2" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="7" cy="8" r="1.5" />
          <circle cx="3" cy="14" r="1.5" />
          <circle cx="7" cy="14" r="1.5" />
        </svg>
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        className="shrink-0 relative w-6 h-6 focus:outline-none"
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {justCompleted && (
          <div
            className="absolute inset-[-4px] rounded-full pointer-events-none"
            style={{ border: '2px solid var(--t-green)', animation: 'check-burst 400ms ease-out forwards' }}
          />
        )}

        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center relative overflow-hidden
            ${isCompleted ? '' : 'transition-colors duration-200'}`}
          style={isCompleted ? undefined : { border: '2px solid var(--t-border)' }}
        >
          {isCompleted && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'var(--t-green)',
                ...(justCompleted ? { animation: 'check-fill 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' } : {}),
              }}
            />
          )}

          {isCompleted && (
            <svg
              className="w-3.5 h-3.5 text-white relative z-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline
                points="20 6 9 17 4 12"
                style={justCompleted
                  ? { strokeDasharray: 24, animation: 'check-draw 250ms ease-out 150ms both' }
                  : undefined
                }
              />
            </svg>
          )}
        </div>
      </button>

      {/* Emoji + Title (or edit input) */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <span className="text-lg leading-none shrink-0">{task.emoji}</span>
        {isEditing ? (
          <input
            ref={editRef}
            defaultValue={task.title}
            onBlur={handleEditSave}
            onKeyDown={handleEditKeyDown}
            className="flex-1 text-[15px] leading-snug bg-transparent outline-none px-1 py-0.5 rounded"
            style={{
              color: 'var(--t-text)',
              borderBottom: '2px solid var(--t-accent)',
            }}
            maxLength={120}
          />
        ) : (
          <span className="relative inline-flex items-center">
            <span
              className="text-[15px] leading-snug transition-colors duration-300"
              style={{ color: isCompleted ? 'var(--t-text-faint)' : 'var(--t-text)' }}
            >
              {task.title}
            </span>
            {isCompleted && (
              <span
                className="absolute left-0 right-0 top-1/2 h-[1.5px] origin-left"
                style={{
                  backgroundColor: 'var(--t-text-faint)',
                  ...(justCompleted ? { animation: 'strikethrough 300ms ease-out 100ms both' } : {}),
                }}
              />
            )}
          </span>
        )}
      </div>

      {/* Action buttons: edit, help, delete */}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-1
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200
          task-action-touch">
          {/* Edit button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStartEdit(task.id)
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: 'var(--t-text-light)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
              e.currentTarget.style.color = 'var(--t-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--t-text-light)'
            }}
            title="Edit task"
            aria-label="Edit task"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>

          {/* Help button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHelp(task)
            }}
            className="inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5
              transition-colors duration-150"
            style={{
              color: 'var(--t-text-light)',
              backgroundColor: 'var(--t-border-light)',
            }}
          >
            <span className="text-sm">{'\u{1FA84}'}</span> Help
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: 'var(--t-text-faint)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--t-red-bg)'
              e.currentTarget.style.color = 'var(--t-red)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--t-text-faint)'
            }}
            title="Delete task"
            aria-label="Delete task"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
})

export default TaskCard
