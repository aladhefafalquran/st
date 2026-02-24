import { Router } from 'express'
import axios from 'axios'
import { env } from '../env.js'
import type { SubtitleTrack } from '@streamtime/shared'

const router: Router = Router()

const OS_API = 'https://api.opensubtitles.com/api/v1'
const osHeaders = {
  'Api-Key': env.OPENSUBTITLES_API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'StreamTime v1.0',
}

// Two-level cache: avoid re-calling the download endpoint (burns quota) for the same fileId
const vttCache = new Map<string, string>()   // fileId → VTT content
const linkCache = new Map<string, string>()  // fileId → download URL (survives across client reloads)

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) {
    res.status(400).json({ error: 'Missing imdb_id' })
    return
  }

  try {
    const params = new URLSearchParams()
    params.set('imdb_id', imdb_id.replace(/^tt/, ''))
    if (type === 'tv') {
      params.set('type', 'episode')
      if (season) params.set('season_number', season)
      if (episode) params.set('episode_number', episode)
    } else {
      params.set('type', 'movie')
    }
    if (languages) params.set('languages', languages)

    const response = await axios.get(`${OS_API}/subtitles?${params}`, { headers: osHeaders })
    const results: SubtitleTrack[] = (response.data.data || [])
      .filter((item: any) => item.attributes?.files?.length > 0)
      .map((item: any) => ({
        fileId: String(item.attributes.files[0].file_id),
        language: item.attributes.language,
        languageName: item.attributes.language,
        releaseName: item.attributes.release || item.attributes.files[0].file_name || '',
      }))

    res.json(results)
  } catch (err: any) {
    console.error('[subtitles] search error:', err?.response?.status, err?.response?.data ?? err?.message)
    res.json([])
  }
})

router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params

  // 1. VTT already downloaded → serve from memory
  if (vttCache.has(fileId)) {
    res.setHeader('Content-Type', 'text/vtt')
    res.send(vttCache.get(fileId))
    return
  }

  try {
    let fileUrl: string

    // 2. Download link cached → skip the POST (saves quota)
    if (linkCache.has(fileId)) {
      fileUrl = linkCache.get(fileId)!
    } else {
      // 3. Ask OpenSubtitles for the download link
      const downloadRes = await axios.post(
        `${OS_API}/download`,
        { file_id: parseInt(fileId) },
        { headers: osHeaders }
      )
      fileUrl = downloadRes.data.link
      if (fileUrl) linkCache.set(fileId, fileUrl)
    }

    const fileRes = await axios.get(fileUrl, { responseType: 'text' })
    let content: string = fileRes.data

    if (!content.startsWith('WEBVTT')) {
      content = srtToVtt(content)
    }

    vttCache.set(fileId, content)
    res.setHeader('Content-Type', 'text/vtt')
    res.send(content)
  } catch (err: any) {
    const httpStatus: number = err?.response?.status ?? 0
    // Extract the error message OpenSubtitles returned
    const osData = err?.response?.data
    const osMessage: string =
      osData?.message ??
      (Array.isArray(osData?.errors) ? osData.errors.join(', ') : null) ??
      err?.message ??
      'Unknown error'

    console.error(`[subtitles] download error: HTTP ${httpStatus} — ${osMessage}`)

    // Map common OS errors to meaningful client messages
    if (httpStatus === 406) {
      res.status(429).json({ error: 'Daily subtitle download limit reached. Try again tomorrow.' })
    } else if (httpStatus === 401 || httpStatus === 403) {
      res.status(httpStatus).json({ error: `Subtitle service auth failed (${httpStatus}). Check OPENSUBTITLES_API_KEY.` })
    } else {
      res.status(500).json({ error: `Subtitle download failed: ${osMessage}` })
    }
  }
})

function srtToVtt(srt: string): string {
  const vtt = srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return 'WEBVTT\n\n' + vtt
}

export default router
