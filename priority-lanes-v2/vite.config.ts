import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds to one self-contained HTML file (JS, CSS and fonts inlined) so the demo opens by
// double-clicking with no server. `dist/` is still a normal static site for Netlify.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
})
