# Regras para IA

Fonte oficial de diretrizes do projeto. Use este arquivo como referencia principal para analise, implementacao, refatoracao, ajustes visuais e decisao tecnica.

## Objetivo do produto

- O projeto e um app desktop Electron para identificar, validar e renomear ROMs com seguranca.
- Precisao de identificacao, previsibilidade de rename e clareza de interface valem mais que automacao agressiva.
- Toda alteracao deve preservar confianca do usuario no que sera escrito em disco.

## Regras gerais

- Fazer mudancas alinhadas com estado atual do projeto, evitando reinventar fluxo, estrutura ou linguagem visual sem necessidade real.
- Preferir alteracoes pequenas, claras e reversiveis.
- Manter textos de interface em portugues consistente com restante do app.
- Quando regra de produto, comportamento observado e documentacao entrarem em conflito, corrigir documentacao ou codigo para que ambos voltem a refletir mesma verdade.
- Antes de criar novo padrao, checar se ja existe componente, classe, fluxo ou utilitario equivalente no projeto.

## Regras de arquitetura

- `src/main` concentra filesystem, scan, hash, identificacao, preview de rename, rename real e undo.
- `src/renderer` cuida de interface, estado de tela e interacoes do usuario.
- `src/preload` e unica ponte entre renderer e Electron nativo. Renderer nao deve acessar Node ou filesystem direto.
- `src/shared/types.ts` e contrato compartilhado. Mudancas em payloads, status, configuracao ou plataformas devem partir dele.
- Operacoes sensiveis devem continuar passando por IPC com validacao de entrada no processo main.
- Regras de negocio de ROM devem ficar fora de componentes React sempre que possivel.

## Regras de codigo

- Escrever codigo claro, organizado e facil de manter.
- Respeitar arquitetura, convencoes e estrutura ja adotadas.
- Preferir TypeScript explicito em tipos compartilhados, estados e payloads de IPC.
- Reutilizar helpers e estruturas existentes antes de criar novas abstracoes.
- Tratar erros de I/O, IPC e rename com mensagens compreensiveis para o usuario.
- Evitar acoplamento entre UI e regra de negocio. Componentes devem orquestrar; logica pesada deve morar em modulos dedicados.
- Nao adicionar dependencias, camadas ou patterns novos sem ganho concreto para produto, manutencao ou seguranca.

## Regras de fluxo do produto

- Pipeline de identificacao deve seguir esta ordem: detectar plataforma, calcular hashes, consultar DAT local, consultar API por hash/nome e so entao cair em fallback por nome.
- Match de DAT/hash continua sendo fonte de maior confianca; API entra como fallback intermediario; sugestao por nome fica por ultimo e com confianca baixa.
- Rename em lote deve continuar passando por etapa de preview e confirmacao antes de tocar disco.
- Itens com baixa confianca ou sem sugestao confiavel nao devem ser promovidos a rename automatico sem validacao explicita.
- Estados (`pending`, `identifying`, `identified`, `validated`, `ignored`, `renamed`, `error`) devem permanecer coerentes em UI, store e main.
- Undo do ultimo lote e parte do fluxo principal; nao quebrar ou contornar esse caminho.
- Configuracoes persistidas devem passar por normalizacao antes de uso.

## Regras de layout e design

Padrao visual do projeto esta documentado em `.ai-framework/DESIGN.md`.
Essas diretrizes devem ser seguidas sempre que houver criacao ou alteracao de telas, componentes visuais ou estilos.

- Seguir design system e padroes visuais existentes antes de propor abordagem nova.
- Consumir tokens de `src/renderer/src/styles.css` via `var(--token)`. Nao usar cor crua sem necessidade forte.
- Manter consistencia entre telas e componentes em layout, tipografia, cores, espacamento, estados visuais e comportamento responsivo.
- Priorizar legibilidade, hierarquia de informacao, contraste adequado e clareza de interacao.
- Reutilizar componentes, estilos e classes existentes antes de criar variacoes.
- Criar nova solucao visual so quando houver necessidade real de produto, usabilidade ou escalabilidade.
- Considerar tamanhos de tela menores, foco visivel, estados vazios e previsibilidade de uso em qualquer alteracao visual.

## Guard rails

- Nao executar comandos diretamente em ambiente de producao. Quando necessario, informar comando e orientar execucao manual pelo responsavel.
- Nao fazer alteracoes destrutivas ou irreversiveis sem confirmacao explicita e sem deixar claro impacto esperado.
- Nao ignorar impacto em seguranca, desempenho, usabilidade, manutencao ou consistencia visual.
- Nao contornar protecoes de `contextIsolation`, `sandbox`, validacao de IPC ou preview de rename por conveniencia.
- Nao alterar comportamento de escrita em disco sem revisar conflitos, erros, duplicatas e caminho de undo.
