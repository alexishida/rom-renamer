import type { JSX } from 'react'
import { AlertTriangle, ArrowRight, CheckCheck, FileSymlink, X } from 'lucide-react'
import { useRomStore } from '@renderer/stores/useRomStore'

export function ConfirmDialog(): JSX.Element | null {
  const summary = useRomStore((state) => state.renameSummary)
  const confirmRename = useRomStore((state) => state.confirmRename)
  const cancelRename = useRomStore((state) => state.cancelRename)

  if (!summary) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={cancelRename}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <span className="dialog__header-icon">
            <FileSymlink size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="rename-dialog-title">Confirmar renomeação</h2>
            <p>Revise as alterações antes de aplicar ao disco.</p>
          </div>
          <button className="icon-btn icon-btn--sm icon-btn--ghost" type="button" onClick={cancelRename} title="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="dialog__body">
          <div className="summary-grid">
            <div className="summary-card">
              <b>{summary.totalItems}</b>
              <span>Itens</span>
            </div>
            <div className="summary-card">
              <b>{summary.totalOperations}</b>
              <span>Operações em disco</span>
            </div>
            <div className={`summary-card ${summary.conflicts.length ? 'summary-card--warn' : ''}`}>
              <b>{summary.conflicts.length}</b>
              <span>Conflitos</span>
            </div>
            <div className={`summary-card ${summary.skipped.length ? 'summary-card--muted' : ''}`}>
              <b>{summary.skipped.length}</b>
              <span>Pulados</span>
            </div>
          </div>

          {summary.conflicts.length > 0 && (
            <div className="dialog-list dialog-list--warn">
              <h3>
                <AlertTriangle size={15} aria-hidden="true" />
                Conflitos de nome
              </h3>
              <ul>
                {summary.conflicts.map((conflict, index) => (
                  <li key={`${conflict.id}-${index}`}>
                    <span>{conflict.requestedName}</span>
                    <strong>{conflict.resolvedName ?? conflict.reason}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.items.length > 0 && (
            <div className="dialog-list">
              <h3>Alterações</h3>
              <ul className="dialog-list__scroll">
                {summary.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.originalName}</span>
                    <strong>
                      <ArrowRight size={14} aria-hidden="true" />
                      {item.targetName}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="dialog__footer">
          <button className="btn" type="button" onClick={cancelRename}>
            Cancelar
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={confirmRename}
            disabled={summary.totalItems === 0}
          >
            <CheckCheck size={17} aria-hidden="true" />
            <span>Aplicar renomeação</span>
          </button>
        </footer>
      </section>
    </div>
  )
}
