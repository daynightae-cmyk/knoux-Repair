import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-tokens.css'
import './premium-shell.css'
import './workspace.css'
import './platform.css'
import './service-apps.css'
import './premium-cinematic.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
