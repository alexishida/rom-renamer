import type { JSX } from 'react'
import type { Confidence, RomStatus } from '@shared/types'
import { confidenceLabel, statusLabel } from '@renderer/lib/labels'

interface StatusBadgeProps {
  kind: 'confidence' | 'status'
  value: Confidence | RomStatus
}

export function StatusBadge({ kind, value }: StatusBadgeProps): JSX.Element {
  const label = kind === 'confidence' ? confidenceLabel(value as Confidence) : statusLabel(value as RomStatus)
  return <span className={`badge badge--${value}`}>{label}</span>
}
