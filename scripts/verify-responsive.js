const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const cssWebview = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'webview.css'), 'utf8');
const cssCodicon = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'codicon.css'), 'utf8');

const themeVariables = {
  dark: `
    --vscode-editor-background: #1e1e1e;
    --vscode-editor-foreground: #d4d4d4;
    --vscode-sideBar-background: #252526;
    --vscode-sideBar-foreground: #cccccc;
    --vscode-input-background: #3c3c3c;
    --vscode-input-foreground: #cccccc;
    --vscode-input-border: #3c3c3c;
    --vscode-button-background: #007acc;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0062a3;
    --vscode-button-secondaryBackground: #3a3d41;
    --vscode-button-secondaryForeground: #ffffff;
    --vscode-errorForeground: #f48771;
    --vscode-testing-iconPassed: #89d185;
    --vscode-editorWarning-foreground: #cca700;
  `,
  light: `
    --vscode-editor-background: #ffffff;
    --vscode-editor-foreground: #333333;
    --vscode-sideBar-background: #f3f3f3;
    --vscode-sideBar-foreground: #616161;
    --vscode-input-background: #ffffff;
    --vscode-input-foreground: #333333;
    --vscode-input-border: #cecece;
    --vscode-button-background: #007acc;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0062a3;
    --vscode-button-secondaryBackground: #e5e5e5;
    --vscode-button-secondaryForeground: #333333;
    --vscode-errorForeground: #e51400;
    --vscode-testing-iconPassed: #388a34;
    --vscode-editorWarning-foreground: #bf8803;
  `,
  'high-contrast': `
    --vscode-editor-background: #000000;
    --vscode-editor-foreground: #ffffff;
    --vscode-sideBar-background: #000000;
    --vscode-sideBar-foreground: #ffffff;
    --vscode-input-background: #000000;
    --vscode-input-foreground: #ffffff;
    --vscode-input-border: #6fc3df;
    --vscode-contrastActiveBorder: #f38518;
    --vscode-button-background: #000000;
    --vscode-button-foreground: #ffffff;
    --vscode-button-border: #6fc3df;
    --vscode-button-hoverBackground: #1a1a1a;
    --vscode-button-secondaryBackground: #000000;
    --vscode-button-secondaryForeground: #ffffff;
    --vscode-errorForeground: #f48771;
    --vscode-testing-iconPassed: #89d185;
    --vscode-editorWarning-foreground: #cca700;
  `,
  'high-contrast-light': `
    --vscode-editor-background: #ffffff;
    --vscode-editor-foreground: #292929;
    --vscode-sideBar-background: #ffffff;
    --vscode-sideBar-foreground: #292929;
    --vscode-input-background: #ffffff;
    --vscode-input-foreground: #292929;
    --vscode-input-border: #0f4a85;
    --vscode-contrastBorder: #0f4a85;
    --vscode-contrastActiveBorder: #006bbd;
    --vscode-button-background: #0f4a85;
    --vscode-button-foreground: #ffffff;
    --vscode-button-border: #0f4a85;
    --vscode-button-hoverBackground: #0c3b6b;
    --vscode-button-secondaryBackground: #ffffff;
    --vscode-button-secondaryForeground: #292929;
    --vscode-errorForeground: #b5200d;
    --vscode-testing-iconPassed: #374e06;
    --vscode-editorWarning-foreground: #895503;
  `,
};

function buildGraphHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { ${themeVariables[themeName]} }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0; padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden; height: 100vh;
    }
  </style>
