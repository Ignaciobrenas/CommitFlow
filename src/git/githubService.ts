import { RemoteProviderType, RemoteRepoInfo, GitHubRepoInfo } from './types';
import { RemoteManager } from '../remotes/remoteManager';
import { SshConfigParser } from '../remotes/sshParser';

export { GitHubRepoInfo };

export class GitHubService {
  private static instance: GitHubService;
  private readonly remoteManager = RemoteManager.getInstance();

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  /**
   * Synchronous parse for standard URLs, or forwards through SshConfigParser
   */
  public parseRemoteUrl(remoteUrl: string): RemoteRepoInfo | null {
    if (!remoteUrl || !remoteUrl.trim()) {
      return null;
    }

    const parsed = SshConfigParser.parseRemoteUrl(remoteUrl);
    if (!parsed) return null;

    const host = (parsed.resolvedHost || parsed.host).toLowerCase();
    let provider: RemoteProviderType = 'other';
    let isPrivate = parsed.protocol === 'ssh';

    if (host === 'github.com' || host.includes('github')) {
      provider = 'github';
    } else if (host === 'gitlab.com' || host.includes('gitlab')) {
      provider = 'gitlab';
    } else if (host === 'bitbucket.org' || host.includes('bitbucket')) {
      provider = 'bitbucket';
    } else if (host.includes('forgejo') || host.includes('gitea')) {
      provider = 'forgejo' as any;
      isPrivate = true;
    } else {
      isPrivate = true;
    }

    const portPart = parsed.protocol === 'http' || parsed.protocol === 'https'
      ? (parsed.port && parsed.port !== 80 && parsed.port !== 443 ? `:${parsed.port}` : '')
      : '';
    const scheme = parsed.protocol === 'http' ? 'http' : 'https';
    const webUrl = `${scheme}://${parsed.resolvedHost || parsed.host}${portPart}/${parsed.owner}/${parsed.repo}`;

    return {
      provider,
      owner: parsed.owner,
      repo: parsed.repo,
      webUrl,
      isPrivate,
      authConnected: true,
    };
  }

  public getCommitUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, commitHash: string): string {
    return this.remoteManager.getCommitUrl(repoInfo as any, commitHash);
  }

  public getBranchUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, branchName: string): string {
    return this.remoteManager.getBranchUrl(repoInfo as any, branchName);
  }

  public getIssueOrPrUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, issueNumber: number | string): string {
    return this.remoteManager.getIssueOrPrUrl(repoInfo as any, issueNumber);
  }

  public getPullRequestUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, prNumber: number | string): string {
    return this.remoteManager.getPullRequestUrl(repoInfo as any, prNumber);
  }

  public autolinkIssues(repoInfo: RemoteRepoInfo | GitHubRepoInfo, text: string): string {
    return this.remoteManager.autolinkIssues(repoInfo as any, text);
  }
}
