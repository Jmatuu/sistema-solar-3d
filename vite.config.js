import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // three.js pesa ~780 kB minificado. El aviso de chunk grande no aplica:
    // es la librería base y trocearla solo añadiría peticiones extra.
    chunkSizeWarningLimit: 1200,
  },
})