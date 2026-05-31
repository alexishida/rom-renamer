# ROM Renamer — Especificação Técnica

App desktop para identificar, validar e renomear arquivos de ROM de forma organizada.

## Stack

- **React** — interface
- **Electron** — empacotamento desktop + acesso ao sistema de arquivos
- **Zustand** — gerenciamento de estado
- **Node.js** (processo main do Electron) — hashing, leitura de arquivos, chamadas de API, rename

> Regra de arquitetura: toda operação de I/O (ler pasta, calcular hash, renomear, baixar capa) roda no **processo main** do Electron e é exposta ao renderer via **IPC** (`ipcMain`/`ipcRenderer` + `contextBridge`). O React nunca toca o filesystem diretamente.

## Fluxo do usuário

1. Usuário clica em **"Escolher pasta"** → abre `dialog.showOpenDialog` (seleção de diretório).
2. App varre a pasta (recursivo opcional) e lista os arquivos de ROM encontrados.
3. Para cada arquivo, o app tenta identificar o **nome correto** automaticamente (ver pipeline de identificação).
4. Resultados aparecem numa **tabela de validação** com: nome atual, nome sugerido, plataforma detectada, nível de confiança e status.
5. Usuário pode:
   - **Validar** uma sugestão (aceitar como está)
   - **Editar** manualmente o nome sugerido
   - **Ignorar** um item
6. Após validar, usuário pode renomear **um a um** ou **todos os validados de uma vez**.
7. Antes de aplicar, exibir um resumo de confirmação (quantidade, conflitos de nome).

## Pipeline de identificação

Para cada arquivo, executar em ordem até obter um match com confiança suficiente:

### Passo 1 — Detecção de plataforma
Detectar pela extensão (e pasta, como dica secundária):

| Plataforma   | Extensões comuns                     |
|--------------|--------------------------------------|
| SNES         | `.sfc`, `.smc`                       |
| Mega Drive   | `.md`, `.gen`, `.bin`                |
| Nintendo 64  | `.z64`, `.n64`, `.v64`               |
| PlayStation 1| `.bin`+`.cue`, `.img`, `.chd`, `.pbp`|
| PlayStation 2| `.iso`, `.chd`                       |
| GameCube     | `.iso`, `.gcm`, `.rvz`               |

> N64: normalizar o byte-order antes de hashear (`.z64` big-endian, `.v64` byte-swapped, `.n64` little-endian).

### Passo 2 — Hash do conteúdo (técnica principal)
Calcular **CRC32, MD5 e SHA-1** do arquivo. Para mídia óptica, considerar serial/ID interno do disco em vez de hash da imagem inteira (formatos variam).

### Passo 3 — Lookup em DAT files (offline, alta confiança)
Comparar o hash com bancos de dados de referência:
- **No-Intro** — cartuchos (SNES, Mega Drive, N64)
- **Redump** — mídia óptica (PS1, PS2, GameCube)

Match exato de hash → confiança **ALTA**, nome canônico.

### Passo 4 — API de metadados (online)
Se não houver DAT local ou não bater:
- **ScreenScraper.fr** — busca por hash (CRC/MD5/SHA-1) **e** por nome; retorna nome oficial + capa.
- **IGDB** / **TheGamesDB** — fallback por nome.

Implementação atual: processo main tenta ScreenScraper primeiro quando há credenciais completas do usuário e do app (`SCREEN_SCRAPER_DEV_ID` e `SCREEN_SCRAPER_DEV_PASSWORD` no ambiente). Se não houver resposta, tenta IGDB por nome.

### Passo 5 — Fallback por nome (fuzzy match)
Quando nada bate por hash:
1. Limpar o nome do arquivo com regex (remover `(USA)`, `[!]`, `[h1]`, `(En,Fr,De)`, tags de scene, underscores, números soltos).
2. Aplicar fuzzy match (RapidFuzz/Levenshtein) contra a lista de nomes da plataforma.
3. Confiança proporcional ao score do match.

## Níveis de confiança

| Nível   | Origem                          | Cor sugerida |
|---------|---------------------------------|--------------|
| ALTA    | Match exato de hash (DAT/API)   | verde        |
| MÉDIA   | Match por API via nome          | amarelo      |
| BAIXA   | Fuzzy match / heurística        | laranja      |
| NENHUMA | Não identificado                | vermelho     |

Itens com confiança **BAIXA** ou **NENHUMA** nunca devem ser renomeados em lote sem validação explícita.

## Estado (Zustand)

```
store = {
  folderPath: string | null,
  scanning: boolean,
  items: RomItem[],
  selectedIds: string[],
  config: Config,

  // actions
  setFolder(path),
  scanFolder(),
  identifyAll(),
  updateSuggestedName(id, name),
  validateItem(id),
  ignoreItem(id),
  renameOne(id),
  renameAllValidated(),
}
```

### Modelo `RomItem`

```
RomItem = {
  id: string,
  originalPath: string,
  originalName: string,
  platform: string | null,
  hashes: { crc32, md5, sha1 },
  suggestedName: string | null,
  coverUrl: string | null,
  confidence: 'high' | 'medium' | 'low' | 'none',
  source: 'no-intro' | 'redump' | 'screenscraper' | 'igdb' | 'fuzzy' | null,
  status: 'pending' | 'identifying' | 'identified' | 'validated' | 'ignored' | 'renamed' | 'error',
  error: string | null,
}
```

## Interface (componentes)

- **Toolbar** — botão escolher pasta, botão identificar tudo, botão renomear validados, contador de status.
- **RomTable** — uma linha por arquivo:
  - nome atual
  - nome sugerido (editável inline)
  - plataforma
  - badge de confiança (cor)
  - origem do match
  - ações por linha: validar / editar / ignorar / renomear
  - checkbox para seleção em lote
- **ConfirmDialog** — resumo antes de aplicar rename (total, conflitos).
- **ConfigPanel** — template de nome, recursividade, credenciais de API, caminho dos DATs.

## Renomeação

- Template configurável, ex.: `{Nome} ({Região}).{ext}`
- Validar antes de aplicar:
  - caracteres inválidos no nome (`/ \ : * ? " < > |`)
  - colisão com arquivo existente → sufixar ou avisar
  - manter pares relacionados juntos (ex.: `.cue` + `.bin`, múltiplas tracks)
- Renomear via `fs.rename` no main process.
- Manter um **log de operações** para permitir **desfazer** (undo) o último lote.

## Segurança e robustez

- Nunca renomear sem validação para confiança baixa/nenhuma.
- Operações de filesystem isoladas no main process (`contextIsolation: true`, `nodeIntegration: false`).
- Rate limit / cache nas chamadas de API.
- Tratar erros por item sem travar o lote inteiro.

## Roadmap sugerido

1. **MVP**: escolher pasta → listar → detecção de plataforma + hash → tabela → rename manual 1 a 1.
2. Integrar DAT local (No-Intro) por hash.
3. Integrar ScreenScraper (nome + capa).
4. Fuzzy match de fallback.
5. Undo de lote, download de capas, templates avançados.
