import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { DayTheme } from '../types'
import ModalShell from './ModalShell'

const EMOJI_SUGGESTIONS = ['📝', '🧠', '💼', '📬', '🏃', '🎨', '🌿']

interface ThemeEditorModalProps {
  isOpen: boolean
  dayOfWeek: number
  dayName: string
  currentTheme: DayTheme | null
  onSave: (emoji: string, name: string) => void
  onClear: () => void
  onClose: () => void
}

/**
 * Gate: renders nothing while closed. The content component below mounts
 * fresh on every open (keyed by day), so its form state starts from the
 * current theme without needing a reset effect.
 */
export default function ThemeEditorModal({ isOpen, dayOfWeek, ...rest }: ThemeEditorModalProps) {
  if (!isOpen) return null
  return <ThemeEditorModalContent key={dayOfWeek} dayOfWeek={dayOfWeek} {...rest} />
}

type ThemeEditorModalContentProps = Omit<ThemeEditorModalProps, 'isOpen'>

function ThemeEditorModalContent({
  dayName,
  currentTheme,
  onSave,
  onClear,
  onClose,
}: ThemeEditorModalContentProps) {
  const [emoji, setEmoji] = useState(currentTheme?.emoji ?? '')
  const [name, setName] = useState(currentTheme?.name ?? '')
  const [isClosing, setIsClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLInputElement>(null)

  // Focus emoji input after the open animation
  useEffect(() => {
    const timer = setTimeout(() => emojiRef.current?.focus(), 200)
    return () => clearTimeout(timer)
  }, [])

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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  useFocusTrap(modalRef, !isClosing)

  return (
    <ModalShell
      modalRef={modalRef}
      isClosing={isClosing}
      onClose={handleClose}
      labelledBy="theme-editor-title"
      widthClass="max-w-[400px]"
    >
      <div className="px-7 pt-7 pb-6">
        <div className="flex items-center gap-3.5 pr-8">
          <span className="emoji-tile !w-12 !h-12 !rounded-2xl !text-2xl" aria-hidden="true">
            {emoji.trim() || '\u{1F4C5}'}
          </span>
          <div className="min-w-0">
            <h2 id="theme-editor-title" className="font-display text-[22px] leading-tight font-medium">
              {dayName}
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--t-text-light)' }}>
              {name.trim() || (currentTheme ? 'Edit day theme' : 'Set a theme for this day')}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {/* Emoji input + quick picks */}
          <div>
            <label
              htmlFor="theme-emoji"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--t-text-light)' }}
            >
              Emoji
            </label>
            <div className="flex items-center gap-2">
              <input
                id="theme-emoji"
                ref={emojiRef}
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="📝"
                className="field w-14 h-11 shrink-0 rounded-xl text-center text-xl"
                maxLength={4}
              />
              <div className="flex flex-wrap gap-1" role="group" aria-label="Suggested emoji">
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    aria-label={`Use ${e}`}
                    aria-pressed={emoji === e}
                    className="w-8 h-8 rounded-lg text-lg leading-none flex items-center justify-center transition-colors duration-150
                      hover:bg-[var(--t-neutral-btn-bg)] aria-pressed:bg-[var(--t-accent-soft-strong)]"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
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
              className="field w-full h-11 rounded-xl px-4 text-sm"
              maxLength={50}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 mt-6">
          <button onClick={handleSave} disabled={!canSave} className="btn btn-primary flex-1 h-11 text-sm">
            Save
          </button>

          {currentTheme && (
            <button onClick={handleClear} className="btn btn-danger h-11 px-4 text-sm">
              Clear
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
