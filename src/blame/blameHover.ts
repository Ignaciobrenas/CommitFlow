import * as vscode from 'vscode';
import { GitClient } from '../git/gitClient';
import { t, Language } from '../i18n/locales';

export class BlameHoverProvider implements vscode.HoverProvider {
  private readonly gitClient = GitClient.getInstance();

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    if (document.isUntitled || document.uri.scheme !== 'file') {
      return null;
    }

    const lineNumber = position.line + 1;

    try {
      const blame = await this.gitClient.getBlameForLine(
        document.uri.fsPath,
        lineNumber,
        token
      );

      if (!blame) {
        return null;
      }

      const config = vscode.workspace.getConfiguration('commitflow');
      const lang = config.get<Language>('language', 'auto');
      const sysLang = vscode.env.language;

      const md = new vscode.MarkdownString();
      md.supportHtml = true;
      md.isTrusted = true;

      const isUncommitted = blame.commitHash === '0000000' || /^0+$/.test(blame.commitHash);

      // 1. Author header with avatar
      const avatarHtml = `<img src="${blame.author.avatarUrl}" width="20" height="20" style="border-radius:50%; vertical-align:middle; margin-right:6px;" />`;
      md.appendMarkdown(`${avatarHtml} **${blame.author.name}** `);

      if (blame.author.email) {
        md.appendMarkdown(`<span style="color:var(--vscode-descriptionForeground); font-size:11px;">&lt;${blame.author.email}&gt;</span> `);
      }

      md.appendMarkdown(`\n\n`);
      md.appendMarkdown(
        `<span style="color:var(--vscode-descriptionForeground); font-size:11px;">$(clock) ${blame.author.relativeTime} &bull; ${blame.author.date.toLocaleString()} &bull; ${t('blame.line', lang, sysLang)} ${blame.line}</span>\n\n`
      );

      // 2. Commit Message
      md.appendMarkdown(`> **${blame.summary}**\n\n`);
      md.appendMarkdown(`---\n\n`);

      // 3. GitLens-style Action Toolbar
      if (!isUncommitted) {
        md.appendMarkdown(`**${t('ext.statusCommit', lang, sysLang)}** \`${blame.shortHash}\` &nbsp;&nbsp;\n\n`);

        const openArgs = encodeURIComponent(JSON.stringify([blame.commitHash]));
        const copyArgs = encodeURIComponent(JSON.stringify([blame.commitHash]));

        md.appendMarkdown(
          `[$(git-diff) ${t('blame.viewChanges', lang, sysLang)}](command:commitflow.openLineDiff "${t('blame.viewChangesTitle', lang, sysLang)}") &nbsp;|&nbsp; ` +
            `[$(git-branch) ${t('blame.inspectInGraph', lang, sysLang)}](command:commitflow.openGraph?${openArgs} "${t('blame.inspectInGraphTitle', lang, sysLang)}") &nbsp;|&nbsp; ` +
            `[$(clippy) ${t('blame.copySha', lang, sysLang)}](command:commitflow.copyHash?${copyArgs} "${t('blame.copyShaTitle', lang, sysLang)}") &nbsp;|&nbsp; ` +
            `[$(link-external) ${t('blame.openRemote', lang, sysLang)}](command:commitflow.openOnGitHub?${openArgs} "${t('blame.openRemoteTitle', lang, sysLang)}")\n`
        );
      } else {
        md.appendMarkdown(`*$(edit) ${t('blame.uncommitted', lang, sysLang)}*\n\n`);
        md.appendMarkdown(
          `[$(git-diff) ${t('blame.compareWithHead', lang, sysLang)}](command:commitflow.openLineDiff "${t('blame.compareWithHeadTitle', lang, sysLang)}") &nbsp;|&nbsp; ` +
            `[$(git-branch) ${t('blame.openGraph', lang, sysLang)}](command:commitflow.openGraph "${t('ext.statusCommandTitle', lang, sysLang)}")\n`
        );
      }

      const lineRange = document.lineAt(position.line).range;
      return new vscode.Hover(md, lineRange);
    } catch {
      return null;
    }
  }
}
