# Design System

Guia visual oficial do ROM Renamer. Use como referencia ao criar ou alterar CSS, componentes e telas.
Tokens vivem em `src/renderer/src/styles.css`, dentro de `:root`. Sempre consumir via `var(--token)`.

## Direcao visual

- Interface desktop clara, limpa e densa na medida certa.
- Base neutra fria com acento emerald para acoes principais e estados positivos.
- Controles com cara de ferramenta utilitaria: legiveis, compactos, previsiveis e com foco visivel.
- Feedback visual deve ajudar usuario a entender status de identificacao e impacto de rename.
- Primeira tela e ferramenta de trabalho, nao landing page: tabela, estados vazios e CTA direto para escolher pasta.
- Fluxos sensiveis precisam parecer deliberados: preview, confirmacao, conflitos e undo devem ficar visualmente claros.
- Baixa confianca deve parecer atencao/revisao, nao erro fatal nem sucesso.

## Tokens

### Superficies

- `--bg` `#eceff4`: fundo geral da janela.
- `--surface` `#ffffff`: cartoes, barras, dialogs e tabela.
- `--surface-soft` `#f6f8fb`: hover suave, cabecalhos e blocos secundarios.
- `--surface-inset` `#eef1f6`: inputs embutidos, chips neutros e fundos internos.

### Bordas

- `--border` `#e3e8ef`: divisores padrao.
- `--border-strong` `#d2dae4`: contorno de controles.

### Texto

- `--text` `#1b2330`: texto principal.
- `--text-muted` `#5c6776`: texto secundario.
- `--text-subtle` `#8b96a5`: placeholder, hint e legenda.

### Marca e acento

- `--accent` `#16915b`: acao primaria.
- `--accent-strong` `#0f7748`: hover e estado ativo da acao primaria.
- `--accent-soft` `#e7f5ee`: fundo suave positivo.
- `--accent-soft-strong` `#cfeadd`: contorno e destaque suave positivo.
- `--accent-text` `#0d6b43`: texto em fundos suaves positivos.

### Status

- Info: `--info`, `--info-soft`, `--info-text`.
- Aviso: `--warn`, `--warn-soft`, `--warn-text`.
- Baixa confianca: `--orange-soft`, `--orange-text`.
- Erro: `--danger`, `--danger-soft`, `--danger-text`.
- Neutro: `--neutral-soft`, `--neutral-text`.

### Forma, sombra e foco

- Raios: `--r-sm` 6px, `--r` 9px, `--r-lg` 14px, `--r-pill` 999px.
- Sombras: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- Foco: `--ring` em todo controle interativo focado.

## Tipografia

- Familia: `Inter`, com fallback `system-ui`.
- Base: 14px, `line-height` 1.45.
- Corpo: peso 500.
- Destaque e labels fortes: 600 a 650.
- Titulos e contadores importantes: 700 a 750.
- Labels de campo: 11.5px, uppercase, `letter-spacing: .02em`, cor `--text-muted`.

## Estrutura de layout

- `.app`: shell vertical ocupando viewport inteira.
- `.topbar`: barra principal fixa no topo, 60px de altura, com marca, acoes principais e acoes utilitarias.
- `.statsbar`: barra secundaria com pasta atual, filtros por status e busca.
- `.content`: area principal da tabela e estados vazios.
- `.table-wrap`: scroll interno da grade.
- `.dialog` e `.dialog-backdrop`: base de modal central para escolha de pasta, busca no catalogo, catalogo DAT e confirmacao.
- `.toast`: feedback temporario fixo na parte inferior central.

## Componentes

### Botoes

- `.btn` e base dos botoes de texto.
- `.btn--primary` e acao primaria do contexto; usa emerald solido.
- `.btn--sm` reduz altura para 32px.
- `.btn--danger` representa remocao/limpeza de catalogo; usar so com confirmacao.
- `.icon-btn` cobre acoes utilitarias quadradas.
- `.icon-btn--ghost` remove peso visual quando botao esta dentro de toast ou header de dialog.
- `.icon-btn--ok` destaca validacao.
- `.icon-btn--accent` destaca acao de rename.
- `.icon-btn--danger` destaca remocao destrutiva dentro de listas.
- Botoes com icone e texto devem manter texto curto; em telas menores o texto pode sumir na topbar.

### Chips e filtros

- `.chip` representa filtro por status com contador.
- `.chip.is-active` indica filtro ativo com fundo elevado.
- Cores por status usam `--dot` via classes como `.chip--validated`, `.chip--error`.
- `.plat-override-badge` sinaliza override manual de plataforma na stats bar.

### Badges

- `.badge` serve para confianca e status.
- Sempre usar mapeamento existente: `high`, `medium`, `low`, `none`, `pending`, `identifying`, `identified`, `validated`, `ignored`, `renamed`, `error`.
- Badge precisa continuar curto, legivel e com ponto colorido.
- `high` e `validated` usam emerald; `low` usa laranja; `none` e `error` usam vermelho; `pending` e `identifying` usam info.
- Origem do match (`No-Intro`/`Redump`) deve ficar subordinada a confianca, nunca competir com badge principal.

### Tabela

- Cabecalho sticky em `.table thead th`.
- Hover de linha usa `--surface-soft`.
- Linha selecionada usa `.row.is-selected` com fundo emerald suave e faixa lateral.
- `.suggest-input` e campo inline de edicao do nome sugerido.
- `.suggest-search-btn` abre busca manual no catalogo e fica junto do input de sugestao.
- `.cbx` e checkbox custom de tabela.
- `.plat-chip` mostra plataforma sem competir com badges de status.
- `.ident__source` fica subordinado ao badge de confianca.
- Linhas `ignored` e `renamed` devem perder peso visual e bloquear edicao/selecao.
- Acoes por linha devem permanecer icon-only com tooltip/title: validar, ignorar, renomear.
- Tabela deve preservar densidade; nao transformar linhas em cards.

