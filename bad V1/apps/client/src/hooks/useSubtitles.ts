import { useState, useCallback } from 'react';
import { searchSubtitles, getSubtitleUrl } from '@/api/subtitles';
import { SubtitleTrack } from '@streamtime/shared';

export interface VTTCue {
  startTime: number;
  endTime: number;
  text: string;
}

function parseVTT(vtt: string): VTTCue[] {
  const cues: VTTCue[] = [];
  const blocks = vtt.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr);
    const text = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join('\n')
      .trim();

    if (text) cues.push({ startTime, endTime, text });
  }
  return cues;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  const [m, s] = parts;
  return m * 60 + s;
}

export function useSubtitles(imdbId: string, type: 'movie' | 'tv') {
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [cues, setCues] = useState<VTTCue[]>([]);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTrack, setActiveTrack] = useState<SubtitleTrack | null>(null);

  // language is set by the user in the player language picker
  const fetchTracks = useCallback(
    async (season?: number, episode?: number, language?: string) => {
      if (!imdbId || !language) return;
      setLoading(true);
      setTracks([]);
      setActiveTrack(null);
      setCues([]);
      setActiveCue(null);
      try {
        const { subtitles } = await searchSubtitles({
          imdb_id: imdbId,
          type,
          languages: language,
          season,
          episode,
        });
        setTracks(subtitles.slice(0, 15));
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    },
    [imdbId, type],
  );

  const selectTrack = useCallback(async (track: SubtitleTrack | null) => {
    setActiveTrack(track);
    setCues([]);
    setActiveCue(null);
    if (!track) return;

    try {
      const url = getSubtitleUrl(track.fileId);
      const res = await fetch(url, { credentials: 'include' });
      const vtt = await res.text();
      setCues(parseVTT(vtt));
    } catch {
      setCues([]);
    }
  }, []);

  const updateCue = useCallback(
    (currentTime: number) => {
      const cue = cues.find((c) => currentTime >= c.startTime && currentTime <= c.endTime);
      setActiveCue(cue?.text ?? null);
    },
    [cues],
  );

  return { tracks, cues, activeCue, loading, activeTrack, fetchTracks, selectTrack, updateCue };
}
