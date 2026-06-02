# Regras para IA

Fonte oficial de diretrizes do projeto. Use este arquivo como referencia principal para analise, implementacao, refatoracao, ajustes visuais e decisao tecnica.

## Objetivo do produto

- O projeto e um app desktop Electron para identificar, validar e renomear ROMs com seguranca.
- Precisao de identificacao, previsibilidade de rename e clareza de interface valem mais que automacao agressiva.
- Toda alteracao deve preservar confianca do usuario no que sera escrito em disco.
- Identificacao offline por catalogo SQLite local e preferivel a chamadas externas durante o fluxo principal.
- Stack principal atual: Electron + electron-vite + React 19 + Zustand + TypeScript.

## Regras gerais

- Fazer mudancas alinhadas com estado atual do projeto, evitando reinventar fluxo, estrutura ou linguagem visual sem necessidade real.
- Preferir alteracoes pequenas, claras e reversiveis.
- Manter textos de interface em portugues consistente com restante do app.
- Quando regra de produto, comportamento observado e documentacao entrarem em conflito, corrigir documentacao ou codigo para que ambos voltem a refletir mesma verdade.
- Antes de criar novo padrao, checar se ja existe componente, classe, fluxo ou utilitario equivalente no projeto.
- OpenSpec em `openspec/specs` documenta requisitos atuais do produto. Mudanca de comportamento deve atualizar spec relevante junto do codigo.

## Regras de arquitetura

- `src/main` concentra filesystem, scan, hash, identificacao, preview de rename, rename real e undo.
- `src/renderer` cuida de interface, estado de tela e interacoes do usuario.
- `src/preload` e unica ponte entre renderer e Electron nativo. Renderer nao deve acessar Node ou filesystem direto.
- `src/shared/types.ts` e contrato compartilhado. Mudancas em payloads, status, configuracao ou plataformas devem partir dele.
- `src/renderer/src/stores/useRomStore.ts` e orquestrador principal de estado e fluxos da UI; evitar mover regra de negocio pesada para componentes.
- `src/renderer/src/components` concentra modais, toolbar, tabela, filtros e dialogos de feedback; seguir composicao existente antes de criar nova tela paralela.
- Operacoes sensiveis devem continuar passando por IPC com validacao de entrada no processo main.
- Regras de negocio de ROM devem ficar fora de componentes React sempre que possivel.
- `src/main/rom/dat.ts` concentra catalogo SQLite, importacao DAT/XML, busca manual e matching por hash/fuzzy.
- `src/main/rom/region.ts` concentra deteccao de regiao por leitura de header binario de ROM; suporta Nintendo 64, Game Boy, Game Boy Color, Game Boy Advance e Nintendo DS.
- `scripts/build-rom-catalog.mjs` gera catalogo SQLite bundled em `resources/rom-catalog.sqlite`; manter parser e schema compativeis com runtime.
- Base bundled de catalogo nasce de DATs locais em `dat/`; arquivos temporarios em `temp/` nao devem virar dependencia permanente do fluxo.

## Regras de codigo

- Escrever codigo claro, organizado e facil de manter.
- Respeitar arquitetura, convencoes e estrutura ja adotadas.
- Preferir TypeScript explicito em tipos compartilhados, estados e payloads de IPC.
- Reutilizar helpers e estruturas existentes antes de criar novas abstracoes.
- Tratar erros de I/O, IPC e rename com mensagens compreensiveis para o usuario.
- Evitar acoplamento entre UI e regra de negocio. Componentes devem orquestrar; logica pesada deve morar em modulos dedicados.
- Nao adicionar dependencias, camadas ou patterns novos sem ganho concreto para produto, manutencao ou seguranca.

## Regras de fluxo do produto

