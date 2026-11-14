const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const cssWebviewRaw = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'webview.css'), 'utf8');
const cssWebview = cssWebviewRaw.replace(/@import\s+url\(['"]\.\/codicon\.css['"]\);?/g, '');

const codiconCssPath = path.resolve(__dirname, '..', 'dist', 'codicon.css');
const codiconTtfPath = path.resolve(__dirname, '..', 'dist', 'codicon.ttf');
const codiconBase64 = fs.existsSync(codiconTtfPath) ? fs.readFileSync(codiconTtfPath).toString('base64') : '';
const cssCodiconRaw = fs.existsSync(codiconCssPath) ? fs.readFileSync(codiconCssPath, 'utf8') : '';
const cssCodicon = codiconBase64
  ? cssCodiconRaw.replace(/url\(['"]?\.\/codicon\.ttf[^)]*['"]?\)/g, `url("data:font/ttf;base64,${codiconBase64}")`)
  : cssCodiconRaw;

const logoSvgPath = path.resolve(__dirname, '..', 'resources', 'commitflow-isotipo-color.svg');
const brandLogoDataUri = fs.existsSync(logoSvgPath)
  ? `data:image/svg+xml;base64,${fs.readFileSync(logoSvgPath).toString('base64')}`
  : '';

const themeVariables = {
  dark: `
    --vscode-editor-background: #0d1117;
    --vscode-editor-foreground: #e6edf3;
    --vscode-sideBar-background: #161b22;
    --vscode-sideBar-foreground: #e6edf3;
    --vscode-editorGroupHeader-tabsBackground: #1c2128;
    --vscode-input-background: #0d1117;
    --vscode-input-foreground: #e6edf3;
    --vscode-input-border: #30363d;
    --vscode-focusBorder: #38bdf8;
    --vscode-button-background: #0ea5e9;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0284c7;
    --vscode-button-secondaryBackground: #21262d;
    --vscode-button-secondaryForeground: #e6edf3;
    --vscode-errorForeground: #f87171;
    --vscode-testing-iconPassed: #34d399;
    --vscode-editorWarning-foreground: #fbbf24;
  `,
  light: `
    --vscode-editor-background: #ffffff;
    --vscode-editor-foreground: #24292f;
    --vscode-sideBar-background: #f6f8fa;
    --vscode-sideBar-foreground: #24292f;
    --vscode-editorGroupHeader-tabsBackground: #eaeef2;
    --vscode-input-background: #ffffff;
    --vscode-input-foreground: #24292f;
    --vscode-input-border: #d0d7de;
    --vscode-focusBorder: #0969da;
    --vscode-button-background: #0969da;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0860ca;
    --vscode-button-secondaryBackground: #eaeef2;
    --vscode-button-secondaryForeground: #24292f;
    --vscode-errorForeground: #cf222e;
    --vscode-testing-iconPassed: #1a7f37;
    --vscode-editorWarning-foreground: #9a6700;
  `,
  'high-contrast': `
    --vscode-editor-background: #000000;
    --vscode-editor-foreground: #ffffff;
    --vscode-sideBar-background: #000000;
    --vscode-sideBar-foreground: #ffffff;
    --vscode-editorGroupHeader-tabsBackground: #0a0a0a;
    --vscode-input-background: #000000;
    --vscode-input-foreground: #ffffff;
    --vscode-input-border: #6fc3df;
    --vscode-widget-border: #6fc3df;
    --vscode-focusBorder: #f38518;
    --vscode-contrastBorder: #6fc3df;
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

function avatarSvg(initials, bgHex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="19" fill="${bgHex}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="14" font-weight="700" font-family="Segoe UI, sans-serif">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const AVATAR_IB = avatarSvg('IB', '#0284c7');
const AVATAR_AL = avatarSvg('AL', '#7c3aed');
const AVATAR_MC = avatarSvg('MC', '#059669');
const AVATAR_AI = avatarSvg('CF', '#d97706');

function getBodyClass(themeName, vp) {
  const cls = [`vscode-${themeName}`];
  if (themeName === 'light') cls.push('theme-light');
  if (vp && vp.width <= 380) cls.push('layout-sidebar-compact');
  return cls.join(' ');
}

function wrapHtml({ themeName, vp, bodyStyle = '', content }) {
  const hcOverrides = themeName === 'high-contrast' ? `
    body.vscode-high-contrast .btn-primary,
    body.vscode-high-contrast .btn-sm.btn-primary,
    body.vscode-high-contrast .cf-btn-primary {
      background: #000000 !important;
      color: #ffffff !important;
      border: 1px solid #6fc3df !important;
      box-shadow: none !important;
    }
    body.vscode-high-contrast .dag-advanced-filters-bar,
    body.vscode-high-contrast .stats-bar,
    body.vscode-high-contrast .header-bar,
    body.vscode-high-contrast .commit-drawer,
    body.vscode-high-contrast .ai-generator-card,
    body.vscode-high-contrast .ai-client-snippets-card,
    body.vscode-high-contrast .ai-keys-table-card,
    body.vscode-high-contrast .issue-card,
    body.vscode-high-contrast .conflict-file-card,
    body.vscode-high-contrast .rebase-todo-item,
    body.vscode-high-contrast .modal-card,
    body.vscode-high-contrast .modal-content {
      border-color: #6fc3df !important;
    }
  ` : '';

  return `<!DOCTYPE html>
<html lang="en" class="vscode-${themeName}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { ${themeVariables[themeName]} }
    ${cssCodicon}
    ${cssWebview}
    ${hcOverrides}
    body {
      margin: 0;
      padding: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--vscode-font-family);
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      ${bodyStyle}
    }
    .showcase-overlay-chrome {
      position: relative;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  </style>
</head>
<body data-theme="${themeName}" class="${getBodyClass(themeName, vp)}">
  ${content}
</body>
</html>`;
}

function buildHeaderHtml(activeTab, vp, searchText = '') {
  const isCompact = vp && vp.width <= 420;
  const tabs = [
    { id: 'graph', icon: 'codicon-git-branch', label: 'Graph', badge: '' },
    { id: 'history', icon: 'codicon-history', label: 'History', badge: '' },
    { id: 'issues', icon: 'codicon-issues', label: 'Issues', badge: '6' },
    { id: 'prs', icon: 'codicon-git-pull-request', label: 'PRs', badge: '3' },
    { id: 'worktrees', icon: 'codicon-repo-forked', label: 'Worktrees', badge: '2' },
    { id: 'patches', icon: 'codicon-cloud-upload', label: 'Patches', badge: '' },
    { id: 'ai', icon: 'codicon-sparkle', label: 'AI Studio', badge: '' },
  ];

  const tabHtml = tabs.map((t) => {
    const isActive = t.id === activeTab ? ' active' : '';
    const badgeHtml = t.badge ? `<span class="tab-badge">${t.badge}</span>` : '';
    return `<button class="nav-tab-btn${isActive}"><i class="codicon ${t.icon}"></i>${isCompact ? '' : `<span>${t.label}</span>`}${badgeHtml}</button>`;
  }).join('\n      ');

  return `
  <div class="header-bar" id="header-bar">
    <div class="header-row-primary">
      <div class="brand-section">
        ${brandLogoDataUri ? `<img src="${brandLogoDataUri}" alt="CommitFlow" class="brand-logo" />` : '<i class="codicon codicon-git-branch" style="color:var(--accent-cyan);"></i>'}
        <span class="brand-title">CommitFlow</span>
      </div>
      <div class="active-branch-badge">
        <div class="branch-pulse-dot"></div>
        <span class="branch-name">main</span>
      </div>
      <div class="header-quick-actions">
        <button class="btn-icon" title="Layout Mode"><i class="codicon codicon-layout"></i></button>
        <button class="btn-icon" title="Theme Picker"><i class="codicon codicon-symbol-color"></i></button>
        ${isCompact ? '' : '<button class="btn-icon" title="Reflog Time Machine"><i class="codicon codicon-history"></i></button>'}
        ${isCompact ? '' : '<button class="btn-icon" title="Git Bisect"><i class="codicon codicon-search"></i></button>'}
        <button class="btn-icon" title="Refresh Graph"><i class="codicon codicon-refresh"></i></button>
        <button class="btn-icon" title="Settings"><i class="codicon codicon-settings-gear"></i></button>
      </div>
    </div>
    <div class="nav-tab-bar" id="nav-tab-bar">
      ${tabHtml}
    </div>
    <div class="toolbar-controls" id="toolbar-controls">
      ${isCompact ? '' : '<select class="branch-select repo-select"><option>CommitFlow (v1.0.0)</option></select>'}
      <div class="search-input-wrapper">
        <span class="search-icon"><i class="codicon codicon-search"></i></span>
        <input type="text" class="search-input" placeholder="Search commits, SHAs, authors..." value="${searchText}" />
      </div>
      <select class="branch-select"><option>All Branches</option></select>
      <button class="btn-icon" title="Conventional Commit Builder"><i class="codicon codicon-git-commit"></i></button>
    </div>
  </div>`;
}

function buildStatsBarHtml(vp) {
  const isCompact = vp && vp.width <= 420;
  return `
  <div id="stats-bar" class="stats-bar">
    <div class="stat-item"><i class="codicon codicon-git-commit stat-icon"></i><span class="stat-value">1,428</span><span>commits</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><i class="codicon codicon-git-branch stat-icon"></i><span class="stat-value">8</span><span>branches</span></div>
    ${isCompact ? '' : '<div class="stat-divider"></div><div class="stat-item"><i class="codicon codicon-organization stat-icon"></i><span class="stat-value">6</span><span>authors</span></div>'}
    ${isCompact ? '' : '<div class="stat-divider"></div><div class="stat-item"><i class="codicon codicon-tag stat-icon"></i><span class="stat-value">v1.0.0</span></div>'}
    ${isCompact ? '' : '<div class="stat-divider"></div><span class="badge-offline" title="Zero-latency direct .git binary engine">Offline .git Engine</span>'}
    ${isCompact ? '' : `<div class="top-contributors-row" style="margin-left:auto; display:flex; align-items:center; gap:3px;">
      <img src="${AVATAR_IB}" class="contributor-mini-avatar" style="width:16px;height:16px;border-radius:50%;" />
      <img src="${AVATAR_AL}" class="contributor-mini-avatar" style="width:16px;height:16px;border-radius:50%;" />
      <img src="${AVATAR_MC}" class="contributor-mini-avatar" style="width:16px;height:16px;border-radius:50%;" />
    </div>`}
  </div>`;
}

function laneSvgCell({ lane, lanesCount, rowH = 30, nodes = [], paths = [], isHead = false, isMerge = false }) {
  const colW = 16;
  const width = Math.max(lanesCount * colW + 10, 44);
  const cx = lane * colW + 14;
  const cy = rowH / 2;
  const palette = ['var(--accent-cyan)', 'var(--accent-violet)', 'var(--accent-emerald)', 'var(--accent-amber)'];
  const color = palette[lane % palette.length];

  const linesSvg = paths.map((p) => {
    const c = palette[p.colorIdx % palette.length];
    return `<path d="${p.d}" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" opacity="${p.opacity || 0.9}" />`;
  }).join('');

  const railSvg = nodes.map((idx) => {
    const x = idx * colW + 14;
    return `<line x1="${x}" y1="0" x2="${x}" y2="${rowH}" stroke="${palette[idx % palette.length]}" stroke-width="2" opacity="0.72" />`;
  }).join('');

  const nodeSvg = isHead
    ? `<circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.55" />
       <circle cx="${cx}" cy="${cy}" r="4.5" fill="${color}" stroke="var(--bg-primary)" stroke-width="1.5" />`
    : isMerge
      ? `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--bg-primary)" stroke="${color}" stroke-width="2.2" />`
      : `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}" stroke="var(--bg-primary)" stroke-width="1.5" />`;

  return `<div class="graph-canvas-col" style="width:${width}px; height:${rowH}px;">
    <svg width="${width}" height="${rowH}" viewBox="0 0 ${width} ${rowH}" style="display:block;">
      ${railSvg}
      ${linesSvg}
      ${nodeSvg}
    </svg>
  </div>`;
}

function buildGraphRowsHtml(isCompact) {
  const rows = [
    {
      sha: '958f543',
      subject: 'release(v1.0.0): enterprise edition with MCP 2.0 & QA pyramid',
      author: 'Ignacio B.',
      avatar: AVATAR_IB,
      time: 'Just now',
      selected: true,
      gpg: true,
      refs: [
        { cls: 'head', icon: 'codicon-target', label: 'HEAD -> main' },
        { cls: 'tag', icon: 'codicon-tag', label: 'v1.0.0' },
        { cls: 'branch', icon: 'codicon-git-branch', label: 'staging' },
      ],
      svg: { lane: 0, lanesCount: 4, isHead: true, isMerge: true, paths: [
        { colorIdx: 0, d: 'M 14 15 L 14 30' },
        { colorIdx: 1, d: 'M 14 15 C 22 15, 30 22, 30 30' },
      ] },
    },
    {
      sha: 'd2183ab',
      subject: 'test(qa): add seeded fuzzing, Playwright E2E, WCAG AA & 50k layout benchmark',
      author: 'Ignacio B.',
      avatar: AVATAR_IB,
      time: '12m ago',
      gpg: true,
      refs: [{ cls: 'branch', icon: 'codicon-git-branch', label: 'test/18-qa-pyramid' }],
      svg: { lane: 1, lanesCount: 4, nodes: [0], paths: [
        { colorIdx: 1, d: 'M 30 0 L 30 30' },
      ] },
    },
    {
      sha: 'a44c91e',
      subject: 'feat(conflict-studio): add 3-way visual conflict resolution & Conventional Commits',
      author: 'Ana Lopez',
      avatar: AVATAR_AL,
      time: '48m ago',
      gpg: true,
      refs: [{ cls: 'branch', icon: 'codicon-git-branch', label: 'feat/14-conflict-studio' }],
      svg: { lane: 1, lanesCount: 4, nodes: [0], paths: [
        { colorIdx: 1, d: 'M 30 0 L 30 15' },
        { colorIdx: 1, d: 'M 30 15 C 30 24, 14 22, 14 30' },
      ] },
    },
    {
      sha: '719f20c',
      subject: 'perf(engine): packfile worker cache & zero-OOM 50k commit topology',
      author: 'Marco Cruz',
      avatar: AVATAR_MC,
      time: '2h ago',
      gpg: true,
      refs: [{ cls: 'branch', icon: 'codicon-git-branch', label: 'perf/10-50k-dag' }],
      svg: { lane: 2, lanesCount: 4, nodes: [0], paths: [
        { colorIdx: 2, d: 'M 46 15 C 32 15, 14 6, 14 0' },
        { colorIdx: 2, d: 'M 46 15 L 46 30' },
      ] },
    },
    {
      sha: 'e8b32d0',
      subject: 'feat(mcp): add streamable HTTP/SSE OAuth-scoped tools & audit stream',
      author: 'Ignacio B.',
      avatar: AVATAR_IB,
      time: '3h ago',
      gpg: true,
      refs: [{ cls: 'branch', icon: 'codicon-sparkle', label: 'feat/17-mcp-v2' }],
      svg: { lane: 0, lanesCount: 4, nodes: [2], paths: [
        { colorIdx: 0, d: 'M 14 0 L 14 30' },
      ] },
    },
    {
      sha: '3c19a7b',
      subject: 'design(ui): native VS Code tokens, minimap overlay & 4 responsive docks',
      author: 'Ana Lopez',
      avatar: AVATAR_AL,
      time: '5h ago',
      gpg: false,
      refs: [],
      svg: { lane: 2, lanesCount: 4, nodes: [0], paths: [
        { colorIdx: 2, d: 'M 46 0 L 46 15' },
        { colorIdx: 2, d: 'M 46 15 C 46 24, 14 22, 14 30' },
      ] },
    },
    {
      sha: '5f01b42',
      subject: 'fix(bisect): highlight active probe node and estimated remaining binary steps',
      author: 'CommitFlow CI',
      avatar: AVATAR_AI,
      time: '1d ago',
      gpg: true,
      refs: [{ cls: 'branch', icon: 'codicon-flame', label: 'hotfix/bisect-ring' }],
      svg: { lane: 3, lanesCount: 4, nodes: [0], paths: [
        { colorIdx: 3, d: 'M 62 15 C 44 15, 14 6, 14 0' },
        { colorIdx: 3, d: 'M 62 15 C 62 24, 14 24, 14 30' },
      ] },
    },
    {
      sha: 'f775f85',
      subject: 'feat(release): v0.4.8 universal adaptive sidebar & issue tracker hub',
      author: 'Ignacio B.',
      avatar: AVATAR_IB,
      time: '2d ago',
      gpg: true,
      refs: [{ cls: 'tag', icon: 'codicon-tag', label: 'v0.4.8' }],
      svg: { lane: 0, lanesCount: 4, paths: [
        { colorIdx: 0, d: 'M 14 0 L 14 30' },
      ] },
    },
  ];

  return rows.map((r) => {
    const refPills = r.refs.map((ref) => `<span class="ref-pill ${ref.cls}"><i class="codicon ${ref.icon}" style="font-size:10px;"></i> ${ref.label}</span>`).join('');
    const gpgBadge = r.gpg
      ? '<span class="commit-sig-badge sig-valid" title="GPG Signature Verified" style="display:inline-flex;align-items:center;gap:2px;font-size:10px;padding:0 5px;border-radius:999px;background:rgba(16,185,129,0.14);color:var(--accent-emerald);border:1px solid rgba(16,185,129,0.35);"><i class="codicon codicon-verified" style="font-size:10px;"></i> GPG</span>'
      : '';
    const graphCol = laneSvgCell({ ...r.svg, rowH: isCompact ? 42 : 30 });

    if (isCompact) {
      return `
      <div class="commit-row compact-card${r.selected ? ' selected' : ''}">
        ${graphCol}
        <div class="commit-card-body">
          <div class="commit-card-top">
            ${refPills}
            <span class="commit-subject">${r.subject}</span>
          </div>
          <div class="commit-card-bottom">
            <img src="${r.avatar}" class="card-author-avatar" />
            <span class="card-author-name">${r.author}</span>
            <span class="card-meta-dot">•</span>
            <span class="card-time">${r.time}</span>
            <span class="card-hash" style="margin-left:auto;">${r.sha}</span>
          </div>
        </div>
      </div>`;
    }

    return `
    <div class="commit-row${r.selected ? ' selected' : ''}">
      ${graphCol}
      <div class="commit-info-col">
        ${refPills}
        <span class="commit-subject">${r.subject}</span>
        ${gpgBadge}
      </div>
      <div class="commit-author-col">
        <img src="${r.avatar}" class="author-avatar" />
        <span class="author-name">${r.author}</span>
      </div>
      <div class="commit-meta-col">
        <span>${r.time}</span>
        <span class="commit-hash-badge">${r.sha}</span>
      </div>
    </div>`;
  }).join('');
}

function buildSplitInspectorHtml(widthPx) {
  return `
  <aside class="commit-drawer open" style="position:relative; inset:auto; transform:none; width:${widthPx}px; min-width:${widthPx}px; height:100%; display:flex; flex-direction:column; border-left:1px solid var(--border-subtle); box-shadow:none;">
    <div class="drawer-header" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border-subtle);">
      <span style="font-weight:600; font-size:var(--font-size-base); display:flex; align-items:center; gap:6px;">
        <i class="codicon codicon-git-commit" style="color:var(--accent-cyan);"></i>
        Commit Inspector
      </span>
      <span class="commit-hash-badge">958f543</span>
    </div>
    <div class="drawer-body" style="padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
      <div class="author-hero-card">
        <img class="author-hero-avatar" src="${AVATAR_IB}" />
        <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
          <span style="font-weight:600; font-size:var(--font-size-base);">Ignacio Breñas</span>
          <span style="color:var(--text-muted); font-size:var(--font-size-xs);">ignaciobrenas@github</span>
          <div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap;">
            <span style="font-size:10px; padding:1px 6px; border-radius:999px; background:rgba(16,185,129,0.14); color:var(--accent-emerald); border:1px solid rgba(16,185,129,0.35);">
              <i class="codicon codicon-verified" style="font-size:10px;"></i> GPG Signed
            </span>
            <span style="font-size:10px; padding:1px 6px; border-radius:999px; background:rgba(56,189,248,0.14); color:var(--accent-cyan); border:1px solid rgba(56,189,248,0.35);">
              <i class="codicon codicon-shield" style="font-size:10px;"></i> Low Risk 12/100
            </span>
          </div>
        </div>
      </div>

      <div class="drawer-action-buttons">
        <button class="btn-icon"><i class="codicon codicon-copy"></i> SHA</button>
        <button class="btn-icon"><i class="codicon codicon-diff"></i> Diff</button>
        <button class="btn-icon"><i class="codicon codicon-git-pull-request-go-to-changes"></i> Cherry-Pick</button>
        <button class="btn-icon"><i class="codicon codicon-history"></i> Revert</button>
        <button class="btn-icon"><i class="codicon codicon-tag"></i> Tag</button>
      </div>

      <div>
        <div class="section-title">Commit Message</div>
        <div class="commit-full-message">release(v1.0.0): enterprise edition with MCP 2.0 &amp; QA pyramid

- Direct .git packfile reader &amp; 50k layout engine
- 3-Way Conflict Resolution Studio &amp; Commit Builder
- Authenticated HTTP/SSE &amp; stdio MCP v2 server</div>
      </div>

      <div>
        <div class="section-title" style="display:flex; justify-content:space-between;">
          <span>Changed Files</span>
          <span style="font-size:var(--font-size-xs); color:var(--accent-cyan);">4 files &bull; +318 / -44</span>
        </div>
        <div class="files-list">
          <div class="file-row">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              <span class="file-status-badge status-modified">M</span>
              <span style="font-size:var(--font-size-sm); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">src/graph/graphLayout.ts</span>
            </div>
            <span class="file-delta-badge plus">+142 -18</span>
          </div>
          <div class="file-row">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              <span class="file-status-badge status-added">A</span>
              <span style="font-size:var(--font-size-sm); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">src/conflict/conflictStudio.ts</span>
            </div>
            <span class="file-delta-badge plus">+118</span>
          </div>
          <div class="file-row">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              <span class="file-status-badge status-modified">M</span>
              <span style="font-size:var(--font-size-sm); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">src/webview/style.css</span>
            </div>
            <span class="file-delta-badge plus">+58 -26</span>
          </div>
        </div>
      </div>
    </div>
  </aside>`;
}

function buildMinimapSvgHtml() {
  return `
  <aside id="dag-minimap-container" class="dag-minimap-container" aria-label="DAG Branch Minimap" style="padding:6px 4px;">
    <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); text-align:center; margin-bottom:4px;">Minimap</div>
    <svg width="68" height="360" viewBox="0 0 68 360" style="display:block; width:100%; height:100%;">
      <rect x="3" y="4" width="62" height="120" rx="4" fill="rgba(56, 189, 248, 0.1)" stroke="var(--accent-cyan)" stroke-width="1" stroke-dasharray="3 2" />
      <line x1="18" y1="8" x2="18" y2="350" stroke="var(--accent-cyan)" stroke-width="2" />
      <path d="M 18 16 C 32 16, 32 46, 32 60 L 32 140 C 32 160, 18 170, 18 190" stroke="var(--accent-violet)" stroke-width="1.8" fill="none" />
      <path d="M 18 85 C 46 85, 46 105, 46 125 L 46 230 C 46 250, 18 260, 18 280" stroke="var(--accent-emerald)" stroke-width="1.8" fill="none" />
      <path d="M 18 175 C 58 175, 58 195, 58 210 L 58 245 C 58 260, 18 270, 18 290" stroke="var(--accent-amber)" stroke-width="1.6" fill="none" />
      <circle cx="18" cy="16" r="4" fill="var(--accent-cyan)" />
      <circle cx="32" cy="52" r="3" fill="var(--accent-violet)" />
      <circle cx="46" cy="116" r="3" fill="var(--accent-emerald)" />
      <circle cx="18" cy="190" r="3.5" fill="var(--accent-cyan)" />
      <circle cx="58" cy="212" r="3" fill="var(--accent-amber)" />
      <circle cx="18" cy="285" r="3.5" fill="var(--accent-cyan)" />
    </svg>
  </aside>`;
}

function buildGraphHtml(themeName, vp) {
  const isCompact = vp.width <= 420;
  const showSplitDrawer = vp.width >= 750;
  const showMinimap = vp.width >= 960;
  const useCompactRows = isCompact || (showSplitDrawer && vp.width < 960);

  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('graph', vp, '')}
      ${buildStatsBarHtml(vp)}
      <div id="dag-advanced-filters-bar" class="dag-advanced-filters-bar">
        <button class="cf-btn cf-btn-ghost filter-toggle-pill active"><i class="codicon codicon-git-commit"></i> --first-parent</button>
        <button class="cf-btn cf-btn-ghost filter-toggle-pill"><i class="codicon codicon-eye-closed"></i> Hide Remotes</button>
        ${isCompact ? '' : '<input type="text" class="search-input dag-filter-path" value="src/" placeholder="Path (e.g. src/)" />'}
        <div class="dag-jump-group">
          <button class="cf-btn cf-btn-secondary"><i class="codicon codicon-target"></i> HEAD</button>
        </div>
      </div>
      <div class="dag-workspace-row" style="flex:1; min-height:0;">
        <div id="graph-table-container" class="graph-table-container" style="flex:1; min-width:0; overflow-y:auto;">
          ${buildGraphRowsHtml(useCompactRows)}
        </div>
        ${showMinimap ? buildMinimapSvgHtml() : ''}
        ${showSplitDrawer ? buildSplitInspectorHtml(vp.width >= 1000 ? 390 : 320) : ''}
      </div>
    </div>`,
  });
}

function buildAiStudioHtml(themeName, vp) {
  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('ai', vp, '')}
      <div class="ai-studio-container" style="flex:1; overflow-y:auto;">
        <div class="ai-studio-header">
          <div class="ai-header-info">
            <div class="ai-header-title-row">
              <i class="codicon codicon-sparkle ai-sparkle-icon"></i>
              <h2>AI Studio &amp; MCP 2.0 Server</h2>
              <span class="mcp-status-pill active">
                <span class="status-indicator-dot"></span>
                <span>Running &bull; 127.0.0.1:47291 &bull; 14 Tools &bull; 4 Resources</span>
              </span>
            </div>
            <p class="ai-header-subtitle">Generate scoped bearer tokens and connect Claude Code, Cursor, Antigravity, or VS Code Copilot via HTTP/SSE or stdio.</p>
          </div>
        </div>

        <div class="ai-generator-card">
          <div class="ai-card-title">
            <i class="codicon codicon-key"></i>
            <span>Generate Scoped API Key</span>
          </div>
          <div class="ai-form-grid">
            <div class="form-group">
              <label>Key Label</label>
              <input type="text" class="ai-input" value="Claude Code Pair Programmer" />
            </div>
            <div class="form-group">
              <label>Access Scope</label>
              <div class="ai-radio-group">
                <label class="ai-radio-label"><input type="radio" name="perm" checked /><span>Read-Only (Safe Default)</span></label>
                <label class="ai-radio-label"><input type="radio" name="perm" /><span>Read + Write (Stage, Commit, Checkout)</span></label>
              </div>
            </div>
            <div class="form-group">
              <label>Expiration</label>
              <select class="ai-select"><option>30 days</option><option>90 days</option><option>No expiration</option></select>
            </div>
          </div>
          <div class="ai-form-actions">
            <button class="btn btn-primary"><i class="codicon codicon-add"></i> Generate AI Key</button>
          </div>
        </div>

        <div class="ai-key-reveal-banner">
          <div class="reveal-header">
            <i class="codicon codicon-shield"></i>
            <span>One-time key reveal &mdash; copy now. Stored locally via SHA-256 salted hash.</span>
          </div>
          <div class="reveal-key-row">
            <input type="text" class="ai-revealed-key-input" value="cf_live_9b4e7a82c31045f918e9d023b7498c1a" readonly />
            <button class="btn btn-secondary"><i class="codicon codicon-copy"></i> Copy Key</button>
          </div>
        </div>

        <div class="ai-client-snippets-card">
          <div class="snippets-header">
            <i class="codicon codicon-terminal"></i>
            <span>1-Click Agent Integration</span>
          </div>
          <div class="snippet-subtabs">
            <button class="snippet-subtab-btn active"><i class="codicon codicon-terminal-bash"></i> Claude Code</button>
            <button class="snippet-subtab-btn"><i class="codicon codicon-gear"></i> Antigravity</button>
            <button class="snippet-subtab-btn"><i class="codicon codicon-code"></i> VS Code / Cursor</button>
            <button class="snippet-subtab-btn"><i class="codicon codicon-json"></i> Generic MCP JSON</button>
          </div>
          <div class="snippet-code-box" style="margin-top:4px;">
            <pre><code>claude mcp add --transport sse commitflow http://127.0.0.1:47291/sse?token=cf_live_9b4e7a82c31045f918e9d023b7498c1a</code></pre>
            <button class="btn-copy-snippet" title="Copy snippet"><i class="codicon codicon-copy"></i></button>
          </div>
        </div>

        <div class="ai-keys-table-card">
          <div class="keys-table-header">
            <i class="codicon codicon-list-selection"></i>
            <span>Active API Keys &amp; Audit Trail</span>
          </div>
          <div class="keys-table-responsive-wrapper">
            <table class="ai-keys-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Scope</th>
                  <th>Last Tool Call</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:600;">Antigravity Pair Agent</td>
                  <td><code>cf_live_9b4e...</code></td>
                  <td><span class="badge badge-subtle">read</span></td>
                  <td><code>get_commit_history</code> (4ms)</td>
                  <td><span class="key-status-badge active">Active</span></td>
                  <td><button class="btn-revoke-key"><i class="codicon codicon-trash"></i> Revoke</button></td>
                </tr>
                <tr>
                  <td style="font-weight:600;">CI Release Automation</td>
                  <td><code>cf_live_31c8...</code></td>
                  <td><span class="badge badge-subtle">read-write</span></td>
                  <td><code>stage_and_commit</code> (19ms)</td>
                  <td><span class="key-status-badge active">Active</span></td>
                  <td><button class="btn-revoke-key"><i class="codicon codicon-trash"></i> Revoke</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`,
  });
}

function buildRebaseStudioHtml(themeName, vp) {
  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="showcase-overlay-chrome">
      ${buildHeaderHtml('graph', vp, '')}
      ${buildStatsBarHtml(vp)}
      <div style="flex:1; opacity:0.35; pointer-events:none; overflow:hidden;">
        ${buildGraphRowsHtml(false)}
      </div>
      <div id="rebase-studio-modal" class="modal-overlay open" style="opacity:1; pointer-events:auto; position:absolute; inset:0; background:rgba(0,0,0,0.62); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="modal-card" style="width: min(860px, 100%); max-height: min(88vh, 690px); display: flex; flex-direction: column;">
          <div class="modal-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="codicon codicon-git-pull-request-go-to-changes" style="font-size:16px; color:var(--accent-violet);"></i>
              <span style="font-weight:700; font-size:var(--font-size-base);">Interactive Rebase Studio &mdash; <code>staging &rarr; main</code></span>
            </div>
            <button class="btn-icon"><i class="codicon codicon-close"></i></button>
          </div>
          <div class="modal-body" style="overflow-y:auto; overflow-x:hidden; flex:1; display:flex; flex-direction:column; gap:12px; padding:14px;">
            <div style="font-size:var(--font-size-sm); color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <span>Drag rows to reorder history or assign per-commit rebase actions before pre-flight simulation:</span>
              <span style="font-weight:600; color:var(--accent-cyan);">4 commits in plan</span>
            </div>
            <div class="rebase-todo-list" style="display:flex; flex-direction:column; gap:7px;">
              <div class="rebase-todo-item">
                <i class="codicon codicon-grabber rebase-item-handle"></i>
                <select class="rebase-action-select"><option selected>pick</option><option>reword</option><option>squash</option><option>drop</option></select>
                <span class="rebase-item-sha">d2183ab</span>
                <span class="rebase-item-subject">test(qa): add seeded fuzzing, Playwright E2E &amp; 50k DAG layout benchmark</span>
                <span class="rebase-item-author">Ignacio B.</span>
                <div class="rebase-item-controls">
                  <button class="btn-sm" title="Move up"><i class="codicon codicon-arrow-up"></i></button>
                  <button class="btn-sm" title="Move down"><i class="codicon codicon-arrow-down"></i></button>
                </div>
              </div>
              <div class="rebase-todo-item action-squash">
                <i class="codicon codicon-grabber rebase-item-handle"></i>
                <select class="rebase-action-select"><option selected>squash</option><option>pick</option></select>
                <span class="rebase-item-sha">aa1779d</span>
                <span class="rebase-item-subject">fix(ui): clamp responsive popovers and right-edge action controls</span>
                <span class="rebase-item-author">Ignacio B.</span>
                <div class="rebase-item-controls">
                  <button class="btn-sm" title="Move up"><i class="codicon codicon-arrow-up"></i></button>
                  <button class="btn-sm" title="Move down"><i class="codicon codicon-arrow-down"></i></button>
                </div>
              </div>
              <div class="rebase-todo-item">
                <i class="codicon codicon-grabber rebase-item-handle"></i>
                <select class="rebase-action-select"><option>pick</option><option selected>reword</option><option>squash</option></select>
                <span class="rebase-item-sha">a44c91e</span>
                <span class="rebase-item-subject">feat(conflict-studio): add 3-way conflict resolver and SemVer builder</span>
                <span class="rebase-item-author">Ana Lopez</span>
                <div class="rebase-item-controls">
                  <button class="btn-sm" title="Move up"><i class="codicon codicon-arrow-up"></i></button>
                  <button class="btn-sm" title="Move down"><i class="codicon codicon-arrow-down"></i></button>
                </div>
              </div>
              <div class="rebase-todo-item action-drop">
                <i class="codicon codicon-grabber rebase-item-handle"></i>
                <select class="rebase-action-select"><option selected>drop</option></select>
                <span class="rebase-item-sha">98cd31a</span>
                <span class="rebase-item-subject">chore: remove temporary local debug instrumentation</span>
                <span class="rebase-item-author">Ignacio B.</span>
                <div class="rebase-item-controls">
                  <button class="btn-sm" title="Move up"><i class="codicon codicon-arrow-up"></i></button>
                  <button class="btn-sm" title="Move down"><i class="codicon codicon-arrow-down"></i></button>
                </div>
              </div>
            </div>
            <div style="padding:10px 12px; border-radius:6px; font-size:var(--font-size-sm); background:rgba(16, 185, 129, 0.14); color:var(--accent-emerald); border:1px solid rgba(16, 185, 129, 0.35); display:flex; align-items:center; gap:8px;">
              <i class="codicon codicon-pass"></i>
              <span><strong>Pre-Flight Dry Run Passed:</strong> Zero merge conflicts detected across 14 touched files.</span>
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-top:1px solid var(--border-subtle); background:var(--bg-secondary);">
            <button class="btn-sm"><i class="codicon codicon-eye"></i> Simulate (Dry Run)</button>
            <div style="display:flex; gap:8px;">
              <button class="btn-sm">Cancel</button>
              <button class="btn-sm btn-primary"><i class="codicon codicon-check"></i> Execute Rebase</button>
            </div>
          </div>
        </div>
      </div>
    </div>`,
  });
}

function buildConflictStudioHtml(themeName, vp) {
  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('graph', vp, '')}
      <div style="flex:1; padding:14px; overflow-y:auto; display:grid; grid-template-columns: 1.35fr 1fr; gap:14px; align-content:start;">
        <!-- Panel 1: 3-Way Conflict Resolution Studio -->
        <section class="modal-content" style="background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:8px; overflow:hidden; display:flex; flex-direction:column;">
          <div class="modal-header" style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:7px;">
              <i class="codicon codicon-extensions" style="color:var(--accent-amber);"></i>
              3-Way Conflict Resolution Studio
            </span>
            <span style="font-size:11px; padding:2px 8px; border-radius:999px; background:rgba(245,158,11,0.16); color:var(--accent-amber); border:1px solid rgba(245,158,11,0.35);">1 Conflict Remaining</span>
          </div>
          <div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
            <div class="conflict-file-card">
              <div class="conflict-file-header">
                <span style="font-weight:600; font-family:var(--vscode-editor-font-family);"><i class="codicon codicon-file-code" style="color:var(--accent-cyan);"></i> src/graph/graphLayout.ts</span>
                <span style="color:var(--accent-rose);">Unmerged &bull; 1 hunk</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:11px;">
                <div style="border:1px solid rgba(56,189,248,0.4); border-radius:4px; padding:6px; background:rgba(56,189,248,0.07);">
                  <div style="font-weight:600; color:var(--accent-cyan); margin-bottom:4px;">Ours (HEAD: main)</div>
                  <pre class="conflict-preview-pre" style="margin:0; max-height:130px;">// Clear converged lanes
for (let i = 0; i &lt; lanes.length; i++) {
  if (lanes[i] === hash)
    lanes[i] = null;
}</pre>
                </div>
                <div style="border:1px solid var(--border-subtle); border-radius:4px; padding:6px; background:var(--bg-primary);">
                  <div style="font-weight:600; color:var(--text-muted); margin-bottom:4px;">Base (Ancestor)</div>
                  <pre class="conflict-preview-pre" style="margin:0; max-height:130px;">const idx = lanes.indexOf(hash);
if (idx !== -1) {
  lanes[idx] = null;
}</pre>
                </div>
                <div style="border:1px solid rgba(139,92,246,0.45); border-radius:4px; padding:6px; background:rgba(139,92,246,0.08);">
                  <div style="font-weight:600; color:var(--accent-violet); margin-bottom:4px;">Theirs (perf/50k-dag)</div>
                  <pre class="conflict-preview-pre" style="margin:0; max-height:130px;">// Free lanes + telemetry
for (let i = 0; i &lt; lanes.length; i++) {
  if (lanes[i] === hash)
    lanes[i] = null;
}
trackMaxLane(lanes.length);</pre>
                </div>
              </div>
              <div class="conflict-file-actions" style="margin-top:4px;">
                <button class="cf-btn cf-btn-secondary"><i class="codicon codicon-arrow-left"></i> Accept Ours</button>
                <button class="cf-btn cf-btn-secondary"><i class="codicon codicon-arrow-right"></i> Accept Theirs</button>
                <button class="cf-btn cf-btn-primary"><i class="codicon codicon-git-merge"></i> Accept Both</button>
                <button class="cf-btn cf-btn-sm" style="margin-left:auto;"><i class="codicon codicon-check"></i> Mark Resolved</button>
              </div>
            </div>

            <div class="conflict-file-card">
              <div class="conflict-file-header">
                <span style="font-weight:600; font-family:var(--vscode-editor-font-family);"><i class="codicon codicon-pass" style="color:var(--accent-emerald);"></i> src/utils/ipcValidator.ts</span>
                <span style="color:var(--accent-emerald);">Staged &amp; Resolved</span>
              </div>
              <div style="font-size:11px; color:var(--text-muted);">Resolved using <strong>Accept Both</strong> &bull; Ready for <code>git rebase --continue</code></div>
            </div>
          </div>
          <div style="padding:10px 14px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between;">
            <button class="cf-btn cf-btn-danger"><i class="codicon codicon-discard"></i> Abort Merge</button>
            <button class="cf-btn cf-btn-primary"><i class="codicon codicon-play"></i> Continue Rebase</button>
          </div>
        </section>

        <!-- Panel 2: Conventional Commit Builder & SemVer Assistant -->
        <section class="modal-content" style="background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:8px; overflow:hidden; display:flex; flex-direction:column;">
          <div class="modal-header" style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:7px;">
              <i class="codicon codicon-git-commit" style="color:var(--accent-cyan);"></i>
              Conventional Commit Builder
            </span>
            <span style="font-size:11px; padding:2px 8px; border-radius:999px; background:rgba(16,185,129,0.14); color:var(--accent-emerald); border:1px solid rgba(16,185,129,0.35);">SemVer: MINOR +</span>
          </div>
          <div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
            <div class="commit-builder-row">
              <label style="flex:1; font-size:11px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                Commit Type
                <select class="branch-select" style="width:100%;"><option selected>feat (New Feature)</option><option>fix</option><option>perf</option></select>
              </label>
              <label style="flex:1; font-size:11px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                Scope
                <input type="text" class="search-input" value="conflict-studio" style="width:100%;" />
              </label>
            </div>
            <label style="font-size:11px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
              <span style="display:flex; justify-content:space-between;"><span>Subject</span><span class="mono-num">48/72</span></span>
              <input type="text" class="search-input" value="add 3-way conflict resolution &amp; rebase actions" style="width:100%;" />
            </label>
            <div class="commit-issue-autocomplete" style="max-height:none;">
              <button class="commit-issue-option" style="background:var(--bg-hover);"><i class="codicon codicon-issues" style="color:var(--accent-emerald);"></i> <strong>#14</strong> Conflict Resolution Studio &amp; 3-Way Viewer</button>
              <button class="commit-issue-option"><i class="codicon codicon-issues" style="color:var(--accent-emerald);"></i> <strong>#15</strong> Conventional Commits Builder &amp; SemVer Tagging</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              Live Commit Preview:
              <pre class="cb-preview-box">feat(conflict-studio): add 3-way conflict resolution &amp; rebase actions

Closes #14</pre>
            </div>
          </div>
          <div style="padding:10px 14px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; color:var(--text-muted);">Recommended tag: <code>v1.0.0</code></span>
            <button class="cf-btn cf-btn-primary"><i class="codicon codicon-check"></i> Commit Staged</button>
          </div>
        </section>
      </div>
    </div>`,
  });
}

