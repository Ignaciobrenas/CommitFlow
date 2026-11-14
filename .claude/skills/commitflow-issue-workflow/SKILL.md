---
name: commitflow-issue-workflow
description: Flujo de trabajo GitFlow estricto de CommitFlow: main <- staging <- ramas por issue (feat|fix|design|test|perf/<id>-<slug>), enlace con gh issue develop, Conventional Commits y PRs hacia staging.
---

# CommitFlow Issue & Branch Workflow Skill

Sigue siempre este ciclo de vida GitFlow adaptado al repositorio `Ignaciobrenas/CommitFlow`:
1. **Jerarquía de Ramas:**
   - `main`: Producción estable y releases del Marketplace. Solo recibe PRs desde `staging` (o `hotfix/*`).
   - `staging`: Rama de integración continua. **Todas** las ramas de trabajo nacen de `staging` y regresan mediante PR hacia `staging`.
   - Nomenclatura de ramas (compatible con `IssueBranchLinker`):
     - `feat/<id>-<slug>` (nuevas funcionalidades)
     - `fix/<id>-<slug>` (corrección de bugs)
     - `design/<id>-<slug>` (UI/UX, `DESIGN.md`, `SKILL.md`, accesibilidad)
     - `test/<id>-<slug>` (suites de tests, fuzzing, E2E, CI)
     - `perf/<id>-<slug>` (rendimiento, Web Workers, `OffscreenCanvas`, watcher)
2. **Crear rama enlazada al Issue:**
   ```bash
   git checkout staging && git pull origin staging
   gh issue develop <ID> --base staging --name <tipo>/<ID>-<slug> --checkout
   ```
3. **Commits Convencionales:**
   - Usa `type(scope): description (#ID)`, por ejemplo: `feat(engine): add binary packfile reader in GitFsReader (#10)`.
4. **Pull Request hacia `staging`:**
   - Incluye siempre `Refs #<ID>` en el cuerpo del PR hacia `staging` (y `Closes #<ID>` en el PR de release `staging` -> `main` para cierre automático).
   - Antes de abrir o mergear el PR, ejecuta `npm run compile`, `npm test` y `npm run build`.
