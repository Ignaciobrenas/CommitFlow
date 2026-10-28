import { RemoteProviderType, RemoteRepoInfo, GitHubRepoInfo } from './types';

export { GitHubRepoInfo };

export class GitHubService {
  private static instance: GitHubService;

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  /**
   * Parses git remote URL into Remote repository information for GitHub, GitLab, or Bitbucket.
   * Supports:
   * - GitHub: git@github.com:owner/repo.git | https://github.com/owner/repo.git
   * - GitLab: git@gitlab.com:owner/repo.git | https://gitlab.com/owner/repo.git
   * - Bitbucket: git@bitbucket.org:owner/repo.git | https://bitbucket.org/owner/repo.git
   */
  public parseRemoteUrl(remoteUrl: string): RemoteRepoInfo | null {
    if (!remoteUrl || !remoteUrl.trim()) {
      return null;
    }

    const clean = remoteUrl.trim();

    // 1. GitHub
    const ghSsh = clean.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i);
    if (ghSsh) {
      return {
        provider: 'github',
        owner: ghSsh[1],
        repo: ghSsh[2],
        webUrl: `https://github.com/${ghSsh[1]}/${ghSsh[2]}`,
        isPrivate: true,
        authConnected: true,
      };
    }
    const ghHttps = clean.match(/^(?:https?|ssh):\/\/(?:git@)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (ghHttps) {
      return {
        provider: 'github',
        owner: ghHttps[1],
        repo: ghHttps[2],
        webUrl: `https://github.com/${ghHttps[1]}/${ghHttps[2]}`,
        isPrivate: false,
        authConnected: true,
      };
    }

    // 2. GitLab
    const glSsh = clean.match(/^git@gitlab\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i);
    if (glSsh) {
      return {
        provider: 'gitlab',
        owner: glSsh[1],
        repo: glSsh[2],
        webUrl: `https://gitlab.com/${glSsh[1]}/${glSsh[2]}`,
        isPrivate: true,
        authConnected: true,
      };
    }
    const glHttps = clean.match(/^(?:https?|ssh):\/\/(?:git@)?gitlab\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (glHttps) {
      return {
        provider: 'gitlab',
        owner: glHttps[1],
        repo: glHttps[2],
        webUrl: `https://gitlab.com/${glHttps[1]}/${glHttps[2]}`,
        isPrivate: false,
        authConnected: true,
      };
    }

    // 3. Bitbucket
    const bbSsh = clean.match(/^git@bitbucket\.org:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i);
    if (bbSsh) {
      return {
        provider: 'bitbucket',
        owner: bbSsh[1],
        repo: bbSsh[2],
        webUrl: `https://bitbucket.org/${bbSsh[1]}/${bbSsh[2]}`,
        isPrivate: true,
        authConnected: true,
      };
    }
    const bbHttps = clean.match(/^(?:https?|ssh):\/\/(?:git@)?bitbucket\.org\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (bbHttps) {
      return {
        provider: 'bitbucket',
        owner: bbHttps[1],
        repo: bbHttps[2],
        webUrl: `https://bitbucket.org/${bbHttps[1]}/${bbHttps[2]}`,
        isPrivate: false,
        authConnected: true,
      };
    }

    // 4. Custom self-hosted Git server (GitLab EE/CE, GitHub Enterprise, Gitea)
    const genericMatch = clean.match(/^(?:(?:git@|(?:https?|ssh):\/\/)(?:[^@]+@)?)([^:/]+)[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (genericMatch) {
      const host = genericMatch[1];
      const owner = genericMatch[2];
      const repo = genericMatch[3];
      const provider: RemoteProviderType = host.includes('gitlab')
        ? 'gitlab'
        : host.includes('github')
        ? 'github'
        : host.includes('bitbucket')
        ? 'bitbucket'
        : 'other';

      return {
        provider,
        owner,
        repo,
        webUrl: `https://${host}/${owner}/${repo}`,
        isPrivate: true,
        authConnected: true,
      };
    }

    return null;
  }

  /**
   * Generates a link to a commit on remote host (GitHub, GitLab, Bitbucket)
   */
  public getCommitUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, commitHash: string): string {
    const provider = ('provider' in repoInfo) ? repoInfo.provider : 'github';
    switch (provider) {
      case 'gitlab':
        return `${repoInfo.webUrl}/-/commit/${commitHash}`;
      case 'bitbucket':
        return `${repoInfo.webUrl}/commits/${commitHash}`;
      case 'github':
      default:
        return `${repoInfo.webUrl}/commit/${commitHash}`;
    }
  }

  /**
   * Generates a link to a branch on remote host
   */
  public getBranchUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, branchName: string): string {
    const cleanBranch = branchName.replace(/^origin\//, '');
    const provider = ('provider' in repoInfo) ? repoInfo.provider : 'github';
    switch (provider) {
      case 'gitlab':
        return `${repoInfo.webUrl}/-/tree/${encodeURIComponent(cleanBranch)}`;
      case 'bitbucket':
        return `${repoInfo.webUrl}/src/${encodeURIComponent(cleanBranch)}`;
      case 'github':
      default:
        return `${repoInfo.webUrl}/tree/${encodeURIComponent(cleanBranch)}`;
    }
  }

  /**
   * Generates a link to an issue or pull request
   */
  public getIssueOrPrUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, issueNumber: number | string): string {
    const provider = ('provider' in repoInfo) ? repoInfo.provider : 'github';
    switch (provider) {
      case 'gitlab':
        return `${repoInfo.webUrl}/-/issues/${issueNumber}`;
      case 'bitbucket':
        return `${repoInfo.webUrl}/issues/${issueNumber}`;
      case 'github':
      default:
        return `${repoInfo.webUrl}/issues/${issueNumber}`;
    }
  }

  /**
   * Generates a direct URL to a Pull Request or Merge Request
   */
  public getPullRequestUrl(repoInfo: RemoteRepoInfo | GitHubRepoInfo, prNumber: number | string): string {
    const provider = ('provider' in repoInfo) ? repoInfo.provider : 'github';
    switch (provider) {
      case 'gitlab':
        return `${repoInfo.webUrl}/-/merge_requests/${prNumber}`;
      case 'bitbucket':
        return `${repoInfo.webUrl}/pull-requests/${prNumber}`;
      case 'github':
      default:
        return `${repoInfo.webUrl}/pull/${prNumber}`;
    }
  }

  /**
   * Links issue numbers like #123 in commit subjects or bodies to remote
   */
  public autolinkIssues(repoInfo: RemoteRepoInfo | GitHubRepoInfo, text: string): string {
    return text.replace(/(^|[\s(])#([0-9]+)(?=[\s).,;:]|$)/g, (match, prefix, num) => {
      const url = this.getIssueOrPrUrl(repoInfo, num);
      return `${prefix}[#${num}](${url})`;
    });
  }
}
