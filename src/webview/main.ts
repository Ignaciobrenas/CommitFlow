interface GitAuthor {
  name: string;
  email: string;
  date: string;
  relativeTime: string;
  avatarUrl: string;
}

interface GitCommitRef {
  type: 'head' | 'branch' | 'remote-branch' | 'tag';
  name: string;
  isHead: boolean;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  parentHashes: string[];
  author: GitAuthor;
  committer: GitAuthor;
  subject: string;
  body: string;
  refs: GitCommitRef[];
}

interface GraphRouteLine {
  fromLane: number;
  toLane: number;
  toHash: string;
  isMerge: boolean;
  isFork: boolean;
}

interface GraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  lines: GraphRouteLine[];
}

interface GitBranch {
  name: string;
  fullName: string;
  isRemote: boolean;
  isCurrent: boolean;
  commitHash: string;
  ahead?: number;
  behind?: number;
  lastAuthor: GitAuthor;
}

interface GitFileChange {
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
  path: string;
  oldPath?: string;
}

interface ContributorStat {
  name: string;
  email: string;
  avatarUrl: string;
  commitsCount: number;
  percentage: number;
}

interface RepoStats {
  totalCommits: number;
  totalContributors: number;
  activeBranches: number;
  topContributors: ContributorStat[];
}

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  webUrl: string;
}

declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

// State
let allNodes: GraphNode[] = [];
let filteredNodes: GraphNode[] = [];
let branches: GitBranch[] = [];
let repoStats: RepoStats | null = null;
let githubRepo: GitHubRepoInfo | null = null;
let currentBranchName = '';
let selectedNode: GraphNode | null = null;
let searchQuery = '';
let selectedBranchFilter = 'all';

// DOM Elements
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const branchSelect = document.getElementById('branch-select') as HTMLSelectElement;
const btnCheckout = document.getElementById('btn-checkout') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const activeBranchPill = document.getElementById('active-branch-pill') as HTMLElement;
const tableContainer = document.getElementById('graph-table-container') as HTMLElement;
const drawer = document.getElementById('commit-drawer') as HTMLElement;
const drawerCloseBtn = document.getElementById('drawer-close-btn') as HTMLButtonElement;

// Stats DOM Elements
const statTotalCommits = document.getElementById('stat-total-commits');
const statTotalContributors = document.getElementById('stat-total-contributors');
const statTotalBranches = document.getElementById('stat-total-branches');
const topContributorsRow = document.getElementById('top-contributors-row');

// Constants
const ROW_HEIGHT = 38;
const LANE_WIDTH = 18;
const LANE_OFFSET_X = 14;

// Message Handler
window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.command) {
    case 'graphData':
      allNodes = message.payload.commits || [];
      branches = message.payload.branches || [];
      currentBranchName = message.payload.currentBranch || '';
      repoStats = message.payload.stats || null;
      githubRepo = message.payload.githubRepo || null;
      updateStatsBar();
      updateBranchesDropdown();
      updateActiveBranchBadge();
      applyFilters();
      break;

    case 'commitFiles':
      if (
        selectedNode &&
        message.payload.commitHash === selectedNode.commit.hash
      ) {
        renderCommitFiles(message.payload.files || []);
      }
      break;

    case 'loading':
      renderLoading();
      break;

    case 'error':
      renderError(message.payload);
      break;
  }
});

function updateStatsBar(): void {
  if (!repoStats) return;
  if (statTotalCommits) statTotalCommits.textContent = repoStats.totalCommits.toString();
  if (statTotalContributors) statTotalContributors.textContent = repoStats.totalContributors.toString();
  if (statTotalBranches) statTotalBranches.textContent = repoStats.activeBranches.toString();

  if (topContributorsRow && repoStats.topContributors) {
    topContributorsRow.innerHTML = '';
    repoStats.topContributors.forEach((c) => {
      const img = document.createElement('img');
      img.className = 'contributor-mini-avatar';
      img.src = c.avatarUrl;
      img.alt = c.name;
      img.title = `${c.name}: ${c.commitsCount} commits (${c.percentage}%) - Click to filter`;
      img.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = c.name;
          searchQuery = c.name;
          applyFilters();
        }
      });
      topContributorsRow.appendChild(img);
    });
  }
}

