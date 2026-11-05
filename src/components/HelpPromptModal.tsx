import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '../types'
import { generateHelpPrompt } from '../lib/promptGenerator'
import { INVALID_API_KEY_MESSAGE } from '../lib/geminiConfig'
import { updateTaskPrompt } from '../lib/database'
import { useFocusTrap } from '../hooks/useFocusTrap'
import ModalShell from './ModalShell'
import { CheckIcon, CopyIcon, RefreshIcon, WandIcon } from './icons'

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

  useFocusTrap(modalRef, !isClosing)

  useEffect(() => {
    if (textAreaRef.current && state === 'success') {
      const ta = textAreaRef.current
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`
    }
  }, [prompt, state])

  return (
    <ModalShell
      modalRef={modalRef}
      isClosing={isClosing}
      onClose={handleClose}
      labelledBy="help-prompt-title"
      widthClass="max-w-[520px]"
    >
      <div className="px-7 pt-7 pb-6">
        <div className="flex items-center gap-3.5 pr-8">
          <span className="emoji-tile !w-11 !h-11 !rounded-2xl !text-xl" aria-hidden="true">
            {task.emoji}
          </span>
          <div className="min-w-0">
            <h2 id="help-prompt-title" className="font-display text-[20px] leading-tight font-medium">
              {isCompleted ? 'Need help with something similar?' : "Here's a prompt to get unstuck"}
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--t-text-light)' }}>
              {task.title}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {state === 'loading' && (
            <div className="flex items-center justify-center py-12" role="status">
              <div className="flex items-center gap-2.5" style={{ color: 'var(--t-text-light)' }}>
                <span style={{ color: 'var(--t-accent)' }}>
                  <WandIcon size={16} />
                </span>
                <span className="text-sm">Crafting a prompt</span>
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--t-accent)',
                        opacity: 0.6,
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
                aria-label="Generated prompt"
                className="field w-full rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed
                  font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace] resize-none"
                style={{ backgroundColor: 'var(--t-code-bg)' }}
                onClick={(e) => { if (e.target instanceof HTMLTextAreaElement) e.target.select() }}
              />

              <p className="text-xs mt-2.5 text-center" style={{ color: 'var(--t-text-faint)' }}>
                Paste this into Claude, ChatGPT, or any AI assistant
              </p>

              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={handleCopy}
                  className="btn btn-primary flex-1 h-11 text-sm"
                  style={copied ? { backgroundImage: 'none', backgroundColor: 'var(--t-green)' } : undefined}
                >
                  {copied ? (
                    <>
                      <CheckIcon size={15} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon size={15} />
                      Copy to clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerate}
                  className="btn btn-secondary h-11 w-11 shrink-0"
                  title="Generate a new prompt"
                  aria-label="Generate a new prompt"
                >
                  <RefreshIcon size={16} />
                </button>
              </div>
            </>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4" role="alert">
              <p className="text-sm text-center" style={{ color: 'var(--t-text-light)' }}>{error}</p>
              {prompt && (
                <>
                  <p className="text-xs" style={{ color: 'var(--t-text-faint)' }}>Here's a generic prompt instead:</p>
                  <textarea
                    ref={textAreaRef}
                    readOnly
                    value={prompt}
                    aria-label="Generic prompt"
                    className="field w-full rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed
                      font-[ui-monospace,_SFMono-Regular,_Menlo,_monospace] resize-none"
                    style={{ backgroundColor: 'var(--t-code-bg)' }}
                    rows={3}
                  />
                </>
              )}
              <button onClick={handleGenerate} className="btn btn-primary text-sm px-5 h-10">
                <RefreshIcon size={15} />
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
