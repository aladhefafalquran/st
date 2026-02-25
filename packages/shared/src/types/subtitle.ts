export interface SubtitleTrack {
  fileId: string
  language: string
  languageName: string
  releaseName: string
  downloadUrl?: string   // direct .gz CDN link (VLC REST API)
  encoding?: string      // e.g. 'UTF-8', 'CP1256'
}

export interface SubtitleCue {
  start: number
  end: number
  text: string
}
