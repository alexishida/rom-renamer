# ROM Identification Specification

## Purpose
Defines how selected folders become ROM items, how platform and hashes are determined, and how local catalog matches produce confidence levels without automating unsafe renames.

## Requirements

### Requirement: Folder scan input
The scanner MUST resolve the selected folder, require it to be a directory, and walk files according to the recursive config.

#### Scenario: Selected path is not a directory
- **WHEN** scan starts with a path that does not resolve to a directory
- **THEN** scan fails with `Pasta invalida.`
- **AND** no rename or catalog write occurs.

#### Scenario: Recursive scan is disabled
- **WHEN** config has `recursive` set to false
- **THEN** files in child directories are not included.

### Requirement: Supported ROM filtering
The scanner MUST include only supported ROM extensions and suppress `.bin` files referenced by CUE files as sidecars.

#### Scenario: Folder contains unsupported files
- **WHEN** scan walks files with extensions outside the supported set
- **THEN** those files are ignored.

#### Scenario: CUE references BIN tracks
- **WHEN** a `.cue` file references `.bin` files in the same scan
- **THEN** the `.cue` is listed as the primary item
- **AND** referenced `.bin` tracks are not listed as independent ROM items.

### Requirement: Platform detection
The scanner MUST assign platform from config override when present, otherwise detect platform from extension and path/name hints.

#### Scenario: Platform override is set
- **WHEN** config platform override is not `auto`
- **THEN** every scanned item uses that platform value.

#### Scenario: Ambiguous extension is scanned
- **WHEN** `.bin`, `.cue`, `.img`, `.pbp`, `.iso`, or `.chd` is scanned with no override
- **THEN** path and filename hints resolve the platform when known
- **AND** documented defaults are used when no hint matches.

### Requirement: Hash calculation
The scanner MUST calculate CRC32, MD5, and SHA-1 for each included ROM file before catalog lookup.

#### Scenario: Standard ROM is hashed
- **WHEN** a non-N64-byte-swapped file is processed
- **THEN** hashes are calculated from streamed file bytes
- **AND** hash strings are uppercase.

#### Scenario: N64 byte order requires normalization
- **WHEN** a `.v64` or `.n64` file is processed
- **THEN** bytes are normalized to big-endian order before CRC32, MD5, and SHA-1 are updated.

### Requirement: Exact catalog matching
Identification MUST query the local SQLite catalog by SHA-1, then MD5, then CRC32, and treat the first exact hash match as high confidence.

#### Scenario: SHA-1 match exists
- **WHEN** the catalog contains a row with the file SHA-1
- **THEN** the item is marked `identified`
- **AND** confidence is `high`
- **AND** source is `no-intro` or `redump`
- **AND** suggested name uses the catalog game name with metadata preserved from the original filename.

#### Scenario: Exact match already uses final filename
- **WHEN** a high-confidence match renders the same final filename as the current file
- **THEN** the item is marked `renamed`
- **AND** no extra user rename step is needed for that item.

#### Scenario: Original filename region overrides catalog region
- **WHEN** the original filename contains a recognized region tag such as `(U)`
- **AND** the catalog match name contains a different region tag
- **THEN** the suggested name keeps the catalog game title
- **AND** the region tag shown in the suggestion uses the original filename region, such as `EUA`.

#### Scenario: Multiple sources match
- **WHEN** equivalent hash rows exist across sources
- **THEN** `no-intro` is preferred before `redump`.

### Requirement: Fuzzy catalog fallback
Identification MUST attempt fuzzy local catalog matching by normalized filename only after exact hash matching fails.

#### Scenario: Fuzzy automatic match reaches threshold
- **WHEN** no hash match exists and fuzzy score is at least 86
- **THEN** the item is marked `identified`
- **AND** confidence is `low`
- **AND** source and suggested name come from the best catalog row.

#### Scenario: Fuzzy match is below threshold
- **WHEN** no hash match exists and no fuzzy row reaches the automatic threshold
- **THEN** the item remains `pending`
- **AND** confidence remains `none`.

### Requirement: Header region fallback
The scanner MUST read ROM header region only for supported platforms (Nintendo 64, Game Boy, Game Boy Color, Game Boy Advance, Nintendo DS) and use it as lower-authority metadata than the local catalog.

#### Scenario: Catalog suggestion has no region
- **WHEN** a hash or fuzzy catalog match produces a suggested name without a region tag
- **AND** supported ROM header parsing finds a region
- **THEN** the suggested name includes the detected region tag
- **AND** the catalog source and confidence remain authoritative.

#### Scenario: Catalog suggestion already has region
- **WHEN** a hash or fuzzy catalog match produces a suggested name with a region tag
- **AND** supported ROM header parsing finds a different region
- **THEN** the catalog or filename-preserved region remains unchanged.

#### Scenario: Only header region is available
- **WHEN** exact hash and fuzzy catalog matching fail
- **AND** supported ROM header parsing finds a region
- **THEN** the item is marked `identified`
- **AND** confidence is `low`
- **AND** source is `header`
- **AND** suggested name uses the cleaned filename with the detected region tag.

#### Scenario: Header region is unavailable
- **WHEN** exact hash and fuzzy catalog matching fail
- **AND** header parsing is unsupported or finds no reliable region
- **THEN** the item remains `pending`
- **AND** confidence remains `none`.

### Requirement: Identification failure isolation
The scanner MUST report item-level identification failures without aborting the whole scan.

#### Scenario: Hashing one file fails
- **WHEN** one ROM file throws during hash or lookup
- **THEN** that item is returned with status `error`
- **AND** the error message is stored on the item
- **AND** remaining files continue processing.

### Requirement: Scan progress
The scanner MUST emit progress updates for folder reading, catalog opening, ROM processing, and completion.

#### Scenario: Renderer subscribes to progress
- **WHEN** scan is running
- **THEN** the main process sends `rom:scanProgress` events
- **AND** progress values are clamped between zero and total.
