import type { Config, Hashes, MatchSource, PlatformName } from '@shared/types'
import { normalizeNameForSearch, preserveNameMetadata, toCatalogTitle } from './naming'

const APP_NAME = 'rom-renamer'
const IGDB_ENDPOINT = 'https://api.igdb.com/v4/games'
const SCREEN_SCRAPER_ENDPOINT = 'https://api.screenscraper.fr/api2/jeuRecherche.php'

interface ApiLookupInput {
  filePath: string
  originalName: string
  platform: PlatformName | null
  hashes: Hashes
  config: Config
}

export interface ApiMatch {
  name: string
  source: Exclude<MatchSource, 'fuzzy' | null>
  coverUrl: string | null
}

interface ScreenScraperSearchResponse {
  response?: {
    jeux?: Array<{
      noms?: {
        nom_us?: string
        nom_eu?: string
        nom_jp?: string
        nom_recalbox?: string
        nom_ss?: string
      }
      medias?: Array<{
        type?: string
        url?: string
      }>
    }>
  }
}

interface IgdbGame {
  name?: string
  cover?: {
    url?: string
  }
}

export async function findApiMatch(input: ApiLookupInput): Promise<ApiMatch | null> {
  const screenScraperMatch = await findScreenScraperMatch(input)
  if (screenScraperMatch) return screenScraperMatch

  return findIgdbMatch(input)
}

async function findScreenScraperMatch({
  filePath,
  originalName,
  platform,
  config,
}: ApiLookupInput): Promise<ApiMatch | null> {
  const devId = process.env.SCREEN_SCRAPER_DEV_ID?.trim()
  const devPassword = process.env.SCREEN_SCRAPER_DEV_PASSWORD?.trim()
  const user = config.api.screenScraperUser.trim()
  const password = config.api.screenScraperPassword.trim()
  const search = normalizeNameForSearch(filePath)

  if (!devId || !devPassword || !user || !password || !search) return null

  const url = new URL(SCREEN_SCRAPER_ENDPOINT)
  url.searchParams.set('devid', devId)
  url.searchParams.set('devpassword', devPassword)
  url.searchParams.set('softname', APP_NAME)
  url.searchParams.set('output', 'json')
  url.searchParams.set('ssid', user)
  url.searchParams.set('sspassword', password)
  url.searchParams.set('recherche', search)

  const systemId = toScreenScraperSystemId(platform)
  if (systemId) url.searchParams.set('systemeid', systemId)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) return null

    const payload = (await response.json()) as ScreenScraperSearchResponse
    const game = payload.response?.jeux?.[0]
    const rawName =
      game?.noms?.nom_us
      ?? game?.noms?.nom_eu
      ?? game?.noms?.nom_recalbox
      ?? game?.noms?.nom_ss
      ?? game?.noms?.nom_jp

    const name = rawName?.trim()
    if (!name) return null

    return {
      name: preserveNameMetadata(name, originalName),
      source: 'screenscraper',
      coverUrl: findScreenScraperCover(game?.medias),
    }
  } catch {
    return null
  }
}

async function findIgdbMatch({
  filePath,
  originalName,
  platform,
  config,
}: ApiLookupInput): Promise<ApiMatch | null> {
  const clientId = config.api.igdbClientId.trim()
  const token = config.api.igdbToken.trim()
  const search = normalizeNameForSearch(filePath)

  if (!clientId || !token || !search) return null

  const where = buildIgdbWhereClause(platform)
  const body = [
    'fields name,cover.url;',
    `search "${escapeIgdbString(toCatalogTitle(search))}";`,
    where,
    'limit 1;',
  ]
    .filter(Boolean)
    .join(' ')

  try {
    const response = await fetch(IGDB_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
      body,
    })
    if (!response.ok) return null

    const payload = (await response.json()) as IgdbGame[]
    const game = payload[0]
    const name = game?.name?.trim()
    if (!name) return null

    return {
      name: preserveNameMetadata(name, originalName),
      source: 'igdb',
      coverUrl: normalizeIgdbCoverUrl(game?.cover?.url),
    }
  } catch {
    return null
  }
}

function buildIgdbWhereClause(platform: PlatformName | null): string {
  const ids = toIgdbPlatformIds(platform)
  return ids.length ? `where version_parent = null & platforms = (${ids.join(',')});` : 'where version_parent = null;'
}

function escapeIgdbString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeIgdbCoverUrl(value: string | undefined): string | null {
  if (!value) return null
  if (value.startsWith('//')) return `https:${value}`
  return value
}

