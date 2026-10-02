import { useCallback, useEffect, useRef } from 'react'
import { AlertIcon, CheckIcon } from './icons'

type ToastTone = 'neutral' | 'success' | 'error'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastProps {
  message: string
  onDone: () => void
  tone?: ToastTone
  durationMs?: number
  action?: ToastAction
  /** Lift above another toast that occupies the default slot. */
  raised?: boolean
  /** Hovering pauses the countdown — used when the toast offers an action. */
  pauseOnHover?: boolean
}

const DEFAULT_DURATION_MS = 4000

export default function Toast({
  message,
  onDone,
  tone = 'neutral',
  durationMs = DEFAULT_DURATION_MS,
  action,
  raised = false,
  pauseOnHover = false,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const startTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onDone, durationMs)
  }, [onDone, durationMs])

  useEffect(() => {
    startTimer()
    return () => clearTimeout(timerRef.current)
  }, [startTimer])

  return (
    <div
      className="toast"
      style={{ bottom: raised ? '5.5rem' : '1.5rem' }}
      role={tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={pauseOnHover ? () => clearTimeout(timerRef.current) : undefined}
      onMouseLeave={pauseOnHover ? startTimer : undefined}
    >
      {tone === 'error' && (
        <span className="shrink-0" style={{ color: 'var(--t-red)' }}>
          <AlertIcon size={16} />
        </span>
      )}
      {tone === 'success' && (
        <span className="shrink-0" style={{ color: 'var(--t-green)' }}>
          <CheckIcon size={16} />
        </span>
      )}
      <span className={action ? '' : 'pr-2'}>{message}</span>
      {action && (
        <button onClick={action.onClick} className="btn btn-soft text-sm font-semibold px-3 py-1.5 rounded-xl">
          {action.label}
        </button>
      )}
    </div>
  )
}
