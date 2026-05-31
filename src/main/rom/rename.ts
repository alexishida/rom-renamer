import { constants } from 'node:fs'
import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  type Config,
  type RenameConflict,
  type RenamePlanItem,
  type RenameResult,
  type RenameSkip,
  type RenameSummary,
  type RomItem,
  type UndoResult,
} from '@shared/types'
import { parseCueReferences, replaceCueReferences } from './cue'
import { sanitizeFileNamePart, toCatalogTitle } from './naming'

interface RenameOperation {
  itemId: string
  from: string
  to: string
  kind: 'primary' | 'sidecar'
}

interface CueUpdate {
  itemId: string
  cuePathAfterRename: string
  contentBefore: string
  contentAfter: string
}

interface PlannedItem {
  item: RomItem
  targetName: string
  operations: RenameOperation[]
  cueUpdate: CueUpdate | null
}

interface BuiltPlan {
  plannedItems: PlannedItem[]
  summary: RenameSummary
}

export interface RenameLog {
  itemSnapshots: RomItem[]
  operations: RenameOperation[]
  cueUpdates: CueUpdate[]
}

export async function createRenameSummary(
  items: Map<string, RomItem>,
  ids: string[],
  config: Config,
): Promise<RenameSummary> {
  return (await buildPlan(items, ids, config)).summary
}

export async function renameItems(
  items: Map<string, RomItem>,
  ids: string[],
  rawConfig: Config,
): Promise<{ result: RenameResult; log: RenameLog | null }> {
  const config = normalizeConfig(rawConfig)
  const plan = await buildPlan(items, ids, config)
  const updatedItems: RomItem[] = []
  const errors: RenameSkip[] = []
  const log: RenameLog = {
    itemSnapshots: [],
    operations: [],
    cueUpdates: [],
  }

  for (const planned of plan.plannedItems) {
    try {
      log.itemSnapshots.push({ ...planned.item })

      for (const operation of planned.operations) {
        if (samePath(operation.from, operation.to)) continue
        await rename(operation.from, operation.to)
        log.operations.push(operation)
      }

      if (planned.cueUpdate && planned.cueUpdate.contentBefore !== planned.cueUpdate.contentAfter) {
        await writeFile(planned.cueUpdate.cuePathAfterRename, planned.cueUpdate.contentAfter, 'utf8')
        log.cueUpdates.push(planned.cueUpdate)
      }

      const primary = planned.operations.find((operation) => operation.kind === 'primary')
      const nextItem: RomItem = {
        ...planned.item,
        originalPath: primary?.to ?? planned.item.originalPath,
        originalName: primary ? basename(primary.to) : planned.item.originalName,
        status: 'renamed',
        error: null,
      }
      items.set(nextItem.id, nextItem)
      updatedItems.push(nextItem)
    } catch (error) {
      errors.push({
        id: planned.item.id,
        originalName: planned.item.originalName,
        reason: error instanceof Error ? error.message : 'Falha ao renomear.',
      })
    }
  }

  return {
    result: {
      summary: plan.summary,
      updatedItems,
      errors,
    },
    log: log.operations.length || log.cueUpdates.length ? log : null,
  }
}

export async function undoRename(items: Map<string, RomItem>, log: RenameLog | null): Promise<UndoResult> {
  if (!log) {
    return {
      updatedItems: [],
      errors: [
        {
          id: 'undo',
          originalName: 'Ultimo lote',
          reason: 'Nenhum lote para desfazer.',
        },
      ],
    }
  }

  const errors: RenameSkip[] = []

  for (const operation of [...log.operations].reverse()) {
    try {
      if (!samePath(operation.from, operation.to)) {
        await rename(operation.to, operation.from)
      }
    } catch (error) {
      errors.push({
        id: operation.itemId,
        originalName: basename(operation.to),
        reason: error instanceof Error ? error.message : 'Falha ao desfazer rename.',
      })
    }
  }

  for (const cueUpdate of log.cueUpdates) {
    const snapshot = log.itemSnapshots.find((item) => item.id === cueUpdate.itemId)
    if (!snapshot) continue

    try {
      await writeFile(snapshot.originalPath, cueUpdate.contentBefore, 'utf8')
    } catch (error) {
      errors.push({
        id: cueUpdate.itemId,
        originalName: snapshot.originalName,
        reason: error instanceof Error ? error.message : 'Falha ao restaurar CUE.',
      })
    }
  }

  const updatedItems = log.itemSnapshots.map((snapshot) => ({ ...snapshot }))
  for (const item of updatedItems) {
    items.set(item.id, item)
  }

  return { updatedItems, errors }
}

