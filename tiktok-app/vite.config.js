import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['https://399c788608d9.ngrok.app', '399c788608d9.ngrok.app']
  }
})
