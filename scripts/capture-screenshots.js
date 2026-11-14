const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

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
};

function buildGraphHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      ${themeVariables[themeName]}
    }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      height: 100vh;
    }
  </style>
</head>
<body data-theme="${themeName}">
  <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
    <div class="nav-tab-bar">
      <button class="nav-tab-btn active"><i class="codicon codicon-git-branch"></i> <span>Grafo</span></button>
      <button class="nav-tab-btn"><i class="codicon codicon-history"></i> <span>Historial</span></button>
      <button class="nav-tab-btn"><i class="codicon codicon-issues"></i> <span>Issues</span> <span class="tab-badge">2</span></button>
      <button class="nav-tab-btn"><i class="codicon codicon-git-pull-request"></i> <span>PRs</span> <span class="tab-badge">1</span></button>
      <button class="nav-tab-btn"><i class="codicon codicon-repo-forked"></i> <span>Worktrees</span></button>
      <button class="nav-tab-btn"><i class="codicon codicon-sparkle"></i> <span>Conectar IA</span></button>
    </div>

    <div class="toolbar-controls" style="display:flex; gap:8px; padding:8px; border-bottom:1px solid var(--border-subtle);">
      <input type="text" class="search-input" value="feat(mcp)" style="flex:1;" />
      <button class="btn btn-secondary"><i class="codicon codicon-filter"></i> Ramas (main)</button>
      <button class="btn btn-secondary"><i class="codicon codicon-sync"></i> Fetch</button>
    </div>

    <div class="graph-table-container" style="flex:1; overflow:auto;">
      <table class="graph-table" style="width:100%; border-collapse:collapse;">
        <tbody>
          <tr class="graph-row active">
            <td style="width:70px; padding:8px;"><code style="color:var(--accent-cyan);">cf4821a</code></td>
            <td style="width:30px;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#00f0ff;"></span></td>
            <td style="padding:8px; font-weight:600;"><span class="branch-pill">main</span> feat(mcp): streamable HTTP and stdio authenticated server</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">Ignacio</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">Just now</td>
          </tr>
          <tr class="graph-row">
            <td style="padding:8px;"><code style="color:var(--accent-cyan);">ab8291f</code></td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#d946ef;"></span></td>
            <td style="padding:8px;"><span class="branch-pill" style="background:rgba(217,70,239,0.2);">dev</span> feat(ai): Connect with your AI studio and key generator</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">Ignacio</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">10m ago</td>
          </tr>
          <tr class="graph-row">
            <td style="padding:8px;"><code style="color:var(--accent-cyan);">98cd31a</code></td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e;"></span></td>
            <td style="padding:8px;">perf(virtual-scroll): dynamic translateY viewport for 100k commits</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">Ignacio</td>
            <td style="padding:8px; color:var(--text-muted); font-size:11px;">25m ago</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function buildAiStudioHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      ${themeVariables[themeName]}
    }
    ${cssCodicon}
    ${cssWebview}
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow-y: auto;
      height: 100vh;
    }
  </style>
</head>
<body data-theme="${themeName}">
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
        <button class="btn btn-primary"><i class="codicon codicon-add"></i> Generar Clave de IA</button>
      </div>
    </div>

    <div class="ai-key-reveal-banner">
      <div class="reveal-header">
        <i class="codicon codicon-warning"></i>
        <span>Copia tu clave ahora. Por motivos de seguridad, no volverá a mostrarse.</span>
      </div>
      <div class="reveal-key-row">
        <input type="text" class="ai-revealed-key-input" value="cf_live_9b4e7a82c31045f918e9d023b7498c1a" readonly />
        <button class="btn btn-secondary"><i class="codicon codicon-copy"></i> Copiar Clave</button>
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
        <button class="snippet-subtab-btn"><i class="codicon codicon-json"></i> Cliente MCP Genérico</button>
        <button class="snippet-subtab-btn"><i class="codicon codicon-comment-discussion"></i> Prompt para Chat IA</button>
      </div>

      <div class="snippet-code-box" style="margin-top:8px;">
        <pre><code>claude mcp add --transport sse commitflow http://127.0.0.1:47291/sse?token=cf_live_9b4e7a82c31045f918e9d023b7498c1a</code></pre>
        <button class="btn-copy-snippet"><i class="codicon codicon-copy"></i></button>
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
              <th>Fecha Creación</th>
              <th>Último Uso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:600;">Antigravity Agent</td>
              <td><code>cf_live_9b4e...</code></td>
              <td><span class="badge badge-subtle">read</span></td>
              <td>Nov 1, 2026, 12:45</td>
              <td>Just now</td>
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

function buildRebaseStudioHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
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
<body data-theme="${themeName}">
  <div id="rebase-studio-modal" class="modal-overlay open" style="opacity:1; pointer-events:auto; position:relative; width:100%; height:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center;">
    <div class="modal-card" style="width: min(850px, 100%); max-height: min(85vh, 750px); display: flex; flex-direction: column;">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="codicon codicon-git-pull-request-go-to-changes" style="font-size:16px; color:var(--accent-purple);"></i>
          <span style="font-weight:700; font-size:var(--font-size-base);">Interactive Rebase Studio</span>
        </div>
        <button class="btn-icon"><i class="codicon codicon-close"></i></button>
      </div>
      <div class="modal-body" style="overflow-y:auto; overflow-x:hidden; box-sizing:border-box; flex:1; display:flex; flex-direction:column; gap:12px; padding:12px;">
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <span>Reordena los commits arrastrando o usando los botones. Selecciona la acción para cada commit:</span>
          <span style="font-weight:600; color:var(--text-primary);">3 commits</span>
        </div>
        <div class="rebase-todo-list" style="display:flex; flex-direction:column; gap:6px;">
          <div class="rebase-todo-item">
            <i class="codicon codicon-grabber rebase-item-handle"></i>
            <select class="rebase-action-select"><option>pick</option><option>reword</option><option>edit</option><option>squash</option><option>drop</option></select>
            <span class="rebase-item-sha">f775f85</span>
            <span class="rebase-item-subject">feat(release): release v0.4.8 with universal responsive design</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm"><i class="codicon codicon-arrow-up"></i></button>
              <button class="btn-sm"><i class="codicon codicon-arrow-down"></i></button>
            </div>
          </div>
          <div class="rebase-todo-item action-squash">
            <i class="codicon codicon-grabber rebase-item-handle"></i>
            <select class="rebase-action-select"><option selected>squash</option><option>pick</option></select>
            <span class="rebase-item-sha">aa1779d</span>
            <span class="rebase-item-subject">fix(ui): close all popups, popovers and modals when clicking outside</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm"><i class="codicon codicon-arrow-up"></i></button>
              <button class="btn-sm"><i class="codicon codicon-arrow-down"></i></button>
            </div>
          </div>
          <div class="rebase-todo-item action-drop">
            <i class="codicon codicon-grabber rebase-item-handle"></i>
            <select class="rebase-action-select"><option selected>drop</option></select>
            <span class="rebase-item-sha">98cd31a</span>
            <span class="rebase-item-subject">chore: remove temporary debug logs</span>
            <span class="rebase-item-author">Ignacio</span>
            <div class="rebase-item-controls">
              <button class="btn-sm"><i class="codicon codicon-arrow-up"></i></button>
              <button class="btn-sm"><i class="codicon codicon-arrow-down"></i></button>
            </div>
          </div>
        </div>
        <div style="padding:8px 12px; border-radius:4px; font-size:var(--font-size-sm); background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3);">
          <i class="codicon codicon-pass"></i> Simulación previa completada: 0 conflictos de fusión detectados.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm"><i class="codicon codicon-eye"></i> Simular (Dry Run)</button>
        <div>
          <button class="btn-sm">Cancelar</button>
          <button class="btn-sm btn-primary"><i class="codicon codicon-check"></i> Iniciar Rebase</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildCommitDrawerHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
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
<body data-theme="${themeName}">
  <div class="commitflow-app" style="height:100vh; display:flex;">
    <div class="commit-drawer open" style="width:100%; display:flex; flex-direction:column; border-left:none;">
      <div class="drawer-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--border-subtle);">
        <span style="font-weight:600; font-size:var(--font-size-base);">Detalles del Commit</span>
        <button class="btn-icon"><i class="codicon codicon-close"></i></button>
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
          <button class="btn-icon"><i class="codicon codicon-copy"></i> Copiar SHA</button>
          <button class="btn-icon"><i class="codicon codicon-comment"></i> Copiar Mensaje</button>
          <button class="btn-icon"><i class="codicon codicon-diff"></i> Comparar con HEAD</button>
          <button class="btn-icon"><i class="codicon codicon-git-pull-request-go-to-changes"></i> Cherry-Pick</button>
          <button class="btn-icon"><i class="codicon codicon-search"></i> Bisect</button>
          <button class="btn-icon"><i class="codicon codicon-history"></i> Revert</button>
          <button class="btn-icon"><i class="codicon codicon-tag"></i> Crear Tag</button>
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

function buildIssuesHubHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
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
      height: 100vh; overflow-y: auto;
    }
  </style>
