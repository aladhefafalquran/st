import { build } from 'esbuild'

// Optional native addons that may not be compiled/installed in all environments.
// We stub them out so the bundle starts cleanly; webtorrent and ws fall back
// gracefully when these enhancements are absent.
const STUB_MODULES = ['bufferutil', 'utf-8-validate', 'utp-native', 'node-datachannel']

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [
    '@prisma/client',
    '.prisma/client',
  ],
  plugins: [
    {
      name: 'stub-optional-natives',
      setup(build) {
        for (const mod of STUB_MODULES) {
          const filter = new RegExp(`^${mod}$`)
          build.onResolve({ filter }, () => ({ path: mod, namespace: 'stub' }))
        }
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          // Export every known named export as null so esbuild's static
          // analysis doesn't complain about missing bindings.
          contents: [
            'export default null;',
            // node-datachannel exports used by webrtc-polyfill
            'export const PeerConnection = null;',
            'export const RtcpReceivingSession = null;',
            'export const Video = null;',
            'export const Audio = null;',
          ].join('\n'),
          loader: 'js',
        }))
      },
    },
  ],
  banner: {
    // Use unique aliases so these imports never clash with bindings
    // that webtorrent (or its deps) introduce in the same bundle file.
    js: `import{createRequire as __cr}from"node:module";import{fileURLToPath as __futp}from"node:url";import{dirname as __dn}from"node:path";const require=__cr(import.meta.url);const __filename=__futp(import.meta.url);const __dirname=__dn(__filename);`,
  },
})

console.log('Build complete → dist/index.js')
