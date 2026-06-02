# App Shell Specification

## Purpose
Defines the Electron application boundary, IPC contract, and persisted configuration rules that keep filesystem-sensitive work out of the renderer and keep user settings predictable.

## Requirements

### Requirement: Secure Electron boundary
The app MUST keep filesystem, scan, catalog, rename, undo, and config operations in the Electron main process and expose them to React only through the preload API.

#### Scenario: Renderer requests native work
- **WHEN** the renderer needs a folder dialog, scan, catalog operation, rename, undo, or config operation
- **THEN** it calls `window.api`
- **AND** the preload forwards the request through `ipcRenderer.invoke`
- **AND** the main process performs the native work.

#### Scenario: Window security flags are set
- **WHEN** the application creates the main window
- **THEN** `contextIsolation` is enabled
- **AND** `sandbox` is enabled
- **AND** `nodeIntegration` is disabled
- **AND** `webSecurity` is enabled.

### Requirement: IPC request validation
The main process MUST treat renderer payloads as unknown input and validate them before executing sensitive operations.

#### Scenario: Scan request is received
- **WHEN** `rom:scanFolder` receives a payload
- **THEN** the main process validates `folderPath` as a bounded string
- **AND** normalizes the config before scan execution.

#### Scenario: Catalog search request is received
- **WHEN** `catalog:search` receives a payload
- **THEN** the main process validates `query` as a trimmed string with max length 160
- **AND** validates `limit` as an integer between 1 and 30 when provided.

#### Scenario: Rename request is received
- **WHEN** `rom:previewRename` or `rom:renameItems` receives a payload
- **THEN** the main process validates `ids` as an array of strings
- **AND** normalizes the config before planning or applying the rename.

### Requirement: Config persistence
The app MUST persist configuration in the Electron `userData` directory and normalize loaded or saved values before use.

#### Scenario: No saved config exists
- **WHEN** the renderer requests config
- **THEN** the main process returns defaults for recursive scan, name template, conflict strategy, and platform override.

#### Scenario: Invalid config is loaded
- **WHEN** persisted config contains invalid fields
- **THEN** invalid values are replaced by defaults
- **AND** valid fields are preserved.

#### Scenario: Config is saved
- **WHEN** the renderer saves config
- **THEN** the main process writes normalized JSON to `rom-renamer-config.json`
- **AND** returns the normalized config to the renderer.

### Requirement: Navigation control
The app MUST prevent packaged-window reload, devtools shortcuts, and unexpected in-window navigation from weakening the desktop shell.

#### Scenario: External URL is opened
- **WHEN** web contents request a new window
- **THEN** the app opens the URL externally
- **AND** denies the in-window open request.

#### Scenario: Packaged shortcut is pressed
- **WHEN** packaged app receives reload or devtools shortcuts
- **THEN** the app prevents the input event.
