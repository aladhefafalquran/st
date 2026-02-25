import { useRef, useState, useEffect, useCallback } from 'react'
import { api, tmdbImg } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { TorrentOption, SubtitleTrack, SubtitleCue } from '@streamtime/shared'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

// Injected at build time by vite.config.ts — the OpenSubtitles API key.
// Using declare so TypeScript doesn't complain; Vite replaces __OS_KEY__ with the literal string.
declare const __OS_KEY__: string
const OS_KEY: string = (typeof __OS_KEY__ !== 'undefined' ? __OS_KEY__ : '') || ''

const OS_HEADERS = OS_KEY ? { 'Api-Key': OS_KEY, 'Content-Type': 'application/json' } : null
const PRELOAD_TIMEOUT    = 30           // absolute max wait (seconds)
const NO_PEERS_TIMEOUT   = 10           // skip if zero peers after this long
const SLOW_SPEED_TIMEOUT = 15           // skip if peers>0 but speed too low
const SLOW_SPEED_THRESHOLD = 200 * 1024 // 200 KB/s

const QUALITY_ORDER: Record<string, number> = { '2160p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1 }

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'tr', label: 'Turkish' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
]

interface VideoPlayerProps {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  imdbId: string
  season?: number
  episode?: number
  backdropPath?: string | null
  posterPath?: string | null
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatSpeed(bps: number): string {
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
}

function parseVtt(vtt: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.trim().split('\n')
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split('-->')
    const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim()
    if (!text) continue
    cues.push({ start: parseTime(startStr.trim()), end: parseTime(endStr.trim()), text })
  }
  return cues
}

function parseTime(s: string): number {
  const parts = s.replace(',', '.').split(':')
  return parts.length === 3
    ? Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
    : Number(parts[0]) * 60 + Number(parts[1])
}

