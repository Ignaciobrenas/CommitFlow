import {
  CommitFlowSettings,
  ContributorStat,
  GitBranch,
  GitCommit,
  GitFileChange,
  GitHubRepoInfo,
  GitStash,
  GraphNode,
  RepoStats,
  UpstreamStatus,
  UserPersonalStats,
} from '../git/types';
import { t, Language } from '../i18n/locales';

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
let stashes: GitStash[] = [];
let repoStats: RepoStats | null = null;
let personalStats: UserPersonalStats | null = null;
let githubRepo: GitHubRepoInfo | null = null;
let currentBranchName = '';
let selectedNode: GraphNode | null = null;
let searchQuery = '';
let selectedBranchFilter = 'all';
let upstreamStatus: UpstreamStatus | null = null;
let currentMaxLane = 0;

let currentLang: Language = 'auto';
let systemLang: string = 'es';
let currentDensity: 'compact' | 'comfortable' | 'spacious' = 'comfortable';
let currentTheme: 'auto' | 'dark' | 'light' = 'auto';
let settings: CommitFlowSettings = {
  language: 'auto',
  density: 'comfortable',
  theme: 'auto',
  animations: true,
  pageSize: 300,
  inlineBlameEnabled: true,
  inlineBlameDelay: 120,
  avatarService: 'gravatar',
  autoFetch: true,
  fetchIntervalMinutes: 5,
  notifyOnBranchMerge: true,
  askBeforePull: true,
};

// DOM Elements
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchClearBtn = document.getElementById('search-clear-btn') as HTMLButtonElement | null;
const branchSelect = document.getElementById('branch-select') as HTMLSelectElement;
const btnCheckout = document.getElementById('btn-checkout') as HTMLButtonElement;
const btnPopout = document.getElementById('btn-popout') as HTMLButtonElement | null;
const btnStash = document.getElementById('btn-stash') as HTMLButtonElement;
const btnPersonalStats = document.getElementById('btn-personal-stats') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const btnRefresh = document.getElementById('refresh-btn') as HTMLButtonElement;
const activeBranchPill = document.getElementById('active-branch-pill') as HTMLElement;
const upstreamSyncContainer = document.getElementById('upstream-sync-container') as HTMLElement;
const tableContainer = document.getElementById('graph-table-container') as HTMLElement;
const drawer = document.getElementById('commit-drawer') as HTMLElement;
const drawerCloseBtn = document.getElementById('drawer-close-btn') as HTMLButtonElement;
const hoverPopover = document.getElementById('hover-popover') as HTMLElement;

// Responsive Layout State
let isCompactLayout = false;

// Modals
const stashModal = document.getElementById('stash-modal') as HTMLElement;
const stashModalClose = document.getElementById('stash-modal-close') as HTMLButtonElement;
const stashModalBody = document.getElementById('stash-modal-body') as HTMLElement;

const personalModal = document.getElementById('personal-modal') as HTMLElement;
const personalModalClose = document.getElementById('personal-modal-close') as HTMLButtonElement;
const personalModalBody = document.getElementById('personal-modal-body') as HTMLElement;

const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const settingsModalClose = document.getElementById('settings-modal-close') as HTMLButtonElement;
const settingsModalBody = document.getElementById('settings-modal-body') as HTMLElement;

// Stats DOM Elements
const statTotalCommits = document.getElementById('stat-total-commits');
const statTotalContributors = document.getElementById('stat-total-contributors');
const statTotalBranches = document.getElementById('stat-total-branches');
const statTotalStashes = document.getElementById('stat-total-stashes');
const statStashItem = document.getElementById('stat-stash-item');
const topContributorsRow = document.getElementById('top-contributors-row');

function getRowHeight(): number {
  if (isCompactLayout) {
    if (currentDensity === 'compact') return 34;
    if (currentDensity === 'spacious') return 44;
    return 38;
  }
  if (currentDensity === 'compact') return 22;
  if (currentDensity === 'spacious') return 32;
  return 26;
}

function getLaneWidth(): number {
  if (isCompactLayout) return 11;
  if (currentDensity === 'compact') return 14;
  if (currentDensity === 'spacious') return 18;
  return 16;
}

function getLaneOffset(): number {
  if (isCompactLayout) return 8;
  if (currentDensity === 'compact') return 12;
  if (currentDensity === 'spacious') return 16;
  return 14;
}

function getNodeRadius(): number {
  if (isCompactLayout) return 3;
  if (currentDensity === 'compact') return 3;
  if (currentDensity === 'spacious') return 5;
  return 4;
}

// Helper translation wrapper
function tr(key: string, params?: Record<string, string | number>): string {
  return t(key, currentLang, systemLang, params);
}

// Apply Theme
function applyTheme(theme: 'auto' | 'dark' | 'light'): void {
  currentTheme = theme;
  document.body.classList.remove('theme-light', 'theme-dark');
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  }
}

// Apply Density
function applyDensity(density: 'compact' | 'comfortable' | 'spacious'): void {
  currentDensity = density;
  document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  document.body.classList.add(`density-${density}`);
}

