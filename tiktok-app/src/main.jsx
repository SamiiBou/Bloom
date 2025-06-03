import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MiniKitProvider>
      <App />
    </MiniKitProvider>
  </StrictMode>,
)