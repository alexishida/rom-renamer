import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { app } from 'electron'
import { normalizeCatalogName } from './naming'
import type {
  CatalogDeleteResult,
  CatalogFileSummary,
  CatalogImportFileResult,
  CatalogImportResult,
  CatalogSearchResult,
  CatalogSource,
} from '@shared/types'

type DatSource = CatalogSource

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
const CATALOG_SCHEMA_VERSION = '2'
const DAT_EXTENSIONS = new Set(['.dat', '.xml'])
const GAME_BLOCK_PATTERN = /<(game|machine)\b([^>]*)>([\s\S]*?)<\/\1>/gi
const ROM_TAG_PATTERN = /<rom\b([^>]*)\/?>/gi
const ATTR_PATTERN = /\b([a-zA-Z0-9_-]+)="([^"]*)"/g
const FUZZY_AUTO_MIN_SCORE = 86
const FUZZY_SEARCH_MIN_SCORE = 55
const MAX_FUZZY_CANDIDATES = 700
const FUZZY_STOP_WORDS = new Set(['a', 'an', 'and', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'la', 'le', 'no', 'of', 'the'])

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

export function findFuzzyDatMatch(index: DatIndex, query: string): DatMatch | null {
  const best = rankFuzzyRows(query, fuzzyCatalogCandidates(index.db, query), FUZZY_AUTO_MIN_SCORE, 1)[0]
  if (!best) return null

  const name = best.row.name
  const source = best.row.source
  if (typeof name !== 'string' || !isDatSource(source)) return null

  return { name, source }
}

export async function importDatFiles(filePaths: string[]): Promise<CatalogImportResult> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)
    await backfillCatalogFileHashes(db)

    const uniquePaths = uniqueResolvedPaths(filePaths)
    const files: CatalogImportFileResult[] = []

    for (const filePath of uniquePaths) {
      files.push(await importDatFile(db, filePath))
    }

    return {
      importedFiles: files.filter((file) => file.status === 'imported').length,
      skippedFiles: files.filter((file) => file.status === 'skipped').length,
      errorFiles: files.filter((file) => file.status === 'error').length,
      importedRoms: files.reduce((total, file) => total + (file.status === 'imported' ? file.roms : 0), 0),
      files,
      catalogFiles: listCatalogFilesFromDb(db),
    }
  } finally {
    db.close()
  }
}

export async function listCatalogFiles(): Promise<CatalogFileSummary[]> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)
    return listCatalogFilesFromDb(db)
  } finally {
    db.close()
  }
}

export async function deleteCatalogFile(id: number): Promise<CatalogDeleteResult> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

    const roms = countCatalogFileRoms(db, id)
    const result = db.prepare('DELETE FROM catalog_files WHERE id = ?').run(id)

    return {
      deletedFiles: Number(result.changes ?? 0),
      deletedRoms: roms,
      catalogFiles: listCatalogFilesFromDb(db),
    }
  } finally {
    db.close()
  }
}

export async function clearCatalog(): Promise<CatalogDeleteResult> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

    const deletedFiles = countCatalogFiles(db)
    const deletedRoms = countCatalogEntries(db)

    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('DELETE FROM roms').run()
      db.prepare('DELETE FROM catalog_files').run()
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    return {
      deletedFiles,
      deletedRoms,
      catalogFiles: [],
    }
  } finally {
    db.close()
  }
}

export async function searchCatalog(query: string, limit = 20): Promise<CatalogSearchResult[]> {
  const term = normalizeSearchTerm(query)
  if (term.length < 2) return []

  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(30, Math.floor(limit)))
      : 12
    const rows = searchCatalogRowsByLike(db, term, safeLimit)
    const results = dedupeCatalogResults(
      rows
        .map(toCatalogSearchResult)
        .filter((result): result is CatalogSearchResult => result !== null),
    )

    if (results.length) return results.slice(0, safeLimit)

    return dedupeCatalogResults(
      rankFuzzyRows(term, fuzzyCatalogCandidates(db, term), FUZZY_SEARCH_MIN_SCORE, safeLimit)
        .map(({ row }) => toCatalogSearchResult(row))
        .filter((result): result is CatalogSearchResult => result !== null),
    ).slice(0, safeLimit)
  } finally {
    db.close()
  }
}

