import { useEffect } from 'react'
import type { JSX } from 'react'
import { Database, Settings, SlidersHorizontal, X } from 'lucide-react'
import type { Config, PlatformOverride } from '@shared/types'
import { PLATFORM_NAMES } from '@shared/types'
import { useRomStore } from '@renderer/stores/useRomStore'

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

              <label className="field">
                <span className="field__label">Plataforma padrao</span>
                <select
                  value={config.platformOverride}
                  onChange={(event) => patch({ platformOverride: event.target.value as PlatformOverride })}
                >
                  <option value="auto">Autodetectar</option>
                  {PLATFORM_NAMES.map((platform) => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Conflitos de nome</span>
                <select
                  value={config.conflictStrategy}
                  onChange={(event) =>
                    patch({ conflictStrategy: event.target.value === 'skip' ? 'skip' : 'suffix' })
                  }
                >
                  <option value="suffix">Sufixar (manter os dois)</option>
                  <option value="skip">Avisar e pular</option>
                </select>
              </label>
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