function buildCommitDrawerHtml(themeName, vp) {
  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('graph', vp, '')}
      <div class="dag-workspace-row" style="flex:1; min-height:0;">
        <div style="flex:1; min-width:0; overflow:hidden; opacity:0.85;">
          ${buildGraphRowsHtml(vp.width <= 760)}
        </div>
        ${buildSplitInspectorHtml(vp.width >= 900 ? 410 : 350)}
      </div>
    </div>`,
  });
}

function buildIssuesHubHtml(themeName, vp) {
  const issues = [
    { num: 18, state: 'open', linked: 'test/18-qa-pyramid', title: 'Full QA Pyramid: Playwright E2E, Seeded Fuzzing, WCAG 2.1 AA & 50k DAG Benchmark', labels: [['qa', '#38bdf8'], ['v1.0.0', '#8b5cf6']], comments: 5, time: '2h ago' },
    { num: 17, state: 'open', linked: 'feat/17-mcp-v2', title: 'Model Context Protocol (MCP) v2.0 Server over Streamable HTTP/SSE + Scoped OAuth Keys', labels: [['mcp', '#10b981'], ['security', '#f59e0b']], comments: 4, time: '5h ago' },
    { num: 14, state: 'open', linked: 'feat/14-conflict-studio', title: '3-Way Visual Conflict Resolution Studio with Abort Merge & Continue Rebase Actions', labels: [['ui-ux', '#38bdf8'], ['git-engine', '#8b5cf6']], comments: 2, time: '1d ago' },
    { num: 10, state: 'closed', linked: 'perf/10-50k-dag', title: 'Worker-Thread Topological Graph Layout + Direct .git Packfile Reader (< 35ms for 50k)', labels: [['performance', '#10b981'], ['released', '#64748b']], comments: 7, time: '2d ago' },
  ];

  const cardsHtml = issues.map((iss) => `
    <div class="issue-card" data-number="${iss.num}">
      <div class="issue-card-top">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="issue-number">#${iss.num}</span>
          <span class="issue-badge-state ${iss.state}">${iss.state}</span>
          <span class="issue-tag-linked"><i class="codicon codicon-git-branch"></i> ${iss.linked}</span>
        </div>
        <div class="issue-card-actions">
          <button class="btn-icon" title="Checkout / Create Worktree"><i class="codicon codicon-repo-forked"></i></button>
          <button class="btn-icon" title="Open Issue Inspector"><i class="codicon codicon-eye"></i></button>
        </div>
      </div>
      <div class="issue-card-title">${iss.title}</div>
      <div class="issue-labels-wrap" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:4px;">
        ${iss.labels.map(([lbl, hex]) => `<span class="issue-label" style="background:${hex}22; color:${hex}; border:1px solid ${hex}55; padding:1px 7px; border-radius:999px; font-size:10px; font-weight:600;">${lbl}</span>`).join('')}
      </div>
      <div class="issue-card-footer">
        <div class="issue-author-info">
          <img src="${AVATAR_IB}" style="width:16px;height:16px;border-radius:50%; margin-right:4px;" />
          <span class="author-name">Ignaciobrenas</span>
          <span class="relative-time">&bull; ${iss.time} &bull; ${iss.comments} comments</span>
        </div>
        <span style="font-size:10px; color:var(--accent-cyan); font-weight:600;"><i class="codicon codicon-github"></i> GitHub</span>
      </div>
    </div>`).join('');

  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('issues', vp, '')}
      <div class="issues-hub-container" style="padding:12px; display:flex; flex-direction:column; gap:12px; flex:1; overflow-y:auto;">
        <div class="issues-filters-bar">
          <div class="issues-filter-pills">
            <button class="issue-filter-pill active"><i class="codicon codicon-account"></i> <span>Assigned to me</span> <span class="pill-badge">6</span></button>
            <button class="issue-filter-pill"><i class="codicon codicon-git-branch"></i> <span>Linked to branch</span> <span class="pill-badge">4</span></button>
            <button class="issue-filter-pill"><i class="codicon codicon-issues"></i> <span>All Open</span> <span class="pill-badge">12</span></button>
            <button class="issue-filter-pill"><i class="codicon codicon-issue-closed"></i> <span>Closed</span></button>
          </div>
          <div class="issues-search-wrapper" style="margin-top:6px;">
            <i class="codicon codicon-search search-icon"></i>
            <input type="text" class="issues-search-input" value="QA OR conflict OR MCP" />
          </div>
        </div>
        <div class="linked-issue-spotlight" style="padding:10px 12px; border-radius:8px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.35); display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-sparkle" style="color:var(--accent-cyan); font-size:16px;"></i>
            <div>
              <div style="font-weight:700; font-size:12px;">Active Branch Linked: <code>test/18-qa-pyramid</code> &harr; Issue #18</div>
              <div style="font-size:11px; color:var(--text-muted);">Provider: GitHub &bull; PR #28 ready for squash merge into <code>staging</code></div>
            </div>
          </div>
          <button class="cf-btn cf-btn-primary"><i class="codicon codicon-git-pull-request"></i> Open PR #28</button>
        </div>
        <div class="issues-cards-list" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:10px;">
          ${cardsHtml}
        </div>
      </div>
    </div>`,
  });
}

