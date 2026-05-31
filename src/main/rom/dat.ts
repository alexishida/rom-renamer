import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { Config, MatchSource } from '@shared/types'

export interface DatMatch {
  name: string
  source: Exclude<MatchSource, null>
}

export interface DatIndex {
  byCrc32: Map<string, DatMatch>
  byMd5: Map<string, DatMatch>
  bySha1: Map<string, DatMatch>
}

const GAME_BLOCK_PATTERN = /<(game|machine)\b([^>]*)>([\s\S]*?)<\/\1>/gi
const ROM_TAG_PATTERN = /<rom\b([^>]*)\/?>/gi
const ATTR_PATTERN = /\b([a-zA-Z0-9_-]+)="([^"]*)"/g

export async function createDatIndex(config: Config): Promise<DatIndex> {
  const index: DatIndex = {
    byCrc32: new Map(),
    byMd5: new Map(),
    bySha1: new Map(),
  }

  await addDatPath(index, config.datPaths.noIntro, 'no-intro')
  await addDatPath(index, config.datPaths.redump, 'redump')

  return index
}

export function findDatMatch(
  index: DatIndex,
  hashes: { crc32: string | null; md5: string | null; sha1: string | null },
): DatMatch | null {
  if (hashes.sha1) {
    const match = index.bySha1.get(normalizeHash(hashes.sha1))
    if (match) return match
  }

  if (hashes.md5) {
    const match = index.byMd5.get(normalizeHash(hashes.md5))
    if (match) return match
  }

  if (hashes.crc32) {
    const match = index.byCrc32.get(normalizeHash(hashes.crc32))
    if (match) return match
  }

  return null
}

async function addDatPath(index: DatIndex, datPath: string, source: Exclude<MatchSource, null>): Promise<void> {
  const trimmed = datPath.trim()
  if (!trimmed) return

  for (const filePath of await collectDatFiles(trimmed)) {
    await parseDatFile(index, filePath, source)
  }
}

async function collectDatFiles(inputPath: string): Promise<string[]> {
  try {
    const entry = await stat(inputPath)
    if (entry.isFile()) return [inputPath]
    if (!entry.isDirectory()) return []

    const files: string[] = []
    const entries = await readdir(inputPath, { withFileTypes: true })
    for (const child of entries) {
      const childPath = join(inputPath, child.name)
      if (child.isDirectory()) {
        files.push(...(await collectDatFiles(childPath)))
      } else if (child.isFile() && ['.dat', '.xml'].includes(extname(child.name).toLowerCase())) {
        files.push(childPath)
      }
    }
    return files
  } catch {
    return []
  }
}

async function parseDatFile(index: DatIndex, filePath: string, source: Exclude<MatchSource, null>): Promise<void> {
  const content = await readFile(filePath, 'utf8')

  for (const gameMatch of content.matchAll(GAME_BLOCK_PATTERN)) {
    const gameAttrs = parseAttributes(gameMatch[2] ?? '')
    const block = gameMatch[3] ?? ''
    const gameName = decodeXml(gameAttrs.get('name') ?? '').trim()

    for (const romMatch of block.matchAll(ROM_TAG_PATTERN)) {
      const attrs = parseAttributes(romMatch[1] ?? '')
      const name = gameName || decodeXml(attrs.get('name') ?? '').trim()
      if (!name) continue

      const datMatch: DatMatch = { name, source }
      const crc = attrs.get('crc')
      const md5 = attrs.get('md5')
      const sha1 = attrs.get('sha1')

      if (crc) index.byCrc32.set(normalizeHash(crc), datMatch)
      if (md5) index.byMd5.set(normalizeHash(md5), datMatch)
      if (sha1) index.bySha1.set(normalizeHash(sha1), datMatch)
    }
  }
}

function parseAttributes(value: string): Map<string, string> {
  const attrs = new Map<string, string>()

  for (const match of value.matchAll(ATTR_PATTERN)) {
    const key = match[1]
    const attrValue = match[2]
    if (key && attrValue !== undefined) attrs.set(key.toLowerCase(), attrValue)
  }

  return attrs
}

function normalizeHash(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
