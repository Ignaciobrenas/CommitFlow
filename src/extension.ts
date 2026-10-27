import * as vscode from 'vscode';
import { BlameController } from './blame/blameController';
import { BlameHoverProvider } from './blame/blameHover';
import { GraphWebviewProvider } from './graph/graphWebviewProvider';
import { GitContentProvider } from './git/gitContentProvider';
import { BranchWatcherService } from './git/branchWatcher';
import { GitClient } from './git/gitClient';

let blameController: BlameController | undefined;
let graphProvider: GraphWebviewProvider | undefined;
let branchWatcher: BranchWatcherService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('⚡ [Branchify] Activating Git Graph & Live Blame extension...');

  // 1. Register Virtual Text Document Content Provider for Historical Git Diffs
  const contentProvider = new GitContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      GitContentProvider.scheme,
      contentProvider
    )
  );

  // 2. Initialize Live Blame Controller (Editor Ghost Text & Status Bar)
  blameController = new BlameController();
  context.subscriptions.push(blameController);

  // 3. Register Hover Provider for real-time rich author cards
  const hoverProvider = new BlameHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
  );

  // 4. Register Graph Webview Provider (Sidebar Activity Bar)
  graphProvider = new GraphWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GraphWebviewProvider.viewType,
      graphProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
  context.subscriptions.push(graphProvider);

  // 5. Initialize Branch Watcher Service (Background Merge & Upstream Detection)
  branchWatcher = new BranchWatcherService(() => {
    graphProvider?.refreshData();
  });
  context.subscriptions.push(branchWatcher);

  // 6. Command: Open Full Commit & Branch Graph Panel
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'branchify.openGraph',
      (commitHash?: string) => {
        graphProvider?.openFullPanel(commitHash);
      }
    )
  );

  // 7. Command: Toggle Live Inline Blame
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.toggleInlineBlame', () => {
      if (blameController) {
        const state = blameController.toggle();
        vscode.window.showInformationMessage(
          `Branchify Live Inline Blame: ${state ? 'ENABLED' : 'DISABLED'}`
        );
      }
    })
  );

  // 8. Command: Refresh Graph
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.refreshGraph', () => {
      graphProvider?.refreshData();
    })
  );

  // 9. Command: Copy Commit SHA
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'branchify.copyHash',
      async (hash?: string | string[]) => {
        const target = Array.isArray(hash) ? hash[0] : hash;
        const finalHash = target || blameController?.getCurrentBlame()?.commitHash;
        if (finalHash) {
          await vscode.env.clipboard.writeText(finalHash);
          vscode.window.showInformationMessage(
            `Copied SHA to clipboard: ${finalHash.slice(0, 7)}`
          );
        }
      }
    )
  );

  // 10. Command: Show Current Line Commit in Graph
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.showLineCommit', () => {
      const current = blameController?.getCurrentBlame();
      graphProvider?.openFullPanel(current?.commitHash);
    })
  );

  // 11. Command: Open Changes with Previous Revision (GitLens-like Line Diff)
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.openLineDiff', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== 'file') {
        vscode.window.showWarningMessage('No active file to compare changes.');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const lineNumber = editor.selection.active.line + 1;
      const gitClient = GitClient.getInstance();
      const blame =
        blameController?.getCurrentBlame() ||
        (await gitClient.getBlameForLine(filePath, lineNumber));

      if (!blame) {
        vscode.window.showInformationMessage('No Git blame history available for this line.');
        return;
      }

      const root = await gitClient.getRepoRoot(filePath);
      if (!root) return;

      const path = await import('path');
      const baseName = path.basename(filePath);
      const isUncommitted = blame.commitHash === '0000000' || /^0+$/.test(blame.commitHash);

      let leftUri: vscode.Uri;
      let rightUri: vscode.Uri;
      let title: string;

      if (isUncommitted) {
        leftUri = GitContentProvider.createUri('HEAD', filePath, root);
        rightUri = editor.document.uri;
        title = `${baseName} (Working Tree vs HEAD)`;
      } else {
        leftUri = GitContentProvider.createUri(`${blame.commitHash}~1`, filePath, root);
        rightUri = GitContentProvider.createUri(blame.commitHash, filePath, root);
        title = `${baseName} (${blame.shortHash} vs Parent)`;
      }

      try {
        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open diff: ${err.message}`);
      }
    })
  );

  // 12. Command: Open Commit on GitHub / Remote
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.openOnGitHub', async (hash?: string | string[]) => {
      const target = Array.isArray(hash) ? hash[0] : hash;
      const finalHash = target || blameController?.getCurrentBlame()?.commitHash;
      if (!finalHash || finalHash === '0000000') {
        vscode.window.showWarningMessage('No committed revision available on remote.');
        return;
      }

      const gitClient = GitClient.getInstance();
      const root = await gitClient.getRepoRoot();
      if (!root) return;

      const github = await gitClient.getGitHubRepoInfo(root);
      if (github?.webUrl) {
        await vscode.env.openExternal(vscode.Uri.parse(`${github.webUrl}/commit/${finalHash}`));
      } else {
        vscode.window.showInformationMessage('No GitHub or GitLab remote URL found for this repository.');
      }
    })
  );

  // 13. Command: Show My Personal Impact & Branch Stats
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.showPersonalStats', () => {
      graphProvider?.openFullPanel();
      graphProvider?.showPersonalModal();
    })
  );

  // 14. Command: Open Branchify Settings Modal
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.openSettings', () => {
      graphProvider?.openFullPanel();
      graphProvider?.showSettingsModal();
    })
  );

  // 15. Command: Pull Current Branch
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.pullCurrentBranch', async () => {
      const gitClient = GitClient.getInstance();
      const root = await gitClient.getRepoRoot();
      if (root && branchWatcher) {
        await branchWatcher.executePull(root);
      }
    })
  );

  // 16. Command: Fetch Remotes
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.fetchRemotes', async () => {
      const gitClient = GitClient.getInstance();
      const root = await gitClient.getRepoRoot();
      if (root) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Branchify: Fetching all remotes...',
          },
          async () => {
            const res = await gitClient.fetch(root);
            vscode.window.showInformationMessage(`Fetch complete: ${res || 'Up to date'}`);
            graphProvider?.refreshData();
          }
        );
      }
    })
  );

  console.log('⚡ [Branchify] Successfully initialized and ready.');
}

export function deactivate(): void {
  blameController?.dispose();
  graphProvider?.dispose();
  branchWatcher?.dispose();
}
