import { createContext, useContext } from 'react'
import type { Settings } from '../types'

export type Theme = Settings['theme']
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

// Lives here (not in ThemeContext.tsx) so that file exports only the
// provider component, which keeps Vite fast refresh working.
export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}