function updateBranchesDropdown(): void {
  if (!branchSelect) return;
  branchSelect.innerHTML = `<option value="all">All Branches (${branches.length})</option>`;
  branches.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.name;
    opt.textContent = `${b.isCurrent ? '● ' : ''}${b.name}`;
    branchSelect.appendChild(opt);
  });
  branchSelect.value = selectedBranchFilter;
}

function updateActiveBranchBadge(): void {
  if (!activeBranchPill) return;
  const branchNameSpan = activeBranchPill.querySelector('.branch-name');
  if (branchNameSpan) {
    branchNameSpan.textContent = currentBranchName || 'Detached HEAD';
  }
}

function applyFilters(): void {
  filteredNodes = allNodes.filter((node) => {
    const commit = node.commit;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSubject = commit.subject.toLowerCase().includes(q);
      const matchAuthor =
        commit.author.name.toLowerCase().includes(q) ||
        commit.author.email.toLowerCase().includes(q);
      const matchHash = commit.hash.toLowerCase().startsWith(q);
      if (!matchSubject && !matchAuthor && !matchHash) {
        return false;
      }
    }

    if (selectedBranchFilter !== 'all') {
      const hasRef = commit.refs.some(
        (r) =>
          r.name === selectedBranchFilter ||
          r.name.endsWith('/' + selectedBranchFilter)
      );
      // Filter commits by branch
    }

    return true;
  });

  renderGraph();
}

function renderLoading(): void {
  tableContainer.innerHTML = `
    <div class="state-container">
      <div class="spinner"></div>
      <div>Loading commits and branch history...</div>
    </div>
  `;
}

function renderError(err: string): void {
  tableContainer.innerHTML = `
    <div class="state-container">
      <div style="color: #f43f5e; font-size: 24px;">⚠</div>
      <div style="color: #f43f5e; font-weight: 600;">Failed to load git history</div>
      <div style="font-size: 11px;">${err}</div>
    </div>
  `;
}

