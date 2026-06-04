# Design Rules

Regras de design e UI que devem ser seguidas em todo o projeto.

## Dropdowns sempre abrem para baixo

Nunca use `<select>` nativo dentro de contêineres com `overflow: hidden` (dialogs e modais).
Em Electron/Chromium, `overflow: hidden` no ancestral faz o popup nativo calcular o espaço disponível dentro do contêiner clippado — quando há mais espaço acima, o dropdown abre para cima.

**Regra:** use sempre o componente `AppSelect` (`src/renderer/src/components/AppSelect.tsx`).
Ele renderiza um dropdown customizado com `position: absolute; top: 100%`, garantindo que sempre abre para baixo independente do contexto.

```tsx
// Correto
<AppSelect value={v} onChange={setV} items={[...]} />

// Errado — abre para cima em dialogs/modais
<select value={v} onChange={...}> ... </select>
```

O componente aceita uma lista plana de opções (`{ value, label }`) ou grupos (`{ groupLabel, options }`), podendo misturar os dois no mesmo array `items`.
