import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Buffer } from 'buffer';

// Polyfill Buffer and process for Midnight SDK
if (typeof window !== "undefined") {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (window as any).process = (window as any).process || { env: {} };
}

// Midnight v4 requires the network ID to be set globally before any wallet/contract interaction
setNetworkId('preprod');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
