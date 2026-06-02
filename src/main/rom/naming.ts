import { basename, extname } from 'node:path'
import type { RegionName } from '@shared/types'

const TAG_PATTERN = /\s*(\([^)]*\)|\[[^\]]*]|\{[^}]*})\s*/g
const SEPARATORS_PATTERN = /[_+.]+/g
const EXTRA_PATTERN = /\b(dump|proto|beta|rev|v\d+|track\s*\d+|disc\s*\d+)\b/gi
const LEADING_ARTICLE_PATTERN = /^(the|an|a)\s+(.+)$/i
const TRAILING_ARTICLE_PATTERN = /,\s*(the|an|a)$/i
const VERSION_TAG_PATTERN = /^v?\d+(?:\.\d+)+$/i
const REGION_TAG_PATTERN = /^(BR|B|BRASIL|BRAZIL|EUA|USA|UNITED STATES|U|E|EUROPA|EUROPE|JAPAN|J)$/i
const LANGUAGE_TAG_PATTERN = /^M\d+$/i
const REGION_DISPLAY_MAP: Record<string, RegionName> = {
  U: 'EUA',
  EUA: 'EUA',
  USA: 'EUA',
  'UNITED STATES': 'EUA',
  E: 'Europa',
  EUROPA: 'Europa',
  EUROPE: 'Europa',
  BR: 'Brasil',
  B: 'Brasil',
  BRASIL: 'Brasil',
  BRAZIL: 'Brasil',
  J: 'Japan',
  JAPAN: 'Japan',
}

interface PreservedTag {
  value: string
  raw: string
  kind: 'version' | 'region' | 'language'
}

export function suggestNameFromPath(filePath: string): string | null {
  const ext = extname(filePath)
  const stem = basename(filePath, ext)
  const cleaned = cleanNameForMatch(stem)

  const suggested = cleaned ? toDisplayTitle(cleaned) : ''
  const withPreservedTags = preserveNameMetadata(suggested, stem)
  return withPreservedTags || null
}

export function normalizeNameForSearch(filePath: string): string {
  const ext = extname(filePath)
  const stem = basename(filePath, ext)
  return normalizeCatalogName(stem)
}

export function normalizeCatalogName(value: string): string {
  return cleanNameForMatch(value)
}

export function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s{2,}/g, ' ').trim()
}

export function toCatalogTitle(value: string): string {
  const trimmed = value.replace(/\s{2,}/g, ' ').trim()
  if (!trimmed || TRAILING_ARTICLE_PATTERN.test(trimmed)) return trimmed

  const match = trimmed.match(LEADING_ARTICLE_PATTERN)
  if (!match) return trimmed

  const article = match[1]
  const rest = match[2]
  if (!article || !rest) return trimmed

  const normalizedArticle = article.length === 1
    ? article.toUpperCase()
    : `${article.slice(0, 1).toUpperCase()}${article.slice(1).toLowerCase()}`

  return `${rest.trim()}, ${normalizedArticle}`
}

export function preserveNameMetadata(name: string, sourceValue: string): string {
  const trimmedName = name.replace(/\s{2,}/g, ' ').trim()
  const sourceTags = extractPreservedTags(sourceValue)
  if (sourceTags.length === 0) return trimmedName

  const sourceByKind = new Map(sourceTags.map((tag) => [tag.kind, tag]))
  const targetTags = extractPreservedTags(trimmedName)
  let nextName = trimmedName

  for (const targetTag of targetTags) {
    const sourceTag = sourceByKind.get(targetTag.kind)
    if (!sourceTag || sourceTag.value === targetTag.value) continue

    nextName = replaceTagValue(nextName, targetTag.raw, sourceTag.value)
  }

  const nextTargetKinds = new Set(extractPreservedTags(nextName).map((tag) => tag.kind))
  const missingTags = sourceTags.filter((tag) => !nextTargetKinds.has(tag.kind))
  const parts = [nextName, ...missingTags.map((tag) => formatTag(tag.value))].filter(Boolean)

  return parts.join(' ').replace(/\s{2,}/g, ' ').trim()
}

export function hasRegionTag(value: string): boolean {
  return extractPreservedTags(value).some((tag) => tag.kind === 'region')
}

export function appendRegionTagIfMissing(name: string, region: RegionName | null): string {
  const trimmedName = name.replace(/\s{2,}/g, ' ').trim()
  if (!region || hasRegionTag(trimmedName)) return trimmedName
  return `${trimmedName} ${formatTag(region)}`.trim()
}

function toDisplayTitle(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map(formatDisplayPart)
    .join(' ')
}

function extractPreservedTags(value: string): PreservedTag[] {
  const tags = value.match(TAG_PATTERN) ?? []
  const preserved = new Map<string, PreservedTag>()

  for (const rawTag of tags) {
    const normalized = rawTag.replace(/^[\s([{]+|[\s)\]}]+$/g, '').trim()
    if (!normalized) continue

    if (VERSION_TAG_PATTERN.test(normalized)) {
      const value = normalized.toUpperCase().startsWith('V') ? normalized.toUpperCase() : normalized
      preserved.set(`version:${value.toUpperCase()}`, { value, raw: normalized, kind: 'version' })
      continue
    }

    if (REGION_TAG_PATTERN.test(normalized)) {
      const value = canonicalizeRegionTag(normalized)
      preserved.set(`region:${value}`, { value, raw: normalized, kind: 'region' })
      continue
    }

    if (LANGUAGE_TAG_PATTERN.test(normalized)) {
      const value = normalized.toUpperCase()
      preserved.set(`language:${value}`, { value, raw: normalized, kind: 'language' })
      continue
    }

  }

  return [...preserved.values()]
}

function formatTag(value: string): string {
  return `(${value})`
}

function replaceTagValue(name: string, currentRawValue: string, nextValue: string): string {
  const currentTag = escapeRegExp(formatTag(currentRawValue))
  return name.replace(new RegExp(currentTag, 'i'), formatTag(nextValue))
}

function canonicalizeRegionTag(value: string): RegionName {
  const normalized = value.toUpperCase()
  const region = REGION_DISPLAY_MAP[normalized]
  if (!region) throw new Error(`Regiao invalida: ${value}`)
  return region
}

function cleanNameForMatch(value: string): string {
  return value
    .replace(TAG_PATTERN, ' ')
    .replace(SEPARATORS_PATTERN, ' ')
    .replace(EXTRA_PATTERN, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function formatDisplayPart(part: string): string {
  if (!part.includes('-')) {
    return formatDisplaySegment(part)
  }

  return part
    .split('-')
    .filter((segment) => segment.length > 0)
    .map(formatDisplaySegment)
    .join('-')
}

function formatDisplaySegment(segment: string): string {
  if (segment.length <= 3 && segment === segment.toUpperCase()) return segment
  if (/^\d+$/.test(segment)) return segment
  return `${segment.slice(0, 1).toUpperCase()}${segment.slice(1).toLowerCase()}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
