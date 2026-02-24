import WebTorrent, { type Torrent, type TorrentFile } from 'webtorrent'
import os from 'os'
import path from 'path'

const DOWNLOAD_PATH = path.join(os.tmpdir(), 'streamtime')

export {}

declare global {
  // eslint-disable-next-line no-var
  var __webtorrent: WebTorrent | undefined
}

// Singleton — one WebTorrent instance for the whole server process
// utp: false → disable UDP transport (avoids EACCES on some environments)
const client: WebTorrent = global.__webtorrent ?? new WebTorrent({ utp: false, maxConns: 100 })
if (!global.__webtorrent) global.__webtorrent = client

interface ManagedTorrent {
  torrent: Torrent
  lastUsed: number
}

// Fully initialized torrents (add() callback has fired, files are available)
const managed = new Map<string, ManagedTorrent>()

// Deduplicates concurrent requests for the same magnet while it's loading
const loadingMap = new Map<string, Promise<Torrent>>()

// Cleanup idle torrents every 5 minutes
setInterval(() => {
  const threshold = Date.now() - 30 * 60 * 1000
  for (const [key, entry] of managed) {
    if (entry.lastUsed < threshold) {
      entry.torrent.destroy()
      managed.delete(key)
      console.log(`[torrent] Cleaned up idle torrent: ${key.slice(0, 20)}…`)
    }
  }
}, 5 * 60 * 1000)

export type VideoFile = {
  file: TorrentFile
  length: number
  name: string
}

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.webm']

function isVideo(f: TorrentFile): boolean {
  const lower = f.name.toLowerCase()
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext)) && !lower.includes('sample')
}

function selectVideoFile(torrent: Torrent, fileIdx?: number): TorrentFile | null {
  if (fileIdx !== undefined) {
    const indexed = torrent.files[fileIdx]
    if (indexed && isVideo(indexed)) {
      for (const f of torrent.files) {
        if (f !== indexed) f.deselect()
      }
      indexed.select()
      return indexed
    }
  }

  const videos = torrent.files.filter(isVideo)
  if (videos.length === 0) return null

  videos.sort((a: TorrentFile, b: TorrentFile) => {
    const aIsMp4 = a.name.toLowerCase().endsWith('.mp4') ? 1 : 0
    const bIsMp4 = b.name.toLowerCase().endsWith('.mp4') ? 1 : 0
    if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4
    return b.length - a.length
  })

  const selected = videos[0]
  for (const f of torrent.files) {
    if (f !== selected) f.deselect()
  }
  selected.select()
  return selected
}

/**
 * Adds the magnet via client.add() and returns a Promise<Torrent>.
 * Deduplicates concurrent calls for the same magnet so client.add() is
 * only called once — avoids the partially-constructed Torrent race condition
 * in WebTorrent v2.x where client.get() can return an object without .once().
 */
export function loadTorrent(magnet: string): Promise<Torrent> {
  if (loadingMap.has(magnet)) {
    return loadingMap.get(magnet)!
  }

  const promise = new Promise<Torrent>((resolve, reject) => {
    const onClientError = (err: Error | string) => {
      loadingMap.delete(magnet)
      managed.delete(magnet)
      reject(typeof err === 'string' ? new Error(err) : err)
    }
    client.once('error', onClientError)

    console.log(`[torrent] Adding magnet… (path=${DOWNLOAD_PATH})`)
    client.add(magnet, { path: DOWNLOAD_PATH }, (torrent: Torrent) => {
      client.off('error', onClientError)
      console.log(`[torrent] Ready: "${torrent.name}" (${torrent.files.length} files, ${torrent.numPeers} peers)`)
      managed.set(magnet, { torrent, lastUsed: Date.now() })
      loadingMap.delete(magnet)
      resolve(torrent)
    })
  })

  loadingMap.set(magnet, promise)
  return promise
}

export async function getVideoFile(magnet: string, fileIdx?: number): Promise<VideoFile> {
  let torrent: Torrent

  const existing = managed.get(magnet)
  if (existing) {
    existing.lastUsed = Date.now()
    torrent = existing.torrent
  } else {
    torrent = await loadTorrent(magnet)
  }

  const file = selectVideoFile(torrent, fileIdx)
  if (!file) throw new Error('No video file found in torrent')
  return { file, length: file.length, name: file.name }
}

const PRELOAD_BYTES = 5 * 1024 * 1024 // 5 MB

const preloadInProgress = new Set<string>()
const preloadDoneSet = new Set<string>()
const preloadProgress = new Map<string, number>()

export interface StreamStatus {
  phase: 'waiting' | 'connecting' | 'ready'
  peers: number
  downloadSpeed: number
  preloadDone: boolean
  preloadBytes: number
  preloadTotal: number
}

export function getTorrentStatus(magnet: string): StreamStatus {
  const entry = managed.get(magnet)
  if (!entry) {
    return { phase: 'waiting', peers: 0, downloadSpeed: 0, preloadDone: false, preloadBytes: 0, preloadTotal: PRELOAD_BYTES }
  }
  const t = entry.torrent
  const peers = (t.numPeers as number) ?? 0
  const downloadSpeed = Math.round((t.downloadSpeed as number) ?? 0)
  return {
    phase: peers > 0 ? 'ready' : 'connecting',
    peers,
    downloadSpeed,
    preloadDone: preloadDoneSet.has(magnet),
    preloadBytes: preloadProgress.get(magnet) ?? 0,
    preloadTotal: PRELOAD_BYTES,
  }
}

/**
 * Pre-downloads the first 5 MB of the video file into WebTorrent's piece cache.
 * When the browser later issues range-0, those pieces are served from disk instantly.
 */
export async function startVideoPreload(magnet: string, fileIdx?: number): Promise<void> {
  if (preloadInProgress.has(magnet) || preloadDoneSet.has(magnet)) return
  preloadInProgress.add(magnet)

  try {
    const torrent = await loadTorrent(magnet)
    const file = selectVideoFile(torrent, fileIdx)
    if (!file) { preloadInProgress.delete(magnet); return }

    const end = Math.min(PRELOAD_BYTES - 1, file.length - 1)
    console.log(`[torrent] Preloading first ${Math.round((end + 1) / 1024)} KB of "${file.name}"…`)

    preloadProgress.set(magnet, 0)
    await new Promise<void>((resolve) => {
      const stream = file.createReadStream({ start: 0, end })
      stream.on('data', (chunk: Buffer | string) => {
        const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
        preloadProgress.set(magnet, (preloadProgress.get(magnet) ?? 0) + len)
      })
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })

    preloadDoneSet.add(magnet)
    console.log(`[torrent] Preload complete for "${file.name}"`)
  } catch {
    // Best effort
  } finally {
    preloadInProgress.delete(magnet)
  }
}
