# Design System

Guia visual oficial do ROM Renamer. Use como referencia ao criar ou alterar CSS, componentes e telas.
Tokens vivem em `src/renderer/src/styles.css`, dentro de `:root`. Sempre consumir via `var(--token)`.

## Direcao visual

- Interface desktop clara, limpa e densa na medida certa.
- Base neutra fria com acento emerald para acoes principais e estados positivos.
- Controles com cara de ferramenta utilitaria: legiveis, compactos, previsiveis e com foco visivel.
- Feedback visual deve ajudar usuario a entender status de identificacao e impacto de rename.

## Tokens

### Superficies

- `--bg` `#eceff4`: fundo geral da janela.
- `--surface` `#ffffff`: cartoes, barras, dialogs, drawer e tabela.
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
- `.drawer`: painel lateral direito para configuracoes.
- `.dialog` e `.dialog-backdrop`: modal central para confirmacoes e escolha de pasta.
- `.toast`: feedback temporario fixo na parte inferior central.

## Componentes

### Botoes

- `.btn` e base dos botoes de texto.
- `.btn--primary` e unica acao primaria por contexto; usa emerald solido.
- `.btn--sm` reduz altura para 32px.
- `.icon-btn` cobre acoes utilitarias quadradas.
- `.icon-btn--ghost` remove peso visual quando botao esta dentro de drawer, toast ou header de dialog.
- `.icon-btn--ok` destaca validacao.
- `.icon-btn--accent` destaca acao de rename.

### Chips e filtros

- `.chip` representa filtro por status com contador.
- `.chip.is-active` indica filtro ativo com fundo elevado.
- Cores por status usam `--dot` via classes como `.chip--validated`, `.chip--error`.
- `.plat-override-badge` sinaliza override manual de plataforma na stats bar.

### Badges

- `.badge` serve para confianca e status.
- Sempre usar mapeamento existente: `high`, `medium`, `low`, `none`, `pending`, `identifying`, `identified`, `validated`, `ignored`, `renamed`, `error`.
- Badge precisa continuar curto, legivel e com ponto colorido.

### Tabela

- Cabecalho sticky em `.table thead th`.
- Hover de linha usa `--surface-soft`.
- Linha selecionada usa `.row.is-selected` com fundo emerald suave e faixa lateral.
- `.suggest-input` e campo inline de edicao do nome sugerido.
- `.cbx` e checkbox custom de tabela.
- `.plat-chip` mostra plataforma sem competir com badges de status.
- `.ident__source` fica subordinado ao badge de confianca.

### Estados vazios e loading

- `.placeholder` centraliza mensagem, icone e CTA.
- `.spinner` comunica varredura em andamento.
- Sempre orientar proximo passo: escolher pasta, limpar filtro ou trocar pasta.

### Drawer de configuracoes

- Abre pela direita com `translateX` e overlay.
- Grupo "Geral" fica sempre aberto como secao fixa.
- Demais grupos usam `<details class="group">`.
- `.switch` cobre toggle binario.
- Inputs e selects seguem mesmo tratamento de borda, foco e altura.

### Dialogs

- Escolha de pasta e confirmacao de rename reutilizam mesma base visual.
- Header de dialog usa icone dentro de bloco suave.
- Corpo pode conter `summary-card`, listas de alteracoes e hints.
- Footer alinha acoes para direita, com cancelar neutro e confirmar primario.

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

## Responsividade

- Breakpoint principal atual: `920px`.
- Abaixo disso, aplicar:
- esconder `.brand__name`
- esconder texto dos botoes principais da topbar e manter icones
- reduzir padding desses botoes
- ocultar card/botao de pasta `.folder`
- reduzir largura da busca para `170px`

## Regras de uso

- Reutilizar tokens e classes existentes antes de criar nova variante.
- Manter uma unica acao primaria por contexto.
- Evitar cor crua, sombra nova ou raio novo fora dos tokens existentes.
- Preferir densidade confortavel: alturas entre 32px e 40px, gaps curtos e hierarquia clara.
- Estados visuais devem reforcar fluxo de identificacao, validacao e rename, nunca competir com ele.
