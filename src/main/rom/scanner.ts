import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import type { Config, RomItem, ScanProgress } from '@shared/types'
import { calculateHashes } from './hash'
import { closeDatIndex, createDatIndex, findDatMatch, type DatIndex } from './dat'
import { readCueReferences } from './cue'
import { detectPlatform, isSupportedRomPath } from './platform'
import { preserveNameMetadata } from './naming'

export async function scanFolder(
  folderPath: string,
  config: Config,
  onProgress?: (progress: ScanProgress) => void,
): Promise<RomItem[]> {
  const root = resolve(folderPath)
  const rootStats = await stat(root)
  if (!rootStats.isDirectory()) {
    throw new Error('Pasta invalida.')
  }

  reportProgress(onProgress, {
    current: 6,
    total: 100,
    title: 'Lendo a pasta...',
    detail: 'Mapeando arquivos e referencias CUE.',
  })

  const files = await walkFiles(root, config.recursive)
  const cueSidecars = await collectCueSidecars(files)
  const romFiles = files.filter((filePath) => shouldIncludeRom(filePath, cueSidecars))

  reportProgress(onProgress, {
    current: 22,
    total: 100,
    title: 'Montando catalogo...',
    detail: 'Abrindo catalogo SQLite local para comparar hashes.',
  })

  const datIndex = await createDatIndex()
  const items: RomItem[] = []

  try {
    reportProgress(onProgress, {
      current: romFiles.length ? 30 : 100,
      total: 100,
      title: romFiles.length ? 'Identificando ROMs...' : 'Leitura concluida',
      detail: romFiles.length
        ? `Processando ${romFiles.length} arquivo(s) de ROM com ${datIndex.entries} registro(s) no catalogo.`
        : 'Nenhum arquivo de ROM reconhecido na pasta selecionada.',
    })

    for (const [index, filePath] of romFiles.entries()) {
      items.push(await buildRomItem(filePath, datIndex, config))

      reportProgress(onProgress, {
        current: 30 + Math.round(((index + 1) / romFiles.length) * 70),
        total: 100,
        title: index + 1 === romFiles.length ? 'Finalizando leitura...' : 'Identificando ROMs...',
        detail: describeRomProgress(index + 1, romFiles.length, basename(filePath)),
      })
    }

    return items.sort((left, right) => left.originalName.localeCompare(right.originalName))
  } finally {
    closeDatIndex(datIndex)
  }
}

async function walkFiles(root: string, recursive: boolean): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = join(root, entry.name)
    if (entry.isDirectory()) {
      if (recursive) files.push(...(await walkFiles(entryPath, recursive)))
      continue
    }

    if (entry.isFile()) files.push(entryPath)
  }

  return files
}

async function collectCueSidecars(files: string[]): Promise<Set<string>> {
  const sidecars = new Set<string>()
  const cueFiles = files.filter((filePath) => extname(filePath).toLowerCase() === '.cue')

  for (const cuePath of cueFiles) {
    try {
      const references = await readCueReferences(cuePath)
      for (const reference of references) {
        sidecars.add(pathKey(reference.path))
      }
    } catch {
      // Broken CUE files are still listed as primary items later.
    }
  }

  return sidecars
}

function shouldIncludeRom(filePath: string, cueSidecars: Set<string>): boolean {
  if (!isSupportedRomPath(filePath)) return false
  if (extname(filePath).toLowerCase() === '.bin' && cueSidecars.has(pathKey(filePath))) return false
  return true
}

async function buildRomItem(
  filePath: string,
  datIndex: DatIndex,
  config: Config,
): Promise<RomItem> {
  const originalName = basename(filePath)
  const resolvedPlatform = config.platformOverride !== 'auto' ? config.platformOverride : detectPlatform(filePath)
  const baseItem: RomItem = {
    id: createItemId(filePath),
    originalPath: filePath,
    originalName,
    platform: resolvedPlatform,
    hashes: {
      crc32: null,
      md5: null,
      sha1: null,
    },
    suggestedName: null,
    coverUrl: null,
    confidence: 'none',
    source: null,
    status: 'identifying',
    error: null,
  }

  try {
    const hashes = await calculateHashes(filePath)
    const datMatch = findDatMatch(datIndex, hashes)

    if (datMatch) {
      return {
        ...baseItem,
        hashes,
        suggestedName: preserveNameMetadata(datMatch.name, originalName),
        confidence: 'high',
        source: datMatch.source,
        status: 'identified',
      }
    }

    return {
      ...baseItem,
      hashes,
      status: 'pending',
    }
  } catch (error) {
    return {
      ...baseItem,
      status: 'error',
      error: error instanceof Error ? error.message : 'Falha ao identificar ROM.',
    }
  }
}

function createItemId(filePath: string): string {
  return createHash('sha1').update(resolve(filePath).toLowerCase()).digest('hex').slice(0, 16)
}

function pathKey(filePath: string): string {
  return resolve(filePath).toLowerCase()
}

function reportProgress(
  onProgress: ((progress: ScanProgress) => void) | undefined,
  progress: ScanProgress,
): void {
  if (!onProgress) return

  onProgress({
    ...progress,
    current: Math.max(0, Math.min(progress.current, progress.total)),
    total: Math.max(progress.total, 1),
  })
}

function describeRomProgress(current: number, total: number, fileName: string): string {
  return `Arquivo ${current} de ${total}: ${fileName}`
}
