import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative asset paths so the build works from any sub-path (GitHub Pages, S3, a file share).
export default defineConfig({
  base: './',
  plugins: [react()],
  // React + Recharts in one bundle is ~200 kB gzipped, which is fine for a single-page tool.
  build: { chunkSizeWarningLimit: 800 },
})
