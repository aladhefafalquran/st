export interface TorrentOption {
  hash: string
  magnet: string
  quality: string
  type: string
  size: string
  sizeMB: number
  seeds: number
  peers: number
  source: string
  fileIdx?: number
  filename?: string
}
