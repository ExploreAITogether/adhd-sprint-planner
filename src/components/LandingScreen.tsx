import { useState, useRef, useCallback, useEffect } from 'react'
import { useSpeechRecognition, type SpeechError } from '../hooks/useSpeechRecognition'
import type { WeekDay, DayTheme } from '../types'
import { GEMINI_KEY_URL } from '../lib/geminiConfig'
import WeeklyStrip from './WeeklyStrip'

interface LandingScreenProps {
  onSubmit: (input: string) => void
  isLoading?: boolean
  error?: string | null
  onDismissError?: () => void
  onOpenSettings?: () => void
  /** True when no Gemini API key is saved yet; shows the first-run notice. */
  needsApiKey?: boolean
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

export default function LandingScreen({ onSubmit, isLoading, error, onDismissError, onOpenSettings, needsApiKey, weekDays, onDayClick, todayTheme }: LandingScreenProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // OS detection for the keyboard shortcut hint; never changes after mount.
  const [isMac] = useState(() => navigator.userAgent.indexOf('Mac') !== -1)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  // Text already in the textarea when recording starts; dictation appends to it.
  const voiceBaseRef = useRef('')

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

  // Walk through the loading messages while the AI is parsing
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(
      () => setLoadingMsgIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)),
      LOADING_MESSAGE_INTERVAL_MS
    )
    return () => clearInterval(interval)
  }, [isLoading])

  // Show speech errors as voice error messages. Adjusting state during render
  // (keyed on the previous hook value) avoids an extra effect-driven render and
  // still lets the user dismiss the message independently of the hook's error.
  const [lastSpeechError, setLastSpeechError] = useState(speechError)
  if (speechError !== lastSpeechError) {
    setLastSpeechError(speechError)
    if (speechError && speechError !== 'not-supported') {
      setVoiceError(voiceErrorMessage(speechError))
    }
  }

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
    <div
      className="min-h-full flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}
    >
      <div className="w-full max-w-xl">
        {/* Weekly day strip above the card */}
        {weekDays && weekDays.length > 0 && onDayClick && (
          <WeeklyStrip weekDays={weekDays} onDayClick={onDayClick} />
        )}

        {/* Main card */}
        <div
          className="rounded-3xl px-8 py-8 sm:px-10 sm:py-10 relative"
          style={{ backgroundColor: 'var(--t-card)', boxShadow: 'var(--t-shadow-card)', border: '1px solid var(--t-card-border)' }}
        >
          {/* Settings gear */}
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

          {/* Today's theme + Heading */}
          <div className="text-center mb-8">
            {todayTheme && (
              <p
                className="mb-2 flex items-center justify-center gap-1.5"
                style={{ color: 'var(--t-text-light)', animation: 'slide-up-fade 300ms ease-out' }}
              >
                <span className="text-[28px] leading-none">{todayTheme.emoji}</span>
                <span className="text-sm font-medium">{todayTheme.name}</span>
              </p>
            )}
            <h1
              className="text-2xl font-medium leading-relaxed"
              style={{ color: 'var(--t-text)' }}
            >
              What do you need to get done?
            </h1>
          </div>

          {/* First-run notice: no Gemini key saved yet */}
          {needsApiKey && (
            <div
              className="mb-5 rounded-xl px-5 py-4"
              role="status"
              style={{
                backgroundColor: 'var(--t-tag-bg)',
                border: '1px solid var(--t-accent-glow)',
                animation: 'slide-up-fade 300ms ease-out',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--t-text)' }}>
                One quick setup step
              </p>
              <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--t-text-light)' }}>
                Turning brain dumps into tasks uses Google Gemini, which needs a free API key.
                It takes about a minute and stays on this device.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-white
                      transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]
                      focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                      boxShadow: '0 2px 12px var(--t-accent-shadow)',
                    }}
                  >
                    Add key in Settings
                  </button>
                )}
                <a
                  href={GEMINI_KEY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center min-h-[44px] text-sm underline underline-offset-2"
                  style={{ color: 'var(--t-accent)' }}
                >
                  Get a free key
                </a>
              </div>
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div
              className="mb-5 rounded-xl px-5 py-3.5 flex items-start gap-3"
              style={{
                backgroundColor: 'var(--t-red-bg)',
                border: '1px solid var(--t-red-border)',
              }}
            >
              <span className="shrink-0 mt-0.5" style={{ color: 'var(--t-red)' }}>&#x26A0;&#xFE0F;</span>
              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--t-red-text)' }}>{displayError}</p>
              <button
                onClick={dismissError}
                className="shrink-0 transition-colors"
                style={{ color: 'var(--t-red)' }}
                aria-label="Dismiss error"
              >
                &#x2715;
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
              placeholder={
                isListening
                  ? 'Listening... speak your thoughts'
                  : 'Just dump it all here... tasks, thoughts, whatever\'s on your mind.'
              }
              disabled={isLoading}
              rows={4}
              className="w-full min-h-[150px] max-h-[300px] resize-none rounded-2xl
                px-5 py-4 text-base leading-relaxed
                focus:outline-none focus:ring-2
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--t-input-bg)',
                color: 'var(--t-text)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isListening ? 'var(--t-red)' : 'var(--t-border)',
                ...(isListening ? { boxShadow: '0 0 0 2px rgba(229,115,115,0.1)' } : {}),
              }}
              onFocus={(e) => {
                if (!isListening) {
                  e.currentTarget.style.borderColor = 'var(--t-focus)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168, 197, 218, 0.2)'
                }
              }}
              onBlur={(e) => {
                if (!isListening) {
                  e.currentTarget.style.borderColor = 'var(--t-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            />

            {/* Clear button */}
            {!isEmpty && !isLoading && (
              <button
                onClick={handleClear}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
                  rounded-full transition-all duration-150"
                style={{ color: 'var(--t-text-faint)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-light)'
                  e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--t-text-faint)'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                aria-label="Clear input"
              >
                &#x2715;
              </button>
            )}

            {/* Character count near limit */}
            {input.length > MAX_INPUT_LENGTH * 0.8 && (
              <span
                className="absolute bottom-3 right-3 text-[11px] font-mono"
                style={{ color: input.length > MAX_INPUT_LENGTH * 0.95 ? 'var(--t-red)' : 'var(--t-text-faint)' }}
              >
                {input.length}/{MAX_INPUT_LENGTH}
              </span>
            )}
          </div>

          {/* Action buttons row */}
          <div className="mt-6 flex items-center gap-3">
            {/* Voice button */}
            {voiceSupported && (
              <div className="relative">
                {isListening && (
                  <span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ backgroundColor: 'rgba(229,115,115,0.3)', animation: 'recording-ring 1.5s ease-out infinite' }}
                  />
                )}
                <button
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                  aria-label={isListening ? 'Stop recording' : 'Start voice recording'}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center
                    transition-all duration-200 ease-out shrink-0
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    disabled:opacity-40 disabled:cursor-not-allowed"
                  style={isListening
                    ? {
                        backgroundColor: 'var(--t-red)',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 12px rgba(229,115,115,0.4)',
                        animation: 'recording-pulse 1.5s ease-in-out infinite',
                      }
                    : {
                        backgroundColor: 'var(--t-neutral-btn-bg)',
                        color: 'var(--t-text)',
                      }
                  }
                >
                  {isListening ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="1" width="6" height="12" rx="3" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            {/* Make tasks button */}
            <button
              onClick={handleSubmit}
              disabled={isEmpty || isLoading}
              className="flex-1 rounded-xl py-3.5 px-7 text-base font-medium text-white
                hover:scale-[1.02] active:scale-[0.99]
                focus:outline-none focus:ring-2 focus:ring-offset-2
                transition-all duration-200 ease-out
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                boxShadow: `0 2px 12px var(--t-accent-shadow)`,
              }}
              onMouseEnter={(e) => {
                if (!isEmpty && !isLoading) {
                  e.currentTarget.style.background = 'linear-gradient(to right, var(--t-accent-hover), var(--t-accent-end-hover))'
                  e.currentTarget.style.boxShadow = '0 4px 16px var(--t-accent-shadow-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))'
                e.currentTarget.style.boxShadow = '0 2px 12px var(--t-accent-shadow)'
              }}
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {LOADING_MESSAGES[loadingMsgIndex]}
                </span>
              ) : (
                <span>&#x2728; Make tasks</span>
              )}
            </button>
          </div>

          {/* Recording indicator */}
          {isListening && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm"
              style={{ color: 'var(--t-red)' }}
              role="status" aria-live="polite">
              <span className="flex gap-0.5">
                <span style={{ animation: 'dots-bounce 1s ease-in-out infinite' }}>&#x25CF;</span>
                <span style={{ animation: 'dots-bounce 1s ease-in-out 0.15s infinite' }}>&#x25CF;</span>
                <span style={{ animation: 'dots-bounce 1s ease-in-out 0.3s infinite' }}>&#x25CF;</span>
              </span>
              <span>Listening...</span>
            </div>
          )}

          {/* Keyboard hint */}
          <p className="text-center text-xs mt-5" style={{ color: 'var(--t-text-faint)' }}>
            <kbd
              className="px-1.5 py-0.5 rounded text-[11px] font-mono"
              style={{ backgroundColor: 'var(--t-kbd-bg)' }}
            >
              {isMac ? '⌘' : 'Ctrl'}
            </kbd>
            {' + '}
            <kbd
              className="px-1.5 py-0.5 rounded text-[11px] font-mono"
              style={{ backgroundColor: 'var(--t-kbd-bg)' }}
            >
              Enter
            </kbd>
            {' to submit'}
          </p>
        </div>
      </div>
    </div>
  )
}
