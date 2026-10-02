import { useState, useRef, useCallback, useEffect } from 'react'
import { useSpeechRecognition, type SpeechError } from '../hooks/useSpeechRecognition'
import type { WeekDay, DayTheme } from '../types'
import WeeklyStrip from './WeeklyStrip'
import TodayThemeChip from './TodayThemeChip'
import { HistoryIcon, MicIcon, SettingsIcon, SparklesIcon, Spinner, StopIcon, CloseIcon, AlertIcon } from './icons'

interface LandingScreenProps {
  onSubmit: (input: string) => void
  isLoading?: boolean
  error?: string | null
  onDismissError?: () => void
  onOpenSettings?: () => void
  onViewHistory?: () => void
  /** Draft text to restore when returning to this screen (e.g. from History). */
  initialInput?: string
  onInputChange?: (input: string) => void
  weekDays?: WeekDay[]
  onDayClick?: (dayOfWeek: number) => void
  todayTheme?: DayTheme | null
}

const MAX_INPUT_LENGTH = 5000

// Shown in sequence while the AI parses, so a slow response (up to 30s)
// doesn't feel frozen. The last message holds until parsing finishes.
const LOADING_MESSAGES = [
  'Thinking...',
  'Sorting your thoughts...',
  'Finding the tasks in there...',
  'Almost there...',
]
const LOADING_MESSAGE_INTERVAL_MS = 5000

function voiceErrorMessage(error: SpeechError): string {
  switch (error) {
    case 'permission-denied':
      return 'Microphone access needed for voice input. Enable in system settings.'
    case 'no-speech':
      return "I didn't hear anything. Try again?"
    case 'network':
      return "You're offline. Voice recognition needs a network connection."
    case 'not-supported':
      return 'Voice input is not supported in this browser.'
    default:
      return 'Something went wrong with voice input. Try again?'
  }
}