async function buildPlan(items: Map<string, RomItem>, ids: string[], rawConfig: Config): Promise<BuiltPlan> {
  const config = normalizeConfig(rawConfig)
  const requestedIds = [...new Set(ids)]
  const usedTargets = new Set<string>()
  const conflicts: RenameConflict[] = []
  const skipped: RenameSkip[] = []
  const planItems: RenamePlanItem[] = []
  const plannedItems: PlannedItem[] = []

  for (const id of requestedIds) {
    const item = items.get(id)
    if (!item) {
      skipped.push({ id, originalName: id, reason: 'Item nao encontrado.' })
      continue
    }

    const validationError = validateRenameCandidate(item)
    if (validationError) {
      skipped.push({ id, originalName: item.originalName, reason: validationError })
      continue
    }

    const requestedPath = join(dirname(item.originalPath), renderTargetFileName(item, config))
    const primaryTarget = await reserveTargetPath(item, requestedPath, item.originalPath, config, usedTargets, conflicts)
    if (!primaryTarget) {
      skipped.push({
        id: item.id,
        originalName: item.originalName,
        reason: 'Conflito de nome.',
      })
      continue
    }

    const primaryOperation: RenameOperation = {
      itemId: item.id,
      from: item.originalPath,
      to: primaryTarget,
      kind: 'primary',
    }

    const { operations: sidecarOperations, cueUpdate } = await buildCueSidecarPlan(
      item,
      primaryTarget,
      config,
      usedTargets,
      conflicts,
    )

    const operations = [primaryOperation, ...sidecarOperations]
    const targetName = basename(primaryTarget)

    plannedItems.push({
      item,
      targetName,
      operations,
      cueUpdate,
    })
    planItems.push({
      id: item.id,
      originalName: item.originalName,
      targetName,
      operationCount: operations.length,
    })
  }

  return {
    plannedItems,
    summary: {
      totalItems: plannedItems.length,
      totalOperations: planItems.reduce((sum, item) => sum + item.operationCount, 0),
      conflicts,
      skipped,
      items: planItems,
    },
  }
}

function validateRenameCandidate(item: RomItem): string | null {
  if (item.status !== 'validated') return 'Item nao validado.'
  if (!item.suggestedName?.trim()) return 'Nome sugerido vazio.'
  if (item.confidence === 'low' || item.confidence === 'none') {
    return item.status === 'validated' ? null : 'Baixa confianca exige validacao.'
  }
  return null
}

function renderTargetFileName(item: RomItem, rawConfig: Config): string {
  const config = normalizeConfig(rawConfig)
  const originalExt = extname(item.originalName).replace(/^\./, '')
  const suggested = sanitizeFileNamePart(toCatalogTitle(item.suggestedName ?? parse(item.originalName).name))
  const source = item.source ?? ''
  const platform = item.platform ?? ''
  const template = config.nameTemplate.trim() || DEFAULT_CONFIG.nameTemplate
  const hasExtToken = /\{ext}/i.test(template)
  let rendered = template
    .replace(/\{Nome}/g, suggested)
    .replace(/\{Name}/g, suggested)
    .replace(/\{Plataforma}/g, platform)
    .replace(/\{Platform}/g, platform)
    .replace(/\{Origem}/g, source)
    .replace(/\{Source}/g, source)
    .replace(/\{Regiao}/g, '')
    .replace(/\{Region}/g, '')
    .replace(/\{ext}/gi, originalExt)
    .replace(/\{[^}]+}/g, '')
    .replace(/\s+\./g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!hasExtToken && originalExt) rendered = `${rendered}.${originalExt}`

  const parsed = parse(rendered)
  const safeBase = sanitizeFileNamePart(parsed.name).replace(/[. ]+$/g, '') || 'ROM'
  const safeExt = sanitizeFileNamePart(parsed.ext.replace(/^\./, ''))
  return safeExt ? `${safeBase}.${safeExt}` : safeBase
}

