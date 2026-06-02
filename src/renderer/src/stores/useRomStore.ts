import { create } from 'zustand'
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  type Config,
  type RenameResult,
  type RenameSummary,
  type RomItem,
  type RomStatus,
  type ScanProgress,
  type UndoResult,
} from '@shared/types'

export type StatusFilter = 'all' | 'not-renamed' | RomStatus

interface RomStoreState {
  folderPath: string | null
  scanning: boolean
  scanProgress: ScanProgress | null
  items: RomItem[]
  selectedIds: string[]
  config: Config
  renameSummary: RenameSummary | null
  pendingRenameIds: string[]
  notice: string | null
  error: string | null
  // UI state
  configOpen: boolean
  folderModalOpen: boolean
  catalogModalOpen: boolean
  statusFilter: StatusFilter
  searchTerm: string
  hydrateConfig: () => Promise<void>
  openFolderModal: () => void
  closeFolderModal: () => void
  applyFolderScan: (folderPath: string, platformOverride: import('@shared/types').PlatformOverride) => Promise<void>
  chooseFolder: () => Promise<void>
  scanFolder: () => Promise<void>
  identifyAll: () => Promise<void>
  updateConfig: (config: Config) => Promise<void>
  setSuggestedName: (id: string, suggestedName: string) => void
  syncSuggestedName: (id: string) => Promise<void>
  applyCatalogSuggestion: (id: string, catalogId: number) => Promise<void>
  validateItem: (id: string) => Promise<void>
  ignoreItem: (id: string) => Promise<void>
  validateMany: (ids: string[]) => Promise<void>
  ignoreMany: (ids: string[]) => Promise<void>
  toggleSelected: (id: string) => void
  toggleAllSelected: () => void
  setSelectedIds: (ids: string[]) => void
  clearSelection: () => void
  prepareRename: (ids: string[]) => Promise<void>
  renameOne: (id: string) => Promise<void>
  renameSelected: () => Promise<void>
  renameAllValidated: () => Promise<void>
  confirmRename: () => Promise<void>
  cancelRename: () => void
  undoLastRename: () => Promise<void>
  setConfigOpen: (open: boolean) => void
  setFolderModalOpen: (open: boolean) => void
  setCatalogModalOpen: (open: boolean) => void
  setStatusFilter: (filter: StatusFilter) => void
  setSearchTerm: (term: string) => void
  setScanProgress: (progress: ScanProgress | null) => void
  dismissMessages: () => void
}