function buildBisectViewHtml(themeName, vp) {
  return wrapHtml({
    themeName,
    vp,
    content: `
    <div class="commitflow-app" style="height:100vh; display:flex; flex-direction:column;">
      ${buildHeaderHtml('graph', vp, '')}
      ${buildStatsBarHtml(vp)}
      <div class="bisect-banner" style="display:flex; margin:8px 10px;">
        <div class="bisect-banner-content" style="width:100%;">
          <div class="bisect-status-pill">
            <i class="codicon codicon-search"></i>
            <span class="bisect-badge-text">Git Bisect Session Active</span>
          </div>
          <div class="bisect-info">
            Testing midpoint commit <code>719f20c</code> &bull; <strong>~2 binary steps remaining</strong> (4 commits in search window)
          </div>
          <div class="bisect-actions">
            <button class="btn-sm btn-bisect-good"><i class="codicon codicon-check"></i> Mark Good</button>
            <button class="btn-sm btn-bisect-bad"><i class="codicon codicon-close"></i> Mark Bad</button>
            <button class="btn-sm"><i class="codicon codicon-debug-step-over"></i> Skip</button>
            <button class="btn-sm btn-bisect-abort"><i class="codicon codicon-debug-stop"></i> Abort Bisect</button>
          </div>
        </div>
      </div>
      <div class="graph-table-container" style="flex:1; overflow-y:auto;">
        <div class="commit-row">
          ${laneSvgCell({ lane: 0, lanesCount: 3, paths: [{ colorIdx: 0, d: 'M 14 15 L 14 30' }] })}
          <div class="commit-info-col">
            <span class="ref-pill" style="background:rgba(239,68,68,0.18); border:1px solid #ef4444; color:#f87171;"><i class="codicon codicon-error" style="font-size:10px;"></i> BAD HEAD</span>
            <span class="commit-subject">release(v1.0.0): enterprise edition with MCP 2.0 &amp; QA pyramid</span>
          </div>
          <div class="commit-author-col"><img src="${AVATAR_IB}" class="author-avatar" /><span class="author-name">Ignacio B.</span></div>
          <div class="commit-meta-col"><span>Just now</span><span class="commit-hash-badge">958f543</span></div>
        </div>
        <div class="commit-row row-bisect-current selected">
          ${laneSvgCell({ lane: 0, lanesCount: 3, isHead: true, paths: [{ colorIdx: 0, d: 'M 14 0 L 14 30' }, { colorIdx: 1, d: 'M 14 15 C 22 15, 30 22, 30 30' }] })}
          <div class="commit-info-col">
            <span class="ref-pill head"><i class="codicon codicon-compass" style="font-size:10px;"></i> ACTIVE PROBE</span>
            <span class="commit-subject">perf(engine): packfile worker cache &amp; zero-OOM 50k commit topology</span>
          </div>
          <div class="commit-author-col"><img src="${AVATAR_MC}" class="author-avatar" /><span class="author-name">Marco Cruz</span></div>
          <div class="commit-meta-col"><span>2h ago</span><span class="commit-hash-badge">719f20c</span></div>
        </div>
        <div class="commit-row">
          ${laneSvgCell({ lane: 1, lanesCount: 3, nodes: [0], paths: [{ colorIdx: 1, d: 'M 30 0 L 30 15' }, { colorIdx: 1, d: 'M 30 15 C 30 24, 14 22, 14 30' }] })}
          <div class="commit-info-col">
            <span class="ref-pill" style="background:rgba(245,158,11,0.16); border:1px solid var(--accent-amber); color:var(--accent-amber);">CANDIDATE</span>
            <span class="commit-subject">feat(conflict-studio): add 3-way conflict resolution &amp; rebase actions</span>
          </div>
          <div class="commit-author-col"><img src="${AVATAR_AL}" class="author-avatar" /><span class="author-name">Ana Lopez</span></div>
          <div class="commit-meta-col"><span>48m ago</span><span class="commit-hash-badge">a44c91e</span></div>
        </div>
        <div class="commit-row">
          ${laneSvgCell({ lane: 0, lanesCount: 3, paths: [{ colorIdx: 0, d: 'M 14 0 L 14 30' }] })}
          <div class="commit-info-col">
            <span class="ref-pill" style="background:rgba(16,185,129,0.18); border:1px solid #10b981; color:#34d399;"><i class="codicon codicon-pass" style="font-size:10px;"></i> GOOD BASE</span>
            <span class="commit-subject">feat(release): v0.4.8 universal adaptive sidebar &amp; issue tracker hub</span>
          </div>
          <div class="commit-author-col"><img src="${AVATAR_IB}" class="author-avatar" /><span class="author-name">Ignacio B.</span></div>
          <div class="commit-meta-col"><span>2d ago</span><span class="commit-hash-badge">f775f85</span></div>
        </div>
      </div>
    </div>`,
  });
}

