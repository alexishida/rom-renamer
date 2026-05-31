import { useEffect } from 'react'
import type { JSX } from 'react'
import { ChevronDown, Database, FolderSearch, Globe2, Settings, SlidersHorizontal, X } from 'lucide-react'
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

  const browseInto = async (apply: (path: string) => void): Promise<void> => {
    const path = await window.api.chooseFolder()
    if (path) apply(path)
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
        aria-label="Configurações"
        aria-hidden={!configOpen}
      >
        <header className="drawer__header">
          <h2 className="drawer__title">
            <Settings size={18} aria-hidden="true" />
            Configurações
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
                  <span>Varrer também as subpastas</span>
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
                <span className="field__label">Plataforma padrão</span>
                <select
                  value={config.platformOverride}
                  onChange={(event) => patch({ platformOverride: event.target.value as PlatformOverride })}
                >
                  <option value="auto">Autodetectar</option>
                  {PLATFORM_NAMES.map((p) => (
                    <option key={p} value={p}>{p}</option>
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

          <details className="group" open>
            <summary>
              <Database size={16} className="group__icon" aria-hidden="true" />
              Bancos de dados (DATs)
              <ChevronDown size={16} className="group__chevron" aria-hidden="true" />
            </summary>
            <p className="group__hint">Identificação offline por hash com alta confiança.</p>
            <div className="group__content">
              <label className="field">
                <span className="field__label">No-Intro (cartuchos)</span>
                <div className="field-row">
                  <input
                    value={config.datPaths.noIntro}
                    onChange={(event) => patch({ datPaths: { ...config.datPaths, noIntro: event.target.value } })}
                    placeholder="Arquivo ou pasta"
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => browseInto((path) => patch({ datPaths: { ...config.datPaths, noIntro: path } }))}
                    title="Procurar pasta"
                  >
                    <FolderSearch size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="field__label">Redump (mídia óptica)</span>
                <div className="field-row">
                  <input
                    value={config.datPaths.redump}
                    onChange={(event) => patch({ datPaths: { ...config.datPaths, redump: event.target.value } })}
                    placeholder="Arquivo ou pasta"
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => browseInto((path) => patch({ datPaths: { ...config.datPaths, redump: path } }))}
                    title="Procurar pasta"
                  >
                    <FolderSearch size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>
            </div>
          </details>

          <details className="group">
            <summary>
              <Globe2 size={16} className="group__icon" aria-hidden="true" />
              APIs de metadados
              <ChevronDown size={16} className="group__chevron" aria-hidden="true" />
            </summary>
            <p className="group__hint">Usadas como fallback online quando o hash não bate.</p>
            <div className="group__content">
              <label className="field">
                <span className="field__label">ScreenScraper — usuário</span>
                <input
                  value={config.api.screenScraperUser}
                  onChange={(event) => patch({ api: { ...config.api, screenScraperUser: event.target.value } })}
                />
              </label>
              <label className="field">
                <span className="field__label">ScreenScraper — senha</span>
                <input
                  type="password"
                  value={config.api.screenScraperPassword}
                  onChange={(event) => patch({ api: { ...config.api, screenScraperPassword: event.target.value } })}
                />
              </label>
              <label className="field">
                <span className="field__label">IGDB — client ID</span>
                <input
                  value={config.api.igdbClientId}
                  onChange={(event) => patch({ api: { ...config.api, igdbClientId: event.target.value } })}
                />
              </label>
              <label className="field">
                <span className="field__label">IGDB — token</span>
                <input
                  type="password"
                  value={config.api.igdbToken}
                  onChange={(event) => patch({ api: { ...config.api, igdbToken: event.target.value } })}
                />
              </label>
            </div>
          </details>
        </div>
      </aside>
    </>
  )
}
