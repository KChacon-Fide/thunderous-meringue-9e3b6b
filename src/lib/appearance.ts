import { useCallback, useEffect, useState } from 'react'

export type AppearanceMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export const APPEARANCE_STORAGE_KEY = 'kodex-appearance'

export function normalizeAppearance(value: unknown): AppearanceMode {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'light'
}

export function getAutoTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours()
  return hour >= 18 || hour < 6 ? 'dark' : 'light'
}

export function resolveAppearance(mode: AppearanceMode): ResolvedTheme {
  return mode === 'auto' ? getAutoTheme() : mode
}

export function readStoredAppearance(): AppearanceMode {
  if (typeof window === 'undefined') return 'light'
  return normalizeAppearance(window.localStorage.getItem(APPEARANCE_STORAGE_KEY))
}

export function hasStoredAppearance() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) !== null
}

export function saveStoredAppearance(mode: AppearanceMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode)
}

export function applyAppearance(mode: AppearanceMode) {
  if (typeof document === 'undefined') return

  const resolvedTheme = resolveAppearance(mode)
  const root = document.documentElement
  root.dataset.kodexAppearance = mode
  root.dataset.kodexTheme = resolvedTheme
  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.style.colorScheme = resolvedTheme
}

export function getInitialAppearanceScript() {
  return `
    (function () {
      try {
        var key = '${APPEARANCE_STORAGE_KEY}';
        var mode = localStorage.getItem(key);
        if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') mode = 'light';
        var hour = new Date().getHours();
        var resolved = mode === 'auto' ? (hour >= 18 || hour < 6 ? 'dark' : 'light') : mode;
        var root = document.documentElement;
        root.dataset.kodexAppearance = mode;
        root.dataset.kodexTheme = resolved;
        root.classList.toggle('dark', resolved === 'dark');
        root.style.colorScheme = resolved;
      } catch (_) {}
    })();
  `
}

export function useKodexAppearance(userAppearance?: unknown) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>(() =>
    normalizeAppearance(userAppearance ?? readStoredAppearance()),
  )

  useEffect(() => {
    if (userAppearance === undefined || userAppearance === null) return

    const nextAppearance = normalizeAppearance(userAppearance)
    const preferredAppearance = hasStoredAppearance() ? readStoredAppearance() : nextAppearance
    setAppearanceState(preferredAppearance)
    saveStoredAppearance(preferredAppearance)
    applyAppearance(preferredAppearance)
  }, [userAppearance])

  useEffect(() => {
    saveStoredAppearance(appearance)
    applyAppearance(appearance)

    if (appearance !== 'auto') return

    const interval = window.setInterval(() => applyAppearance('auto'), 60 * 1000)
    const handleVisibility = () => applyAppearance('auto')
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [appearance])

  const setAppearance = useCallback((next: AppearanceMode) => {
    const normalized = normalizeAppearance(next)
    setAppearanceState(normalized)
    saveStoredAppearance(normalized)
    applyAppearance(normalized)
  }, [])

  return {
    appearance,
    resolvedTheme: resolveAppearance(appearance),
    setAppearance,
  }
}
