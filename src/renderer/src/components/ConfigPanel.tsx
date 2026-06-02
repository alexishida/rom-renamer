import { useEffect } from 'react'
import type { JSX } from 'react'
import { Database, Settings, SlidersHorizontal, X } from 'lucide-react'
import type { Config, PlatformOverride } from '@shared/types'
import { PLATFORM_NAMES } from '@shared/types'
import { useRomStore } from '@renderer/stores/useRomStore'
import { AppSelect, type SelectItem } from './AppSelect'

const PLATFORM_SELECT_ITEMS: SelectItem[] = [
  { value: 'auto', label: 'Autodetectar' },
  ...PLATFORM_NAMES.map((p) => ({ value: p, label: p })),
]

const CONFLICT_SELECT_ITEMS: SelectItem[] = [
  { value: 'suffix', label: 'Sufixar (manter os dois)' },
  { value: 'skip', label: 'Avisar e pular' },
]

export function ConfigPanel(): JSX.Element {
  const config = useRomStore((state) => state.config)
  const updateConfig = useRomStore((state) => state.updateConfig)
  const configOpen = useRomStore((state) => state.configOpen)
  const setConfigOpen = useRomStore((state) => state.setConfigOpen)

  useEffect(() => {
    if (!configOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setConfigOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [configOpen, setConfigOpen])

  const patch = (partial: Partial<Config>): void => {
    void updateConfig({ ...config, ...partial })
  }

  return (
    <>
      <div
        className={`drawer-overlay ${configOpen ? 'is-open' : ''}`}
        role="presentation"
        onClick={() => setConfigOpen(false)}
      />
      <aside
        className={`drawer ${configOpen ? 'is-open' : ''}`}
        aria-label="Configuracoes"
        aria-hidden={!configOpen}
      >
        <header className="drawer__header">
          <h2 className="drawer__title">
            <Settings size={18} aria-hidden="true" />
            Configuracoes
          </h2>
          <button
            className="icon-btn icon-btn--sm icon-btn--ghost drawer__close"
            type="button"
            onClick={() => setConfigOpen(false)}
            title="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="drawer__body">
          <section className="group">
            <div className="group__head">
              <SlidersHorizontal size={16} className="group__icon" aria-hidden="true" />
              Geral
            </div>
            <div className="group__content">
              <label className="switch">
                <span className="switch__text">
                  <b>Busca recursiva</b>
                  <span>Varrer tambem as subpastas</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.recursive}
                  onChange={(event) => patch({ recursive: event.target.checked })}
                />
                <span className="switch__track" />
              </label>

              <label className="field">
                <span className="field__label">Template de nome</span>
                <input
                  value={config.nameTemplate}
                  onChange={(event) => patch({ nameTemplate: event.target.value })}
                  placeholder="{Nome}.{ext}"
                />
              </label>

              <div className="field">
                <span className="field__label">Plataforma padrao</span>
                <AppSelect
                  value={config.platformOverride}
                  onChange={(v) => patch({ platformOverride: v as PlatformOverride })}
                  items={PLATFORM_SELECT_ITEMS}
                />
              </div>

              <div className="field">
                <span className="field__label">Conflitos de nome</span>
                <AppSelect
                  value={config.conflictStrategy}
                  onChange={(v) => patch({ conflictStrategy: v === 'skip' ? 'skip' : 'suffix' })}
                  items={CONFLICT_SELECT_ITEMS}
                />
              </div>
            </div>
          </section>

          <section className="group">
            <div className="group__head">
              <Database size={16} className="group__icon" aria-hidden="true" />
              Catalogo SQLite
            </div>
            <div className="group__content">
              <p className="group__hint">
                Identificacao offline usa somente <code>resources/rom-catalog.sqlite</code>.
              </p>
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
