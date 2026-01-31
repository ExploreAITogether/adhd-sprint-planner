import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '../types'
import { generateHelpPrompt } from '../lib/promptGenerator'
import { updateTaskPrompt } from '../lib/database'

interface HelpPromptModalProps {
  task: Task
  onClose: () => void
}

type ModalState = 'loading' | 'cached-choice' | 'success' | 'error'

export default function HelpPromptModal({ task, onClose }: HelpPromptModalProps) {
  const [state, setState] = useState<ModalState>(
    task.generated_prompt ? 'cached-choice' : 'loading'
  )
  const [prompt, setPrompt] = useState(task.generated_prompt ?? '')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const isCompleted = task.status === 'completed'

  // Generate prompt on mount if no cached prompt
  useEffect(() => {
    if (task.generated_prompt) return

    let cancelled = false

    async function generate() {
      try {
        const result = await generateHelpPrompt(task)
        if (cancelled) return
        setPrompt(result)
        setState('success')

        // Cache in database (fire-and-forget)
        updateTaskPrompt(task.id, result).catch((err) =>
          console.error('Failed to cache prompt:', err)
        )
      } catch {
        if (cancelled) return
        setError('Something went wrong generating the prompt.')
        setState('error')
      }
    }

    generate()
    return () => { cancelled = true }
  }, [task])

  // Handle generating a new prompt (from cached-choice or regenerate)
  const handleGenerate = useCallback(async () => {
    setState('loading')
    setError('')

    try {
      const result = await generateHelpPrompt(task)
      setPrompt(result)
      setState('success')

      // Update cache
      updateTaskPrompt(task.id, result).catch((err) =>
        console.error('Failed to cache prompt:', err)
      )
    } catch {
      setError('Something went wrong generating the prompt.')
      setState('error')
    }
  }, [task])

  // Show cached prompt
  const handleShowCached = useCallback(() => {
    setState('success')
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text
      textAreaRef.current?.select()
    }
  }, [prompt])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  // Close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(onClose, 150)
  }, [onClose])

  // Keyboard handlers
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }

      // Enter or Cmd/Ctrl+C copies when prompt is visible
      if (state === 'success' && prompt) {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleCopy()
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !window.getSelection()?.toString()) {
          e.preventDefault()
          handleCopy()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose, handleCopy, state, prompt])

  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose()
    }
  }, [handleClose])

  // Auto-resize text area
  useEffect(() => {
    if (textAreaRef.current && state === 'success') {
      const ta = textAreaRef.current
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`
    }
  }, [prompt, state])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6
        ${isClosing ? 'animate-[modal-fade-out_150ms_ease-in_forwards]' : 'animate-[modal-fade-in_200ms_ease-out]'}`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)]
          w-full max-w-[500px] overflow-hidden
          ${isClosing ? 'animate-[modal-scale-out_150ms_ease-in_forwards]' : 'animate-[modal-scale-in_200ms_ease-out]'}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
            rounded-full text-calm-text-light/60 hover:text-calm-text-light hover:bg-calm-border/30
            transition-colors duration-150 z-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13" />
            <line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>

        <div className="px-7 pt-7 pb-6">
          {/* Header */}
          <h2 className="text-lg font-medium text-calm-text pr-8">
            {isCompleted
              ? 'Need help with something similar?'
              : "Here's a prompt to help with this:"}
          </h2>

          {/* Task reminder */}
          <p className="text-sm text-calm-text-light/70 mt-1.5 flex items-center gap-1.5">
            <span className="text-base leading-none">{task.emoji}</span>
            <span className="truncate">{task.title}</span>
          </p>

          {/* Content area */}
          <div className="mt-5">
            {/* Loading state */}
            {state === 'loading' && (
              <div className="flex items-center justify-center py-10">
                <div className="flex items-center gap-2 text-calm-text-light">
                  <span className="text-sm">Crafting a prompt</span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-calm-text-light/50"
                        style={{ animation: `dots-bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {/* Cached choice state */}
            {state === 'cached-choice' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-calm-text-light">
                  You have a saved prompt for this task. What would you like to do?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleShowCached}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
                      py-2.5 px-4 text-sm font-medium text-white
                      hover:from-[#8FC0DE] hover:to-[#7BB2D3]
                      active:scale-[0.98] transition-all duration-200"
                  >
                    Show saved prompt
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex-1 rounded-xl border border-calm-border/80 bg-white
                      py-2.5 px-4 text-sm font-medium text-calm-text-light
                      hover:bg-calm-border/10 hover:text-calm-text
                      active:scale-[0.98] transition-all duration-200"
                  >
                    Generate new
                  </button>
                </div>
              </div>
            )}

            {/* Success state */}
            {state === 'success' && (
              <>
                <textarea
                  ref={textAreaRef}
                  readOnly
                  value={prompt}
                  className="w-full bg-[#F5F5F5] border border-calm-border/40 rounded-xl
                    px-4 py-3.5 text-[13px] leading-relaxed text-calm-text
                    font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace]
                    resize-none focus:outline-none focus:ring-2 focus:ring-calm-focus/30
                    selection:bg-calm-focus/20"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />

                {/* Usage hint */}
                <p className="text-xs text-calm-text-light/50 mt-2.5 text-center">
                  Paste this into Claude, ChatGPT, or any AI assistant
                </p>

                {/* Action buttons */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCopy}
                    className={`flex-1 rounded-xl py-2.5 px-4 text-sm font-medium
                      transition-all duration-200 active:scale-[0.98]
                      ${copied
                        ? 'bg-[#7BC67E] text-white'
                        : 'bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9] text-white hover:from-[#8FC0DE] hover:to-[#7BB2D3]'
                      }`}
                  >
                    {copied ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      'Copy to clipboard'
                    )}
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="rounded-xl border border-calm-border/80 bg-white
                      py-2.5 px-4 text-sm font-medium text-calm-text-light
                      hover:bg-calm-border/10 hover:text-calm-text
                      active:scale-[0.98] transition-all duration-200"
                    title="Generate a new prompt"
                  >
                    ↻
                  </button>
                </div>
              </>
            )}

            {/* Error state */}
            {state === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm text-calm-text-light text-center">{error}</p>
                {prompt && (
                  <>
                    <p className="text-xs text-calm-text-light/60">Here's a generic prompt instead:</p>
                    <textarea
                      ref={textAreaRef}
                      readOnly
                      value={prompt}
                      className="w-full bg-[#F5F5F5] border border-calm-border/40 rounded-xl
                        px-4 py-3.5 text-[13px] leading-relaxed text-calm-text
                        font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace]
                        resize-none focus:outline-none"
                      rows={3}
                    />
                  </>
                )}
                <button
                  onClick={handleGenerate}
                  className="rounded-xl bg-gradient-to-r from-[#7EB5D6] to-[#6BA5C9]
                    py-2.5 px-5 text-sm font-medium text-white
                    hover:from-[#8FC0DE] hover:to-[#7BB2D3]
                    active:scale-[0.98] transition-all duration-200"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
