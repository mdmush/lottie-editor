import { StrictMode } from 'react'
import { useEditorStore } from './store/editor-store'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev-only hook for driving the store from the console / browser automation.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__editorStore = useEditorStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
