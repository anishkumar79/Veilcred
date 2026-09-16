import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      external: [
        '@midnight-ntwrk/midnight-js-dapp-connector-wallet-provider',
        '@midnight-ntwrk/midnight-js',
        '@midnight-ntwrk/midnight-js-http-client-proof-provider',
        '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
      ]
    }
  }
})
// Vite build configuration for Veilcred
