import { useState, useEffect, useCallback } from 'react';
import { SubtitleTrack } from '@streamtime/shared';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubtitleChange?: (track: SubtitleTrack | null) => void;
  onFetchSubtitles?: (language: string) => void;
  subtitleTracks?: SubtitleTrack[];
  subtitleLoading?: boolean;
  activeSubtitle?: SubtitleTrack | null;
  title?: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerControls({
  videoRef,
  containerRef,
  onSubtitleChange,
  onFetchSubtitles,
  subtitleTracks = [],
  subtitleLoading = false,
  activeSubtitle,
  title,
}: PlayerControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  // 'lang' = showing language picker, 'tracks' = showing track list for selected lang
  const [subView, setSubView] = useState<'lang' | 'tracks'>('lang');
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer) clearTimeout(hideTimer);
    const t = setTimeout(() => setVisible(false), 3000);
    setHideTimer(t);
    return () => clearTimeout(t);
  }, [hideTimer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setCurrentTime(video.currentTime),
      durationchange: () => setDuration(video.duration),
      volumechange: () => { setVolume(video.volume); setMuted(video.muted); },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      video.addEventListener(event, handler);
    }

    const fsHandler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsHandler);

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        video.removeEventListener(event, handler);
      }
      document.removeEventListener('fullscreenchange', fsHandler);
    };
  }, [videoRef]);

  useEffect(() => {
    resetHideTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Number(e.target.value);
    v.muted = false;
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      // Request fullscreen on the container so subtitle overlay is included
      const container = containerRef.current;
      if (container) container.requestFullscreen?.();
      else videoRef.current?.requestFullscreen?.();
    }
  }

  function handleLangSelect(code: string) {
    setSelectedLang(code);
    setSubView('tracks');
    onFetchSubtitles?.(code);
  }

  function openSubMenu() {
    setShowSubMenu(true);
    // If no language selected yet, always start at lang picker
    if (!selectedLang) setSubView('lang');
  }

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
    >
      {/* Top bar */}
      {title && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <p className="text-white font-medium">{title}</p>
        </div>
      )}

      {/* Center play/pause */}
      <div className="absolute inset-0 flex items-center justify-center" onClick={togglePlay}>
        {!playing && (
          <div className="bg-black/50 rounded-full p-5">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-4">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={seek}
          className="w-full h-1 mb-3 cursor-pointer accent-[var(--st-accent)]"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-[var(--st-accent)] transition-colors cursor-pointer">
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

            {/* Volume */}
            <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors cursor-pointer">
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
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 cursor-pointer accent-white"
            />

            {/* Time */}
            <span className="text-white text-sm tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Subtitles */}
            <div className="relative">
              <button
                onClick={openSubMenu}
                className={`text-sm px-2 py-1 rounded transition-colors cursor-pointer ${activeSubtitle ? 'text-[var(--st-accent)]' : 'text-white hover:text-white/80'}`}
              >
                CC
              </button>

              {showSubMenu && (
                <div className="absolute bottom-10 right-0 bg-[var(--st-surface)] border border-[var(--st-border)] rounded-lg py-1 z-20 w-52">

                  {/* Language picker view */}
                  {subView === 'lang' && (
                    <>
                      <div className="px-3 py-1.5 text-xs text-[var(--st-text-muted)] uppercase tracking-wide border-b border-[var(--st-border)] mb-1">
                        Select language
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => handleLangSelect(lang.code)}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between ${selectedLang === lang.code ? 'text-[var(--st-accent)]' : 'text-white'}`}
                          >
                            {lang.label}
                            {selectedLang === lang.code && <span className="text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-[var(--st-border)] mt-1 pt-1">
                        <button
                          onClick={() => { onSubtitleChange?.(null); setShowSubMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm text-[var(--st-text-muted)] hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Off
                        </button>
                      </div>
                    </>
                  )}

                  {/* Track list view */}
                  {subView === 'tracks' && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--st-border)] mb-1">
                        <button
                          onClick={() => setSubView('lang')}
                          className="text-[var(--st-text-muted)] hover:text-white transition-colors text-xs cursor-pointer"
                        >
                          ← Languages
                        </button>
                        <span className="text-xs text-[var(--st-text-muted)] ml-auto">
                          {LANGUAGES.find((l) => l.code === selectedLang)?.label}
                        </span>
                      </div>

                      {subtitleLoading && (
                        <div className="px-3 py-2 text-sm text-[var(--st-text-muted)]">Loading...</div>
                      )}

                      {!subtitleLoading && subtitleTracks.length === 0 && (
                        <div className="px-3 py-2 text-sm text-[var(--st-text-muted)]">No subtitles found</div>
                      )}

                      {!subtitleLoading && subtitleTracks.length > 0 && (
                        <div className="max-h-60 overflow-y-auto">
                          <button
                            onClick={() => { onSubtitleChange?.(null); setShowSubMenu(false); }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors cursor-pointer ${!activeSubtitle ? 'text-[var(--st-accent)]' : 'text-white'}`}
                          >
                            Off
                          </button>
                          {subtitleTracks.map((t) => (
                            <button
                              key={t.fileId}
                              onClick={() => { onSubtitleChange?.(t); setShowSubMenu(false); }}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors cursor-pointer ${activeSubtitle?.fileId === t.fileId ? 'text-[var(--st-accent)]' : 'text-white'}`}
                            >
                              {t.releaseName.slice(0, 30)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors cursor-pointer">
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

      {/* Close sub menu on outside click */}
      {showSubMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowSubMenu(false)} />
      )}
    </div>
  );
}
