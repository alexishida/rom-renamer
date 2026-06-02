import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Database, Search, X } from 'lucide-react'
import type { CatalogSearchResult, Hashes, RomItem } from '@shared/types'
import { sourceLabel } from '@renderer/lib/labels'
import { useRomStore } from '@renderer/stores/useRomStore'

interface CatalogSearchModalProps {
  item: RomItem | null
  onClose: () => void
}

type DisplayHashes = Hashes & {
  sha256?: string | null
}

const HASH_LABELS: ReadonlyArray<keyof DisplayHashes> = ['crc32', 'md5', 'sha1', 'sha256']

export function CatalogSearchModal({ item, onClose }: CatalogSearchModalProps): JSX.Element | null {
  const applyCatalogSuggestion = useRomStore((state) => state.applyCatalogSuggestion)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!item) return

    setQuery(item.suggestedName?.trim() || stripExtension(item.originalName))
    setResults([])
    setError(null)
    setApplyingId(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [item])

  useEffect(() => {
    if (!item) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      void window.api.searchCatalog(trimmed)
        .then((nextResults) => {
          if (active) setResults(nextResults)
        })
        .catch((searchError: unknown) => {
          if (active) {
            setResults([])
            setError(searchError instanceof Error ? searchError.message : 'Falha ao buscar no catálogo.')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [item, query])

  useEffect(() => {
    if (!item) return

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  const statusText = useMemo(() => {
    if (loading) return 'Buscando...'
    if (error) return error
    if (query.trim().length < 2) return 'Digite ao menos 2 caracteres.'
    if (!results.length) return 'Nenhum resultado.'
    return `${results.length} resultado${results.length === 1 ? '' : 's'}`
  }, [error, loading, query, results.length])

  if (!item) return null

  const handleApply = async (catalogId: number): Promise<void> => {
    setApplyingId(catalogId)
    try {
      await applyCatalogSuggestion(item.id, catalogId)
      onClose()
    } catch {
      // Store already exposes the user-facing error toast.
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="dialog catalog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-search-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <span className="dialog__header-icon">
            <Database size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="catalog-search-title">Buscar no catálogo</h2>
            <p>{item.originalName}</p>
          </div>
          <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={onClose} title="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog__body catalog-modal__body">
          <label className="catalog-search-field">
            <span className="field__label">Busca</span>
            <span className="catalog-search-field__control">
              <Search size={16} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Digite nome da ROM"
              />
            </span>
          </label>

          <section className="catalog-hash-panel">
            <h3>Hashes do arquivo</h3>
            <HashList hashes={item.hashes} />
          </section>

          <section className="catalog-results" aria-live="polite">
            <div className="catalog-results__head">
              <h3>Resultados</h3>
              <span className={error ? 'catalog-results__status catalog-results__status--error' : 'catalog-results__status'}>
                {statusText}
              </span>
            </div>

            {results.length > 0 && (
              <ul className="catalog-results__list">
                {results.map((result) => (
                  <li key={result.id} className="catalog-result">
                    <div className="catalog-result__main">
                      <div className="catalog-result__title">
                        <strong>{result.name}</strong>
                        <span>{sourceLabel(result.source)}</span>
                      </div>
                      <span className="catalog-result__rom">{result.romName}</span>
                      <HashList hashes={result.hashes} compact />
                    </div>
                    <button
                      className="btn btn--sm"
                      type="button"
                      onClick={() => void handleApply(result.id)}
                      disabled={applyingId !== null}
                    >
                      {applyingId === result.id ? 'Aplicando...' : 'Usar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="dialog__footer">
          <button className="btn" type="button" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </section>
    </div>
  )
}

interface HashListProps {
  hashes: DisplayHashes
  compact?: boolean
}

function HashList({ hashes, compact = false }: HashListProps): JSX.Element {
  return (
    <dl className={`hash-list ${compact ? 'hash-list--compact' : ''}`}>
      {HASH_LABELS.map((key) => {
        const value = hashes[key] ?? null
        if (key === 'sha256' && !value) return null

        return (
          <div key={key} className="hash-list__item">
            <dt>{key.toUpperCase()}</dt>
            <dd title={value ?? 'Não calculado'}>{value ?? 'Não calculado'}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function stripExtension(value: string): string {
  return value.replace(/\.[^.]+$/, '')
}
