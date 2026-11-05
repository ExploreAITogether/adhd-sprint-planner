import { useState, useEffect, useCallback, useRef } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTheme } from '../hooks/useTheme'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getSettings, updateSettings } from '../lib/database'
import { GEMINI_KEY_URL } from '../lib/geminiConfig'
import type { Settings } from '../types'
import ModalShell from './ModalShell'
import { CheckIcon, EyeIcon, EyeOffIcon, MonitorIcon, MoonIcon, SunIcon } from './icons'

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

  const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <SunIcon size={15} /> },
    { value: 'dark', label: 'Dark', icon: <MoonIcon size={15} /> },
    { value: 'system', label: 'System', icon: <MonitorIcon size={15} /> },
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
    <ModalShell
      modalRef={modalRef}
      isClosing={isClosing}
      onClose={handleClose}
      labelledBy="settings-title"
      widthClass="max-w-[440px]"
    >
      <div className="px-7 pt-7 pb-6">
        <h2 id="settings-title" className="font-display text-[22px] font-medium mb-6">
          Settings
        </h2>

        <div className="flex flex-col gap-5">
          {/* Gemini API key (bring-your-own-key) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <label htmlFor="gemini-api-key" className="text-[15px] font-medium block">
                  Gemini API key
                </label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                  {keyStatus}
                </p>
              </div>
              {savedField === 'apiKey' && <SavedIndicator />}
            </div>
            <div className="flex items-stretch gap-2.5">
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
                  className="field w-full h-11 rounded-xl pl-3 pr-11 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="icon-btn absolute top-0 right-0 !w-11 !h-11"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  aria-pressed={showApiKey}
                  title={showApiKey ? 'Hide' : 'Show'}
                >
                  {showApiKey ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={!apiKeyDirty}
                className="btn btn-primary shrink-0 text-sm px-4 h-11 !rounded-xl"
              >
                Save
              </button>
            </div>
            {apiKeyError && (
              <p className="text-xs mt-2" role="alert" style={{ color: 'var(--t-red-text)' }}>
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

          <div className="divider" />

          {/* Sound toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="sound-label" className="text-[15px] font-medium">
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
                className="relative w-11 h-[26px] rounded-full transition-colors duration-200 shrink-0"
                style={{
                  backgroundImage: soundEnabled ? 'linear-gradient(135deg, var(--t-accent), var(--t-accent-end))' : 'none',
                  backgroundColor: soundEnabled ? 'transparent' : 'var(--t-border)',
                }}
                role="switch"
                aria-checked={soundEnabled}
                aria-labelledby="sound-label"
              >
                <span
                  className="absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{
                    transform: soundEnabled ? 'translateX(18px)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </div>
          </div>

          <div className="divider" />

          {/* Theme */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[15px] font-medium">Appearance</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                  Choose your preferred theme
                </p>
              </div>
              {savedField === 'theme' && <SavedIndicator />}
            </div>
            <div className="segmented" role="group" aria-label="Theme">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                  aria-pressed={theme === opt.value}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Export path */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[15px] font-medium">Default export location</p>
              {savedField === 'export' && <SavedIndicator />}
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="text-xs flex-1 min-w-0 truncate px-3 h-9 flex items-center rounded-xl font-mono"
                style={{
                  backgroundColor: 'var(--t-code-bg)',
                  color: exportPath ? 'var(--t-text-light)' : 'var(--t-text-faint)',
                }}
                title={exportPath || 'Not set'}
              >
                {displayPath}
              </span>
              <button onClick={handleChangeExportPath} className="btn btn-secondary shrink-0 text-sm px-4 h-9 !rounded-xl">
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Footer: app info */}
        <p className="mt-7 pt-5 text-center text-xs" style={{ color: 'var(--t-text-faint)', borderTop: '1px solid var(--t-border-light)' }}>
          ADHD Sprint Planner v1.1
        </p>
      </div>
    </ModalShell>
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
      role="status"
    >
      <CheckIcon size={12} />
      Saved
    </span>
  )
}