// Message Listener
window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.command) {
    case 'graphData':
      allNodes = message.payload.commits || [];
      branches = message.payload.branches || [];
      stashes = message.payload.stashes || [];
      currentBranchName = message.payload.currentBranch || '';
      repoStats = message.payload.stats || null;
      personalStats = message.payload.personalStats || null;
      githubRepo = message.payload.githubRepo || null;
      upstreamStatus = message.payload.upstreamStatus || null;
      currentMaxLane = message.payload.maxLane || 0;
      if (message.payload.systemLanguage) {
        systemLang = message.payload.systemLanguage;
      }
      if (message.payload.settings) {
        settings = { ...settings, ...message.payload.settings };
        currentLang = settings.language;
        applyTheme(settings.theme);
        applyDensity(settings.density);
      }
      applyLocalization();
      updateStatsBar();
      updateBranchesDropdown();
      updateActiveBranchBadge();
      renderUpstreamSyncBar();
      applyFilters();
      break;

    case 'commitFiles':
      if (selectedNode && message.payload.commitHash === selectedNode.commit.hash) {
        renderCommitFiles(message.payload.files || []);
      }
      break;

    case 'settingsUpdated':
      if (message.payload) {
        settings = { ...settings, ...message.payload };
        currentLang = settings.language;
        applyTheme(settings.theme);
        applyDensity(settings.density);
        applyLocalization();
        renderGraph();
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

function applyLocalization(): void {
  // Toolbar placeholders and titles
  if (searchInput) searchInput.placeholder = tr('toolbar.searchPlaceholder');
  if (btnCheckout) btnCheckout.title = tr('toolbar.checkout');
  if (btnStash) btnStash.title = tr('toolbar.stash');
  if (btnPersonalStats) btnPersonalStats.title = tr('toolbar.myImpact');
  if (btnSettings) btnSettings.title = tr('toolbar.settings');
  if (btnRefresh) btnRefresh.title = tr('toolbar.refresh');
  if (activeBranchPill) activeBranchPill.title = tr('toolbar.activeBranch');

  // Stats bar labels
  const labelCommits = document.getElementById('label-stat-commits');
  const labelContribs = document.getElementById('label-stat-contributors');
  const labelBranches = document.getElementById('label-stat-branches');
  const labelStashes = document.getElementById('label-stat-stashes');
  if (labelCommits) labelCommits.textContent = tr('stats.commits');
  if (labelContribs) labelContribs.textContent = tr('stats.contributors');
  if (labelBranches) labelBranches.textContent = tr('stats.branches');
  if (labelStashes) labelStashes.textContent = tr('stash.stashes');

  // Drawer Title
  const drawerTitle = document.getElementById('drawer-title');
  if (drawerTitle) drawerTitle.textContent = tr('drawer.title');

  // Stash Modal Title
  const stashModalTitle = document.getElementById('stash-modal-title');
  if (stashModalTitle) stashModalTitle.textContent = tr('stash.title');

  // Personal Modal Title
  const personalModalTitle = document.getElementById('personal-modal-title');
  if (personalModalTitle) personalModalTitle.textContent = tr('personal.title');

  // Settings Modal Title
  const settingsModalTitle = document.getElementById('settings-modal-title');
  if (settingsModalTitle) settingsModalTitle.textContent = tr('settings.title');
}

function updateStatsBar(): void {
  if (!repoStats) return;
  if (statTotalCommits) statTotalCommits.textContent = repoStats.totalCommits.toString();
  if (statTotalContributors) statTotalContributors.textContent = repoStats.totalContributors.toString();
  if (statTotalBranches) statTotalBranches.textContent = repoStats.activeBranches.toString();
  if (statTotalStashes) statTotalStashes.textContent = stashes.length.toString();

  // Highlight your personal contribution share in stats bar
  const existingMyPill = document.getElementById('my-personal-stats-pill');
  if (existingMyPill) existingMyPill.remove();

  if (personalStats) {
    const statsBar = document.getElementById('stats-bar');
    if (statsBar) {
      const myPill = document.createElement('div');
      myPill.id = 'my-personal-stats-pill';
      myPill.className = 'btn-icon';
      myPill.style.color = 'var(--accent-cyan)';
      myPill.style.padding = '1px 6px';
      myPill.style.fontSize = 'var(--font-size-xs)';
      myPill.style.borderRadius = '9999px';
      myPill.title = tr('stats.clickToViewAnalytics');
      myPill.innerHTML = `<i class="codicon codicon-account" style="font-size:12px;"></i> <span>${tr('stats.you')} ${personalStats.myTotalCommits} (${personalStats.commitPercentage}%)</span>`;
      myPill.addEventListener('click', openPersonalModal);
      statsBar.insertBefore(myPill, topContributorsRow);
    }
  }

  if (topContributorsRow && repoStats.topContributors) {
    topContributorsRow.innerHTML = '';
    repoStats.topContributors.forEach((c) => {
      const img = document.createElement('img');
      img.className = 'contributor-mini-avatar';
      img.src = c.avatarUrl;
      img.alt = c.name;
      img.title = `${c.name}: ${c.commitsCount} commits (${c.percentage}%) - ${tr('stats.clickToFilter')}`;
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
  branchSelect.innerHTML = `<option value="all">${tr('toolbar.allBranches')} (${branches.length})</option>`;
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
    branchNameSpan.textContent = currentBranchName || 'HEAD';
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
      if (!hasRef) {
        // Simple branch filter
      }
    }

    return true;
  });

  renderGraph();
}

function renderLoading(): void {
  tableContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; color:var(--text-muted);">
      <i class="codicon codicon-loading codicon-modifier-spin" style="font-size:24px; color:var(--accent-cyan);"></i>
      <div>${tr('graph.loading')}</div>
    </div>
  `;
}

function renderError(err: string): void {
  tableContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; padding:20px; text-align:center;">
      <i class="codicon codicon-warning" style="font-size:32px; color:var(--accent-rose);"></i>
      <div style="color:var(--accent-rose); font-weight:600;">${tr('graph.failedToLoad')}</div>
      <div style="font-size:var(--font-size-sm); color:var(--text-muted); max-width:400px;">${err}</div>
    </div>
  `;
}

function renderUpstreamSyncBar(): void {
  if (!upstreamSyncContainer) return;
  if (!upstreamStatus || (upstreamStatus.behind <= 0 && upstreamStatus.ahead <= 0)) {
    upstreamSyncContainer.innerHTML = '';
    return;
  }

  const behindText =
    upstreamStatus.behind > 0
      ? tr('sync.commitsBehind', { count: upstreamStatus.behind })
      : '';
  const aheadText =
    upstreamStatus.ahead > 0
      ? tr('sync.commitsAhead', { count: upstreamStatus.ahead })
      : '';
  const countsText = [behindText, aheadText].filter(Boolean).join(' • ');

  upstreamSyncContainer.innerHTML = `
    <div class="upstream-sync-bar">
      <div class="upstream-sync-info" title="${tr('sync.syncOptions')}">
        <i class="codicon codicon-cloud-download"></i>
        <span><strong>${upstreamStatus.upstreamBranch}</strong> (${countsText || 'Up to date'})</span>
      </div>
      <div class="upstream-sync-actions">
        <button class="btn-sync-action btn-rebase" id="btn-sync-rebase" title="${tr('watcher.rebaseNow')}">
          <i class="codicon codicon-git-pull-request-go-to-changes"></i> <span>${tr('sync.rebase')}</span>
        </button>
        <button class="btn-sync-action btn-merge" id="btn-sync-merge" title="${tr('watcher.mergeNow')}">
          <i class="codicon codicon-git-merge"></i> <span>${tr('sync.merge')}</span>
        </button>
        <button class="btn-sync-action btn-pull" id="btn-sync-pull" title="${tr('watcher.pullNow')}">
          <i class="codicon codicon-cloud-download"></i> <span>${tr('sync.pull')}</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-sync-rebase')?.addEventListener('click', () => {
    vscode.postMessage({
      command: 'rebaseBranch',
      payload: { upstream: upstreamStatus?.upstreamBranch },
    });
  });

  document.getElementById('btn-sync-merge')?.addEventListener('click', () => {
    vscode.postMessage({
      command: 'mergeBranch',
      payload: { upstream: upstreamStatus?.upstreamBranch },
    });
  });

  document.getElementById('btn-sync-pull')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'pullBranch' });
  });
}

function highlightBranchPath(commitHash: string): void {
  const targetHashes = new Set<string>();
  const queue = [commitHash];
  const nodeMap = new Map<string, GraphNode>();
  allNodes.forEach((n) => nodeMap.set(n.commit.hash, n));

  while (queue.length > 0) {
    const h = queue.shift()!;
    if (targetHashes.has(h)) continue;
    targetHashes.add(h);
    const n = nodeMap.get(h);
    if (n) {
      n.commit.parentHashes?.forEach((p) => {
        if (!targetHashes.has(p)) queue.push(p);
      });
    }
  }

  const rows = tableContainer.querySelectorAll('.commit-row');
  rows.forEach((r, idx) => {
    const node = filteredNodes[idx];
    if (!node) return;
    if (targetHashes.has(node.commit.hash)) {
      r.classList.add('branch-path-active');
      r.classList.remove('branch-path-dimmed');
    } else {
      r.classList.add('branch-path-dimmed');
      r.classList.remove('branch-path-active');
    }
  });
}

function clearBranchPathHighlight(): void {
  const rows = tableContainer.querySelectorAll('.commit-row');
  rows.forEach((r) => {
    r.classList.remove('branch-path-active', 'branch-path-dimmed');
  });
}

function renderGraph(): void {
  if (allNodes.length === 0) {
    tableContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; padding:20px; text-align:center;">
        <i class="codicon codicon-repo" style="font-size:36px; color:var(--text-muted);"></i>
        <div style="font-weight:600; font-size:var(--font-size-base); color:var(--text-primary);">${tr('graph.emptyRepo')}</div>
        <div style="max-width:320px; font-size:var(--font-size-sm); color:var(--text-muted);">${tr('graph.emptyRepoDesc')}</div>
      </div>
    `;
    return;
  }

  if (filteredNodes.length === 0) {
    tableContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; padding:20px; text-align:center;">
        <i class="codicon codicon-search" style="font-size:28px; color:var(--text-muted);"></i>
        <div style="font-weight:600; color:var(--text-primary);">${tr('graph.noMatchingCommits')}</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted);">${tr('graph.noMatchingDesc')}</div>
      </div>
    `;
    return;
  }

  tableContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const isCompact = isCompactLayout;
  const rowHeight = getRowHeight();
  const laneWidth = getLaneWidth();
  const laneOffset = getLaneOffset();

  // Compute dynamic max lane to fit all branches without clipping
  let maxLane = currentMaxLane;
  filteredNodes.forEach((n) => {
    if (n.lane > maxLane) maxLane = n.lane;
    n.passingLanes?.forEach((p) => {
      if (p.lane > maxLane) maxLane = p.lane;
    });
    n.lines.forEach((l) => {
      if (l.toLane > maxLane) maxLane = l.toLane;
    });
  });

  const canvasCssWidth = isCompact
    ? Math.max(22, (maxLane + 1) * laneWidth + laneOffset * 2)
    : Math.max(48, (maxLane + 1) * laneWidth + laneOffset * 2);
  const dpr = window.devicePixelRatio || 1;

  filteredNodes.forEach((node, index) => {
    const row = document.createElement('div');
    const isSelected = selectedNode?.commit.hash === node.commit.hash;
    row.style.height = `${rowHeight}px`;

    // 1. Canvas Column with High-DPI support
    const canvasCol = document.createElement('div');
    canvasCol.className = 'graph-canvas-col';
    canvasCol.style.width = `${canvasCssWidth}px`;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(canvasCssWidth * dpr);
    canvas.height = Math.round(rowHeight * dpr);
    canvas.style.width = `${canvasCssWidth}px`;
    canvas.style.height = `${rowHeight}px`;
    drawCommitNode(canvas, node, index, dpr, isCompact);
    canvasCol.appendChild(canvas);

    if (isCompact) {
      // Compact 2-line layout (Sidebar mode)
      row.className = `commit-row compact-card ${isSelected ? 'selected' : ''}`;

      const cardBody = document.createElement('div');
      cardBody.className = 'commit-card-body';

      // Line 1: Refs + Subject
      const cardTop = document.createElement('div');
      cardTop.className = 'commit-card-top';

      node.commit.refs.forEach((ref) => {
        const pill = document.createElement('span');
        pill.className = `ref-pill ${
          ref.isHead ? 'head' : ref.type === 'tag' ? 'tag' : 'branch'
        }`;
        const icon = ref.type === 'tag' ? 'codicon-tag' : 'codicon-git-branch';
        pill.innerHTML = `<i class="codicon ${icon}" style="font-size:10px;"></i> ${
          ref.isHead ? `HEAD -> ${ref.name}` : ref.name
        }`;
        pill.title = ref.name;
        pill.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          highlightBranchPath(node.commit.hash);
        });
        pill.addEventListener('mouseleave', () => {
          clearBranchPathHighlight();
        });
        cardTop.appendChild(pill);
      });

      const subjectSpan = document.createElement('span');
      subjectSpan.className = 'commit-subject';
      subjectSpan.textContent = node.commit.subject;
      subjectSpan.title = node.commit.subject;
      cardTop.appendChild(subjectSpan);

      // Line 2: Avatar + Author + Relative Time + Hash
      const cardBottom = document.createElement('div');
      cardBottom.className = 'commit-card-bottom';

      const avatarImg = document.createElement('img');
      avatarImg.className = 'card-author-avatar';
      avatarImg.src = node.commit.author.avatarUrl;
      avatarImg.alt = node.commit.author.name;
      avatarImg.loading = 'lazy';
      avatarImg.onerror = () => {
        avatarImg.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="7" fill="%2338bdf8"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="%23fff" font-size="7" font-family="sans-serif">?</text></svg>`;
      };

      const authorName = document.createElement('span');
      authorName.className = 'card-author-name';
      authorName.textContent = node.commit.author.name;
      authorName.title = `${node.commit.author.name} <${node.commit.author.email}>`;

      const dot1 = document.createElement('span');
      dot1.className = 'card-meta-dot';
      dot1.textContent = '•';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'card-time';
      timeSpan.textContent = node.commit.author.relativeTime;

      const dot2 = document.createElement('span');
      dot2.className = 'card-meta-dot';
      dot2.textContent = '•';

      const hashSpan = document.createElement('span');
      hashSpan.className = 'card-hash';
      hashSpan.textContent = node.commit.shortHash;
      hashSpan.title = `SHA: ${node.commit.hash}`;

      cardBottom.appendChild(avatarImg);
      cardBottom.appendChild(authorName);
      cardBottom.appendChild(dot1);
      cardBottom.appendChild(timeSpan);
      cardBottom.appendChild(dot2);
      cardBottom.appendChild(hashSpan);

      cardBody.appendChild(cardTop);
      cardBody.appendChild(cardBottom);

      row.appendChild(canvasCol);
      row.appendChild(cardBody);
    } else {
      // Standard multi-column layout (Wide mode)
      row.className = `commit-row ${isSelected ? 'selected' : ''}`;

      // 2. Info Column (Refs + Subject)
      const infoCol = document.createElement('div');
      infoCol.className = 'commit-info-col';

      node.commit.refs.forEach((ref) => {
        const pill = document.createElement('span');
        pill.className = `ref-pill ${
          ref.isHead ? 'head' : ref.type === 'tag' ? 'tag' : 'branch'
        }`;
        const icon = ref.type === 'tag' ? 'codicon-tag' : 'codicon-git-branch';
        pill.innerHTML = `<i class="codicon ${icon}" style="font-size:10px;"></i> ${
          ref.isHead ? `HEAD -> ${ref.name}` : ref.name
        }`;
        pill.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          highlightBranchPath(node.commit.hash);
        });
        pill.addEventListener('mouseleave', () => {
          clearBranchPathHighlight();
        });
        infoCol.appendChild(pill);
      });

      const subjectSpan = document.createElement('span');
      subjectSpan.className = 'commit-subject';
      subjectSpan.textContent = node.commit.subject;
      subjectSpan.title = node.commit.subject;
      infoCol.appendChild(subjectSpan);

      // 3. Author Column
      const authorCol = document.createElement('div');
      authorCol.className = 'commit-author-col';
      authorCol.title = `${node.commit.author.name} <${node.commit.author.email}>`;

      const avatarImg = document.createElement('img');
      avatarImg.className = 'author-avatar';
      avatarImg.src = node.commit.author.avatarUrl;
      avatarImg.alt = node.commit.author.name;
      avatarImg.loading = 'lazy';
      avatarImg.onerror = () => {
        avatarImg.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="10" fill="%2338bdf8"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="%23fff" font-size="9" font-family="sans-serif">?</text></svg>`;
      };

      const authorNameSpan = document.createElement('span');
      authorNameSpan.className = 'author-name';
      authorNameSpan.textContent = node.commit.author.name;

      authorCol.appendChild(avatarImg);
      authorCol.appendChild(authorNameSpan);

      // 4. Meta Column (Time & Hash)
      const metaCol = document.createElement('div');
      metaCol.className = 'commit-meta-col';

      const timeSpan = document.createElement('span');
      timeSpan.textContent = node.commit.author.relativeTime;

      const hashBadge = document.createElement('span');
      hashBadge.className = 'commit-hash-badge';
      hashBadge.textContent = node.commit.shortHash;

      metaCol.appendChild(timeSpan);
      metaCol.appendChild(hashBadge);

      // 5. Row Quick Actions Bar on Hover (GitLens signature)
      const rowActions = document.createElement('div');
      rowActions.className = 'row-actions-bar';

      const btnCopySha = document.createElement('button');
      btnCopySha.className = 'btn-row-action';
      btnCopySha.title = tr('action.copySha');
      btnCopySha.innerHTML = `<i class="codicon codicon-copy"></i>`;
      btnCopySha.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'copyToClipboard', payload: node.commit.hash });
      });

      const btnCopyMsg = document.createElement('button');
      btnCopyMsg.className = 'btn-row-action';
      btnCopyMsg.title = tr('action.copyMsg');
      btnCopyMsg.innerHTML = `<i class="codicon codicon-comment"></i>`;
      btnCopyMsg.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'copyToClipboard', payload: node.commit.subject });
      });

      const btnCheckoutRow = document.createElement('button');
      btnCheckoutRow.className = 'btn-row-action';
      btnCheckoutRow.title = tr('action.checkout');
      btnCheckoutRow.innerHTML = `<i class="codicon codicon-arrow-swap"></i>`;
      btnCheckoutRow.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'checkoutCommit', payload: node.commit.hash });
      });

      const btnInspect = document.createElement('button');
      btnInspect.className = 'btn-row-action';
      btnInspect.title = tr('action.inspect');
      btnInspect.innerHTML = `<i class="codicon codicon-eye"></i>`;
      btnInspect.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCommit(node);
      });

      rowActions.appendChild(btnCopySha);
      rowActions.appendChild(btnCopyMsg);
      rowActions.appendChild(btnCheckoutRow);
      rowActions.appendChild(btnInspect);

      row.appendChild(canvasCol);
      row.appendChild(infoCol);
      row.appendChild(authorCol);
      row.appendChild(metaCol);
      row.appendChild(rowActions);
    }

    // Row Click & Hover handlers
    row.addEventListener('click', () => selectCommit(node));
    row.addEventListener('mouseenter', (e) => {
      showHoverPopover(e, node);
      highlightBranchPath(node.commit.hash);
    });
    row.addEventListener('mouseleave', () => {
      hideHoverPopover();
      clearBranchPathHighlight();
    });

    fragment.appendChild(row);
  });

  tableContainer.appendChild(fragment);
}

function drawCommitNode(
  canvas: HTMLCanvasElement,
  node: GraphNode,
  index: number,
  dpr = 1,
  isCompact = false
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  const rowHeight = getRowHeight();
  const laneWidth = getLaneWidth();
  const laneOffset = getLaneOffset();
  const radius = getNodeRadius();

  const nodeX = laneOffset + node.lane * laneWidth;
  const nodeY = isCompact ? 13 : rowHeight / 2;
  const isHead = node.commit.refs.some((r) => r.isHead);

  // 1. Draw Passing Lanes (Continuous straight lines from y=0 to y=rowHeight)
  if (node.passingLanes && node.passingLanes.length > 0) {
    node.passingLanes.forEach((pass) => {
      const px = laneOffset + pass.lane * laneWidth;
      ctx.beginPath();
      ctx.strokeStyle = pass.color;
      ctx.lineWidth = 1.75;
      ctx.lineCap = 'round';
      ctx.moveTo(px, 0);
      ctx.lineTo(px, rowHeight);
      ctx.stroke();
    });
  }

  // 2. Draw Incoming Lines from children above (from y=0 to y=nodeY)
  if (node.incomingLines && node.incomingLines.length > 0) {
    node.incomingLines.forEach((inc) => {
      const childX = laneOffset + inc.fromLane * laneWidth;
      ctx.beginPath();
      ctx.strokeStyle = inc.color;
      ctx.lineWidth = 1.75;
      ctx.lineCap = 'round';

      if (childX === nodeX) {
        ctx.moveTo(nodeX, 0);
        ctx.lineTo(nodeX, nodeY);
      } else {
        ctx.moveTo(childX, 0);
        ctx.bezierCurveTo(childX, nodeY * 0.5, nodeX, 0, nodeX, nodeY);
      }
      ctx.stroke();
    });
  }

  // 3. Draw Outgoing Lines to parents below (from y=nodeY to y=rowHeight)
  node.lines.forEach((line) => {
    const targetX = laneOffset + line.toLane * laneWidth;
    ctx.beginPath();
    ctx.strokeStyle = line.color || node.color;
    ctx.lineWidth = 1.75;
    ctx.lineCap = 'round';

    if (nodeX === targetX) {
      ctx.moveTo(nodeX, nodeY);
      ctx.lineTo(nodeX, rowHeight);
    } else {
      ctx.moveTo(nodeX, nodeY);
      ctx.bezierCurveTo(
        nodeX,
        nodeY + (rowHeight - nodeY) * 0.5,
        targetX,
        nodeY,
        targetX,
        rowHeight
      );
    }
    ctx.stroke();
  });

  // 4. Draw Commit Node Dot with subtle glow & high-contrast ring
  ctx.beginPath();
  ctx.arc(nodeX, nodeY, isHead ? radius + 1.5 : radius, 0, Math.PI * 2);
  ctx.fillStyle = node.color;
  ctx.fill();

  if (isHead) {
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'var(--accent-cyan)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// Hover Popover Logic
function showHoverPopover(e: MouseEvent, node: GraphNode): void {
  if (!hoverPopover || !settings.animations) return;
  const commit = node.commit;

  hoverPopover.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <img src="${commit.author.avatarUrl}" style="width:24px; height:24px; border-radius:50%;" />
      <div>
        <div style="font-weight:600; font-size:var(--font-size-sm);">${commit.author.name}</div>
        <div style="font-size:var(--font-size-xs); color:var(--text-muted);">${commit.author.relativeTime} &bull; \`${commit.shortHash}\`</div>
      </div>
    </div>
    <div style="font-size:var(--font-size-sm); color:var(--text-primary); margin-bottom:6px;">${commit.subject}</div>
    ${
      commit.refs.length > 0
        ? `<div style="display:flex; gap:4px; flex-wrap:wrap;">
            ${commit.refs
              .map(
                (r) =>
                  `<span class="ref-pill ${r.isHead ? 'head' : 'branch'}"><i class="codicon codicon-git-branch" style="font-size:9px;"></i> ${r.name}</span>`
              )
              .join('')}
           </div>`
        : ''
    }
  `;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const top = Math.min(rect.bottom + 4, window.innerHeight - 150);
  const left = Math.min(rect.left + 80, window.innerWidth - 330);

  hoverPopover.style.top = `${top}px`;
  hoverPopover.style.left = `${left}px`;
  hoverPopover.classList.add('visible');
}

