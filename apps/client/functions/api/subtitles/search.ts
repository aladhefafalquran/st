// Cloudflare Pages Function — XML-RPC SearchSubtitles (anonymous, no API key needed)
// OpenSubtitles REST API blocks datacenter/edge IPs; XML-RPC works from anywhere.

const XMLRPC_URL = 'https://api.opensubtitles.org/xml-rpc'
const UA = 'StreamTime v1.0'

// ISO 639-1 → ISO 639-2 (XML-RPC uses 3-letter codes)
const LANG_MAP: Record<string, string> = {
  en: 'eng', ar: 'ara', fr: 'fre', es: 'spa',
  de: 'ger', tr: 'tur', zh: 'chi', ja: 'jpn',
}

async function xmlrpcCall(method: string, paramsXml: string): Promise<string> {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramsXml}</params></methodCall>`
  const r = await fetch(XMLRPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', 'User-Agent': UA },
    body,
  })
  return r.text()
}

async function getToken(): Promise<string> {
  const resp = await xmlrpcCall('LogIn',
    `<param><value><string></string></value></param>` +
    `<param><value><string></string></value></param>` +
    `<param><value><string>en</string></value></param>` +
    `<param><value><string>${UA}</string></value></param>`
  )
  const m = resp.match(/<name>token<\/name>\s*<value>(?:<string>)?([^<]+)(?:<\/string>)?<\/value>/)
  if (!m?.[1]) throw new Error('XML-RPC login failed')
  return m[1]
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

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url)
  const imdb_id  = url.searchParams.get('imdb_id') ?? ''
  const type     = url.searchParams.get('type') ?? 'movie'
  const languages = url.searchParams.get('languages') ?? 'en'
  const season   = url.searchParams.get('season')
  const episode  = url.searchParams.get('episode')

  if (!imdb_id) return Response.json([])

  try {
    const tok = await getToken()
    const lang3 = LANG_MAP[languages] ?? 'eng'
    const pureId = imdb_id.replace(/^tt/, '').padStart(7, '0')

    let struct =
      `<member><name>sublanguageid</name><value><string>all</string></value></member>` +
      `<member><name>imdbid</name><value><string>${pureId}</string></value></member>`
    if (type === 'tv' && season)  struct += `<member><name>season</name><value><int>${season}</int></value></member>`
    if (type === 'tv' && episode) struct += `<member><name>episode</name><value><int>${episode}</int></value></member>`

    const params =
      `<param><value><string>${tok}</string></value></param>` +
      `<param><value><array><data><value><struct>${struct}</struct></value></data></array></value></param>`

    const resp = await xmlrpcCall('SearchSubtitles', params)

    if (resp.includes('No results found') || !resp.includes('IDSubtitleFile')) {
      return Response.json([])
    }

    const ids   = extractField(resp, 'IDSubtitleFile')
    const names = extractField(resp, 'MovieReleaseName')
    const langs = extractField(resp, 'SubLanguageID')

    const matchIdx = ids
      .map((_, i) => langs[i]?.toLowerCase() === lang3.toLowerCase() ? i : -1)
      .filter(i => i >= 0)

    // No fallback — if the requested language isn't found return empty so the
    // UI shows "No subtitles found" instead of silently showing wrong-language results.
    if (matchIdx.length === 0) return Response.json([])

    const results = matchIdx.slice(0, 20).map(i => ({
      fileId:       ids[i],
      language:     langs[i] ?? lang3,
      languageName: languages,
      releaseName:  names[i] ?? ids[i],
    }))

    return Response.json(results)
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'Search failed' }, { status: 502 })
  }
}