export async function findCatalogSearchResultById(id: number): Promise<CatalogSearchResult | null> {
  const dbPath = await ensureCatalogDatabase()
  const db = new DatabaseSync(dbPath)

  try {
    db.exec('PRAGMA foreign_keys = ON')
    initCatalogSchema(db)

    const row = db.prepare(`
      SELECT
        id,
        game_name AS name,
        rom_name AS romName,
        source,
        size,
        crc32,
        md5,
        sha1,
        sha256
      FROM roms
      WHERE id = ?
      LIMIT 1
    `).get(id) as unknown as CatalogRow | undefined

    return toCatalogSearchResult(row)
  } finally {
    db.close()
  }
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
      file_sha256 TEXT,
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

  ensureCatalogFileHashColumn(db)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_files_file_sha256
      ON catalog_files(file_sha256)
      WHERE file_sha256 IS NOT NULL;
  `)

  db.prepare(`
    INSERT INTO catalog_meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(CATALOG_SCHEMA_VERSION)
}

function ensureCatalogFileHashColumn(db: DatabaseSync): void {
  const columns = db.prepare('PRAGMA table_info(catalog_files)').all() as unknown as CatalogColumnInfo[]
  const hasFileSha256 = columns.some((column) => column.name === 'file_sha256')
  if (!hasFileSha256) {
    db.exec('ALTER TABLE catalog_files ADD COLUMN file_sha256 TEXT')
  }
}

async function backfillCatalogFileHashes(db: DatabaseSync): Promise<void> {
  const rows = db.prepare(`
    SELECT id, path
    FROM catalog_files
    WHERE file_sha256 IS NULL
  `).all() as unknown as CatalogFileHashBackfillRow[]

  const updateHash = db.prepare(`
    UPDATE catalog_files
    SET file_sha256 = ?
    WHERE id = ? AND file_sha256 IS NULL
  `)

  for (const row of rows) {
    if (typeof row.id !== 'number' || typeof row.path !== 'string') continue

    try {
      const buffer = await readFile(row.path)
      const fileSha256 = createHash('sha256').update(buffer).digest('hex').toUpperCase()
      updateHash.run(fileSha256, row.id)
    } catch {
      // Old seed paths may not exist anymore; duplicate path protection still applies.
    }
  }
}

