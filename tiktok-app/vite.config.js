import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['769b2f4ce460.ngrok.app', '2ce4cca6a8ec.ngrok.app']
  }
})