</head>
<body data-theme="${themeName}" class="vscode-${themeName}">
  <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
    <div class="header-bar" id="header-bar">
      <div class="header-row-primary">
        <div class="brand-section">
          <span class="brand-title">CommitFlow</span>
        </div>
        <div id="active-branch-pill" class="active-branch-badge">
          <div class="branch-pulse-dot"></div>
          <span class="branch-name">main</span>
        </div>
        <div class="header-quick-actions">
          <button id="btn-layout-mode" class="btn-icon" aria-label="Layout mode"><i class="codicon codicon-layout" aria-hidden="true"></i></button>
          <button id="btn-theme-mode" class="btn-icon" aria-label="Theme mode"><i class="codicon codicon-symbol-color" aria-hidden="true"></i></button>
          <button id="btn-reflog" class="btn-icon" aria-label="Time machine reflog"><i class="codicon codicon-history" aria-hidden="true"></i></button>
          <button id="btn-repo-health" class="btn-icon" aria-label="Repository health"><i class="codicon codicon-pulse" aria-hidden="true"></i></button>
          <button id="btn-bisect" class="btn-icon" aria-label="Git bisect"><i class="codicon codicon-search" aria-hidden="true"></i></button>
          <button id="btn-changelog" class="btn-icon" aria-label="Generate changelog"><i class="codicon codicon-markdown" aria-hidden="true"></i></button>
          <button id="btn-undo-commit" class="btn-icon" aria-label="Undo commit"><i class="codicon codicon-discard" aria-hidden="true"></i></button>
          <button id="refresh-btn" class="btn-icon" aria-label="Refresh graph"><i class="codicon codicon-refresh" aria-hidden="true"></i></button>
          <button id="btn-popout" class="btn-icon" aria-label="Popout editor"><i class="codicon codicon-link-external" aria-hidden="true"></i></button>
          <button id="btn-stash" class="btn-icon" aria-label="Stashes"><i class="codicon codicon-archive" aria-hidden="true"></i></button>
          <button id="btn-personal-stats" class="btn-icon" aria-label="Personal stats"><i class="codicon codicon-graph" aria-hidden="true"></i></button>
          <button id="btn-settings" class="btn-icon" aria-label="Settings"><i class="codicon codicon-settings-gear" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="nav-tab-bar">
        <button class="nav-tab-btn active"><i class="codicon codicon-git-branch" aria-hidden="true"></i> <span>Grafo</span></button>
        <button class="nav-tab-btn"><i class="codicon codicon-history" aria-hidden="true"></i> <span>Historial</span></button>
        <button class="nav-tab-btn"><i class="codicon codicon-issues" aria-hidden="true"></i> <span>Issues</span> <span class="tab-badge">2</span></button>
        <button class="nav-tab-btn"><i class="codicon codicon-git-pull-request" aria-hidden="true"></i> <span>PRs</span> <span class="tab-badge">1</span></button>
        <button class="nav-tab-btn"><i class="codicon codicon-repo-forked" aria-hidden="true"></i> <span>Worktrees</span></button>
        <button class="nav-tab-btn"><i class="codicon codicon-sparkle" aria-hidden="true"></i> <span>Conectar IA</span></button>
      </div>
      <div class="toolbar-controls">
        <div class="search-input-wrapper">
          <span class="search-icon"><i class="codicon codicon-search" aria-hidden="true"></i></span>
          <input type="text" class="search-input" aria-label="Filter commits" value="feat(mcp)" />
        </div>
        <select class="branch-select" aria-label="Select branch filter"><option>all (Todas las ramas)</option><option>main</option></select>
        <button class="btn-icon" id="btn-checkout" aria-label="Checkout selected branch"><i class="codicon codicon-arrow-swap" aria-hidden="true"></i></button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item"><i class="codicon codicon-git-commit" aria-hidden="true"></i> Commits: <span class="stat-value tabular-nums mono-num">128</span></div>
      <div class="stat-item"><i class="codicon codicon-organization" aria-hidden="true"></i> Autores: <span class="stat-value tabular-nums mono-num">4</span></div>
      <div class="stat-item"><i class="codicon codicon-git-branch" aria-hidden="true"></i> Ramas: <span class="stat-value tabular-nums mono-num">6</span></div>
      <div class="stat-item"><i class="codicon codicon-archive" aria-hidden="true"></i> Stashes: <span class="stat-value tabular-nums mono-num">1</span></div>
    </div>

    <div class="graph-table-container" role="treegrid" aria-label="CommitFlow Interactive Git Graph" style="flex:1; overflow:auto;">
      <div class="virtual-viewport">
        <div class="commit-row selected" role="row" tabindex="0" aria-rowindex="1" aria-selected="true" aria-label="cf4821a — [main] — feat(mcp): streamable HTTP and stdio authenticated server — by Ignacio (Just now)" style="height:32px; display:flex; align-items:center; gap:8px; padding:0 8px; overflow:hidden;">
          <span class="graph-canvas-col" role="gridcell" aria-label="Commit graph lane 0" style="width:20px; flex-shrink:0;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#00f0ff;"></span></span>
          <span class="commit-hash tabular-nums mono-num" role="gridcell" style="flex-shrink:0;">cf4821a</span>
          <span class="commit-subject" role="gridcell" style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span class="branch-pill">main</span> feat(mcp): streamable HTTP and stdio authenticated server</span>
        </div>
        <div class="commit-row" role="row" tabindex="0" aria-rowindex="2" aria-selected="false" aria-label="ab8291f — [dev] — feat(ai): Connect with your AI studio and key generator — by Ignacio (10m ago)" style="height:32px; display:flex; align-items:center; gap:8px; padding:0 8px; overflow:hidden;">
          <span class="graph-canvas-col" role="gridcell" aria-label="Commit graph lane 1" style="width:20px; flex-shrink:0;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#d946ef;"></span></span>
          <span class="commit-hash tabular-nums mono-num" role="gridcell" style="flex-shrink:0;">ab8291f</span>
          <span class="commit-subject" role="gridcell" style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span class="branch-pill" style="background:rgba(217,70,239,0.2);">dev</span> feat(ai): Connect with your AI studio and key generator</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildRebaseStudioHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { ${themeVariables[themeName]} }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0; padding: 0;
      background: rgba(0, 0, 0, 0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh; display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body data-theme="${themeName}" class="vscode-${themeName}">
  <div id="rebase-studio-modal" class="modal-overlay open" style="opacity:1; pointer-events:auto; position:relative; width:100%; height:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
    <div class="modal-card" style="width: min(850px, 100%); max-height: min(85vh, 750px); display: flex; flex-direction: column;">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="codicon codicon-git-pull-request-go-to-changes" aria-hidden="true" style="font-size:16px; color:var(--accent-purple);"></i>
          <span style="font-weight:700; font-size:var(--font-size-base);">Interactive Rebase Studio</span>
        </div>
        <button class="btn-icon" id="rebase-studio-modal-close" aria-label="Close Rebase Studio"><i class="codicon codicon-close" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body" style="overflow-y:auto; overflow-x:hidden; box-sizing:border-box; flex:1; display:flex; flex-direction:column; gap:12px; padding:12px;">
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <span>Reordena los commits arrastrando o usando los botones. Selecciona la acción:</span>
          <span class="tabular-nums" style="font-weight:600; color:var(--text-primary);">3 commits</span>
        </div>
        <div class="rebase-todo-list" style="display:flex; flex-direction:column; gap:6px;">
          <div class="rebase-todo-item">
            <i class="codicon codicon-grabber rebase-item-handle" aria-hidden="true"></i>
            <select class="rebase-action-select" aria-label="Rebase action"><option>pick</option><option>reword</option><option>edit</option><option>squash</option><option>drop</option></select>
            <span class="rebase-item-sha">f775f85</span>
            <span class="rebase-item-subject">feat(release): release v0.4.8 with universal responsive design</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm" aria-label="Move commit up"><i class="codicon codicon-arrow-up" aria-hidden="true"></i></button>
              <button class="btn-sm" aria-label="Move commit down"><i class="codicon codicon-arrow-down" aria-hidden="true"></i></button>
            </div>
          </div>
          <div class="rebase-todo-item action-squash">
            <i class="codicon codicon-grabber rebase-item-handle" aria-hidden="true"></i>
            <select class="rebase-action-select" aria-label="Rebase action"><option selected>squash</option><option>pick</option></select>
            <span class="rebase-item-sha">aa1779d</span>
            <span class="rebase-item-subject">fix(ui): close all popups, popovers and modals when clicking outside</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm" aria-label="Move commit up"><i class="codicon codicon-arrow-up" aria-hidden="true"></i></button>
              <button class="btn-sm" aria-label="Move commit down"><i class="codicon codicon-arrow-down" aria-hidden="true"></i></button>
            </div>
          </div>
          <div class="rebase-todo-item action-drop">
            <i class="codicon codicon-grabber rebase-item-handle" aria-hidden="true"></i>
            <select class="rebase-action-select" aria-label="Rebase action"><option selected>drop</option></select>
            <span class="rebase-item-sha">98cd31a</span>
            <span class="rebase-item-subject">chore: remove temporary debug logs</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm" aria-label="Move commit up"><i class="codicon codicon-arrow-up" aria-hidden="true"></i></button>
              <button class="btn-sm" aria-label="Move commit down"><i class="codicon codicon-arrow-down" aria-hidden="true"></i></button>
            </div>
          </div>
        </div>
        <div style="padding:8px 12px; border-radius:4px; font-size:var(--font-size-sm); background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3);">
          <i class="codicon codicon-pass"></i> Simulación previa completada: 0 conflictos de fusión detectados.
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-rebase-dryrun" class="btn-sm"><i class="codicon codicon-eye"></i> Simular (Dry Run)</button>
        <div>
          <button id="btn-rebase-cancel" class="btn-sm">Cancelar</button>
          <button id="btn-rebase-execute" class="btn-sm btn-primary"><i class="codicon codicon-check"></i> Iniciar Rebase</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildCommitDrawerHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { ${themeVariables[themeName]} }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0; padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh; overflow: hidden;
    }
  </style>
