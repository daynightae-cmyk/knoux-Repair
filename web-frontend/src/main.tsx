import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-tokens.css'
import './premium-shell.css'
import './workspace.css'
import './platform.css'
import './service-apps.css'
import './premium-cinematic.css'
import './mcp-center.css'
import './mission04-visual.css'
import './mission04-density.css'
import './family-preview.css'
import './command-center.css'
import './ai-command-center.css'
import App from './App'
import McpOverlayHost from './components/McpOverlayHost'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <McpOverlayHost />
  </StrictMode>,
)
