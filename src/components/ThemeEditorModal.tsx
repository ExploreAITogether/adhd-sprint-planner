import { useState, useEffect, useCallback, useRef } from 'react'
import type { DayTheme } from '../types'

interface ThemeEditorModalProps {
  isOpen: boolean
  dayOfWeek: number
  dayName: string
  currentTheme: DayTheme | null
  onSave: (emoji: string, name: string) => void
  onClear: () => void
  onClose: () => void
}

export default function ThemeEditorModal({
  isOpen,
  dayOfWeek,
  dayName,
  currentTheme,
  onSave,
  onClear,
  onClose,
}: ThemeEditorModalProps) {
  const [emoji, setEmoji] = useState('')
  const [name, setName] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens with new day
  useEffect(() => {
    if (isOpen) {
      setEmoji(currentTheme?.emoji ?? '')
      setName(currentTheme?.name ?? '')
      setIsClosing(false)
      // Focus emoji input after animation
      setTimeout(() => emojiRef.current?.focus(), 200)
    }
  }, [isOpen, dayOfWeek, currentTheme])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(onClose, 150)
  }, [onClose])

  const canSave = emoji.trim() !== '' && name.trim() !== ''

  const handleSave = useCallback(() => {
    if (!canSave) return
    onSave(emoji.trim(), name.trim())
  }, [emoji, name, canSave, onSave])

  const handleClear = useCallback(() => {
    onClear()
  }, [onClear])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || isClosing) return

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !modalRef.current) return

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, input, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen, isClosing])

  // Backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && e.target instanceof Node && !modalRef.current.contains(e.target)) {
      handleClose()
    }
  }, [handleClose])

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6
        ${isClosing ? 'animate-[modal-fade-out_150ms_ease-in_forwards]' : 'animate-[modal-fade-in_200ms_ease-out]'}`}
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--t-modal-backdrop)' }} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-editor-title"
        className={`relative rounded-2xl w-full max-w-[380px] overflow-hidden
          ${isClosing ? 'animate-[modal-scale-out_150ms_ease-in_forwards]' : 'animate-[modal-scale-in_200ms_ease-out]'}`}
        style={{
          backgroundColor: 'var(--t-modal-bg)',
          boxShadow: 'var(--t-shadow-modal)',
          border: '1px solid var(--t-modal-border)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
            rounded-full transition-colors duration-150 z-10"
          style={{ color: 'var(--t-text-faint)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--t-text-light)'
            e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--t-text-faint)'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13" />
            <line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>

        <div className="px-7 pt-7 pb-6">
          <h2 id="theme-editor-title" className="text-lg font-medium pr-8" style={{ color: 'var(--t-text)' }}>
            {dayName}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--t-text-light)' }}>
            {currentTheme ? 'Edit day theme' : 'Set a theme for this day'}
          </p>

          <div className="mt-5 flex flex-col gap-4">
            {/* Emoji input */}
            <div>
              <label
                htmlFor="theme-emoji"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--t-text-light)' }}
              >
                Emoji
              </label>
              <input
                id="theme-emoji"
                ref={emojiRef}
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="📝"
                className="w-20 rounded-xl px-3 py-2.5 text-center text-xl
                  focus:outline-none focus:ring-2 transition-shadow duration-200"
                style={{
                  backgroundColor: 'var(--t-input-bg)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--t-border)',
                  color: 'var(--t-text)',
                }}
                maxLength={4}
              />
            </div>

            {/* Name input */}
            <div>
              <label
                htmlFor="theme-name"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--t-text-light)' }}
              >
                Theme name
              </label>
              <input
                id="theme-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) {
                    e.preventDefault()
                    handleSave()
                  }
                }}
                placeholder="e.g. Work on blog"
                className="w-full rounded-xl px-4 py-2.5 text-sm
                  focus:outline-none focus:ring-2 transition-shadow duration-200"
                style={{
                  backgroundColor: 'var(--t-input-bg)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--t-border)',
                  color: 'var(--t-text)',
                }}
                maxLength={50}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-xl py-2.5 px-4 text-sm font-medium text-white
                active:scale-[0.98] transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: canSave
                  ? 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))'
                  : 'var(--t-accent)',
              }}
            >
              Save
            </button>

            {currentTheme && (
              <button
                onClick={handleClear}
                className="rounded-xl py-2.5 px-4 text-sm font-medium
                  active:scale-[0.98] transition-all duration-200"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--t-red-border)',
                  backgroundColor: 'var(--t-red-bg)',
                  color: 'var(--t-red-text)',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
