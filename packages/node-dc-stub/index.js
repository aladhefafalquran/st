// Stub - no native binary available on this platform (Android ARM64)
const noop = () => {}
const NoopClass = class {
  constructor() {}
  close() {}
  destroy() {}
}

export const PeerConnection = NoopClass
export const DataChannel = NoopClass
export const Track = NoopClass
export const RtcpReceivingSession = NoopClass
export const Video = NoopClass
export const Audio = NoopClass
export const Direction = { SendOnly: 0, RecvOnly: 1, SendRecv: 2, Inactive: 3 }
export const LogLevel = { Verbose: 0, Debug: 1, Info: 2, Warning: 3, Error: 4, Fatal: 5 }
export const cleanup = noop
export const initLogger = noop
export const disableLog = noop
export const disableAutoLog = noop
export const preload = noop

export default {
  PeerConnection: NoopClass,
  DataChannel: NoopClass,
  Track: NoopClass,
  RtcpReceivingSession: NoopClass,
  Video: NoopClass,
  Audio: NoopClass,
  Direction: { SendOnly: 0, RecvOnly: 1, SendRecv: 2, Inactive: 3 },
  LogLevel: {},
  cleanup: noop,
  initLogger: noop,
  disableLog: noop,
  preload: noop,
}