export function VideoPlayer({ tmdbId, mediaType, title, imdbId, season, episode, backdropPath, posterPath }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuthStore()

  // Torrent / loading state
  const [streams, setStreams] = useState<TorrentOption[]>([])
  const [streamsLoading, setStreamsLoading] = useState(true)
  const [streamIndex, setStreamIndex] = useState(0)
  const [selectedStream, setSelectedStream] = useState<TorrentOption | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  // Ref mirrors streamUrl so polling closure always sees current value
  const streamUrlRef = useRef<string | null>(null)

  const [streamPhase, setStreamPhase] = useState<'waiting' | 'connecting' | 'ready'>('waiting')
  const [peers, setPeers] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [preloadBytes, setPreloadBytes] = useState(0)
  const [preloadTotal, setPreloadTotal] = useState(5 * 1024 * 1024)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const waitSecondsRef = useRef(0)
  const peersRef = useRef(0)
  const downloadSpeedRef = useRef(0)

  // Video element state
  const [videoCanPlay, setVideoCanPlay] = useState(false) // true once browser has enough data
  const [videoErrorCount, setVideoErrorCount] = useState(0)

  // Player controls
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showQualityPicker, setShowQualityPicker] = useState(false)

  // Subtitle state
  const [subsOpen, setSubsOpen] = useState(false)
  const [subView, setSubView] = useState<'lang' | 'tracks'>('lang') // two-level menu
  const [subLang, setSubLang] = useState('')
  const [tracks, setTracks] = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrack] = useState<SubtitleTrack | null>(null)
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [activeCue, setActiveCue] = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)
  const [subtitleError, setSubtitleError] = useState<string | null>(null)

  const watchStartRef = useRef<number>(Date.now())

  // ----- Fetch available streams -----
  useEffect(() => {
    setStreamsLoading(true)
    setStreams([])
    setSelectedStream(null)
    setStreamUrl(null)
    streamUrlRef.current = null
    setStreamPhase('waiting')
    setStreamError(null)
    setSelectedQuality(null)
    setStreamIndex(0)
    setWaitSeconds(0)
    waitSecondsRef.current = 0
    setVideoCanPlay(false)
    setVideoErrorCount(0)

    const params: Record<string, string> = { imdb_id: imdbId, type: mediaType }
    if (mediaType === 'tv' && season) params.season = String(season)
    if (mediaType === 'tv' && episode) params.episode = String(episode)

    api.get<{ torrents: TorrentOption[] }>('/api/stream/torrents', { params })
      .then((r) => {
        const torrents = r.data.torrents
        if (torrents.length === 0) { setStreams([]); setStreamError('No streams found.'); return }
        // Sort: within each quality tier, highest seeds first
        const sorted = [...torrents].sort((a, b) => {
          const qd = (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0)
          return qd !== 0 ? qd : b.seeds - a.seeds
        })
        setStreams(sorted)
        const qualities = [...new Set(sorted.map((t) => t.quality))]
        if (qualities.length === 1) {
          // Only one quality — skip picker, start immediately
          setSelectedQuality(qualities[0])
          startStream(sorted, 0)
        }
        // else: quality picker overlay is shown (selectedQuality stays null)
      })
      .catch(() => setStreamError('Failed to fetch streams.'))
      .finally(() => setStreamsLoading(false))
  }, [imdbId, mediaType, season, episode])

  function startStream(list: TorrentOption[], idx: number) {
    const stream = list[idx]
    if (!stream) { setStreamError('No more sources available.'); return }
    setSelectedStream(stream)
    setStreamUrl(null)
    streamUrlRef.current = null
    setStreamPhase('waiting')
    setPeers(0)
    setDownloadSpeed(0)
    setPreloadBytes(0)
    setStreamError(null)
    setWaitSeconds(0)
    waitSecondsRef.current = 0
    setVideoCanPlay(false)
    setVideoErrorCount(0)
    peersRef.current = 0
    downloadSpeedRef.current = 0
    // Fire prewarm for current source immediately
    api.post('/api/stream/prewarm', { magnet: stream.magnet, fileIdx: stream.fileIdx }).catch(() => {})
    // Pre-warm next 2 sources in background so they're ready when we need them
    for (const next of list.slice(idx + 1, idx + 3)) {
      api.post('/api/stream/prewarm', { magnet: next.magnet, fileIdx: next.fileIdx }).catch(() => {})
    }
  }

  // ----- Wait-time counter (shows elapsed seconds while loading) -----
  useEffect(() => {
    if (streamUrl || streamError || streamsLoading || !selectedQuality) return
    waitSecondsRef.current = 0
    setWaitSeconds(0)
    const iv = setInterval(() => {
      waitSecondsRef.current++
      setWaitSeconds(waitSecondsRef.current)

      const t = waitSecondsRef.current
      const speed = downloadSpeedRef.current
      const p = peersRef.current

      const noPeers     = t >= NO_PEERS_TIMEOUT   && p === 0
      const slowAndStuck = t >= SLOW_SPEED_TIMEOUT && p > 0 && speed < SLOW_SPEED_THRESHOLD
      if (t >= PRELOAD_TIMEOUT || noPeers || slowAndStuck) {
        clearInterval(iv)
        setStreamIndex((prev) => {
          const next = prev + 1
          setStreams((s) => { startStream(s, next); return s })
          return next
        })
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [selectedStream, streamUrl, streamError, streamsLoading, selectedQuality])

  // ----- Poll status until preload is done -----
  useEffect(() => {
    if (!selectedStream || streamUrlRef.current) return
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const r = await api.get('/api/stream/status', {
          params: { magnet: selectedStream.magnet, fileIdx: selectedStream.fileIdx },
        })
        if (cancelled) return
        const s = r.data
        setStreamPhase(s.phase)
        peersRef.current = s.peers
        setPeers(s.peers)
        downloadSpeedRef.current = s.downloadSpeed
        setDownloadSpeed(s.downloadSpeed)
        setPreloadBytes(s.preloadBytes)
        setPreloadTotal(s.preloadTotal)

        // Only start playing once the server has actually buffered data
        if (s.preloadDone && !streamUrlRef.current) {
          const qs = new URLSearchParams({ magnet: selectedStream.magnet })
          if (selectedStream.fileIdx !== undefined) qs.set('fileIdx', String(selectedStream.fileIdx))
          const url = `${API_BASE}/api/stream/watch?${qs}`
          streamUrlRef.current = url
          setStreamUrl(url)
        }
      } catch {
        // ignore transient poll errors
      }

      if (!cancelled && !streamUrlRef.current) {
        setTimeout(poll, 2000)
      }
    }

    const t = setTimeout(poll, 800)
    return () => { cancelled = true; clearTimeout(t) }
  }, [selectedStream])

  // ----- Video element events -----
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setCurrentTime(v.currentTime)
    const onDuration = () => setDuration(v.duration)
    const onVolume = () => { setVolume(v.volume); setMuted(v.muted) }
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    // Only 'playing' guarantees the first frame is actually painted —
    // 'canplay' fires too early (browser has data but hasn't decoded the frame yet).
    const onPlaying = () => setVideoCanPlay(true)

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('durationchange', onDuration)
    v.addEventListener('volumechange', onVolume)
    v.addEventListener('playing', onPlaying)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('durationchange', onDuration)
      v.removeEventListener('volumechange', onVolume)
      v.removeEventListener('playing', onPlaying)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [streamUrl])

  // ----- Auto-skip if video is mounted but never starts playing (e.g. unsupported codec) -----
  useEffect(() => {
    if (!streamUrl || videoCanPlay) return
    // 6s is plenty — if the buffer is full and video still isn't playing, codec/format is wrong
    const t = setTimeout(() => {
      setStreamIndex((prev) => {
        const next = prev + 1
        setStreams((s) => { startStream(s, next); return s })
        return next
      })
    }, 6000)
    return () => clearTimeout(t)
  }, [streamUrl, videoCanPlay])

  // ----- Watch history -----
  useEffect(() => { watchStartRef.current = Date.now() }, [tmdbId, season, episode])

  useEffect(() => {
    if (!isAuthenticated || !streamUrl) return
    const save = () => {
      const progressSeconds = Math.round((Date.now() - watchStartRef.current) / 1000)
      api.post('/api/history', {
        tmdbId, mediaType, title,
        posterPath: posterPath ?? null,
        seasonNumber: season ?? null,
        episodeNumber: episode ?? null,
        progressSeconds,
        durationSeconds: Math.round(duration || 0),
      }).catch(() => {})
    }
    save()
    const iv = setInterval(save, 30000)
    return () => clearInterval(iv)
  }, [isAuthenticated, tmdbId, mediaType, title, posterPath, season, episode, streamUrl, duration])

  // ----- Controls auto-hide -----
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => { resetHideTimer() }, [])

  // ----- Subtitle cue matching -----
  useEffect(() => {
    if (!cues.length) return
    const cue = cues.find((c) => currentTime >= c.start && currentTime <= c.end) ?? null
    setActiveCue(cue?.text ?? null)
  }, [currentTime, cues])

  // ----- Player control functions -----
  function togglePlay() {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current; if (!v) return
    v.currentTime = Number(e.target.value)
  }
  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current; if (!v) return
    v.volume = Number(e.target.value); v.muted = false
  }
  function toggleMute() { const v = videoRef.current; if (!v) return; v.muted = !v.muted }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else (containerRef.current ?? videoRef.current)?.requestFullscreen?.()
  }

  // Direct call to OpenSubtitles API — used when __OS_KEY__ is embedded at build time
  async function searchDirect(lang: string): Promise<SubtitleTrack[]> {
    const p = new URLSearchParams({ languages: lang })
    p.set('imdb_id', imdbId.replace(/^tt/, ''))
    if (mediaType === 'tv') {
      p.set('type', 'episode')
      if (season)  p.set('season_number',  String(season))
      if (episode) p.set('episode_number', String(episode))
    } else {
      p.set('type', 'movie')
    }
    const r = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${p}`, { headers: OS_HEADERS! })
    if (!r.ok) throw new Error(`OS ${r.status}`)
    const data = await r.json()
    return (data.data ?? [])
      .filter((item: any) => item.attributes?.files?.length > 0)
      .map((item: any) => ({
        fileId:       String(item.attributes.files[0].file_id),
        language:     item.attributes.language,
        languageName: item.attributes.language,
        releaseName:  item.attributes.release || item.attributes.files[0].file_name || '',
      }))
  }

  // Proxy call through CF Functions / server — fallback when direct call unavailable
  async function searchProxy(lang: string): Promise<SubtitleTrack[]> {
    const p = new URLSearchParams({ imdb_id: imdbId, type: mediaType, languages: lang })
    if (mediaType === 'tv' && season)  p.set('season',  String(season))
    if (mediaType === 'tv' && episode) p.set('episode', String(episode))
    const r = await fetch(`/api/subtitles/search?${p}`)
    const body = await r.json().catch(() => [])
    if (!r.ok) throw new Error((body as any)?.error ?? `Search ${r.status}`)
    return body as SubtitleTrack[]
  }

  const fetchSubtitles = useCallback(async (lang: string) => {
    setSubLang(lang); setSubtitleLoading(true)
    setTracks([]); setActiveTrack(null); setCues([]); setActiveCue(null); setSubtitleError(null)
    try {
      let list: SubtitleTrack[]
      if (OS_HEADERS) {
        try {
          list = await searchDirect(lang)
        } catch {
          // CORS or API error — fall back to proxy
          list = await searchProxy(lang)
        }
      } else {
        list = await searchProxy(lang)
      }
      setTracks(list)
    } catch (err: any) {
      setSubtitleError(err?.message ?? 'Search failed')
      setSubView('tracks')
    } finally { setSubtitleLoading(false) }
  }, [imdbId, mediaType, season, episode])

  async function selectSubtitleTrack(track: SubtitleTrack | null) {
    if (!track) { setActiveTrack(null); setCues([]); setActiveCue(null); setSubtitleError(null); return }
    setActiveTrack(track)
    setSubtitleError(null)
    try {
      // Always proxy through CF Function / server — OS REST /download requires
      // user JWT auth (not just API key), so we can't call it from the browser.
      // CF Function and server both use XML-RPC which works anonymously.
      const r = await fetch(`/api/subtitles/download/${track.fileId}`)
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any
        throw new Error(err?.error ?? `HTTP ${r.status}`)
      }
      setCues(parseVtt(await r.text()))
    } catch (err: any) {
      console.error('[subtitle]', err?.message)
      setSubtitleError(err?.message ?? 'Download failed')
      setCues([])
    }
  }

  function tryNextStream() {
    const next = streamIndex + 1
    if (next >= streams.length) {
      setStreamError('All sources failed. Try again later.')
      return
    }
    setStreamIndex(next)
    startStream(streams, next)
  }

  function pickQuality(quality: string) {
    setSelectedQuality(quality)
    // Put chosen quality first (sorted by seeds desc), then the rest
    const preferred = streams.filter((s) => s.quality === quality).sort((a, b) => b.seeds - a.seeds)
    const rest = streams.filter((s) => s.quality !== quality).sort((a, b) => b.seeds - a.seeds)
    const ordered = [...preferred, ...rest]
    setStreams(ordered)
    setStreamIndex(0)
    startStream(ordered, 0)
  }

  // Retry same stream (e.g. after a transient video error)
  function retryCurrentStream() {
    if (!selectedStream) return
    setStreamUrl(null)
    streamUrlRef.current = null
    setVideoCanPlay(false)
    setVideoErrorCount(0)
    setWaitSeconds(0)
    waitSecondsRef.current = 0
    setStreamPhase('waiting')
    // Re-trigger polling by clearing and re-setting selectedStream
    const s = selectedStream
    setSelectedStream(null)
    setTimeout(() => {
      api.post('/api/stream/prewarm', { magnet: s.magnet, fileIdx: s.fileIdx }).catch(() => {})
      setSelectedStream(s)
    }, 300)
  }

  const posterSrc = backdropPath ? tmdbImg(backdropPath, 'w1280') : posterPath ? tmdbImg(posterPath, 'w500') : null
  const preloadPct = preloadTotal > 0 ? Math.round((preloadBytes / preloadTotal) * 100) : 0
  const isLoading = !streamUrl && !streamError && !streamsLoading

  function loadingLabel(): string {
    if (streamPhase === 'waiting') return 'Connecting to trackers…'
    if (streamPhase === 'connecting') return `Finding peers… ${peers > 0 ? `(${peers} connected)` : ''}`
    if (peers === 0) return 'Waiting for peers…'
    return `Buffering ${preloadPct}%  ·  ${formatSpeed(downloadSpeed)}  ·  ${peers} peer${peers !== 1 ? 's' : ''}`
  }

  // Overlay fades out once the video fires 'playing' (first frame painted).
  // Using opacity+pointer-events instead of conditional render keeps the
  // poster image visible during the browser's decoder warm-up period.
  const overlayVisible = !streamUrl || !videoCanPlay

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <div className="relative w-full aspect-video">

        {/* Video element — mounted once streamUrl is ready, never removed on transient errors.
             poster= shows the backdrop while the browser's codec initialises,
             eliminating the black flash between overlay fade-out and first frame. */}
        {streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            poster={posterSrc ?? undefined}
            className="w-full h-full"
            autoPlay
            playsInline
            onError={() => {
              const count = videoErrorCount + 1
              setVideoErrorCount(count)
              // If preload is already 100% and it still errors = bad codec/format, skip immediately.
              // Otherwise retry once (transient network hiccup), then skip on second error.
              if (count >= 2 || preloadPct >= 100) {
                tryNextStream()
              } else {
                const v = videoRef.current
                if (v) { v.load(); v.play().catch(() => {}) }
              }
            }}
          />
        )}

        {/* Loading overlay — always in DOM, fades out on 'playing' via opacity.
             This prevents a black flash: the poster is visible through the overlay
             during the 600ms fade, by which time the video is already rendering. */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black z-10 transition-opacity duration-700 ${overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {posterSrc && (
            <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
          )}
            <div className="relative flex flex-col items-center gap-4 px-6 text-center max-w-sm w-full">
              {streamError ? (
                <>
                  <p className="text-red-400 text-sm">{streamError}</p>
                  <button
                    onClick={retryCurrentStream}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg cursor-pointer"
                  >
                    Retry
                  </button>
                </>
              ) : streamsLoading ? (
                <>
                  <div className="w-10 h-10 border-3 border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
                  <p className="text-white/70 text-sm">Finding streams…</p>
                </>
              ) : !selectedQuality ? (
                // ── Quality picker ──
                <div className="flex flex-col items-center gap-5 px-4 text-center w-full max-w-sm">
                  <div>
                    <p className="text-white font-semibold text-base">{title}</p>
                    {mediaType === 'tv' && season && episode && (
                      <p className="text-white/50 text-xs mt-0.5">S{season} E{episode}</p>
                    )}
                  </div>
                  <p className="text-white/60 text-sm">Select quality</p>
                  <div className="flex flex-wrap gap-3 justify-center w-full">
                    {[...new Map(streams.map((s) => [s.quality, s])).entries()]
                      .sort(([a], [b]) => (QUALITY_ORDER[b] ?? 0) - (QUALITY_ORDER[a] ?? 0))
                      .map(([quality]) => {
                        const group = streams.filter((s) => s.quality === quality)
                        const maxSeeds = Math.max(...group.map((s) => s.seeds))
                        return (
                          <button
                            key={quality}
                            onClick={() => pickQuality(quality)}
                            className="flex flex-col items-center gap-1 px-5 py-3 bg-white/10 hover:bg-[var(--st-accent)]/80 border border-white/20 hover:border-[var(--st-accent)] rounded-xl cursor-pointer transition-colors min-w-[88px]"
                          >
                            <span className="text-white font-bold text-base">{quality}</span>
                            <span className="text-white/50 text-xs">{group.length} source{group.length !== 1 ? 's' : ''}</span>
                            {maxSeeds > 0 && <span className="text-white/40 text-xs">↑ {maxSeeds} seeds</span>}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 border-[3px] border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
                  <p className="text-white/90 text-sm font-medium">{loadingLabel()}</p>
                  {selectedStream && (
                    <p className="text-white/50 text-xs">
                      {selectedStream.quality} · {selectedStream.size}
                      {streams.length > 1 && ` · source ${streamIndex + 1} / ${streams.length}`}
                    </p>
                  )}

                  {/* Preload progress bar */}
                  {streamPhase === 'ready' && preloadTotal > 0 && (
                    <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--st-accent)] transition-all duration-500"
                        style={{ width: `${preloadPct}%` }}
                      />
                    </div>
                  )}

                  {/* Elapsed time + manual next-source button */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/30 text-xs">{waitSeconds}s</span>
                    {streams.length > 1 && streamIndex < streams.length - 1 && (
                      <button
                        onClick={tryNextStream}
                        className="text-xs text-white/60 hover:text-white underline cursor-pointer"
                      >
                        Try next source
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        {/* Subtitle overlay */}
        {streamUrl && videoCanPlay && activeCue && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-16 z-20">
            <div
              className="bg-black/75 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
              style={{ textShadow: '1px 1px 2px black' }}
              dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
            />
          </div>
        )}

        {/* Player controls overlay — only when video is ready */}
        {streamUrl && videoCanPlay && (
          <div
            className={`absolute inset-0 transition-opacity duration-300 z-20 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
            onMouseMove={resetHideTimer}
            onMouseEnter={resetHideTimer}
            onClick={(e) => { if ((e.target as HTMLElement).tagName === 'DIV') togglePlay() }}
          >
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-12 pb-3">
              {/* Seek bar */}
              <input
                type="range" min={0} max={duration || 0} step={0.5} value={currentTime}
                onChange={seek} onClick={(e) => e.stopPropagation()}
                className="w-full h-1 mb-3 cursor-pointer accent-[var(--st-accent)]"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="text-white hover:text-[var(--st-accent)] cursor-pointer">
                    {playing
                      ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                      : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                  </button>
                  {/* Mute */}
                  <button onClick={(e) => { e.stopPropagation(); toggleMute() }} className="text-white hover:text-white/80 cursor-pointer">
                    {muted || volume === 0
                      ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                      : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); handleVolumeChange(e) }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 h-1 cursor-pointer accent-white"
                  />
                  <span className="text-white text-xs tabular-nums hidden sm:block">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Quality picker */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowQualityPicker((v) => !v) }}
                      className="text-xs text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded cursor-pointer"
                    >
                      {streams[streamIndex]?.quality ?? 'Quality'}
                    </button>
                    {showQualityPicker && (
                      <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 z-30 w-44 max-h-60 overflow-y-auto shadow-xl">
                        {streams.map((s, i) => (
                          <button
                            key={s.hash}
                            onClick={(e) => { e.stopPropagation(); setSelectedQuality(s.quality); setStreamIndex(i); startStream(streams, i); setShowQualityPicker(false) }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 cursor-pointer ${i === streamIndex ? 'text-[var(--st-accent)]' : 'text-white'}`}
                          >
                            {s.quality} · {s.size}
                            <span className="text-white/40 ml-1">({s.seeds}↑)</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtitles — two-level menu: language → track list */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubsOpen((v) => !v); setSubView('lang') }}
                      className={`text-xs px-2 py-1 rounded cursor-pointer ${activeTrack ? 'text-[var(--st-accent)]' : 'text-white bg-white/10 hover:bg-white/20'}`}
                    >
                      CC
                    </button>
                    {subsOpen && (
                      <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg z-30 w-52 max-h-72 overflow-y-auto shadow-xl">

                        {/* ── Level 1: Language picker ── */}
                        {subView === 'lang' && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider border-b border-[var(--st-border)]">
                              Subtitle language
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); selectSubtitleTrack(null); setSubLang(''); setSubsOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}
                            >
                              Off
                            </button>
                            {LANGUAGES.map((lang) => (
                              <button
                                key={lang.code}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSubView('tracks')
                                  fetchSubtitles(lang.code) // fetches tracks, does NOT close menu
                                }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer flex items-center justify-between ${subLang === lang.code ? 'text-[var(--st-accent)]' : 'text-white'}`}
                              >
                                <span>{lang.label}</span>
                                <span className="text-white/30">›</span>
                              </button>
                            ))}
                          </>
                        )}

                        {/* ── Level 2: Track list for selected language ── */}
                        {subView === 'tracks' && (
                          <>
                            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--st-border)]">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSubView('lang') }}
                                className="text-white/50 hover:text-white text-xs cursor-pointer px-1"
                              >
                                ←
                              </button>
                              <span className="text-[10px] text-white/50 uppercase tracking-wider">
                                {LANGUAGES.find((l) => l.code === subLang)?.label ?? subLang}
                              </span>
                            </div>

                            {subtitleLoading && (
                              <div className="px-3 py-3 text-xs text-white/50 flex items-center gap-2">
                                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                Searching…
                              </div>
                            )}

                            {!subtitleLoading && tracks.length === 0 && !subtitleError && (
                              <div className="px-3 py-3 text-xs text-white/40">No subtitles found</div>
                            )}
                            {!subtitleLoading && subtitleError && (
                              <div className="px-3 py-3 text-xs text-red-400 leading-relaxed">{subtitleError}</div>
                            )}

                            {!subtitleLoading && tracks.length > 0 && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); selectSubtitleTrack(null); setSubsOpen(false) }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}
                                >
                                  Off
                                </button>
                                {tracks.map((t) => (
                                  <button
                                    key={t.fileId}
                                    onClick={(e) => { e.stopPropagation(); selectSubtitleTrack(t) }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer leading-tight ${activeTrack?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'}`}
                                  >
                                    {t.releaseName.slice(0, 34) || t.languageName}
                                  </button>
                                ))}
                                {subtitleError && (
                                  <div className="px-3 py-2 text-xs text-red-400 border-t border-[var(--st-border)]">{subtitleError}</div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen */}
                  <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="text-white hover:text-white/80 cursor-pointer">
                    {fullscreen
                      ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                      : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>}
                  </button>
                </div>
              </div>
            </div>

            {(showQualityPicker || subsOpen) && (
              <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setShowQualityPicker(false); setSubsOpen(false) }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
