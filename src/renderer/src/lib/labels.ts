import type { Confidence, MatchSource, RomStatus } from '@shared/types'

export function confidenceLabel(confidence: Confidence): string {
  switch (confidence) {
    case 'high':
      return 'Alta'
    case 'medium':
      return 'Media'
    case 'low':
      return 'Baixa'
    case 'none':
      return 'Nenhuma'
  }
}

export function statusLabel(status: RomStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendente'
    case 'identifying':
      return 'Identificando'
    case 'identified':
      return 'Identificado'
    case 'validated':
      return 'Validado'
    case 'ignored':
      return 'Ignorado'
    case 'renamed':
      return 'Renomeado'
    case 'error':
      return 'Erro'
  }
}

export function sourceLabel(source: MatchSource): string {
  switch (source) {
    case 'no-intro':
      return 'No-Intro'
    case 'redump':
      return 'Redump'
    case 'screenscraper':
      return 'ScreenScraper'
    case 'igdb':
      return 'IGDB'
    case 'fuzzy':
      return 'Fuzzy match'
    case null:
      return 'Sem origem'
  }
}
