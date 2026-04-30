import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/my-app/',   // ← 加這一行
  plugins: [react()],
})