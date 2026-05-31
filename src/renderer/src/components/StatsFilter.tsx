import type { JSX } from 'react'
import { Folder, Search, X } from 'lucide-react'
import type { RomStatus } from '@shared/types'
import { countByStatus, useRomStore, type StatusFilter } from '@renderer/stores/useRomStore'

const STATUS_ORDER: RomStatus[] = [
  'pending',
  'identifying',
  'identified',
  'validated',
  'renamed',
  'error',
  'ignored',
]

const PLURAL_LABEL: Record<RomStatus, string> = {
  pending: 'Pendentes',
  identifying: 'Lendo',
  identified: 'Identificados',
  validated: 'Validados',
  renamed: 'Renomeados',
  error: 'Erros',
  ignored: 'Ignorados',
}

export function StatsFilter(): JSX.Element {
  const folderPath = useRomStore((state) => state.folderPath)
  const items = useRomStore((state) => state.items)
  const statusFilter = useRomStore((state) => state.statusFilter)
  const setStatusFilter = useRomStore((state) => state.setStatusFilter)
  const searchTerm = useRomStore((state) => state.searchTerm)
  const setSearchTerm = useRomStore((state) => state.setSearchTerm)
  const platformOverride = useRomStore((state) => state.config.platformOverride)
  const openFolderModal = useRomStore((state) => state.openFolderModal)

  const counts = countByStatus(items)
  const folderName = folderPath ? folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath : ''

  const visibleStatuses = STATUS_ORDER.filter((status) => counts[status] > 0 || statusFilter === status)

  const renderChip = (key: StatusFilter, label: string, count: number, dotClass: string): JSX.Element => (
    <button
      key={key}
      type="button"
      className={`chip ${dotClass} ${statusFilter === key ? 'is-active' : ''}`}
      onClick={() => setStatusFilter(key)}
      aria-pressed={statusFilter === key}
    >
      {label}
      <span className="chip__count">{count}</span>
    </button>
  )

  return (
    <div className="statsbar">
      <button className="folder" title={folderPath ?? ''} onClick={openFolderModal} type="button">
        <span className="folder__icon">
          <Folder size={16} aria-hidden="true" />
        </span>
        <span className="folder__path">{folderName}</span>
        {platformOverride !== 'auto' && (
          <span className="plat-override-badge">{platformOverride}</span>
        )}
      </button>

      <div className="chips" role="group" aria-label="Filtrar por status">
        {renderChip('all', 'Todos', items.length, 'chip--all')}
        {visibleStatuses.map((status) =>
          renderChip(status, PLURAL_LABEL[status], counts[status], `chip--${status}`),
        )}
      </div>

      <div className="search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar ROM..."
          aria-label="Buscar ROM"
        />
        {searchTerm && (
          <button className="search__clear" type="button" onClick={() => setSearchTerm('')} title="Limpar busca">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