async function importDatFile(db: DatabaseSync, filePath: string): Promise<CatalogImportFileResult> {
  const resolvedPath = resolve(filePath)
  const fileName = basename(resolvedPath)

  try {
    if (!DAT_EXTENSIONS.has(extname(resolvedPath).toLowerCase())) {
      return importError(resolvedPath, 'Formato invalido. Use .dat ou .xml.')
    }

    const fileStats = await stat(resolvedPath)
    if (!fileStats.isFile()) {
      return importError(resolvedPath, 'Caminho nao e um arquivo DAT.')
    }

    const buffer = await readFile(resolvedPath)
    const content = buffer.toString('utf8')
    const fileSha256 = createHash('sha256').update(buffer).digest('hex').toUpperCase()
    const metadata = parseCatalogMetadata(content)
    const source = inferDatSource(content)
    const entries = [...parseDatContent(content)]

    if (!entries.length) {
      return {
        path: resolvedPath,
        fileName,
        status: 'skipped',
        message: 'Nenhuma ROM encontrada no arquivo.',
        source,
        roms: 0,
        catalogFileId: null,
      }
    }

    const duplicate = findDuplicateCatalogFile(db, resolvedPath, fileSha256)
    if (duplicate) {
      return {
        path: resolvedPath,
        fileName,
        status: 'skipped',
        message: `Arquivo ja carregado: ${duplicate.fileName}.`,
        source: duplicate.source,
        roms: duplicate.romCount,
        catalogFileId: duplicate.id,
      }
    }

    const importedAt = new Date().toISOString()
    let catalogFileId = 0

    db.exec('BEGIN IMMEDIATE')
    try {
      catalogFileId = Number(db.prepare(`
        INSERT INTO catalog_files (
          path, file_name, file_sha256, source, catalog_name, catalog_version, file_size, mtime_ms, imported_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        resolvedPath,
        fileName,
        fileSha256,
        source,
        metadata.name,
        metadata.version,
        fileStats.size,
        Math.round(fileStats.mtimeMs),
        importedAt,
      ).lastInsertRowid)

      const insertRom = db.prepare(`
        INSERT INTO roms (
          catalog_file_id, source, game_name, rom_name, size, crc32, md5, sha1, sha256
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const entry of entries) {
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

    return {
      path: resolvedPath,
      fileName,
      status: 'imported',
      message: `${entries.length} ROM(s) importada(s).`,
      source,
      roms: entries.length,
      catalogFileId,
    }
  } catch (error) {
    return importError(resolvedPath, errorMessage(error))
  }
}

function findDuplicateCatalogFile(
  db: DatabaseSync,
  filePath: string,
  fileSha256: string,
): CatalogFileSummary | null {
  const row = db.prepare(`
    SELECT
      cf.id,
      cf.path,
      cf.file_name AS fileName,
      cf.source,
      cf.catalog_name AS catalogName,
      cf.catalog_version AS catalogVersion,
      cf.file_size AS fileSize,
      cf.mtime_ms AS mtimeMs,
      cf.imported_at AS importedAt,
      cf.file_sha256 AS fileSha256,
      COUNT(r.id) AS romCount
    FROM catalog_files cf
    LEFT JOIN roms r ON r.catalog_file_id = cf.id
    WHERE cf.path = ? OR cf.file_sha256 = ?
    GROUP BY cf.id
    ORDER BY
      CASE WHEN cf.path = ? THEN 0 ELSE 1 END,
      cf.imported_at DESC
    LIMIT 1
  `).get(filePath, fileSha256, filePath) as unknown as CatalogFileRow | undefined

  return toCatalogFileSummary(row)
}

function listCatalogFilesFromDb(db: DatabaseSync): CatalogFileSummary[] {
  const rows = db.prepare(`
    SELECT
      cf.id,
      cf.path,
      cf.file_name AS fileName,
      cf.source,
      cf.catalog_name AS catalogName,
      cf.catalog_version AS catalogVersion,
      cf.file_size AS fileSize,
      cf.mtime_ms AS mtimeMs,
      cf.imported_at AS importedAt,
      cf.file_sha256 AS fileSha256,
      COUNT(r.id) AS romCount
    FROM catalog_files cf
    LEFT JOIN roms r ON r.catalog_file_id = cf.id
    GROUP BY cf.id
    ORDER BY cf.imported_at DESC, cf.file_name
  `).all() as unknown as CatalogFileRow[]

  return rows
    .map(toCatalogFileSummary)
    .filter((summary): summary is CatalogFileSummary => summary !== null)
}

function toCatalogFileSummary(row: CatalogFileRow | undefined): CatalogFileSummary | null {
  if (!row) return null
  if (typeof row.id !== 'number') return null
  if (typeof row.path !== 'string') return null
  if (typeof row.fileName !== 'string') return null
  if (!isDatSource(row.source)) return null

  return {
    id: row.id,
    path: row.path,
    fileName: row.fileName,
    source: row.source,
    catalogName: nullableString(row.catalogName),
    catalogVersion: nullableString(row.catalogVersion),
    fileSize: numberOrZero(row.fileSize),
    mtimeMs: numberOrZero(row.mtimeMs),
    importedAt: typeof row.importedAt === 'string' ? row.importedAt : '',
    romCount: numberOrZero(row.romCount),
    fileSha256: nullableString(row.fileSha256),
  }
}

function importError(filePath: string, message: string): CatalogImportFileResult {
  return {
    path: filePath,
    fileName: basename(filePath),
    status: 'error',
    message,
    source: null,
    roms: 0,
    catalogFileId: null,
  }
}

function uniqueResolvedPaths(filePaths: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const filePath of filePaths) {
    const resolvedPath = resolve(filePath)
    const key = resolvedPath.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(resolvedPath)
  }

  return unique
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

function searchCatalogRowsByLike(db: DatabaseSync, term: string, limit: number): CatalogRow[] {
  const fetchLimit = Math.min(90, limit * 4)
  const escapedTerm = escapeLikeTerm(term)
  const containsTerm = `%${escapedTerm}%`
  const prefixTerm = `${escapedTerm}%`

  return db.prepare(`
    SELECT
      id,
      game_name AS name,
      rom_name AS romName,
      source,
      size,
      crc32,
      md5,
      sha1,
      sha256
    FROM roms
    WHERE game_name LIKE ? ESCAPE '!' OR rom_name LIKE ? ESCAPE '!'
    ORDER BY
      CASE
        WHEN game_name = ? COLLATE NOCASE THEN 0
        WHEN game_name LIKE ? ESCAPE '!' THEN 1
        WHEN rom_name LIKE ? ESCAPE '!' THEN 2
        ELSE 3
      END,
      CASE source
        WHEN 'no-intro' THEN 0
        WHEN 'redump' THEN 1
        ELSE 2
      END,
      game_name,
      rom_name
    LIMIT ?
  `).all(containsTerm, containsTerm, term, prefixTerm, prefixTerm, fetchLimit) as unknown as CatalogRow[]
}

function fuzzyCatalogCandidates(db: DatabaseSync, query: string): CatalogRow[] {
  const anchors = fuzzyAnchors(query)
  if (!anchors.length) return []

  const clauses: string[] = []
  const params: Array<string | number> = []

  for (const anchor of anchors) {
    const containsTerm = `%${escapeLikeTerm(anchor)}%`
    clauses.push("game_name LIKE ? ESCAPE '!'")
    params.push(containsTerm)
    clauses.push("rom_name LIKE ? ESCAPE '!'")
    params.push(containsTerm)

    const prefix = anchor.slice(0, Math.min(3, anchor.length))
    if (prefix.length >= 2) {
      const prefixTerm = `${escapeLikeTerm(prefix)}%`
      clauses.push("game_name LIKE ? ESCAPE '!'")
      params.push(prefixTerm)
      clauses.push("rom_name LIKE ? ESCAPE '!'")
      params.push(prefixTerm)
    }
  }

  params.push(MAX_FUZZY_CANDIDATES)

  return db.prepare(`
    SELECT
      id,
      game_name AS name,
      rom_name AS romName,
      source,
      size,
      crc32,
      md5,
      sha1,
      sha256
    FROM roms
    WHERE ${clauses.join(' OR ')}
    ORDER BY
      CASE source
        WHEN 'no-intro' THEN 0
        WHEN 'redump' THEN 1
        ELSE 2
      END,
      game_name,
      rom_name
    LIMIT ?
  `).all(...params) as unknown as CatalogRow[]
}

function rankFuzzyRows(
  query: string,
  rows: CatalogRow[],
  minScore: number,
  limit: number,
): ScoredCatalogRow[] {
  const queryKey = matchKey(query)
  if (!queryKey) return []

  return rows
    .map((row) => ({
      row,
      score: catalogRowScore(queryKey, row),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return catalogRowSourceRank(left.row) - catalogRowSourceRank(right.row)
    })
    .slice(0, limit)
}

function catalogRowScore(queryKey: string, row: CatalogRow): number {
  return Math.max(
    fuzzyScore(queryKey, typeof row.name === 'string' ? matchKey(row.name) : ''),
    fuzzyScore(queryKey, typeof row.romName === 'string' ? matchKey(row.romName) : ''),
  )
}

function fuzzyScore(queryKey: string, candidateKey: string): number {
  if (!queryKey || !candidateKey) return 0
  if (queryKey === candidateKey) return 100
  if (candidateKey.startsWith(`${queryKey} `)) return 93
  if (queryKey.startsWith(`${candidateKey} `)) return 78

  const queryTokens = queryKey.split(' ')
  const candidateTokens = candidateKey.split(' ')
  const candidateTokenSet = new Set(candidateTokens)
  const matchingTokens = queryTokens.filter((token) => candidateTokenSet.has(token)).length

  const tokenScore = matchingTokens === queryTokens.length
    ? queryTokens.length === candidateTokens.length
      ? 96
      : queryTokens.length >= 2
        ? 90
        : 72
    : (matchingTokens / Math.max(queryTokens.length, 1)) * 82

  const distanceScore = Math.round(
    (1 - levenshteinDistance(queryKey, candidateKey) / Math.max(queryKey.length, candidateKey.length, 1)) * 100,
  )

  return Math.max(tokenScore, distanceScore)
}

function fuzzyAnchors(query: string): string[] {
  const key = matchKey(query)
  if (!key) return []

  const seen = new Set<string>()
  const anchors: string[] = []

  for (const token of key.split(' ')) {
    if (token.length < 2 || FUZZY_STOP_WORDS.has(token)) continue
    if (seen.has(token)) continue
    seen.add(token)
    anchors.push(token)
    if (anchors.length === 3) break
  }

  return anchors
}

function matchKey(value: string): string {
  return normalizeCatalogName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index)
  let current = new Array<number>(right.length + 1)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    current[0] = leftIndex + 1

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1
      current[rightIndex + 1] = Math.min(
        current[rightIndex]! + 1,
        previous[rightIndex + 1]! + 1,
        previous[rightIndex]! + cost,
      )
    }

    const nextPrevious = current
    current = previous
    previous = nextPrevious
  }

  return previous[right.length] ?? 0
}

function catalogRowSourceRank(row: CatalogRow): number {
  return row.source === 'no-intro' ? 0 : row.source === 'redump' ? 1 : 2
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

function countCatalogFiles(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM catalog_files').get()
  return Number(row?.total ?? 0)
}

function countCatalogFileRoms(db: DatabaseSync, catalogFileId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM roms WHERE catalog_file_id = ?').get(catalogFileId)
  return Number(row?.total ?? 0)
}

function normalizeHash(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function normalizeSearchTerm(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeLikeTerm(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`)
}

function isDatSource(value: unknown): value is DatSource {
  return value === 'no-intro' || value === 'redump'
}

function* parseDatContent(content: string): Generator<ParsedDatEntry> {
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

function parseCatalogMetadata(content: string): CatalogMetadata {
  const header = /<header\b[^>]*>([\s\S]*?)<\/header>/i.exec(content)?.[1] ?? ''

  return {
    name: parseTagText(header, 'name'),
    version: parseTagText(header, 'version'),
  }
}

function parseTagText(content: string, tagName: string): string | null {
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

function inferDatSource(content: string): DatSource {
  const sample = content.slice(0, 5000).toLowerCase()
  return sample.includes('redump') ? 'redump' : 'no-intro'
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}

interface CatalogColumnInfo {
  name: unknown
}

interface CatalogFileHashBackfillRow {
  id: unknown
  path: unknown
}

interface CatalogFileRow {
  id: unknown
  path: unknown
  fileName: unknown
  source: unknown
  catalogName: unknown
  catalogVersion: unknown
  fileSize: unknown
  mtimeMs: unknown
  importedAt: unknown
  romCount: unknown
  fileSha256: unknown
}

interface CatalogMetadata {
  name: string | null
  version: string | null
}

interface ParsedDatEntry {
  gameName: string
  romName: string
  size: number | null
  crc32: string | null
  md5: string | null
  sha1: string | null
  sha256: string | null
}

interface CatalogRow {
  id: unknown
  name: unknown
  romName: unknown
  source: unknown
  size: unknown
  crc32: unknown
  md5: unknown
  sha1: unknown
  sha256: unknown
}

interface ScoredCatalogRow {
  row: CatalogRow
  score: number
}

function toCatalogSearchResult(row: CatalogRow | undefined): CatalogSearchResult | null {
  if (!row) return null
  if (typeof row.id !== 'number') return null
  if (typeof row.name !== 'string' || typeof row.romName !== 'string') return null
  if (!isDatSource(row.source)) return null

  return {
    id: row.id,
    name: row.name,
    romName: row.romName,
    source: row.source,
    size: typeof row.size === 'number' ? row.size : null,
    hashes: {
      crc32: nullableString(row.crc32),
      md5: nullableString(row.md5),
      sha1: nullableString(row.sha1),
      sha256: nullableString(row.sha256),
    },
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function dedupeCatalogResults(results: CatalogSearchResult[]): CatalogSearchResult[] {
  const seen = new Set<string>()
  const unique: CatalogSearchResult[] = []

  for (const result of results) {
    const key = [
      result.source,
      result.name,
      result.romName,
      result.hashes.crc32 ?? '',
      result.hashes.md5 ?? '',
      result.hashes.sha1 ?? '',
      result.hashes.sha256 ?? '',
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    unique.push(result)
  }

  return unique
}
