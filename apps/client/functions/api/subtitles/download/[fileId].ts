// Cloudflare Pages Function — XML-RPC download (no user auth needed).
// The REST API /download endpoint requires a user JWT token (not just an API key),
// so we use the legacy XML-RPC API which allows anonymous download.
// file_id from the REST search response == IDSubtitleFile in XML-RPC.

const XMLRPC_URL = 'https://api.opensubtitles.org/xml-rpc'
const UA = 'StreamTime v1.0'

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
  if (!m?.[1]) throw new Error('XML-RPC login failed — no token')
  return m[1]
}

export const onRequestGet = async ({ params }: { params: { fileId: string } }) => {
  const { fileId } = params

  try {
    const token = await getToken()

    const dlParams =
      `<param><value><string>${token}</string></value></param>` +
      `<param><value><array><data><value><string>${fileId}</string></value></data></array></value></param>`

    const resp = await xmlrpcCall('DownloadSubtitles', dlParams)

    // Response has two <name>data</name> blocks:
    //   parts[1] = outer array "data"
    //   parts[2] = inner "data" = base64(gzip(SRT))
    const parts = resp.split('<name>data</name>')
    if (parts.length < 3) throw new Error(`Unexpected XML-RPC response (${parts.length} data sections)`)

    const b64 = parts[2]
      .match(/<value>\s*(?:<string>)?\s*([\s\S]*?)\s*(?:<\/string>)?\s*<\/value>/)?.[1]
      ?.replace(/\s/g, '')

    if (!b64) throw new Error('No subtitle data in XML-RPC response')

    // base64 → Uint8Array
    const binaryStr = atob(b64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    // Decompress gzip — CF Workers support the Web Streams Compression API
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    await writer.write(bytes)
    await writer.close()
    const srt = await new Response(ds.readable).text()

    // Convert SRT → VTT
    const vtt = 'WEBVTT\n\n' + srt
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    return new Response(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
