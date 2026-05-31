import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_CONFIG, normalizeConfig, type Config } from '@shared/types'

const CONFIG_FILE = 'rom-renamer-config.json'

export async function readConfig(): Promise<Config> {
  try {
    const content = await readFile(configPath(), 'utf8')
    return normalizeConfig(JSON.parse(content))
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config: Config): Promise<Config> {
  const normalized = normalizeConfig(config)
  const path = configPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}

function configPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE)
}
