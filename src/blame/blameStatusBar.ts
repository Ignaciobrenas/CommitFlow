import * as vscode from 'vscode';
import { GitBlameLine } from '../git/types';

export class BlameStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.name = 'Branchify Line Blame';
  }

  /**
   * Updates the status bar item with the current line's author and commit info
   */
  public update(blame: GitBlameLine | null): void {
    if (!blame) {
      this.statusBarItem.hide();
      return;
    }

    this.statusBarItem.text = `$(git-commit) ${blame.author.name}, ${blame.author.relativeTime}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**Commit:** \`${blame.shortHash}\`\n\n` +
        `**Author:** ${blame.author.name} <${blame.author.email}>\n\n` +
        `**Date:** ${blame.author.date.toLocaleString()}\n\n` +
        `**Message:** ${blame.summary}\n\n` +
        `*Click to view in Branchify Graph*`
    );

    this.statusBarItem.command = {
      command: 'branchify.openGraph',
      title: 'Open in Branchify Graph',
      arguments: [blame.commitHash],
    };

    this.statusBarItem.show();
  }

  public hide(): void {
    this.statusBarItem.hide();
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