function renderGraph(): void {
  if (filteredNodes.length === 0) {
    tableContainer.innerHTML = `
      <div class="state-container">
        <div style="font-size: 24px;">🔍</div>
        <div>No commits found matching the filter</div>
      </div>
    `;
    return;
  }

  tableContainer.innerHTML = '';

  const fragment = document.createDocumentFragment();

  filteredNodes.forEach((node, index) => {
    const row = document.createElement('div');
    row.className = `commit-row ${
      selectedNode?.commit.hash === node.commit.hash ? 'selected' : ''
    }`;
    row.style.height = `${ROW_HEIGHT}px`;

    // 1. Graph Canvas Column
    const canvasCol = document.createElement('div');
    canvasCol.className = 'graph-canvas-col';
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = ROW_HEIGHT;
    drawCommitNode(canvas, node, index);
    canvasCol.appendChild(canvas);

    // 2. Commit Info Column (Refs + Subject)
    const infoCol = document.createElement('div');
    infoCol.className = 'commit-info-col';

    node.commit.refs.forEach((ref) => {
      const pill = document.createElement('span');
      pill.className = `ref-pill ${
        ref.isHead ? 'head' : ref.type === 'tag' ? 'tag' : 'branch'
      }`;
      pill.textContent = ref.isHead ? `HEAD -> ${ref.name}` : ref.name;
      infoCol.appendChild(pill);
    });

    const subjectSpan = document.createElement('span');
    subjectSpan.className = 'commit-subject';
    subjectSpan.textContent = node.commit.subject;
    subjectSpan.title = node.commit.subject;
    infoCol.appendChild(subjectSpan);

    // 3. Author Column with Avatar
    const authorCol = document.createElement('div');
    authorCol.className = 'commit-author-col';
    authorCol.title = `${node.commit.author.name} <${node.commit.author.email}>`;

    const avatarImg = document.createElement('img');
    avatarImg.className = 'author-avatar';
    avatarImg.src = node.commit.author.avatarUrl;
    avatarImg.alt = node.commit.author.name;
    avatarImg.loading = 'lazy';
    avatarImg.onerror = () => {
      avatarImg.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="11" fill="%2338bdf8"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="%23fff" font-size="10" font-family="sans-serif">?</text></svg>`;
    };

    const authorNameSpan = document.createElement('span');
    authorNameSpan.className = 'author-name';
    authorNameSpan.textContent = node.commit.author.name;

    authorCol.appendChild(avatarImg);
    authorCol.appendChild(authorNameSpan);

    // 4. Meta Column (Relative Time & Hash)
    const metaCol = document.createElement('div');
    metaCol.className = 'commit-meta-col';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = node.commit.author.relativeTime;

    const hashBadge = document.createElement('span');
    hashBadge.className = 'commit-hash-badge';
    hashBadge.textContent = node.commit.shortHash;

    metaCol.appendChild(timeSpan);
    metaCol.appendChild(hashBadge);

    // Assembly
    row.appendChild(canvasCol);
    row.appendChild(infoCol);
    row.appendChild(authorCol);
    row.appendChild(metaCol);

    row.addEventListener('click', () => {
      selectCommit(node);
    });

    fragment.appendChild(row);
  });

  tableContainer.appendChild(fragment);
}

function drawCommitNode(
  canvas: HTMLCanvasElement,
  node: GraphNode,
  index: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const nodeX = LANE_OFFSET_X + node.lane * LANE_WIDTH;
  const nodeY = ROW_HEIGHT / 2;
  const isHead = node.commit.refs.some((r) => r.isHead);

  // 1. Draw connecting route lines
  node.lines.forEach((line) => {
    const targetX = LANE_OFFSET_X + line.toLane * LANE_WIDTH;
    const targetY = ROW_HEIGHT + ROW_HEIGHT / 2;

    ctx.beginPath();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (line.fromLane === line.toLane) {
      ctx.moveTo(nodeX, nodeY);
      ctx.lineTo(targetX, targetY);
    } else {
      ctx.moveTo(nodeX, nodeY);
      const cp1X = nodeX;
      const cp1Y = nodeY + ROW_HEIGHT * 0.5;
      const cp2X = targetX;
      const cp2Y = targetY - ROW_HEIGHT * 0.5;
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
    }
    ctx.stroke();
  });

  // 2. Draw Commit Dot
  ctx.beginPath();
  ctx.arc(nodeX, nodeY, isHead ? 6 : 4.5, 0, Math.PI * 2);
  ctx.fillStyle = node.color;
  ctx.fill();

  if (isHead) {
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function selectCommit(node: GraphNode): void {
  selectedNode = node;

  document
    .querySelectorAll('.commit-row')
    .forEach((r) => r.classList.remove('selected'));
  const allRows = tableContainer.querySelectorAll('.commit-row');
  const idx = filteredNodes.indexOf(node);
  if (idx >= 0 && allRows[idx]) {
    allRows[idx].classList.add('selected');
  }

  const commit = node.commit;
  const drawerBody = document.getElementById('drawer-body');
  if (!drawerBody) return;

  drawerBody.innerHTML = `
    <!-- Author Hero Card -->
    <div class="author-hero-card">
      <img class="author-hero-avatar" src="${commit.author.avatarUrl}" alt="${
    commit.author.name
  }" />
      <div class="author-hero-info">
        <span class="author-hero-name">${commit.author.name}</span>
        <span class="author-hero-email">${
          commit.author.email || 'No email specified'
        }</span>
        <span class="author-hero-date">${
          commit.author.relativeTime
        } (${new Date(commit.author.date).toLocaleString()})</span>
      </div>
    </div>

    <!-- Actions -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn-drawer-action" id="btn-copy-sha">
        <span>📋</span> Copy SHA (${commit.shortHash})
      </button>
      <button class="btn-drawer-action" id="btn-copy-msg">
        <span>💬</span> Copy Message
      </button>
      ${
        githubRepo
          ? `<button class="btn-drawer-action" id="btn-open-github">
              <span>🐙</span> View on GitHub
            </button>`
          : ''
      }
    </div>

    <!-- Message -->
    <div>
      <div class="section-title">Commit Message</div>
      <div class="commit-full-message">${commit.subject}${
    commit.body ? '\n\n' + commit.body : ''
  }</div>
    </div>

    <!-- Changed Files Section with Diffs -->
    <div class="changed-files-section">
      <div class="section-title">
        <span>Changed Files</span>
        <span id="files-count-badge" style="font-size:10px; color:var(--accent-cyan);">Loading...</span>
      </div>
      <div class="files-list" id="drawer-files-list">
        <div style="padding: 10px; color: var(--text-muted); font-size: 11px;">Fetching modified files...</div>
      </div>
    </div>

    <!-- Parents -->
    <div>
      <div class="section-title">Parents</div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
        ${
          commit.parentHashes
            .map((p) => `<span class="commit-hash-badge">${p.slice(0, 7)}</span>`)
            .join('') ||
          '<span style="color:var(--text-muted);">Initial Commit (Root)</span>'
        }
      </div>
    </div>
  `;

  document.getElementById('btn-copy-sha')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'copyToClipboard', payload: commit.hash });
  });

  document.getElementById('btn-copy-msg')?.addEventListener('click', () => {
    const fullMsg = commit.subject + (commit.body ? '\n\n' + commit.body : '');
    vscode.postMessage({ command: 'copyToClipboard', payload: fullMsg });
  });

  if (githubRepo) {
    document.getElementById('btn-open-github')?.addEventListener('click', () => {
      vscode.postMessage({
        command: 'openExternal',
        payload: `${githubRepo!.webUrl}/commit/${commit.hash}`,
      });
    });
  }

  // Request detailed changed files list from extension host
  vscode.postMessage({
    command: 'requestCommitFiles',
    payload: { commitHash: commit.hash },
  });

  drawer.classList.add('open');
}

function renderCommitFiles(files: GitFileChange[]): void {
  const filesList = document.getElementById('drawer-files-list');
  const countBadge = document.getElementById('files-count-badge');
  if (!filesList) return;

  if (countBadge) {
    countBadge.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
  }

  if (files.length === 0) {
    filesList.innerHTML = `<div style="padding: 6px; color: var(--text-muted);">No files changed in this commit.</div>`;
    return;
  }

  filesList.innerHTML = '';
  files.forEach((file) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.title = `Click to view native diff: ${file.path}`;

    row.innerHTML = `
      <div class="file-info">
        <span class="status-badge status-${file.status}">${file.status}</span>
        <span class="file-path">${file.path}</span>
      </div>
      <span class="diff-hint-icon">🔍 Diff</span>
    `;

    row.addEventListener('click', () => {
      if (selectedNode) {
        vscode.postMessage({
          command: 'openDiff',
          payload: {
            commitHash: selectedNode.commit.hash,
            filePath: file.path,
            status: file.status,
          },
        });
      }
    });

    filesList.appendChild(row);
  });
}

// Drawer Close
drawerCloseBtn?.addEventListener('click', () => {
  drawer.classList.remove('open');
  selectedNode = null;
  document
    .querySelectorAll('.commit-row')
    .forEach((r) => r.classList.remove('selected'));
});

// Search input
searchInput?.addEventListener('input', (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  applyFilters();
});

// Branch select filter
branchSelect?.addEventListener('change', (e) => {
  selectedBranchFilter = (e.target as HTMLSelectElement).value;
  applyFilters();
});

// Checkout Selected Branch Button
btnCheckout?.addEventListener('click', () => {
  if (selectedBranchFilter && selectedBranchFilter !== 'all') {
    vscode.postMessage({
      command: 'checkoutBranch',
      payload: selectedBranchFilter,
    });
  }
});

// Refresh button
refreshBtn?.addEventListener('click', () => {
  vscode.postMessage({ command: 'requestData' });
});

// Initial handshake with Extension Host
vscode.postMessage({ command: 'ready' });
