import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const CUE_FILE_PATTERN = /^\s*FILE\s+"([^"]+)"\s+\S+/gim

export interface CueReference {
  name: string
  path: string
}

export async function readCueReferences(cuePath: string): Promise<CueReference[]> {
  const content = await readFile(cuePath, 'utf8')
  return parseCueReferences(content, dirname(cuePath))
}

export function parseCueReferences(content: string, baseDir: string): CueReference[] {
  const references: CueReference[] = []

  for (const match of content.matchAll(CUE_FILE_PATTERN)) {
    const name = match[1]
    if (!name) continue

    references.push({
      name,
      path: resolve(baseDir, name),
    })
  }

  return references
}

export function replaceCueReferences(content: string, replacements: Map<string, string>): string {
  return content.replace(CUE_FILE_PATTERN, (line, name: string) => {
    const nextName = replacements.get(name)
    return nextName ? line.replace(`"${name}"`, `"${nextName}"`) : line
  })
}
