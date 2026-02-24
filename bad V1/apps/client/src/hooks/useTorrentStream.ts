import { useEffect, useRef, useState } from 'react';

/**
 * Browser-side WebTorrent streaming.
 *
 * Uses the pre-compiled browser bundle (/webtorrent.min.js) loaded via
 * <script type="module"> — this bypasses Vite bundling the Node.js version.
 *
 * Why this is faster than server-side:
 *  • Browser uses WebRTC (built-in, sub-second P2P handshake)
 *  • wss:// WebSocket trackers respond in < 1 second
 *  • Bytes travel peer → browser directly (no server bottleneck)
 *  • Typical startup: 3-10 s vs 30-120 s server-side on Windows
 *
 * Falls back for MKV/AVI — Chrome's MediaSource API doesn't support them,
 * so the caller should use the server stream URL instead.
 */

const WSS_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce',
  'wss://spacetradersapi-chatgpt.herokuapp.com:443/announce',
];

// If browser WebTorrent can't find peers within this window, fall back to server.
// Server preloads in parallel from t=0, so a short timeout is fine — no wasted
// waiting time. WSS trackers often fail on first attempt; 8 s is enough to know.
const BROWSER_TIMEOUT_MS = 8_000;

// Only MP4/WebM can be streamed via MediaSource API in Chrome
const MSE_EXTS = ['mp4', 'webm', 'mov', 'm4v'];

export type BrowserStreamPhase =
  | 'loading'    // connecting, downloading first pieces
  | 'ready'      // renderTo() succeeded — video is playing
  | 'fallback';  // MKV or WebRTC error → use server stream

export interface BrowserStreamState {
  phase: BrowserStreamPhase;
  peers: number;
  downloadSpeed: number;
  progress: number;
}

// ── Singleton ESM loader ───────────────────────────────────────────────────────
// webtorrent/dist/webtorrent.min.js is an ES module (export{Kt as default}).
// Classic <script> tags reject ESM files with SyntaxError.
// We load public/wt-compat.js as <script type="module">; that file imports
// WebTorrent from /webtorrent.min.js and sets window.WebTorrent.
// The browser handles the entire ESM chain natively — Vite is not involved.
let wtPromise: Promise<unknown> | null = null;

function loadWebTorrentScript(): Promise<unknown> {
  if (wtPromise) return wtPromise;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).WebTorrent === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wtPromise = Promise.resolve((window as any).WebTorrent);
    return wtPromise;
  }

  wtPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';        // ← ESM-aware: export keyword is legal
    script.src = '/wt-compat.js';  // sets window.WebTorrent then returns
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wt = (window as any).WebTorrent;
      if (typeof wt === 'function') resolve(wt);
      else reject(new Error('WebTorrent not set after module load'));
    };
    script.onerror = () => {
      wtPromise = null; // allow retry
      reject(new Error('Failed to load /wt-compat.js'));
    };
    document.head.appendChild(script);
  });
  return wtPromise;
}

function extractHash(magnet: string): string | null {
  return magnet.match(/btih:([a-fA-F0-9]+)/i)?.[1] ?? null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTorrentStream(
  magnet: string | null,
  fileIdx: number | undefined,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  /** Filename hint from Torrentio — immediately falls back for MKV/AVI without waiting */
  filename?: string | null,
): BrowserStreamState {
  const [state, setState] = useState<BrowserStreamState>({
    phase: 'loading',
    peers: 0,
    downloadSpeed: 0,
    progress: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!magnet || !videoRef.current) return;

    // Reset to loading state whenever the magnet/episode changes
    setState({ phase: 'loading', peers: 0, downloadSpeed: 0, progress: 0 });

    // If we already know the file is MKV/AVI (from Torrentio's filename hint),
    // skip browser WebTorrent entirely — Chrome's MediaSource API can't decode
    // these formats so we'd just waste 8 seconds before falling back anyway.
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      if (!MSE_EXTS.includes(ext)) {
        setState(s => ({ ...s, phase: 'fallback' }));
        return;
      }
    }

    let destroyed = false;
    const videoEl = videoRef.current;

    const fallback = () => {
      if (!destroyed) setState(s => ({ ...s, phase: 'fallback' }));
    };

    (async () => {
      try {
        // Load the browser bundle (cached after first call)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const WebTorrent = await loadWebTorrentScript() as any;
        if (destroyed || typeof WebTorrent !== 'function') { fallback(); return; }

        const hash = extractHash(magnet);
        if (!hash) { fallback(); return; }

        // Magnet with wss:// trackers — these are WebSocket-based and work in browsers.
        // HTTP/UDP trackers (used server-side) don't work in browsers.
        const browserMagnet =
          `magnet:?xt=urn:btih:${hash}` +
          WSS_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');

        const client = new WebTorrent();
        clientRef.current = client;

        client.on('error', fallback);

        // Bail out to server if we can't get torrent metadata in time
        peerTimeoutRef.current = setTimeout(() => {
          if (!destroyed) { clientRef.current = null; client.destroy(); fallback(); }
        }, BROWSER_TIMEOUT_MS);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.add(browserMagnet, (torrent: any) => {
          if (peerTimeoutRef.current) { clearTimeout(peerTimeoutRef.current); peerTimeoutRef.current = null; }
          if (destroyed) { torrent.destroy(); return; }

          // Find the right file
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const file = fileIdx !== undefined
            ? torrent.files[fileIdx]
            : torrent.files
                .filter((f: { name: string }) => /\.(mp4|mkv|webm|avi|mov|m4v)$/i.test(f.name))
                .filter((f: { name: string }) => !f.name.toLowerCase().includes('sample'))
                .sort((a: { length: number }, b: { length: number }) => b.length - a.length)[0];

          if (!file) { fallback(); return; }

          // Deselect all other files — avoids downloading the whole season pack
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          torrent.files.forEach((f: any) => { if (f !== file) f.deselect(); });
          file.select();

          const ext = (file.name.split('.').pop() ?? '').toLowerCase();
          if (!MSE_EXTS.includes(ext)) {
            // MKV/AVI → can't stream via MediaSource API → use server fallback
            client.destroy();
            fallback();
            return;
          }

          // Stream directly into the <video> element via MediaSource API.
          // renderTo() pushes pieces as they download — video starts in seconds.
          file.renderTo(videoEl, { autoplay: true }, (err: Error | null) => {
            if (!destroyed && err) { client.destroy(); fallback(); }
          });

          setState(s => ({ ...s, phase: 'ready' }));

          // Update peer/speed stats while downloading
          statsInterval.current = setInterval(() => {
            if (!destroyed) {
              setState({
                phase: 'ready',
                peers: torrent.numPeers ?? 0,
                downloadSpeed: Math.round(torrent.downloadSpeed ?? 0),
                progress: torrent.progress ?? 0,
              });
            }
          }, 500);

          torrent.once('done', () => {
            if (statsInterval.current) clearInterval(statsInterval.current);
          });
        });
      } catch {
        fallback();
      }
    })();

    return () => {
      destroyed = true;
      if (peerTimeoutRef.current) { clearTimeout(peerTimeoutRef.current); peerTimeoutRef.current = null; }
      if (statsInterval.current) clearInterval(statsInterval.current);
      try { clientRef.current?.destroy(); } catch { /* already destroyed by timeout */ }
      clientRef.current = null;
    };
  }, [magnet, fileIdx]);

  return state;
}
