import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import gammaPwa from './gammaPwa.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gammaPwa()],
})
