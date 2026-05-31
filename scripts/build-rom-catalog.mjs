import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const CATALOG_SCHEMA_VERSION = '1'
const DEFAULT_INPUT_PATH = 'temp'
const DEFAULT_OUTPUT_PATH = 'resources/rom-catalog.sqlite'
const DAT_EXTENSIONS = new Set(['.dat', '.xml'])
const GAME_BLOCK_PATTERN = /<(game|machine)\b([^>]*)>([\s\S]*?)<\/\1>/gi
const ROM_TAG_PATTERN = /<rom\b([^>]*)\/?>/gi
const ATTR_PATTERN = /\b([a-zA-Z0-9_-]+)="([^"]*)"/g

await main()

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const datFiles = []

  for (const inputPath of options.inputPaths) {
    datFiles.push(...(await collectDatFiles(inputPath)))
  }

  const uniqueDatFiles = [...new Set(datFiles)].sort((left, right) => left.localeCompare(right))
  if (!uniqueDatFiles.length) {
    throw new Error(`Nenhum arquivo .dat ou .xml encontrado em: ${options.inputPaths.join(', ')}`)
  }

  await mkdir(dirname(options.outputPath), { recursive: true })
  await removeExistingDatabase(options.outputPath)

  const db = new DatabaseSync(options.outputPath)
  try {
    initCatalogSchema(db)

    const importFile = createImportStatements(db)
    let totalRoms = 0

    db.exec('BEGIN IMMEDIATE')
    try {
      for (const filePath of uniqueDatFiles) {
        const imported = await importDatFile(importFile, filePath)
        totalRoms += imported.roms
        console.log(`${basename(filePath)}: ${imported.roms} ROM(s), fonte ${imported.source}`)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    db.exec('VACUUM')
    console.log(`Catalogo SQLite criado: ${options.outputPath}`)
    console.log(`DATs importados: ${uniqueDatFiles.length}`)
    console.log(`Registros de ROM: ${totalRoms}`)
  } finally {
    db.close()
  }
}

function parseOptions(args) {
  const inputPaths = []
  let outputPath = DEFAULT_OUTPUT_PATH

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--input' || arg === '-i') {
      const value = args[index + 1]
      if (!value) throw new Error(`Valor ausente para ${arg}`)
      inputPaths.push(value)
      index += 1
      continue
    }

    if (arg.startsWith('--input=')) {
      inputPaths.push(arg.slice('--input='.length))
      continue
    }

    if (arg === '--output' || arg === '-o') {
      const value = args[index + 1]
      if (!value) throw new Error(`Valor ausente para ${arg}`)
      outputPath = value
      index += 1
      continue
    }

    if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length)
      continue
    }

    inputPaths.push(arg)
  }

  return {
    inputPaths: (inputPaths.length ? inputPaths : [DEFAULT_INPUT_PATH]).map((inputPath) => resolve(inputPath)),
    outputPath: resolve(outputPath),
  }
}

async function removeExistingDatabase(outputPath) {
  await rm(outputPath, { force: true })
  await rm(`${outputPath}-shm`, { force: true })
  await rm(`${outputPath}-wal`, { force: true })
  await rm(`${outputPath}-journal`, { force: true })
}

function initCatalogSchema(db) {
  db.exec(`
    CREATE TABLE catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE catalog_files (
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

    CREATE TABLE roms (
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

    CREATE INDEX idx_roms_crc32 ON roms(crc32);
    CREATE INDEX idx_roms_md5 ON roms(md5);
    CREATE INDEX idx_roms_sha1 ON roms(sha1);
  `)

  db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?, ?)').run(
    'schema_version',
    CATALOG_SCHEMA_VERSION,
  )
  db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?, ?)').run(
    'generated_at',
    new Date().toISOString(),
  )
}

function createImportStatements(db) {
  return {
    insertFile: db.prepare(`
      INSERT INTO catalog_files (
        path, file_name, source, catalog_name, catalog_version, file_size, mtime_ms, imported_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertRom: db.prepare(`
      INSERT INTO roms (
        catalog_file_id, source, game_name, rom_name, size, crc32, md5, sha1, sha256
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  }
}

async function importDatFile(statements, filePath) {
  const fileStats = await stat(filePath)
  const content = await readFile(filePath, 'utf8')
  const metadata = parseCatalogMetadata(content)
  const source = inferDatSource(content)
  const importedAt = new Date().toISOString()
  const catalogFileId = Number(statements.insertFile.run(
    filePath,
    basename(filePath),
    source,
    metadata.name,
    metadata.version,
    fileStats.size,
    Math.round(fileStats.mtimeMs),
    importedAt,
  ).lastInsertRowid)
  let roms = 0

  for (const entry of parseDatContent(content)) {
    statements.insertRom.run(
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
    roms += 1
  }

  return { source, roms }
}

async function collectDatFiles(inputPath) {
  try {
    const resolvedPath = resolve(inputPath)
    const entry = await stat(resolvedPath)
    if (entry.isFile() && DAT_EXTENSIONS.has(extname(resolvedPath).toLowerCase())) {
      return [resolvedPath]
    }
    if (!entry.isDirectory()) return []

    const files = []
    const entries = await readdir(resolvedPath, { withFileTypes: true })
    for (const child of entries) {
      const childPath = join(resolvedPath, child.name)
      if (child.isDirectory()) {
        files.push(...(await collectDatFiles(childPath)))
      } else if (child.isFile() && DAT_EXTENSIONS.has(extname(child.name).toLowerCase())) {
        files.push(childPath)
      }
    }
    return files
  } catch (error) {
    if (existsSync(inputPath)) throw error
    return []
  }
}

function* parseDatContent(content) {
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

function parseCatalogMetadata(content) {
  const header = /<header\b[^>]*>([\s\S]*?)<\/header>/i.exec(content)?.[1] ?? ''

  return {
    name: parseTagText(header, 'name'),
    version: parseTagText(header, 'version'),
  }
}

function parseTagText(content, tagName) {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(content)
  const value = decodeXml(match?.[1] ?? '').trim()
  return value || null
}

function parseAttributes(value) {
  const attrs = new Map()

  for (const match of value.matchAll(ATTR_PATTERN)) {
    const key = match[1]
    const attrValue = match[2]
    if (key && attrValue !== undefined) attrs.set(key.toLowerCase(), attrValue)
  }

  return attrs
}

function parseInteger(value) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function normalizeNullableHash(value) {
  if (!value) return null
  const normalized = normalizeHash(value)
  return normalized || null
}

function normalizeHash(value) {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function inferDatSource(content) {
  const sample = content.slice(0, 5000).toLowerCase()
  return sample.includes('redump') ? 'redump' : 'no-intro'
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