</head>
<body data-theme="${themeName}" class="vscode-${themeName}">
  <div class="commitflow-app" style="height:100vh; display:flex;">
    <div class="commit-drawer open" style="width:100%; display:flex; flex-direction:column; border-left:none;">
      <div class="drawer-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--border-subtle);">
        <span style="font-weight:600; font-size:var(--font-size-base);">Detalles del Commit</span>
        <button class="btn-icon" id="drawer-close-btn" aria-label="Close commit drawer"><i class="codicon codicon-close" aria-hidden="true"></i></button>
      </div>
      <div class="drawer-body">
        <div class="author-hero-card">
          <img class="author-hero-avatar" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='38' height='38'><circle cx='19' cy='19' r='19' fill='%2338bdf8'/><text x='50%' y='54%' text-anchor='middle' dominant-baseline='middle' fill='%23fff' font-size='14' font-family='sans-serif'>IB</text></svg>" />
          <div style="display:flex; flex-direction:column; overflow:hidden;">
            <span style="font-weight:600; font-size:var(--font-size-base);">Ignacio Breñas</span>
            <span style="color:var(--text-muted); font-size:var(--font-size-xs);">ignaciobrenas@gmail.com</span>
            <span style="color:var(--accent-cyan); font-size:var(--font-size-xs); margin-top:2px;">Hace 5 minutos (cf4821a)</span>
          </div>
        </div>

        <div class="drawer-action-buttons">
          <button class="btn-icon" id="btn-copy-sha"><i class="codicon codicon-copy"></i> Copiar SHA</button>
          <button class="btn-icon" id="btn-copy-msg"><i class="codicon codicon-comment"></i> Copiar Mensaje</button>
          <button class="btn-icon" id="btn-drawer-compare"><i class="codicon codicon-diff"></i> Comparar HEAD</button>
          <button class="btn-icon" id="btn-drawer-cherry-pick"><i class="codicon codicon-git-pull-request-go-to-changes"></i> Cherry-Pick</button>
          <button class="btn-icon" id="btn-drawer-rebase"><i class="codicon codicon-git-pull-request-go-to-changes"></i> Rebase Interactivo</button>
          <button class="btn-icon" id="btn-drawer-bisect"><i class="codicon codicon-search"></i> Bisect</button>
          <button class="btn-icon" id="btn-drawer-revert"><i class="codicon codicon-history"></i> Revert</button>
          <button class="btn-icon" id="btn-drawer-create-tag"><i class="codicon codicon-tag"></i> Crear Tag</button>
        </div>

        <div>
          <div class="section-title">Mensaje del commit</div>
          <div class="commit-full-message">feat(responsive): complete responsive design and virtual DAG windowing engine</div>
        </div>

        <div>
          <div class="section-title">
            <span>Archivos Modificados</span>
            <span style="font-size:var(--font-size-xs); color:var(--accent-cyan);">3 archivos</span>
          </div>
          <div class="files-list">
            <div class="file-row">
              <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                <span class="file-status-badge status-modified">M</span>
                <span style="font-size:var(--font-size-sm); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">src/webview/style.css</span>
              </div>
              <span class="file-delta-badge plus">+42</span>
            </div>
            <div class="file-row">
              <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                <span class="file-status-badge status-modified">M</span>
                <span style="font-size:var(--font-size-sm); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">src/webview/main.ts</span>
              </div>
              <span class="file-delta-badge plus">+18</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildAiStudioHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { ${themeVariables[themeName]} }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0; padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow-y: auto; height: 100vh;
    }
  </style>
