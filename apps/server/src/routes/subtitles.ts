import { Router } from 'express'
import axios from 'axios'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import type { SubtitleTrack } from '@streamtime/shared'

const gunzipAsync = promisify(gunzip)
const router: Router = Router()

// OpenSubtitles XML-RPC (legacy) API — used by Stremio, Kodi, etc. from datacenter IPs.
// The newer REST API (api.opensubtitles.com) blocks HF Space IPs on download endpoints.
// The XML-RPC API uses a completely different server and has no such restrictions.
// It returns subtitle content directly (base64+gzip), no separate "get link" step needed.
const XMLRPC_URL = 'https://api.opensubtitles.org/xml-rpc'
const UA = 'StreamTime v1.0'

// ISO 639-1 → ISO 639-2 (XML-RPC uses 3-letter codes)
const LANG_MAP: Record<string, string> = {
  en: 'eng', ar: 'ara', fr: 'fre', es: 'spa',
  de: 'ger', tr: 'tur', zh: 'chi', ja: 'jpn',
}

// Anonymous session token (valid 15 min)
let sessionToken = ''
let sessionAt = 0

const vttCache = new Map<string, string>()

// ── XML-RPC helpers ──────────────────────────────────────────────────────────

async function xmlCall(method: string, paramsXml: string): Promise<string> {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramsXml}</params></methodCall>`
  const r = await axios.post<string>(XMLRPC_URL, body, {
    headers: { 'Content-Type': 'text/xml', 'User-Agent': UA },
    timeout: 15000,
  })
  return r.data
}

async function getToken(): Promise<string> {
  if (sessionToken && Date.now() - sessionAt < 13 * 60 * 1000) return sessionToken
  const resp = await xmlCall(
    'LogIn',
    `<param><value><string></string></value></param>` +
    `<param><value><string></string></value></param>` +
    `<param><value><string>en</string></value></param>` +
    `<param><value><string>${UA}</string></value></param>`
  )
  const m = resp.match(/<name>token<\/name>\s*<value>(?:<string>)?([^<]+)(?:<\/string>)?<\/value>/)
  if (!m?.[1]) throw new Error('XML-RPC login failed — no token in response')
  sessionToken = m[1]
  sessionAt = Date.now()
  return sessionToken
}

function extractField(xml: string, field: string): string[] {
  const re = new RegExp(
    `<name>${field}<\\/name>\\s*<value>(?:<string>)?([^<]*)(?:<\\/string>)?<\\/value>`, 'g'
  )
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim())
  return out
}

// ── Routes ───────────────────────────────────────────────────────────────────

// No-op: kept so old client builds don't 404 on /config
router.get('/config', (_req, res) => res.json({ provider: 'xmlrpc' }))

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) { res.status(400).json({ error: 'Missing imdb_id' }); return }

  try {
    const tok = await getToken()
    const lang3 = LANG_MAP[languages] ?? 'eng'
    const pureId = imdb_id.replace(/^tt/, '')

    let struct = `<member><name>sublanguageid</name><value><string>${lang3}</string></value></member>`
      + `<member><name>imdbid</name><value><string>${pureId}</string></value></member>`
    if (type === 'tv' && season)  struct += `<member><name>season</name><value><string>${season}</string></value></member>`
    if (type === 'tv' && episode) struct += `<member><name>episode</name><value><string>${episode}</string></value></member>`

    const params =
      `<param><value><string>${tok}</string></value></param>` +
      `<param><value><array><data><value><struct>${struct}</struct></value></data></array></value></param>`

    const resp = await xmlCall('SearchSubtitles', params)

    const ids   = extractField(resp, 'IDSubtitleFile')
    const names = extractField(resp, 'MovieReleaseName')
    const langs = extractField(resp, 'SubLanguageID')

    const results: SubtitleTrack[] = ids.slice(0, 20).map((fileId, i) => ({
      fileId,
      language: langs[i] ?? lang3,
      languageName: languages ?? lang3,
      releaseName: names[i] ?? fileId,
    }))

    res.json(results)
  } catch (err: any) {
    console.error('[subtitles/search]', err?.message)
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

  try {
    const tok = await getToken()
    const params =
      `<param><value><string>${tok}</string></value></param>` +
      `<param><value><array><data><value><string>${fileId}</string></value></data></array></value></param>`

    const resp = await xmlCall('DownloadSubtitles', params)

    // Response has two <name>data</name> blocks:
    //   parts[1] = outer "data" = the array of subtitle objects
    //   parts[2] = inner "data" = base64(gzip(SRT)) content
    const parts = resp.split('<name>data</name>')
    if (parts.length < 3) throw new Error(`Unexpected XML-RPC response (${parts.length} data blocks)`)

    const b64 = parts[2]
      .match(/<value>\s*(?:<string>)?\s*([\s\S]*?)\s*(?:<\/string>)?\s*<\/value>/)?.[1]
      ?.replace(/\s/g, '')

    if (!b64) throw new Error('No base64 content in download response')

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