function hideHoverPopover(): void {
  if (hoverPopover) hoverPopover.classList.remove('visible');
}

function selectCommit(node: GraphNode): void {
  selectedNode = node;
  hideHoverPopover();

  document.querySelectorAll('.commit-row').forEach((r) => r.classList.remove('selected'));
  const allRows = tableContainer.querySelectorAll('.commit-row');
  const idx = filteredNodes.indexOf(node);
  if (idx >= 0 && allRows[idx]) {
    allRows[idx].classList.add('selected');
  }

  const commit = node.commit;
  const drawerBody = document.getElementById('drawer-body');
  if (!drawerBody) return;

  drawerBody.innerHTML = `
    <div class="author-hero-card">
      <img class="author-hero-avatar" src="${commit.author.avatarUrl}" alt="${commit.author.name}" />
      <div style="display:flex; flex-direction:column;">
        <span style="font-weight:600; font-size:var(--font-size-base);">${commit.author.name}</span>
        <span style="color:var(--text-muted); font-size:var(--font-size-xs);">${commit.author.email || 'No email'}</span>
        <span style="color:var(--accent-cyan); font-size:var(--font-size-xs); margin-top:2px;">
          ${commit.author.relativeTime} (${new Date(commit.author.date).toLocaleString()})
        </span>
      </div>
    </div>

    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button class="btn-icon" id="btn-copy-sha">
        <i class="codicon codicon-copy"></i> ${tr('drawer.copySha')} (${commit.shortHash})
      </button>
      <button class="btn-icon" id="btn-copy-msg">
        <i class="codicon codicon-comment"></i> ${tr('drawer.copyMsg')}
      </button>
      ${
        githubRepo
          ? `<button class="btn-icon" id="btn-open-github">
              <i class="codicon codicon-github"></i> ${tr('drawer.viewOnGitHub')}
            </button>`
          : ''
      }
    </div>

    <div>
      <div class="section-title">${tr('drawer.commitMessage')}</div>
      <div class="commit-full-message">${commit.subject}${commit.body ? '\n\n' + commit.body : ''}</div>
    </div>

    <div>
      <div class="section-title">
        <span>${tr('drawer.changedFiles')}</span>
        <span id="files-count-badge" style="font-size:var(--font-size-xs); color:var(--accent-cyan);">${tr('drawer.fetchingFiles')}</span>
      </div>
      <div class="files-list" id="drawer-files-list">
        <div style="padding:8px; color:var(--text-muted); font-size:var(--font-size-sm);">${tr('drawer.fetchingFiles')}</div>
      </div>
    </div>

    <div>
      <div class="section-title">${tr('drawer.parents')}</div>
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
        ${
          commit.parentHashes
            .map((p) => `<span class="commit-hash-badge">${p.slice(0, 7)}</span>`)
            .join('') || `<span style="color:var(--text-muted); font-size:var(--font-size-xs);">${tr('drawer.initialCommit')}</span>`
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
    filesList.innerHTML = `<div style="padding:6px; color:var(--text-muted);">${tr('drawer.noFiles')}</div>`;
    return;
  }

  filesList.innerHTML = '';
  files.forEach((file) => {
    const row = document.createElement('div');
    row.className = 'file-row';

    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis;">
        <span class="status-badge status-${file.status}">${file.status}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.path}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
        <button class="btn-icon btn-file-diff" title="${tr('drawer.diffHint')}" style="padding:1px 4px; font-size:10px;">
          <i class="codicon codicon-diff"></i>
        </button>
        <button class="btn-icon btn-file-open" title="${tr('drawer.openFile')}" style="padding:1px 4px; font-size:10px;">
          <i class="codicon codicon-go-to-file"></i>
        </button>
      </div>
    `;

    row.querySelector('.btn-file-diff')?.addEventListener('click', (e) => {
      e.stopPropagation();
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

    row.querySelector('.btn-file-open')?.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({
        command: 'openFile',
        payload: { filePath: file.path },
      });
    });

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

function closeDrawer(): void {
  drawer.classList.remove('open');
  selectedNode = null;
  document.querySelectorAll('.commit-row').forEach((r) => r.classList.remove('selected'));
}

// Settings Modal Management
function openSettingsModal(): void {
  if (!settingsModal || !settingsModalBody) return;

  settingsModalBody.innerHTML = `
    <div class="settings-tabs">
      <button class="settings-tab-btn active" data-tab="tab-appearance">${tr('settings.tabAppearance')}</button>
      <button class="settings-tab-btn" data-tab="tab-graph">${tr('settings.tabGraph')}</button>
      <button class="settings-tab-btn" data-tab="tab-blame">${tr('settings.tabBlame')}</button>
      <button class="settings-tab-btn" data-tab="tab-sync">${tr('settings.tabSync')}</button>
    </div>

    <!-- Tab 1: Appearance -->
    <div class="settings-tab-content" id="tab-appearance">
      <div class="settings-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.densityLabel')}</span>
            <span class="setting-desc">${tr('settings.densityDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-density">
              <option value="compact" ${settings.density === 'compact' ? 'selected' : ''}>${tr('settings.densityCompact')}</option>
              <option value="comfortable" ${settings.density === 'comfortable' ? 'selected' : ''}>${tr('settings.densityComfortable')}</option>
              <option value="spacious" ${settings.density === 'spacious' ? 'selected' : ''}>${tr('settings.densitySpacious')}</option>
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.themeLabel')}</span>
            <span class="setting-desc">${tr('settings.themeDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-theme">
              <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>${tr('settings.themeAuto')}</option>
              <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>${tr('settings.themeDark')}</option>
              <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>${tr('settings.themeLight')}</option>
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.languageLabel')}</span>
            <span class="setting-desc">${tr('settings.languageDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-language">
              <option value="auto" ${settings.language === 'auto' ? 'selected' : ''}>${tr('settings.langAuto')}</option>
              <option value="es" ${settings.language === 'es' ? 'selected' : ''}>${tr('settings.langEs')}</option>
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>${tr('settings.langEn')}</option>
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.animationsLabel')}</span>
            <span class="setting-desc">${tr('settings.animationsDesc')}</span>
          </div>
          <div class="setting-control">
            <label class="switch">
              <input type="checkbox" id="cfg-animations" ${settings.animations ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Graph -->
    <div class="settings-tab-content" id="tab-graph" style="display:none;">
      <div class="settings-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.pageSizeLabel')}</span>
            <span class="setting-desc">${tr('settings.pageSizeDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-page-size">
              <option value="100" ${settings.pageSize === 100 ? 'selected' : ''}>100 commits</option>
              <option value="300" ${settings.pageSize === 300 ? 'selected' : ''}>300 commits</option>
              <option value="500" ${settings.pageSize === 500 ? 'selected' : ''}>500 commits</option>
              <option value="1000" ${settings.pageSize === 1000 ? 'selected' : ''}>1000 commits</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Blame -->
    <div class="settings-tab-content" id="tab-blame" style="display:none;">
      <div class="settings-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.inlineBlameLabel')}</span>
            <span class="setting-desc">${tr('settings.inlineBlameDesc')}</span>
          </div>
          <div class="setting-control">
            <label class="switch">
              <input type="checkbox" id="cfg-blame" ${settings.inlineBlameEnabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.debounceLabel')}</span>
            <span class="setting-desc">${tr('settings.debounceDesc')}</span>
          </div>
          <div class="setting-control">
            <input type="number" id="cfg-debounce" value="${settings.inlineBlameDelay}" min="50" max="1000" step="50" style="width:70px;" />
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.avatarServiceLabel')}</span>
            <span class="setting-desc">${tr('settings.avatarServiceDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-avatar">
              <option value="gravatar" ${settings.avatarService === 'gravatar' ? 'selected' : ''}>Gravatar</option>
              <option value="github" ${settings.avatarService === 'github' ? 'selected' : ''}>GitHub Noreply</option>
              <option value="initials" ${settings.avatarService === 'initials' ? 'selected' : ''}>Initials SVG</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: Sync & Alerts -->
    <div class="settings-tab-content" id="tab-sync" style="display:none;">
      <div class="settings-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.notifyMergesLabel')}</span>
            <span class="setting-desc">${tr('settings.notifyMergesDesc')}</span>
          </div>
          <div class="setting-control">
            <label class="switch">
              <input type="checkbox" id="cfg-notify" ${settings.notifyOnBranchMerge ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">${tr('settings.autoFetchLabel')}</span>
            <span class="setting-desc">${tr('settings.autoFetchDesc')}</span>
          </div>
          <div class="setting-control">
            <select id="cfg-autofetch">
              <option value="0" ${settings.fetchIntervalMinutes === 0 ? 'selected' : ''}>Disabled</option>
              <option value="3" ${settings.fetchIntervalMinutes === 3 ? 'selected' : ''}>Every 3 min</option>
              <option value="5" ${settings.fetchIntervalMinutes === 5 ? 'selected' : ''}>Every 5 min</option>
              <option value="10" ${settings.fetchIntervalMinutes === 10 ? 'selected' : ''}>Every 10 min</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px; border-top:1px solid var(--border-subtle); padding-top:12px;">
      <button class="btn-icon" id="btn-save-settings" style="background:var(--accent-cyan); color:#000; font-weight:600; padding:4px 12px;">
        <i class="codicon codicon-check"></i> ${tr('settings.saveBtn')}
      </button>
    </div>
  `;

  // Tab switching
  settingsModalBody.querySelectorAll('.settings-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      settingsModalBody.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.remove('active'));
      settingsModalBody.querySelectorAll('.settings-tab-content').forEach((c) => ((c as HTMLElement).style.display = 'none'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        const target = document.getElementById(tabId);
        if (target) target.style.display = 'block';
      }
    });
  });

  // Real-time density preview
  document.getElementById('cfg-density')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as any;
    applyDensity(val);
    renderGraph();
  });

  // Real-time theme preview
  document.getElementById('cfg-theme')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as any;
    applyTheme(val);
  });

  // Real-time language preview
  document.getElementById('cfg-language')?.addEventListener('change', (e) => {
    currentLang = (e.target as HTMLSelectElement).value as any;
    applyLocalization();
  });

  // Save button
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    const newSettings: CommitFlowSettings = {
      density: (document.getElementById('cfg-density') as HTMLSelectElement).value as any,
      theme: (document.getElementById('cfg-theme') as HTMLSelectElement).value as any,
      language: (document.getElementById('cfg-language') as HTMLSelectElement).value as any,
      animations: (document.getElementById('cfg-animations') as HTMLInputElement).checked,
      pageSize: parseInt((document.getElementById('cfg-page-size') as HTMLSelectElement)?.value || '300', 10),
      inlineBlameEnabled: (document.getElementById('cfg-blame') as HTMLInputElement).checked,
      inlineBlameDelay: parseInt((document.getElementById('cfg-debounce') as HTMLInputElement).value || '120', 10),
      avatarService: (document.getElementById('cfg-avatar') as HTMLSelectElement).value as any,
      autoFetch: (document.getElementById('cfg-autofetch') as HTMLSelectElement).value !== '0',
      fetchIntervalMinutes: parseInt((document.getElementById('cfg-autofetch') as HTMLSelectElement).value || '5', 10),
      notifyOnBranchMerge: (document.getElementById('cfg-notify') as HTMLInputElement).checked,
      askBeforePull: true,
    };

    settings = newSettings;
    vscode.postMessage({ command: 'saveSettings', payload: newSettings });
    closeSettingsModal();
  });

  settingsModal.classList.add('open');
}

