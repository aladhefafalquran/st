import { Router } from 'express'
import axios from 'axios'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import type { SubtitleTrack } from '@streamtime/shared'

const gunzipAsync = promisify(gunzip)
const router: Router = Router()

const XMLRPC_URL = 'https://api.opensubtitles.org/xml-rpc'
const UA = 'StreamTime v1.0'

router.get('/config', (_req, res) => res.json({ provider: 'xmlrpc' }))

// ISO 639-1 → ISO 639-2 (XML-RPC uses 3-letter codes)
const LANG_MAP: Record<string, string> = {
  en: 'eng', ar: 'ara', fr: 'fre', es: 'spa',
  de: 'ger', tr: 'tur', zh: 'chi', ja: 'jpn',
}

function extractField(xml: string, field: string): string[] {
  const results: string[] = []
  const memberRe = /<member>([\s\S]*?)<\/member>/g
  let m: RegExpExecArray | null
  while ((m = memberRe.exec(xml)) !== null) {
    const block = m[0]
    if (block.includes(`<name>${field}</name>`)) {
      const val = block.match(/<string>([^<]*)<\/string>/)
      if (val?.[1] !== undefined) results.push(val[1].trim())
    }
  }
  return results
}

router.get('/search', async (req, res) => {
  const { imdb_id, type, languages, season, episode } = req.query as Record<string, string>
  if (!imdb_id) { res.status(400).json({ error: 'Missing imdb_id' }); return }

  try {
    const tok = await getXmlToken()
    const lang3  = LANG_MAP[languages] ?? 'eng'
    const pureId = imdb_id.replace(/^tt/, '').padStart(7, '0')

    let struct =
      `<member><name>sublanguageid</name><value><string>all</string></value></member>` +
      `<member><name>imdbid</name><value><string>${pureId}</string></value></member>`
    if (type === 'tv' && season)  struct += `<member><name>season</name><value><int>${season}</int></value></member>`
    if (type === 'tv' && episode) struct += `<member><name>episode</name><value><int>${episode}</int></value></member>`

    const params =
      `<param><value><string>${tok}</string></value></param>` +
      `<param><value><array><data><value><struct>${struct}</struct></value></data></array></value></param>`

    const resp = await xmlCall('SearchSubtitles', params)

    if (resp.includes('No results found') || !resp.includes('IDSubtitleFile')) {
      res.json([]); return
    }

    const ids   = extractField(resp, 'IDSubtitleFile')
    const names = extractField(resp, 'MovieReleaseName')
    const langs = extractField(resp, 'SubLanguageID')

    const matchIdx = ids
      .map((_, i) => langs[i]?.toLowerCase() === lang3.toLowerCase() ? i : -1)
      .filter(i => i >= 0)

    if (matchIdx.length === 0) { res.json([]); return }

    const results: SubtitleTrack[] = matchIdx.slice(0, 20).map(i => ({
      fileId:       ids[i],
      language:     langs[i] ?? lang3,
      languageName: languages ?? lang3,
      releaseName:  names[i] ?? ids[i],
    }))

    console.log(`[subtitles/search] ${ids.length} total, ${matchIdx.length} in ${lang3}`)
    res.json(results)
  } catch (err: any) {
    console.error('[subtitles/search]', err?.message)
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
