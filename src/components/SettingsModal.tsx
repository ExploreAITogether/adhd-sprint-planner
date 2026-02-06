import { useState, useEffect, useCallback, useRef } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTheme } from '../contexts/ThemeContext'
import { getSettings, updateSettings } from '../lib/database'
import type { Settings } from '../types'

interface SettingsModalProps {
  onClose: () => void
}

type ThemeOption = Settings['theme']

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [exportPath, setExportPath] = useState('')
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
              ADHD Sprint Planner v1.0
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