function closeSettingsModal(): void {
  settingsModal?.classList.remove('open');
}

// Personal Modal
function openPersonalModal(): void {
  if (!personalModal || !personalModalBody) return;

  if (!personalStats) {
    personalModalBody.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">${tr('personal.noContributions')}</div>`;
    personalModal.classList.add('open');
    return;
  }

  const {
    userName,
    userEmail,
    avatarUrl,
    myTotalCommits,
    repoTotalCommits,
    commitPercentage,
    participatedBranchesCount,
    branches: myBranches,
  } = personalStats;

  personalModalBody.innerHTML = `
    <div class="author-hero-card">
      <img class="author-hero-avatar" src="${avatarUrl}" alt="${userName}" />
      <div>
        <div style="font-weight:600; font-size:var(--font-size-base);">${userName}</div>
        <div style="color:var(--text-muted); font-size:var(--font-size-xs);">${userEmail || 'Configured via Git'}</div>
        <span class="active-branch-badge" style="margin-top:3px; display:inline-flex;">${tr('personal.verifiedContributor')}</span>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
      <div style="padding:10px; background:var(--bg-glass); border:1px solid var(--border-subtle); border-radius:6px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:var(--accent-cyan);">${myTotalCommits}</div>
        <div style="font-size:var(--font-size-xs); color:var(--text-muted);">${tr('personal.yourCommits')} (${commitPercentage}%)</div>
      </div>
      <div style="padding:10px; background:var(--bg-glass); border:1px solid var(--border-subtle); border-radius:6px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:var(--text-primary);">${repoTotalCommits}</div>
        <div style="font-size:var(--font-size-xs); color:var(--text-muted);">${tr('personal.totalRepoCommits')}</div>
      </div>
      <div style="padding:10px; background:var(--bg-glass); border:1px solid var(--border-subtle); border-radius:6px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:var(--accent-emerald);">${participatedBranchesCount}</div>
        <div style="font-size:var(--font-size-xs); color:var(--text-muted);">${tr('personal.branchesInvolved')}</div>
      </div>
    </div>

    <div>
      <div class="section-title">
        <span>${tr('personal.branchParticipation')}</span>
        <span style="font-size:var(--font-size-xs); color:var(--accent-cyan);">${myBranches.length} Active</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
        ${
          myBranches.length === 0
            ? `<div style="color:var(--text-muted); font-size:var(--font-size-sm);">${tr('personal.noContributions')}</div>`
            : myBranches
                .map(
                  (b) => `
          <div class="file-row" data-branch="${b.branchName}" style="flex-direction:column; align-items:stretch; gap:4px;" title="${tr('personal.filterHint')}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:600; display:flex; align-items:center; gap:4px;">
                <i class="codicon codicon-git-branch" style="font-size:12px;"></i> ${b.branchName}
                ${b.isCurrent ? '<span class="status-badge status-A" style="font-size:9px;">HEAD</span>' : ''}
              </span>
              <span style="font-size:var(--font-size-xs); color:var(--text-muted);">
                <strong>${b.myCommitsCount}</strong> / ${b.totalCommitsCount} (${b.percentage}%)
              </span>
            </div>
            <div style="height:4px; background:rgba(125,125,125,0.2); border-radius:2px; overflow:hidden;">
              <div style="height:100%; width:${Math.max(b.percentage, 5)}%; background:var(--accent-cyan);"></div>
            </div>
          </div>
        `
                )
                .join('')
        }
      </div>
    </div>
  `;

  personalModalBody.querySelectorAll('.file-row').forEach((row) => {
    row.addEventListener('click', () => {
      const branch = row.getAttribute('data-branch');
      if (branch && branchSelect) {
        branchSelect.value = branch;
        selectedBranchFilter = branch;
        applyFilters();
        closePersonalModal();
      }
    });
  });

  personalModal.classList.add('open');
}

