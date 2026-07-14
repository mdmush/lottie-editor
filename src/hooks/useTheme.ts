import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const THEME_COLORS: Record<Theme, string> = {
  dark: '#121317',
  light: '#f4f5f7',
}

/**
 * The initial theme is stamped on <html data-theme> by the inline script in
 * index.html (before first paint); this hook takes over from there.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable (private mode) — theme still applies for the session */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme])
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])

  return { theme, toggle }
}
