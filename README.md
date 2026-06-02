# ROM Renamer

App desktop para identificar, validar e renomear arquivos de ROM de forma organizada.

## O que faz

1. Você escolhe uma pasta com ROMs
2. O app varre os arquivos, calcula hashes (CRC32, MD5, SHA-1) e tenta identificar cada ROM
3. Para cada arquivo aparece o nome original, o nome sugerido (editável), a plataforma, o nível de confiança da identificação e a origem do match
4. Você valida as sugestões, edita o que quiser e renomeia — um por um ou todos de uma vez
5. Tem desfazer do último lote

## Pipeline de identificação

Para cada arquivo, tenta em ordem até obter um match com confiança suficiente:

| Passo | Método | Confiança |
|-------|--------|-----------|
| 1 | Detecção de plataforma pela extensão | — |
| 2 | Hash do conteúdo (CRC32/MD5/SHA-1) | — |
| 3 | Lookup no catalogo SQLite local | **Alta** |
| 4 | Fuzzy pelo nome no catalogo local | **Baixa** |

Quando o hash nao existe no SQLite, o app tenta uma sugestao fuzzy pelo nome. Se nada confiavel aparecer, o item fica pendente para validacao/edicao manual.

## Catalogo SQLite

O app usa `resources/rom-catalog.sqlite` como DAT consolidado. Gere ou atualize esse arquivo a partir dos `.dat`/`.xml` confiaveis com:

```bash
npm run catalog:build
```

Por padrao o comando importa tudo em `temp/`. Para usar outra pasta ou arquivo:

```bash
npm run catalog:build -- --input caminho/dos/dats
```

Durante o uso, o app consulta somente o SQLite local. DATs e APIs nao sao consultados pelo fluxo de identificacao.

## Plataformas suportadas

### Nintendo

| Plataforma | Extensões |
|------------|-----------|
| NES | `.nes` `.unf` |
| SNES | `.sfc` `.smc` |
| Nintendo 64 | `.z64` `.n64` `.v64` |
| Game Boy | `.gb` |
| Game Boy Color | `.gbc` |
| Game Boy Advance | `.gba` |
| Nintendo DS | `.nds` |
| Nintendo 3DS | `.3ds` |
| GameCube | `.gcm` `.rvz` + `.iso` ³ |
| Wii | `.wbfs` `.wia` |
| Wii U | `.wud` `.wux` |

### Sega

| Plataforma | Extensões |
|------------|-----------|
| Master System | `.sms` |
| Game Gear | `.gg` |
| Mega Drive | `.md` `.gen` + `.bin` ¹ |
| Sega 32X | `.32x` |
| Mega CD | `.bin` ¹ `.cue` ² `.iso` ³ `.chd` ⁴ |
| Sega Saturn | `.bin` ¹ `.cue` ² `.iso` ³ `.chd` ⁴ |
| Dreamcast | `.gdi` `.cdi` + `.chd` ⁴ `.iso` ³ |

### Sony

| Plataforma | Extensões |
|------------|-----------|
| PlayStation 1 | `.cue` ² `.img` `.pbp` + `.bin` ¹ `.chd` ⁴ |
| PlayStation 2 | `.iso` ³ `.chd` ⁴ (padrão) |
| PlayStation 3 | `.pkg` |
| PlayStation Portable | `.cso` + `.pbp` `.iso` ³ `.chd` ⁴ |

### Atari

| Plataforma | Extensões |
|------------|-----------|
| Atari 2600 | `.a26` + `.bin` ¹ |
| Atari 7800 | `.a78` |
| Atari Jaguar | `.j64` `.jag` |

### SNK & outros

| Plataforma | Extensões |
|------------|-----------|
| Neo Geo | `.neo` |
| Neo Geo Pocket / Color | `.ngp` `.ngc` |
| PC Engine / TurboGrafx-16 | `.pce` + `.chd` ⁴ |
| WonderSwan / Color | `.ws` `.wsc` |

---

### Desambiguação de extensões compartilhadas

Extensões genéricas são resolvidas por palavras-chave no caminho e nome do arquivo:

**¹ `.bin`** — padrão **Mega Drive**
- → Mega CD: `mega cd`, `megacd`, `sega cd`
- → Sega Saturn: `saturn`, `sega saturn`
- → PlayStation 1: `ps1`, `psx`, `playstation`
- → Atari 2600: `atari`, `2600`, `a26`

**² `.cue`** — padrão **PlayStation 1**
- → Mega CD: `mega cd`, `megacd`, `sega cd`
- → Sega Saturn: `saturn`, `sega saturn`

**³ `.iso`** — padrão **PlayStation 2**
- → GameCube: `gamecube`, `game cube`, `ngc`
- → PSP: `psp`, `playstation portable`
- → PlayStation 3: `ps3`, `playstation3`, `playstation 3`
- → Sega Saturn: `saturn`, `sega saturn`
- → Mega CD: `mega cd`, `megacd`, `sega cd`
- → Dreamcast: `dreamcast`
- → Wii: `wii`

**⁴ `.chd`** — padrão **PlayStation 1**
- → PlayStation 2: `ps2`, `playstation 2`
- → Sega Saturn: `saturn`, `sega saturn`
- → Dreamcast: `dreamcast`
- → Mega CD: `mega cd`, `megacd`, `sega cd`
- → PC Engine: `pce`, `pc engine`, `turbografx`
- → PSP: `psp`, `playstation portable`

### Override manual de plataforma

Para pastas com uma única plataforma, use o seletor ao abrir a pasta — ele fixa a plataforma para todos os arquivos e ignora a detecção automática por extensão. Isso melhora muito a precisão em coleções organizadas.

### Nota N64 — normalização de byte order

| Extensão | Formato | Ação |
|----------|---------|------|
| `.z64` | Big-endian nativo | Nenhuma |
| `.v64` | Byte-swapped | Normalizado antes do hash |
| `.n64` | Little-endian | Normalizado antes do hash |

## Stack

- **Electron** — janela desktop + acesso ao filesystem
- **React 19** — interface
- **Zustand** — gerenciamento de estado
- **TypeScript** — toda a codebase
- **electron-vite** — build tooling

Toda operação de I/O roda no processo main do Electron e é exposta ao renderer via IPC. O React nunca toca o filesystem diretamente.

## Pré-requisitos

- Node.js 22.5+

## Instalação e uso em desenvolvimento

```bash
npm install
npm run dev
```

## Build de produção

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Os artefatos ficam em `dist/`.

## Configuração

Abra o painel de **Configurações** (ícone de engrenagem) para:

- **Busca recursiva** — varrer subpastas
- **Template de nome** — ex.: `{Nome}.{ext}`, `{Nome} ({Região}).{ext}`
- **Conflitos** — sufixar ou pular quando o nome já existe
- **Catalogo SQLite** — consulta offline em `resources/rom-catalog.sqlite`

## Licença

MIT
