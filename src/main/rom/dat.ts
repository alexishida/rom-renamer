import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { app } from 'electron'
import type { Config, MatchSource } from '@shared/types'

type DatSource = Extract<MatchSource, 'no-intro' | 'redump'>

export interface DatMatch {
  name: string
  source: DatSource
}

export interface DatIndex {
  db: DatabaseSync
  byCrc32: StatementSync
  byMd5: StatementSync
  bySha1: StatementSync
  entries: number
}

interface CatalogFileRow {
  id: number
  file_size: number
  mtime_ms: number
}

interface ParsedCatalogMetadata {
  name: string | null
  version: string | null
}

interface ParsedRomEntry {
  gameName: string
  romName: string
  size: number | null
  crc32: string | null
  md5: string | null
  sha1: string | null
  sha256: string | null
}

const CATALOG_DB_FILE = 'rom-catalog.sqlite'
const CATALOG_SCHEMA_VERSION = '1'
const GAME_BLOCK_PATTERN = /<(game|machine)\b([^>]*)>([\s\S]*?)<\/\1>/gi
const ROM_TAG_PATTERN = /<rom\b([^>]*)\/?>/gi
const ATTR_PATTERN = /\b([a-zA-Z0-9_-]+)="([^"]*)"/g
const DAT_EXTENSIONS = new Set(['.dat', '.xml'])

export async function createDatIndex(config: Config): Promise<DatIndex> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

    await syncDatPath(db, config.datPaths.noIntro, 'no-intro')
    await syncDatPath(db, config.datPaths.redump, 'redump')

    return {
      db,
      byCrc32: prepareLookup(db, 'crc32'),
      byMd5: prepareLookup(db, 'md5'),
      bySha1: prepareLookup(db, 'sha1'),
      entries: countCatalogEntries(db),
    }
  } catch (error) {
    db.close()
    throw error
  }
}

export function closeDatIndex(index: DatIndex): void {
  index.db.close()
}

export function findDatMatch(
  index: DatIndex,
  hashes: { crc32: string | null; md5: string | null; sha1: string | null },
): DatMatch | null {
  if (hashes.sha1) {
    const match = lookupHash(index.bySha1, hashes.sha1)
    if (match) return match
  }

  if (hashes.md5) {
    const match = lookupHash(index.byMd5, hashes.md5)
    if (match) return match
  }

  if (hashes.crc32) {
    const match = lookupHash(index.byCrc32, hashes.crc32)
    if (match) return match
  }

  return null
}

async function ensureCatalogDatabase(): Promise<string> {
  const path = catalogDatabasePath()
  await mkdir(dirname(path), { recursive: true })

  if (existsSync(path)) return path

  const seedPath = bundledCatalogDatabasePath()
  if (seedPath !== path && existsSync(seedPath)) {
    await copyFile(seedPath, path)
  }

  return path
}

function catalogDatabasePath(): string {
  return join(app.getPath('userData'), CATALOG_DB_FILE)
}

function bundledCatalogDatabasePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, CATALOG_DB_FILE)
    : join(process.cwd(), 'resources', CATALOG_DB_FILE)
}

function initCatalogSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_files (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('no-intro', 'redump')),
      catalog_name TEXT,
      catalog_version TEXT,
      file_size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roms (
      id INTEGER PRIMARY KEY,
      catalog_file_id INTEGER NOT NULL REFERENCES catalog_files(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('no-intro', 'redump')),
      game_name TEXT NOT NULL,
      rom_name TEXT NOT NULL,
      size INTEGER,
      crc32 TEXT,
      md5 TEXT,
      sha1 TEXT,
      sha256 TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_roms_crc32 ON roms(crc32);
    CREATE INDEX IF NOT EXISTS idx_roms_md5 ON roms(md5);
    CREATE INDEX IF NOT EXISTS idx_roms_sha1 ON roms(sha1);
  `)

  db.prepare(`
    INSERT INTO catalog_meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(CATALOG_SCHEMA_VERSION)
}

async function syncDatPath(db: DatabaseSync, datPath: string, fallbackSource: DatSource): Promise<void> {
  const trimmed = datPath.trim()
  if (!trimmed) return

  for (const filePath of await collectDatFiles(trimmed)) {
    await syncDatFile(db, filePath, fallbackSource)
  }
}

async function collectDatFiles(inputPath: string): Promise<string[]> {
  try {
    const entry = await stat(inputPath)
    if (entry.isFile() && DAT_EXTENSIONS.has(extname(inputPath).toLowerCase())) return [resolve(inputPath)]
    if (!entry.isDirectory()) return []

    const files: string[] = []
    const entries = await readdir(inputPath, { withFileTypes: true })
    for (const child of entries) {
      const childPath = join(inputPath, child.name)
      if (child.isDirectory()) {
        files.push(...(await collectDatFiles(childPath)))
      } else if (child.isFile() && DAT_EXTENSIONS.has(extname(child.name).toLowerCase())) {
        files.push(resolve(childPath))
      }
    }
    return files
  } catch {
    return []
  }
}

