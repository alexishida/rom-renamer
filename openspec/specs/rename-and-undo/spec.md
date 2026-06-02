# Rename And Undo Specification

## Purpose
Defines safe rename planning, conflict handling, disk write execution, CUE sidecar updates, and undo guarantees for the last applied rename batch.

## Requirements

### Requirement: Rename eligibility
Rename planning MUST include only validated items with a non-empty suggested name.

#### Scenario: Item is not validated
- **WHEN** a pending, identified, ignored, renamed, identifying, or error item is requested for rename
- **THEN** the item is skipped
- **AND** the summary explains the skip reason.

#### Scenario: Low confidence item was validated
- **WHEN** a low-confidence item has status `validated`
- **THEN** it is eligible for rename
- **AND** validation serves as the explicit user approval.

### Requirement: Rename preview
The app MUST build a rename summary before applying any disk write.

#### Scenario: Preview is requested
- **WHEN** row, selected, or all-validated rename is requested
- **THEN** the app returns item count, operation count, conflicts, skipped items, and target names
- **AND** no filesystem rename occurs during preview.

#### Scenario: Confirmation dialog lists planned renames
- **WHEN** the rename confirmation dialog is shown
- **THEN** every planned rename is listed with original and target filename
- **AND** the rename list is scrollable when it exceeds the visible dialog area.

#### Scenario: No item can be renamed
- **WHEN** preview contains zero planned items
- **THEN** the confirmation action is disabled.

### Requirement: Target filename rendering
Target filenames MUST be rendered from normalized config and sanitized before disk operations.

#### Scenario: Template has known tokens
- **WHEN** the name template contains `{Nome}`, `{Name}`, `{Plataforma}`, `{Platform}`, `{Origem}`, `{Source}`, `{Regiao}`, `{Region}`, or `{ext}`
- **THEN** known tokens are replaced with item values or blanks
- **AND** unknown tokens are removed.

#### Scenario: Template omits extension token
- **WHEN** the template does not contain `{ext}`
- **THEN** the original extension is appended to the rendered name.

#### Scenario: Rendered filename is unsafe
- **WHEN** rendered filename contains invalid filesystem characters or empty basename
- **THEN** invalid characters are replaced with underscores
- **AND** empty basename falls back to `ROM`.

### Requirement: Conflict handling
Rename planning MUST detect existing target files and duplicate targets within the current plan using normalized paths.

#### Scenario: Suffix strategy resolves conflict
- **WHEN** conflict strategy is `suffix` and target name is unavailable
- **THEN** the app searches for ` (2)`, ` (3)`, and later suffixes up to the limit
- **AND** records the conflict with resolved name when found.

#### Scenario: Skip strategy sees conflict
- **WHEN** conflict strategy is `skip` and target name is unavailable
- **THEN** the item is skipped
- **AND** the conflict records reason `exists` or `duplicate`.

### Requirement: CUE sidecar rename
CUE primary item rename MUST plan referenced sidecar file renames and update CUE content when possible.

#### Scenario: CUE has one referenced track
- **WHEN** a `.cue` item references one existing sidecar file
- **THEN** the sidecar target uses the primary target basename and original sidecar extension
- **AND** the CUE file reference is updated to the new sidecar basename.

#### Scenario: CUE has multiple referenced tracks
- **WHEN** a `.cue` item references multiple unique existing sidecar files
- **THEN** sidecar targets include `Track 01`, `Track 02`, and later track suffixes
- **AND** corresponding CUE references are updated.

#### Scenario: CUE parse or sidecar access fails
- **WHEN** CUE parsing or sidecar planning fails
- **THEN** the primary rename remains plannable
- **AND** failed sidecar planning does not abort the batch.

### Requirement: Rename execution
Rename execution MUST run in the main process, apply planned operations per item, and report per-item errors without hiding successful renames.

#### Scenario: Item rename succeeds
- **WHEN** all planned operations for an item succeed
- **THEN** the item path and name are updated
- **AND** status becomes `renamed`
- **AND** the operation is recorded in the last rename log.

#### Scenario: Rename batch finishes in UI
- **WHEN** a rename batch completes with one or more successful items
- **THEN** the renderer shows a result dialog listing every current item that is not `renamed`
- **AND** the table filter switches to `not-renamed`
- **AND** the current text search is cleared so the remaining records stay visible.

#### Scenario: Item rename fails
- **WHEN** an operation throws for an item
- **THEN** that item contributes an error entry
- **AND** later planned items can still run.

### Requirement: Undo last batch
Undo MUST reverse the last logged rename batch and restore CUE file content from snapshots.

#### Scenario: Undo is requested with no log
- **WHEN** no successful batch log exists
- **THEN** undo returns an error explaining that no batch is available.

#### Scenario: Undo succeeds
- **WHEN** undo runs after a logged batch
- **THEN** operations are renamed back in reverse order
- **AND** CUE content is restored from snapshots
- **AND** item snapshots replace current item state.

#### Scenario: Undo has errors
- **WHEN** one reverse operation or CUE restore fails
- **THEN** undo returns errors for those items
- **AND** restores every snapshot in memory.
