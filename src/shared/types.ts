export type PlatformName =
  // Nintendo — cartuchos
  | 'NES'
  | 'SNES'
  | 'Nintendo 64'
  | 'Game Boy'
  | 'Game Boy Color'
  | 'Game Boy Advance'
  | 'Nintendo DS'
  | 'Nintendo 3DS'
  // Nintendo — discos
  | 'GameCube'
  | 'Wii'
  | 'Wii U'
  // Sega — cartuchos
  | 'Master System'
  | 'Game Gear'
  | 'Mega Drive'
  | 'Sega 32X'
  // Sega — discos
  | 'Mega CD'
  | 'Sega Saturn'
  | 'Dreamcast'
  // Sony
  | 'PlayStation 1'
  | 'PlayStation 2'
  | 'PlayStation 3'
  | 'PlayStation Portable'
  // Atari
  | 'Atari 2600'
  | 'Atari 7800'
  | 'Atari Jaguar'
  // SNK
  | 'Neo Geo'
  | 'Neo Geo Pocket'
  // Outros
  | 'PC Engine'
  | 'WonderSwan'

export type Confidence = 'high' | 'medium' | 'low' | 'none'

export type MatchSource =
  | 'no-intro'
  | 'redump'
  | null

export type CatalogSource = Extract<MatchSource, 'no-intro' | 'redump'>

export type RomStatus =
  | 'pending'
  | 'identifying'
  | 'identified'
  | 'validated'
  | 'ignored'
  | 'renamed'
  | 'error'

export type ConflictStrategy = 'suffix' | 'skip'

export interface Hashes {
  crc32: string | null
  md5: string | null
  sha1: string | null
}

export interface CatalogSearchResult {
  id: number
  name: string
  romName: string
  source: CatalogSource
  size: number | null
  hashes: Hashes & {
    sha256: string | null
  }
}

export interface CatalogFileSummary {
  id: number
  path: string
  fileName: string
  source: CatalogSource
  catalogName: string | null
  catalogVersion: string | null
  fileSize: number
  mtimeMs: number
  importedAt: string
  romCount: number
  fileSha256: string | null
}

export type CatalogImportFileStatus = 'imported' | 'skipped' | 'error'

export interface CatalogImportFileResult {
  path: string
  fileName: string
  status: CatalogImportFileStatus
  message: string
  source: CatalogSource | null
  roms: number
  catalogFileId: number | null
}

export interface CatalogImportResult {
  importedFiles: number
  skippedFiles: number
  errorFiles: number
  importedRoms: number
  files: CatalogImportFileResult[]
  catalogFiles: CatalogFileSummary[]
}

export interface CatalogDeleteResult {
  deletedFiles: number
  deletedRoms: number
  catalogFiles: CatalogFileSummary[]
}

export type PlatformOverride = PlatformName | 'auto'

export interface Config {
  recursive: boolean
  nameTemplate: string
  conflictStrategy: ConflictStrategy
  platformOverride: PlatformOverride
}

export interface RomItem {
  id: string
  originalPath: string
  originalName: string
  platform: PlatformName | null
  hashes: Hashes
  suggestedName: string | null
  coverUrl: string | null
  confidence: Confidence
  source: MatchSource
  status: RomStatus
  error: string | null
}

export interface ScanProgress {
  current: number
  total: number
  title: string
  detail: string
}

export interface ScanFolderRequest {
  folderPath: string
  config: Config
}

export interface RenameConflict {
  id: string
  originalName: string
  requestedName: string
  resolvedName: string | null
  reason: 'exists' | 'duplicate'
}

export interface RenameSkip {
  id: string
  originalName: string
  reason: string
}

export interface RenamePlanItem {
  id: string
  originalName: string
  targetName: string
  operationCount: number
}

export interface RenameSummary {
  totalItems: number
  totalOperations: number
  conflicts: RenameConflict[]
  skipped: RenameSkip[]
  items: RenamePlanItem[]
}

export interface RenameResult {
  summary: RenameSummary
  updatedItems: RomItem[]
  errors: RenameSkip[]
}

export interface UndoResult {
  updatedItems: RomItem[]
  errors: RenameSkip[]
}

export const DEFAULT_CONFIG: Config = {
  recursive: true,
  nameTemplate: '{Nome}.{ext}',
  conflictStrategy: 'suffix',
  platformOverride: 'auto',
}

export function normalizeConfig(value: unknown): Config {
  if (!isRecord(value)) return DEFAULT_CONFIG

  const conflictStrategy =
    value.conflictStrategy === 'skip' || value.conflictStrategy === 'suffix'
      ? value.conflictStrategy
      : DEFAULT_CONFIG.conflictStrategy

  return {
    recursive:
      typeof value.recursive === 'boolean'
        ? value.recursive
        : DEFAULT_CONFIG.recursive,
    nameTemplate:
      typeof value.nameTemplate === 'string' && value.nameTemplate.trim()
        ? value.nameTemplate
        : DEFAULT_CONFIG.nameTemplate,
    conflictStrategy,
    platformOverride: isValidPlatformOverride(value.platformOverride)
      ? value.platformOverride
      : DEFAULT_CONFIG.platformOverride,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ALL_PLATFORM_NAMES: ReadonlyArray<PlatformName> = [
  'NES', 'SNES', 'Nintendo 64', 'Game Boy', 'Game Boy Color', 'Game Boy Advance',
  'Nintendo DS', 'Nintendo 3DS', 'GameCube', 'Wii', 'Wii U',
  'Master System', 'Game Gear', 'Mega Drive', 'Sega 32X', 'Mega CD', 'Sega Saturn', 'Dreamcast',
  'PlayStation 1', 'PlayStation 2', 'PlayStation 3', 'PlayStation Portable',
  'Atari 2600', 'Atari 7800', 'Atari Jaguar',
  'Neo Geo', 'Neo Geo Pocket',
  'PC Engine', 'WonderSwan',
]

export const PLATFORM_NAMES: ReadonlyArray<PlatformName> = ALL_PLATFORM_NAMES

function isValidPlatformOverride(value: unknown): value is PlatformOverride {
  return value === 'auto' || (typeof value === 'string' && (ALL_PLATFORM_NAMES as readonly string[]).includes(value))
}