const curatedSpecs = [
  { prefix: 'graph', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildGraphHtml },
  { prefix: 'graph', theme: 'light', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildGraphHtml },
  { prefix: 'graph', theme: 'high-contrast', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildGraphHtml },
  { prefix: 'graph', theme: 'dark', vp: { name: 'split-750px', width: 750, height: 680 }, builder: buildGraphHtml },
  { prefix: 'graph', theme: 'dark', vp: { name: 'sidebar-360px', width: 360, height: 680 }, builder: buildGraphHtml },
  { prefix: 'ai_studio', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 760 }, builder: buildAiStudioHtml },
  { prefix: 'rebase_studio', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildRebaseStudioHtml },
  { prefix: 'conflict_studio', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildConflictStudioHtml },
  { prefix: 'issues_hub', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 720 }, builder: buildIssuesHubHtml },
  { prefix: 'bisect_view', theme: 'dark', vp: { name: 'full-1200px', width: 1200, height: 640 }, builder: buildBisectViewHtml },
  { prefix: 'commit_drawer', theme: 'dark', vp: { name: 'split-750px', width: 750, height: 660 }, builder: buildCommitDrawerHtml },
];

const captureAllPermutations = process.argv.includes('--all');
const allThemes = ['dark', 'light', 'high-contrast'];
const allViewports = [
  { name: 'narrow-280px', width: 280, height: 720 },
  { name: 'sidebar-360px', width: 360, height: 720 },
  { name: 'medium-450px', width: 450, height: 760 },
  { name: 'split-750px', width: 750, height: 760 },
  { name: 'full-1200px', width: 1200, height: 760 },
];
const allViews = [
  { prefix: 'graph', builder: buildGraphHtml },
  { prefix: 'ai_studio', builder: buildAiStudioHtml },
  { prefix: 'rebase_studio', builder: buildRebaseStudioHtml },
  { prefix: 'conflict_studio', builder: buildConflictStudioHtml },
  { prefix: 'commit_drawer', builder: buildCommitDrawerHtml },
  { prefix: 'issues_hub', builder: buildIssuesHubHtml },
  { prefix: 'bisect_view', builder: buildBisectViewHtml },
];

