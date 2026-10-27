import * as vscode from 'vscode';
import { BlameController } from './blame/blameController';
import { BlameHoverProvider } from './blame/blameHover';
import { GraphWebviewProvider } from './graph/graphWebviewProvider';

let blameController: BlameController | undefined;
let graphProvider: GraphWebviewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('⚡ [Branchify] Activating Git Graph & Live Blame extension...');

  // 1. Initialize Live Blame Controller (Editor Ghost Text & Status Bar)
  blameController = new BlameController();
  context.subscriptions.push(blameController);

  // 2. Register Hover Provider for real-time rich author cards
  const hoverProvider = new BlameHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
  );

  // 3. Register Graph Webview Provider (Sidebar Activity Bar)
  graphProvider = new GraphWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GraphWebviewProvider.viewType,
      graphProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // 4. Command: Open Full Commit & Branch Graph Panel
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'branchify.openGraph',
      (commitHash?: string) => {
        graphProvider?.openFullPanel(commitHash);
      }
    )
  );

  // 5. Command: Toggle Live Inline Blame
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

  // 6. Command: Refresh Graph
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.refreshGraph', () => {
      graphProvider?.refreshData();
    })
  );

  // 7. Command: Copy Commit SHA
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.copyHash', async (hash?: string) => {
      if (hash) {
        await vscode.env.clipboard.writeText(hash);
        vscode.window.showInformationMessage(`Copied SHA to clipboard: ${hash.slice(0, 7)}`);
      }
    })
  );

  // 8. Command: Show Current Line Commit
  context.subscriptions.push(
    vscode.commands.registerCommand('branchify.showLineCommit', () => {
      vscode.commands.executeCommand('branchify.openGraph');
    })
  );

  console.log('⚡ [Branchify] Successfully initialized and ready.');
}

export function deactivate(): void {
  blameController?.dispose();
}
