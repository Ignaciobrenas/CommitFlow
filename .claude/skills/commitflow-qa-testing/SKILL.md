---
name: commitflow-qa-testing
description: Guía de la pirámide completa de QA para CommitFlow: tests unitarios, property-based fuzzing, pruebas E2E del servidor MCP (stdio + HTTP/SSE), auditoría responsiva y WCAG 2.1 AA en Chromium headless, benchmarks de 50k commits y smoke tests E2E de extensión VS Code.
---

# CommitFlow QA & Testing Pyramid Skill

Antes de dar por finalizada cualquier feature, bugfix o refactorización, valida las capas aplicables de la pirámide de calidad:
1. **Typecheck y Compilación (`npm run compile` & `npm run build`):**
   - Cero errores de TypeScript estricto y bundle limpio en `dist/`.
2. **Tests Unitarios y de Integración (`npm test` -> `test/runTests.ts`):**
   - Cubre lógica pura (`GraphLayout`, `GitFsReader`, `GitParser`, `SshConfigParser`, `IssueBranchLinker`, `ConventionalCommitsBuilder`, `IpcSchemaValidator`, `AdaptiveDebouncer`).
3. **Property-Based Fuzzing (`test/fuzzTests.ts`):**
   - Ejecuta 1,000+ iteraciones deterministas inyectando `packed-refs` corruptos, reflogs truncados, buffers binarios aleatorios, alias SSH circulares, rutas Unicode y grafos complejos sin lanzar excepciones no controladas.
4. **E2E del Servidor MCP (`test/mcpE2eTests.ts`):**
   - Prueba real contra repositorio temporal en disco: `stdio` (`dist/mcp.js`) y `CommitFlowHttpServer` (`/health`, `/sse`, `/mcp`), JSON-RPC 2.0 `initialize`, todas las tools y resources, scoping de repo, rechazo 401/403, rate-limiting 429 y log de auditoría.
5. **Webview Multi-Viewport, Temas y WCAG 2.1 AA (`scripts/verify-responsive.js`):**
   - Verifica en Chromium/Edge headless los 4 breakpoints (`240px` Nano, `360px` Sidebar, `520px` Compact, `1100px` Wide Split) y temas (`dark`, `light`, `high-contrast`, `high-contrast-light`) con `0` overflows, `0` colisiones y `0` violaciones A11y.
6. **Benchmarks y Empaquetado (`scripts/benchmark-50k.js` & `npx vsce package`):**
   - Verifica layout de 50,000 commits dentro del presupuesto de latencia/memoria y que el `.vsix` se empaquete sin errores.
