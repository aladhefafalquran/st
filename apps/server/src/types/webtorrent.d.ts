declare module 'webtorrent' {
  import { EventEmitter } from 'events'
  import { Readable } from 'stream'

  export interface TorrentFile {
    name: string
    path: string
    length: number
    select(): void
    deselect(): void
    createReadStream(opts?: { start?: number; end?: number }): Readable
  }

  export interface Torrent extends EventEmitter {
    infoHash: string
    magnetURI: string
    files: TorrentFile[]
    ready: boolean
    length: number
    name: string
    numPeers: number
    downloadSpeed: number
    destroy(cb?: () => void): void
    on(event: 'ready', listener: () => void): this
    on(event: 'error', listener: (err: Error | string) => void): this
    once(event: 'ready', listener: () => void): this
    once(event: 'error', listener: (err: Error | string) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
  }

  export interface WebTorrentOptions {
    maxConns?: number
    tracker?: boolean | object
    dht?: boolean | object
    utp?: boolean
  }

  class WebTorrent extends EventEmitter {
    constructor(opts?: WebTorrentOptions)
    torrents: Torrent[]
    add(
      torrentId: string | Buffer | object,
      opts?: object,
      cb?: (torrent: Torrent) => void,
    ): Torrent
    get(torrentId: string): Torrent | null
    destroy(cb?: () => void): void
    once(event: 'error', listener: (err: Error | string) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
  }

  export default WebTorrent
}
