import { useState, useRef, useCallback, useEffect } from 'react'

interface LandingScreenProps {
  onSubmit: (input: string) => void
  isLoading?: boolean
  error?: string | null
  onDismissError?: () => void
}

export default function LandingScreen({ onSubmit, isLoading, error, onDismissError }: LandingScreenProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

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

  const isEmpty = input.trim().length === 0

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
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200/60 px-5 py-3.5 flex items-start gap-3">
              <span className="text-red-400 shrink-0 mt-0.5">&#x26A0;&#xFE0F;</span>
              <p className="text-sm text-red-600/80 leading-relaxed flex-1">{error}</p>
              {onDismissError && (
                <button
                  onClick={onDismissError}
                  className="shrink-0 text-red-300 hover:text-red-400 transition-colors"
                  aria-label="Dismiss error"
                >
                  &#x2715;
                </button>
              )}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Just dump it all here... tasks, thoughts, whatever's on your mind."
            disabled={isLoading}
            rows={4}
            className="w-full min-h-[150px] max-h-[300px] resize-none rounded-2xl border border-calm-border
              bg-white px-5 py-4 text-base text-calm-text placeholder-calm-text-light/60
              leading-relaxed
              focus:border-calm-focus focus:outline-none focus:ring-2 focus:ring-calm-focus/20
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Make tasks button */}
          <button
            onClick={handleSubmit}
            disabled={isEmpty || isLoading}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
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

          {/* Divider */}
          <div className="flex items-center gap-4 mt-5">
            <div className="flex-1 h-px bg-calm-border/60" />
            <span className="text-xs text-calm-text-light/40 font-medium">or</span>
            <div className="flex-1 h-px bg-calm-border/60" />
          </div>

          {/* Voice button placeholder */}
          <button
            disabled
            className="mt-4 mx-auto flex items-center justify-center gap-2
              rounded-xl border border-calm-border/80 bg-white
              py-3 px-6 text-sm text-calm-text-light/50
              cursor-not-allowed"
          >
            <span className="text-lg">&#x1F3A4;</span>
            <span>Voice input</span>
            <span className="text-[10px] font-medium bg-calm-border/40 text-calm-text-light/50 rounded-full px-2 py-0.5">
              Coming soon
            </span>
          </button>

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
