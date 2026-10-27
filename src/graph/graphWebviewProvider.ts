import * as vscode from 'vscode';
import * as path from 'path';
import { GitClient } from '../git/gitClient';
import { GraphLayout } from './graphLayout';
import { GitContentProvider } from '../git/gitContentProvider';
import {
  CommitFlowSettings,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../git/types';

export class GraphWebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = 'commitflow.graphView';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private readonly gitClient = GitClient.getInstance();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {
    // 1. Watch for Git HEAD changes to auto-refresh when checking out branches
    const watcher = vscode.workspace.createFileSystemWatcher('**/.git/HEAD');
    watcher.onDidChange(() => this.refreshData(), this, this.disposables);
    watcher.onDidCreate(() => this.refreshData(), this, this.disposables);
    this.disposables.push(watcher);

    // 2. Multi-root workspace: Refresh when switching active editor to a different root
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor?.document.uri.scheme === 'file') {
          this.refreshData();
        }
      },
      null,
      this.disposables
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.setupMessageListener(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshData();
      }
    });
  }

  /**
   * Opens or reveals the Graph as a full editor tab
   */
  public openFullPanel(targetCommitHash?: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'commitflow.graphPanel',
        'CommitFlow: Commit & Branch Graph',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist'),
            vscode.Uri.joinPath(this.extensionUri, 'resources'),
          ],
        }
      );

      this.panel.iconPath = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'icon.png'
      );
      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
      this.setupMessageListener(this.panel.webview);

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.refreshData();
  }

  public showPersonalModal(): void {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );
    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'openPersonalModal' });
      } catch {}
    });
  }

  public showSettingsModal(): void {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );
    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'openSettingsModal' });
      } catch {}
    });
  }

  /**
   * Refreshes the Git data and sends to all active webviews
   */
  public async refreshData(): Promise<void> {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );

    if (activeWebviews.length === 0) {
      return;
    }

    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'loading' } as ExtensionToWebviewMessage);
      } catch {}
    });

    try {
      const root = await this.gitClient.getRepoRoot();
      if (!root) {
        activeWebviews.forEach((w) => {
          try {
            w.postMessage({
              command: 'error',
              payload:
                'No Git repository detected in the active workspace. Open a folder with a Git repository to view CommitFlow.',
            } as ExtensionToWebviewMessage);
          } catch {}
        });
        return;
      }

      const config = vscode.workspace.getConfiguration('commitflow');
      const limit = config.get<number>('graph.pageSize', 300);

      const [commits, branches, currentBranch, githubRepo, userIdentity, upstreamStatus, stashes] =
        await Promise.all([
          this.gitClient.getCommits(root, limit),
          this.gitClient.getBranches(root),
          this.gitClient.getCurrentBranch(root),
          this.gitClient.getGitHubRepoInfo(root),
          this.gitClient.getUserIdentity(root),
          this.gitClient.getUpstreamStatus(root),
          this.gitClient.getStashes(root),
        ]);

      const graphNodes = GraphLayout.compute(commits);
      let maxLane = 0;
      graphNodes.forEach((n) => {
        if (n.lane > maxLane) maxLane = n.lane;
        n.passingLanes?.forEach((p) => {
          if (p.lane > maxLane) maxLane = p.lane;
        });
        n.lines.forEach((l) => {
          if (l.toLane > maxLane) maxLane = l.toLane;
        });
      });

      const stats = this.gitClient.computeRepoStats(commits, branches);
      const personalStats = this.gitClient.computePersonalStats(
        commits,
        branches,
        userIdentity.name,
        userIdentity.email
      );

      const settingsPayload: CommitFlowSettings = {
        language: config.get<'auto' | 'es' | 'en'>('language', 'auto'),
        density: config.get<'compact' | 'comfortable' | 'spacious'>('graph.density', 'comfortable'),
        theme: config.get<'auto' | 'dark' | 'light'>('graph.theme', 'auto'),
        animations: config.get<boolean>('graph.animations', true),
        pageSize: limit,
        inlineBlameEnabled: config.get<boolean>('inlineBlame.enabled', true),
        inlineBlameDelay: config.get<number>('inlineBlame.delay', 120),
        avatarService: config.get<'gravatar' | 'github' | 'initials'>('avatars.service', 'gravatar'),
        autoFetch: config.get<boolean>('sync.autoFetch', true),
        fetchIntervalMinutes: config.get<number>('sync.fetchIntervalMinutes', 5),
        notifyOnBranchMerge: config.get<boolean>('sync.notifyOnBranchMerge', true),
        askBeforePull: config.get<boolean>('sync.askBeforePull', true),
      };

      const payload = {
        commits: graphNodes,
        branches,
        currentBranch,
        githubRepo,
        stats,
        personalStats,
        upstreamStatus,
        stashes,
        maxLane,
        settings: settingsPayload,
        systemLanguage: vscode.env.language,
        totalCommits: graphNodes.length,
        hasMore: false,
      };

      activeWebviews.forEach((w) => {
        try {
          w.postMessage({
            command: 'graphData',
            payload,
          } as ExtensionToWebviewMessage);
        } catch {}
      });
    } catch (err: any) {
      activeWebviews.forEach((w) => {
        try {
          w.postMessage({
            command: 'error',
            payload: err.message || String(err),
          } as ExtensionToWebviewMessage);
        } catch {}
      });
    }
  }

  private setupMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      const root = await this.gitClient.getRepoRoot();

      switch (msg.command) {
        case 'ready':
        case 'requestData':
          await this.refreshData();
          break;

        case 'requestCommitFiles':
          if (root && msg.payload?.commitHash) {
            const files = await this.gitClient.getCommitFilesDetailed(
              root,
              msg.payload.commitHash
            );
            webview.postMessage({
              command: 'commitFiles',
              payload: { commitHash: msg.payload.commitHash, files },
            } as ExtensionToWebviewMessage);
          }
          break;

        case 'openDiff':
          if (root && msg.payload) {
            await this.openFileDiff(root, msg.payload);
          }
          break;

        case 'openFullPanel':
          this.openFullPanel();
          break;

        case 'openFile':
          if (root && msg.payload?.filePath) {
            const absPath = path.isAbsolute(msg.payload.filePath)
              ? msg.payload.filePath
              : path.resolve(root, msg.payload.filePath);
            try {
              const doc = await vscode.workspace.openTextDocument(absPath);
              await vscode.window.showTextDocument(doc);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
            }
          }
          break;

        case 'copyToClipboard':
          if (msg.payload) {
            await vscode.env.clipboard.writeText(msg.payload);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;

        case 'openExternal':
          if (msg.payload) {
            await vscode.env.openExternal(vscode.Uri.parse(msg.payload));
          }
          break;

        case 'checkoutBranch':
          if (msg.payload && root) {
            try {
              await this.gitClient.checkoutBranch(root, msg.payload);
              vscode.window.showInformationMessage(
                `Switched to branch: ${msg.payload}`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Checkout failed: ${e.message}`);
            }
          }
          break;

        case 'checkoutCommit':
          if (msg.payload && root) {
            try {
              await this.gitClient.checkoutCommit(root, msg.payload);
              vscode.window.showInformationMessage(
                `Checked out commit: ${msg.payload.slice(0, 7)}`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Checkout failed: ${e.message}`);
            }
          }
          break;

        case 'pullBranch':
          if (root) {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: 'CommitFlow: Pulling latest commits...',
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.pull(root);
                  vscode.window.showInformationMessage(
                    `Pull succeeded: ${res.split('\n')[0] || 'Already up to date.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(`Pull failed: ${e.message}`);
                }
              }
            );
          }
          break;

        case 'rebaseBranch':
          if (root) {
            const target = msg.payload?.upstream || undefined;
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `CommitFlow: Rebasing onto ${target || 'upstream'}...`,
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.rebase(root, target);
                  vscode.window.showInformationMessage(
                    `Rebase succeeded: ${res.split('\n')[0] || 'Successfully rebased.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(
                    `Rebase failed: ${e.message}. Resolve conflicts or abort with git rebase --abort.`
                  );
                }
              }
            );
          }
          break;

        case 'mergeBranch':
          if (root) {
            const target = msg.payload?.upstream || undefined;
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `CommitFlow: Merging ${target || 'upstream'}...`,
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.merge(root, target);
                  vscode.window.showInformationMessage(
                    `Merge succeeded: ${res.split('\n')[0] || 'Merged successfully.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(
                    `Merge failed: ${e.message}. Resolve conflicts or abort with git merge --abort.`
                  );
                }
              }
            );
          }
          break;

        case 'abortRebase':
          if (root) {
            try {
              await this.gitClient.abortRebase(root);
              vscode.window.showInformationMessage('CommitFlow: Rebase aborted successfully.');
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Abort rebase failed: ${e.message}`);
            }
          }
          break;

        case 'stashSave':
          if (root) {
            try {
              const msgText = msg.payload?.message || '';
              const res = await this.gitClient.stashSave(root, msgText);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash saved. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash failed: ${e.message}`);
            }
          }
          break;

        case 'stashPop':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashPop(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash applied and dropped. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash pop failed: ${e.message}`);
            }
          }
          break;

        case 'stashApply':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashApply(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash applied. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash apply failed: ${e.message}`);
            }
          }
          break;

        case 'stashDrop':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashDrop(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash dropped. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash drop failed: ${e.message}`);
            }
          }
          break;

        case 'saveSettings':
          if (msg.payload) {
            const cfg = vscode.workspace.getConfiguration('commitflow');
            const s: CommitFlowSettings = msg.payload;
            await Promise.all([
              cfg.update('language', s.language, vscode.ConfigurationTarget.Global),
              cfg.update('graph.density', s.density, vscode.ConfigurationTarget.Global),
              cfg.update('graph.theme', s.theme, vscode.ConfigurationTarget.Global),
              cfg.update('graph.animations', s.animations, vscode.ConfigurationTarget.Global),
              cfg.update('graph.pageSize', s.pageSize, vscode.ConfigurationTarget.Global),
              cfg.update('inlineBlame.enabled', s.inlineBlameEnabled, vscode.ConfigurationTarget.Global),
              cfg.update('inlineBlame.delay', s.inlineBlameDelay, vscode.ConfigurationTarget.Global),
              cfg.update('avatars.service', s.avatarService, vscode.ConfigurationTarget.Global),
              cfg.update('sync.autoFetch', s.autoFetch, vscode.ConfigurationTarget.Global),
              cfg.update('sync.fetchIntervalMinutes', s.fetchIntervalMinutes, vscode.ConfigurationTarget.Global),
              cfg.update('sync.notifyOnBranchMerge', s.notifyOnBranchMerge, vscode.ConfigurationTarget.Global),
            ]);

            webview.postMessage({
              command: 'settingsUpdated',
              payload: s,
            } as ExtensionToWebviewMessage);

            vscode.window.showInformationMessage('CommitFlow: Settings saved successfully!');
          }
          break;
      }
    });
  }

  /**
   * Opens native VS Code diff editor for a specific commit and file
   */
  private async openFileDiff(
    root: string,
    payload: {
      commitHash: string;
      filePath: string;
      status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
    }
  ): Promise<void> {
    const { commitHash, filePath, status } = payload;
    const baseName = path.basename(filePath);

    let leftUri: vscode.Uri;
    let rightUri: vscode.Uri;
    let title: string;

    if (status === 'A') {
      leftUri = GitContentProvider.createUri('EMPTY', filePath, root);
      rightUri = GitContentProvider.createUri(commitHash, filePath, root);
      title = `${baseName} (Added in ${commitHash.slice(0, 7)})`;
    } else if (status === 'D') {
      leftUri = GitContentProvider.createUri(`${commitHash}~1`, filePath, root);
      rightUri = GitContentProvider.createUri('EMPTY', filePath, root);
      title = `${baseName} (Deleted in ${commitHash.slice(0, 7)})`;
    } else {
      leftUri = GitContentProvider.createUri(`${commitHash}~1`, filePath, root);
      rightUri = GitContentProvider.createUri(commitHash, filePath, root);
      title = `${baseName} (${commitHash.slice(0, 7)} vs Parent)`;
    }

    try {
      await vscode.commands.executeCommand(
        'vscode.diff',
        leftUri,
        rightUri,
        title
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Unable to open diff for ${filePath}: ${err.message}`
      );
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
    );
    const codiconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'codicon.css')
    );
    const logoDarkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'logo-dark.png')
    );
    const logoLightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'logo-light.png')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${codiconCssUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>CommitFlow Graph</title>
</head>
<body class="density-comfortable">
  <!-- Top Header Bar -->
  <div class="header-bar" id="header-bar">
    <div class="header-row-primary">
      <div class="brand-section">
        <img src="${logoDarkUri}" alt="CommitFlow" class="brand-logo logo-dark-mode" />
        <img src="${logoLightUri}" alt="CommitFlow" class="brand-logo logo-light-mode" />
        <span class="brand-title">CommitFlow</span>
      </div>

      <div id="active-branch-pill" class="active-branch-badge" title="Rama activa actual">
        <div class="branch-pulse-dot"></div>
        <span class="branch-name">main</span>
      </div>

      <div class="header-quick-actions">
        <button id="refresh-btn" class="btn-icon" title="Refrescar grafo">
          <i class="codicon codicon-refresh"></i>
        </button>
        <button id="btn-popout" class="btn-icon" title="Abrir en pestaña completa del editor">
          <i class="codicon codicon-link-external"></i>
        </button>
        <button id="btn-stash" class="btn-icon" title="Gestor de Git Stash">
          <i class="codicon codicon-archive"></i>
        </button>
        <button id="btn-personal-stats" class="btn-icon" title="Ver Mi Impacto">
          <i class="codicon codicon-graph"></i>
        </button>
        <button id="btn-settings" class="btn-icon" title="Ajustes de CommitFlow">
          <i class="codicon codicon-settings-gear"></i>
        </button>
      </div>
    </div>

    <div class="toolbar-controls" id="toolbar-controls">
      <div class="search-input-wrapper">
        <span class="search-icon"><i class="codicon codicon-search"></i></span>
        <input type="text" id="search-input" class="search-input" placeholder="Buscar..." />
        <button id="search-clear-btn" class="search-clear-btn" title="Limpiar búsqueda" style="display:none;">
          <i class="codicon codicon-close"></i>
        </button>
      </div>

      <select id="branch-select" class="branch-select" title="Filtrar por rama">
        <option value="all">Todas las ramas</option>
      </select>

      <button id="btn-checkout" class="btn-icon" title="Cambiar a rama seleccionada">
        <i class="codicon codicon-arrow-swap"></i>
      </button>
    </div>
  </div>

  <!-- Repository Quick Stats Bar -->
  <div id="stats-bar" class="stats-bar">
    <div class="stat-item" title="Total de commits en el repositorio">
      <i class="codicon codicon-git-commit stat-icon"></i>
      <span class="stat-label" id="label-stat-commits">Commits:</span>
      <span class="stat-value" id="stat-total-commits">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" title="Colaboradores del repositorio">
      <i class="codicon codicon-organization stat-icon"></i>
      <span class="stat-label" id="label-stat-contributors">Colaboradores:</span>
      <span class="stat-value" id="stat-total-contributors">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" title="Ramas locales y remotas">
      <i class="codicon codicon-git-branch stat-icon"></i>
      <span class="stat-label" id="label-stat-branches">Ramas:</span>
      <span class="stat-value" id="stat-total-branches">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" id="stat-stash-item" style="cursor:pointer;" title="Stashes guardados (clic para abrir)">
      <i class="codicon codicon-archive stat-icon"></i>
      <span class="stat-label" id="label-stat-stashes">Stashes:</span>
      <span class="stat-value" id="stat-total-stashes">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="top-contributors-row" id="top-contributors-row"></div>
  </div>

  <!-- Upstream Sync Banner Container -->
  <div id="upstream-sync-container"></div>

  <!-- Main Viewport -->
  <div class="main-viewport">
    <div id="graph-table-container" class="graph-table-container">
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; color:var(--text-muted);">
        <i class="codicon codicon-loading codicon-modifier-spin" style="font-size:24px; color:var(--accent-cyan);"></i>
        <div>Iniciando CommitFlow Graph...</div>
      </div>
    </div>

    <!-- Floating Hover Popover -->
    <div id="hover-popover" class="hover-popover"></div>

    <!-- Git Stash Manager Modal -->
    <div id="stash-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-archive" style="font-size:16px; color:var(--accent-amber);"></i>
            <span id="stash-modal-title" style="font-weight:700; font-size:var(--font-size-base);">Gestor de Git Stash</span>
          </div>
          <button id="stash-modal-close" class="btn-icon" title="Cerrar"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="stash-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Personal Contribution Modal -->
    <div id="personal-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-graph" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span id="personal-modal-title" style="font-weight:700; font-size:var(--font-size-base);">Tu Contribución e Impacto Personal</span>
          </div>
          <button id="personal-modal-close" class="btn-icon" title="Cerrar"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="personal-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-settings-gear" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span id="settings-modal-title" style="font-weight:700; font-size:var(--font-size-base);">Ajustes de CommitFlow</span>
          </div>
          <button id="settings-modal-close" class="btn-icon" title="Cerrar"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="settings-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Slide-in Commit Inspector Drawer -->
    <div id="commit-drawer" class="commit-drawer">
      <div class="drawer-header">
        <span id="drawer-title" style="font-weight:600; font-size:var(--font-size-base);">Detalles del Commit y Archivos</span>
        <button id="drawer-close-btn" class="btn-icon" title="Cerrar"><i class="codicon codicon-close"></i></button>
      </div>
      <div id="drawer-body" class="drawer-body"></div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
