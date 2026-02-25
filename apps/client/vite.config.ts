import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Expose the server-side OPENSUBTITLES_API_KEY to the client bundle at build time.
  // CF Pages sets OPENSUBTITLES_API_KEY as a build environment variable, so it's
  // available here as process.env.OPENSUBTITLES_API_KEY during `vite build`.
  define: {
    __OS_KEY__: JSON.stringify(process.env.OPENSUBTITLES_API_KEY ?? ''),
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