async function buildCueSidecarPlan(
  item: RomItem,
  primaryTargetPath: string,
  config: Config,
  usedTargets: Set<string>,
  conflicts: RenameConflict[],
): Promise<{ operations: RenameOperation[]; cueUpdate: CueUpdate | null }> {
  if (extname(item.originalPath).toLowerCase() !== '.cue') {
    return { operations: [], cueUpdate: null }
  }

  try {
    const content = await readFile(item.originalPath, 'utf8')
    const references = parseCueReferences(content, dirname(item.originalPath))
    const uniqueReferences = references.filter(
      (reference, index, list) => list.findIndex((other) => samePath(other.path, reference.path)) === index,
    )
    const replacements = new Map<string, string>()
    const operations: RenameOperation[] = []
    const targetBase = parse(primaryTargetPath).name

    for (const [index, reference] of uniqueReferences.entries()) {
      if (!(await pathExists(reference.path))) continue

      const refExt = extname(reference.path)
      const trackSuffix = uniqueReferences.length > 1 ? ` (Track ${String(index + 1).padStart(2, '0')})` : ''
      const requestedPath = join(dirname(primaryTargetPath), `${targetBase}${trackSuffix}${refExt}`)
      const targetPath = await reserveTargetPath(item, requestedPath, reference.path, config, usedTargets, conflicts)
      if (!targetPath) continue

      replacements.set(reference.name, basename(targetPath))
      operations.push({
        itemId: item.id,
        from: reference.path,
        to: targetPath,
        kind: 'sidecar',
      })
    }

    return {
      operations,
      cueUpdate: {
        itemId: item.id,
        cuePathAfterRename: primaryTargetPath,
        contentBefore: content,
        contentAfter: replaceCueReferences(content, replacements),
      },
    }
  } catch {
    return { operations: [], cueUpdate: null }
  }
}

async function reserveTargetPath(
  item: RomItem,
  requestedPath: string,
  sourcePath: string,
  config: Config,
  usedTargets: Set<string>,
  conflicts: RenameConflict[],
): Promise<string | null> {
  const requestedKey = pathKey(requestedPath)
  const duplicate = usedTargets.has(requestedKey)
  const exists = !samePath(requestedPath, sourcePath) && (await pathExists(requestedPath))

  if (!duplicate && !exists) {
    usedTargets.add(requestedKey)
    return requestedPath
  }

  const baseConflict: RenameConflict = {
    id: item.id,
    originalName: item.originalName,
    requestedName: basename(requestedPath),
    resolvedName: null,
    reason: duplicate ? 'duplicate' : 'exists',
  }

  if (config.conflictStrategy === 'skip') {
    conflicts.push(baseConflict)
    return null
  }

  const parsed = parse(requestedPath)
  for (let index = 2; index < 1000; index += 1) {
    const candidate = join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`)
    const candidateKey = pathKey(candidate)
    if (usedTargets.has(candidateKey)) continue
    if (!samePath(candidate, sourcePath) && (await pathExists(candidate))) continue

    usedTargets.add(candidateKey)
    conflicts.push({
      ...baseConflict,
      resolvedName: basename(candidate),
    })
    return candidate
  }

  conflicts.push(baseConflict)
  return null
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function samePath(left: string, right: string): boolean {
  return pathKey(left) === pathKey(right)
}

function pathKey(filePath: string): string {
  return resolve(filePath).toLowerCase()
}