async function syncDatFile(db: DatabaseSync, filePath: string, fallbackSource: DatSource): Promise<void> {
  const resolvedPath = resolve(filePath)
  const fileStats = await stat(resolvedPath)
  const fileSize = fileStats.size
  const mtimeMs = Math.round(fileStats.mtimeMs)
  const existing = readCatalogFileRow(db, resolvedPath)

  if (existing && existing.file_size === fileSize && existing.mtime_ms === mtimeMs) {
    return
  }

  const content = await readFile(resolvedPath, 'utf8')
  const metadata = parseCatalogMetadata(content)
  const source = inferDatSource(content, fallbackSource)
  const importedAt = new Date().toISOString()

  const insertFile = db.prepare(`
    INSERT INTO catalog_files (
      path, file_name, source, catalog_name, catalog_version, file_size, mtime_ms, imported_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const updateFile = db.prepare(`
    UPDATE catalog_files
    SET file_name = ?,
        source = ?,
        catalog_name = ?,
        catalog_version = ?,
        file_size = ?,
        mtime_ms = ?,
        imported_at = ?
    WHERE id = ?
  `)
  const deleteRoms = db.prepare('DELETE FROM roms WHERE catalog_file_id = ?')
  const insertRom = db.prepare(`
    INSERT INTO roms (
      catalog_file_id, source, game_name, rom_name, size, crc32, md5, sha1, sha256
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    const catalogFileId = existing
      ? existing.id
      : Number(insertFile.run(
          resolvedPath,
          basename(resolvedPath),
          source,
          metadata.name,
          metadata.version,
          fileSize,
          mtimeMs,
          importedAt,
        ).lastInsertRowid)

    if (existing) {
      deleteRoms.run(existing.id)
      updateFile.run(
        basename(resolvedPath),
        source,
        metadata.name,
        metadata.version,
        fileSize,
        mtimeMs,
        importedAt,
        existing.id,
      )
    }

    for (const entry of parseDatContent(content)) {
      insertRom.run(
        catalogFileId,
        source,
        entry.gameName,
        entry.romName,
        entry.size,
        entry.crc32,
        entry.md5,
        entry.sha1,
        entry.sha256,
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function readCatalogFileRow(db: DatabaseSync, filePath: string): CatalogFileRow | null {
  const row = db.prepare(`
    SELECT id, file_size, mtime_ms
    FROM catalog_files
    WHERE path = ?
  `).get(filePath)

  if (!row) return null

  return {
    id: Number(row.id),
    file_size: Number(row.file_size),
    mtime_ms: Number(row.mtime_ms),
  }
}

function prepareLookup(db: DatabaseSync, column: 'crc32' | 'md5' | 'sha1'): StatementSync {
  return db.prepare(`
    SELECT game_name AS name, source
    FROM roms
    WHERE ${column} = ?
    ORDER BY CASE source
      WHEN 'no-intro' THEN 0
      WHEN 'redump' THEN 1
      ELSE 2
    END, game_name
    LIMIT 1
  `)
}

function lookupHash(statement: StatementSync, hash: string): DatMatch | null {
  const row = statement.get(normalizeHash(hash))
  if (!row) return null

  const name = row.name
  const source = row.source
  if (typeof name !== 'string' || !isDatSource(source)) return null

  return { name, source }
}

function countCatalogEntries(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM roms').get()
  return Number(row?.total ?? 0)
}

function* parseDatContent(content: string): Generator<ParsedRomEntry> {
  for (const gameMatch of content.matchAll(GAME_BLOCK_PATTERN)) {
    const gameAttrs = parseAttributes(gameMatch[2] ?? '')
    const block = gameMatch[3] ?? ''
    const gameName = decodeXml(gameAttrs.get('name') ?? '').trim()

    for (const romMatch of block.matchAll(ROM_TAG_PATTERN)) {
      const attrs = parseAttributes(romMatch[1] ?? '')
      const romName = decodeXml(attrs.get('name') ?? '').trim()
      const matchName = gameName || romName
      if (!matchName) continue

      yield {
        gameName: matchName,
        romName: romName || matchName,
        size: parseInteger(attrs.get('size')),
        crc32: normalizeNullableHash(attrs.get('crc')),
        md5: normalizeNullableHash(attrs.get('md5')),
        sha1: normalizeNullableHash(attrs.get('sha1')),
        sha256: normalizeNullableHash(attrs.get('sha256')),
      }
    }
  }
}

function parseCatalogMetadata(content: string): ParsedCatalogMetadata {
  const header = /<header\b[^>]*>([\s\S]*?)<\/header>/i.exec(content)?.[1] ?? ''

  return {
    name: parseTagText(header, 'name'),
    version: parseTagText(header, 'version'),
  }
}

function parseTagText(content: string, tagName: 'name' | 'version'): string | null {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(content)
  const value = decodeXml(match?.[1] ?? '').trim()
  return value || null
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

function parseInteger(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function normalizeNullableHash(value: string | undefined): string | null {
  if (!value) return null
  const normalized = normalizeHash(value)
  return normalized || null
}

function normalizeHash(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function inferDatSource(content: string, fallbackSource: DatSource): DatSource {
  const sample = content.slice(0, 5000).toLowerCase()
  if (sample.includes('redump')) return 'redump'
  if (sample.includes('no-intro')) return 'no-intro'
  return fallbackSource
}

function isDatSource(value: unknown): value is DatSource {
  return value === 'no-intro' || value === 'redump'
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
