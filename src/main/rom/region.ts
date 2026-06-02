import { open } from 'node:fs/promises'
import type { PlatformName, RegionName } from '@shared/types'

export async function detectRegionFromHeader(filePath: string, platform: PlatformName | null): Promise<RegionName | null> {
  switch (platform) {
    case 'Nintendo 64':
      return detectN64Region(filePath)
    case 'Game Boy':
    case 'Game Boy Color':
      return detectGameBoyRegion(filePath)
    case 'Game Boy Advance':
      return detectGbaRegion(filePath)
    case 'Nintendo DS':
      return detectNdsRegion(filePath)
    default:
      return null
  }
}

async function detectN64Region(filePath: string): Promise<RegionName | null> {
  const header = normalizeN64Header(await readHeader(filePath, 0, 0x40))
  return mapN64CountryCode(header[0x3e])
}

async function detectGameBoyRegion(filePath: string): Promise<RegionName | null> {
  const header = await readHeader(filePath, 0, 0x150)
  const destinationCode = header[0x14a]

  if (destinationCode === 0x00) return 'Japan'
  return null
}

async function detectGbaRegion(filePath: string): Promise<RegionName | null> {
  const header = await readHeader(filePath, 0, 0xb0)
  return mapNintendoProductRegion(String.fromCharCode(header[0xaf] ?? 0))
}

async function detectNdsRegion(filePath: string): Promise<RegionName | null> {
  const header = await readHeader(filePath, 0, 0x10)
  return mapNintendoProductRegion(String.fromCharCode(header[0x0f] ?? 0))
}

async function readHeader(filePath: string, position: number, length: number): Promise<Buffer> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, position)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

function normalizeN64Header(header: Buffer): Buffer {
  if (header.length < 4) return header

  const firstByte = header[0]
  if (firstByte === 0x80) return header

  const normalized = Buffer.from(header)
  if (firstByte === 0x37) {
    for (let index = 0; index + 1 < normalized.length; index += 2) {
      const left = normalized[index] ?? 0
      normalized[index] = normalized[index + 1] ?? 0
      normalized[index + 1] = left
    }
  } else if (firstByte === 0x40) {
    for (let index = 0; index + 3 < normalized.length; index += 4) {
      const first = normalized[index] ?? 0
      const second = normalized[index + 1] ?? 0
      normalized[index] = normalized[index + 3] ?? 0
      normalized[index + 1] = normalized[index + 2] ?? 0
      normalized[index + 2] = second
      normalized[index + 3] = first
    }
  }

  return normalized
}

function mapNintendoProductRegion(regionCode: string): RegionName | null {
  switch (regionCode.toUpperCase()) {
    case 'B':
      return 'Brasil'
    case 'E':
      return 'EUA'
    case 'J':
      return 'Japan'
    case 'D':
    case 'F':
    case 'H':
    case 'I':
    case 'P':
    case 'S':
    case 'X':
    case 'Y':
      return 'Europa'
    default:
      return null
  }
}

function mapN64CountryCode(countryCode: number | undefined): RegionName | null {
  switch (countryCode) {
    case 0x42:
      return 'Brasil'
    case 0x45:
      return 'EUA'
    case 0x4a:
      return 'Japan'
    case 0x44:
    case 0x46:
    case 0x48:
    case 0x49:
    case 0x50:
    case 0x53:
    case 0x55:
    case 0x57:
    case 0x58:
    case 0x59:
      return 'Europa'
    default:
      return null
  }
}
