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
    // Use unique aliases so these imports never clash with bindings
    // that webtorrent (or its deps) introduce in the same bundle file.
    js: `import{createRequire as __cr}from"node:module";import{fileURLToPath as __futp}from"node:url";import{dirname as __dn}from"node:path";const require=__cr(import.meta.url);const __filename=__futp(import.meta.url);const __dirname=__dn(__filename);`,
  },
})

console.log('Build complete → dist/index.js')
