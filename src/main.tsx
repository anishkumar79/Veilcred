import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// Midnight v4 requires the network ID to be set globally before any wallet/contract interaction
setNetworkId('preprod');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
