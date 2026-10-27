import * as vscode from 'vscode';
import { GitClient } from './gitClient';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'commitflow-revision';
  private readonly gitClient = GitClient.getInstance();

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  public async provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): Promise<string> {
    if (token.isCancellationRequested) {
      return '';
    }

    // URI format: commitflow-revision://commit/<hash>/<encodedRelativePath>?cwd=<encodedCwd>
    const hash = uri.authority === 'empty' ? '' : uri.authority;
    if (!hash || hash === 'EMPTY') {
      return '';
    }

    const relativePath = decodeURIComponent(uri.path.replace(/^\//, ''));
    const query = new URLSearchParams(uri.query);
    const cwd = query.get('cwd') || (await this.gitClient.getRepoRoot());

    if (!cwd) {
      return '';
    }

    try {
      const content = await this.gitClient.execute(
        ['show', `${hash}:${relativePath}`],
        cwd,
        token
      );
      return content;
    } catch {
      return '';
    }
  }

  /**
   * Helper to build a Uri for a specific commit and file
   */
  public static createUri(
    hash: string,
    relativePath: string,
    cwd: string
  ): vscode.Uri {
    const authority = hash ? hash : 'EMPTY';
    const query = `cwd=${encodeURIComponent(cwd)}`;
    return vscode.Uri.parse(
      `${GitContentProvider.scheme}://${authority}/${encodeURIComponent(
        relativePath
      )}?${query}`
    );
  }
}
