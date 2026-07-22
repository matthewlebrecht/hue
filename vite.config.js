import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // the kitchen iPad hits this box over the LAN during dev
    host: true,
    port: 5173,
  },
})
