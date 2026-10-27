import * as vscode from 'vscode';
import * as path from 'path';
import { GitClient } from '../git/gitClient';
import { GraphLayout } from './graphLayout';
import { GitContentProvider } from '../git/gitContentProvider';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../git/types';

export class GraphWebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = 'branchify.graphView';
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
        'branchify.graphPanel',
        'Branchify: Commit & Branch Graph',
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
                'No Git repository detected in the active workspace. Open a folder with a Git repository to view Branchify.',
            } as ExtensionToWebviewMessage);
          } catch {}
        });
        return;
      }

      const limit = vscode.workspace
        .getConfiguration('branchify.graph')
        .get<number>('pageSize', 300);

      const [commits, branches, currentBranch, githubRepo] = await Promise.all([
        this.gitClient.getCommits(root, limit),
        this.gitClient.getBranches(root),
        this.gitClient.getCurrentBranch(root),
        this.gitClient.getGitHubRepoInfo(root),
      ]);

      const graphNodes = GraphLayout.compute(commits);
      const stats = this.gitClient.computeRepoStats(commits, branches);

      const payload = {
        commits: graphNodes,
        branches,
        currentBranch,
        githubRepo,
        stats,
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
      }
    });
  }

  /**
   * Opens the native VS Code diff editor for a specific commit and file
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
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'icon.png')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet" />
  <title>Branchify Graph</title>
</head>
<body>
  <div class="header-bar">
    <div class="brand-section">
      <img src="${logoUri}" alt="Branchify" class="brand-logo" />
      <span>Branchify</span>
    </div>

    <div class="toolbar-controls">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-input" class="search-input" placeholder="Search commits, authors, hashes..." />
      </div>

      <select id="branch-select" class="branch-select" title="Filter by Branch">
        <option value="all">All Branches</option>
      </select>

      <button id="btn-checkout" class="btn-icon" title="Checkout Selected Branch">
        ⮂
      </button>

      <button id="refresh-btn" class="btn-icon" title="Refresh Graph">
        ↻
      </button>
    </div>

    <div id="active-branch-pill" class="active-branch-badge" title="Current Active Branch">
      <div class="branch-pulse-dot"></div>
      <span class="branch-name">main</span>
    </div>
  </div>

  <!-- Repository Quick Stats Bar -->
  <div id="stats-bar" class="stats-bar">
    <div class="stat-item">
      <span class="stat-label">Commits:</span>
      <span class="stat-value" id="stat-total-commits">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span class="stat-label">Contributors:</span>
      <span class="stat-value" id="stat-total-contributors">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span class="stat-label">Branches:</span>
      <span class="stat-value" id="stat-total-branches">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="top-contributors-row" id="top-contributors-row">
      <!-- Avatars of top contributors injected here -->
    </div>
  </div>

  <div class="main-viewport">
    <div id="graph-table-container" class="graph-table-container">
      <div class="state-container">
        <div class="spinner"></div>
        <div>Initializing Branchify Graph...</div>
      </div>
    </div>

    <!-- Slide-in Commit Inspector Drawer -->
    <div id="commit-drawer" class="commit-drawer">
      <div class="drawer-header">
        <span style="font-weight: 600; font-size: 13px;">Commit Details & Diffs</span>
        <button id="drawer-close-btn" class="btn-icon" title="Close Drawer">✕</button>
      </div>
      <div id="drawer-body" class="drawer-body">
        <!-- Rendered dynamically on click -->
      </div>
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
