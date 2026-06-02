import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { AlertCircle, CheckCircle2, Database, FolderSearch, RefreshCw, Search, Trash2, X } from 'lucide-react'
import type {
  CatalogFileSummary,
  CatalogImportFileResult,
  CatalogImportResult,
  CatalogSearchResult,
} from '@shared/types'
import { sourceLabel } from '@renderer/lib/labels'
import { useRomStore } from '@renderer/stores/useRomStore'

type DatTab = 'import' | 'files' | 'search'

export function DatCatalogModal(): JSX.Element | null {
  const open = useRomStore((state) => state.catalogModalOpen)
  const setOpen = useRomStore((state) => state.setCatalogModalOpen)

  const [activeTab, setActiveTab] = useState<DatTab>('search')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [catalogFiles, setCatalogFiles] = useState<CatalogFileSummary[]>([])
  const [importResult, setImportResult] = useState<CatalogImportResult | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [picking, setPicking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const refreshFiles = useCallback(async (): Promise<void> => {
    setLoadingFiles(true)
    setLocalError(null)
    setLocalNotice(null)
    try {
      setCatalogFiles(await window.api.listCatalogFiles())
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setLoadingFiles(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshFiles()
  }, [open, refreshFiles])

  useEffect(() => {
    if (!open || activeTab !== 'search') return
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [activeTab, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    if (!open || activeTab !== 'search') return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    let active = true
    setSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void window.api.searchCatalog(trimmed)
        .then((nextResults) => {
          if (active) setResults(nextResults)
        })
        .catch((error: unknown) => {
          if (!active) return
          setResults([])
          setSearchError(errorMessage(error))
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeTab, open, query])

  const importStatus = useMemo(() => {
    if (importing) return 'Importando...'
    if (!importResult) return selectedPaths.length ? `${selectedPaths.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado'
    return `${importResult.importedFiles} importado(s), ${importResult.skippedFiles} ignorado(s), ${importResult.errorFiles} erro(s)`
  }, [importResult, importing, selectedPaths.length])

  const searchStatus = useMemo(() => {
    if (searching) return 'Buscando...'
    if (searchError) return searchError
    if (query.trim().length < 2) return 'Digite ao menos 2 caracteres.'
    if (!results.length) return 'Nenhum resultado.'
    return `${results.length} resultado${results.length === 1 ? '' : 's'}`
  }, [query, results.length, searchError, searching])
  const totalRoms = useMemo(
    () => catalogFiles.reduce((sum, f) => sum + f.romCount, 0),
    [catalogFiles],
  )

  const catalogDeleteApiReady =
    typeof window.api.clearCatalog === 'function' &&
    typeof window.api.deleteCatalogFile === 'function'

  if (!open) return null

  const handleChoose = async (): Promise<void> => {
    setPicking(true)
    setLocalError(null)
    setLocalNotice(null)
    try {
      const paths = await window.api.chooseDatFiles()
      if (paths.length) {
        setSelectedPaths((current) => mergeUniquePaths(current, paths))
        setImportResult(null)
        setActiveTab('import')
      }
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setPicking(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!selectedPaths.length) return
    setImporting(true)
    setLocalError(null)
    setLocalNotice(null)
    setImportResult(null)
    try {
      const result = await window.api.importDatFiles(selectedPaths)
      setImportResult(result)
      setCatalogFiles(result.catalogFiles)
      setSelectedPaths([])
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteFile = async (file: CatalogFileSummary): Promise<void> => {
    if (!catalogDeleteApiReady) {
      setLocalError('Reinicie o app para ativar a exclusao do catalogo SQLite.')
      return
    }

    const confirmed = window.confirm(`Remover "${file.fileName}" do catalogo SQLite?`)
    if (!confirmed) return

    setDeletingFileId(file.id)
    setLocalError(null)
    setLocalNotice(null)
    try {
      const result = await window.api.deleteCatalogFile(file.id)
      setCatalogFiles(result.catalogFiles)
      setResults([])
      setSearchError(null)
      setLocalNotice(`${result.deletedFiles} arquivo(s) e ${result.deletedRoms} ROM(s) removido(s).`)
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setDeletingFileId(null)
    }
  }

  const handleClearCatalog = async (): Promise<void> => {
    if (!catalogDeleteApiReady) {
      setLocalError('Reinicie o app para ativar a exclusao do catalogo SQLite.')
      return
    }

    const confirmed = window.confirm('Remover todos os registros do catalogo SQLite?')
    if (!confirmed) return

    setDeletingAll(true)
    setLocalError(null)
    setLocalNotice(null)
    try {
      const result = await window.api.clearCatalog()
      setCatalogFiles(result.catalogFiles)
      setResults([])
      setQuery('')
      setSearchError(null)
      setLocalNotice(`${result.deletedFiles} arquivo(s) e ${result.deletedRoms} ROM(s) removido(s).`)
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section
        className="dialog dat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dat-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <span className="dialog__header-icon">
            <Database size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="dat-modal-title">Catalogo DAT</h2>
            <p>{catalogFiles.length} arquivo(s) carregado(s)</p>
          </div>
          <div className="dat-modal__header-right">
            {!loadingFiles && totalRoms > 0 && (
              <span className="dat-modal__rom-total">
                {totalRoms.toLocaleString('pt-BR')} ROMs
              </span>
            )}
            <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={() => setOpen(false)} title="Fechar">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="dat-tabs" role="tablist" aria-label="Catalogo DAT">
          <TabButton
            active={activeTab === 'search'}
            badge={results.length || undefined}
            id="dat-tab-search"
            label="Consultar"
            panelId="dat-panel-search"
            onClick={() => setActiveTab('search')}
          />
          <TabButton
            active={activeTab === 'import'}
            badge={selectedPaths.length || undefined}
            id="dat-tab-import"
            label="Carregar"
            panelId="dat-panel-import"
            onClick={() => setActiveTab('import')}
          />
          <TabButton
            active={activeTab === 'files'}
            badge={catalogFiles.length || undefined}
            id="dat-tab-files"
            label="Carregados"
            panelId="dat-panel-files"
            onClick={() => setActiveTab('files')}
          />
        </div>

        <div className="dialog__body dat-modal__body">
          {localError && (
            <div className="dat-alert" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{localError}</span>
            </div>
          )}
          {localNotice && (
            <div className="dat-alert dat-alert--success" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{localNotice}</span>
            </div>
          )}
          {activeTab === 'files' && !catalogDeleteApiReady && (
            <div className="dat-alert" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>Reinicie o app para ativar a exclusao do catalogo SQLite.</span>
            </div>
          )}

          {activeTab === 'import' && (
          <section
            id="dat-panel-import"
            className="dat-section"
            role="tabpanel"
            aria-labelledby="dat-tab-import"
          >
            <div className="dat-section__head">
              <h3>Carregar DAT</h3>
              <span>{importStatus}</span>
            </div>

            <div className="dat-import-row">
              <button
                className="folder-pick-btn dat-pick-btn"
                type="button"
                onClick={() => void handleChoose()}
                disabled={picking || importing}
              >
                <FolderSearch size={16} aria-hidden="true" className="folder-pick-btn__icon" />
                <span className="folder-pick-btn__text">
                  <b>{picking ? 'Abrindo seletor...' : 'Selecionar arquivos DAT/XML'}</b>
                  <small>{selectedPaths.length ? `${selectedPaths.length} pronto(s) para importar` : 'Nenhum arquivo na fila'}</small>
                </span>
                <span className="folder-pick-btn__cta">Procurar</span>
              </button>

              <button
                className="btn btn--primary"
                type="button"
                onClick={() => void handleImport()}
                disabled={!selectedPaths.length || importing}
              >
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{importing ? 'Importando...' : 'Importar'}</span>
              </button>
            </div>

            {selectedPaths.length > 0 && (
              <ul className="dat-file-list dat-file-list--queued">
                {selectedPaths.map((path) => (
                  <li key={path}>
                    <span>
                      <strong>{baseName(path)}</strong>
                      <small>{path}</small>
                    </span>
                    <button
                      className="icon-btn icon-btn--sm icon-btn--ghost"
                      type="button"
                      onClick={() => setSelectedPaths((current) => current.filter((candidate) => candidate !== path))}
                      title="Remover"
                      disabled={importing}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {importResult && <ImportResultList files={importResult.files} />}
          </section>
          )}

          {activeTab === 'files' && (
          <section
            id="dat-panel-files"
            className="dat-section"
            role="tabpanel"
            aria-labelledby="dat-tab-files"
          >
            <div className="dat-section__head">
              <h3>Arquivos carregados</h3>
              <div className="dat-section__actions">
                <button
                  className="btn btn--sm btn--danger"
                  type="button"
                  onClick={() => void handleClearCatalog()}
                  disabled={loadingFiles || deletingAll || deletingFileId !== null || catalogFiles.length === 0 || !catalogDeleteApiReady}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>{deletingAll ? 'Limpando...' : 'Limpar catalogo'}</span>
                </button>
                <button
                  className="icon-btn icon-btn--sm icon-btn--ghost"
                  type="button"
                  onClick={() => void refreshFiles()}
                  disabled={loadingFiles || deletingAll}
                  title="Atualizar"
                >
                  <RefreshCw size={16} className={loadingFiles ? 'spin-icon' : undefined} aria-hidden="true" />
                </button>
              </div>
            </div>

            {loadingFiles && <p className="dat-empty">Lendo catalogo...</p>}
            {!loadingFiles && catalogFiles.length === 0 && <p className="dat-empty">Nenhum arquivo carregado.</p>}
            {!loadingFiles && catalogFiles.length > 0 && (
              <CatalogFileList
                deletingFileId={deletingFileId}
                deleteApiReady={catalogDeleteApiReady}
                files={catalogFiles}
                onDelete={(file) => void handleDeleteFile(file)}
              />
            )}
          </section>
          )}

          {activeTab === 'search' && (
          <section
            id="dat-panel-search"
            className="dat-section"
            role="tabpanel"
            aria-labelledby="dat-tab-search"
          >
            <div className="dat-section__head">
              <h3>Consultar catalogo</h3>
              <span className={searchError ? 'catalog-results__status catalog-results__status--error' : 'catalog-results__status'}>
                {searchStatus}
              </span>
            </div>

            <label className="catalog-search-field">
              <span className="catalog-search-field__control">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Digite nome da ROM"
                />
              </span>
            </label>

            {results.length > 0 && (
              <ul className="catalog-results__list dat-search-results">
                {results.map((result) => (
                  <li key={result.id} className="catalog-result">
                    <div className="catalog-result__main">
                      <div className="catalog-result__title">
                        <strong>{result.name}</strong>
                        <span>{sourceLabel(result.source)}</span>
                      </div>
                      <span className="catalog-result__rom">{result.romName}</span>
                      <small className="dat-hash-line">{hashSummary(result)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </div>

        <footer className="dialog__footer">
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Fechar
          </button>
        </footer>
      </section>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  badge?: number
  id: string
  label: string
  panelId: string
  onClick: () => void
}

function TabButton({ active, badge, id, label, panelId, onClick }: TabButtonProps): JSX.Element {
  return (
    <button
      id={id}
      className={`dat-tabs__tab ${active ? 'is-active' : ''}`}
      type="button"
      role="tab"
      aria-controls={panelId}
      aria-selected={active}
      onClick={onClick}
    >
      <span>{label}</span>
      {badge !== undefined && <b>{badge}</b>}
    </button>
  )
}

interface CatalogFileListProps {
  deleteApiReady: boolean
  deletingFileId: number | null
  files: CatalogFileSummary[]
  onDelete: (file: CatalogFileSummary) => void
}

function CatalogFileList({ deleteApiReady, deletingFileId, files, onDelete }: CatalogFileListProps): JSX.Element {
  return (
    <ul className="dat-file-list dat-file-list--loaded">
      {files.map((file) => (
        <li key={file.id}>
          <span>
            <strong>{file.fileName}</strong>
            <small>{catalogSubtitle(file)}</small>
            <small>{file.path}</small>
          </span>
          <span className="dat-file-meta">
            <b>{file.romCount}</b>
            <small>ROMs</small>
          </span>
          <button
            className="icon-btn icon-btn--sm icon-btn--ghost icon-btn--danger"
            type="button"
            onClick={() => onDelete(file)}
            disabled={deletingFileId !== null || !deleteApiReady}
            title="Remover do catalogo"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function ImportResultList({ files }: { files: CatalogImportFileResult[] }): JSX.Element {
  return (
    <ul className="dat-result-list">
      {files.map((file) => (
        <li key={`${file.path}-${file.status}`} className={`dat-result dat-result--${file.status}`}>
          {file.status === 'imported'
            ? <CheckCircle2 size={16} aria-hidden="true" />
            : <AlertCircle size={16} aria-hidden="true" />
          }
          <span>
            <strong>{file.fileName}</strong>
            <small>{file.message}</small>
          </span>
          <span>{file.source ? sourceLabel(file.source) : '-'}</span>
        </li>
      ))}
    </ul>
  )
}

function mergeUniquePaths(current: string[], next: string[]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []

  for (const path of [...current, ...next]) {
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(path)
  }

  return merged
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function catalogSubtitle(file: CatalogFileSummary): string {
  const name = file.catalogName ?? sourceLabel(file.source)
  const version = file.catalogVersion ? ` ${file.catalogVersion}` : ''
  return `${name}${version} | ${sourceLabel(file.source)} | ${formatBytes(file.fileSize)} | ${formatDate(file.importedAt)}`
}

function hashSummary(result: CatalogSearchResult): string {
  const hash = result.hashes.sha1 ?? result.hashes.md5 ?? result.hashes.crc32 ?? result.hashes.sha256
  return hash ? `Hash: ${hash}` : 'Sem hash informado'
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let size = value
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit] ?? 'B'}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}
