// Cloudflare Pages Function — runs on CF edge (not blocked by OpenSubtitles)
// Proxies subtitle search to OpenSubtitles REST API v1

interface Env {
  OPENSUBTITLES_API_KEY: string
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const url = new URL(request.url)
  const imdb_id  = url.searchParams.get('imdb_id') ?? ''
  const type     = url.searchParams.get('type') ?? 'movie'
  const languages = url.searchParams.get('languages') ?? 'en'
  const season   = url.searchParams.get('season')
  const episode  = url.searchParams.get('episode')

  if (!imdb_id) {
    return Response.json([], { status: 200 })
  }

  if (!env.OPENSUBTITLES_API_KEY) {
    return Response.json({ error: 'OPENSUBTITLES_API_KEY not configured in Cloudflare Pages environment variables.' }, { status: 503 })
  }

  const headers = {
    'Api-Key': env.OPENSUBTITLES_API_KEY,
    'Content-Type': 'application/json',
    'User-Agent': 'StreamTime v1.0',
  }

  const params = new URLSearchParams()
  params.set('imdb_id', imdb_id.replace(/^tt/, ''))
  if (type === 'tv') {
    params.set('type', 'episode')
    if (season)  params.set('season_number', season)
    if (episode) params.set('episode_number', episode)
  } else {
    params.set('type', 'movie')
  }
  params.set('languages', languages)

  try {
    const resp = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, { headers })
    if (!resp.ok) {
      const err: any = await resp.json().catch(() => ({}))
      return Response.json({ error: err.message ?? `OpenSubtitles API error ${resp.status}` }, { status: 502 })
    }

    const data: any = await resp.json()
    const results = (data.data ?? [])
      .filter((item: any) => item.attributes?.files?.length > 0)
      .map((item: any) => ({
        fileId:       String(item.attributes.files[0].file_id),
        language:     item.attributes.language,
        languageName: item.attributes.language,
        releaseName:  item.attributes.release || item.attributes.files[0].file_name || '',
      }))

    return Response.json(results)
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
