import { useRef, useEffect, useCallback } from 'react';
import { upsertHistory } from '@/api/watchlist';
import { useAuthStore } from '@/store/authStore';

interface UsePlayerOptions {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  season?: number;
  episode?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function usePlayer(videoRef: React.RefObject<HTMLVideoElement | null>, opts: UsePlayerOptions) {
  const { isAuthenticated } = useAuthStore();
  const saveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaved = useRef(0);

  const saveProgress = useCallback(
    async (video: HTMLVideoElement) => {
      if (!isAuthenticated) return;
      const now = Math.floor(video.currentTime);
      if (Math.abs(now - lastSaved.current) < 5) return;
      lastSaved.current = now;

      await upsertHistory({
        tmdbId: opts.tmdbId,
        mediaType: opts.mediaType,
        title: opts.title,
        seasonNumber: opts.season,
        episodeNumber: opts.episode,
        progressSeconds: now,
        durationSeconds: Math.floor(video.duration) || 0,
      }).catch(() => {});
    },
    [isAuthenticated, opts],
  );

  // Save progress every 10s
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    saveTimer.current = setInterval(() => {
      if (!video.paused && !video.ended) {
        saveProgress(video);
      }
    }, 10000);

    return () => {
      if (saveTimer.current) clearInterval(saveTimer.current);
      if (video && !video.paused) saveProgress(video);
    };
  }, [videoRef, saveProgress]);

  // Keyboard shortcuts — fullscreen targets the container so subtitle overlay is included
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleKey(e: KeyboardEvent) {
      if (!video) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            // Use container so subtitle overlay stays visible in fullscreen
            const container = opts.containerRef.current;
            if (container) container.requestFullscreen?.();
            else video.requestFullscreen?.();
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [videoRef, opts.containerRef]);
}
