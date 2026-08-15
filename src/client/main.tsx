import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppQueryProvider } from './query/provider'
import { AppShell } from './shell/AppShell'
import './styles/index.css'
import './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppQueryProvider>
  </StrictMode>,
)