- Pipeline de identificacao deve seguir esta ordem: detectar plataforma, calcular hashes, consultar catalogo SQLite local por hash e so entao tentar fuzzy por nome no catalogo local.
- Match exato de hash no catalogo local e fonte de maior confianca (`high`).
- Match fuzzy por nome e apenas sugestao de baixa confianca (`low`) e nunca deve virar rename sem validacao explicita.
- Busca manual no catalogo pode usar contexto de plataforma para reduzir resultados irrelevantes, mas sem impedir fallback ao catalogo completo quando nao houver arquivo compativel carregado.
- Quando hash e fuzzy falham, item deve ficar `pending`, sem sugestao automatica confiavel.
- Rename em lote deve continuar passando por etapa de preview e confirmacao antes de tocar disco.
- Itens com baixa confianca ou sem sugestao confiavel nao devem ser promovidos a rename automatico sem validacao explicita.
- Estados (`pending`, `identifying`, `identified`, `validated`, `ignored`, `renamed`, `error`) devem permanecer coerentes em UI, store e main.
- Undo do ultimo lote e parte do fluxo principal; nao quebrar ou contornar esse caminho.
- Configuracoes persistidas devem passar por normalizacao antes de uso.
- Pares CUE/BIN devem ser tratados como unidade: CUE aparece como item principal, BIN referenciado vira sidecar quando possivel.
- Override manual de plataforma deve vencer deteccao automatica por extensao.

## Regras de catalogo

- Catalogo runtime deve ser SQLite local no `userData`, com copia inicial do bundled quando disponivel.
- Importacao de DAT/XML deve deduplicar por caminho normalizado e SHA-256 do arquivo.
- Parser de DAT/XML deve aceitar blocos `game`, `machine` e `software`; quando `name` faltar, pode usar `description` como fallback legivel.
- Busca manual no catalogo deve tentar LIKE ranqueado antes de fuzzy.
- Fuzzy automatico deve usar limiar alto o bastante para evitar falso positivo agressivo.
- Limpar catalogo ou remover arquivo importado deve ser acao explicita da UI e reportar contagem removida.
- DATs, XMLs e APIs externas nao devem ser consultados diretamente no scan; scan consulta o SQLite local.

## Regras de rename

- Preview deve calcular conflitos, duplicatas, skips, nomes finais e operacoes CUE sem escrever em disco.
- Rename real deve usar plano validado no main process e tratar erro por item sem ocultar sucessos.
- Conflitos devem respeitar estrategia configurada: sufixar ou pular.
- Templates de nome devem preservar extensao quando `{ext}` nao existir e sanitizar caracteres invalidos.
- Undo deve inverter ultimo lote registrado e restaurar conteudo de CUE quando houve ajuste de referencias.

## Regras de layout e design

Padrao visual do projeto esta documentado em `.ai-framework/DESIGN.md`.
Essas diretrizes devem ser seguidas sempre que houver criacao ou alteracao de telas, componentes visuais ou estilos.

- Seguir design system e padroes visuais existentes antes de propor abordagem nova.
- Consumir tokens de `src/renderer/src/styles.css` via `var(--token)`. Nao usar cor crua sem necessidade forte.
- Manter consistencia entre telas e componentes em layout, tipografia, cores, espacamento, estados visuais e comportamento responsivo.
- Priorizar legibilidade, hierarquia de informacao, contraste adequado e clareza de interacao.
- Reutilizar componentes, estilos e classes existentes antes de criar variacoes.
- Formularios e modais devem evitar rotulos redundantes quando cabecalho, contexto e placeholder ja comunicam mesma informacao.
- Criar nova solucao visual so quando houver necessidade real de produto, usabilidade ou escalabilidade.
- Considerar tamanhos de tela menores, foco visivel, estados vazios e previsibilidade de uso em qualquer alteracao visual.

## Guard rails

- Nao executar comandos diretamente em ambiente de producao. Quando necessario, informar comando e orientar execucao manual pelo responsavel.
- Nao fazer alteracoes destrutivas ou irreversiveis sem confirmacao explicita e sem deixar claro impacto esperado.
- Nao ignorar impacto em seguranca, desempenho, usabilidade, manutencao ou consistencia visual.
- Nao contornar protecoes de `contextIsolation`, `sandbox`, validacao de IPC ou preview de rename por conveniencia.
- Nao alterar comportamento de escrita em disco sem revisar conflitos, erros, duplicatas e caminho de undo.
