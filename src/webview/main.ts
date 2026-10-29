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
  ThemeMode,
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
let currentTheme: ThemeMode = 'auto';
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
const btnThemeMode = document.getElementById('btn-theme-mode') as HTMLButtonElement | null;
const themePickerPopover = document.getElementById('theme-picker-popover') as HTMLElement | null;
const btnChangelog = document.getElementById('btn-changelog') as HTMLButtonElement | null;
const btnUndoCommit = document.getElementById('btn-undo-commit') as HTMLButtonElement | null;
const btnReflog = document.getElementById('btn-reflog') as HTMLButtonElement | null;
const btnRepoHealth = document.getElementById('btn-repo-health') as HTMLButtonElement | null;

// Diagnostics & Time Machine Modals
const reflogModal = document.getElementById('reflog-modal') as HTMLElement | null;
const reflogModalClose = document.getElementById('reflog-modal-close') as HTMLButtonElement | null;
const reflogModalBody = document.getElementById('reflog-modal-body') as HTMLElement | null;

const repoHealthModal = document.getElementById('repo-health-modal') as HTMLElement | null;
const repoHealthModalClose = document.getElementById('repo-health-modal-close') as HTMLButtonElement | null;
const repoHealthModalBody = document.getElementById('repo-health-modal-body') as HTMLElement | null;

const comparisonModal = document.getElementById('comparison-modal') as HTMLElement | null;
const comparisonModalClose = document.getElementById('comparison-modal-close') as HTMLButtonElement | null;
const comparisonModalBody = document.getElementById('comparison-modal-body') as HTMLElement | null;
const comparisonModalTitle = document.getElementById('comparison-modal-title') as HTMLElement | null;

// Git Bisect Assistant & Conflict Forecaster Elements
let bisectStatus: GitBisectStatus | null = null;
const btnBisect = document.getElementById('btn-bisect') as HTMLButtonElement | null;
const bisectBanner = document.getElementById('bisect-banner') as HTMLElement | null;
const bisectCurrentHash = document.getElementById('bisect-current-hash') as HTMLElement | null;
const bisectStepsLeft = document.getElementById('bisect-steps-left') as HTMLElement | null;
const btnBisectGood = document.getElementById('btn-bisect-good') as HTMLButtonElement | null;
const btnBisectBad = document.getElementById('btn-bisect-bad') as HTMLButtonElement | null;
const btnBisectSkip = document.getElementById('btn-bisect-skip') as HTMLButtonElement | null;
const btnBisectReset = document.getElementById('btn-bisect-reset') as HTMLButtonElement | null;

const bisectModal = document.getElementById('bisect-modal') as HTMLElement | null;
const bisectModalClose = document.getElementById('bisect-modal-close') as HTMLButtonElement | null;
const bisectBadInput = document.getElementById('bisect-bad-input') as HTMLInputElement | null;
const bisectGoodInput = document.getElementById('bisect-good-input') as HTMLInputElement | null;
const bisectBtnCancel = document.getElementById('bisect-btn-cancel') as HTMLButtonElement | null;
const bisectBtnStart = document.getElementById('bisect-btn-start') as HTMLButtonElement | null;

const cherryPickForecastModal = document.getElementById('cherry-pick-forecast-modal') as HTMLElement | null;
const cherryPickForecastClose = document.getElementById('cherry-pick-forecast-close') as HTMLButtonElement | null;
const cherryPickForecastBody = document.getElementById('cherry-pick-forecast-body') as HTMLElement | null;

// Tag Modal
const tagCreateModal = document.getElementById('tag-create-modal') as HTMLElement | null;
const tagModalClose = document.getElementById('tag-modal-close') as HTMLButtonElement | null;
const tagBtnCancel = document.getElementById('tag-btn-cancel') as HTMLButtonElement | null;
const tagBtnSubmit = document.getElementById('tag-btn-submit') as HTMLButtonElement | null;
const tagNameInput = document.getElementById('tag-name-input') as HTMLInputElement | null;
const tagMessageInput = document.getElementById('tag-message-input') as HTMLTextAreaElement | null;
const tagTargetHash = document.getElementById('tag-target-hash') as HTMLInputElement | null;
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
const btnOpenFork = document.getElementById('btn-open-fork') as HTMLButtonElement | null;
const issuesBadgeCount = document.getElementById('issues-badge-count') as HTMLElement | null;
const issueDrawer = document.getElementById('issue-drawer') as HTMLElement | null;
const issueDrawerCloseBtn = document.getElementById('issue-drawer-close-btn') as HTMLButtonElement | null;
const issueDrawerTitle = document.getElementById('issue-drawer-title') as HTMLElement | null;
const issueDrawerBody = document.getElementById('issue-drawer-body') as HTMLElement | null;
const issuesSearchInput = document.getElementById('issues-search-input') as HTMLInputElement | null;
const linkedIssueSpotlight = document.getElementById('linked-issue-spotlight') as HTMLElement | null;
const issuesCardsList = document.getElementById('issues-cards-list') as HTMLElement | null;

let issuesHubData: {
  assigned: any[];
  linked: any[];
  allIssues: any[];
  defaultFilter?: string;
} = {
  assigned: [],
  linked: [],
  allIssues: [],
};

let activeIssueFilter = 'assignedToMe';
let issueSearchQuery = '';

// Responsive Layout State
let isCompactLayout = false;
let isNanoLayout = false;

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
  if (isNanoLayout) return 9;
  if (isCompactLayout) return 11;
  if (currentDensity === 'compact') return 14;
  if (currentDensity === 'spacious') return 18;
  return 16;
}

function getLaneOffset(): number {
  if (isNanoLayout) return 6;
  if (isCompactLayout) return 8;
  if (currentDensity === 'compact') return 12;
  if (currentDensity === 'spacious') return 16;
  return 14;
}

