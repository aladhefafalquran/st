// Cloudflare Pages Function — runs on CF edge (not blocked by OpenSubtitles)
// Gets the download link from OS, fetches the file, converts SRT→VTT, returns text/vtt

interface Env {
  OPENSUBTITLES_API_KEY: string
}

export const onRequestGet = async ({ params, env }: { params: { fileId: string }; env: Env }) => {
  const fileId = params.fileId

  if (!env.OPENSUBTITLES_API_KEY) {
    return Response.json({ error: 'OPENSUBTITLES_API_KEY not configured in Cloudflare Pages environment variables.' }, { status: 503 })
  }

  const osHeaders = {
    'Api-Key': env.OPENSUBTITLES_API_KEY,
    'Content-Type': 'application/json',
    'User-Agent': 'StreamTime v1.0',
  }

  try {
    // Step 1: get the download link
    const linkRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: osHeaders,
      body: JSON.stringify({ file_id: parseInt(fileId) }),
    })

    if (!linkRes.ok) {
      const err: any = await linkRes.json().catch(() => ({}))
      const msg = err.message ?? err.errors?.[0] ?? `OS API ${linkRes.status}`
      if (linkRes.status === 406) {
        return Response.json({ error: 'Daily subtitle download limit reached.' }, { status: 429 })
      }
      return Response.json({ error: msg }, { status: 500 })
    }

    const { link } = await linkRes.json() as { link: string }

    // Step 2: fetch the actual subtitle file
    const fileRes = await fetch(link)
    if (!fileRes.ok) {
      return Response.json({ error: `Subtitle file fetch failed (${fileRes.status})` }, { status: 500 })
    }

    let text = await fileRes.text()

    // Step 3: convert SRT → VTT if needed
    if (!text.startsWith('WEBVTT')) {
      text = 'WEBVTT\n\n' + text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    }

    return new Response(text, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
