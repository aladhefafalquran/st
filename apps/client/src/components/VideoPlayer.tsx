import { useState, useEffect, useCallback } from 'react'
import type { SubtitleTrack, SubtitleCue } from '@streamtime/shared'

// VidSrc sources — tried in order via the source switcher
const SOURCES = [
  (path: string) => `https://vidsrc.to/embed/${path}`,
  (path: string) => `https://vidsrc.me/embed/${path}`,
  (path: string) => `https://vidsrc.xyz/embed/${path}`,
]

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

export function VideoPlayer({ tmdbId, mediaType, title, imdbId, season, episode }: VideoPlayerProps) {
  const [sourceIndex, setSourceIndex] = useState(0)

  // Subtitle state
  const [subsOpen, setSubsOpen]         = useState(false)
  const [subView, setSubView]           = useState<'lang' | 'tracks'>('lang')
  const [subLang, setSubLang]           = useState('')
  const [tracks, setTracks]             = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrack]   = useState<SubtitleTrack | null>(null)
  const [cues, setCues]                 = useState<SubtitleCue[]>([])
  const [activeCue, setActiveCue]       = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)
  const [subtitleError, setSubtitleError]     = useState<string | null>(null)

  // Wall-clock sync — since the iframe is cross-origin we can't read currentTime.
  // The user clicks Sync when the actual content starts; subtitles run from that point.
  const [syncedAt, setSyncedAt]   = useState<number | null>(null) // Date.now() at sync click
  const [elapsed, setElapsed]     = useState(0)                   // seconds since sync

  // Build embed path
  const path = mediaType === 'tv'
    ? `tv/${tmdbId}/${season}/${episode}`
    : `movie/${tmdbId}`
  const src = SOURCES[sourceIndex](path)

  // ----- Wall-clock elapsed timer -----
  useEffect(() => {
    if (!syncedAt || !cues.length) return
    const iv = setInterval(() => setElapsed((Date.now() - syncedAt) / 1000), 100)
    return () => clearInterval(iv)
  }, [syncedAt, cues.length])

  // Reset sync when episode/movie changes
  useEffect(() => {
    setSyncedAt(null)
    setElapsed(0)
    setActiveTrack(null)
    setCues([])
    setActiveCue(null)
    setSourceIndex(0)
    setSubsOpen(false)
    setSubView('lang')
    setSubLang('')
    setTracks([])
  }, [tmdbId, season, episode])

  // ----- Active cue matching -----
  useEffect(() => {
    if (!cues.length) return
    const cue = cues.find((c) => elapsed >= c.start && elapsed <= c.end) ?? null
    setActiveCue(cue?.text ?? null)
  }, [elapsed, cues])

  // ----- Subtitle search (proxy through CF Function) -----
  const fetchSubtitles = useCallback(async (lang: string) => {
    setSubLang(lang)
    setSubtitleLoading(true)
    setTracks([])
    setActiveTrack(null)
    setCues([])
    setActiveCue(null)
    setSubtitleError(null)
    try {
      const p = new URLSearchParams({ imdb_id: imdbId, type: mediaType, languages: lang })
      if (mediaType === 'tv' && season)  p.set('season',  String(season))
      if (mediaType === 'tv' && episode) p.set('episode', String(episode))
      const r = await fetch(`/api/subtitles/search?${p}`)
      const body = await r.json().catch(() => [])
      if (!r.ok) throw new Error((body as any)?.error ?? `Search ${r.status}`)
      setTracks(body as SubtitleTrack[])
    } catch (err: any) {
      setSubtitleError(err?.message ?? 'Search failed')
      setSubView('tracks')
    } finally {
      setSubtitleLoading(false)
    }
  }, [imdbId, mediaType, season, episode])

  // ----- Download + parse subtitle track -----
  async function selectSubtitleTrack(track: SubtitleTrack | null) {
    if (!track) {
      setActiveTrack(null); setCues([]); setActiveCue(null); setSubtitleError(null)
      return
    }
    setActiveTrack(track)
    setSubtitleError(null)
    try {
      const r = await fetch(`/api/subtitles/download/${track.fileId}`)
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any
        throw new Error(err?.error ?? `HTTP ${r.status}`)
      }
      setCues(parseVtt(await r.text()))
      setSubsOpen(false)
      // Auto-sync when track is selected
      setSyncedAt(Date.now())
      setElapsed(0)
    } catch (err: any) {
      console.error('[subtitle]', err?.message)
      setSubtitleError(err?.message ?? 'Download failed')
      setCues([])
    }
  }

  return (
    <div className="relative w-full bg-black">
      {/* Iframe — sandbox blocks popup/new-tab ads; inline ads remain but no tab hijacking */}
      <div className="relative w-full aspect-video">
        <iframe
          key={src}
          src={src}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
        />

        {/* Subtitle overlay — above VidSrc controls (bottom ~80px) */}
        {activeCue && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none z-10">
            <div
              className="bg-black/80 text-white text-base sm:text-lg px-3 py-1.5 rounded text-center max-w-3xl leading-relaxed"
              style={{ textShadow: '1px 1px 2px black' }}
              dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
            />
          </div>
        )}
      </div>

      {/* Control bar — below the iframe so it never fights VidSrc's own controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--st-surface)] border-t border-[var(--st-border)]">
        {/* Left: title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/60 text-xs truncate">{title}</span>
          {mediaType === 'tv' && season && episode && (
            <span className="text-white/40 text-xs shrink-0">S{season} E{episode}</span>
          )}
        </div>

        {/* Right: source switcher + subtitles */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sync button — appears once a track is loaded */}
          {cues.length > 0 && (
            <button
              onClick={() => { setSyncedAt(Date.now()); setElapsed(0) }}
              title="Click when the content actually starts to sync subtitles"
              className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded cursor-pointer"
            >
              {syncedAt ? `Sync (${Math.round(elapsed)}s)` : 'Sync subtitles'}
            </button>
          )}

          {/* Subtitle picker */}
          <div className="relative">
            <button
              onClick={() => { setSubsOpen((v) => !v); setSubView('lang') }}
              className={`text-xs px-2 py-1 rounded cursor-pointer ${activeTrack ? 'text-[var(--st-accent)] bg-[var(--st-accent)]/10' : 'text-white bg-white/10 hover:bg-white/20'}`}
            >
              CC
            </button>

            {subsOpen && (
              <div className="absolute bottom-9 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg z-30 w-52 max-h-72 overflow-y-auto shadow-xl">
                {/* Level 1: Language */}
                {subView === 'lang' && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider border-b border-[var(--st-border)]">
                      Subtitle language
                    </div>
                    <button
                      onClick={() => { selectSubtitleTrack(null); setSubLang(''); setSubsOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}
                    >
                      Off
                    </button>
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setSubView('tracks'); fetchSubtitles(lang.code) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer flex justify-between items-center ${subLang === lang.code ? 'text-[var(--st-accent)]' : 'text-white'}`}
                      >
                        <span>{lang.label}</span>
                        <span className="text-white/30">›</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Level 2: Track list */}
                {subView === 'tracks' && (
                  <>
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--st-border)]">
                      <button
                        onClick={() => setSubView('lang')}
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
                          onClick={() => { selectSubtitleTrack(null); setSubsOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${!activeTrack ? 'text-[var(--st-accent)]' : 'text-white/60'}`}
                        >
                          Off
                        </button>
                        {tracks.map((t) => (
                          <button
                            key={t.fileId}
                            onClick={() => selectSubtitleTrack(t)}
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

          {/* Source switcher */}
          <button
            onClick={() => setSourceIndex((i) => (i + 1) % SOURCES.length)}
            className="text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded cursor-pointer"
          >
            Source {sourceIndex + 1}/{SOURCES.length}
          </button>
        </div>
      </div>

      {/* Close dropdowns on outside click */}
      {subsOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setSubsOpen(false)} />
      )}
    </div>
  )
}
