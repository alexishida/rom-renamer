import { useMemo, useRef } from 'react'
import type { JSX } from 'react'
import { Ban, Check, CheckCheck, FilterX, FolderOpen, Inbox, RotateCw, SearchX, X } from 'lucide-react'
import type { RomItem, ScanProgress } from '@shared/types'
import { filterItems, isSelectable, useRomStore } from '@renderer/stores/useRomStore'
import { sourceLabel } from '@renderer/lib/labels'
import { StatusBadge } from './StatusBadge'

export function RomTable(): JSX.Element {
  const items = useRomStore((state) => state.items)
  const scanning = useRomStore((state) => state.scanning)
  const scanProgress = useRomStore((state) => state.scanProgress)
  const folderPath = useRomStore((state) => state.folderPath)
  const statusFilter = useRomStore((state) => state.statusFilter)
  const searchTerm = useRomStore((state) => state.searchTerm)
  const selectedIds = useRomStore((state) => state.selectedIds)
  const chooseFolder = useRomStore((state) => state.chooseFolder)
  const setStatusFilter = useRomStore((state) => state.setStatusFilter)
  const setSearchTerm = useRomStore((state) => state.setSearchTerm)
  const setSelectedIds = useRomStore((state) => state.setSelectedIds)
  const clearSelection = useRomStore((state) => state.clearSelection)
  const toggleSelected = useRomStore((state) => state.toggleSelected)
  const setSuggestedName = useRomStore((state) => state.setSuggestedName)
  const syncSuggestedName = useRomStore((state) => state.syncSuggestedName)
  const validateItem = useRomStore((state) => state.validateItem)
  const ignoreItem = useRomStore((state) => state.ignoreItem)
  const renameOne = useRomStore((state) => state.renameOne)
  const validateMany = useRomStore((state) => state.validateMany)
  const ignoreMany = useRomStore((state) => state.ignoreMany)
  const renameSelected = useRomStore((state) => state.renameSelected)

  const filtered = useMemo(
    () => filterItems(items, statusFilter, searchTerm),
    [items, statusFilter, searchTerm],
  )

  const visibleSelectable = useMemo(() => filtered.filter(isSelectable), [filtered])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleSelectedCount = visibleSelectable.filter((item) => selectedSet.has(item.id)).length
  const allChecked = visibleSelectable.length > 0 && visibleSelectedCount === visibleSelectable.length
  const someChecked = visibleSelectedCount > 0 && !allChecked

  const headerRef = useRef<HTMLInputElement>(null)
  if (headerRef.current) headerRef.current.indeterminate = someChecked

  const toggleAllVisible = (): void => {
    if (allChecked) {
      const visibleIds = new Set(visibleSelectable.map((item) => item.id))
      setSelectedIds(selectedIds.filter((id) => !visibleIds.has(id)))
    } else {
      const merged = new Set(selectedIds)
      visibleSelectable.forEach((item) => merged.add(item.id))
      setSelectedIds([...merged])
    }
  }

  const selectedItems = items.filter((item) => selectedSet.has(item.id) && isSelectable(item))
  const validatableIds = selectedItems.filter((item) => item.suggestedName?.trim()).map((item) => item.id)

  if (!items.length) {
    return (
      <EmptyState
        scanning={scanning}
        scanProgress={scanProgress}
        hasFolder={Boolean(folderPath)}
        onChoose={chooseFolder}
      />
    )
  }

  return (
    <>
      {scanning && <ScanProgressState progress={scanProgress} compact />}

      {selectedIds.length > 0 && (
        <div className="bulkbar">
          <span className="bulkbar__info">
            <span className="bulkbar__count">{selectedIds.length}</span>
            {selectedIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="bulkbar__actions">
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => validateMany(validatableIds)}
              disabled={validatableIds.length === 0}
              title="Validar itens selecionados que têm nome sugerido"
            >
              <Check size={15} aria-hidden="true" />
              <span>Validar</span>
            </button>
            <button className="btn btn--sm" type="button" onClick={() => ignoreMany(selectedItems.map((i) => i.id))}>
              <Ban size={15} aria-hidden="true" />
              <span>Ignorar</span>
            </button>
            <button
              className="btn btn--sm btn--primary"
              type="button"
              onClick={renameSelected}
              disabled={selectedItems.length === 0}
            >
              <CheckCheck size={15} aria-hidden="true" />
              <span>Renomear</span>
            </button>
            <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={clearSelection} title="Limpar seleção">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="placeholder">
          <div className="placeholder__inner">
            <span className="placeholder__icon">
              <SearchX size={30} aria-hidden="true" />
            </span>
            <h2 className="placeholder__title">Nenhum resultado</h2>
            <p className="placeholder__text">Nenhuma ROM corresponde ao filtro ou à busca atual.</p>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setStatusFilter('all')
                setSearchTerm('')
              }}
            >
              <FilterX size={16} aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    ref={headerRef}
                    className="cbx"
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAllVisible}
                    disabled={visibleSelectable.length === 0}
                    aria-label="Selecionar todos visíveis"
                  />
                </th>
                <th>Arquivo</th>
                <th>Nome sugerido</th>
                <th>Confiança</th>
                <th>Status</th>
                <th className="col-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <RomRow
                  key={item.id}
                  item={item}
                  selected={selectedSet.has(item.id)}
                  disabled={scanning}
                  onToggle={() => toggleSelected(item.id)}
                  onChangeName={(value) => setSuggestedName(item.id, value)}
                  onSyncName={() => syncSuggestedName(item.id)}
                  onValidate={() => validateItem(item.id)}
                  onIgnore={() => ignoreItem(item.id)}
                  onRename={() => renameOne(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

interface EmptyStateProps {
  scanning: boolean
  scanProgress: ScanProgress | null
  hasFolder: boolean
  onChoose: () => void
}

function EmptyState({ scanning, scanProgress, hasFolder, onChoose }: EmptyStateProps): JSX.Element {
  if (scanning) {
    return (
      <div className="placeholder">
        <ScanProgressState progress={scanProgress} />
      </div>
    )
  }

  if (hasFolder) {
    return (
      <div className="placeholder">
        <div className="placeholder__inner">
          <span className="placeholder__icon">
            <Inbox size={30} aria-hidden="true" />
          </span>
          <h2 className="placeholder__title">Nenhuma ROM encontrada</h2>
          <p className="placeholder__text">A pasta selecionada não contém arquivos de ROM reconhecidos.</p>
          <button className="btn" type="button" onClick={onChoose}>
            <FolderOpen size={16} aria-hidden="true" />
            <span>Escolher outra pasta</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="placeholder">
      <div className="placeholder__inner">
        <span className="placeholder__icon">
          <FolderOpen size={30} aria-hidden="true" />
        </span>
        <h2 className="placeholder__title">Comece escolhendo uma pasta</h2>
        <p className="placeholder__text">
          Selecione a pasta com suas ROMs. O app identifica cada arquivo e sugere o nome correto para você validar e
          renomear.
        </p>
        <button className="btn btn--primary" type="button" onClick={onChoose}>
          <FolderOpen size={17} aria-hidden="true" />
          <span>Escolher pasta</span>
        </button>
      </div>
    </div>
  )
}

interface ScanProgressStateProps {
  progress: ScanProgress | null
  compact?: boolean
}

function ScanProgressState({ progress, compact = false }: ScanProgressStateProps): JSX.Element {
  const title = progress?.title ?? 'Lendo a pasta...'
  const detail = progress?.detail ?? 'Identificando arquivos de ROM e calculando hashes.'
  const percent = progressPercent(progress)

  return (
    <div className={`scan-progress ${compact ? 'scan-progress--inline' : ''}`}>
      <div className="scan-progress__head">
        <span className={`spinner ${compact ? 'spinner--sm' : ''}`} aria-hidden="true" />
        <div className="scan-progress__copy">
          <h2 className="placeholder__title">{title}</h2>
          <span className="scan-progress__meta">{percent}% concluido</span>
        </div>
      </div>

      <div
        className="scan-progress__bar"
        role="progressbar"
        aria-label="Progresso da leitura da pasta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="scan-progress__fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="placeholder__text scan-progress__text">{detail}</p>
    </div>
  )
}

interface RomRowProps {
  item: RomItem
  selected: boolean
  disabled: boolean
  onToggle: () => void
  onChangeName: (value: string) => void
  onSyncName: () => void
  onValidate: () => void
  onIgnore: () => void
  onRename: () => void
}

function RomRow({
  item,
  selected,
  disabled,
  onToggle,
  onChangeName,
  onSyncName,
  onValidate,
  onIgnore,
  onRename,
}: RomRowProps): JSX.Element {
  const canSelect = isSelectable(item)
  const canValidate = canSelect && Boolean(item.suggestedName?.trim())
  const canRename = item.status === 'validated'

  return (
    <tr className={`row row--${item.status} ${selected ? 'is-selected' : ''}`}>
      <td className="col-check">
        <input
          className="cbx"
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={!canSelect || disabled}
          aria-label={`Selecionar ${item.originalName}`}
        />
      </td>
      <td>
        <div className="cell-file" title={item.originalPath}>
          <div className="cell-file__text">
            <span className="file-name">{item.originalName}</span>
            <span className="file-sub">
              {item.platform && <span className="plat-chip">{item.platform}</span>}
              {item.error && <span className="file-error">{item.error}</span>}
            </span>
          </div>
        </div>
      </td>
      <td>
        <input
          className="suggest-input"
          value={item.suggestedName ?? ''}
          onChange={(event) => onChangeName(event.target.value)}
          onBlur={onSyncName}
          disabled={item.status === 'ignored' || item.status === 'renamed'}
          placeholder="Sem sugestão"
          aria-label={`Nome sugerido para ${item.originalName}`}
        />
      </td>
      <td>
        <div className="ident">
          <StatusBadge kind="confidence" value={item.confidence} />
          {item.source && <span className="ident__source">{sourceLabel(item.source)}</span>}
        </div>
      </td>
      <td>
        <StatusBadge kind="status" value={item.status} />
      </td>
      <td className="col-actions">
        <div className="row-actions">
          <button
            className="icon-btn icon-btn--sm icon-btn--ok"
            type="button"
            onClick={onValidate}
            disabled={!canValidate}
            title="Validar"
          >
            <Check size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-btn icon-btn--sm"
            type="button"
            onClick={onIgnore}
            disabled={!canSelect}
            title="Ignorar"
          >
            <Ban size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-btn icon-btn--sm icon-btn--accent"
            type="button"
            onClick={onRename}
            disabled={!canRename}
            title="Renomear"
          >
            <RotateCw size={16} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function progressPercent(progress: ScanProgress | null): number {
  if (!progress) return 0
  if (progress.total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)))
}
