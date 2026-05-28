import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// HTTPS opcional para dev (issue #12):
//   `npm run dev`         → HTTP normal (default)
//   `npm run dev:https`   → HTTPS con cert autofirmado (necesario para
//                           usar la cámara desde un celular en LAN porque
//                           getUserMedia requiere contexto seguro)
const useHttps = process.env.HTTPS === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '@':         path.resolve(__dirname, './src'),
      '@modules':  path.resolve(__dirname, './src/modules'),
      '@shared':   path.resolve(__dirname, './src/shared'),
      '@layouts':  path.resolve(__dirname, './src/layouts'),
      '@styles':   path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Proxy /api → backend Node. Esto permite que el frontend (servido
    // en HTTPS para que funcione la cámara del QR en mobile, issue #12)
    // hable con el backend sin disparar bloqueo de mixed content del
    // browser. Las requests salen relativas desde la app y Vite las
    // forwardea al backend HTTP server-to-server.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