export const useRomStore = create<RomStoreState>((set, get) => ({
  folderPath: null,
  scanning: false,
  scanProgress: null,
  items: [],
  selectedIds: [],
  config: DEFAULT_CONFIG,
  renameSummary: null,
  pendingRenameIds: [],
  notice: null,
  error: null,
  configOpen: false,
  folderModalOpen: false,
  catalogModalOpen: false,
  statusFilter: 'all',
  searchTerm: '',

  hydrateConfig: async () => {
    try {
      const config = await window.api.getConfig()
      set({ config: normalizeConfig(config) })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  openFolderModal: () => set({ folderModalOpen: true }),

  closeFolderModal: () => set({ folderModalOpen: false }),

  applyFolderScan: async (folderPath, platformOverride) => {
    const newConfig = normalizeConfig({ ...get().config, platformOverride })
    set({ folderPath, notice: null, error: null, folderModalOpen: false })
    try {
      await window.api.saveConfig(newConfig)
      set({ config: newConfig })
    } catch {
      // Config save failure is non-fatal — proceed with scan
    }
    await get().scanFolder()
  },

  chooseFolder: async () => {
    try {
      const folderPath = await window.api.chooseFolder()
      if (!folderPath) return
      set({ folderPath, notice: null, error: null })
      await get().scanFolder()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  scanFolder: async () => {
    const { folderPath, config } = get()
    if (!folderPath) return

    set({
      scanning: true,
      scanProgress: {
        current: 0,
        total: 100,
        title: 'Lendo a pasta...',
        detail: 'Preparando leitura da pasta selecionada.',
      },
      items: [],
      selectedIds: [],
      error: null,
      notice: null,
    })
    try {
      const items = await window.api.scanFolder(folderPath, config)
      set({
        items,
        selectedIds: [],
        scanning: false,
        scanProgress: null,
        notice: `${items.length} ROMs encontradas.`,
      })
    } catch (error) {
      set({ scanning: false, scanProgress: null, error: errorMessage(error) })
    }
  },

  identifyAll: async () => {
    await get().scanFolder()
  },

  updateConfig: async (config) => {
    const normalized = normalizeConfig(config)
    set({ config: normalized })
    try {
      const saved = await window.api.saveConfig(normalized)
      set({ config: normalizeConfig(saved), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  setSuggestedName: (id, suggestedName) => {
    set(({ items }) => ({
      items: items.map((item) =>
        item.id === id
          ? {
              ...item,
              suggestedName,
              status: item.status === 'validated' ? 'identified' : item.status,
            }
          : item,
      ),
    }))
  },

  syncSuggestedName: async (id) => {
    const item = get().items.find((candidate) => candidate.id === id)
    if (!item) return

    try {
      const updated = await window.api.updateSuggestion(id, item.suggestedName ?? '')
      set({ items: replaceItem(get().items, updated), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  applyCatalogSuggestion: async (id, catalogId) => {
    try {
      const updated = await window.api.applyCatalogSuggestion(id, catalogId)
      set({ items: replaceItem(get().items, updated), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
      throw error
    }
  },

  validateItem: async (id) => {
    try {
      await get().syncSuggestedName(id)
      const updated = await window.api.markItem(id, 'validated')
      set({ items: replaceItem(get().items, updated), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  ignoreItem: async (id) => {
    try {
      const updated = await window.api.markItem(id, 'ignored')
      set(({ selectedIds, items }) => ({
        items: replaceItem(items, updated),
        selectedIds: selectedIds.filter((selectedId) => selectedId !== id),
        error: null,
      }))
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  validateMany: async (ids) => {
    for (const id of ids) {
      await get().validateItem(id)
    }
  },

  ignoreMany: async (ids) => {
    for (const id of ids) {
      await get().ignoreItem(id)
    }
  },

  toggleSelected: (id) => {
    set(({ selectedIds }) => ({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    }))
  },

  toggleAllSelected: () => {
    const selectableIds = get()
      .items.filter((item) => item.status !== 'ignored' && item.status !== 'renamed')
      .map((item) => item.id)
    const selectedIds = get().selectedIds
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))
    set({ selectedIds: allSelected ? [] : selectableIds })
  },

  setSelectedIds: (selectedIds) => set({ selectedIds }),

  clearSelection: () => set({ selectedIds: [] }),

  prepareRename: async (ids) => {
    if (!ids.length) return
    try {
      const summary = await window.api.previewRename(ids, get().config)
      set({
        renameSummary: summary,
        pendingRenameIds: ids,
        error: null,
      })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  renameOne: async (id) => {
    await get().prepareRename([id])
  },

  renameSelected: async () => {
    const selected = new Set(get().selectedIds)
    const ids = get()
      .items.filter((item) => selected.has(item.id) && item.status !== 'ignored' && item.status !== 'renamed')
      .map((item) => item.id)
    await get().prepareRename(ids)
  },

  renameAllValidated: async () => {
    const ids = get()
      .items.filter((item) => item.status === 'validated')
      .map((item) => item.id)
    await get().prepareRename(ids)
  },

  confirmRename: async () => {
    const { pendingRenameIds, config } = get()
    if (!pendingRenameIds.length) return

    try {
      const result = await window.api.renameItems(pendingRenameIds, config)
      applyRenameResult(result, set, get)
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  cancelRename: () => {
    set({ renameSummary: null, pendingRenameIds: [] })
  },

  undoLastRename: async () => {
    try {
      const result = await window.api.undoLastRename()
      applyUndoResult(result, set, get)
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  setConfigOpen: (configOpen) => set({ configOpen }),

  setFolderModalOpen: (folderModalOpen) => set({ folderModalOpen }),

  setCatalogModalOpen: (catalogModalOpen) => set({ catalogModalOpen }),

  setStatusFilter: (statusFilter) => set({ statusFilter }),

  setSearchTerm: (searchTerm) => set({ searchTerm }),

  setScanProgress: (scanProgress) => set({ scanProgress }),

  dismissMessages: () => set({ notice: null, error: null }),
}))

export function isSelectable(item: RomItem): boolean {
  return item.status !== 'ignored' && item.status !== 'renamed'
}

export function filterItems(items: RomItem[], statusFilter: StatusFilter, searchTerm: string): RomItem[] {
  const term = searchTerm.trim().toLowerCase()
  return items.filter((item) => {
    if (statusFilter === 'not-renamed' && item.status === 'renamed') return false
    if (statusFilter !== 'all' && statusFilter !== 'not-renamed' && item.status !== statusFilter) return false
    if (!term) return true
    return (
      item.originalName.toLowerCase().includes(term) ||
      (item.suggestedName?.toLowerCase().includes(term) ?? false) ||
      (item.platform?.toLowerCase().includes(term) ?? false)
    )
  })
}

function replaceItem(items: RomItem[], updated: RomItem): RomItem[] {
  return items.map((item) => (item.id === updated.id ? updated : item))
}

function applyRenameResult(
  result: RenameResult,
  set: (partial: Partial<RomStoreState>) => void,
  get: () => RomStoreState,
): void {
  const updatedById = new Map(result.updatedItems.map((item) => [item.id, item]))
  const items = get().items.map((item) => updatedById.get(item.id) ?? item)
  const renamedIds = new Set(result.updatedItems.map((item) => item.id))
  const errorText = result.errors.length ? result.errors.map((error) => error.reason).join(' | ') : null

  set({
    items,
    selectedIds: get().selectedIds.filter((id) => !renamedIds.has(id)),
    renameSummary: null,
    pendingRenameIds: [],
    statusFilter: renamedIds.size > 0 ? 'not-renamed' : get().statusFilter,
    searchTerm: renamedIds.size > 0 ? '' : get().searchTerm,
    notice: `${result.updatedItems.length} itens renomeados.`,
    error: errorText,
  })
}

function applyUndoResult(
  result: UndoResult,
  set: (partial: Partial<RomStoreState>) => void,
  get: () => RomStoreState,
): void {
  const updatedById = new Map(result.updatedItems.map((item) => [item.id, item]))
  const items = get().items.map((item) => updatedById.get(item.id) ?? item)
  const errorText = result.errors.length ? result.errors.map((error) => error.reason).join(' | ') : null

  set({
    items,
    notice: result.updatedItems.length ? 'Ultimo lote desfeito.' : null,
    error: errorText,
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}

export function countByStatus(items: RomItem[]): Record<RomStatus, number> {
  return items.reduce(
    (counts, item) => {
      counts[item.status] += 1
      return counts
    },
    {
      pending: 0,
      identifying: 0,
      identified: 0,
      validated: 0,
      ignored: 0,
      renamed: 0,
      error: 0,
    } satisfies Record<RomStatus, number>,
  )
}
