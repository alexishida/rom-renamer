import { basename, extname } from 'node:path'

const TAG_PATTERN = /\s*(\([^)]*\)|\[[^\]]*]|\{[^}]*})\s*/g
const SEPARATORS_PATTERN = /[_+.]+/g
const EXTRA_PATTERN = /\b(dump|proto|beta|rev|v\d+|track\s*\d+|disc\s*\d+)\b/gi
const LEADING_ARTICLE_PATTERN = /^(the|an|a)\s+(.+)$/i
const TRAILING_ARTICLE_PATTERN = /,\s*(the|an|a)$/i
const VERSION_TAG_PATTERN = /^v?\d+(?:\.\d+)+$/i
const REGION_TAG_PATTERN = /^(BR|B|BRAZIL|EUA|USA|UNITED STATES|U|E|EUROPE|JAPAN|J)$/i
const LANGUAGE_TAG_PATTERN = /^M\d+$/i
const REGION_DISPLAY_MAP: Record<string, string> = {
  J: 'Japan',
  JAPAN: 'Japan',
}

interface PreservedTag {
  value: string
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
  return cleanNameForMatch(stem)
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
  const sourceTags = extractPreservedTags(stemValue(sourceValue))
  if (sourceTags.length === 0) return trimmedName

  const targetTags = extractPreservedTags(trimmedName)
  const targetKinds = new Set(targetTags.map((tag) => tag.kind))
  const missingTags = sourceTags.filter((tag) => !targetKinds.has(tag.kind))

  const parts = [trimmedName, ...missingTags.map((tag) => formatTag(tag.value))].filter(Boolean)
  return parts.join(' ').trim()
}

function toDisplayTitle(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3 && part === part.toUpperCase()) return part
      if (/^\d+$/.test(part)) return part
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    })
    .join(' ')
}

function extractPreservedTags(value: string): PreservedTag[] {
  const tags = value.match(TAG_PATTERN) ?? []
  const preserved = new Map<string, PreservedTag>()

  for (const rawTag of tags) {
    const normalized = rawTag.replace(/^[([{]\s*|\s*[)\]}]$/g, '').trim()
    if (!normalized) continue

    if (VERSION_TAG_PATTERN.test(normalized)) {
      const value = normalized.toUpperCase().startsWith('V') ? normalized.toUpperCase() : normalized
      preserved.set(`version:${value.toUpperCase()}`, { value, kind: 'version' })
      continue
    }

    if (REGION_TAG_PATTERN.test(normalized)) {
      const value = canonicalizeRegionTag(normalized)
      preserved.set(`region:${value}`, { value, kind: 'region' })
      continue
    }

    if (LANGUAGE_TAG_PATTERN.test(normalized)) {
      const value = normalized.toUpperCase()
      preserved.set(`language:${value}`, { value, kind: 'language' })
    }
  }

  return [...preserved.values()]
}

function formatTag(value: string): string {
  return `(${value})`
}

function stemValue(value: string): string {
  const ext = extname(value)
  return basename(value, ext)
}

function canonicalizeRegionTag(value: string): string {
  const normalized = value.toUpperCase()
  return REGION_DISPLAY_MAP[normalized] ?? normalized
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
