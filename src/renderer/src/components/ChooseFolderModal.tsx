import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { FolderOpen, FolderSearch, X } from 'lucide-react'
import { PLATFORM_NAMES, type PlatformOverride } from '@shared/types'
import { useRomStore } from '@renderer/stores/useRomStore'
import { AppSelect, type SelectItem } from './AppSelect'

const PLATFORM_GROUPS: ReadonlyArray<{ label: string; platforms: string[] }> = [
  {
    label: 'Nintendo — cartuchos',
    platforms: ['NES', 'SNES', 'Nintendo 64', 'Game Boy', 'Game Boy Color', 'Game Boy Advance', 'Nintendo DS', 'Nintendo 3DS'],
  },
  {
    label: 'Nintendo — discos',
    platforms: ['GameCube', 'Wii', 'Wii U'],
  },
  {
    label: 'Sega — cartuchos',
    platforms: ['Master System', 'Game Gear', 'Mega Drive', 'Sega 32X'],
  },
  {
    label: 'Sega — discos',
    platforms: ['Mega CD', 'Sega Saturn', 'Dreamcast'],
  },
  {
    label: 'Sony',
    platforms: ['PlayStation 1', 'PlayStation 2', 'PlayStation 3', 'PlayStation Portable'],
  },
  {
    label: 'Atari',
    platforms: ['Atari 2600', 'Atari 7800', 'Atari Jaguar'],
  },
  {
    label: 'SNK',
    platforms: ['Neo Geo', 'Neo Geo Pocket'],
  },
  {
    label: 'Outros',
    platforms: ['PC Engine', 'WonderSwan'],
  },
]

const PLATFORM_SELECT_ITEMS: SelectItem[] = [
  { value: 'auto', label: 'Autodetectar (recomendado)' },
  ...PLATFORM_GROUPS.map((group) => ({
    groupLabel: group.label,
    options: group.platforms.map((p) => ({ value: p, label: p })),
  })),
]

export function ChooseFolderModal(): JSX.Element | null {
  const folderModalOpen = useRomStore((state) => state.folderModalOpen)
  const closeFolderModal = useRomStore((state) => state.closeFolderModal)
  const applyFolderScan = useRomStore((state) => state.applyFolderScan)
  const currentFolder = useRomStore((state) => state.folderPath)
  const currentOverride = useRomStore((state) => state.config.platformOverride)

  const [pendingPath, setPendingPath] = useState<string>('')
  const [pendingPlatform, setPendingPlatform] = useState<PlatformOverride>('auto')
  const [browsing, setBrowsing] = useState(false)

  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!folderModalOpen) return
    setPendingPath(currentFolder ?? '')
    setPendingPlatform(currentOverride)
  }, [folderModalOpen, currentFolder, currentOverride])

  useEffect(() => {
    if (!folderModalOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeFolderModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folderModalOpen, closeFolderModal])

  if (!folderModalOpen) return null

  const handleBrowse = async (): Promise<void> => {
    setBrowsing(true)
    try {
      const chosen = await window.api.chooseFolder()
      if (chosen) setPendingPath(chosen)
    } finally {
      setBrowsing(false)
    }
  }

  const handleConfirm = (): void => {
    if (!pendingPath) return
    void applyFolderScan(pendingPath, pendingPlatform)
  }

  const folderName = pendingPath ? pendingPath.split(/[\\/]/).filter(Boolean).pop() ?? pendingPath : ''
  const isValid = PLATFORM_NAMES.includes(pendingPlatform as never) || pendingPlatform === 'auto'

  return (
    <div className="dialog-backdrop" role="presentation" onClick={closeFolderModal}>
      <section
        className="dialog folder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <span className="dialog__header-icon">
            <FolderOpen size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="folder-modal-title">Escolher pasta</h2>
            <p>Selecione a pasta e a plataforma das ROMs.</p>
          </div>
          <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={closeFolderModal} title="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog__body">
          <div className="folder-modal__fields">
            <div className="field">
              <span className="field__label">Pasta</span>
              <div className="field-row">
                <button
                  className={`folder-pick-btn ${pendingPath ? 'folder-pick-btn--filled' : ''}`}
                  type="button"
                  onClick={handleBrowse}
                  disabled={browsing}
                >
                  <FolderSearch size={16} aria-hidden="true" className="folder-pick-btn__icon" />
                  <span className="folder-pick-btn__text">
                    {pendingPath
                      ? <><b>{folderName}</b><small>{pendingPath}</small></>
                      : 'Nenhuma pasta selecionada — clique para procurar'
                    }
                  </span>
                  <span className="folder-pick-btn__cta">Procurar</span>
                </button>
              </div>
            </div>

            <div className="field">
              <span className="field__label">Plataforma</span>
              <AppSelect
                value={pendingPlatform}
                onChange={(v) => setPendingPlatform(v as PlatformOverride)}
                items={PLATFORM_SELECT_ITEMS}
              />
              {pendingPlatform === 'auto' && (
                <p className="field__hint">
                  Plataforma detectada pela extensão e nome do arquivo. Para pastas com uma única plataforma, forçar melhora a precisão.
                </p>
              )}
              {pendingPlatform !== 'auto' && (
                <p className="field__hint field__hint--accent">
                  Todos os arquivos serão marcados como <strong>{pendingPlatform}</strong>, ignorando a extensão.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="dialog__footer">
          <button className="btn" type="button" onClick={closeFolderModal}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            className="btn btn--primary"
            type="button"
            onClick={handleConfirm}
            disabled={!pendingPath || !isValid}
          >
            <FolderOpen size={17} aria-hidden="true" />
            <span>Confirmar e escanear</span>
          </button>
        </footer>
      </section>
    </div>
  )
}
