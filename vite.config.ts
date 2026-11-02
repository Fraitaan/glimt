import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base: './'` keeps the build portable: it works at a domain root (Cloudflare Pages)
// and in a sub-path (GitHub Pages project sites) without changes.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
