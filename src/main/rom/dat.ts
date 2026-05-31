import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { app } from 'electron'
import type { MatchSource } from '@shared/types'

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

const CATALOG_DB_FILE = 'rom-catalog.sqlite'
const CATALOG_SCHEMA_VERSION = '1'

export async function createDatIndex(): Promise<DatIndex> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

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

function normalizeHash(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function isDatSource(value: unknown): value is DatSource {
  return value === 'no-intro' || value === 'redump'
}
