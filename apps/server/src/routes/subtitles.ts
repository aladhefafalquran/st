import { Router } from 'express'
import axios from 'axios'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import type { SubtitleTrack } from '@streamtime/shared'
import { env } from '../env.js'

const gunzipAsync = promisify(gunzip)
const router: Router = Router()

const OS_BASE    = 'https://api.opensubtitles.com/api/v1'
const XMLRPC_URL = 'https://api.opensubtitles.org/xml-rpc'
const UA = 'StreamTime v1.0'

// ── Search via REST API ───────────────────────────────────────────────────────

router.get('/config', (_req, res) => res.json({ provider: 'rest+xmlrpc' }))

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) { res.status(400).json({ error: 'Missing imdb_id' }); return }

  if (!env.OPENSUBTITLES_API_KEY) {
    console.warn('[subtitles/search] OPENSUBTITLES_API_KEY not set')
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
      headers: { 'Api-Key': env.OPENSUBTITLES_API_KEY, 'Content-Type': 'application/json', 'User-Agent': UA },
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

// ── Download via XML-RPC (anonymous, no user JWT needed) ──────────────────────
// The REST API /download requires a user JWT token; XML-RPC works anonymously.
// file_id from REST search == IDSubtitleFile in XML-RPC.

async function xmlCall(method: string, paramsXml: string): Promise<string> {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramsXml}</params></methodCall>`
  const r = await axios.post<string>(XMLRPC_URL, body, {
    headers: { 'Content-Type': 'text/xml', 'User-Agent': UA },
    timeout: 15000,
  })
  return r.data
}

let sessionToken = ''
let sessionAt = 0

async function getXmlToken(): Promise<string> {
  if (sessionToken && Date.now() - sessionAt < 13 * 60 * 1000) return sessionToken
  const resp = await xmlCall(
    'LogIn',
    `<param><value><string></string></value></param>` +
    `<param><value><string></string></value></param>` +
    `<param><value><string>en</string></value></param>` +
    `<param><value><string>${UA}</string></value></param>`
  )
  const m = resp.match(/<name>token<\/name>\s*<value>(?:<string>)?([^<]+)(?:<\/string>)?<\/value>/)
  if (!m?.[1]) throw new Error('XML-RPC login failed')
  sessionToken = m[1]
  sessionAt = Date.now()
  return sessionToken
}

const vttCache = new Map<string, string>()

router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params

  if (vttCache.has(fileId)) {
    res.setHeader('Content-Type', 'text/vtt')
    res.send(vttCache.get(fileId))
    return
  }

  try {
    const tok = await getXmlToken()
    const params =
      `<param><value><string>${tok}</string></value></param>` +
      `<param><value><array><data><value><string>${fileId}</string></value></data></array></value></param>`

    const resp = await xmlCall('DownloadSubtitles', params)

    const parts = resp.split('<name>data</name>')
    if (parts.length < 3) throw new Error(`Unexpected XML-RPC response (${parts.length} data sections)`)

    const b64 = parts[2]
      .match(/<value>\s*(?:<string>)?\s*([\s\S]*?)\s*(?:<\/string>)?\s*<\/value>/)?.[1]
      ?.replace(/\s/g, '')

    if (!b64) throw new Error('No subtitle data in XML-RPC response')

    const compressed = Buffer.from(b64, 'base64')
    const srt = (await gunzipAsync(compressed)).toString('utf-8')

    const vtt = 'WEBVTT\n\n' + srt
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    vttCache.set(fileId, vtt)
    res.setHeader('Content-Type', 'text/vtt')
    res.send(vtt)
  } catch (err: any) {
    console.error('[subtitles/download]', err?.message)
    res.status(500).json({ error: `Subtitle download failed: ${err?.message}` })
  }
})

export default router
