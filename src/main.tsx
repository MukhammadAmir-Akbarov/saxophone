import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Офлайн-режим. Только в сборке: в dev кэш service worker'а мешал бы видеть правки.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(async () => {
      const reg = await navigator.serviceWorker.ready
      // бандлы и шрифты уже загружены страницей до установки SW — просим докэшировать их
      const urls = performance.getEntriesByType('resource').map((e) => e.name)
      reg.active?.postMessage({ type: 'cache', urls })
    }).catch(() => {})
  })
}
