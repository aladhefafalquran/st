export interface SubtitleTrack {
  fileId: number;
  language: string;
  languageCode: string;
  releaseName: string;
  downloadCount: number;
  url?: string;
}

export interface SubtitleSearchParams {
  imdb_id: string;
  type: 'movie' | 'tv';
  languages?: string;
  season?: number;
  episode?: number;
}
