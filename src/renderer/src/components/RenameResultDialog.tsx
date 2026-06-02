import type { JSX } from 'react'
import { AlertTriangle, CheckCheck, ListFilter, X } from 'lucide-react'
import { useRomStore } from '@renderer/stores/useRomStore'

export function RenameResultDialog(): JSX.Element | null {
  const renameReport = useRomStore((state) => state.renameReport)
  const items = useRomStore((state) => state.items)
  const closeRenameReport = useRomStore((state) => state.closeRenameReport)
  const showNonRenamedItems = useRomStore((state) => state.showNonRenamedItems)

  if (!renameReport) return null

  const remainingItems = items.filter((item) => item.status !== 'renamed')

  return (
    <div className="dialog-backdrop" role="presentation" onClick={closeRenameReport}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-result-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <span className="dialog__header-icon">
            <CheckCheck size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="rename-result-dialog-title">Renomeacao concluida</h2>
            <p>Veja os registros que ainda nao ficaram como renomeados.</p>
          </div>
          <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={closeRenameReport} title="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog__body">
          <div className="summary-grid">
            <div className="summary-card">
              <b>{renameReport.renamedItems.length}</b>
              <span>Renomeados</span>
            </div>
            <div className="summary-card">
              <b>{remainingItems.length}</b>
              <span>Nao renomeados</span>
            </div>
            <div className={`summary-card ${renameReport.errors.length ? 'summary-card--warn' : ''}`}>
              <b>{renameReport.errors.length}</b>
              <span>Falhas</span>
            </div>
          </div>

          {remainingItems.length > 0 && (
            <div className="dialog-list">
              <h3>Registros nao renomeados</h3>
              <ul className="dialog-list__scroll">
                {remainingItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.originalName}</span>
                    <strong>{statusLabel(item.status)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {renameReport.errors.length > 0 && (
            <div className="dialog-list dialog-list--warn">
              <h3>
                <AlertTriangle size={15} aria-hidden="true" />
                Falhas
              </h3>
              <ul className="dialog-list__scroll">
                {renameReport.errors.map((error, index) => (
                  <li key={`${error.id}-${index}`}>
                    <span>{error.originalName}</span>
                    <strong>{error.reason}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="dialog__footer">
          <button className="btn" type="button" onClick={closeRenameReport}>
            Fechar
          </button>
          <button className="btn btn--primary" type="button" onClick={showNonRenamedItems}>
            <ListFilter size={17} aria-hidden="true" />
            <span>Ver nao renomeados</span>
          </button>
        </footer>
      </section>
    </div>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendente'
    case 'identifying':
      return 'Lendo'
    case 'identified':
      return 'Identificado'
    case 'validated':
      return 'Validado'
    case 'error':
      return 'Erro'
    case 'ignored':
      return 'Ignorado'
    default:
      return status
  }
}
