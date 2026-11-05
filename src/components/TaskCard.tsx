import { useEffect, useRef, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { GripIcon, PencilIcon, TrashIcon, WandIcon } from './icons'

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
      style={style}
      data-completed={isCompleted}
      data-dragging={isDragging}
      className={`task-card w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left
        group relative
        ${isDragging ? 'z-10' : ''}
        ${isDeleting ? 'animate-[task-slide-out_300ms_ease-in_forwards]' : ''}
        ${justCompleted ? 'animate-[card-complete_400ms_ease-out]' : ''}`}
    >
      {/* Drag handle — sits in the gutter just outside the card */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-[18px] top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none
          opacity-0 group-hover:opacity-60 group-focus-within:opacity-60 hover:!opacity-100 transition-opacity duration-200
          flex items-center justify-center w-4 h-8 rounded
          task-action-touch"
        style={{ color: 'var(--t-text-faint)' }}
        title="Drag to reorder"
      >
        <GripIcon size={14} />
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        className="group/check shrink-0 relative w-7 h-7 rounded-full"
        aria-label={isCompleted ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
      >
        {justCompleted && (
          <span
            className="absolute inset-[-3px] rounded-full pointer-events-none"
            style={{ border: '2px solid var(--t-green)', animation: 'check-burst 450ms ease-out forwards' }}
          />
        )}

        <span
          className={`absolute inset-0 rounded-full flex items-center justify-center overflow-hidden
            transition-colors duration-200
            ${isCompleted ? '' : 'border-2 border-[var(--t-border)] group-hover/check:border-[var(--t-green)]'}`}
        >
          {isCompleted && (
            <span
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'var(--t-green)',
                ...(justCompleted ? { animation: 'check-fill 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' } : {}),
              }}
            />
          )}

          <svg
            className={`w-3.5 h-3.5 relative z-10 transition-opacity duration-150
              ${isCompleted ? 'text-white' : 'opacity-0 group-hover/check:opacity-70'}`}
            style={isCompleted ? undefined : { color: 'var(--t-green)' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline
              points="20 6 9 17 4 12"
              style={justCompleted
                ? { strokeDasharray: 24, animation: 'check-draw 250ms ease-out 150ms both' }
                : undefined
              }
            />
          </svg>
        </span>
      </button>

      {/* Emoji + Title (or edit input) */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span
          className="emoji-tile transition-opacity duration-300"
          style={isCompleted ? { opacity: 0.5 } : undefined}
          aria-hidden="true"
        >
          {task.emoji}
        </span>
        {isEditing ? (
          <input
            ref={editRef}
            defaultValue={task.title}
            onBlur={handleEditSave}
            onKeyDown={handleEditKeyDown}
            aria-label="Task title"
            className="field flex-1 min-w-0 text-[15px] leading-snug rounded-lg px-2.5 py-1.5"
            maxLength={120}
          />
        ) : (
          <span
            className="text-[15px] leading-snug transition-colors duration-300 py-1"
            style={{ color: isCompleted ? 'var(--t-text-faint)' : 'var(--t-text)' }}
          >
            <span className={isCompleted ? `strike ${justCompleted ? 'strike-animate' : ''}` : ''}>
              {task.title}
            </span>
          </span>
        )}
      </div>

      {/* Action buttons: edit, help, delete — float over the title end on hover */}
      {!isEditing && (
        <div className="task-actions task-action-touch">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStartEdit(task.id)
            }}
            className="icon-btn !w-8 !h-8"
            title="Edit task"
            aria-label="Edit task"
          >
            <PencilIcon size={15} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHelp(task)
            }}
            className="btn btn-soft text-xs h-8 w-8 sm:w-auto sm:px-2.5 !rounded-full !gap-1.5"
            title="Get an AI prompt to help with this task"
            aria-label="Help"
          >
            <WandIcon size={14} />
            <span className="hidden sm:inline" aria-hidden="true">Help</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="icon-btn icon-btn-danger !w-8 !h-8"
            title="Delete task"
            aria-label="Delete task"
          >
            <TrashIcon size={15} />
          </button>
        </div>
      )}
    </div>
  )
})

export default TaskCard
