export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  webUrl: string;
}

export class GitHubService {
  private static instance: GitHubService;

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  /**
   * Parses git remote URL into GitHub repository information.
   * Handles HTTPS, SSH, and git protocols:
   * - https://github.com/owner/repo.git
   * - git@github.com:owner/repo.git
   * - ssh://git@github.com/owner/repo.git
   */
  public parseRemoteUrl(remoteUrl: string): GitHubRepoInfo | null {
    if (!remoteUrl || !remoteUrl.trim()) {
      return null;
    }

    const clean = remoteUrl.trim();

    // 1. SSH format: git@github.com:owner/repo.git
    const sshMatch = clean.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i);
    if (sshMatch) {
      const owner = sshMatch[1];
      const repo = sshMatch[2];
      return {
        owner,
        repo,
        webUrl: `https://github.com/${owner}/${repo}`,
      };
    }

    // 2. HTTPS format: https://github.com/owner/repo.git or ssh://git@github.com/...
    const httpsMatch = clean.match(/^(?:https?|ssh):\/\/(?:git@)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (httpsMatch) {
      const owner = httpsMatch[1];
      const repo = httpsMatch[2];
      return {
        owner,
        repo,
        webUrl: `https://github.com/${owner}/${repo}`,
      };
    }

    return null;
  }

  /**
   * Generates a link to a commit on GitHub
   */
  public getCommitUrl(repoInfo: GitHubRepoInfo, commitHash: string): string {
    return `${repoInfo.webUrl}/commit/${commitHash}`;
  }

  /**
   * Generates a link to a branch on GitHub
   */
  public getBranchUrl(repoInfo: GitHubRepoInfo, branchName: string): string {
    const cleanBranch = branchName.replace(/^origin\//, '');
    return `${repoInfo.webUrl}/tree/${encodeURIComponent(cleanBranch)}`;
  }

  /**
   * Generates a link to an issue or pull request on GitHub
   */
  public getIssueOrPrUrl(repoInfo: GitHubRepoInfo, issueNumber: number | string): string {
    return `${repoInfo.webUrl}/issues/${issueNumber}`;
  }

  /**
   * Links issue numbers like #123 in commit subjects or bodies to GitHub
   */
  public autolinkIssues(repoInfo: GitHubRepoInfo, text: string): string {
    return text.replace(/(^|[\s(])#([0-9]+)(?=[\s).,;:]|$)/g, (match, prefix, num) => {
      const url = this.getIssueOrPrUrl(repoInfo, num);
      return `${prefix}[#${num}](${url})`;
    });
  }
}
