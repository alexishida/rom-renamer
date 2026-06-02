import { contextBridge, ipcRenderer } from 'electron'
import type {
  CatalogDeleteResult,
  CatalogFileSummary,
  CatalogImportResult,
  CatalogSearchResult,
  Config,
  PlatformName,
  RenameResult,
  RenameSummary,
  RomItem,
  ScanProgress,
  UndoResult,
} from '@shared/types'

const api: RomRenamerApi = {
  chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
  chooseDatFiles: () => ipcRenderer.invoke('dialog:chooseDatFiles'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  scanFolder: (folderPath, config) => ipcRenderer.invoke('rom:scanFolder', { folderPath, config }),
  onScanProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => callback(progress)
    ipcRenderer.on('rom:scanProgress', listener)
    return () => ipcRenderer.removeListener('rom:scanProgress', listener)
  },
  updateSuggestion: (id, suggestedName) =>
    ipcRenderer.invoke('rom:updateSuggestion', { id, suggestedName }),
  markItem: (id, status) => ipcRenderer.invoke('rom:markItem', { id, status }),
  searchCatalog: (query, platformName) => ipcRenderer.invoke('catalog:search', { query, limit: 20, platformName: platformName ?? null }),
  listCatalogFiles: () => ipcRenderer.invoke('catalog:listFiles'),
  importDatFiles: (paths) => ipcRenderer.invoke('catalog:importDatFiles', { paths }),
  deleteCatalogFile: (id) => ipcRenderer.invoke('catalog:deleteFile', { id }),
  clearCatalog: () => ipcRenderer.invoke('catalog:clear'),
  applyCatalogSuggestion: (id, catalogId) =>
    ipcRenderer.invoke('rom:applyCatalogSuggestion', { id, catalogId }),
  previewRename: (ids, config) => ipcRenderer.invoke('rom:previewRename', { ids, config }),
  renameItems: (ids, config) => ipcRenderer.invoke('rom:renameItems', { ids, config }),
  undoLastRename: () => ipcRenderer.invoke('rom:undoLastRename'),
}

contextBridge.exposeInMainWorld('api', api)

export interface RomRenamerApi {
  chooseFolder: () => Promise<string | null>
  chooseDatFiles: () => Promise<string[]>
  getConfig: () => Promise<Config>
  saveConfig: (config: Config) => Promise<Config>
  scanFolder: (folderPath: string, config: Config) => Promise<RomItem[]>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
  updateSuggestion: (id: string, suggestedName: string) => Promise<RomItem>
  markItem: (id: string, status: 'validated' | 'ignored') => Promise<RomItem>
  searchCatalog: (query: string, platformName?: PlatformName | null) => Promise<CatalogSearchResult[]>
  listCatalogFiles: () => Promise<CatalogFileSummary[]>
  importDatFiles: (paths: string[]) => Promise<CatalogImportResult>
  deleteCatalogFile: (id: number) => Promise<CatalogDeleteResult>
  clearCatalog: () => Promise<CatalogDeleteResult>
  applyCatalogSuggestion: (id: string, catalogId: number) => Promise<RomItem>
  previewRename: (ids: string[], config: Config) => Promise<RenameSummary>
  renameItems: (ids: string[], config: Config) => Promise<RenameResult>
  undoLastRename: () => Promise<UndoResult>
}
