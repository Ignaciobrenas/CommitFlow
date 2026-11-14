---
name: commitflow-canvas-dag
description: Guía técnica para diseñar y optimizar el motor topológico del DAG, renderizado de splines Bézier, virtual scrolling (< 150 nodos DOM), minimapa de ramas, drag-and-drop y Web Workers / OffscreenCanvas en CommitFlow.
---

# CommitFlow DAG & Virtual Scroll Skill

Cuando trabajes en `src/graph/graphLayout.ts`, `src/graph/dagWorkerClient.ts` o el renderizado del grafo en `src/webview/main.ts`:
1. **Presupuesto de DOM y Rendimiento:**
   - El scroll virtual (`updateVirtualWindow`) DEBE mantener `< 150` filas DOM montadas en el viewport en todo momento, reciclando elementos del pool cuando sea posible incluso con `100,000+` commits.
   - Usa cálculos incrementales con `requestAnimationFrame` y evita reflows síncronos (`offsetHeight`/`getBoundingClientRect`) dentro de bucles por fila.
2. **Motor Topológico y Offload (`GraphLayout` & `DagWorkerEngine`):**
   - Mantén el cálculo puro en funciones deterministas sin dependencias de `vscode` para poder ejecutarlas tanto en Node.js como dentro de un Web Worker.
   - Al usar `OffscreenCanvas` (para el minimapa o carriles), provee siempre fallback limpio para entornos sin `OffscreenCanvas`.
   - Soporta hashes SHA-1 (40 chars) y SHA-256 (64 chars), así como merges múltiples (octopus) y commits raíz huérfanos.
3. **Interactividad & A11y:**
   - Todo nodo SVG/Canvas decorativo debe llevar `aria-hidden="true"`.
   - Cada fila de commit debe mantener su `role="row"`, `aria-label` descriptivo con ramas/tags/padres y sincronización exacta con la navegación por teclado (`ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Home`, `End`).
   - Las operaciones Drag-and-Drop sobre ramas/commits (reset, checkout, cherry-pick, rebase) DEBEN pedir confirmación explícita en modal seguro antes de mutar Git.
