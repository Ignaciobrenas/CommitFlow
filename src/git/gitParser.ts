import { GitAuthor, GitCommit, GitCommitRef } from './types';
import { AvatarService } from '../avatars/avatarService';

export class GitParser {
  private static readonly avatarService = AvatarService.getInstance();

  /**
   * Formats a Unix timestamp or Date into a concise, readable relative time string
   */
  public static formatRelativeTime(dateOrTimestamp: Date | number): string {
    const time =
      typeof dateOrTimestamp === 'number'
        ? dateOrTimestamp * 1000
        : dateOrTimestamp.getTime();
    const diff = Math.max(0, Date.now() - time);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 45) {
      return 'just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    if (days < 30) {
      return `${days}d ago`;
    }
    if (months < 12) {
      return `${months}mo ago`;
    }
    return `${years}y ago`;
  }

  /**
   * Parses git log format:
   * %H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s%x1f%b%x1e
   */
  public static parseLogOutput(rawOutput: string): GitCommit[] {
    if (!rawOutput || !rawOutput.trim()) {
      return [];
    }

    const records = rawOutput.split('\x1e');
    const commits: GitCommit[] = [];

    for (const record of records) {
      const trimmed = record.trim();
      if (!trimmed) {
        continue;
      }

      const parts = trimmed.split('\x1f');
      if (parts.length < 11) {
        continue;
      }

      const [
        hash,
        parentsRaw,
        authorName,
        authorEmail,
        authorTimestampRaw,
        committerName,
        committerEmail,
        committerTimestampRaw,
        refsRaw,
        subject,
        body,
      ] = parts;

      const parentHashes = parentsRaw.trim()
        ? parentsRaw.trim().split(/\s+/)
        : [];
      const authorDate = new Date(parseInt(authorTimestampRaw, 10) * 1000);
      const committerDate = new Date(
        parseInt(committerTimestampRaw, 10) * 1000
      );

      const author: GitAuthor = {
        name: authorName || 'Unknown',
        email: authorEmail || '',
        date: authorDate,
        relativeTime: GitParser.formatRelativeTime(authorDate),
        avatarUrl: GitParser.avatarService.getAvatarUrl(
          authorName || 'Unknown',
          authorEmail || ''
        ),
      };

      const committer: GitAuthor = {
        name: committerName || author.name,
        email: committerEmail || author.email,
        date: committerDate,
        relativeTime: GitParser.formatRelativeTime(committerDate),
        avatarUrl: GitParser.avatarService.getAvatarUrl(
          committerName || author.name,
          committerEmail || author.email
        ),
      };

      const refs = GitParser.parseRefs(refsRaw);

      let signatureStatus: 'valid' | 'invalid' | 'untrusted' | 'none' | undefined;
      let signer: string | undefined;
      let keyId: string | undefined;

      if (parts.length >= 14) {
        const sigFlag = parts[11]?.trim();
        signer = parts[12]?.trim() || undefined;
        keyId = parts[13]?.trim() || undefined;

        if (sigFlag === 'G') {
          signatureStatus = 'valid';
        } else if (sigFlag === 'B' || sigFlag === 'R' || sigFlag === 'E') {
          signatureStatus = 'invalid';
        } else if (sigFlag === 'U' || sigFlag === 'X' || sigFlag === 'Y') {
          signatureStatus = 'untrusted';
        } else {
          signatureStatus = 'none';
        }
      }

      commits.push({
        hash: hash.trim(),
        shortHash: hash.trim().slice(0, 7),
        parentHashes,
        author,
        committer,
        subject: subject || '(no commit message)',
        body: body ? body.trim() : '',
        refs,
        signatureStatus,
        signer,
        keyId,
      });
    }

    return commits;
  }

  /**
   * Parses git ref decoration strings like:
   * "HEAD -> main, tag: v1.0.0, origin/main, feature/auth"
   */
  public static parseRefs(refsRaw: string): GitCommitRef[] {
    if (!refsRaw || !refsRaw.trim()) {
      return [];
    }

    const rawList = refsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const refs: GitCommitRef[] = [];

    for (const item of rawList) {
      if (item.startsWith('HEAD -> ')) {
        const branchName = item.replace('HEAD -> ', '').trim();
        refs.push({
          type: 'branch',
          name: branchName,
          isHead: true,
        });
      } else if (item === 'HEAD') {
        refs.push({
          type: 'head',
          name: 'HEAD',
          isHead: true,
        });
      } else if (item.startsWith('tag: ')) {
        const tagName = item.replace('tag: ', '').trim();
        refs.push({
          type: 'tag',
          name: tagName,
          isHead: false,
        });
      } else if (item.includes('/')) {
        refs.push({
          type: 'remote-branch',
          name: item,
          isHead: false,
        });
      } else {
        refs.push({
          type: 'branch',
          name: item,
          isHead: false,
        });
      }
    }

    return refs;
  }
}
