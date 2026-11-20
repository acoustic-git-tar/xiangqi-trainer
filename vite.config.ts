import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Fairy-Stockfish NNUE WASM needs SharedArrayBuffer → COOP/COEP.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    headers: isolationHeaders,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    headers: isolationHeaders,
  },
  optimizeDeps: {
    exclude: ['fairy-stockfish-nnue.wasm'],
  },
})