function findScreenScraperCover(
  medias: Array<{ type?: string; url?: string }> | undefined,
): string | null {
  if (!medias?.length) return null

  const preferred = ['box-2D', 'box-3D', 'wheel', 'sstitle', 'screenmarquee']
  for (const type of preferred) {
    const media = medias.find((entry) => entry.type === type && entry.url)
    if (media?.url) return media.url
  }

  return medias.find((entry) => entry.url)?.url ?? null
}

function toScreenScraperSystemId(platform: PlatformName | null): string | null {
  switch (platform) {
    case 'NES':
      return '3'
    case 'SNES':
      return '4'
    case 'Nintendo 64':
      return '14'
    case 'Game Boy':
      return '9'
    case 'Game Boy Color':
      return '10'
    case 'Game Boy Advance':
      return '12'
    case 'Nintendo DS':
      return '15'
    case 'Nintendo 3DS':
      return '17'
    case 'GameCube':
      return '13'
    case 'Wii':
      return '16'
    case 'Wii U':
      return '18'
    case 'Master System':
      return '2'
    case 'Game Gear':
      return '21'
    case 'Mega Drive':
      return '1'
    case 'Sega 32X':
      return '19'
    case 'Mega CD':
      return '20'
    case 'Sega Saturn':
      return '22'
    case 'Dreamcast':
      return '23'
    case 'PlayStation 1':
      return '57'
    case 'PlayStation 2':
      return '58'
    case 'PlayStation 3':
      return '59'
    case 'PlayStation Portable':
      return '61'
    case 'Atari 2600':
      return '26'
    case 'Atari 7800':
      return '27'
    case 'Atari Jaguar':
      return '28'
    case 'Neo Geo':
      return '142'
    case 'Neo Geo Pocket':
      return '25'
    case 'PC Engine':
      return '31'
    case 'WonderSwan':
      return '45'
    default:
      return null
  }
}

function toIgdbPlatformIds(platform: PlatformName | null): number[] {
  switch (platform) {
    case 'NES':
      return [18]
    case 'SNES':
      return [19]
    case 'Nintendo 64':
      return [4]
    case 'Game Boy':
      return [33]
    case 'Game Boy Color':
      return [22]
    case 'Game Boy Advance':
      return [24]
    case 'Nintendo DS':
      return [20]
    case 'Nintendo 3DS':
      return [37]
    case 'GameCube':
      return [21]
    case 'Wii':
      return [5]
    case 'Wii U':
      return [41]
    case 'Master System':
      return [64]
    case 'Game Gear':
      return [35]
    case 'Mega Drive':
      return [29]
    case 'Sega 32X':
      return [30]
    case 'Mega CD':
      return [78]
    case 'Sega Saturn':
      return [32]
    case 'Dreamcast':
      return [23]
    case 'PlayStation 1':
      return [7]
    case 'PlayStation 2':
      return [8]
    case 'PlayStation 3':
      return [9]
    case 'PlayStation Portable':
      return [38]
    case 'Atari 2600':
      return [59]
    case 'Atari 7800':
      return [60]
    case 'Atari Jaguar':
      return [62]
    case 'Neo Geo':
      return [79]
    case 'Neo Geo Pocket':
      return [120]
    case 'PC Engine':
      return [86]
    case 'WonderSwan':
      return [123]
    default:
      return []
  }
}

export function hasConfiguredApiFallback(config: Config): boolean {
  const hasIgdb = Boolean(config.api.igdbClientId.trim() && config.api.igdbToken.trim())
  const hasScreenScraper = Boolean(
    process.env.SCREEN_SCRAPER_DEV_ID?.trim()
    && process.env.SCREEN_SCRAPER_DEV_PASSWORD?.trim()
    && config.api.screenScraperUser.trim()
    && config.api.screenScraperPassword.trim(),
  )

  return hasIgdb || hasScreenScraper
}

export function describeApiFallback(config: Config): string {
  const providers: string[] = []
  if (process.env.SCREEN_SCRAPER_DEV_ID?.trim() && process.env.SCREEN_SCRAPER_DEV_PASSWORD?.trim()) {
    if (config.api.screenScraperUser.trim() && config.api.screenScraperPassword.trim()) {
      providers.push('ScreenScraper')
    }
  }
  if (config.api.igdbClientId.trim() && config.api.igdbToken.trim()) {
    providers.push('IGDB')
  }

  return providers.join(' e ')
}