function closePersonalModal(): void {
  personalModal?.classList.remove('open');
}

// Git Stash Modal Logic
function openStashModal(): void {
  renderStashModalBody();
  stashModal?.classList.add('open');
}

function closeStashModal(): void {
  stashModal?.classList.remove('open');
}

function renderStashModalBody(): void {
  if (!stashModalBody) return;

  let stashesHtml = '';
  if (stashes.length === 0) {
    stashesHtml = `
      <div style="padding:16px; text-align:center; color:var(--text-muted); font-size:var(--font-size-sm);">
        <i class="codicon codicon-archive" style="font-size:24px; margin-bottom:6px; display:block;"></i>
        ${tr('stash.empty')}
      </div>
    `;
  } else {
    stashesHtml = `
      <div class="stash-list">
        ${stashes
          .map(
            (s) => `
          <div class="stash-item">
            <div class="stash-meta">
              <span class="stash-title"><span style="color:var(--accent-amber); font-family:var(--vscode-editor-font-family);">${s.ref}</span> ${s.message}</span>
              <span class="stash-subtitle">${s.date} • <span style="font-family:var(--vscode-editor-font-family);">${s.hash.slice(0, 7)}</span></span>
            </div>
            <div class="stash-actions">
              <button class="btn-stash-action btn-pop" data-ref="${s.ref}" title="${tr('stash.pop')}">
                <i class="codicon codicon-cloud-download"></i> <span>${tr('stash.pop')}</span>
              </button>
              <button class="btn-stash-action btn-apply" data-ref="${s.ref}" title="${tr('stash.apply')}">
                <i class="codicon codicon-check"></i> <span>${tr('stash.apply')}</span>
              </button>
              <button class="btn-stash-action btn-drop" data-ref="${s.ref}" title="${tr('stash.drop')}">
                <i class="codicon codicon-trash"></i> <span>${tr('stash.drop')}</span>
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  stashModalBody.innerHTML = `
    <div class="stash-form">
      <input type="text" id="stash-save-input" class="stash-input" placeholder="${tr('stash.inputPlaceholder')}" />
      <button id="btn-do-stash-save" class="btn-stash-save">
        <i class="codicon codicon-add"></i> <span>${tr('stash.saveBtn')}</span>
      </button>
    </div>
    ${stashesHtml}
  `;

  document.getElementById('btn-do-stash-save')?.addEventListener('click', () => {
    const input = document.getElementById('stash-save-input') as HTMLInputElement;
    const msg = input?.value || '';
    vscode.postMessage({ command: 'stashSave', payload: { message: msg } });
    if (input) input.value = '';
  });

  stashModalBody.querySelectorAll('.btn-pop').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ref = btn.getAttribute('data-ref') || 'stash@{0}';
      vscode.postMessage({ command: 'stashPop', payload: { ref } });
    });
  });

  stashModalBody.querySelectorAll('.btn-apply').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ref = btn.getAttribute('data-ref') || 'stash@{0}';
      vscode.postMessage({ command: 'stashApply', payload: { ref } });
    });
  });

  stashModalBody.querySelectorAll('.btn-drop').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ref = btn.getAttribute('data-ref') || 'stash@{0}';
      vscode.postMessage({ command: 'stashDrop', payload: { ref } });
    });
  });
}

