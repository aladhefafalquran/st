import { Router } from 'express'
import axios from 'axios'
import type { SubtitleTrack } from '@streamtime/shared'
import { env } from '../env.js'

const router: Router = Router()

const OS_BASE = 'https://api.opensubtitles.com/api/v1'
const osHeaders = () => ({
  'Api-Key': env.OPENSUBTITLES_API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'StreamTime v1.0',
})

const vttCache = new Map<string, string>()

// No-op — kept so old client builds don't 404 on /config
router.get('/config', (_req, res) => res.json({ provider: 'rest' }))

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) { res.status(400).json({ error: 'Missing imdb_id' }); return }

  if (!env.OPENSUBTITLES_API_KEY) {
    console.warn('[subtitles/search] OPENSUBTITLES_API_KEY not set — returning empty')
    res.json([])
    return
  }

  try {
    const params = new URLSearchParams()
    params.set('imdb_id', imdb_id.replace(/^tt/, ''))
    if (type === 'tv') {
      params.set('type', 'episode')
      if (season)  params.set('season_number', season)
      if (episode) params.set('episode_number', episode)
    } else {
      params.set('type', 'movie')
    }
    params.set('languages', languages ?? 'en')

    const resp = await axios.get(`${OS_BASE}/subtitles?${params}`, {
      headers: osHeaders(),
      timeout: 10000,
    })

    const results: SubtitleTrack[] = (resp.data.data ?? [])
      .filter((item: any) => item.attributes?.files?.length > 0)
      .map((item: any) => ({
        fileId:       String(item.attributes.files[0].file_id),
        language:     item.attributes.language,
        languageName: item.attributes.language,
        releaseName:  item.attributes.release || item.attributes.files[0].file_name || '',
      }))

    console.log(`[subtitles/search] ${results.length} results for ${imdb_id} (${languages})`)
    res.json(results)
  } catch (err: any) {
    console.error('[subtitles/search]', err?.response?.status, err?.message)
    res.json([])
  }
})

router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params

  if (vttCache.has(fileId)) {
    res.setHeader('Content-Type', 'text/vtt')
    res.send(vttCache.get(fileId))
    return
  }

  if (!env.OPENSUBTITLES_API_KEY) {
    res.status(503).json({ error: 'Subtitle service not configured (no API key).' })
    return
  }

  try {
    const linkRes = await axios.post(
      `${OS_BASE}/download`,
      { file_id: parseInt(fileId) },
      { headers: osHeaders(), timeout: 10000 },
    )
    const { link } = linkRes.data as { link: string }

    const fileRes = await axios.get<string>(link, { responseType: 'text', timeout: 15000 })
    let text = fileRes.data

    if (!text.startsWith('WEBVTT')) {
      text = 'WEBVTT\n\n' + text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    }

    vttCache.set(fileId, text)
    res.setHeader('Content-Type', 'text/vtt')
    res.send(text)
  } catch (err: any) {
    console.error('[subtitles/download]', err?.response?.status, err?.message)
    res.status(500).json({ error: `Subtitle download failed: ${err?.message}` })
  }
})

export default router
