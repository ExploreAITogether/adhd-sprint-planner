import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '../types'
import { generateHelpPrompt } from '../lib/promptGenerator'
import { INVALID_API_KEY_MESSAGE } from '../lib/geminiConfig'
import { updateTaskPrompt } from '../lib/database'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface HelpPromptModalProps {
  task: Task
  onClose: () => void
}

type ModalState = 'loading' | 'success' | 'error'

/** Surface user-fixable problems (missing or rejected API key) verbatim; keep everything else generic. */
function promptErrorMessage(err: unknown): string {
  if (err instanceof Error && (err.name === 'MissingApiKeyError' || err.message === INVALID_API_KEY_MESSAGE)) {
    return err.message
  }
  return 'Something went wrong generating the prompt.'
}

export default function HelpPromptModal({ task, onClose }: HelpPromptModalProps) {
  // A cached prompt is shown immediately — one less decision for the user.
  // The regenerate button on the success view covers the "give me a new one" case.
  const [state, setState] = useState<ModalState>(
    task.generated_prompt ? 'success' : 'loading'
  )
  const [prompt, setPrompt] = useState(task.generated_prompt ?? '')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const isCompleted = task.status === 'completed'

  useEffect(() => {
    if (task.generated_prompt) return

    let cancelled = false

    async function generate() {
      try {
        const result = await generateHelpPrompt(task)
        if (cancelled) return
        setPrompt(result)
        setState('success')

        updateTaskPrompt(task.id, result).catch((err) =>
          console.error('Failed to cache prompt:', err)
        )
      } catch (err) {
        if (cancelled) return
        setError(promptErrorMessage(err))
        setState('error')
      }
    }

    generate()
    return () => { cancelled = true }
  }, [task])

  const handleGenerate = useCallback(async () => {
    setState('loading')
    setError('')

    try {
      const result = await generateHelpPrompt(task)
      setPrompt(result)
      setState('success')

      updateTaskPrompt(task.id, result).catch((err) =>
        console.error('Failed to cache prompt:', err)
      )
    } catch (err) {
      setError(promptErrorMessage(err))
      setState('error')
    }
  }, [task])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      textAreaRef.current?.select()
    }
  }, [prompt])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(onClose, 150)
  }, [onClose])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }

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

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && e.target instanceof Node && !modalRef.current.contains(e.target)) {
      handleClose()
    }
  }, [handleClose])

  useFocusTrap(modalRef, !isClosing)

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
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--t-modal-backdrop)' }} />

      <div
        ref={modalRef}
        className={`relative rounded-2xl w-full max-w-[500px] overflow-hidden
          ${isClosing ? 'animate-[modal-scale-out_150ms_ease-in_forwards]' : 'animate-[modal-scale-in_200ms_ease-out]'}`}
        style={{
          backgroundColor: 'var(--t-modal-bg)',
          boxShadow: 'var(--t-shadow-modal)',
          border: '1px solid var(--t-modal-border)',
        }}
      >
        <button
          onClick={handleClose}
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
          <h2 className="text-lg font-medium pr-8" style={{ color: 'var(--t-text)' }}>
            {isCompleted
              ? 'Need help with something similar?'
              : "Here's a prompt to help with this:"}
          </h2>

          <p className="text-sm mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--t-text-light)' }}>
            <span className="text-base leading-none">{task.emoji}</span>
            <span className="truncate">{task.title}</span>
          </p>

          <div className="mt-5">
            {state === 'loading' && (
              <div className="flex items-center justify-center py-10">
                <div className="flex items-center gap-2" style={{ color: 'var(--t-text-light)' }}>
                  <span className="text-sm">Crafting a prompt</span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--t-text-faint)',
                          animation: `dots-bounce 1s ease-in-out ${i * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {state === 'success' && (
              <>
                <textarea
                  ref={textAreaRef}
                  readOnly
                  value={prompt}
                  className="w-full rounded-xl px-4 py-3.5 text-[13px] leading-relaxed
                    font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace]
                    resize-none focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--t-code-bg)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--t-border-light)',
                    color: 'var(--t-text)',
                  }}
                  onClick={(e) => { if (e.target instanceof HTMLTextAreaElement) e.target.select() }}
                />

                <p className="text-xs mt-2.5 text-center" style={{ color: 'var(--t-text-faint)' }}>
                  Paste this into Claude, ChatGPT, or any AI assistant
                </p>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCopy}
                    className="flex-1 rounded-xl py-2.5 px-4 text-sm font-medium
                      transition-all duration-200 active:scale-[0.98] text-white"
                    style={{
                      background: copied
                        ? 'var(--t-green)'
                        : 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                    }}
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
                    className="rounded-xl py-2.5 px-4 text-sm font-medium
                      active:scale-[0.98] transition-all duration-200"
                    style={{
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'var(--t-border)',
                      backgroundColor: 'var(--t-card-inner)',
                      color: 'var(--t-text-light)',
                    }}
                    title="Generate a new prompt"
                  >
                    &#x21BB;
                  </button>
                </div>
              </>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm text-center" style={{ color: 'var(--t-text-light)' }}>{error}</p>
                {prompt && (
                  <>
                    <p className="text-xs" style={{ color: 'var(--t-text-faint)' }}>Here's a generic prompt instead:</p>
                    <textarea
                      ref={textAreaRef}
                      readOnly
                      value={prompt}
                      className="w-full rounded-xl px-4 py-3.5 text-[13px] leading-relaxed
                        font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace]
                        resize-none focus:outline-none"
                      style={{
                        backgroundColor: 'var(--t-code-bg)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'var(--t-border-light)',
                        color: 'var(--t-text)',
                      }}
                      rows={3}
                    />
                  </>
                )}
                <button
                  onClick={handleGenerate}
                  className="rounded-xl py-2.5 px-5 text-sm font-medium text-white
                    active:scale-[0.98] transition-all duration-200"
                  style={{
                    background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                  }}
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
