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

const vttCache = new Map<string, string>()   // fileId → VTT content
const linkCache = new Map<string, string>()  // fileId → download URL

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any
  for (let i = 0; i < retries; i++) {
    try { return await fn() } catch (err: any) {
      lastErr = err
      if (err?.response?.status === 503 && i < retries - 1) {
        await sleep(1200 * (i + 1)) // 1.2s, 2.4s backoff
        continue
      }
      throw err
    }
  }
  throw lastErr
}

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) { res.status(400).json({ error: 'Missing imdb_id' }); return }

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

    const response = await withRetry(() =>
      axios.get(`${OS_API}/subtitles?${params}`, { headers: osHeaders })
    )
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

// Returns the direct download URL to the client so the browser fetches the file
// (user's IP, not datacenter IP — avoids OpenSubtitles IP blocks on downloads)
router.get('/link/:fileId', async (req, res) => {
  const { fileId } = req.params

  if (linkCache.has(fileId)) {
    res.json({ url: linkCache.get(fileId) })
    return
  }

  try {
    const downloadRes = await withRetry(() =>
      axios.post(`${OS_API}/download`, { file_id: parseInt(fileId) }, { headers: osHeaders })
    )
    const url: string = downloadRes.data.link
    if (url) linkCache.set(fileId, url)
    res.json({ url })
  } catch (err: any) {
    const httpStatus: number = err?.response?.status ?? 0
    const osData = err?.response?.data
    const msg: string =
      osData?.message ??
      (Array.isArray(osData?.errors) ? osData.errors.join(', ') : null) ??
      err?.message ?? 'Unknown error'
    console.error(`[subtitles] link error: HTTP ${httpStatus} — ${msg}`)

    if (httpStatus === 406) {
      res.status(429).json({ error: 'Daily subtitle download limit reached.' })
    } else if (httpStatus === 503) {
      res.status(503).json({ error: 'Subtitle service temporarily unavailable (503). Try again in a moment.' })
    } else if (httpStatus === 401 || httpStatus === 403) {
      res.status(httpStatus).json({ error: `Subtitle auth failed — check OPENSUBTITLES_API_KEY env var.` })
    } else {
      res.status(500).json({ error: `Subtitle link error: ${msg}` })
    }
  }
})

// Keep old /download route as a server-side fallback
router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params

  if (vttCache.has(fileId)) {
    res.setHeader('Content-Type', 'text/vtt')
    res.send(vttCache.get(fileId))
    return
  }

  try {
    let fileUrl: string
    if (linkCache.has(fileId)) {
      fileUrl = linkCache.get(fileId)!
    } else {
      const downloadRes = await withRetry(() =>
        axios.post(`${OS_API}/download`, { file_id: parseInt(fileId) }, { headers: osHeaders })
      )
      fileUrl = downloadRes.data.link
      if (fileUrl) linkCache.set(fileId, fileUrl)
    }

    const fileRes = await withRetry(() =>
      axios.get(fileUrl, { responseType: 'text' })
    )
    let content: string = fileRes.data
    if (!content.startsWith('WEBVTT')) content = srtToVtt(content)

    vttCache.set(fileId, content)
    res.setHeader('Content-Type', 'text/vtt')
    res.send(content)
  } catch (err: any) {
    const httpStatus: number = err?.response?.status ?? 0
    const osData = err?.response?.data
    const msg: string =
      osData?.message ??
      (Array.isArray(osData?.errors) ? osData.errors.join(', ') : null) ??
      err?.message ?? 'Unknown error'
    console.error(`[subtitles] download error: HTTP ${httpStatus} — ${msg}`)

    if (httpStatus === 406) res.status(429).json({ error: 'Daily subtitle download limit reached.' })
    else if (httpStatus === 503) res.status(503).json({ error: 'Subtitle service temporarily unavailable (503).' })
    else if (httpStatus === 401 || httpStatus === 403) res.status(httpStatus).json({ error: 'Subtitle auth failed.' })
    else res.status(500).json({ error: `Subtitle download failed: ${msg}` })
  }
})

function srtToVtt(srt: string): string {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
}

export default router