async function captureAll() {
  if (!captureAllPermutations) {
    for (const f of fs.readdirSync(outDir)) {
      if (f.endsWith('.png')) {
        fs.unlinkSync(path.join(outDir, f));
      }
    }
  }

  const profileDir = path.join(os.tmpdir(), 'commitflow_edge_cdp_' + Date.now());
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--user-data-dir=' + profileDir,
    'about:blank',
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const data = await res.json();
      const page = data.find((p) => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
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

  await new Promise((r) => { ws.onopen = r; });

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

  const jobs = captureAllPermutations
    ? allThemes.flatMap((theme) => allViews.flatMap((v) => allViewports.map((vp) => ({
      prefix: v.prefix,
      theme,
      vp,
      builder: v.builder,
    }))))
    : curatedSpecs;

  for (const job of jobs) {
    const html = job.builder(job.theme, job.vp);
    await send('Emulation.setDeviceMetricsOverride', {
      width: job.vp.width,
      height: job.vp.height,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send('Page.setDocumentContent', { frameId, html });
    await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    await new Promise((r) => setTimeout(r, 150));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outImg = path.join(outDir, `${job.prefix}_${job.theme}_${job.vp.name}.png`);
    fs.writeFileSync(outImg, Buffer.from(shot.data, 'base64'));
    console.log(`Captured (2x CDP): ${path.basename(outImg)} (${job.vp.width}x${job.vp.height})`);
  }

  ws.close();
  edgeProc.kill();

  setTimeout(() => {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }, 1000);

  console.log(`Captured ${jobs.length} high-DPI screenshots in docs/screenshots/`);
}

captureAll().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