function getNodeRadius(): number {
  if (isNanoLayout) return 2.5;
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
function applyTheme(theme: ThemeMode): void {
  currentTheme = theme;
  document.body.classList.remove(
    'theme-light',
    'theme-dark',
    'theme-cyberpunk',
    'theme-dracula',
    'theme-github',
    'theme-neon-pink',
    'theme-neon-green',
    'theme-neon-blue'
  );
  if (theme !== 'auto') {
    document.body.classList.add(`theme-${theme}`);
  }

  // Update active state in theme popover
  document.querySelectorAll('.theme-option').forEach((opt) => {
    if (opt.getAttribute('data-theme') === theme) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  const cfgThemeSelect = document.getElementById('cfg-theme') as HTMLSelectElement | null;
  if (cfgThemeSelect && cfgThemeSelect.value !== theme) {
    cfgThemeSelect.value = theme;
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

      if (btnOpenFork) {
        btnOpenFork.style.display =
          message.payload.forkInstalled && message.payload.forkEnabled !== false ? 'inline-flex' : 'none';
      }

      bisectStatus = message.payload.bisectStatus || null;
      updateBisectBanner();

      if (activeTab === 'tab-worktrees') renderWorktrees();
      if (activeTab === 'tab-prs') renderPullRequests();
      if (activeTab === 'tab-issues') renderIssues();
      break;

    case 'bisectStatusData':
      bisectStatus = message.payload || null;
      updateBisectBanner();
      renderTable();
      break;

    case 'cherryPickPreviewData':
      handleCherryPickPreview(message.payload);
      break;

    case 'issuesData':
      handleIssuesData(message.payload);
      break;

    case 'issueDetailsData':
      handleIssueDetailsData(message.payload);
      break;

    case 'issueCommentAdded':
      handleIssueCommentAdded(message.payload);
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

    case 'reflogData':
      renderReflogModal(message.payload || []);
      break;

    case 'repoHealthData':
      renderRepoHealthModal(message.payload);
      break;

    case 'comparisonData':
      renderComparisonModal(message.payload);
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

    case 'changelogReady':
      // The changelog markdown has been copied to clipboard
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
  if (btnPopout) btnPopout.title = tr('action.popout');
  if (btnLayoutMode) btnLayoutMode.title = tr('layout.toggleTitle');
  if (btnThemeMode) btnThemeMode.title = tr('toolbar.themePicker');
  if (btnChangelog) btnChangelog.title = tr('toolbar.changelog');
  if (btnUndoCommit) btnUndoCommit.title = tr('toolbar.undoCommit');
  if (activeBranchPill) activeBranchPill.title = tr('toolbar.activeBranch');
  if (searchClearBtn) searchClearBtn.title = tr('toolbar.searchClear');

  // Tag Modal titles/placeholders
  const tagModalTitle = document.querySelector('#tag-create-modal .modal-header span');
  if (tagModalTitle) tagModalTitle.textContent = tr('tag.modalTitle');
  if (tagNameInput) tagNameInput.placeholder = tr('tag.tagNamePlaceholder');
  if (tagMessageInput) tagMessageInput.placeholder = tr('tag.messagePlaceholder');
  if (tagBtnCancel) tagBtnCancel.textContent = tr('tag.cancel');
  if (tagBtnSubmit) tagBtnSubmit.textContent = tr('tag.submit');

  // Navigation tab titles and texts
  const tabGraph = document.querySelector('.nav-tab-btn[data-tab="tab-graph"]') as HTMLElement | null;
  const tabHistory = document.querySelector('.nav-tab-btn[data-tab="tab-file-history"]') as HTMLElement | null;
  const tabPrs = document.querySelector('.nav-tab-btn[data-tab="tab-prs"]') as HTMLElement | null;
  const tabWorktrees = document.querySelector('.nav-tab-btn[data-tab="tab-worktrees"]') as HTMLElement | null;
  const tabPatches = document.querySelector('.nav-tab-btn[data-tab="tab-cloud-patches"]') as HTMLElement | null;

  if (tabGraph) tabGraph.title = tr('tabs.graphTitle');
  if (tabHistory) tabHistory.title = tr('tabs.fileHistoryTitle');
  if (tabPrs) tabPrs.title = tr('tabs.prsTitle');
  if (tabWorktrees) tabWorktrees.title = tr('tabs.worktreesTitle');
  if (tabPatches) tabPatches.title = tr('tabs.cloudPatchesTitle');

  const textGraph = document.getElementById('nav-tab-text-graph');
  const textHistory = document.getElementById('nav-tab-text-history');
  const textPrs = document.getElementById('nav-tab-text-prs');
  const textWorktrees = document.getElementById('nav-tab-text-worktrees');
  const textPatches = document.getElementById('nav-tab-text-patches');

  if (textGraph) textGraph.textContent = tr('tabs.graph');
  if (textHistory) textHistory.textContent = tr('tabs.fileHistory');
  if (textPrs) textPrs.textContent = tr('tabs.prs');
  if (textWorktrees) textWorktrees.textContent = tr('tabs.worktrees');
  if (textPatches) textPatches.textContent = tr('tabs.cloudPatches');

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
    const isBisectCurrent = Boolean(
      bisectStatus?.isActive &&
        (bisectStatus.currentCommit === node.commit.hash ||
          bisectStatus.currentShortCommit === node.commit.shortHash)
    );
    const isBisectGood = Boolean(
      bisectStatus?.isActive &&
        bisectStatus.goodCommits.some((h) => h === node.commit.hash || node.commit.hash.startsWith(h))
    );
    const isBisectBad = Boolean(
      bisectStatus?.isActive &&
        bisectStatus.badCommit &&
        (node.commit.hash === bisectStatus.badCommit ||
          node.commit.hash.startsWith(bisectStatus.badCommit))
    );
    const bisectClass = isBisectCurrent ? 'row-bisect-current' : '';
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
      row.className = `commit-row compact-card ${isSelected ? 'selected' : ''} ${bisectClass}`;

      const cardBody = document.createElement('div');
      cardBody.className = 'commit-card-body';

      // Line 1: Refs + Subject
      const cardTop = document.createElement('div');
      cardTop.className = 'commit-card-top';

      if (isBisectCurrent) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag current';
        bBadge.innerHTML = `<i class="codicon codicon-search"></i> PROBE`;
        cardTop.appendChild(bBadge);
      } else if (isBisectGood) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag good';
        bBadge.innerHTML = `<i class="codicon codicon-check"></i> GOOD`;
        cardTop.appendChild(bBadge);
      } else if (isBisectBad) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag bad';
        bBadge.innerHTML = `<i class="codicon codicon-close"></i> BAD`;
        cardTop.appendChild(bBadge);
      }

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
      subjectSpan.innerHTML = formatCommitSubjectWithIssues(node.commit.subject);
      subjectSpan.title = node.commit.subject;
      cardTop.appendChild(subjectSpan);

      if (node.commit.signatureStatus === 'valid') {
        const sigBadge = document.createElement('span');
        sigBadge.className = 'commit-sig-badge valid';
        sigBadge.title = `Firma digital verificada (GPG/SSH)\nFirmante: ${node.commit.signer || 'Desconocido'}\nKey ID: ${node.commit.keyId || 'N/A'}`;
        sigBadge.innerHTML = `<i class="codicon codicon-verified" style="font-size:11px;"></i>`;
        cardTop.appendChild(sigBadge);
      }

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
      row.className = `commit-row ${isSelected ? 'selected' : ''} ${bisectClass}`;

      // 2. Info Column (Refs + Subject)
      const infoCol = document.createElement('div');
      infoCol.className = 'commit-info-col';

      if (isBisectCurrent) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag current';
        bBadge.innerHTML = `<i class="codicon codicon-search"></i> PROBE`;
        infoCol.appendChild(bBadge);
      } else if (isBisectGood) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag good';
        bBadge.innerHTML = `<i class="codicon codicon-check"></i> GOOD`;
        infoCol.appendChild(bBadge);
      } else if (isBisectBad) {
        const bBadge = document.createElement('span');
        bBadge.className = 'bisect-badge-tag bad';
        bBadge.innerHTML = `<i class="codicon codicon-close"></i> BAD`;
        infoCol.appendChild(bBadge);
      }

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
      subjectSpan.innerHTML = formatCommitSubjectWithIssues(node.commit.subject);
      subjectSpan.title = node.commit.subject;
      infoCol.appendChild(subjectSpan);

      if (node.commit.signatureStatus === 'valid') {
        const sigBadge = document.createElement('span');
        sigBadge.className = 'commit-sig-badge valid';
        sigBadge.title = `Firma digital verificada (GPG/SSH)\nFirmante: ${node.commit.signer || 'Desconocido'}\nKey ID: ${node.commit.keyId || 'N/A'}`;
        sigBadge.innerHTML = `<i class="codicon codicon-verified" style="font-size:11px;"></i>`;
        infoCol.appendChild(sigBadge);
      }

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

      const btnCherryPick = document.createElement('button');
      btnCherryPick.className = 'btn-row-action';
      btnCherryPick.title = tr('drawer.cherryPick');
      btnCherryPick.innerHTML = `<i class="codicon codicon-git-pull-request-go-to-changes"></i>`;
      btnCherryPick.addEventListener('click', (e) => {
        e.stopPropagation();
        initiateCherryPick(node.commit.hash, node.commit.shortHash);
      });

      const btnCreateTag = document.createElement('button');
      btnCreateTag.className = 'btn-row-action';
      btnCreateTag.title = tr('drawer.createTag');
      btnCreateTag.innerHTML = `<i class="codicon codicon-tag"></i>`;
      btnCreateTag.addEventListener('click', (e) => {
        e.stopPropagation();
        openTagModal(node.commit.hash);
      });

      rowActions.appendChild(btnCopySha);
      rowActions.appendChild(btnCopyMsg);
      rowActions.appendChild(btnCheckoutRow);
      rowActions.appendChild(btnCherryPick);
      rowActions.appendChild(btnCreateTag);
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

  const popoverWidth = Math.min(300, window.innerWidth - 20);
  const popoverHeight = 130;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

  // Clamp top position: if bottom doesn't fit, flip to top
  let top = rect.bottom + 4;
  if (top + popoverHeight > window.innerHeight) {
    top = Math.max(8, rect.top - popoverHeight - 4);
  }

  // Clamp left position: ensure at least 8px from left and right viewport edges
  let left = rect.left + 40;
  if (left + popoverWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - popoverWidth - 8);
  }

  hoverPopover.style.top = `${Math.round(top)}px`;
  hoverPopover.style.left = `${Math.round(left)}px`;
  hoverPopover.style.maxWidth = `${popoverWidth}px`;
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

    ${
      commit.signatureStatus === 'valid'
        ? `<div class="sig-verified-banner">
             <i class="codicon codicon-verified" style="color:#10b981; font-size:16px;"></i>
             <div style="display:flex; flex-direction:column;">
               <span style="font-weight:600; font-size:var(--font-size-xs); color:#10b981;">Firma Digital Verificada (GPG/SSH)</span>
               <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(commit.signer || 'Firmante verificado')} ${commit.keyId ? `(Key ID: ${escapeHtml(commit.keyId)})` : ''}</span>
             </div>
           </div>`
        : commit.signatureStatus === 'invalid'
        ? `<div class="sig-invalid-banner">
             <i class="codicon codicon-error" style="color:#ef4444; font-size:16px;"></i>
             <span style="font-size:var(--font-size-xs); color:#ef4444; font-weight:600;">Firma Digital Inválida</span>
           </div>`
        : ''
    }

    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button class="btn-icon" id="btn-copy-sha">
        <i class="codicon codicon-copy"></i> ${tr('drawer.copySha')} (${commit.shortHash})
      </button>
      <button class="btn-icon" id="btn-copy-msg">
        <i class="codicon codicon-comment"></i> ${tr('drawer.copyMsg')}
      </button>
      <button class="btn-icon" id="btn-drawer-compare" title="Comparar con HEAD">
        <i class="codicon codicon-diff"></i> Comparar con HEAD
      </button>
      <button class="btn-icon" id="btn-drawer-cherry-pick" title="${tr('drawer.cherryPick')}">
        <i class="codicon codicon-git-pull-request-go-to-changes"></i> ${tr('drawer.cherryPick')}
      </button>
      <button class="btn-icon" id="btn-drawer-bisect" title="Iniciar Bisect usando este commit como Malo (Bad)">
        <i class="codicon codicon-search"></i> Bisect
      </button>
      <button class="btn-icon" id="btn-drawer-revert" title="${tr('drawer.revert')}">
        <i class="codicon codicon-history"></i> ${tr('drawer.revert')}
      </button>
      <button class="btn-icon" id="btn-drawer-create-tag" title="${tr('drawer.createTag')}">
        <i class="codicon codicon-tag"></i> ${tr('drawer.createTag')}
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

  document.getElementById('btn-drawer-compare')?.addEventListener('click', () => {
    vscode.postMessage({
      command: 'compareCommits',
      payload: { baseHash: commit.hash, targetHash: 'HEAD' },
    });
  });

  document.getElementById('btn-drawer-cherry-pick')?.addEventListener('click', () => {
    initiateCherryPick(commit.hash, commit.shortHash);
  });

  document.getElementById('btn-drawer-bisect')?.addEventListener('click', () => {
    openBisectModal(commit.hash);
  });

  document.getElementById('btn-drawer-revert')?.addEventListener('click', () => {
    if (confirm(tr('drawer.confirmRevert', { hash: commit.shortHash }))) {
      vscode.postMessage({ command: 'revertCommit', payload: { hash: commit.hash } });
    }
  });

  document.getElementById('btn-drawer-create-tag')?.addEventListener('click', () => {
    openTagModal(commit.hash);
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
    countBadge.textContent =
      files.length === 1
        ? tr('drawer.fileCount', { count: files.length })
        : tr('drawer.fileCountPlural', { count: files.length });
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
      <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden; text-overflow:ellipsis; flex:1;">
        <span class="status-badge status-${file.status}" style="flex-shrink:0;">${file.status}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0; margin-left:6px;">
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
              <option value="cyberpunk" ${settings.theme === 'cyberpunk' ? 'selected' : ''}>${tr('settings.themeCyberpunk')}</option>
              <option value="dracula" ${settings.theme === 'dracula' ? 'selected' : ''}>${tr('settings.themeDracula')}</option>
              <option value="github" ${settings.theme === 'github' ? 'selected' : ''}>${tr('settings.themeGithub')}</option>
              <option value="neon-pink" ${settings.theme === 'neon-pink' ? 'selected' : ''}>${tr('settings.themeNeonPink')}</option>
              <option value="neon-green" ${settings.theme === 'neon-green' ? 'selected' : ''}>${tr('settings.themeNeonGreen')}</option>
              <option value="neon-blue" ${settings.theme === 'neon-blue' ? 'selected' : ''}>${tr('settings.themeNeonBlue')}</option>
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

// Git Reflog Time Machine Modal
function openReflogModal(): void {
  vscode.postMessage({ command: 'requestReflog', payload: { limit: 50 } });
}

function closeReflogModal(): void {
  reflogModal?.classList.remove('open');
}

function renderReflogModal(entries: GitReflogEntry[]): void {
  if (!reflogModal || !reflogModalBody) return;
  if (!entries || entries.length === 0) {
    reflogModalBody.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">No hay entradas de reflog disponibles.</div>`;
    reflogModal.classList.add('open');
    return;
  }

  reflogModalBody.innerHTML = `
    <div style="font-size:var(--font-size-xs); color:var(--text-muted); margin-bottom:8px;">
      El Git Reflog registra cada movimiento de HEAD (checkouts, merges, resets, commits huérfanos). Puedes restaurar cualquier commit perdido en una nueva rama con 1-clic.
    </div>
    <div class="reflog-list">
      ${entries
        .map((entry) => {
          let actionClass = 'commit';
          const actLower = (entry.action || '').toLowerCase();
          if (actLower.includes('checkout')) actionClass = 'checkout';
          else if (actLower.includes('merge')) actionClass = 'merge';
          else if (actLower.includes('reset')) actionClass = 'reset';

          return `
            <div class="reflog-entry-item">
              <div class="reflog-entry-meta">
                <div class="reflog-entry-row1">
                  <span class="reflog-selector-pill">${escapeHtml(entry.selector)}</span>
                  <span class="reflog-action-badge ${actionClass}">${escapeHtml(entry.action)}</span>
                  <span class="commit-hash-badge">${entry.hash.slice(0, 7)}</span>
                  <span style="font-size:var(--font-size-xs); color:var(--text-muted);">${escapeHtml(entry.date)}</span>
                </div>
                <div class="reflog-entry-message" title="${escapeHtml(entry.message)}">${escapeHtml(entry.message)}</div>
              </div>
              <button class="btn-sm btn-primary btn-restore-reflog" data-hash="${entry.hash}" title="Crear rama desde este commit">
                <i class="codicon codicon-history"></i> Recuperar
              </button>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  reflogModalBody.querySelectorAll('.btn-restore-reflog').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hash = btn.getAttribute('data-hash');
      if (hash) {
        const defaultBranchName = `recovered-${hash.slice(0, 7)}`;
        const branchName = prompt('Nombre de la nueva rama para restaurar el commit:', defaultBranchName);
        if (branchName && branchName.trim()) {
          vscode.postMessage({
            command: 'restoreReflogCommit',
            payload: { commitHash: hash, branchName: branchName.trim() },
          });
          closeReflogModal();
        }
      }
    });
  });

  reflogModal.classList.add('open');
}

