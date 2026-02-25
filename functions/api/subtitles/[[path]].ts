// Catch-all for /api/subtitles/* — prevents CF Pages from 403ing any path
// under this directory that doesn't match a specific Function.
// Old client builds may call /api/subtitles/:imdbId directly (no /search segment).
// We redirect those to the correct /api/subtitles/search?imdb_id=:id endpoint.

interface Env {
  OPENSUBTITLES_API_KEY: string
}

export const onRequestGet = async ({ request, params, env }: { request: Request; params: any; env: Env }) => {
  const url = new URL(request.url)

  // Extract the first path segment (e.g. "tt0182576" from /api/subtitles/tt0182576)
  const pathParts: string[] = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)
  const segment = pathParts[0] ?? ''

  // If it looks like an IMDB ID, redirect to the proper search endpoint
  if (/^tt\d+$/i.test(segment) || /^\d+$/.test(segment)) {
    const searchUrl = new URL(url)
    searchUrl.pathname = '/api/subtitles/search'
    searchUrl.searchParams.set('imdb_id', segment)
    if (!searchUrl.searchParams.has('languages')) searchUrl.searchParams.set('languages', 'en')
    return Response.redirect(searchUrl.toString(), 302)
  }

  return Response.json({ error: `Unknown subtitle route: ${segment}` }, { status: 404 })
}
