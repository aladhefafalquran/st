import { useRef, useState, useEffect, useCallback } from 'react'
import { api, tmdbImg } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { TorrentOption, SubtitleTrack, SubtitleCue } from '@streamtime/shared'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

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
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
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

  // Torrent state
  const [streams, setStreams] = useState<TorrentOption[]>([])
  const [streamsLoading, setStreamsLoading] = useState(true)
  const [selectedStream, setSelectedStream] = useState<TorrentOption | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [streamPhase, setStreamPhase] = useState<'waiting' | 'connecting' | 'ready'>('waiting')
  const [peers, setPeers] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [preloadDone, setPreloadDone] = useState(false)
  const [preloadBytes, setPreloadBytes] = useState(0)
  const [preloadTotal, setPreloadTotal] = useState(5 * 1024 * 1024)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [showQualityPicker, setShowQualityPicker] = useState(false)
  const [streamIndex, setStreamIndex] = useState(0)

  // Player controls state
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subtitle state
  const [subsOpen, setSubsOpen] = useState(false)
  const [subLang, setSubLang] = useState('')
  const [tracks, setTracks] = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrack] = useState<SubtitleTrack | null>(null)
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [activeCue, setActiveCue] = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)

  // Watch history
  const watchStartRef = useRef<number>(Date.now())

  // ----- Fetch available streams -----
  useEffect(() => {
    setStreamsLoading(true)
    setStreams([])
    setSelectedStream(null)
    setStreamUrl(null)
    setStreamPhase('waiting')
    setStreamError(null)
    setStreamIndex(0)

    const params: Record<string, string> = { imdb_id: imdbId, type: mediaType }
    if (mediaType === 'tv' && season) params.season = String(season)
    if (mediaType === 'tv' && episode) params.episode = String(episode)

    api.get<{ torrents: TorrentOption[] }>('/api/stream/torrents', { params })
      .then((r) => {
        setStreams(r.data.torrents)
        if (r.data.torrents.length > 0) {
          pickStream(r.data.torrents, 0)
        } else {
          setStreamError('No streams found for this title.')
        }
      })
      .catch(() => setStreamError('Failed to fetch streams. Check your connection.'))
      .finally(() => setStreamsLoading(false))
  }, [imdbId, mediaType, season, episode])

  function pickStream(list: TorrentOption[], idx: number) {
    const stream = list[idx]
    if (!stream) { setStreamError('No more streams available.'); return }
    setSelectedStream(stream)
    setStreamPhase('waiting')
    setPeers(0)
    setDownloadSpeed(0)
    setPreloadDone(false)
    setPreloadBytes(0)
    setStreamUrl(null)
    setStreamError(null)

    // Fire prewarm
    api.post('/api/stream/prewarm', { magnet: stream.magnet, fileIdx: stream.fileIdx }).catch(() => {})
  }

  // ----- Poll status until ready -----
  useEffect(() => {
    if (!selectedStream || streamUrl) return

    let cancelled = false

    const poll = async () => {
      if (cancelled || !selectedStream) return
      try {
        const r = await api.get('/api/stream/status', {
          params: { magnet: selectedStream.magnet, fileIdx: selectedStream.fileIdx },
        })
        const s = r.data
        if (cancelled) return
        setStreamPhase(s.phase)
        setPeers(s.peers)
        setDownloadSpeed(s.downloadSpeed)
        setPreloadDone(s.preloadDone)
        setPreloadBytes(s.preloadBytes)
        setPreloadTotal(s.preloadTotal)

        if (s.preloadDone || (s.phase === 'ready' && s.peers > 0)) {
          // Ready to stream
          const qs = new URLSearchParams({ magnet: selectedStream.magnet })
          if (selectedStream.fileIdx !== undefined) qs.set('fileIdx', String(selectedStream.fileIdx))
          setStreamUrl(`${API_BASE}/api/stream/watch?${qs}`)
        }
      } catch {
        // ignore poll errors
      }

      if (!cancelled && !streamUrl) {
        setTimeout(poll, 2000)
      }
    }

    const t = setTimeout(poll, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [selectedStream, streamUrl])

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

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('durationchange', onDuration)
    v.addEventListener('volumechange', onVolume)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('durationchange', onDuration)
      v.removeEventListener('volumechange', onVolume)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [streamUrl])

  // ----- Watch history -----
  useEffect(() => {
    watchStartRef.current = Date.now()
  }, [tmdbId, season, episode])

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
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Number(e.target.value)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current
    if (!v) return
    v.volume = Number(e.target.value)
    v.muted = false
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      const el = containerRef.current ?? videoRef.current
      el?.requestFullscreen?.()
    }
  }

  const fetchSubtitles = useCallback(async (lang: string) => {
    setSubLang(lang)
    setSubtitleLoading(true)
    setTracks([])
    setActiveTrack(null)
    setCues([])
    setActiveCue(null)
    try {
      const r = await api.get('/api/subtitles/search', {
        params: { imdb_id: imdbId, type: mediaType, languages: lang },
      })
      const list: SubtitleTrack[] = r.data
      setTracks(list)
      if (list.length > 0) await selectSubtitleTrack(list[0])
    } finally {
      setSubtitleLoading(false)
    }
  }, [imdbId, mediaType])

  async function selectSubtitleTrack(track: SubtitleTrack | null) {
    if (!track) { setActiveTrack(null); setCues([]); setActiveCue(null); return }
    setActiveTrack(track)
    try {
      const r = await api.get(`/api/subtitles/download/${track.fileId}`, { responseType: 'text' })
      setCues(parseVtt(r.data))
    } catch { setCues([]) }
  }

  // Try next stream on error
  function tryNextStream() {
    const next = streamIndex + 1
    setStreamIndex(next)
    pickStream(streams, next)
  }

  const posterSrc = backdropPath ? tmdbImg(backdropPath, 'w1280') : posterPath ? tmdbImg(posterPath, 'w500') : null

  // Loading progress percentage
  const preloadPct = preloadTotal > 0 ? Math.round((preloadBytes / preloadTotal) * 100) : 0

  function phaseLabel(): string {
    if (streamPhase === 'waiting') return 'Connecting to torrent…'
    if (streamPhase === 'connecting') {
      return `Fetching metadata… (${peers} peers)`
    }
    if (preloadDone) return 'Starting playback…'
    return `Buffering ${preloadPct}% (${formatSpeed(downloadSpeed)}, ${peers} peers)`
  }

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <div className="relative w-full aspect-video">

        {/* Video element — only rendered once stream URL is ready */}
        {streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            className="w-full h-full"
            autoPlay
            playsInline
            crossOrigin="use-credentials"
            onError={() => {
              if (streamIndex < streams.length - 1) tryNextStream()
              else setStreamError('Playback failed. All sources exhausted.')
            }}
          />
        )}

        {/* Loading / fetching overlay */}
        {!streamUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            {posterSrc && (
              <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            )}
            <div className="relative flex flex-col items-center gap-4 px-6 text-center">
              {streamError ? (
                <>
                  <p className="text-red-400 text-sm">{streamError}</p>
                  {streamIndex < streams.length - 1 && (
                    <button
                      onClick={tryNextStream}
                      className="px-4 py-2 bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white text-sm rounded-lg cursor-pointer"
                    >
                      Try next source
                    </button>
                  )}
                </>
              ) : streamsLoading ? (
                <>
                  <div className="w-12 h-12 border-4 border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
                  <p className="text-white/70 text-sm">Finding streams…</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 border-4 border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
                  <p className="text-white/80 text-sm font-medium">{phaseLabel()}</p>
                  {selectedStream && (
                    <p className="text-white/50 text-xs">
                      {selectedStream.quality} · {selectedStream.size}
                      {streams.length > 1 && ` · Source ${streamIndex + 1}/${streams.length}`}
                    </p>
                  )}
                  {/* Preload progress bar */}
                  {streamPhase === 'ready' && preloadTotal > 0 && !preloadDone && (
                    <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--st-accent)] transition-all duration-500"
                        style={{ width: `${preloadPct}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Subtitle overlay */}
        {streamUrl && activeCue && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-16">
            <div
              className="bg-black/75 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
              style={{ textShadow: '1px 1px 2px black' }}
              dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
            />
          </div>
        )}

        {/* Player controls overlay */}
        {streamUrl && (
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
            onMouseMove={resetHideTimer}
            onMouseEnter={resetHideTimer}
            onClick={(e) => {
              // click on backdrop toggles play, not on buttons
              if ((e.target as HTMLElement).tagName === 'DIV') togglePlay()
            }}
          >
            {/* Bottom gradient + controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-12 pb-3">
              {/* Seek bar */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.5}
                value={currentTime}
                onChange={seek}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 mb-3 cursor-pointer accent-[var(--st-accent)]"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="text-white hover:text-[var(--st-accent)] transition-colors cursor-pointer">
                    {playing ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Mute */}
                  <button onClick={(e) => { e.stopPropagation(); toggleMute() }} className="text-white hover:text-white/80 transition-colors cursor-pointer">
                    {muted || volume === 0 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                      </svg>
                    )}
                  </button>

                  {/* Volume slider */}
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); handleVolumeChange(e) }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 h-1 cursor-pointer accent-white"
                  />

                  {/* Time */}
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
                      {selectedStream?.quality ?? 'Quality'}
                    </button>
                    {showQualityPicker && (
                      <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 z-20 w-40 max-h-60 overflow-y-auto shadow-xl">
                        {streams.map((s, i) => (
                          <button
                            key={s.hash}
                            onClick={(e) => {
                              e.stopPropagation()
                              setStreamIndex(i)
                              pickStream(streams, i)
                              setShowQualityPicker(false)
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors cursor-pointer ${
                              i === streamIndex ? 'text-[var(--st-accent)]' : 'text-white'
                            }`}
                          >
                            {s.quality} · {s.size}
                            <span className="text-white/40 ml-1">({s.seeds} seeds)</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtitles */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubsOpen((v) => !v) }}
                      className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${activeTrack ? 'text-[var(--st-accent)]' : 'text-white bg-white/10 hover:bg-white/20'}`}
                    >
                      CC
                    </button>
                    {subsOpen && (
                      <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 z-20 w-48 max-h-60 overflow-y-auto shadow-xl">
                        <button
                          onClick={(e) => { e.stopPropagation(); selectSubtitleTrack(null); setSubLang(''); setSubsOpen(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}
                        >
                          Off
                        </button>
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={(e) => { e.stopPropagation(); fetchSubtitles(lang.code); setSubsOpen(false) }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 cursor-pointer ${subLang === lang.code ? 'text-[var(--st-accent)]' : 'text-white'}`}
                          >
                            {subtitleLoading && subLang === lang.code ? 'Loading…' : lang.label}
                          </button>
                        ))}
                        {tracks.map((t) => (
                          <button
                            key={t.fileId}
                            onClick={(e) => { e.stopPropagation(); selectSubtitleTrack(t); setSubsOpen(false) }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 cursor-pointer ${activeTrack?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'}`}
                          >
                            {t.releaseName.slice(0, 28) || t.languageName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen */}
                  <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="text-white hover:text-white/80 cursor-pointer">
                    {fullscreen ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Close quality/sub menus on outside click */}
            {(showQualityPicker || subsOpen) && (
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => { e.stopPropagation(); setShowQualityPicker(false); setSubsOpen(false) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
