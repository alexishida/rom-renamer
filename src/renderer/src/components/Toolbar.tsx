import type { JSX } from 'react'
import { CheckCheck, FolderOpen, Gamepad2, RefreshCw, RotateCcw, Settings } from 'lucide-react'
import { countByStatus, useRomStore } from '@renderer/stores/useRomStore'

export function Toolbar(): JSX.Element {
  const folderPath = useRomStore((state) => state.folderPath)
  const scanning = useRomStore((state) => state.scanning)
  const items = useRomStore((state) => state.items)
  const openFolderModal = useRomStore((state) => state.openFolderModal)
  const identifyAll = useRomStore((state) => state.identifyAll)
  const renameAllValidated = useRomStore((state) => state.renameAllValidated)
  const undoLastRename = useRomStore((state) => state.undoLastRename)
  const setConfigOpen = useRomStore((state) => state.setConfigOpen)
  const counts = countByStatus(items)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__logo">
          <Gamepad2 size={19} aria-hidden="true" />
        </span>
        <span className="brand__name">ROM Renamer</span>
      </div>

      <div className="topbar__sep" />

      <div className="topbar__actions">
        <button className="btn btn--primary" type="button" onClick={openFolderModal} disabled={scanning}>
          <FolderOpen size={17} aria-hidden="true" />
          <span>Escolher pasta</span>
        </button>
        <button
          className="btn"
          type="button"
          onClick={identifyAll}
          disabled={!folderPath || scanning}
          title="Reidentificar a pasta atual"
        >
          <RefreshCw size={16} className={scanning ? 'spin-icon' : undefined} aria-hidden="true" />
          <span>{scanning ? 'Lendo...' : 'Identificar'}</span>
        </button>
        <button
          className="btn"
          type="button"
          onClick={renameAllValidated}
          disabled={counts.validated === 0 || scanning}
          title="Renomear todos os itens validados"
        >
          <CheckCheck size={16} aria-hidden="true" />
          <span>Renomear validados</span>
          {counts.validated > 0 && <span className="chip__count">{counts.validated}</span>}
        </button>
      </div>

      <div className="topbar__right">
        <button
          className="icon-btn"
          type="button"
          onClick={undoLastRename}
          disabled={scanning}
          title="Desfazer último lote renomeado"
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        <button className="icon-btn" type="button" onClick={() => setConfigOpen(true)} title="Configurações">
          <Settings size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
