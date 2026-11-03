import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** GitHub Pages project site -> VITE_BASE=/ai-compute-atlas/ ; custom domain -> / */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/',
  build: { outDir: 'dist', target: 'es2022', cssMinify: 'lightningcss' },
})
