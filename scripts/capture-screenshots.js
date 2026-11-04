const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

    <div class="ai-key-reveal-banner" style="display:flex;">
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

const themes = ['dark', 'light', 'high-contrast'];
const viewports = [
  { name: 'narrow-280px', width: 280, height: 750 },
  { name: 'medium-450px', width: 450, height: 800 },
  { name: 'full-1200px', width: 1200, height: 800 },
];

for (const theme of themes) {
  const graphHtml = buildGraphHtml(theme);
  const graphFile = path.join(outDir, `temp_graph_${theme}.html`);
  fs.writeFileSync(graphFile, graphHtml);

  const aiHtml = buildAiStudioHtml(theme);
  const aiFile = path.join(outDir, `temp_ai_${theme}.html`);
  fs.writeFileSync(aiFile, aiHtml);

  for (const vp of viewports) {
    const graphImg = path.join(outDir, `graph_${theme}_${vp.name}.png`);
    execFileSync(edgePath, [
      '--headless',
      '--disable-gpu',
      `--screenshot=${graphImg}`,
      `--window-size=${vp.width},${vp.height}`,
      `file://${graphFile}`,
    ]);

    const aiImg = path.join(outDir, `ai_studio_${theme}_${vp.name}.png`);
    execFileSync(edgePath, [
      '--headless',
      '--disable-gpu',
      `--screenshot=${aiImg}`,
      `--window-size=${vp.width},${vp.height}`,
      `file://${aiFile}`,
    ]);

    console.log(`Captured: graph & ai_studio for theme=${theme}, viewport=${vp.name}`);
  }

  fs.unlinkSync(graphFile);
  fs.unlinkSync(aiFile);
}

console.log('All screenshots captured successfully in docs/screenshots/');
