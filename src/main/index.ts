import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { normalizeConfig, type Config, type RomItem, type RomStatus, type ScanProgress } from '@shared/types'
import { readConfig, saveConfig } from './config'
import { scanFolder } from './rom/scanner'
import { createRenameSummary, renameItems, undoRename, type RenameLog } from './rom/rename'

const currentItems = new Map<string, RomItem>()
let lastRenameLog: RenameLog | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL()
    if (currentUrl && url !== currentUrl) event.preventDefault()
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && input.type === 'keyDown') {
      const reload = input.code === 'KeyR' && (input.control || input.meta)
      const devtools = input.code === 'KeyI' && (input.control || input.meta) && input.shift
      if (reload || devtools) event.preventDefault()
    }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerIpcHandlers(): void {
  ipcMain.handle('dialog:chooseFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('config:get', async () => readConfig())

  ipcMain.handle('config:save', async (_event, rawConfig: unknown) => {
    return saveConfig(normalizeConfig(rawConfig))
  })

  ipcMain.handle('rom:scanFolder', async (event, rawRequest: unknown) => {
    const request = parseScanRequest(rawRequest)
    const emitProgress = (progress: ScanProgress): void => {
      event.sender.send('rom:scanProgress', progress)
    }
    const items = await scanFolder(request.folderPath, request.config, emitProgress)
    currentItems.clear()
    for (const item of items) currentItems.set(item.id, item)
    lastRenameLog = null
    return items
  })

  ipcMain.handle('rom:updateSuggestion', async (_event, rawRequest: unknown) => {
    const { id, suggestedName } = parseSuggestionRequest(rawRequest)
    const item = requireItem(id)
    const updated: RomItem = {
      ...item,
      suggestedName,
      status: item.status === 'ignored' || item.status === 'renamed' ? item.status : 'identified',
      error: null,
    }
    currentItems.set(id, updated)
    return updated
  })

  ipcMain.handle('rom:markItem', async (_event, rawRequest: unknown) => {
    const { id, status } = parseMarkRequest(rawRequest)
    const item = requireItem(id)
    const updated: RomItem = { ...item, status, error: null }
    currentItems.set(id, updated)
    return updated
  })

  ipcMain.handle('rom:previewRename', async (_event, rawRequest: unknown) => {
    const { ids, config } = parseRenameRequest(rawRequest)
    return createRenameSummary(currentItems, ids, config)
  })

  ipcMain.handle('rom:renameItems', async (_event, rawRequest: unknown) => {
    const { ids, config } = parseRenameRequest(rawRequest)
    const { result, log } = await renameItems(currentItems, ids, config)
    lastRenameLog = log
    return result
  })

  ipcMain.handle('rom:undoLastRename', async () => {
    const result = await undoRename(currentItems, lastRenameLog)
    if (!result.errors.length) lastRenameLog = null
    return result
  })
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.romrenamer.app')
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function parseScanRequest(value: unknown): { folderPath: string; config: Config } {
  const record = requireRecord(value, 'Requisicao de scan invalida.')
  const folderPath = requireString(record.folderPath, 'folderPath invalido.')
  return {
    folderPath,
    config: normalizeConfig(record.config),
  }
}

function parseSuggestionRequest(value: unknown): { id: string; suggestedName: string } {
  const record = requireRecord(value, 'Requisicao de sugestao invalida.')
  return {
    id: requireString(record.id, 'id invalido.'),
    suggestedName: requireString(record.suggestedName, 'suggestedName invalido.').trim(),
  }
}

function parseMarkRequest(value: unknown): { id: string; status: Extract<RomStatus, 'validated' | 'ignored'> } {
  const record = requireRecord(value, 'Requisicao de status invalida.')
  const status = record.status
  if (status !== 'validated' && status !== 'ignored') {
    throw new Error('status invalido.')
  }
  return {
    id: requireString(record.id, 'id invalido.'),
    status,
  }
}

function parseRenameRequest(value: unknown): { ids: string[]; config: Config } {
  const record = requireRecord(value, 'Requisicao de rename invalida.')
  if (!Array.isArray(record.ids)) {
    throw new Error('ids invalido.')
  }

  const ids = record.ids.map((id) => requireString(id, 'id invalido.'))
  return {
    ids,
    config: normalizeConfig(record.config),
  }
}

function requireItem(id: string): RomItem {
  const item = currentItems.get(id)
  if (!item) throw new Error('Item nao encontrado.')
  return item
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new Error(message)
  }
  return value
}
