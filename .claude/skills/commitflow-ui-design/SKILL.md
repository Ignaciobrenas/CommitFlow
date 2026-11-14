---
name: commitflow-ui-design
description: Diseña e implementa interfaces Webview para CommitFlow siguiendo DESIGN.md, variables CSS de VS Code, Codicons, accesibilidad WCAG 2.1 AA y los 4 breakpoints responsivos multi-dock. Úsala al crear o modificar componentes UI, drawers, modales o temas.
---

# CommitFlow UI & Webview Design Skill

Antes de escribir código UI en `src/graph/graphWebviewProvider.ts`, `src/webview/main.ts`, `src/webview/primitives.ts` o `src/webview/style.css`:
1. Lee `DESIGN.md` en la raíz del proyecto.
2. Verifica que **NO** se importe ni se referencie `@vscode/webview-ui-toolkit` (deprecado en enero de 2025). Utiliza tokens `--vscode-*` y los primitivos nativos en `src/webview/primitives.ts` (`CfButton`, `CfBadge`, `CfDrawer`, `CfTabs`, `CfToast`, `CfSkeleton`, `clampPopoverToViewport`).
3. **Checklist obligatorio por componente:**
   - [ ] Funciona en temas VS Code: Dark+, Light+, High Contrast Dark (`.vscode-high-contrast`) y High Contrast Light (`.vscode-high-contrast-light`).
   - [ ] Verificado en los 4 viewports multi-dock: Nano (`240px`), Sidebar Compact (`360px`), Compact (`520px`), Wide Split (`1100px`) y Bottom Panel (`1000x250px`).
   - [ ] Usa `tabular-nums` (`font-variant-numeric: tabular-nums`) para hashes SHA, timestamps y contadores `+N/-N`.
   - [ ] Incluye roles ARIA semánticos (`treegrid`, `row`, `gridcell` en el grafo; `role="dialog"` y `trapModalFocus` en modales) y foco visible (`outline: 1px solid var(--vscode-focusBorder)`).
   - [ ] Cero `innerHTML` con datos de commits/issues/usuarios sin escapar (`escapeHtml`); CSP estricto con `nonce`.
   - [ ] Popovers/drawers usan `clampPopoverToViewport` y se cierran al hacer clic fuera o pulsar `Escape`.
   - [ ] Mensajes de estado vacío claros con CTA accionable y `CfSkeleton` loaders no bloqueantes.
   - [ ] Respeta `@media (prefers-reduced-motion: reduce)`.
