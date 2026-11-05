import { useState, useEffect, useCallback, useRef } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTheme } from '../contexts/ThemeContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getSettings, updateSettings } from '../lib/database'
import { GEMINI_KEY_URL } from '../lib/geminiConfig'
import type { Settings } from '../types'

interface SettingsModalProps {
  onClose: () => void
}

type ThemeOption = Settings['theme']

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [exportPath, setExportPath] = useState('')
  const [apiKey, setApiKey] = useState('')
  // The key as last persisted, so the Save button only lights up on real changes.
  const [savedApiKey, setSavedApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<string | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Load settings on mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        setSoundEnabled(s.sound_enabled)
        setExportPath(s.export_path)
        setApiKey(s.api_key ?? '')
        setSavedApiKey(s.api_key ?? '')
      })
      .catch(() => {})
  }, [])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const showSaved = useCallback((field: string) => {
    setSavedField(field)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedField(null), 1500)
  }, [])

  // Toggle sound
  const handleSoundToggle = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      updateSettings({ sound_enabled: next }).catch(() => {})
      showSaved('sound')
      return next
    })
  }, [showSaved])

  // Change theme
  const handleThemeChange = useCallback((newTheme: ThemeOption) => {
    setTheme(newTheme)
    showSaved('theme')
  }, [setTheme, showSaved])

  // Save Gemini API key (bring-your-own-key). Stored only in local SQLite.
  const apiKeyDirty = apiKey.trim() !== savedApiKey
  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim()
    if (trimmed === savedApiKey) return
    setApiKeyError(null)
    try {
      await updateSettings({ api_key: trimmed.length > 0 ? trimmed : null })
      setApiKey(trimmed)
      setSavedApiKey(trimmed)
      showSaved('apiKey')
    } catch {
      setApiKeyError("Couldn't save the key. Please try again.")
    }
  }, [apiKey, savedApiKey, showSaved])

  const handleApiKeyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveApiKey()
    }
  }, [handleSaveApiKey])

  // Change export path
  const handleChangeExportPath = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose export folder',
      })
      if (selected && typeof selected === 'string') {
        setExportPath(selected)
        updateSettings({ export_path: selected }).catch(() => {})
        showSaved('export')
      }
    } catch {
      // User cancelled
    }
  }, [showSaved])

  // Close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(onClose, 150)
  }, [onClose])

  // Keyboard: Escape to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  useFocusTrap(modalRef, !isClosing)

  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && e.target instanceof Node && !modalRef.current.contains(e.target)) {
      handleClose()
    }
  }, [handleClose])

  const themeOptions: { value: ThemeOption; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ]

  // Truncate long path for display
  const displayPath = exportPath
    ? exportPath.length > 40
      ? '...' + exportPath.slice(-37)
      : exportPath
    : 'Not set'

  const keyStatus = savedApiKey
    ? 'Key saved on this device'
    : 'No key yet. AI parsing and Help Me prompts need one.'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6
        ${isClosing ? 'animate-[modal-fade-out_150ms_ease-in_forwards]' : 'animate-[modal-fade-in_200ms_ease-out]'}`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--t-modal-backdrop)' }} />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative rounded-2xl w-full max-w-[440px] overflow-hidden
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

        <div className="px-7 pt-7 pb-7">
          {/* Title */}
          <h2 className="text-xl font-medium mb-6" style={{ color: 'var(--t-text)' }}>
            Settings
          </h2>

          {/* Settings list */}
          <div className="flex flex-col gap-6">
            {/* Gemini API key (bring-your-own-key) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label htmlFor="gemini-api-key" className="text-[15px] font-medium block" style={{ color: 'var(--t-text)' }}>
                    Gemini API key
                  </label>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                    {keyStatus}
                  </p>
                </div>
                {savedField === 'apiKey' && <SavedIndicator />}
              </div>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    id="gemini-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setApiKeyError(null)
                    }}
                    onKeyDown={handleApiKeyKeyDown}
                    placeholder="Paste your key here"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full min-h-[44px] rounded-xl pl-3 pr-11 text-sm font-mono
                      focus:outline-none focus:ring-2 transition-colors duration-200"
                    style={{
                      backgroundColor: 'var(--t-input-bg)',
                      color: 'var(--t-text)',
                      border: '1px solid var(--t-border)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute top-0 right-0 h-full min-w-[44px] flex items-center justify-center
                      rounded-r-xl transition-colors duration-150"
                    style={{ color: 'var(--t-text-faint)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--t-text-light)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t-text-faint)' }}
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    aria-pressed={showApiKey}
                    title={showApiKey ? 'Hide' : 'Show'}
                  >
                    {showApiKey ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyDirty}
                  className="shrink-0 min-h-[44px] text-sm font-medium px-4 rounded-xl border transition-all duration-200
                    disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: apiKeyDirty ? 'var(--t-accent)' : 'var(--t-border)',
                    color: apiKeyDirty ? 'var(--t-accent)' : 'var(--t-text-light)',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (apiKeyDirty) e.currentTarget.style.backgroundColor = 'var(--t-accent-glow-strong)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  Save
                </button>
              </div>
              {apiKeyError && (
                <p className="text-xs mt-2" role="alert" style={{ color: 'var(--t-red)' }}>
                  {apiKeyError}
                </p>
              )}
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--t-text-faint)' }}>
                Stored only on this device. Brain dumps are sent to Gemini under your key.
              </p>
              <a
                href={GEMINI_KEY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center min-h-[44px] text-xs font-medium underline underline-offset-2"
                style={{ color: 'var(--t-accent)' }}
              >
                Get a free key from Google AI Studio
              </a>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: 'var(--t-border-light)' }} />

            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium" style={{ color: 'var(--t-text)' }}>
                  Completion sounds
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                  Play a sound when you complete tasks
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savedField === 'sound' && <SavedIndicator />}
                <button
                  onClick={handleSoundToggle}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    backgroundColor: soundEnabled ? 'var(--t-accent)' : 'var(--t-border)',
                  }}
                  role="switch"
                  aria-checked={soundEnabled}
                  aria-label="Toggle completion sounds"
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: soundEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: 'var(--t-border-light)' }} />

            {/* Theme */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--t-text)' }}>
                    Appearance
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                    Choose your preferred theme
                  </p>
                </div>
                {savedField === 'theme' && <SavedIndicator />}
              </div>
              <div
                className="inline-flex rounded-xl p-1"
                style={{ backgroundColor: 'var(--t-border-light)' }}
              >
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleThemeChange(opt.value)}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      backgroundColor: theme === opt.value ? 'var(--t-card)' : 'transparent',
                      color: theme === opt.value ? 'var(--t-text)' : 'var(--t-text-light)',
                      boxShadow: theme === opt.value ? 'var(--t-shadow-sm)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: 'var(--t-border-light)' }} />

            {/* Export path */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--t-text)' }}>
                    Default export location
                  </p>
                </div>
                {savedField === 'export' && <SavedIndicator />}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs flex-1 min-w-0 truncate px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--t-code-bg)',
                    color: exportPath ? 'var(--t-text-light)' : 'var(--t-text-faint)',
                  }}
                  title={exportPath || 'Not set'}
                >
                  {displayPath}
                </span>
                <button
                  onClick={handleChangeExportPath}
                  className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl border transition-all duration-200"
                  style={{
                    borderColor: 'var(--t-border)',
                    color: 'var(--t-text-light)',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--t-border-light)'
                    e.currentTarget.style.color = 'var(--t-text)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--t-text-light)'
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          {/* Footer: app info */}
          <div className="mt-8 pt-5 text-center" style={{ borderTop: '1px solid var(--t-border-light)' }}>
            <p className="text-xs" style={{ color: 'var(--t-text-faint)' }}>
              ADHD Sprint Planner v1.1
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SavedIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{
        color: 'var(--t-green)',
        animation: 'saved-check 300ms ease-out',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved
    </span>
  )
}
