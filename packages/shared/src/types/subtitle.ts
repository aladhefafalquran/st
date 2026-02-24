export interface SubtitleTrack {
  fileId: string
  language: string
  languageName: string
  releaseName: string
}

export interface SubtitleCue {
  start: number
  end: number
  text: string
}