### Estados vazios e loading

- `.placeholder` centraliza mensagem, icone e CTA.
- `.spinner` comunica varredura em andamento.
- `.scan-progress` mostra titulo, detalhe, porcentagem e barra.
- `.scan-progress--inline` aparece acima da tabela durante leitura com itens ja renderizados.
- Sempre orientar proximo passo: escolher pasta, limpar filtro ou trocar pasta.

### Escolha de pasta

- `.folder-modal` reutiliza `.dialog` com largura menor.
- `.folder-pick-btn` usa borda tracejada quando vazio e borda solida quando preenchido.
- `.folder-pick-btn__text` deve truncar caminho longo com ellipsis.
- Seletor de plataforma deve permitir `auto` e todas as plataformas de `PLATFORM_NAMES`.
- `.field__hint--accent` destaca impacto do override manual.

### Busca no catalogo

- `.catalog-modal` e usada para buscar sugestao por item.
- `.catalog-search-field` deve ter icone interno e foco emerald.
- `.catalog-hash-panel` mostra hashes do arquivo em bloco suave.
- `.hash-list` usa fonte monoespacada e quebra hashes longos sem estourar container.
- `.catalog-results__status` informa buscando, erro, minimo de caracteres ou quantidade.
- `.catalog-result` mostra nome, ROM name, origem e hashes; botao `Usar` fica como acao secundaria.

### Catalogo DAT

- `.dat-modal` usa grid com header, tabs, corpo scrollavel e footer.
- `.dat-tabs` separa `Carregar`, `Carregados` e `Consultar`; badge numerico fica no tab.
- `.dat-section` enquadra cada area funcional dentro do modal, sem virar pagina separada.
- `.dat-alert` usa vermelho para erro e `.dat-alert--success` usa emerald.
- `.dat-import-row` combina seletor de arquivo e acao de importar.
- `.dat-file-list` lista fila e arquivos carregados com truncamento de caminho.
- `.dat-result-list` mostra resultado de importacao com estados `imported`, `skipped` e `error`.
- `.dat-file-meta` destaca contagem de ROMs sem roubar foco do nome do arquivo.

### Dialogs

- Escolha de pasta, busca no catalogo, catalogo DAT e confirmacao de rename reutilizam mesma base visual.
- Header de dialog usa icone dentro de bloco suave.
- Corpo pode conter `summary-card`, listas de alteracoes e hints.
- Footer alinha acoes para direita, com cancelar neutro e confirmar primario.
- Backdrop fecha dialogs nao destrutivos; acoes destrutivas continuam pedindo confirmacao explicita quando aplicavel.
- `.summary-grid` e `.summary-card` devem resumir impacto de rename antes de qualquer escrita em disco.
- `.summary-card--warn` destaca contagem critica como conflitos ou falhas.
- `.summary-card--muted` sinaliza contagem nao critica como itens pulados.
- `.dialog-list__scroll` aplica scroll interno em listas longas dentro do corpo do dialog.
- `.dialog-list--warn` destaca conflitos, mas nao deve ocultar lista de alteracoes.

### Toast

- `toast--info` para sucesso ou aviso simples.
- `toast--error` para falha.
- Tempo padrao atual: 3.5s para info, 6s para erro.

## Comportamento e interacao

- Todo controle interativo deve ter hover, foco visivel e estado desabilitado.
- `:active` de botoes pode afundar 1px; nao exagerar em animacao.
- Drawer fecha por overlay, botao ou `Escape`.
- Dialog fecha por backdrop e botao de fechar; confirmacao precisa continuar explicita.
- Busca usa input pill com icone interno e botao de limpar.
- Selecoes em massa precisam ter feedback visivel na `bulkbar`.
- Busca de catalogo dispara apos debounce curto e minimo de 2 caracteres.
- Acoes de importacao, busca, delete e rename precisam expor estado loading/desabilitado.
- Baixa confianca deve induzir revisao manual: usuario valida antes de renomear.
- Confirmacao de rename precisa mostrar conflitos, pulados e operacoes em disco.

## Responsividade

- Breakpoint principal atual: `920px`.
- Abaixo disso:
  - esconder `.brand__name`
  - esconder texto dos botoes principais da topbar e manter icones
  - reduzir padding desses botoes
  - empilhar `.dat-import-row`
  - permitir scroll horizontal em `.dat-tabs`
  - ocultar card/botao de pasta `.folder`
  - reduzir largura da busca para `170px`
- Modais devem respeitar `max-height` e manter corpo scrollavel, nao estourar viewport.
- Textos longos de paths, nomes, hashes e resultados devem truncar ou quebrar dentro do container.

## Regras de uso

- Reutilizar tokens e classes existentes antes de criar nova variante.
- Manter uma unica acao primaria por contexto.
- Evitar cor crua, sombra nova ou raio novo fora dos tokens existentes.
- Preferir densidade confortavel: alturas entre 32px e 40px, gaps curtos e hierarquia clara.
- Estados visuais devem reforcar fluxo de identificacao, validacao e rename, nunca competir com ele.
- Nao criar card dentro de card; use listas, secoes, dialogs ou linhas de tabela conforme contexto.
- Novos componentes devem seguir nomes de classe ja existentes por dominio: `catalog-*`, `dat-*`, `folder-*`, `scan-*`.
- Quando criar novo estado visual, mapear primeiro para tokens existentes antes de adicionar token novo.