// Repository Health & Storage Diagnostics Modal
function openRepoHealthModal(): void {
  vscode.postMessage({ command: 'requestRepoHealth' });
}

function closeRepoHealthModal(): void {
  repoHealthModal?.classList.remove('open');
}

function renderRepoHealthModal(health: RepoHealthMetrics): void {
  if (!repoHealthModal || !repoHealthModalBody) return;
  if (!health) return;

  const isWarning = health.looseObjectsCount > 500 || health.danglingCommitsCount > 20;

  repoHealthModalBody.innerHTML = `
    <div class="health-diagnostics-grid">
      <div class="health-metric-tile">
        <div class="health-metric-label">Espacio en Disco</div>
        <div class="health-metric-value">${escapeHtml(health.diskSizeFormatted)}</div>
      </div>
      <div class="health-metric-tile">
        <div class="health-metric-label">Objetos Sueltos</div>
        <div class="health-metric-value">${health.looseObjectsCount}</div>
      </div>
      <div class="health-metric-tile">
        <div class="health-metric-label">Archivos Pack</div>
        <div class="health-metric-value">${health.packfilesCount}</div>
      </div>
      <div class="health-metric-tile">
        <div class="health-metric-label">Commits Huérfanos</div>
        <div class="health-metric-value">${health.danglingCommitsCount}</div>
      </div>
    </div>

    <div class="health-status-banner ${isWarning ? 'warning' : ''}">
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="codicon ${isWarning ? 'codicon-warning' : 'codicon-check-all'}" style="font-size:20px; color:${isWarning ? 'var(--accent-amber)' : 'var(--accent-emerald)'};"></i>
        <div style="font-size:var(--font-size-sm);">
          <strong>${isWarning ? 'Atención de Mantenimiento Requerida' : 'Estado del Repositorio Óptimo'}</strong>
          <div style="color:var(--text-muted); font-size:var(--font-size-xs); margin-top:2px;">
            ${
              isWarning
                ? 'Se han detectado objetos sueltos o huérfanos. Ejecutar Git Garbage Collection compactará los packs y optimizará las consultas.'
                : 'El almacenamiento está compactado y las estructuras de objetos .git responden con máxima velocidad.'
            }
          </div>
        </div>
      </div>
      <button id="btn-run-gc-action" class="btn-sm btn-primary" style="white-space:nowrap;">
        <i class="codicon codicon-zap"></i> Optimizar (git gc)
      </button>
    </div>
  `;

  document.getElementById('btn-run-gc-action')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'runRepoGc' });
    closeRepoHealthModal();
  });

  repoHealthModal.classList.add('open');
}

