import * as vscode from 'vscode';
import { GitBlameLine } from '../git/types';
import { t } from '../i18n/locales';

export class BlameStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.name = 'CommitFlow Line Blame';
  }

  /**
   * Updates the status bar item with the current line's author and commit info
   */
  public update(blame: GitBlameLine | null): void {
    if (!blame) {
      this.statusBarItem.hide();
      return;
    }

    const config = vscode.workspace.getConfiguration('commitflow');
    const lang = config.get<'auto' | 'es' | 'en'>('language', 'auto');
    const sysLang = vscode.env.language;

    this.statusBarItem.text = `$(git-branch) CommitFlow: ${blame.author.name}, ${blame.author.relativeTime}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**${t('ext.statusCommit', lang, sysLang)}** \`${blame.shortHash}\`\n\n` +
        `**${t('ext.statusAuthor', lang, sysLang)}** ${blame.author.name} <${blame.author.email}>\n\n` +
        `**${t('ext.statusDate', lang, sysLang)}** ${blame.author.date.toLocaleString()}\n\n` +
        `**${t('ext.statusMessage', lang, sysLang)}** ${blame.summary}\n\n` +
        `*${t('ext.statusTooltip', lang, sysLang)}*`
    );

    this.statusBarItem.command = {
      command: 'commitflow.openGraph',
      title: t('ext.statusCommandTitle', lang, sysLang),
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
