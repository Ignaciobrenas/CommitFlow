#!/usr/bin/env bash
set -euo pipefail

# 1. Asegurar main actualizada y crear staging (si no existe)
git checkout main
git pull origin main
if ! git show-ref --verify --quiet refs/heads/staging; then
  git checkout -b staging
  git push -u origin staging
else
  git checkout staging
  git pull origin staging
fi

# 2. Crear etiquetas organizadas en el repositorio
gh label create "epic:design"   --color "ec4899" --description "Design system, SKILLS, UI/UX y responsive" --force
gh label create "epic:engine"   --color "0284c7" --description "GitFsReader offline, performance y DAG" --force
gh label create "epic:features" --color "10b981" --description "Funcionalidades Git, Providers y Conflict Studio" --force
gh label create "epic:security" --color "ef4444" --description "Seguridad MCP, CSP y validacion IPC" --force
gh label create "epic:testing"  --color "8b5cf6" --description "Playwright, Fuzzing, A11y, MCP E2E y CI" --force

create_issue() {
  local title="$1"
  local label="$2"
  local body="$3"
  gh issue create --title "$title" --label "$label" --body "$body"
}

echo "Usa create_issue \"<titulo>\" \"<etiqueta>\" \"<cuerpo>\" para crear nuevos issues enlazables a staging."
