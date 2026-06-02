# Catalog Management Specification

## Purpose
Defines the local SQLite catalog used for offline DAT matching, including database placement, schema, DAT/XML import, search, deletion, and bundled catalog generation.

## Requirements

### Requirement: Local catalog database
The app MUST use a SQLite catalog database in Electron `userData` and initialize schema version 2 before catalog reads or writes.

#### Scenario: User catalog does not exist
- **WHEN** catalog access starts and no userData database exists
- **THEN** the app creates the parent directory
- **AND** copies the bundled `resources/rom-catalog.sqlite` when available
- **AND** initializes the schema.

#### Scenario: Schema is initialized
- **WHEN** the catalog database is opened
- **THEN** tables `catalog_meta`, `catalog_files`, and `roms` exist
- **AND** hash indexes exist for CRC32, MD5, and SHA-1
- **AND** foreign key cascade removes ROM rows when a catalog file row is deleted.

### Requirement: DAT/XML import
The app MUST import `.dat` and `.xml` files by parsing `game` or `machine` blocks and `rom` entries into catalog rows.

#### Scenario: Valid DAT is imported
- **WHEN** a DAT/XML file contains ROM entries
- **THEN** the app records file metadata, source, catalog name/version, file SHA-256, size, mtime, and imported time
- **AND** each ROM row stores game name, ROM name, size, CRC32, MD5, SHA-1, and SHA-256 when present.

#### Scenario: File has no ROM entries
- **WHEN** a valid DAT/XML contains no parsed ROM entries
- **THEN** the import result marks the file as `skipped`
- **AND** no catalog file row is created.

#### Scenario: Invalid file is selected
- **WHEN** selected path is not `.dat` or `.xml` or is not a file
- **THEN** the import result marks the path as `error`
- **AND** includes a user-facing reason.

### Requirement: Duplicate import protection
The app MUST prevent duplicate catalog imports by normalized path and file SHA-256.

#### Scenario: Duplicate path is imported
- **WHEN** an already loaded path is selected again
- **THEN** import is marked `skipped`
- **AND** the result references the existing catalog file.

#### Scenario: Same content has different path
- **WHEN** a different path has the same file SHA-256 as an imported catalog
- **THEN** import is marked `skipped`
- **AND** duplicate ROM rows are not inserted.

### Requirement: Catalog file listing and deletion
The app MUST list loaded catalog files and support deleting one file or clearing the whole catalog with returned counts.

#### Scenario: Loaded files are listed
- **WHEN** the renderer opens the catalog modal or refreshes files
- **THEN** the app returns catalog file summaries ordered by newest import first
- **AND** each summary includes ROM count and file metadata.

#### Scenario: One catalog file is deleted
- **WHEN** a catalog file id is deleted
- **THEN** the app deletes that file row
- **AND** cascades its ROM rows
- **AND** returns deleted file and ROM counts.

#### Scenario: Catalog is cleared
- **WHEN** clear catalog is requested
- **THEN** the app deletes all ROM and catalog file rows inside a transaction
- **AND** returns prior counts and an empty file list.

### Requirement: Catalog search
The app MUST provide bounded local catalog search with LIKE ranking first and fuzzy fallback when LIKE returns no usable results.

#### Scenario: Query is too short
- **WHEN** normalized query length is below 2 characters
- **THEN** catalog search returns an empty list.

#### Scenario: LIKE search finds rows
- **WHEN** game name or ROM name contains the query
- **THEN** exact game-name matches rank first
- **AND** prefix matches rank before generic contains matches
- **AND** `no-intro` ranks before `redump`
- **AND** duplicate results are removed.

#### Scenario: LIKE search finds nothing
- **WHEN** LIKE search returns no results
- **THEN** fuzzy candidates are ranked by normalized token and Levenshtein score
- **AND** only rows scoring at least 55 are returned.

### Requirement: Bundled catalog build script
The catalog build script MUST generate a schema version 2 SQLite database from DAT/XML input paths for packaged offline use.

#### Scenario: Build runs with default input
- **WHEN** `npm run catalog:build` runs without explicit input
- **THEN** the script imports DAT/XML files found under `temp`
- **AND** writes `resources/rom-catalog.sqlite`.

#### Scenario: Build output already exists
- **WHEN** the output database or SQLite sidecar files exist
- **THEN** the script removes them before creating the new catalog.

#### Scenario: No DAT files are found
- **WHEN** input paths contain no `.dat` or `.xml` files
- **THEN** the script fails with a message listing the searched inputs.
