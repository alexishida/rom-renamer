import { basename, dirname, extname } from 'node:path'
import type { PlatformName } from '@shared/types'

export const SUPPORTED_EXTENSIONS = new Set([
  // NES
  '.nes', '.unf',
  // SNES
  '.sfc', '.smc',
  // Nintendo 64
  '.z64', '.n64', '.v64',
  // Game Boy / Color / Advance
  '.gb', '.gbc', '.gba',
  // Nintendo DS / 3DS
  '.nds', '.3ds',
  // GameCube
  '.gcm', '.rvz',
  // Wii
  '.wbfs', '.wia',
  // Wii U
  '.wud', '.wux',
  // Master System
  '.sms',
  // Game Gear
  '.gg',
  // Mega Drive
  '.md', '.gen',
  // Sega 32X
  '.32x',
  // Dreamcast
  '.gdi', '.cdi',
  // PSP
  '.cso',
  // PlayStation 3
  '.pkg',
  // Atari 2600
  '.a26',
  // Atari 7800
  '.a78',
  // Atari Jaguar
  '.j64', '.jag',
  // Neo Geo
  '.neo',
  // Neo Geo Pocket / Color
  '.ngp', '.ngc',
  // PC Engine / TurboGrafx
  '.pce',
  // WonderSwan / Color
  '.ws', '.wsc',
  // Shared / ambiguous
  '.bin', '.cue', '.iso', '.chd', '.img', '.pbp',
])

export function isSupportedRomPath(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function detectPlatform(filePath: string): PlatformName | null {
  const ext = extname(filePath).toLowerCase()
  const hint = buildHint(filePath)

  switch (ext) {
    // Unique extensions — no ambiguity
    case '.nes': case '.unf': return 'NES'
    case '.sfc': case '.smc': return 'SNES'
    case '.z64': case '.n64': case '.v64': return 'Nintendo 64'
    case '.gb': return 'Game Boy'
    case '.gbc': return 'Game Boy Color'
    case '.gba': return 'Game Boy Advance'
    case '.nds': return 'Nintendo DS'
    case '.3ds': return 'Nintendo 3DS'
    case '.gcm': case '.rvz': return 'GameCube'
    case '.wbfs': case '.wia': return 'Wii'
    case '.wud': case '.wux': return 'Wii U'
    case '.sms': return 'Master System'
    case '.gg': return 'Game Gear'
    case '.md': case '.gen': return 'Mega Drive'
    case '.32x': return 'Sega 32X'
    case '.gdi': case '.cdi': return 'Dreamcast'
    case '.cso': return 'PlayStation Portable'
    case '.pkg': return 'PlayStation 3'
    case '.a26': return 'Atari 2600'
    case '.a78': return 'Atari 7800'
    case '.j64': case '.jag': return 'Atari Jaguar'
    case '.neo': return 'Neo Geo'
    case '.ngp': case '.ngc': return 'Neo Geo Pocket'
    case '.pce': return 'PC Engine'
    case '.ws': case '.wsc': return 'WonderSwan'

    // Ambiguous extensions — resolved by hint
    case '.bin':  return disambiguateBin(hint)
    case '.cue':  return disambiguateCue(hint)
    case '.img':  return disambiguateImg(hint)
    case '.pbp':  return disambiguatePbp(hint)
    case '.iso':  return disambiguateIso(hint)
    case '.chd':  return disambiguateChd(hint)
  }

  return null
}

export function needsN64ByteOrderNormalization(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return ext === '.n64' || ext === '.v64'
}

// ---- Disambiguation helpers ----

function disambiguateBin(hint: string): PlatformName {
  if (hasAny(hint, ['megacd', 'mega cd', 'segacd', 'sega cd'])) return 'Mega CD'
  if (hasAny(hint, ['saturn', 'sega saturn']))                   return 'Sega Saturn'
  if (hasAny(hint, ['ps1', 'psx', 'playstation']))               return 'PlayStation 1'
  if (hasAny(hint, ['atari', '2600', 'a26']))                    return 'Atari 2600'
  return 'Mega Drive'
}

function disambiguateCue(hint: string): PlatformName {
  if (hasAny(hint, ['megacd', 'mega cd', 'segacd', 'sega cd'])) return 'Mega CD'
  if (hasAny(hint, ['saturn', 'sega saturn']))                   return 'Sega Saturn'
  return 'PlayStation 1'
}

function disambiguateImg(hint: string): PlatformName {
  if (hasAny(hint, ['saturn', 'sega saturn']))                   return 'Sega Saturn'
  if (hasAny(hint, ['megacd', 'mega cd', 'segacd', 'sega cd'])) return 'Mega CD'
  return 'PlayStation 1'
}

function disambiguatePbp(hint: string): PlatformName {
  if (hasAny(hint, ['psp', 'playstation portable']))             return 'PlayStation Portable'
  return 'PlayStation 1'
}

function disambiguateIso(hint: string): PlatformName {
  if (hasAny(hint, ['gamecube', 'game cube', 'ngc']))            return 'GameCube'
  if (hasAny(hint, ['psp', 'playstation portable']))             return 'PlayStation Portable'
  if (hasAny(hint, ['ps3', 'playstation3', 'playstation 3']))    return 'PlayStation 3'
  if (hasAny(hint, ['saturn', 'sega saturn']))                   return 'Sega Saturn'
  if (hasAny(hint, ['megacd', 'mega cd', 'segacd', 'sega cd'])) return 'Mega CD'
  if (hasAny(hint, ['dreamcast']))                               return 'Dreamcast'
  if (hasAny(hint, ['wii']))                                     return 'Wii'
  return 'PlayStation 2'
}

function disambiguateChd(hint: string): PlatformName {
  if (hasAny(hint, ['ps2', 'playstation 2', 'playstation2']))    return 'PlayStation 2'
  if (hasAny(hint, ['saturn', 'sega saturn']))                   return 'Sega Saturn'
  if (hasAny(hint, ['dreamcast']))                               return 'Dreamcast'
  if (hasAny(hint, ['megacd', 'mega cd', 'segacd', 'sega cd'])) return 'Mega CD'
  if (hasAny(hint, ['pce', 'pc-engine', 'pcengine', 'turbografx', 'pc engine'])) return 'PC Engine'
  if (hasAny(hint, ['psp', 'playstation portable']))             return 'PlayStation Portable'
  return 'PlayStation 1'
}

function buildHint(filePath: string): string {
  return `${dirname(filePath)} ${basename(filePath)}`.toLowerCase()
}

function hasAny(hint: string, terms: string[]): boolean {
  return terms.some((term) => hint.includes(term))
}
