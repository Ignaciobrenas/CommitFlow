import * as vscode from 'vscode';
import { GitClient } from '../git/gitClient';
import { GraphLayout } from './graphLayout';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../git/types';

export class GraphWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'branchify.graphView';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private readonly gitClient = GitClient.getInstance();

  constructor(private readonly extensionUri: vscode.Uri) {}

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

      this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icon.png');
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

    activeWebviews.forEach((w) =>
      w.postMessage({ command: 'loading' } as ExtensionToWebviewMessage)
    );

    try {
      const root = await this.gitClient.getRepoRoot();
      if (!root) {
        activeWebviews.forEach((w) =>
          w.postMessage({
            command: 'error',
            payload: 'No Git repository detected in the current workspace.',
          } as ExtensionToWebviewMessage)
        );
        return;
      }

      const limit = vscode.workspace
        .getConfiguration('branchify.graph')
        .get<number>('pageSize', 300);

      const [commits, branches, currentBranch] = await Promise.all([
        this.gitClient.getCommits(root, limit),
        this.gitClient.getBranches(root),
        this.gitClient.getCurrentBranch(root),
      ]);

      const graphNodes = GraphLayout.compute(commits);

      const payload = {
        commits: graphNodes,
        branches,
        currentBranch,
        totalCommits: graphNodes.length,
        hasMore: false,
      };

      activeWebviews.forEach((w) =>
        w.postMessage({
          command: 'graphData',
          payload,
        } as ExtensionToWebviewMessage)
      );
    } catch (err: any) {
      activeWebviews.forEach((w) =>
        w.postMessage({
          command: 'error',
          payload: err.message || String(err),
        } as ExtensionToWebviewMessage)
      );
    }
  }

  private setupMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      switch (msg.command) {
        case 'ready':
        case 'requestData':
          await this.refreshData();
          break;

        case 'copyToClipboard':
          if (msg.payload) {
            await vscode.env.clipboard.writeText(msg.payload);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;

        case 'checkoutBranch':
          if (msg.payload) {
            const root = await this.gitClient.getRepoRoot();
            if (root) {
              try {
                await this.gitClient.checkoutBranch(root, msg.payload);
                vscode.window.showInformationMessage(`Switched to branch: ${msg.payload}`);
                await this.refreshData();
              } catch (e: any) {
                vscode.window.showErrorMessage(`Checkout failed: ${e.message}`);
              }
            }
          }
          break;
      }
    });
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

      <select id="branch-select" class="branch-select">
        <option value="all">All Branches</option>
      </select>

      <button id="refresh-btn" class="btn-icon" title="Refresh Graph">
        ↻
      </button>
    </div>

    <div id="active-branch-pill" class="active-branch-badge">
      <div class="branch-pulse-dot"></div>
      <span class="branch-name">main</span>
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
        <span style="font-weight: 600; font-size: 13px;">Commit Details</span>
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
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
