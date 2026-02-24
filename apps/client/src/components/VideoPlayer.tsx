import { useRef, useState, useEffect, useCallback } from 'react'
import { api, tmdbImg } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { SubtitleTrack, SubtitleCue } from '@streamtime/shared'

type UrlBuilder = (tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number) => string

const SOURCES: { label: string; url: UrlBuilder }[] = [
  {
    label: 'VidSrc',
    url: (id, t, s, e) => t === 'tv'
      ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    label: 'VidSrc 2',
    url: (id, t, s, e) => t === 'tv'
      ? `https://vidsrc.me/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.me/embed/movie/${id}`,
  },
  {
    label: 'VidSrc 3',
    url: (id, t, s, e) => t === 'tv'
      ? `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
      : `https://vidsrc.xyz/embed/movie/${id}`,
  },
]

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'tr', label: 'Turkish' },
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
  const containerRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuthStore()

  const [sourceIdx, setSourceIdx] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Reset loaded state whenever source or episode changes
  useEffect(() => { setIframeLoaded(false) }, [sourceIdx, season, episode, tmdbId])

  const [subsOpen, setSubsOpen] = useState(false)
  const [subLang, setSubLang] = useState('')
  const [tracks, setTracks] = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrack] = useState<SubtitleTrack | null>(null)
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [activeCue, setActiveCue] = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)

  // Wall-clock subtitle timer (for subtitle sync only)
  const syncStartRef = useRef<number | null>(null)
  const [subTime, setSubTime] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => {
      if (syncStartRef.current !== null)
        setSubTime((Date.now() - syncStartRef.current) / 1000)
    }, 250)
    return () => clearInterval(tick)
  }, [])

  // Match active cue
  useEffect(() => {
    if (!cues.length) return
    const cue = cues.find((c) => subTime >= c.start && subTime <= c.end) ?? null
    setActiveCue(cue ? cue.text : null)
  }, [subTime, cues])

  // Watch-time tracker — starts immediately on mount, independent of subtitle sync
  const watchStartRef = useRef<number>(Date.now())
  useEffect(() => { watchStartRef.current = Date.now() }, [tmdbId, season, episode])

  // Save history record immediately when episode starts, then every 30s
  useEffect(() => {
    if (!isAuthenticated) return

    const save = () => {
      const progressSeconds = Math.round((Date.now() - watchStartRef.current) / 1000)
      api.post('/api/history', {
        tmdbId, mediaType, title,
        posterPath: posterPath ?? null,
        seasonNumber: season ?? null,
        episodeNumber: episode ?? null,
        progressSeconds,
        durationSeconds: 0,
      }).catch(() => {})
    }

    // Create the record right away so it appears in history immediately
    save()
    const iv = setInterval(save, 30000)
    return () => clearInterval(iv)
  }, [isAuthenticated, tmdbId, mediaType, title, posterPath, season, episode])

  const fetchTracks = useCallback(async (lang: string) => {
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
      if (list.length > 0) await selectTrack(list[0])
    } finally {
      setSubtitleLoading(false)
    }
  }, [imdbId, mediaType])

  async function selectTrack(track: SubtitleTrack | null) {
    if (!track) { setActiveTrack(null); setCues([]); setActiveCue(null); return }
    setActiveTrack(track)
    try {
      const r = await api.get(`/api/subtitles/download/${track.fileId}`, { responseType: 'text' })
      setCues(parseVtt(r.data))
    } catch { setCues([]) }
  }

  function handleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  const iframeSrc = SOURCES[sourceIdx].url(tmdbId, mediaType, season, episode)
  const posterSrc = backdropPath ? tmdbImg(backdropPath, 'w1280') : null

  return (
    <div ref={containerRef} className="relative w-full bg-black flex flex-col">
      {/* iframe */}
      <div className="relative w-full aspect-video">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media"
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoaded(true)}
        />

        {/* Loading poster overlay */}
        {!iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {posterSrc && (
              <img
                src={posterSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
            )}
            <div className="relative flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin" />
              <span className="text-white/70 text-sm">Loading…</span>
            </div>
          </div>
        )}

        {/* Subtitle overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-8">
          {activeCue && (
            <div
              className="bg-black/75 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
              style={{ textShadow: '1px 1px 2px black' }}
              dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
            />
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[var(--st-surface)] border-t border-[var(--st-border)]">

        {/* Source switcher */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[var(--st-text-muted)] text-xs mr-1">
            {iframeLoaded ? 'Source:' : 'Try:'}
          </span>
          {SOURCES.map((src, i) => (
            <button
              key={i}
              onClick={() => setSourceIdx(i)}
              title={src.label}
              className={`w-7 h-7 rounded text-xs font-bold transition-colors cursor-pointer ${
                sourceIdx === i
                  ? 'bg-[var(--st-accent)] text-white'
                  : 'bg-white/10 text-[var(--st-text-muted)] hover:bg-white/20'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--st-border)]" />

        {/* Subtitle controls */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--st-text-muted)] text-xs">Subtitles:</span>

          <div className="relative">
            <button
              onClick={() => setSubsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded cursor-pointer"
            >
              {subLang ? LANGUAGES.find((l) => l.code === subLang)?.label ?? subLang : 'Off'}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {subsOpen && (
              <div className="absolute bottom-full mb-1 left-0 bg-[var(--st-surface-2)] border border-[var(--st-border)] rounded-lg overflow-hidden shadow-xl z-50 min-w-[120px]">
                <button
                  onClick={() => { selectTrack(null); setSubLang(''); setSubsOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-[var(--st-text-muted)] hover:bg-white/10 cursor-pointer"
                >
                  Off
                </button>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { fetchTracks(lang.code); setSubsOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 cursor-pointer"
                  >
                    {subtitleLoading && subLang === lang.code ? 'Loading…' : lang.label}
                  </button>
                ))}
                {tracks.map((t) => (
                  <button
                    key={t.fileId}
                    onClick={() => { selectTrack(t); setSubsOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${
                      activeTrack?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'
                    }`}
                  >
                    {t.releaseName || t.languageName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeTrack && (
            <button
              onClick={() => { syncStartRef.current = Date.now(); setSubTime(0) }}
              title="Tap when first dialogue starts to sync subtitles"
              className="flex items-center gap-1 text-xs text-[var(--st-accent)] bg-[var(--st-accent)]/10 hover:bg-[var(--st-accent)]/20 border border-[var(--st-accent)]/30 px-2 py-1 rounded cursor-pointer"
            >
              Sync
            </button>
          )}
        </div>

        <div className="ml-auto">
          <button
            onClick={handleFullscreen}
            className="text-[var(--st-text-muted)] hover:text-white cursor-pointer"
            title="Fullscreen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