</head>
<body data-theme="${themeName}">
  <div class="issues-hub-container" style="padding:12px; display:flex; flex-direction:column; gap:12px;">
    <div class="issues-filters-bar">
      <div class="issues-filter-pills">
        <button class="issue-filter-pill active"><i class="codicon codicon-account"></i> <span>Asignadas a mí</span> <span class="pill-badge">2</span></button>
        <button class="issue-filter-pill"><i class="codicon codicon-git-branch"></i> <span>Vinculadas a rama</span> <span class="pill-badge">1</span></button>
        <button class="issue-filter-pill"><i class="codicon codicon-issues"></i> <span>Todas Abiertas</span> <span class="pill-badge">8</span></button>
      </div>
      <div class="issues-search-wrapper" style="margin-top:6px;">
        <i class="codicon codicon-search search-icon"></i>
        <input type="text" class="issues-search-input" placeholder="Buscar issues por título, número o etiqueta..." value="responsive" />
      </div>
    </div>

    <div class="issues-cards-list" style="display:flex; flex-direction:column; gap:8px;">
      <div class="issue-card" data-number="104">
        <div class="issue-card-top">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="issue-number">#104</span>
            <span class="issue-badge-state open">open</span>
            <span class="issue-tag-linked"><i class="codicon codicon-link"></i> Vinculado</span>
          </div>
          <div class="issue-card-actions">
            <button class="btn-icon" title="Crear rama"><i class="codicon codicon-git-branch"></i></button>
            <button class="btn-icon" title="Inspeccionar"><i class="codicon codicon-eye"></i></button>
          </div>
        </div>
        <div class="issue-card-title">Responsive UI overhaul for sidebars and auxiliary windows</div>
        <div class="issue-labels-wrap" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
          <span class="issue-label" style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:1px 6px; border-radius:10px; font-size:10px;">frontend</span>
          <span class="issue-label" style="background:rgba(217,70,239,0.2); color:#d946ef; border:1px solid rgba(217,70,239,0.4); padding:1px 6px; border-radius:10px; font-size:10px;">v0.4.8</span>
        </div>
        <div class="issue-card-footer">
          <div class="issue-author-info">
            <span class="author-name">Ignacio</span>
            <span class="relative-time">&bull; 3 comentarios</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildBisectViewHtml(themeName) {
  return `<!DOCTYPE html>
<html lang="es" class="vscode-${themeName === 'high-contrast' ? 'high-contrast' : themeName}">
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
      height: 100vh; overflow-y: auto;
    }
  </style>
</head>
<body data-theme="${themeName}">
  <div style="padding:8px; display:flex; flex-direction:column; gap:10px;">
    <div class="bisect-banner">
      <div class="bisect-banner-content" style="width:100%;">
        <div class="bisect-status-pill">
          <i class="codicon codicon-search"></i>
          <span class="bisect-badge-text">Git Bisect Activo</span>
        </div>
        <div class="bisect-info" style="font-size:12px; margin:4px 0;">
          Probando commit <code>e4a19b8</code> (~2 pasos restantes)
        </div>
        <div class="bisect-actions">
          <button class="btn-sm btn-bisect-good"><i class="codicon codicon-check"></i> Bueno (Good)</button>
          <button class="btn-sm btn-bisect-bad"><i class="codicon codicon-close"></i> Malo (Bad)</button>
          <button class="btn-sm"><i class="codicon codicon-debug-step-over"></i> Skip</button>
          <button class="btn-sm btn-bisect-abort"><i class="codicon codicon-debug-stop"></i> Abortar</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const themes = ['dark', 'light', 'high-contrast'];
const viewports = [
  { name: 'narrow-280px', width: 280, height: 750 },
  { name: 'sidebar-360px', width: 360, height: 750 },
  { name: 'medium-450px', width: 450, height: 800 },
  { name: 'split-750px', width: 750, height: 800 },
  { name: 'full-1200px', width: 1200, height: 800 },
];

const views = [
  { prefix: 'graph', builder: buildGraphHtml },
  { prefix: 'ai_studio', builder: buildAiStudioHtml },
  { prefix: 'rebase_studio', builder: buildRebaseStudioHtml },
  { prefix: 'commit_drawer', builder: buildCommitDrawerHtml },
  { prefix: 'issues_hub', builder: buildIssuesHubHtml },
  { prefix: 'bisect_view', builder: buildBisectViewHtml },
];

async function captureAll() {
  const profileDir = path.join(os.tmpdir(), 'commitflow_edge_cdp_' + Date.now());
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--user-data-dir=' + profileDir,
    'about:blank'
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
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
    throw new Error('Could not connect to Edge DevTools Protocol');
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
  const tree = await send('Page.getFrameTree');
  const frameId = tree.frameTree.frame.id;

  for (const theme of themes) {
    for (const view of views) {
      const html = view.builder(theme);
      await send('Page.setDocumentContent', { frameId, html });

      for (const vp of viewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: false
        });

        // Small pause for layout calculation and fonts
        await new Promise(r => setTimeout(r, 120));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const outImg = path.join(outDir, `${view.prefix}_${theme}_${vp.name}.png`);
        fs.writeFileSync(outImg, Buffer.from(shot.data, 'base64'));
        console.log(`Captured (CDP): ${view.prefix} for theme=${theme}, viewport=${vp.name} (${vp.width}x${vp.height})`);
      }
    }
  }

  ws.close();
  edgeProc.kill();

  setTimeout(() => {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch(e) {}
  }, 1000);

  console.log('All comprehensive screenshots captured successfully in docs/screenshots/');
}

captureAll().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
