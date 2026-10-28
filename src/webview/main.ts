import {
  CloudPatch,
  CommitFlowSettings,
  ContributorStat,
  FileCommitRevision,
  GitBranch,
  GitCommit,
  GitFileChange,
  GitHubRepoInfo,
  GitStash,
  GitWorktree,
  GraphNode,
  LayoutMode,
  PullRequestInfo,
  RemoteRepoInfo,
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
let worktrees: GitWorktree[] = [];
let pullRequests: PullRequestInfo[] = [];
let remoteRepo: RemoteRepoInfo | null = null;
let currentFileHistory: { filePath: string; fileName: string; revisions: FileCommitRevision[] } | null = null;
let savedPatches: CloudPatch[] = [];
let activeTab = 'tab-graph';
let prActiveFilter: 'all' | 'blocked' | 'ready' | 'pending' = 'all';
let currentLayoutMode: LayoutMode = 'auto';

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
  layoutMode: 'auto',
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
const btnLayoutMode = document.getElementById('btn-layout-mode') as HTMLButtonElement | null;
const layoutPickerPopover = document.getElementById('layout-picker-popover') as HTMLElement | null;
const privateRepoBadge = document.getElementById('private-repo-badge') as HTMLElement | null;
const privateRepoLabel = document.getElementById('private-repo-label') as HTMLElement | null;
const activeBranchPill = document.getElementById('active-branch-pill') as HTMLElement;
const upstreamSyncContainer = document.getElementById('upstream-sync-container') as HTMLElement;
const tableContainer = document.getElementById('graph-table-container') as HTMLElement;
const drawer = document.getElementById('commit-drawer') as HTMLElement;
const drawerCloseBtn = document.getElementById('drawer-close-btn') as HTMLButtonElement;
const hoverPopover = document.getElementById('hover-popover') as HTMLElement;

// Tab Elements
const navTabButtons = document.querySelectorAll('.nav-tab-btn');
const prBadgeCount = document.getElementById('pr-badge-count');
const worktreeBadgeCount = document.getElementById('worktree-badge-count');

// Worktree & Patch Modals
const worktreeCreateModal = document.getElementById('worktree-create-modal') as HTMLElement | null;
const worktreeModalClose = document.getElementById('worktree-modal-close') as HTMLButtonElement | null;
const btnAddWorktree = document.getElementById('btn-add-worktree') as HTMLButtonElement | null;
const wtBtnCancel = document.getElementById('wt-btn-cancel') as HTMLButtonElement | null;
const wtBtnSubmit = document.getElementById('wt-btn-submit') as HTMLButtonElement | null;
const wtBranchInput = document.getElementById('wt-branch-input') as HTMLInputElement | null;
const wtPathInput = document.getElementById('wt-path-input') as HTMLInputElement | null;

const patchCreateModal = document.getElementById('patch-create-modal') as HTMLElement | null;
const patchModalClose = document.getElementById('patch-modal-close') as HTMLButtonElement | null;
const btnCreatePatch = document.getElementById('btn-create-patch') as HTMLButtonElement | null;
const patchBtnCancel = document.getElementById('patch-btn-cancel') as HTMLButtonElement | null;
const patchBtnSubmit = document.getElementById('patch-btn-submit') as HTMLButtonElement | null;
const patchTitleInput = document.getElementById('patch-title-input') as HTMLInputElement | null;
const patchDescInput = document.getElementById('patch-desc-input') as HTMLTextAreaElement | null;

const patchApplyModal = document.getElementById('patch-apply-modal') as HTMLElement | null;
const patchApplyClose = document.getElementById('patch-apply-close') as HTMLButtonElement | null;
const btnApplyPatch = document.getElementById('btn-apply-patch') as HTMLButtonElement | null;
const patchApplyBtnCancel = document.getElementById('patch-apply-btn-cancel') as HTMLButtonElement | null;
const patchApplyBtnSubmit = document.getElementById('patch-apply-btn-submit') as HTMLButtonElement | null;
const patchApplyContent = document.getElementById('patch-apply-content') as HTMLTextAreaElement | null;

const btnPickFileHistory = document.getElementById('btn-pick-file-history') as HTMLButtonElement | null;

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
      worktrees = message.payload.worktrees || [];
      pullRequests = message.payload.pullRequests || [];
      remoteRepo = message.payload.remoteRepo || null;
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
        if (settings.layoutMode) {
          applyLayoutMode(settings.layoutMode, false);
        }
      }
      applyLocalization();
      updateStatsBar();
      updateBranchesDropdown();
      updateActiveBranchBadge();
      updatePrivateRepoBadge();
      updateTabBadges();
      renderUpstreamSyncBar();
      applyFilters();

      if (activeTab === 'tab-worktrees') renderWorktrees();
      if (activeTab === 'tab-prs') renderPullRequests();
      break;

    case 'commitFiles':
      if (selectedNode && message.payload.commitHash === selectedNode.commit.hash) {
        renderCommitFiles(message.payload.files || []);
      }
      break;

    case 'worktreesData':
      worktrees = message.payload || [];
      updateTabBadges();
      renderWorktrees();
      break;

    case 'pullRequestsData':
      pullRequests = message.payload || [];
      updateTabBadges();
      renderPullRequests();
      break;

    case 'fileHistoryData':
      currentFileHistory = message.payload;
      renderFileHistory(message.payload);
      break;

    case 'patchCreated':
      handlePatchCreated(message.payload);
      break;

    case 'patchApplied':
      handlePatchApplied(message.payload);
      break;

    case 'switchTab':
      if (message.payload) {
        switchTab(message.payload);
      }
      break;

    case 'settingsUpdated':
      if (message.payload) {
        settings = { ...settings, ...message.payload };
        currentLang = settings.language;
        applyTheme(settings.theme);
        applyDensity(settings.density);
        if (settings.layoutMode) {
          applyLayoutMode(settings.layoutMode, false);
        }
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

// ==========================================================================
// CommitFlow v0.4.0: Layout Switcher, Tabs, File History, PRs, Worktrees, Cloud Patches
// ==========================================================================

function applyLayoutMode(mode: LayoutMode, persist = true): void {
  currentLayoutMode = mode;
  document.body.classList.remove('layout-bottom', 'layout-left', 'layout-right', 'layout-auto');
  document.body.classList.add(`layout-${mode}`);

  if (btnLayoutMode) {
    const icon = btnLayoutMode.querySelector('i');
    if (icon) {
      icon.className = 'codicon';
      if (mode === 'bottom') icon.classList.add('codicon-layout-panel');
      else if (mode === 'left') icon.classList.add('codicon-layout-sidebar-left');
      else if (mode === 'right') icon.classList.add('codicon-layout-sidebar-right');
      else icon.classList.add('codicon-layout');
    }
  }

  document.querySelectorAll('.layout-option').forEach((opt) => {
    if (opt.getAttribute('data-layout') === mode) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  checkLayoutMode();
  if (allNodes.length > 0) {
    renderGraph();
  }

  if (persist) {
    vscode.postMessage({ command: 'setLayoutMode', payload: mode });
  }
}

function updatePrivateRepoBadge(): void {
  if (!privateRepoBadge) return;
  if (remoteRepo && remoteRepo.isPrivate) {
    privateRepoBadge.style.display = 'inline-flex';
    if (privateRepoLabel) {
      const pName = remoteRepo.provider.charAt(0).toUpperCase() + remoteRepo.provider.slice(1);
      privateRepoLabel.textContent = `${pName} Privado`;
    }
    privateRepoBadge.title = `Repositorio Privado en ${remoteRepo.provider.toUpperCase()} (${remoteRepo.owner}/${remoteRepo.repo})`;
  } else {
    privateRepoBadge.style.display = 'none';
  }
}

function updateTabBadges(): void {
  if (prBadgeCount) {
    prBadgeCount.textContent = String(pullRequests.length);
    prBadgeCount.style.display = pullRequests.length > 0 ? 'inline-flex' : 'none';
  }
  if (worktreeBadgeCount) {
    worktreeBadgeCount.textContent = String(worktrees.length);
    worktreeBadgeCount.style.display = worktrees.length > 0 ? 'inline-flex' : 'none';
  }

  const elAll = document.getElementById('pr-filter-count-all');
  const elBlocked = document.getElementById('pr-filter-count-blocked');
  const elReady = document.getElementById('pr-filter-count-ready');
  const elPending = document.getElementById('pr-filter-count-pending');

  if (elAll) elAll.textContent = String(pullRequests.length);
  if (elBlocked) elBlocked.textContent = String(pullRequests.filter((p) => p.isBlocked).length);
  if (elReady) elReady.textContent = String(pullRequests.filter((p) => p.isReady).length);
  if (elPending) elPending.textContent = String(pullRequests.filter((p) => p.isPending).length);
}

function switchTab(tabId: string): void {
  activeTab = tabId;
  navTabButtons.forEach((btn) => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach((pane) => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  const toolbarControls = document.getElementById('toolbar-controls');
  if (toolbarControls) {
    toolbarControls.style.display = tabId === 'tab-graph' ? 'flex' : 'none';
  }

  if (tabId === 'tab-graph') {
    renderGraph();
  } else if (tabId === 'tab-file-history') {
    if (!currentFileHistory) {
      vscode.postMessage({ command: 'requestFileHistory' });
    } else {
      renderFileHistory(currentFileHistory);
    }
  } else if (tabId === 'tab-prs') {
    renderPullRequests();
  } else if (tabId === 'tab-worktrees') {
    renderWorktrees();
  } else if (tabId === 'tab-cloud-patches') {
    renderCloudPatches();
  }
}

function renderFileHistory(data: { filePath: string; fileName: string; revisions: FileCommitRevision[] }): void {
  const currentPathEl = document.getElementById('file-history-current-path');
  const timelineEl = document.getElementById('file-history-timeline');
  if (currentPathEl) {
    currentPathEl.textContent = data.filePath || 'Archivo actual';
    currentPathEl.title = data.filePath;
  }
  if (!timelineEl) return;

  if (!data.revisions || data.revisions.length === 0) {
    timelineEl.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-history" style="font-size:32px; color:var(--accent-cyan);"></i>
        <div style="font-weight:600; margin-top:8px;">Sin historial disponible para este archivo</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">No se encontraron commits registrados en Git para esta ruta.</div>
      </div>
    `;
    return;
  }

  timelineEl.innerHTML = data.revisions
    .map(
      (rev) => `
    <div class="history-card">
      <div class="history-card-header">
        <div class="history-author-info">
          <img src="${rev.author.avatarUrl}" class="history-avatar" alt="${rev.author.name}" />
          <div>
            <span class="history-author-name">${rev.author.name}</span>
            <span class="history-date">• ${rev.relativeTime}</span>
          </div>
        </div>
        <span class="commit-hash-pill" style="font-family:var(--vscode-editor-font-family);">${rev.shortHash}</span>
      </div>
      <div class="history-subject">${rev.subject}</div>
      <div class="history-card-footer">
        <div class="diff-deltas">
          ${rev.linesAdded > 0 ? `<span class="diff-badge-added">+${rev.linesAdded}</span>` : ''}
          ${rev.linesDeleted > 0 ? `<span class="diff-badge-deleted">-${rev.linesDeleted}</span>` : ''}
        </div>
        <button class="btn-sm btn-hist-diff" data-hash="${rev.commitHash}" data-file="${data.filePath}">
          <i class="codicon codicon-git-diff"></i> Ver Diferencias
        </button>
      </div>
    </div>
  `
    )
    .join('');

  timelineEl.querySelectorAll('.btn-hist-diff').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hash = btn.getAttribute('data-hash');
      const file = btn.getAttribute('data-file');
      if (hash && file) {
        vscode.postMessage({
          command: 'openFileHistoryDiff',
          payload: { commitHash: hash, filePath: file },
        });
      }
    });
  });
}

function renderPullRequests(): void {
  const listEl = document.getElementById('pr-cards-list');
  if (!listEl) return;

  const filtered = pullRequests.filter((p) => {
    if (prActiveFilter === 'blocked') return p.isBlocked;
    if (prActiveFilter === 'ready') return p.isReady;
    if (prActiveFilter === 'pending') return p.isPending;
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-git-pull-request" style="font-size:32px; color:var(--accent-cyan);"></i>
        <div style="font-weight:600; margin-top:8px;">No hay PRs en esta categoría</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">Todas las solicitudes están al día o no coinciden con el filtro actual.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered
    .map((pr) => {
      let statusBadge = '';
      if (pr.isBlocked) {
        statusBadge = `<span class="pr-chip blocked"><i class="codicon codicon-error"></i> Bloqueada</span>`;
      } else if (pr.isReady) {
        statusBadge = `<span class="pr-chip ready"><i class="codicon codicon-check"></i> Lista</span>`;
      } else {
        statusBadge = `<span class="pr-chip pending"><i class="codicon codicon-clock"></i> Pendiente</span>`;
      }

      const ciChip =
        pr.ciStatus === 'success'
          ? `<span class="pr-chip ci-success"><i class="codicon codicon-pass"></i> CI OK</span>`
          : pr.ciStatus === 'failure'
          ? `<span class="pr-chip ci-failure"><i class="codicon codicon-error"></i> CI Falló</span>`
          : '';

      return `
        <div class="pr-card">
          <div class="pr-card-header">
            <div class="pr-title-row">
              <span class="pr-number">#${pr.number}</span>
              <span>${pr.title}</span>
            </div>
            <div class="pr-status-chips">
              ${statusBadge}
              ${ciChip}
            </div>
          </div>
          <div class="pr-branches-row">
            <span class="branch-badge-pill">${pr.sourceBranch}</span>
            <i class="codicon codicon-arrow-right" style="font-size:12px;"></i>
            <span class="branch-badge-pill">${pr.targetBranch}</span>
            <span style="margin-left:auto;">${pr.updatedAt}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; font-size:var(--font-size-xs); color:var(--text-muted);">
            <img src="${pr.author.avatarUrl}" style="width:16px; height:16px; border-radius:50%;" alt="${pr.author.name}" />
            <span>${pr.author.name}</span>
          </div>
          <div class="pr-card-actions">
            <button class="btn-sm btn-pr-checkout" data-pr="${pr.number}" data-branch="${pr.sourceBranch}" title="Checkout local de esta rama">
              <i class="codicon codicon-arrow-swap"></i> Checkout
            </button>
            ${
              pr.url
                ? `<button class="btn-sm btn-pr-open" data-url="${pr.url}" title="Abrir en remoto">
                     <i class="codicon codicon-link-external"></i> Ver en Web
                   </button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll('.btn-pr-checkout').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prNumber = parseInt(btn.getAttribute('data-pr') || '0', 10);
      const branchName = btn.getAttribute('data-branch') || '';
      if (prNumber && branchName) {
        vscode.postMessage({
          command: 'checkoutPullRequest',
          payload: { prNumber, branchName },
        });
      }
    });
  });

  listEl.querySelectorAll('.btn-pr-open').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        vscode.postMessage({ command: 'openExternal', payload: url });
      }
    });
  });
}

function renderWorktrees(): void {
  const listEl = document.getElementById('worktrees-cards-list');
  if (!listEl) return;

  if (worktrees.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-repo-forked" style="font-size:32px; color:var(--accent-cyan);"></i>
        <div style="font-weight:600; margin-top:8px;">No hay Worktrees configurados</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">Haz clic en "Nuevo Worktree" para trabajar en otra rama en paralelo sin cambiar de carpeta.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = worktrees
    .map(
      (wt) => `
    <div class="worktree-card ${wt.isCurrent ? 'active-worktree' : ''}">
      <div class="worktree-top-row">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="branch-badge-pill" style="font-size:var(--font-size-sm);">${wt.branch}</span>
          ${wt.isCurrent ? '<span style="font-size:10px; font-weight:700; color:var(--accent-cyan);">(Activo)</span>' : ''}
        </div>
        ${
          wt.hasWip
            ? `<span class="wip-badge active-wip" title="${wt.wipFilesCount} archivos modificados"><i class="codicon codicon-warning"></i> WIP (${wt.wipFilesCount} archivos: +${wt.wipAdded} ~${wt.wipModified} -${wt.wipDeleted})</span>`
            : '<span class="wip-badge clean"><i class="codicon codicon-check"></i> Limpio (Sin cambios)</span>'
        }
      </div>
      <div class="worktree-path">${wt.path}</div>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
        <button class="btn-sm btn-wt-open" data-path="${wt.path}" title="Abrir esta carpeta en VS Code">
          <i class="codicon codicon-folder-opened"></i> Abrir en VS Code
        </button>
        ${
          !wt.isCurrent
            ? `<button class="btn-sm btn-wt-remove" data-path="${wt.path}" title="Eliminar este worktree">
                 <i class="codicon codicon-trash"></i> Eliminar
               </button>`
            : ''
        }
      </div>
    </div>
  `
    )
    .join('');

  listEl.querySelectorAll('.btn-wt-open').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-path');
      if (p) vscode.postMessage({ command: 'openWorktree', payload: { path: p } });
    });
  });

  listEl.querySelectorAll('.btn-wt-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-path');
      if (p && confirm(`¿Seguro que deseas eliminar el worktree en "${p}"?`)) {
        vscode.postMessage({ command: 'removeWorktree', payload: { path: p, force: false } });
      }
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCloudPatches(): void {
  const listEl = document.getElementById('cloud-patches-list');
  if (!listEl) return;

  if (savedPatches.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-cloud-upload" style="font-size:32px; color:var(--accent-cyan);"></i>
        <div style="font-weight:600; margin-top:8px;">No hay Cloud Patches guardados</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); text-align:center; margin-top:4px;">
          Crea un Cloud Patch a partir de tus cambios locales para compartirlos al instante sin hacer push a una rama remota.
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = savedPatches
    .map(
      (p) => `
    <div class="patch-card">
      <div class="patch-header-row">
        <span class="patch-title">${p.title}</span>
        <span style="font-size:var(--font-size-xs); color:var(--text-muted);">${new Date(p.createdAt).toLocaleTimeString()}</span>
      </div>
      <div style="font-size:var(--font-size-xs); color:var(--text-muted);">${p.summary}</div>
      <pre class="patch-diff-preview"><code>${escapeHtml(p.patchContent.slice(0, 500))}${p.patchContent.length > 500 ? '\n... (truncado)' : ''}</code></pre>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
        <button class="btn-sm btn-copy-patch" data-id="${p.id}" title="Copiar diff completo al portapapeles">
          <i class="codicon codicon-copy"></i> Copiar
        </button>
        <button class="btn-sm btn-apply-saved-patch" data-id="${p.id}" title="Aplicar este parche al código local">
          <i class="codicon codicon-cloud-download"></i> Aplicar
        </button>
        <button class="btn-sm btn-delete-patch" data-id="${p.id}" title="Eliminar de la lista">
          <i class="codicon codicon-trash"></i>
        </button>
      </div>
    </div>
  `
    )
    .join('');

  listEl.querySelectorAll('.btn-copy-patch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const patch = savedPatches.find((x) => x.id === id);
      if (patch) {
        vscode.postMessage({ command: 'copyToClipboard', payload: patch.patchContent });
      }
    });
  });

  listEl.querySelectorAll('.btn-apply-saved-patch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const patch = savedPatches.find((x) => x.id === id);
      if (patch) {
        vscode.postMessage({
          command: 'applyCloudPatch',
          payload: { patchContent: patch.patchContent, reverse: false },
        });
      }
    });
  });

  listEl.querySelectorAll('.btn-delete-patch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      savedPatches = savedPatches.filter((x) => x.id !== id);
      renderCloudPatches();
    });
  });
}

function handlePatchCreated(patch: CloudPatch): void {
  savedPatches.unshift(patch);
  closePatchCreateModal();
  switchTab('tab-cloud-patches');
}

function handlePatchApplied(result: { success: boolean; message: string }): void {
  closePatchApplyModal();
  vscode.postMessage({ command: 'requestData' });
}

function openPatchCreateModal(): void {
  if (patchTitleInput) patchTitleInput.value = '';
  if (patchDescInput) patchDescInput.value = '';
  patchCreateModal?.classList.add('open');
}

function closePatchCreateModal(): void {
  patchCreateModal?.classList.remove('open');
}

function openPatchApplyModal(): void {
  if (patchApplyContent) patchApplyContent.value = '';
  patchApplyModal?.classList.add('open');
}

function closePatchApplyModal(): void {
  patchApplyModal?.classList.remove('open');
}

function openWorktreeModal(): void {
  if (wtBranchInput) wtBranchInput.value = '';
  if (wtPathInput) wtPathInput.value = '';
  worktreeCreateModal?.classList.add('open');
}

function closeWorktreeModal(): void {
  worktreeCreateModal?.classList.remove('open');
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
    closeWorktreeModal();
    closePatchCreateModal();
    closePatchApplyModal();
    layoutPickerPopover?.classList.remove('visible');
    hideHoverPopover();
  }
});

// Layout Mode Switcher Listeners
btnLayoutMode?.addEventListener('click', (e) => {
  e.stopPropagation();
  layoutPickerPopover?.classList.toggle('visible');
});

document.addEventListener('click', (e) => {
  if (layoutPickerPopover && !layoutPickerPopover.contains(e.target as Node) && e.target !== btnLayoutMode) {
    layoutPickerPopover.classList.remove('visible');
  }
});

document.querySelectorAll('.layout-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    const mode = opt.getAttribute('data-layout') as LayoutMode;
    if (mode) {
      applyLayoutMode(mode, true);
      layoutPickerPopover?.classList.remove('visible');
    }
  });
});

// Tab Switcher Listeners
navTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    if (tabId) switchTab(tabId);
  });
});

// PR Filters
document.querySelectorAll('.pr-filter-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pr-filter-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    prActiveFilter = (btn.getAttribute('data-filter') as any) || 'all';
    renderPullRequests();
  });
});

// Worktree Modal Events
btnAddWorktree?.addEventListener('click', openWorktreeModal);
worktreeModalClose?.addEventListener('click', closeWorktreeModal);
wtBtnCancel?.addEventListener('click', closeWorktreeModal);
wtBtnSubmit?.addEventListener('click', () => {
  const branch = wtBranchInput?.value.trim() || '';
  const path = wtPathInput?.value.trim() || '';
  if (branch && path) {
    vscode.postMessage({
      command: 'addWorktree',
      payload: { branch, path },
    });
    closeWorktreeModal();
  }
});

// Patch Modal Events
btnCreatePatch?.addEventListener('click', openPatchCreateModal);
patchModalClose?.addEventListener('click', closePatchCreateModal);
patchBtnCancel?.addEventListener('click', closePatchCreateModal);
patchBtnSubmit?.addEventListener('click', () => {
  const title = patchTitleInput?.value.trim() || 'WIP Patch';
  const desc = patchDescInput?.value.trim() || '';
  vscode.postMessage({
    command: 'createCloudPatch',
    payload: { title, description: desc },
  });
});

btnApplyPatch?.addEventListener('click', openPatchApplyModal);
patchApplyClose?.addEventListener('click', closePatchApplyModal);
patchApplyBtnCancel?.addEventListener('click', closePatchApplyModal);
patchApplyBtnSubmit?.addEventListener('click', () => {
  const content = patchApplyContent?.value.trim() || '';
  if (content) {
    vscode.postMessage({
      command: 'applyCloudPatch',
      payload: { patchContent: content, reverse: false },
    });
  }
});

// Pick File for History
btnPickFileHistory?.addEventListener('click', () => {
  vscode.postMessage({ command: 'requestFileHistory' });
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
    renderGraph();
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