// Multi-Commit Diff Comparison Modal
function closeComparisonModal(): void {
  comparisonModal?.classList.remove('open');
}

function renderComparisonModal(comparison: CommitComparisonResult): void {
  if (!comparisonModal || !comparisonModalBody) return;
  if (!comparison) return;

  if (comparisonModalTitle) {
    comparisonModalTitle.textContent = `Comparación: ${comparison.baseHash.slice(0, 7)} ➔ ${comparison.targetHash.slice(0, 7)}`;
  }

  const filesHtml = comparison.files
    .map(
      (f) => `
      <div class="comparison-file-item" data-path="${escapeHtml(f.path)}">
        <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
          <i class="codicon codicon-file"></i>
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.path)}</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
          <span class="diff-additions-pill">+${f.additions}</span>
          <span class="diff-deletions-pill">-${f.deletions}</span>
        </div>
      </div>
    `
    )
    .join('');

  const commitsBetweenHtml = (comparison.commitsBetween || [])
    .map(
      (c) => `
      <div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:var(--font-size-xs);">
        <span class="commit-hash-badge">${c.slice(0, 7)}</span>
        <span style="color:var(--text-muted);">${c}</span>
      </div>
    `
    )
    .join('');

  comparisonModalBody.innerHTML = `
    <div class="comparison-summary-header">
      <div>
        <div style="font-weight:600; font-size:var(--font-size-sm);">
          ${comparison.files.length} archivos modificados
        </div>
        <div style="color:var(--text-muted); font-size:var(--font-size-xs); margin-top:2px;">
          ${(comparison.commitsBetween || []).length} commits en este rango
        </div>
      </div>
      <div class="comparison-stats-pills">
        <span class="diff-additions-pill">+${comparison.totalAdditions}</span>
        <span class="diff-deletions-pill">-${comparison.totalDeletions}</span>
      </div>
    </div>

    ${
      comparison.commitsBetween && comparison.commitsBetween.length > 0
        ? `
        <div style="background:var(--bg-glass); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 12px; margin-top:8px;">
          <div style="font-weight:600; font-size:var(--font-size-xs); color:var(--text-muted); margin-bottom:4px;">Commits incluidos en el rango:</div>
          <div style="max-height:100px; overflow-y:auto;">${commitsBetweenHtml}</div>
        </div>
      `
        : ''
    }

    <div style="margin-top:10px;">
      <div style="font-weight:600; font-size:var(--font-size-xs); color:var(--text-muted); margin-bottom:6px;">Archivos afectados (haz clic para ver diff):</div>
      <div class="comparison-files-list">
        ${filesHtml || '<div style="color:var(--text-muted); font-size:var(--font-size-sm);">Sin cambios detectados entre estas dos revisiones.</div>'}
      </div>
    </div>
  `;

  comparisonModalBody.querySelectorAll('.comparison-file-item').forEach((item) => {
    item.addEventListener('click', () => {
      const filePath = item.getAttribute('data-path');
      if (filePath) {
        vscode.postMessage({
          command: 'openDiff',
          payload: {
            filePath,
            commitHash: comparison.targetHash,
            parentHash: comparison.baseHash,
          },
        });
      }
    });
  });

  comparisonModal.classList.add('open');
}

// Git Bisect Assistant
function updateBisectBanner(): void {
  if (!bisectBanner) return;
  if (bisectStatus?.isActive) {
    bisectBanner.style.display = 'block';
    if (bisectCurrentHash) {
      bisectCurrentHash.textContent =
        bisectStatus.currentShortCommit ||
        bisectStatus.currentCommit?.slice(0, 7) ||
        'HEAD';
    }
    if (bisectStepsLeft) {
      bisectStepsLeft.textContent = bisectStatus.stepsRemainingApprox
        ? `~${bisectStatus.stepsRemainingApprox}`
        : '1';
    }
  } else {
    bisectBanner.style.display = 'none';
  }
}

