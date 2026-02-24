import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/playerStore';
import { VideoPlayer } from '@/components/player/VideoPlayer';

export function Watch() {
  const { tmdbId, mediaType, title, imdbId, season, episode } = usePlayerStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!tmdbId) navigate('/');
  }, [tmdbId, navigate]);

  if (!tmdbId || !mediaType || !title || !imdbId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center gap-4 p-4 bg-black/80">
        <button
          onClick={() => navigate(-1)}
          className="text-white hover:text-white/80 transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-white font-medium">{title}</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          <VideoPlayer
            key={`${tmdbId}-${season}-${episode}`}
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={title}
            imdbId={imdbId}
            season={season ?? undefined}
            episode={episode ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
