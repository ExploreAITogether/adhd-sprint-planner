import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getSettings, updateSettings } from '../lib/database'
import { GEMINI_KEY_URL, GOOGLE_BILLING_URL, GOOGLE_BILLING_HELP_URL } from '../lib/geminiConfig'
import type { Settings } from '../types'
import ModalShell from './ModalShell'
import { CheckIcon, ChevronDownIcon, EyeIcon, EyeOffIcon, MonitorIcon, MoonIcon, SparklesIcon, SunIcon } from './icons'

interface SettingsModalProps {
  onClose: () => void
}

type ThemeOption = Settings['theme']

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [apiKey, setApiKey] = useState('')
  // The key as last persisted, so the Save button only lights up on real changes.
  const [savedApiKey, setSavedApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showFreeTierGuide, setShowFreeTierGuide] = useState(false)
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
      <div className="px-7 pt-7 pb-6 max-h-[calc(100dvh-40px)] overflow-y-auto">
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
            <div className="surface rounded-xl mt-1 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowFreeTierGuide((shown) => !shown)}
                aria-expanded={showFreeTierGuide}
                aria-controls="free-tier-guide"
                className="w-full min-h-[56px] px-3.5 py-2.5 flex items-center gap-3 text-left
                  transition-colors duration-150 hover:bg-[var(--t-neutral-btn-bg)]"
              >
                <span
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--t-accent-soft)', color: 'var(--t-accent)' }}
                  aria-hidden="true"
                >
                  <SparklesIcon size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">How to use Gemini’s free tier</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--t-text-light)' }}>
                    Step-by-step guide, no billing needed
                  </span>
                </span>
                <ChevronDownIcon
                  size={18}
                  className="shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--t-text-faint)',
                    transform: showFreeTierGuide ? 'rotate(180deg)' : 'none',
                  }}
                />
              </button>
              {showFreeTierGuide && (
                <div
                  id="free-tier-guide"
                  className="px-3.5 pt-3 pb-3 text-xs leading-relaxed"
                  style={{ color: 'var(--t-text-light)', borderTop: '1px solid var(--t-border-light)' }}
                >
                  <p>
                    In Google AI Studio, create a key in a new project and keep its billing tier
                    on <strong>Free</strong>. You don’t need to set up billing or buy prepaid credits
                    to use the free tier. Paste the key above and press <strong>Save</strong>.
                  </p>
                  <p className="font-medium mt-3">Already on Tier 1 or another paid tier?</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-2">
                    <li>In AI Studio, note the project linked to your API key.</li>
                    <li>
                      Open{' '}
                      <a href={GOOGLE_BILLING_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: 'var(--t-accent)' }}>
                        Google Cloud Billing
                      </a>
                      {' '}and select that project’s billing account.
                    </li>
                    <li>
                      In the left sidebar, scroll to <strong>Billing management → Account management</strong>.
                      Under <strong>Projects linked to this billing account</strong>, find your project.
                    </li>
                    <li>
                      Click the <strong>three dots (⋮) in that project’s Actions column</strong>,
                      choose <strong>Disable billing</strong>, then confirm for that project.
                    </li>
                  </ol>
                  <p className="mt-3">
                    Disabling billing returns Gemini API access to the free tier. Other paid
                    services in that project will stop, some cloud resources may be deleted,
                    and existing charges still apply. Check what else uses the project before confirming.
                  </p>
                  <p className="mt-2">
                    If your project already shows Free, you’re all set. Free access has model,
                    region, and usage limits. After switching, try making tasks in the app.
                  </p>
                  <a href={GOOGLE_BILLING_HELP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-[44px] mt-1 underline underline-offset-2" style={{ color: 'var(--t-accent)' }}>
                    Google’s billing instructions
                  </a>
                </div>
              )}
            </div>
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
