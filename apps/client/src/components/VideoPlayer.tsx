import { useRef, useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type { TorrentOption, SubtitleTrack, SubtitleCue } from '@streamtime/shared'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

const PRELOAD_TIMEOUT      = 30
const NO_PEERS_TIMEOUT     = 10
const SLOW_SPEED_TIMEOUT   = 15
const SLOW_SPEED_THRESHOLD = 200 * 1024  // 200 KB/s

const QUALITY_ORDER: Record<string, number> = { '2160p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1 }

const QUALITY_BADGE: Record<string, string> = {
  '2160p': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  '1080p': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  '720p':  'bg-green-500/20 text-green-300 border-green-500/30',
  '480p':  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  '360p':  'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

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

function parseVtt(vtt: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.trim().split('\n')
    const timeLine = lines.find(l => l.includes('-->'))
    if (!timeLine) continue
    const [s, e] = timeLine.split('-->')
    const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim()
    if (text) cues.push({ start: parseTime(s.trim()), end: parseTime(e.trim()), text })
  }
  return cues
}

function parseTime(s: string): number {
  const parts = s.replace(',', '.').split(':')
  return parts.length === 3
    ? +parts[0] * 3600 + +parts[1] * 60 + +parts[2]
    : +parts[0] * 60 + +parts[1]
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

function fmtSpeed(bps: number) {
  return bps < 1_048_576 ? `${(bps/1024).toFixed(0)} KB/s` : `${(bps/1_048_576).toFixed(1)} MB/s`
}

interface Props {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  imdbId: string
  season?: number
  episode?: number
  backdropPath?: string | null
  posterPath?: string | null
}

export function VideoPlayer({ tmdbId, mediaType, title, imdbId, season, episode, backdropPath, posterPath }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Streams
  const [streams, setStreams]           = useState<TorrentOption[]>([])
  const [streamsLoading, setStreamsLoading] = useState(true)
  const [activeIdx, setActiveIdx]       = useState(0)
  const activeIdxRef                    = useRef(0)
  const activeStreamRef                 = useRef<TorrentOption | null>(null)

  // Quality filter tab
  const [qualityFilter, setQualityFilter] = useState<string>('all')

  // Polling state
  const [streamUrl, setStreamUrl]       = useState<string | null>(null)
  const streamUrlRef                    = useRef<string | null>(null)
  const [streamPhase, setStreamPhase]   = useState<'waiting'|'connecting'|'ready'>('waiting')
  const [peers, setPeers]               = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [preloadBytes, setPreloadBytes] = useState(0)
  const [preloadTotal, setPreloadTotal] = useState(5 * 1024 * 1024)
  const [streamError, setStreamError]   = useState<string | null>(null)
  const waitRef    = useRef(0)
  const peersRef   = useRef(0)
  const speedRef   = useRef(0)

  // Video
  const [videoCanPlay, setVideoCanPlay] = useState(false)
  const [errCount, setErrCount]         = useState(0)
  const [playing, setPlaying]           = useState(false)
  const [currentTime, setCurrentTime]   = useState(0)
  const [duration, setDuration]         = useState(0)
  const [volume, setVolume]             = useState(1)
  const [muted, setMuted]               = useState(false)
  const [fullscreen, setFullscreen]     = useState(false)
  const [ctrlVisible, setCtrlVisible]   = useState(true)

  // Subtitles
  const [subsOpen, setSubsOpen]               = useState(false)
  const [subView, setSubView]                 = useState<'lang'|'tracks'>('lang')
  const [subLang, setSubLang]                 = useState('')
  const [tracks, setTracks]                   = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrack]         = useState<SubtitleTrack | null>(null)
  const [cues, setCues]                       = useState<SubtitleCue[]>([])
  const [activeCue, setActiveCue]             = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)
  const [subtitleError, setSubtitleError]     = useState<string | null>(null)

  // ── Fetch streams ────────────────────────────────────────────────────────────
  useEffect(() => {
    setStreamsLoading(true)
    setStreams([])
    setActiveIdx(0); activeIdxRef.current = 0
    activeStreamRef.current = null
    setStreamUrl(null); streamUrlRef.current = null
    setStreamPhase('waiting')
    setStreamError(null)
    waitRef.current = 0
    setVideoCanPlay(false); setErrCount(0)
    setQualityFilter('all')

    const p: Record<string, string> = { imdb_id: imdbId, type: mediaType }
    if (mediaType === 'tv' && season)  p.season  = String(season)
    if (mediaType === 'tv' && episode) p.episode = String(episode)

    api.get<{ torrents: TorrentOption[] }>('/api/stream/torrents', { params: p })
      .then(r => {
        const list = r.data.torrents
        if (!list.length) { setStreamError('No streams found.'); return }
        const sorted = [...list].sort((a, b) => {
          const qd = (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0)
          return qd !== 0 ? qd : b.seeds - a.seeds
        })
        setStreams(sorted)
        // Auto-start best source immediately
        doStartStream(sorted, 0)
      })
      .catch(() => setStreamError('Failed to fetch streams.'))
      .finally(() => setStreamsLoading(false))
  }, [imdbId, mediaType, season, episode])

  function doStartStream(list: TorrentOption[], idx: number) {
    const stream = list[idx]
    if (!stream) { setStreamError('No more sources available.'); return }
    activeIdxRef.current = idx
    activeStreamRef.current = stream
    setActiveIdx(idx)
    setStreamUrl(null); streamUrlRef.current = null
    setStreamPhase('waiting')
    setPeers(0); setDownloadSpeed(0); setPreloadBytes(0)
    setStreamError(null)
    waitRef.current = 0
    setVideoCanPlay(false); setErrCount(0)
    peersRef.current = 0; speedRef.current = 0
    // Prewarm this + next 2
    api.post('/api/stream/prewarm', { magnet: stream.magnet, fileIdx: stream.fileIdx }).catch(() => {})
    for (const s of list.slice(idx + 1, idx + 3)) {
      api.post('/api/stream/prewarm', { magnet: s.magnet, fileIdx: s.fileIdx }).catch(() => {})
    }
  }

  // ── Timeout auto-skip ─────────────────────────────────────────────────────
  useEffect(() => {
    if (streamUrl || streamError || streamsLoading) return
    waitRef.current = 0
    const iv = setInterval(() => {
      waitRef.current++
      const t = waitRef.current, p = peersRef.current, sp = speedRef.current
      const skip = t >= PRELOAD_TIMEOUT
        || (t >= NO_PEERS_TIMEOUT && p === 0)
        || (t >= SLOW_SPEED_TIMEOUT && p > 0 && sp < SLOW_SPEED_THRESHOLD)
      if (skip) {
        clearInterval(iv)
        const next = activeIdxRef.current + 1
        setStreams(s => { doStartStream(s, next); return s })
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [activeStreamRef.current, streamUrl, streamError, streamsLoading])

  // ── Poll status (1s) ──────────────────────────────────────────────────────
  useEffect(() => {
    const stream = activeStreamRef.current
    if (!stream || streamUrlRef.current) return
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const r = await api.get('/api/stream/status', {
          params: { magnet: stream.magnet, fileIdx: stream.fileIdx },
        })
        if (cancelled) return
        const s = r.data
        setStreamPhase(s.phase)
        peersRef.current = s.peers; setPeers(s.peers)
        speedRef.current = s.downloadSpeed; setDownloadSpeed(s.downloadSpeed)
        setPreloadBytes(s.preloadBytes); setPreloadTotal(s.preloadTotal)
        if (s.preloadDone && !streamUrlRef.current) {
          const qs = new URLSearchParams({ magnet: stream.magnet })
          if (stream.fileIdx !== undefined) qs.set('fileIdx', String(stream.fileIdx))
          const url = `${API_BASE}/api/stream/watch?${qs}`
          streamUrlRef.current = url
          setStreamUrl(url)
        }
      } catch {}
      if (!cancelled && !streamUrlRef.current) setTimeout(poll, 1000) // 1s interval
    }
    const t = setTimeout(poll, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [activeStreamRef.current])

  // ── Video element events ─────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const onPlay    = () => setPlaying(true)
    const onPause   = () => setPlaying(false)
    const onTime    = () => setCurrentTime(v.currentTime)
    const onDur     = () => setDuration(v.duration)
    const onVol     = () => { setVolume(v.volume); setMuted(v.muted) }
    const onFs      = () => setFullscreen(!!document.fullscreenElement)
    const onPlaying = () => setVideoCanPlay(true)
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime); v.addEventListener('durationchange', onDur)
    v.addEventListener('volumechange', onVol); v.addEventListener('playing', onPlaying)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime); v.removeEventListener('durationchange', onDur)
      v.removeEventListener('volumechange', onVol); v.removeEventListener('playing', onPlaying)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [streamUrl])

  // ── Auto-skip if video never starts (codec issue) ────────────────────────
  useEffect(() => {
    if (!streamUrl || videoCanPlay) return
    const t = setTimeout(() => {
      const next = activeIdxRef.current + 1
      setStreams(s => { doStartStream(s, next); return s })
    }, 6000)
    return () => clearTimeout(t)
  }, [streamUrl, videoCanPlay])

  // ── Subtitle cue (real currentTime) ──────────────────────────────────────
  useEffect(() => {
    if (!cues.length) return
    setActiveCue(cues.find(c => currentTime >= c.start && currentTime <= c.end)?.text ?? null)
  }, [currentTime, cues])

  // ── Controls hide timer ───────────────────────────────────────────────────
  const resetHide = useCallback(() => {
    setCtrlVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setCtrlVisible(false), 3000)
  }, [])
  useEffect(() => { resetHide() }, [])

  // ── Player controls ───────────────────────────────────────────────────────
  function togglePlay() { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause() }
  function seek(e: React.ChangeEvent<HTMLInputElement>) { const v = videoRef.current; if (v) v.currentTime = +e.target.value }
  function changeVol(e: React.ChangeEvent<HTMLInputElement>) { const v = videoRef.current; if (v) { v.volume = +e.target.value; v.muted = false } }
  function toggleMute() { const v = videoRef.current; if (v) v.muted = !v.muted }
  function toggleFs() { if (document.fullscreenElement) document.exitFullscreen(); else (containerRef.current ?? videoRef.current)?.requestFullscreen?.() }

  function tryNext() {
    const next = activeIdxRef.current + 1
    if (next >= streams.length) { setStreamError('All sources tried.'); return }
    doStartStream(streams, next)
  }

  // ── Subtitles ─────────────────────────────────────────────────────────────
  const fetchSubs = useCallback(async (lang: string) => {
    setSubLang(lang); setSubtitleLoading(true)
    setTracks([]); setActiveTrack(null); setCues([]); setActiveCue(null); setSubtitleError(null)
    try {
      const p = new URLSearchParams({ imdb_id: imdbId, type: mediaType, languages: lang })
      if (mediaType === 'tv' && season)  p.set('season',  String(season))
      if (mediaType === 'tv' && episode) p.set('episode', String(episode))
      const r = await fetch(`/api/subtitles/search?${p}`)
      const body = await r.json().catch(() => [])
      if (!r.ok) throw new Error((body as any)?.error ?? `Search ${r.status}`)
      setTracks(body as SubtitleTrack[])
    } catch (e: any) {
      setSubtitleError(e?.message ?? 'Search failed'); setSubView('tracks')
    } finally { setSubtitleLoading(false) }
  }, [imdbId, mediaType, season, episode])

  async function selectTrack(t: SubtitleTrack | null) {
    if (!t) { setActiveTrack(null); setCues([]); setActiveCue(null); setSubtitleError(null); return }
    setActiveTrack(t); setSubtitleError(null)
    try {
      const r = await fetch(`/api/subtitles/download/${t.fileId}`)
      if (!r.ok) { const e = await r.json().catch(() => ({})) as any; throw new Error(e?.error ?? `HTTP ${r.status}`) }
      setCues(parseVtt(await r.text()))
      setSubsOpen(false)
    } catch (e: any) { setSubtitleError(e?.message ?? 'Download failed'); setCues([]) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const preloadPct   = preloadTotal > 0 ? Math.round((preloadBytes / preloadTotal) * 100) : 0
  const overlayShow  = !streamUrl || !videoCanPlay
  const activeStream = streams[activeIdx] ?? null
  const posterSrc    = backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null

  const qualities = [...new Set(streams.map(s => s.quality))]
    .sort((a, b) => (QUALITY_ORDER[b] ?? 0) - (QUALITY_ORDER[a] ?? 0))
  const displayed = qualityFilter === 'all' ? streams : streams.filter(s => s.quality === qualityFilter)

  function loadingLabel() {
    if (streamsLoading) return 'Finding streams…'
    if (streamPhase === 'waiting') return 'Connecting to trackers…'
    if (streamPhase === 'connecting') return `Finding peers… ${peers > 0 ? `(${peers} found)` : ''}`
    if (peers === 0) return 'Waiting for peers…'
    return `Buffering ${preloadPct}% · ${fmtSpeed(downloadSpeed)} · ${peers} peer${peers !== 1 ? 's' : ''}`
  }

  return (
    <div className="w-full bg-black">

      {/* ── Video area ── */}
      <div ref={containerRef} className="relative w-full aspect-video bg-black">

        {streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            poster={posterSrc ?? undefined}
            className="w-full h-full"
            autoPlay playsInline
            onError={() => {
              const c = errCount + 1; setErrCount(c)
              if (c >= 2 || preloadPct >= 100) tryNext()
              else { videoRef.current?.load(); videoRef.current?.play().catch(() => {}) }
            }}
          />
        )}

        {/* Loading / error overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black z-10 transition-opacity duration-700 ${overlayShow ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {posterSrc && <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
          <div className="relative flex flex-col items-center gap-4 px-6 text-center max-w-sm w-full">
            {streamError ? (
              <>
                <p className="text-red-400 text-sm">{streamError}</p>
                <button onClick={() => doStartStream(streams, activeIdxRef.current)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg cursor-pointer">Retry</button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 border-[3px] border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
                <p className="text-white/90 text-sm font-medium">{loadingLabel()}</p>
                {activeStream && (
                  <p className="text-white/40 text-xs">{activeStream.quality} · {activeStream.size} · source {activeIdx + 1}/{streams.length}</p>
                )}
                {streamPhase === 'ready' && preloadTotal > 0 && (
                  <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--st-accent)] transition-all duration-500" style={{ width: `${preloadPct}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Subtitle overlay */}
        {streamUrl && videoCanPlay && activeCue && (
          <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none z-20">
            <div
              className="bg-black/80 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
              style={{ textShadow: '1px 1px 2px black' }}
              dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
            />
          </div>
        )}

        {/* Player controls */}
        {streamUrl && videoCanPlay && (
          <div
            className={`absolute inset-0 transition-opacity duration-300 z-20 ${ctrlVisible ? 'opacity-100' : 'opacity-0'}`}
            onMouseMove={resetHide} onMouseEnter={resetHide}
            onClick={e => { if ((e.target as HTMLElement).tagName === 'DIV') togglePlay() }}
          >
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-10 pb-3">
              <input type="range" min={0} max={duration || 0} step={0.5} value={currentTime}
                onChange={seek} onClick={e => e.stopPropagation()}
                className="w-full h-1 mb-3 cursor-pointer accent-[var(--st-accent)]" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={e => { e.stopPropagation(); togglePlay() }} className="text-white hover:text-[var(--st-accent)] cursor-pointer">
                    {playing
                      ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleMute() }} className="text-white hover:text-white/80 cursor-pointer">
                    {muted || volume === 0
                      ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                      : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>}
                  </button>
                  <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                    onChange={e => { e.stopPropagation(); changeVol(e) }} onClick={e => e.stopPropagation()}
                    className="w-20 h-1 cursor-pointer accent-white" />
                  <span className="text-white text-xs tabular-nums hidden sm:block">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* CC button */}
                  <div className="relative">
                    <button onClick={e => { e.stopPropagation(); setSubsOpen(v => !v); setSubView('lang') }}
                      className={`text-xs px-2 py-1 rounded cursor-pointer ${activeTrack ? 'text-[var(--st-accent)]' : 'text-white bg-white/10 hover:bg-white/20'}`}>
                      CC
                    </button>
                    {subsOpen && (
                      <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg z-30 w-52 max-h-72 overflow-y-auto shadow-xl">
                        {subView === 'lang' && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider border-b border-[var(--st-border)]">Language</div>
                            <button onClick={e => { e.stopPropagation(); selectTrack(null); setSubLang(''); setSubsOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}>Off</button>
                            {LANGUAGES.map(l => (
                              <button key={l.code} onClick={e => { e.stopPropagation(); setSubView('tracks'); fetchSubs(l.code) }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer flex justify-between ${subLang === l.code ? 'text-[var(--st-accent)]' : 'text-white'}`}>
                                <span>{l.label}</span><span className="text-white/30">›</span>
                              </button>
                            ))}
                          </>
                        )}
                        {subView === 'tracks' && (
                          <>
                            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--st-border)]">
                              <button onClick={e => { e.stopPropagation(); setSubView('lang') }} className="text-white/50 hover:text-white text-xs cursor-pointer px-1">←</button>
                              <span className="text-[10px] text-white/50 uppercase">{LANGUAGES.find(l => l.code === subLang)?.label ?? subLang}</span>
                            </div>
                            {subtitleLoading && <div className="px-3 py-3 text-xs text-white/50 flex gap-2 items-center"><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>Searching…</div>}
                            {!subtitleLoading && !subtitleError && tracks.length === 0 && <div className="px-3 py-3 text-xs text-white/40">No subtitles found</div>}
                            {!subtitleLoading && subtitleError && <div className="px-3 py-3 text-xs text-red-400">{subtitleError}</div>}
                            {!subtitleLoading && tracks.length > 0 && (
                              <>
                                <button onClick={e => { e.stopPropagation(); selectTrack(null); setSubsOpen(false) }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}>Off</button>
                                {tracks.map(t => (
                                  <button key={t.fileId} onClick={e => { e.stopPropagation(); selectTrack(t) }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer leading-tight ${activeTrack?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'}`}>
                                    {t.releaseName.slice(0, 36) || t.languageName}
                                  </button>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Fullscreen */}
                  <button onClick={e => { e.stopPropagation(); toggleFs() }} className="text-white hover:text-white/80 cursor-pointer">
                    {fullscreen
                      ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                      : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>}
                  </button>
                </div>
              </div>
            </div>
            {subsOpen && <div className="fixed inset-0 z-20" onClick={e => { e.stopPropagation(); setSubsOpen(false) }}/>}
          </div>
        )}
      </div>

      {/* ── Source panel ── */}
      <div className="bg-[var(--st-surface)] border-t border-[var(--st-border)]">

        {/* Quality filter tabs */}
        {qualities.length > 1 && (
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto">
            <button
              onClick={() => setQualityFilter('all')}
              className={`shrink-0 text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${qualityFilter === 'all' ? 'bg-[var(--st-accent)]/20 text-[var(--st-accent)] border-[var(--st-accent)]/40' : 'text-white/50 border-white/20 hover:border-white/40'}`}
            >
              All ({streams.length})
            </button>
            {qualities.map(q => (
              <button key={q}
                onClick={() => { setQualityFilter(q); const first = streams.findIndex(s => s.quality === q); if (first !== -1 && first !== activeIdx) doStartStream(streams, first) }}
                className={`shrink-0 text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${qualityFilter === q ? 'bg-[var(--st-accent)]/20 text-[var(--st-accent)] border-[var(--st-accent)]/40' : 'text-white/50 border-white/20 hover:border-white/40'}`}
              >
                {q} ({streams.filter(s => s.quality === q).length})
              </button>
            ))}
          </div>
        )}

        {/* Source list */}
        <div className="max-h-52 overflow-y-auto divide-y divide-[var(--st-border)]">
          {streamsLoading && (
            <div className="px-4 py-3 text-xs text-white/40 flex gap-2 items-center">
              <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin"/>Finding streams…
            </div>
          )}
          {displayed.map((s) => {
            const idx = streams.indexOf(s)
            const isActive = idx === activeIdx
            return (
              <button
                key={s.hash ?? `${s.magnet.slice(0,20)}-${idx}`}
                onClick={() => doStartStream(streams, idx)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors ${isActive ? 'bg-white/5' : ''}`}
              >
                {/* Quality badge */}
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${QUALITY_BADGE[s.quality] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
                  {s.quality}
                </span>
                {/* Name */}
                <span className={`flex-1 text-xs truncate ${isActive ? 'text-white' : 'text-white/60'}`}>
                  {s.source || s.filename || 'Unknown'}
                </span>
                {/* Seeds */}
                <span className="shrink-0 text-[11px] text-white/40">{s.seeds}↑</span>
                {/* Size */}
                <span className="shrink-0 text-[11px] text-white/30 hidden sm:block">{s.size}</span>
                {/* Status */}
                {isActive && (
                  <span className={`shrink-0 text-[11px] font-medium ${videoCanPlay ? 'text-green-400' : streamUrl ? 'text-yellow-400' : 'text-white/50'}`}>
                    {videoCanPlay ? '● Playing' : streamUrl ? '● Ready' : streamError ? '✕' : '…'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