</head>
<body data-theme="${themeName}" class="vscode-${themeName}">
  <div class="ai-studio-container">
    <div class="ai-studio-header">
      <div class="ai-header-info">
        <div class="ai-header-title-row">
          <i class="codicon codicon-sparkle ai-sparkle-icon"></i>
          <h2>Conectar con tu IA</h2>
          <span class="mcp-status-pill active">
            <span class="status-indicator-dot"></span>
            <span>Activo en 127.0.0.1:47291</span>
          </span>
        </div>
        <p class="ai-header-subtitle">Genera claves de acceso seguras y conecta Claude Code, Antigravity o cualquier IA mediante MCP.</p>
      </div>
    </div>

    <div class="ai-generator-card">
      <div class="ai-card-title">
        <i class="codicon codicon-key"></i>
        <span>Generar Nueva Clave API</span>
      </div>

      <div class="ai-form-grid">
        <div class="form-group">
          <label>Nombre de la clave</label>
          <input type="text" class="ai-input" value="Claude Code Pair Programmer" />
        </div>

        <div class="form-group">
          <label>Permisos de acceso</label>
          <div class="ai-radio-group">
            <label class="ai-radio-label">
              <input type="radio" name="perm" checked />
              <span>Solo lectura (recomendado)</span>
            </label>
            <label class="ai-radio-label">
              <input type="radio" name="perm" />
              <span>Lectura y escritura</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Expiración</label>
          <select class="ai-select">
            <option>30 días</option>
            <option>90 días</option>
            <option>Sin caducidad</option>
          </select>
        </div>
      </div>

      <div class="ai-form-actions">
        <button id="btn-generate-ai-key" class="btn btn-primary"><i class="codicon codicon-add"></i> Generar Clave de IA</button>
      </div>
    </div>

    <div class="ai-key-reveal-banner">
      <div class="reveal-header">
        <i class="codicon codicon-warning"></i>
        <span>Copia tu clave ahora. Por motivos de seguridad, no volverá a mostrarse.</span>
      </div>
      <div class="reveal-key-row">
        <input type="text" class="ai-revealed-key-input" value="cf_live_9b4e7a82c31045f918e9d023b7498c1a" readonly />
        <button id="btn-copy-revealed-key" class="btn btn-secondary"><i class="codicon codicon-copy"></i> Copiar Clave</button>
      </div>
    </div>

    <div class="ai-client-snippets-card">
      <div class="snippets-header">
        <i class="codicon codicon-terminal"></i>
        <span>Comandos de Conexión Rápida</span>
      </div>

      <div class="snippet-subtabs">
        <button class="snippet-subtab-btn active"><i class="codicon codicon-terminal-bash"></i> Claude Code</button>
        <button class="snippet-subtab-btn"><i class="codicon codicon-gear"></i> Antigravity</button>
        <button class="snippet-subtab-btn"><i class="codicon codicon-json"></i> MCP Genérico</button>
        <button class="snippet-subtab-btn"><i class="codicon codicon-comment-discussion"></i> Prompt IA</button>
      </div>

      <div class="snippet-code-box" style="margin-top:8px;">
        <pre><code>claude mcp add --transport sse commitflow http://127.0.0.1:47291/sse?token=cf_live_9b4e7a82c31045f918e9d023b7498c1a</code></pre>
        <button class="btn-copy-snippet" aria-label="Copy snippet"><i class="codicon codicon-copy" aria-hidden="true"></i></button>
      </div>
    </div>

    <div class="ai-keys-table-card">
      <div class="keys-table-header">
        <i class="codicon codicon-list-selection"></i>
        <span>Claves API Generadas</span>
      </div>
      <div class="keys-table-responsive-wrapper">
        <table class="ai-keys-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Prefijo</th>
              <th>Permisos</th>
              <th>Creación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:600;">Antigravity Agent</td>
              <td><code>cf_live_9b4e...</code></td>
              <td><span class="badge badge-subtle">read</span></td>
              <td>Nov 1, 2026</td>
              <td><span class="key-status-badge active">Activa</span></td>
              <td><button class="btn-revoke-key">Revocar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const themes = ['dark', 'light', 'high-contrast', 'high-contrast-light'];

