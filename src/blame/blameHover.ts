import * as vscode from 'vscode';
import { GitClient } from '../git/gitClient';

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

      const md = new vscode.MarkdownString();
      md.supportHtml = true;
      md.isTrusted = true;

      // Author header with avatar
      const avatarHtml = `<img src="${blame.author.avatarUrl}" width="24" height="24" style="border-radius:50%; vertical-align:middle; margin-right:8px;" />`;
      md.appendMarkdown(`### ${avatarHtml} **${blame.author.name}**\n\n`);

      md.appendMarkdown(
        `*${blame.author.email ? `<${blame.author.email}> • ` : ''}${blame.author.relativeTime} (${blame.author.date.toLocaleDateString()})*\n\n`
      );

      md.appendMarkdown(`> ${blame.summary}\n\n`);
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`**Commit:** \`${blame.shortHash}\` &nbsp;&nbsp; `);

      const openArgs = encodeURIComponent(JSON.stringify([blame.commitHash]));
      md.appendMarkdown(
        `[$(git-branch) View in Branchify](command:branchify.openGraph?${openArgs} "Open commit in Branchify Graph") &nbsp;|&nbsp; `
      );

      const copyArgs = encodeURIComponent(JSON.stringify([blame.commitHash]));
      md.appendMarkdown(
        `[$(clippy) Copy SHA](command:branchify.copyHash?${copyArgs} "Copy Commit SHA")\n`
      );

      const lineRange = document.lineAt(position.line).range;
      return new vscode.Hover(md, lineRange);
    } catch {
      return null;
    }
  }
}
