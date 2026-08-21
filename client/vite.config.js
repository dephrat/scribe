import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned so the OAuth redirect in app.py always lands here, even when
  // another Vite project is already using the default 5173.
  server: {
    port: 5174,
    strictPort: true,
  },
})
