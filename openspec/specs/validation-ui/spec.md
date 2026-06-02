# Validation UI Specification

## Purpose
Defines the renderer workflow for choosing a folder, reviewing identified ROMs, validating suggestions, managing the local catalog, confirming renames, and seeing feedback.

## Requirements

### Requirement: Folder selection workflow
The UI MUST let the user choose a folder, choose or confirm platform override, and start scan from the first screen.

#### Scenario: User opens folder modal
- **WHEN** the user clicks `Escolher pasta`
- **THEN** the folder modal shows current folder when present
- **AND** shows platform options grouped by family
- **AND** allows `auto` detection.

#### Scenario: User confirms folder
- **WHEN** a folder path is selected and confirmation is clicked
- **THEN** config is saved with chosen platform override when possible
- **AND** scan starts for the selected folder.

### Requirement: Scan progress and empty states
The UI MUST show useful progress, empty, and no-result states while preserving the main tool as the first screen.

#### Scenario: Scan is running
- **WHEN** scan progress events arrive
- **THEN** the table area shows progress title, detail, percent, and bar
- **AND** any previous result list is cleared until the new scan finishes.

#### Scenario: No ROMs are found
- **WHEN** scan completes with zero items
- **THEN** the UI shows an empty state explaining no recognized ROMs were found
- **AND** offers choosing another folder.

#### Scenario: Filters hide every item
- **WHEN** current status filter or search term matches no items
- **THEN** the UI shows no-result state
- **AND** offers clearing filters.

### Requirement: Review table
The UI MUST show each ROM item with editable suggestion, platform, confidence, source, status, and row actions.

#### Scenario: Item has suggestion
- **WHEN** an item is listed
- **THEN** the suggestion field shows current suggested name
- **AND** blur syncs the suggestion to the main process.

#### Scenario: Item is ignored or renamed
- **WHEN** item status is `ignored` or `renamed`
- **THEN** suggestion editing and selection are disabled for that row.

### Requirement: Selection and filtering
The UI MUST support status filtering, text search, visible-row selection, and bulk actions for selectable items.

#### Scenario: User filters by status
- **WHEN** a status chip is clicked
- **THEN** only items with that status are visible
- **AND** the `Todos` chip returns to all items.

#### Scenario: User filters by not-renamed
- **WHEN** the `Nao renomeados` chip is clicked
- **THEN** every item that is not `renamed` is visible
- **AND** the chip count reflects the live total of non-renamed items.

#### Scenario: User selects all visible rows
- **WHEN** the table header checkbox is toggled
- **THEN** visible selectable rows are selected or deselected
- **AND** ignored and renamed rows remain unselectable.

### Requirement: Validation and ignore actions
The UI MUST allow explicit validation only when a suggestion exists and allow ignoring rows individually or in bulk.

#### Scenario: User validates one item
- **WHEN** the row has a non-empty suggested name and the user clicks validate
- **THEN** the suggestion is synced
- **AND** the item status becomes `validated`.

#### Scenario: User ignores selected items
- **WHEN** selected items are ignored
- **THEN** each item status becomes `ignored`
- **AND** ignored item ids are removed from selection.

### Requirement: Catalog search UI
The UI MUST allow manual catalog search for an item and applying a catalog result as a trusted suggestion.

#### Scenario: User opens row catalog search
- **WHEN** the search icon is clicked on an editable item
- **THEN** the modal opens with query seeded from suggested name or original filename
- **AND** displays the item's hashes.

#### Scenario: User applies catalog result
- **WHEN** a result is applied
- **THEN** the item suggestion is replaced by the catalog name with preserved metadata
- **AND** confidence becomes `high`
- **AND** source is set from the catalog result.

### Requirement: Catalog management UI
The UI MUST provide modal tabs for importing DAT/XML files, listing loaded catalogs, searching catalog entries, and deleting catalog data.

#### Scenario: User imports DAT files
- **WHEN** selected DAT/XML files are imported
- **THEN** import results show imported, skipped, and error counts
- **AND** loaded file list is refreshed from the result.

#### Scenario: User deletes catalog file or clears catalog
- **WHEN** deletion is confirmed
- **THEN** the UI calls the corresponding preload API
- **AND** displays removed file and ROM counts.

### Requirement: Rename confirmation and feedback
The UI MUST gate disk renames behind a confirmation dialog and show notices or errors after operations.

#### Scenario: Rename action is requested
- **WHEN** row, selected, or all-validated rename is requested
- **THEN** the UI requests preview
- **AND** shows counts, conflicts, skipped items, and planned changes before apply.

#### Scenario: Rename result returns
- **WHEN** rename completes with one or more successful items
- **THEN** updated items replace table items
- **AND** renamed ids are removed from selection
- **AND** a result dialog opens listing every current item that is not `renamed` with its status label
- **AND** any per-item errors are listed separately in the dialog
- **AND** the table filter switches to `not-renamed`
- **AND** the current text search is cleared so the remaining records stay visible.

#### Scenario: User closes the rename result dialog
- **WHEN** the user clicks the close button or backdrop of the result dialog
- **THEN** the dialog closes and the table shows the `not-renamed` filtered view.

#### Scenario: User clicks "Ver nao renomeados" in result dialog
- **WHEN** the user clicks the primary action button in the result dialog
- **THEN** the dialog closes
- **AND** the table filter is set to `not-renamed` with search cleared.

#### Scenario: Undo result returns
- **WHEN** undo completes
- **THEN** updated items replace table items
- **AND** success notice or error reasons are shown.