export default function LandingScreen({ onSubmit, isLoading, error, onDismissError, onOpenSettings, onViewHistory, initialInput = '', onInputChange, weekDays, onDayClick, todayTheme }: LandingScreenProps) {
  const [input, setInput] = useState(initialInput)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  // Text already in the textarea when recording starts; dictation appends to it.
  const voiceBaseRef = useRef('')

  // Detect OS for keyboard shortcut hint
  useEffect(() => {
    setIsMac(navigator.userAgent.indexOf('Mac') !== -1)
  }, [])

  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition()

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  // Sync speech transcript into the textarea, appended after any typed text
  useEffect(() => {
    if (transcript || interimTranscript) {
      const combined = `${voiceBaseRef.current}${transcript}${interimTranscript}`
      setInput(combined.slice(0, MAX_INPUT_LENGTH))
    }
  }, [transcript, interimTranscript])

  // Report the draft upward so it survives navigating away and back
  useEffect(() => {
    onInputChange?.(input)
  }, [input, onInputChange])

  // Walk through the loading messages while the AI is parsing
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(
      () => setLoadingMsgIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)),
      LOADING_MESSAGE_INTERVAL_MS
    )
    return () => clearInterval(interval)
  }, [isLoading])

  // Show speech errors as voice error messages
  useEffect(() => {
    if (speechError && speechError !== 'not-supported') {
      setVoiceError(voiceErrorMessage(speechError))
    }
  }, [speechError])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (trimmed.length === 0 || isLoading) return
    if (isListening) stopListening()
    setLoadingMsgIndex(0)
    onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Support both Cmd+Enter (Mac) and Ctrl+Enter (Windows/Linux)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_INPUT_LENGTH) {
      setInput(value)
    }
  }

  const handleVoiceToggle = () => {
    setVoiceError(null)
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      // Preserve anything already typed — dictation appends after it
      voiceBaseRef.current = input.trim() ? `${input.trim()} ` : ''
      startListening()
    }
  }

  const handleClear = () => {
    setInput('')
    resetTranscript()
    voiceBaseRef.current = ''
    setVoiceError(null)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const isEmpty = input.trim().length === 0
  const displayError = error || voiceError
  const dismissError = () => {
    if (voiceError) setVoiceError(null)
    if (error && onDismissError) onDismissError()
  }

  return (
    <div className="app-bg flex items-center justify-center p-5 sm:p-6">
      <div className="w-full max-w-xl">
        {/* Weekly day strip above the card */}
        {weekDays && weekDays.length > 0 && onDayClick && (
          <WeeklyStrip weekDays={weekDays} onDayClick={onDayClick} />
        )}

        {/* Main card */}
        <div className="glass-card px-6 py-8 sm:px-10 sm:py-10 relative">
          {/* Top-right toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-0.5">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                disabled={isLoading}
                className="icon-btn disabled:opacity-40 disabled:pointer-events-none"
                aria-label="View history"
                title="History"
              >
                <HistoryIcon />
              </button>
            )}
            {onOpenSettings && (
              <button onClick={onOpenSettings} className="icon-btn" aria-label="Settings" title="Settings">
                <SettingsIcon />
              </button>
            )}
          </div>

          {/* Today's theme + Heading */}
          <div className="text-center mb-7 px-8">
            {todayTheme && <TodayThemeChip theme={todayTheme} />}
            <h1 className="font-display text-[28px] sm:text-[32px] leading-tight font-medium">
              What do you need to get done?
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--t-text-light)' }}>
              Dump it all out. I'll turn it into a few small tasks.
            </p>
          </div>

          {/* Error message */}
          {displayError && (
            <div
              role="alert"
              className="mb-5 rounded-2xl pl-4 pr-2 py-2.5 flex items-start gap-3"
              style={{
                backgroundColor: 'var(--t-red-bg)',
                border: '1px solid var(--t-red-border)',
                animation: 'slide-up-fade 250ms ease-out',
              }}
            >
              <span className="shrink-0 mt-[3px]" style={{ color: 'var(--t-red)' }}>
                <AlertIcon size={16} />
              </span>
              <p className="text-sm leading-relaxed flex-1 py-0.5" style={{ color: 'var(--t-red-text)' }}>{displayError}</p>
              <button
                onClick={dismissError}
                className="icon-btn icon-btn-danger shrink-0 !w-7 !h-7"
                aria-label="Dismiss error"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              aria-label="Brain dump"
              placeholder={
                isListening
                  ? 'Listening... speak your thoughts'
                  : 'Just dump it all here... tasks, thoughts, whatever\'s on your mind.'
              }
              disabled={isLoading}
              rows={4}
              className={`field w-full min-h-[150px] max-h-[300px] resize-none rounded-2xl
                px-5 py-4 pr-11 text-base leading-relaxed
                disabled:opacity-60 disabled:cursor-not-allowed
                ${isListening ? 'field-recording' : ''}`}
            />

            {/* Clear button */}
            {!isEmpty && !isLoading && (
              <button
                onClick={handleClear}
                className="icon-btn absolute top-2.5 right-2.5 !w-7 !h-7"
                aria-label="Clear input"
                title="Clear"
              >
                <CloseIcon size={14} />
              </button>
            )}

            {/* Character count near limit */}
            {input.length > MAX_INPUT_LENGTH * 0.8 && (
              <span
                className="absolute bottom-3 right-4 text-[11px] font-mono tabular-nums"
                style={{ color: input.length > MAX_INPUT_LENGTH * 0.95 ? 'var(--t-red)' : 'var(--t-text-faint)' }}
              >
                {input.length}/{MAX_INPUT_LENGTH}
              </span>
            )}
          </div>

          {/* Action buttons row */}
          <div className="mt-5 flex items-center gap-3">
            {/* Voice button */}
            {voiceSupported && (
              <div className="relative shrink-0">
                {isListening && (
                  <span
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ backgroundColor: 'var(--t-red)', opacity: 0.3, animation: 'recording-ring 1.5s ease-out infinite' }}
                  />
                )}
                <button
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                  aria-label={isListening ? 'Stop recording' : 'Start voice recording'}
                  title={isListening ? 'Stop recording' : 'Dictate'}
                  className={`btn relative w-[52px] h-[52px] !rounded-2xl ${isListening ? '' : 'btn-secondary'}`}
                  style={isListening
                    ? {
                        backgroundColor: 'var(--t-red)',
                        color: '#FFFFFF',
                        boxShadow: '0 6px 18px -4px var(--t-red-border)',
                        animation: 'recording-pulse 1.5s ease-in-out infinite',
                      }
                    : undefined
                  }
                >
                  {isListening ? <StopIcon /> : <MicIcon size={20} />}
                </button>
              </div>
            )}

            {/* Make tasks button */}
            <button
              onClick={handleSubmit}
              disabled={isEmpty || isLoading}
              className="btn btn-primary flex-1 h-[52px] !rounded-2xl px-7 text-[15px]"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  <span aria-live="polite">{LOADING_MESSAGES[loadingMsgIndex]}</span>
                </>
              ) : (
                <>
                  <SparklesIcon size={17} />
                  Make tasks
                </>
              )}
            </button>
          </div>

          {/* Recording indicator */}
          {isListening && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm"
              style={{ color: 'var(--t-red)' }}
              role="status" aria-live="polite">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: 'currentColor', animation: `dots-bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                  />
                ))}
              </span>
              <span>Listening...</span>
            </div>
          )}

          {/* Keyboard hint */}
          <p className="text-center text-xs mt-5" style={{ color: 'var(--t-text-faint)' }}>
            <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
            {' + '}
            <kbd className="kbd">Enter</kbd>
            {' to submit'}
          </p>
        </div>
      </div>
    </div>
  )
}