function openBisectModal(defaultBad = 'HEAD'): void {
  if (bisectBadInput) bisectBadInput.value = defaultBad;
  if (bisectGoodInput) bisectGoodInput.value = '';
  bisectModal?.classList.add('open');
}

function closeBisectModal(): void {
  bisectModal?.classList.remove('open');
}

// Pre-Flight Cherry-Pick Conflict Forecaster
function initiateCherryPick(commitHash: string, shortHash: string): void {
  vscode.postMessage({ command: 'previewCherryPick', payload: { commitHash } });
}

function handleCherryPickPreview(preview: CherryPickPreviewResult): void {
  if (preview.clean) {
    if (
      confirm(
        tr('drawer.confirmCherryPick', { hash: preview.shortHash }) +
          '\n\n✔ Análisis de conflictos: Limpio (Sin choques detectados).'
      )
    ) {
      vscode.postMessage({ command: 'cherryPickCommit', payload: { hash: preview.commitHash } });
    }
  } else {
    renderCherryPickForecastModal(preview);
  }
}

function renderCherryPickForecastModal(preview: CherryPickPreviewResult): void {
  if (!cherryPickForecastModal || !cherryPickForecastBody) return;
  cherryPickForecastBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="health-status-banner warning">
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="codicon codicon-warning" style="font-size:20px; color:#f59e0b;"></i>
          <div>
            <div style="font-weight:600; color:#f59e0b;">¡Riesgo de Conflictos Detectado!</div>
            <div style="font-size:var(--font-size-xs); color:var(--text-muted);">
              La aplicación del commit <code>${escapeHtml(preview.shortHash)}</code> generará conflictos automáticos de fusión con HEAD.
            </div>
          </div>
        </div>
      </div>
      <div>
        <div style="font-size:var(--font-size-sm); font-weight:600; margin-bottom:6px;">Archivos en conflicto:</div>
        <div class="conflict-file-list">
          ${preview.conflicts
            .map(
              (f) => `
            <div class="conflict-file-item">
              <i class="codicon codicon-diff-modified"></i>
              <span>${escapeHtml(f)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
        <button id="btn-cancel-cherry-pick" class="btn-sm">Cancelar</button>
        <button id="btn-force-cherry-pick" class="btn-sm" style="background:rgba(239, 68, 68, 0.2); border-color:#ef4444; color:#f87171;">
          Continuar y Resolver
        </button>
      </div>
    </div>
  `;
  cherryPickForecastModal.classList.add('open');
  document.getElementById('btn-cancel-cherry-pick')?.addEventListener('click', () => {
    cherryPickForecastModal.classList.remove('open');
  });
  document.getElementById('btn-force-cherry-pick')?.addEventListener('click', () => {
    cherryPickForecastModal.classList.remove('open');
    vscode.postMessage({ command: 'cherryPickCommit', payload: { hash: preview.commitHash } });
  });
}

// ==========================================================================
// CommitFlow v0.4.5: Layout Switcher, Themes, Dev Tools, File History, PRs, Worktrees, Cloud Patches
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
  if (remoteRepo) {
    if (remoteRepo.provider === 'forgejo' || remoteRepo.badgeType === 'forgejo') {
      privateRepoBadge.style.display = 'inline-flex';
      privateRepoBadge.className = 'private-repo-badge badge-forgejo';
      if (privateRepoLabel) {
        privateRepoLabel.textContent = remoteRepo.badgeLabel || '🔒 Forgejo Privado';
      }
      privateRepoBadge.title = `Forgejo / Gitea Instance: ${remoteRepo.webUrl}`;
      return;
    }

    if (remoteRepo.isPrivate) {
      privateRepoBadge.style.display = 'inline-flex';
      privateRepoBadge.className = 'private-repo-badge';
      if (privateRepoLabel) {
        const pName = remoteRepo.provider.charAt(0).toUpperCase() + remoteRepo.provider.slice(1);
        privateRepoLabel.textContent = remoteRepo.badgeLabel || tr('remote.privateBadge', { provider: pName });
      }
      privateRepoBadge.title = tr('remote.privateTooltip', {
        provider: remoteRepo.provider.toUpperCase(),
        owner: remoteRepo.owner,
        repo: remoteRepo.repo,
      });
      return;
    }
  }
  privateRepoBadge.style.display = 'none';
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
  } else if (tabId === 'tab-issues') {
    vscode.postMessage({ command: 'requestIssues' });
    renderIssues();
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
    currentPathEl.textContent = data.filePath || tr('history.currentFileFallback');
    currentPathEl.title = data.filePath;
  }
  if (!timelineEl) return;

  if (!data.revisions || data.revisions.length === 0) {
    timelineEl.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-history" style="font-size:32px; color:var(--accent-cyan);"></i>
        <div style="font-weight:600; margin-top:8px;">${tr('history.emptyTitle')}</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">${tr('history.emptyDesc')}</div>
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
          <i class="codicon codicon-git-diff"></i> ${tr('history.viewDiff')}
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
        <div style="font-weight:600; margin-top:8px;">${tr('pr.emptyTitle')}</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">${tr('pr.emptyDesc')}</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered
    .map((pr) => {
      let statusBadge = '';
      if (pr.isBlocked) {
        statusBadge = `<span class="pr-chip blocked"><i class="codicon codicon-error"></i> ${tr('pr.chipBlocked')}</span>`;
      } else if (pr.isReady) {
        statusBadge = `<span class="pr-chip ready"><i class="codicon codicon-check"></i> ${tr('pr.chipReady')}</span>`;
      } else {
        statusBadge = `<span class="pr-chip pending"><i class="codicon codicon-clock"></i> ${tr('pr.chipPending')}</span>`;
      }

      const ciChip =
        pr.ciStatus === 'success'
          ? `<span class="pr-chip ci-success"><i class="codicon codicon-pass"></i> ${tr('pr.ciSuccess')}</span>`
          : pr.ciStatus === 'failure'
          ? `<span class="pr-chip ci-failure"><i class="codicon codicon-error"></i> ${tr('pr.ciFailure')}</span>`
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
            <button class="btn-sm btn-pr-checkout" data-pr="${pr.number}" data-branch="${pr.sourceBranch}" title="${tr('pr.checkoutActionTitle')}">
              <i class="codicon codicon-arrow-swap"></i> ${tr('pr.checkoutAction')}
            </button>
            ${
              pr.url
                ? `<button class="btn-sm btn-pr-open" data-url="${pr.url}" title="${tr('pr.viewWebActionTitle')}">
                     <i class="codicon codicon-link-external"></i> ${tr('pr.viewWebAction')}
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
        <div style="font-weight:600; margin-top:8px;">${tr('worktree.emptyTitle')}</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); margin-top:4px;">${tr('worktree.emptyDesc')}</div>
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
          ${wt.isCurrent ? `<span style="font-size:10px; font-weight:700; color:var(--accent-cyan);">${tr('worktree.activeBadge')}</span>` : ''}
        </div>
        ${
          wt.hasWip
            ? `<span class="wip-badge active-wip" title="${tr('worktree.wipTooltip', { count: wt.wipFilesCount })}"><i class="codicon codicon-warning"></i> ${tr('worktree.wipBadge', { count: wt.wipFilesCount, added: wt.wipAdded, modified: wt.wipModified, deleted: wt.wipDeleted })}</span>`
            : `<span class="wip-badge clean"><i class="codicon codicon-check"></i> ${tr('worktree.cleanBadge')}</span>`
        }
      </div>
      <div class="worktree-path">${wt.path}</div>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
        <button class="btn-sm btn-wt-open" data-path="${wt.path}" title="${tr('worktree.openActionTitle')}">
          <i class="codicon codicon-folder-opened"></i> ${tr('worktree.openAction')}
        </button>
        ${
          !wt.isCurrent
            ? `<button class="btn-sm btn-wt-remove" data-path="${wt.path}" title="${tr('worktree.removeActionTitle')}">
                 <i class="codicon codicon-trash"></i> ${tr('worktree.removeAction')}
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
      if (p && confirm(tr('worktree.confirmRemove', { path: p }))) {
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
        <div style="font-weight:600; margin-top:8px;">${tr('patch.emptyTitle')}</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); text-align:center; margin-top:4px;">
          ${tr('patch.emptyDesc')}
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
      <pre class="patch-diff-preview"><code>${escapeHtml(p.patchContent.slice(0, 500))}${p.patchContent.length > 500 ? '\n' + tr('patch.truncated') : ''}</code></pre>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
        <button class="btn-sm btn-copy-patch" data-id="${p.id}" title="${tr('patch.copyActionTitle')}">
          <i class="codicon codicon-copy"></i> ${tr('patch.copyAction')}
        </button>
        <button class="btn-sm btn-apply-saved-patch" data-id="${p.id}" title="${tr('patch.applyActionTitle')}">
          <i class="codicon codicon-cloud-download"></i> ${tr('patch.applyAction')}
        </button>
        <button class="btn-sm btn-delete-patch" data-id="${p.id}" title="${tr('patch.deleteActionTitle')}">
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

function openTagModal(commitHash?: string): void {
  if (tagTargetHash) tagTargetHash.value = commitHash || '';
  if (tagNameInput) {
    tagNameInput.value = '';
    tagNameInput.placeholder = tr('tag.tagNamePlaceholder');
  }
  if (tagMessageInput) {
    tagMessageInput.value = '';
    tagMessageInput.placeholder = tr('tag.messagePlaceholder');
  }
  tagCreateModal?.classList.add('open');
  setTimeout(() => tagNameInput?.focus(), 50);
}

function closeTagModal(): void {
  tagCreateModal?.classList.remove('open');
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

btnReflog?.addEventListener('click', openReflogModal);
reflogModalClose?.addEventListener('click', closeReflogModal);

btnRepoHealth?.addEventListener('click', openRepoHealthModal);
repoHealthModalClose?.addEventListener('click', closeRepoHealthModal);

comparisonModalClose?.addEventListener('click', closeComparisonModal);

// Bisect Banner & Launcher Listeners
btnBisect?.addEventListener('click', () => openBisectModal('HEAD'));
bisectModalClose?.addEventListener('click', closeBisectModal);
bisectBtnCancel?.addEventListener('click', closeBisectModal);

bisectBtnStart?.addEventListener('click', () => {
  const bad = bisectBadInput?.value.trim() || 'HEAD';
  const good = bisectGoodInput?.value.trim();
  if (!good) {
    alert('Introduce el commit o referencia bueno (Good).');
    return;
  }
  closeBisectModal();
  vscode.postMessage({
    command: 'startBisect',
    payload: { badCommit: bad, goodCommit: good },
  });
});

btnBisectGood?.addEventListener('click', () => {
  vscode.postMessage({ command: 'stepBisect', payload: { step: 'good' } });
});

btnBisectBad?.addEventListener('click', () => {
  vscode.postMessage({ command: 'stepBisect', payload: { step: 'bad' } });
});

btnBisectSkip?.addEventListener('click', () => {
  vscode.postMessage({ command: 'stepBisect', payload: { step: 'skip' } });
});

btnBisectReset?.addEventListener('click', () => {
  vscode.postMessage({ command: 'resetBisect' });
});

cherryPickForecastClose?.addEventListener('click', () => {
  cherryPickForecastModal?.classList.remove('open');
});

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
    closeTagModal();
    closeReflogModal();
    closeRepoHealthModal();
    closeComparisonModal();
    closeBisectModal();
    cherryPickForecastModal?.classList.remove('open');
    layoutPickerPopover?.classList.remove('visible');
    themePickerPopover?.classList.remove('visible');
    hideHoverPopover();
  }
});

// Layout Mode Switcher Listeners
btnLayoutMode?.addEventListener('click', (e) => {
  e.stopPropagation();
  layoutPickerPopover?.classList.toggle('visible');
  themePickerPopover?.classList.remove('visible');
});

document.addEventListener('click', (e) => {
  if (layoutPickerPopover && !layoutPickerPopover.contains(e.target as Node) && e.target !== btnLayoutMode) {
    layoutPickerPopover.classList.remove('visible');
  }
  if (themePickerPopover && !themePickerPopover.contains(e.target as Node) && e.target !== btnThemeMode) {
    themePickerPopover.classList.remove('visible');
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

// Theme Mode Switcher Listeners
btnThemeMode?.addEventListener('click', (e) => {
  e.stopPropagation();
  themePickerPopover?.classList.toggle('visible');
  layoutPickerPopover?.classList.remove('visible');
});

document.querySelectorAll('.theme-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    const theme = opt.getAttribute('data-theme') as ThemeMode;
    if (theme) {
      applyTheme(theme);
      settings.theme = theme;
      vscode.postMessage({
        command: 'saveSettings',
        payload: { ...settings, theme },
      });
      renderGraph();
      themePickerPopover?.classList.remove('visible');
    }
  });
});

// Changelog & Undo Buttons
btnChangelog?.addEventListener('click', () => {
  vscode.postMessage({
    command: 'generateChangelog',
    payload: { count: 30 },
  });
});

btnUndoCommit?.addEventListener('click', () => {
  if (confirm(tr('drawer.confirmUndo'))) {
    vscode.postMessage({
      command: 'undoLastCommit',
      payload: {},
    });
  }
});

// Tag Modal Events
tagBtnSubmit?.addEventListener('click', () => {
  const name = tagNameInput?.value?.trim();
  if (!name) {
    alert(tr('tag.nameRequired'));
    return;
  }
  const commitHash = tagTargetHash?.value?.trim() || undefined;
  const message = tagMessageInput?.value?.trim() || undefined;
  vscode.postMessage({
    command: 'createTag',
    payload: { name, commitHash, message },
  });
  closeTagModal();
});

tagBtnCancel?.addEventListener('click', closeTagModal);
tagModalClose?.addEventListener('click', closeTagModal);

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
  const title = patchTitleInput?.value.trim() || tr('patch.defaultTitle');
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
  const height = document.body.clientHeight;
  const wasCompact = isCompactLayout;
  const wasNano = isNanoLayout;

  isCompactLayout = width <= 440;
  isNanoLayout = width <= 260;

  // Clean all previous layout tier classes
  document.body.classList.remove(
    'layout-sidebar-compact',
    'layout-nano',
    'layout-width-nano',
    'layout-width-compact',
    'layout-width-medium',
    'layout-width-expanded',
    'layout-width-ultrawide',
    'layout-height-nano',
    'layout-height-short',
    'auto-detected-bottom',
    'auto-detected-left'
  );

  // Width classification tiers
  if (width <= 260) {
    document.body.classList.add('layout-nano', 'layout-width-nano', 'layout-sidebar-compact');
  } else if (width <= 440) {
    document.body.classList.add('layout-sidebar-compact', 'layout-width-compact');
  } else if (width <= 750) {
    document.body.classList.add('layout-width-medium');
  } else if (width <= 1200) {
    document.body.classList.add('layout-width-expanded');
  } else {
    document.body.classList.add('layout-width-ultrawide');
  }

  // Height classification tiers (for compact bottom docks)
  if (height <= 220) {
    document.body.classList.add('layout-height-nano', 'layout-height-short');
  } else if (height <= 340) {
    document.body.classList.add('layout-height-short');
  }

  // Intelligent auto-detection when user selected 'auto' layout
  if (currentLayoutMode === 'auto') {
    if (width >= 540 && height <= 380) {
      document.body.classList.add('auto-detected-bottom');
    } else if (width <= 440) {
      document.body.classList.add('auto-detected-left');
    }
  }

  if ((wasCompact !== isCompactLayout || wasNano !== isNanoLayout) && allNodes.length > 0) {
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

// Open in Fork Event
btnOpenFork?.addEventListener('click', () => {
  vscode.postMessage({ command: 'openInFork' });
});

// Issue Hub Filter Pills
document.querySelectorAll('.issue-filter-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.issue-filter-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeIssueFilter = (btn.getAttribute('data-filter') as any) || 'assignedToMe';
    renderIssues();
  });
});

// Issue Search Input
issuesSearchInput?.addEventListener('input', (e) => {
  issueSearchQuery = (e.target as HTMLInputElement).value?.trim() || '';
  renderIssues();
});

// Issue Drawer Close
issueDrawerCloseBtn?.addEventListener('click', () => {
  issueDrawer?.classList.remove('open');
});

// Delegated click on table container for commit issue pills
tableContainer?.addEventListener('click', (e) => {
  const pill = (e.target as HTMLElement).closest('.commit-issue-pill');
  if (pill) {
    e.stopPropagation();
    const num = pill.getAttribute('data-issue-number');
    if (num) {
      vscode.postMessage({ command: 'requestIssueDetails', payload: { issueNumber: Number(num) } });
    }
  }
});

function formatCommitSubjectWithIssues(subject: string): string {
  const safe = escapeHtml(subject || '');
  return safe.replace(
    /(^|[\s(])#(\d+)(?=[\s).,;:]|$)/g,
    '$1<span class="commit-issue-pill" data-issue-number="$2" title="Inspeccionar Issue #$2">#$2</span>'
  );
}

function handleIssuesData(payload: any): void {
  if (!payload) return;
  issuesHubData = {
    assigned: payload.assigned || [],
    linked: payload.linked || [],
    allIssues: payload.allIssues || [],
  };

  if (payload.defaultFilter && activeIssueFilter === 'assignedToMe') {
    activeIssueFilter = payload.defaultFilter;
    document.querySelectorAll('.issue-filter-pill').forEach((b) => {
      if (b.getAttribute('data-filter') === activeIssueFilter) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  updateIssueBadges();
  renderIssues();
}

function updateIssueBadges(): void {
  if (issuesBadgeCount) {
    const totalAssigned = issuesHubData.assigned.length;
    issuesBadgeCount.textContent = String(totalAssigned);
    issuesBadgeCount.style.display = totalAssigned > 0 ? 'inline-flex' : 'none';
  }

  const assignedCountEl = document.getElementById('issues-assigned-count');
  if (assignedCountEl) assignedCountEl.textContent = String(issuesHubData.assigned.length);

  const linkedCountEl = document.getElementById('issues-linked-count');
  if (linkedCountEl) linkedCountEl.textContent = String(issuesHubData.linked.length);

  const allCountEl = document.getElementById('issues-all-count');
  if (allCountEl) allCountEl.textContent = String(issuesHubData.allIssues.length);
}

function renderIssues(): void {
  if (!issuesCardsList) return;

  // 1. Linked spotlight card
  if (linkedIssueSpotlight) {
    if (issuesHubData.linked.length > 0) {
      const topLinked = issuesHubData.linked[0];
      linkedIssueSpotlight.style.display = 'block';
      linkedIssueSpotlight.innerHTML = `
        <div class="spotlight-card">
          <div class="spotlight-header">
            <span class="spotlight-tag"><i class="codicon codicon-link"></i> Vinculado al Trabajo Actual</span>
            <span class="issue-badge-state ${topLinked.state}">${topLinked.state === 'open' ? '🟢 Abierto' : '🔴 Cerrado'}</span>
          </div>
          <div class="spotlight-title">#${topLinked.number} ${escapeHtml(topLinked.title)}</div>
          <div class="spotlight-meta">
            <span>Autor: ${escapeHtml(topLinked.author.name)}</span>
            <span>&bull;</span>
            <span>${topLinked.commentsCount || 0} comentarios</span>
          </div>
          <div class="spotlight-actions">
            <button class="btn-sm btn-primary btn-issue-worktree" data-number="${topLinked.number}">
              <i class="codicon codicon-repo-forked"></i> Crear Worktree
            </button>
            <button class="btn-sm btn-issue-branch" data-number="${topLinked.number}">
              <i class="codicon codicon-git-branch"></i> Checkout Rama
            </button>
            <button class="btn-sm btn-issue-insert-ref" data-number="${topLinked.number}">
              <i class="codicon codicon-edit"></i> Copiar Ref (#${topLinked.number})
            </button>
            <button class="btn-sm btn-issue-details" data-number="${topLinked.number}">
              <i class="codicon codicon-eye"></i> Inspeccionar
            </button>
          </div>
        </div>
      `;
    } else {
      linkedIssueSpotlight.style.display = 'none';
      linkedIssueSpotlight.innerHTML = '';
    }
  }

  // 2. Select filtered list
  let sourceList: any[] = [];
  if (activeIssueFilter === 'assignedToMe') {
    sourceList = issuesHubData.assigned;
  } else if (activeIssueFilter === 'linkedToBranch') {
    sourceList = issuesHubData.linked;
  } else if (activeIssueFilter === 'closed') {
    sourceList = issuesHubData.allIssues.filter((i) => i.state === 'closed');
  } else {
    sourceList = issuesHubData.allIssues.filter((i) => i.state === 'open');
  }

  // 3. Search query filter
  if (issueSearchQuery) {
    const q = issueSearchQuery.toLowerCase();
    sourceList = sourceList.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        String(i.number).includes(q) ||
        (i.body && i.body.toLowerCase().includes(q)) ||
        (i.labels && i.labels.some((l: any) => l.name.toLowerCase().includes(q)))
    );
  }

  // 4. Render cards or empty state
  if (sourceList.length === 0) {
    issuesCardsList.innerHTML = `
      <div class="empty-state">
        <i class="codicon codicon-issues" style="font-size:32px; color:var(--accent-purple);"></i>
        <div style="font-weight:600; margin-top:8px;">No hay issues que mostrar</div>
        <div style="font-size:var(--font-size-sm); color:var(--text-muted); text-align:center; margin-top:4px;">
          ${
            issueSearchQuery
              ? 'No se encontraron issues que coincidan con la búsqueda.'
              : 'No tienes tareas pendientes en esta vista.'
          }
        </div>
      </div>
    `;
    return;
  }

  issuesCardsList.innerHTML = sourceList
    .map((issue) => {
      const stateBadge = `<span class="issue-badge-state ${issue.state}">${issue.state === 'open' ? '🟢 Abierto' : '🔴 Cerrado'}</span>`;
      const labelsHtml = (issue.labels || [])
        .map(
          (l: any) =>
            `<span class="issue-label-pill" style="background:${escapeHtml(l.color)}22; border-color:${escapeHtml(l.color)}; color:${escapeHtml(l.color)};">${escapeHtml(l.name)}</span>`
        )
        .join('');

      return `
        <div class="issue-card" data-number="${issue.number}">
          <div class="issue-card-top">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="issue-number">#${issue.number}</span>
              ${stateBadge}
              ${issue.isLinkedToBranch ? '<span class="issue-tag-linked"><i class="codicon codicon-link"></i> Vinculado</span>' : ''}
            </div>
            <div class="issue-card-actions">
              <button class="btn-icon btn-issue-branch" data-number="${issue.number}" title="🌿 Crear Rama desde Issue">
                <i class="codicon codicon-git-branch"></i>
              </button>
              <button class="btn-icon btn-issue-worktree" data-number="${issue.number}" title="🌳 Crear Worktree paralelo">
                <i class="codicon codicon-repo-forked"></i>
              </button>
              <button class="btn-icon btn-issue-insert-ref" data-number="${issue.number}" title="✍️ Copiar Closes #${issue.number}">
                <i class="codicon codicon-edit"></i>
              </button>
              <button class="btn-icon btn-issue-details" data-number="${issue.number}" title="💬 Inspeccionar">
                <i class="codicon codicon-eye"></i>
              </button>
            </div>
          </div>
          <div class="issue-card-title">${escapeHtml(issue.title)}</div>
          ${labelsHtml ? `<div class="issue-labels-wrap">${labelsHtml}</div>` : ''}
          <div class="issue-card-footer">
            <div class="issue-author-info">
              <span class="author-name">${escapeHtml(issue.author.name)}</span>
              <span class="relative-time">&bull; ${issue.commentsCount || 0} comentarios</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach card event listeners
  issuesCardsList.querySelectorAll('.issue-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.issue-card-actions')) return;
      const num = card.getAttribute('data-number');
      if (num) {
        vscode.postMessage({ command: 'requestIssueDetails', payload: { issueNumber: Number(num) } });
      }
    });
  });

  issuesCardsList.querySelectorAll('.btn-issue-branch').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = btn.getAttribute('data-number');
      if (num) {
        vscode.postMessage({
          command: 'startWorkOnIssue',
          payload: { issueNumber: Number(num), useWorktree: false },
        });
      }
    });
  });

  issuesCardsList.querySelectorAll('.btn-issue-worktree').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = btn.getAttribute('data-number');
      if (num) {
        vscode.postMessage({
          command: 'startWorkOnIssue',
          payload: { issueNumber: Number(num), useWorktree: true },
        });
      }
    });
  });

  issuesCardsList.querySelectorAll('.btn-issue-insert-ref').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = btn.getAttribute('data-number');
      if (num) {
        vscode.postMessage({
          command: 'insertIssueRef',
          payload: { issueNumber: Number(num) },
        });
      }
    });
  });

  issuesCardsList.querySelectorAll('.btn-issue-details').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = btn.getAttribute('data-number');
      if (num) {
        vscode.postMessage({ command: 'requestIssueDetails', payload: { issueNumber: Number(num) } });
      }
    });
  });
}

function handleIssueDetailsData(payload: { issue: any; comments: any[] }): void {
  if (!issueDrawer || !issueDrawerBody || !payload.issue) return;

  const issue = payload.issue;
  if (issueDrawerTitle) {
    issueDrawerTitle.textContent = `#${issue.number} - ${issue.title}`;
  }

  const isClosed = issue.state === 'closed';
  const toggleBtnText = isClosed ? 'Reabrir Issue' : 'Cerrar Issue';
  const toggleBtnClass = isClosed ? 'btn-success' : 'btn-danger';
  const targetState = isClosed ? 'open' : 'closed';

  const commentsHtml = (payload.comments || [])
    .map(
      (c: any) => `
        <div class="issue-comment-item">
          <div class="comment-author-row">
            <span style="font-weight:600;">${escapeHtml(c.author.name)}</span>
            <span style="color:var(--text-muted); font-size:var(--font-size-xs);">&bull; ${escapeHtml(c.relativeTime || '')}</span>
          </div>
          <div class="comment-body">${escapeHtml(c.body || '').replace(/\n/g, '<br/>')}</div>
        </div>
      `
    )
    .join('');

  issueDrawerBody.innerHTML = `
    <div class="issue-drawer-content">
      <div class="issue-drawer-topbar">
        <span class="issue-badge-state ${issue.state}">${issue.state === 'open' ? '🟢 Abierto' : '🔴 Cerrado'}</span>
        <div style="display:flex; gap:6px;">
          <button id="btn-toggle-issue-state" class="btn-sm ${toggleBtnClass}">
            <i class="codicon ${isClosed ? 'codicon-issue-reopened' : 'codicon-issue-closed'}"></i> ${toggleBtnText}
          </button>
          <button id="btn-issue-drawer-branch" class="btn-sm btn-primary">
            <i class="codicon codicon-git-branch"></i> Crear Rama
          </button>
        </div>
      </div>

      <div class="issue-description-box">
        <div style="font-size:var(--font-size-xs); color:var(--text-muted); margin-bottom:6px;">
          Creado por <strong>${escapeHtml(issue.author.name)}</strong> el ${new Date(issue.createdAt).toLocaleDateString()}
        </div>
        <div class="issue-body-text">
          ${escapeHtml(issue.body || 'Sin descripción proporcionada.').replace(/\n/g, '<br/>')}
        </div>
      </div>

      <div class="issue-comments-section">
        <div style="font-weight:600; font-size:var(--font-size-sm); margin-bottom:8px;">
          Comentarios (${payload.comments?.length || 0})
        </div>
        <div id="issue-comments-feed" class="issue-comments-feed">
          ${commentsHtml || '<div style="color:var(--text-muted); font-size:var(--font-size-sm);">No hay comentarios aún.</div>'}
        </div>
        <div class="issue-add-comment-box">
          <textarea id="issue-new-comment-text" placeholder="Escribe un comentario..." class="search-input" style="width:100%; height:70px; resize:vertical; margin-top:8px;"></textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:6px;">
            <button id="btn-submit-issue-comment" class="btn-sm btn-primary">
              <i class="codicon codicon-send"></i> Comentar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  issueDrawer.classList.add('open');

  document.getElementById('btn-toggle-issue-state')?.addEventListener('click', () => {
    vscode.postMessage({
      command: 'setIssueState',
      payload: { issueNumber: issue.number, state: targetState },
    });
  });

  document.getElementById('btn-issue-drawer-branch')?.addEventListener('click', () => {
    vscode.postMessage({
      command: 'startWorkOnIssue',
      payload: { issueNumber: issue.number, useWorktree: false },
    });
  });

  document.getElementById('btn-submit-issue-comment')?.addEventListener('click', () => {
    const textEl = document.getElementById('issue-new-comment-text') as HTMLTextAreaElement | null;
    const body = textEl?.value?.trim();
    if (body) {
      vscode.postMessage({
        command: 'createIssueComment',
        payload: { issueNumber: issue.number, body },
      });
      if (textEl) textEl.value = '';
    }
  });
}

function handleIssueCommentAdded(payload: { issueNumber: number; comment: any }): void {
  const feed = document.getElementById('issue-comments-feed');
  if (feed && payload.comment) {
    const c = payload.comment;
    const div = document.createElement('div');
    div.className = 'issue-comment-item';
    div.innerHTML = `
      <div class="comment-author-row">
        <span style="font-weight:600;">${escapeHtml(c.author.name)}</span>
        <span style="color:var(--text-muted); font-size:var(--font-size-xs);">&bull; just now</span>
      </div>
      <div class="comment-body">${escapeHtml(c.body || '').replace(/\n/g, '<br/>')}</div>
    `;
    feed.appendChild(div);
  }
}

// Initial handshake
vscode.postMessage({ command: 'ready' });
