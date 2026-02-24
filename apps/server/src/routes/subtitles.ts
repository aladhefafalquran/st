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

const subtitleCache = new Map<string, string>()

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages } = req.query as Record<string, string>
  if (!imdb_id) {
    res.status(400).json({ error: 'Missing imdb_id' })
    return
  }

  const params = new URLSearchParams()
  params.set('imdb_id', imdb_id.replace(/^tt/, ''))
  if (type === 'tv') params.set('type', 'episode')
  else params.set('type', 'movie')
  if (languages) params.set('languages', languages)

  const response = await axios.get(`${OS_API}/subtitles?${params}`, { headers: osHeaders })
  const results: SubtitleTrack[] = (response.data.data || [])
    .filter((item: any) => item.attributes?.files?.length > 0)
    .map((item: any) => ({
      fileId: String(item.attributes.files[0].file_id),
      language: item.attributes.language,
      languageName: item.attributes.language,
      releaseName: item.attributes.release || '',
    }))

  res.json(results)
})

router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params

  if (subtitleCache.has(fileId)) {
    res.setHeader('Content-Type', 'text/vtt')
    res.send(subtitleCache.get(fileId))
    return
  }

  const downloadRes = await axios.post(
    `${OS_API}/download`,
    { file_id: parseInt(fileId) },
    { headers: osHeaders }
  )

  const fileUrl: string = downloadRes.data.link
  const fileRes = await axios.get(fileUrl, { responseType: 'text' })
  let content: string = fileRes.data

  if (!content.startsWith('WEBVTT')) {
    content = srtToVtt(content)
  }

  subtitleCache.set(fileId, content)
  res.setHeader('Content-Type', 'text/vtt')
  res.send(content)
})

function srtToVtt(srt: string): string {
  const vtt = srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return 'WEBVTT\n\n' + vtt
}

export default router
