import { TorrentOption } from '@streamtime/shared';

const QUALITY_ORDER = ['2160p', '1080p', '720p', '480p', '360p'];

export interface QualityGroup {
  quality: string;
  items: TorrentOption[];
}

/**
 * Detect whether a torrent's audio is likely browser-compatible (AAC/Opus)
 * or incompatible (AC3/DTS, which Chrome silently drops).
 *
 * Returns:
 *  'ok'      — explicit AAC or WEB-DL/WEBRip source (almost always AAC)
 *  'bad'     — explicit AC3/DTS, or BluRay without an AAC mention
 *  'unknown' — can't determine from filename
 */
export function audioCompat(filename?: string): 'ok' | 'bad' | 'unknown' {
  if (!filename) return 'unknown';
  const f = filename.toLowerCase();

  // Explicit bad codecs — Chrome can't play these
  if (/\b(dts[-.]?(hd|ma|x)?|truehd|ac3|dd5\.1|dd2\.0|dolby\.digital)\b/.test(f)) return 'bad';

  // Explicit good codec
  if (/\baac\b/.test(f)) return 'ok';

  // WEB sources (streaming rips) almost always ship with AAC
  if (/\b(web[-.]?dl|webrip|web\.rip|amzn|amazon|netflix|hulu|dsnp|nf|hmax|peacock|atvp|itunes)\b/.test(f)) return 'ok';

  // BluRay without an explicit codec → almost certainly AC3 or DTS
  if (/\b(bluray|blu[-.]ray|bdrip|brrip|bd[-.]rip|remux)\b/.test(f)) return 'bad';

  return 'unknown';
}

function audioScore(filename?: string): number {
  const c = audioCompat(filename);
  return c === 'ok' ? 2 : c === 'unknown' ? 1 : 0;
}

/** Group torrents by quality, top 3 per group sorted by audio compat then seeds. */
export function groupTorrents(torrents: TorrentOption[]): QualityGroup[] {
  const map = new Map<string, TorrentOption[]>();

  for (const t of torrents) {
    const q = t.quality || 'unknown';
    if (!map.has(q)) map.set(q, []);
    map.get(q)!.push(t);
  }

  const sortItems = (items: TorrentOption[]) =>
    [...items]
      .sort((a, b) => {
        // Audio-compatible streams first — AC3/DTS = silent video in Chrome
        const aScore = audioScore(a.filename);
        const bScore = audioScore(b.filename);
        if (aScore !== bScore) return bScore - aScore;
        return b.seeds - a.seeds;
      })
      .slice(0, 3);

  const result: QualityGroup[] = [];

  for (const q of QUALITY_ORDER) {
    const items = map.get(q);
    if (items && items.length > 0) result.push({ quality: q, items: sortItems(items) });
  }

  for (const [q, items] of map) {
    if (!QUALITY_ORDER.includes(q) && items.length > 0) {
      result.push({ quality: q, items: sortItems(items) });
    }
  }

  return result;
}
