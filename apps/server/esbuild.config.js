import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [
    // Native addons — must stay external
    'bufferutil',
    'utf-8-validate',
    'utp-native',
    'node-datachannel',
    // Prisma engine binaries
    '@prisma/client',
    '.prisma/client',
  ],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
  },
})

console.log('Build complete → dist/index.js')
