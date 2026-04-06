import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

console.log('[Codrox] Renderer starting...')

const root = document.getElementById('root')
if (root) {
  console.log('[Codrox] Root element found, mounting React...')
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  console.error('[Codrox] Root element not found!')
}
