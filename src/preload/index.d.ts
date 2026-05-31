import type { RomRenamerApi } from './index'

declare global {
  interface Window {
    api: RomRenamerApi
  }
}

export {}
