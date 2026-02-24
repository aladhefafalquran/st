import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

/**
 * Copies the pre-compiled WebTorrent browser bundle from node_modules to
 * public/ so it can be served as a plain <script> without Vite bundling it.
 * (The npm package is the Node.js version; only the dist bundle works in browsers.)
 */
function copyWebTorrentBundle(): Plugin {
  return {
    name: 'copy-webtorrent-bundle',
    buildStart() {
      const src = path.resolve(__dirname, 'node_modules/webtorrent/dist/webtorrent.min.js');
      const dest = path.resolve(__dirname, 'public/webtorrent.min.js');
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyWebTorrentBundle()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