const viewports = [
  { name: 'nano-240px', width: 240, height: 700 },
  { name: 'sidebar-360px', width: 360, height: 750 },
  { name: 'compact-520px', width: 520, height: 800 },
  { name: 'wide-1100px', width: 1100, height: 800 },
];

const views = [
  { name: 'Graph View', builder: buildGraphHtml, checkA11yGraph: true },
  { name: 'AI Studio', builder: buildAiStudioHtml, checkA11yGraph: false },
  { name: 'Rebase Studio Modal', builder: buildRebaseStudioHtml, checkA11yGraph: false },
  { name: 'Commit Drawer', builder: buildCommitDrawerHtml, checkA11yGraph: false },
];

async function verifyResponsiveAndButtons() {
  console.log('=== CommitFlow Responsive & Button Interaction Verification ===\n');

  const profileDir = path.join(os.tmpdir(), 'commitflow_verify_cdp_' + Date.now());
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--user-data-dir=' + profileDir,
    'about:blank'
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch('http://127.0.0.1:9223/json/list');
      const data = await res.json();
      const page = data.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch(e) {}
  }

  if (!wsUrl) {
    edgeProc.kill();
    throw new Error('Could not connect to Edge DevTools Protocol on port 9223');
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const reqId = id++;
      callbacks.set(reqId, resolve);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  const tree = await send('Page.getFrameTree');
  const frameId = tree.frameTree.frame.id;

  let totalAudits = 0;
  let passedAudits = 0;
  let totalButtonsVerified = 0;

  for (const themeName of themes) {
    console.log(`\n==================== THEME: ${themeName} ====================`);
    for (const view of views) {
      console.log(`\n▶ Auditing View: ${view.name} [${themeName}]`);
      const html = view.builder(themeName);
      await send('Page.setDocumentContent', { frameId, html });

      for (const vp of viewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: false
        });

        await new Promise(r => setTimeout(r, 60));

        const evalRes = await send('Runtime.evaluate', {
          expression: `
            (function() {
              const results = {
                horizontalOverflows: [],
                overlappingElements: [],
                buttonsInfo: [],
                a11yErrors: [],
                themeBg: window.getComputedStyle(document.body).backgroundColor
              };

              // 1. Check for unintentional horizontal overflows
              const allElements = Array.from(document.querySelectorAll('*'));
              for (const el of allElements) {
                const cs = window.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
                const tag = el.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea') continue;
                if (cs.textOverflow === 'ellipsis') continue;
                if (cs.overflowX === 'hidden' && (cs.textOverflow === 'clip' || cs.textOverflow === 'ellipsis')) continue;
                if (el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0) {
                  const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 30) : '';
                  const id = el.id ? '#' + el.id : '';
                  results.horizontalOverflows.push({
                    selector: tag + id + (cls ? '.' + cls.split(' ').join('.') : ''),
                    clientWidth: el.clientWidth,
                    scrollWidth: el.scrollWidth
                  });
                }
              }

              // 2. Check all interactive buttons & controls + WCAG accessible name
              const buttons = Array.from(document.querySelectorAll('button, select, input[type="text"]'));
              for (const btn of buttons) {
                const rect = btn.getBoundingClientRect();
                const cs = window.getComputedStyle(btn);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;

                const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
                let isObscured = false;
                if (isVisible) {
                  const centerX = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
                  const centerY = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
                  const topEl = document.elementFromPoint(centerX, centerY);
                  if (topEl && !btn.contains(topEl) && !topEl.contains(btn)) {
                    isObscured = true;
                  }
                }

                const accessibleName = (
                  btn.getAttribute('aria-label') ||
                  btn.getAttribute('title') ||
                  btn.textContent ||
                  btn.value ||
                  ''
                ).trim();
                if (btn.tagName.toLowerCase() === 'button' && !accessibleName) {
                  results.a11yErrors.push('Button missing accessible name: #' + (btn.id || btn.className));
                }

                results.buttonsInfo.push({
                  tag: btn.tagName.toLowerCase(),
                  id: btn.id || '',
                  text: accessibleName.slice(0, 25),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  isVisible,
                  isObscured
                });
              }

              // 3. Collision/Overlap detection between direct siblings in flex/grid
              const containers = Array.from(document.querySelectorAll('.drawer-action-buttons, .bisect-actions, .issues-filter-pills, .snippet-subtabs, .modal-footer, .header-row-primary'));
              for (const container of containers) {
                const children = Array.from(container.children).filter(c => {
                  const s = window.getComputedStyle(c);
                  return s.display !== 'none' && s.visibility !== 'hidden';
                });
                for (let i = 0; i < children.length; i++) {
                  for (let j = i + 1; j < children.length; j++) {
                    const r1 = children[i].getBoundingClientRect();
                    const r2 = children[j].getBoundingClientRect();
                    if (r1.width === 0 || r2.width === 0) continue;
                    const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
                    const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
                    if (overlapX > 3 && overlapY > 3) {
                      results.overlappingElements.push({
                        container: container.className,
                        el1: children[i].tagName + (children[i].id ? '#' + children[i].id : ''),
                        el2: children[j].tagName + (children[j].id ? '#' + children[j].id : ''),
                        overlapX,
                        overlapY
                      });
                    }
                  }
                }
              }

              // 4. WCAG 2.1 AA Treegrid, Row ARIA labels & tabular-nums checks on Graph View
              if (${view.checkA11yGraph ? 'true' : 'false'}) {
                const treegrid = document.querySelector('[role="treegrid"]');
                if (!treegrid || !(treegrid.getAttribute('aria-label') || '').trim()) {
                  results.a11yErrors.push('Missing role="treegrid" with aria-label on graph container');
                }
                const rows = Array.from(document.querySelectorAll('.commit-row[role="row"]'));
                if (rows.length === 0) {
                  results.a11yErrors.push('Expected at least one .commit-row[role="row"]');
                } else {
                  for (const r of rows) {
                    if (!(r.getAttribute('aria-label') || '').trim()) {
                      results.a11yErrors.push('Commit row missing descriptive aria-label');
                    }
                    if (r.getAttribute('tabindex') === null) {
                      results.a11yErrors.push('Commit row missing focusable tabindex');
                    }
                  }
                }
                const monoNums = Array.from(document.querySelectorAll('.mono-num, .tabular-nums'));
                if (monoNums.length === 0) {
                  results.a11yErrors.push('Missing .mono-num / .tabular-nums numeric elements');
                } else {
                  for (const m of monoNums) {
                    const fvn = window.getComputedStyle(m).fontVariantNumeric || '';
                    if (!fvn.includes('tabular-nums')) {
                      results.a11yErrors.push('Numeric element missing tabular-nums font-variant-numeric: ' + fvn);
                    }
                  }
                }
              }

              return results;
            })()
          `,
          returnByValue: true
        });

        const res = evalRes.result.value;
        totalAudits++;

        const hasOverflows = res.horizontalOverflows.length > 0;
        const hasOverlaps = res.overlappingElements.length > 0;
        const hasA11yErrors = res.a11yErrors.length > 0;
        const obscuredButtons = res.buttonsInfo.filter(b => b.isVisible && b.isObscured);

        if (!hasOverflows && !hasOverlaps && !hasA11yErrors && obscuredButtons.length === 0) {
          passedAudits++;
          console.log(`  ✔ [PASS] ${themeName.padEnd(19)} | ${vp.name.padEnd(14)} (${vp.width}x${vp.height}) - ${res.buttonsInfo.length} controls, a11y OK, 0 overlaps, 0 overflows`);
        } else {
          console.log(`  ✖ [WARN] ${themeName} | ${vp.name} (${vp.width}x${vp.height}):`);
          if (hasOverflows) {
            console.log(`     Overflows:`, res.horizontalOverflows);
          }
          if (hasOverlaps) {
            console.log(`     Overlaps:`, res.overlappingElements);
          }
          if (hasA11yErrors) {
            console.log(`     A11y errors:`, res.a11yErrors);
          }
          if (obscuredButtons.length > 0) {
            console.log(`     Obscured buttons:`, obscuredButtons);
          }
        }

        totalButtonsVerified += res.buttonsInfo.length;
      }
    }
  }

  ws.close();
  edgeProc.kill();

  setTimeout(() => {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch(e) {}
  }, 1000);

  console.log(`\n======================================================`);
  console.log(`AUDIT RESULTS: ${passedAudits}/${totalAudits} audits passed with zero collisions.`);
  console.log(`TOTAL BUTTONS & CONTROLS VERIFIED: ${totalButtonsVerified}`);
  console.log(`======================================================\n`);

  if (passedAudits !== totalAudits) {
    throw new Error(`Some viewports have responsive or button layout issues`);
  }
}

verifyResponsiveAndButtons().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
