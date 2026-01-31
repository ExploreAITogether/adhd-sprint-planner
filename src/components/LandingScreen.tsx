import { useState, useRef, useCallback, useEffect } from 'react'
import { useSpeechRecognition, type SpeechError } from '../hooks/useSpeechRecognition'

interface LandingScreenProps {
  onSubmit: (input: string) => void
  isLoading?: boolean
  error?: string | null
  onDismissError?: () => void
}

const MAX_INPUT_LENGTH = 5000

function voiceErrorMessage(error: SpeechError): string {
  switch (error) {
    case 'permission-denied':
      return 'Microphone access was denied. Please allow microphone access in your browser or system settings and try again.'
    case 'no-speech':
      return "I didn't catch anything. Try again?"
    case 'network':
      return 'Voice recognition needs a network connection. Please check your internet and try again.'
    case 'not-supported':
      return 'Voice input is not supported in this browser.'
    default:
      return 'Something went wrong with voice input. Try again?'
  }
}

export default function LandingScreen({ onSubmit, isLoading, error, onDismissError }: LandingScreenProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

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

  // Sync speech transcript into the textarea
  useEffect(() => {
    if (transcript || interimTranscript) {
      const combined = transcript + (interimTranscript ? interimTranscript : '')
      setInput(combined)
    }
  }, [transcript, interimTranscript])

  // Show speech errors as voice error messages
  useEffect(() => {
    if (speechError && speechError !== 'not-supported') {
      setVoiceError(voiceErrorMessage(speechError))
    }
  }, [speechError])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (trimmed.length === 0 || isLoading) return
    onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
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
      // Clear previous transcript state before starting fresh
      resetTranscript()
      setInput('')
      startListening()
    }
  }

  const handleClear = () => {
    setInput('')
    resetTranscript()
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
    <div className="min-h-full bg-gradient-to-br from-calm-bg-start to-calm-bg-end flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Main card */}
        <div className="bg-calm-card rounded-3xl shadow-[0_4px_32px_rgba(0,0,0,0.06)] px-10 py-10">
          {/* Heading */}
          <h1 className="text-2xl font-medium text-calm-text text-center mb-8 leading-relaxed">
            What do you need to get done?
          </h1>

          {/* Error message */}
          {displayError && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200/60 px-5 py-3.5 flex items-start gap-3">
              <span className="text-red-400 shrink-0 mt-0.5">&#x26A0;&#xFE0F;</span>
              <p className="text-sm text-red-600/80 leading-relaxed flex-1">{displayError}</p>
              <button
                onClick={dismissError}
                className="shrink-0 text-red-300 hover:text-red-400 transition-colors"
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
              className={`w-full min-h-[150px] max-h-[300px] resize-none rounded-2xl border
                bg-white px-5 py-4 text-base text-calm-text placeholder-calm-text-light/60
                leading-relaxed
                focus:border-calm-focus focus:outline-none focus:ring-2 focus:ring-calm-focus/20
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isListening ? 'border-[#E57373]/40 ring-2 ring-[#E57373]/10' : 'border-calm-border'}`}
            />

            {/* Clear button — shown when there's text and not loading */}
            {!isEmpty && !isLoading && (
              <button
                onClick={handleClear}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
                  rounded-full text-calm-text-light/40 hover:text-calm-text-light hover:bg-calm-border/30
                  transition-all duration-150"
                aria-label="Clear input"
              >
                &#x2715;
              </button>
            )}

            {/* Character count near limit */}
            {input.length > MAX_INPUT_LENGTH * 0.8 && (
              <span className={`absolute bottom-3 right-3 text-[11px] font-mono
                ${input.length > MAX_INPUT_LENGTH * 0.95 ? 'text-red-400' : 'text-calm-text-light/40'}`}>
                {input.length}/{MAX_INPUT_LENGTH}
              </span>
            )}
          </div>

          {/* Action buttons row */}
          <div className="mt-6 flex items-center gap-3">
            {/* Voice button */}
            {voiceSupported && (
              <div className="relative">
                {/* Recording ring animation */}
                {isListening && (
                  <span
                    className="absolute inset-0 rounded-full bg-[#E57373]/30 pointer-events-none"
                    style={{ animation: 'recording-ring 1.5s ease-out infinite' }}
                  />
                )}
                <button
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                  aria-label={isListening ? 'Stop recording' : 'Start voice recording'}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center
                    transition-all duration-200 ease-out shrink-0
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${isListening
                      ? 'bg-[#E57373] text-white shadow-[0_2px_12px_rgba(229,115,115,0.4)] focus:ring-[#E57373]/40'
                      : 'bg-[#F0F0F0] text-calm-text hover:bg-[#E5E5E5] focus:ring-calm-focus/40'
                    }`}
                  style={isListening ? { animation: 'recording-pulse 1.5s ease-in-out infinite' } : undefined}
                >
                  {isListening ? (
                    /* Stop icon (square) when recording */
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    /* Microphone icon when idle */
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
              className="flex-1 rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
                py-3.5 px-7 text-base font-medium text-white
                shadow-[0_2px_12px_rgba(107,165,201,0.3)]
                hover:from-[#8FC0DE] hover:to-[#7BB2D3] hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(107,165,201,0.4)]
                active:scale-[0.99]
                focus:outline-none focus:ring-2 focus:ring-[#7EB5D6]/40 focus:ring-offset-2
                transition-all duration-200 ease-out
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_2px_12px_rgba(107,165,201,0.3)]"
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Thinking...
                </span>
              ) : (
                <span>&#x2728; Make tasks</span>
              )}
            </button>
          </div>

          {/* Recording indicator */}
          {isListening && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[#E57373]"
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
          <p className="text-center text-xs text-calm-text-light/50 mt-5">
            <kbd className="px-1.5 py-0.5 rounded bg-calm-border/40 text-[11px] font-mono">&#x2318;</kbd>
            {' + '}
            <kbd className="px-1.5 py-0.5 rounded bg-calm-border/40 text-[11px] font-mono">Enter</kbd>
            {' to submit'}
          </p>
        </div>
      </div>
    </div>
  )
}
