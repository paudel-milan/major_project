import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/sandbox': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        // Don't crash if backend restarts
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[Proxy] WS error (backend may be restarting):', err.message);
          });
        },
      },
    },
  },
})