// Event Listeners
drawerCloseBtn?.addEventListener('click', closeDrawer);
btnPersonalStats?.addEventListener('click', openPersonalModal);
personalModalClose?.addEventListener('click', closePersonalModal);

btnStash?.addEventListener('click', openStashModal);
statStashItem?.addEventListener('click', openStashModal);
stashModalClose?.addEventListener('click', closeStashModal);

btnSettings?.addEventListener('click', openSettingsModal);
settingsModalClose?.addEventListener('click', closeSettingsModal);

btnPopout?.addEventListener('click', () => {
  vscode.postMessage({ command: 'openFullPanel' });
});

searchClearBtn?.addEventListener('click', () => {
  if (searchInput) {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.style.display = 'none';
    applyFilters();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDrawer();
    closePersonalModal();
    closeSettingsModal();
    closeStashModal();
    hideHoverPopover();
  }
});

searchInput?.addEventListener('input', (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  if (searchClearBtn) {
    searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
  }
  applyFilters();
});

branchSelect?.addEventListener('change', (e) => {
  selectedBranchFilter = (e.target as HTMLSelectElement).value;
  applyFilters();
});

btnCheckout?.addEventListener('click', () => {
  if (selectedBranchFilter && selectedBranchFilter !== 'all') {
    vscode.postMessage({
      command: 'checkoutBranch',
      payload: selectedBranchFilter,
    });
  }
});

btnRefresh?.addEventListener('click', () => {
  vscode.postMessage({ command: 'requestData' });
});

// Real-Time Container & Sidebar Responsiveness
function checkLayoutMode(): void {
  const width = document.body.clientWidth;
  const wasCompact = isCompactLayout;
  isCompactLayout = width <= 360;

  if (isCompactLayout) {
    document.body.classList.add('layout-sidebar-compact');
  } else {
    document.body.classList.remove('layout-sidebar-compact');
  }

  if (width <= 240) {
    document.body.classList.add('layout-nano');
  } else {
    document.body.classList.remove('layout-nano');
  }

  if (wasCompact !== isCompactLayout && allNodes.length > 0) {
    renderTable();
  }
}

if (typeof ResizeObserver !== 'undefined') {
  const resizeObserver = new ResizeObserver(() => {
    checkLayoutMode();
  });
  resizeObserver.observe(document.body);
} else {
  window.addEventListener('resize', checkLayoutMode);
}
checkLayoutMode();

// Initial handshake
vscode.postMessage({ command: 'ready' });
