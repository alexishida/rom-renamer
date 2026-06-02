import { useEffect } from 'react'
import type { JSX } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { ChooseFolderModal } from './components/ChooseFolderModal'
import { ConfigPanel } from './components/ConfigPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { DatCatalogModal } from './components/DatCatalogModal'
import { RenameResultDialog } from './components/RenameResultDialog'
import { RomTable } from './components/RomTable'
import { StatsFilter } from './components/StatsFilter'
import { Toolbar } from './components/Toolbar'
import { useRomStore } from './stores/useRomStore'
import './styles.css'

export function App(): JSX.Element {
  const hydrateConfig = useRomStore((state) => state.hydrateConfig)
  const folderPath = useRomStore((state) => state.folderPath)
  const notice = useRomStore((state) => state.notice)
  const error = useRomStore((state) => state.error)
  const setScanProgress = useRomStore((state) => state.setScanProgress)
  const dismissMessages = useRomStore((state) => state.dismissMessages)

  useEffect(() => {
    void hydrateConfig()
  }, [hydrateConfig])

  useEffect(() => {
    if (!notice && !error) return
    const timer = window.setTimeout(() => dismissMessages(), error ? 6000 : 3500)
    return () => window.clearTimeout(timer)
  }, [notice, error, dismissMessages])

  useEffect(() => {
    return window.api.onScanProgress((progress) => {
      setScanProgress(progress)
    })
  }, [setScanProgress])

  return (
    <div className="app">
      <Toolbar />
      {folderPath && <StatsFilter />}
      <div className="content">
        <RomTable />
      </div>

      <ConfigPanel />
      <ChooseFolderModal />
      <DatCatalogModal />

      {(notice || error) && (
        <div className={`toast ${error ? 'toast--error' : 'toast--info'}`} role="status">
          <span className="toast__icon">
            {error ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
          </span>
          <span className="toast__msg">{error ?? notice}</span>
          <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={dismissMessages} title="Fechar">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <ConfirmDialog />
      <RenameResultDialog />
    </div>
  )
}
