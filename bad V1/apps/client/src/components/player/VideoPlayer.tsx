import { useRef, useState, useCallback, useEffect } from 'react';
import { useSubtitles } from '@/hooks/useSubtitles';
import { SubtitleRenderer } from './SubtitleRenderer';
import { usePlayer } from '@/hooks/usePlayer';

// Multiple VidSrc domains as fallback sources
const SOURCES = [
  (path: string) => `https://vidsrc.to/embed/${path}`,
  (path: string) => `https://vidsrc.me/embed/${path}`,
  (path: string) => `https://vidsrc.xyz/embed/${path}`,
];

interface VideoPlayerProps {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  imdbId: string;
  season?: number;
  episode?: number;
}

export function VideoPlayer({
  tmdbId,
  mediaType,
  title,
  imdbId,
  season,
  episode,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // VidSrc doesn't need a real video ref but usePlayer expects one
  const videoRef = useRef<HTMLVideoElement>(null);

  const [sourceIdx, setSourceIdx] = useState(0);
  const [subsOpen, setSubsOpen] = useState(false);
  const [subLang, setSubLang] = useState('');

  // ── Subtitle sync timer ───────────────────────────────────────────────────
  // We can't read currentTime from the cross-origin iframe, so we use a
  // wall-clock timer started when the user clicks "Sync". Hit Sync the
  // moment a character first speaks and subtitles will line up.
  const syncStartRef = useRef<number | null>(null);
  const [subTime, setSubTime] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      if (syncStartRef.current !== null) {
        setSubTime((Date.now() - syncStartRef.current) / 1000);
      }
    }, 250);
    return () => clearInterval(tick);
  }, []);

  // ── Subtitles ─────────────────────────────────────────────────────────────
  const {
    tracks,
    activeCue,
    activeTrack,
    loading: subtitleLoading,
    fetchTracks,
    selectTrack,
    updateCue,
  } = useSubtitles(imdbId, mediaType);

  useEffect(() => {
    updateCue(subTime);
  }, [subTime, updateCue]);

  usePlayer(videoRef, { tmdbId, mediaType, title, season, episode, containerRef });

  const handleFetchSubtitles = useCallback(
    (lang: string) => {
      setSubLang(lang);
      fetchTracks(season, episode, lang);
    },
    [fetchTracks, season, episode],
  );

  // ── VidSrc URL ────────────────────────────────────────────────────────────
  const embedPath =
    mediaType === 'tv'
      ? `tv/${tmdbId}/${season}/${episode}`
      : `movie/${tmdbId}`;

  const iframeSrc = SOURCES[sourceIdx](embedPath);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function handleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }

  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'Arabic' },
    { code: 'fr', label: 'French' },
    { code: 'es', label: 'Spanish' },
    { code: 'de', label: 'German' },
    { code: 'tr', label: 'Turkish' },
  ];

  return (
    <div ref={containerRef} className="relative w-full bg-black flex flex-col">
      {/* ── iframe ── */}
      <div className="relative w-full aspect-video">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media"
          referrerPolicy="no-referrer"
        />

        {/* Subtitle overlay on top of iframe */}
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-8">
          <SubtitleRenderer text={activeCue} />
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[var(--st-surface)] border-t border-[var(--st-border)]">

        {/* Source switcher */}
        <div className="flex items-center gap-1">
          <span className="text-[var(--st-text-muted)] text-xs mr-1">Source:</span>
          {SOURCES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSourceIdx(i)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors cursor-pointer ${
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

          {/* Language picker */}
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
                  onClick={() => { selectTrack(null); setSubLang(''); setSubsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-[var(--st-text-muted)] hover:bg-white/10 cursor-pointer"
                >
                  Off
                </button>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { handleFetchSubtitles(lang.code); setSubsOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 cursor-pointer"
                  >
                    {subtitleLoading && subLang === lang.code ? 'Loading…' : lang.label}
                  </button>
                ))}
                {/* Additional fetched tracks */}
                {tracks.filter((t) => !LANGUAGES.find((l) => l.code === t.languageCode)).map((t) => (
                  <button
                    key={t.fileId}
                    onClick={() => { selectTrack(t); setSubsOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 cursor-pointer ${
                      activeTrack?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'
                    }`}
                  >
                    {t.language}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sync button — tap when character first speaks */}
          {activeTrack && (
            <button
              onClick={() => { syncStartRef.current = Date.now(); setSubTime(0); }}
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
  );
}
