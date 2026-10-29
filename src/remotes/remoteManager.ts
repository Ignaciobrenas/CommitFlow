import { ParsedRemote, RemoteProvider, RemoteProviderType, RemoteRepoInfo } from './types';
import { SshConfigParser } from './sshParser';
import { GitHubProvider } from './githubProvider';
import { GitLabProvider } from './gitlabProvider';
import { ForgejoProvider } from './forgejoProvider';
import { PersistenceManager } from '../state/persistenceManager';

export class RemoteManager {
  private static instance: RemoteManager;
  private readonly providers: RemoteProvider[] = [];
  private readonly forgejoProvider: ForgejoProvider;
  private readonly githubProvider: GitHubProvider;
  private readonly gitlabProvider: GitLabProvider;
  private readonly persistence = PersistenceManager.getInstance();

  private constructor() {
    this.forgejoProvider = new ForgejoProvider();
    this.githubProvider = new GitHubProvider();
    this.gitlabProvider = new GitLabProvider();

    this.providers = [
      this.githubProvider,
      this.gitlabProvider,
      this.forgejoProvider,
    ];
  }

  public static getInstance(): RemoteManager {
    if (!RemoteManager.instance) {
      RemoteManager.instance = new RemoteManager();
    }
    return RemoteManager.instance;
  }

  public getForgejoProvider(): ForgejoProvider {
    return this.forgejoProvider;
  }

  public getGitHubProvider(): GitHubProvider {
    return this.githubProvider;
  }

  public getGitLabProvider(): GitLabProvider {
    return this.gitlabProvider;
  }

  /**
   * Universal remote URL parser with SSH config alias resolution
   */
  public async parseRemoteUrl(remoteUrl: string): Promise<RemoteRepoInfo | null> {
    if (!remoteUrl || !remoteUrl.trim()) return null;

    const sshConfigPath = this.persistence.getSshConfigPath();
    const parsed = SshConfigParser.parseRemoteUrl(remoteUrl, sshConfigPath);
    if (!parsed) return null;

    const host = (parsed.resolvedHost || parsed.host).toLowerCase();
    let selectedProvider: RemoteProvider | undefined;

    // Detect provider
    if (this.githubProvider.matches(remoteUrl, host)) {
      selectedProvider = this.githubProvider;
    } else if (this.gitlabProvider.matches(remoteUrl, host)) {
      selectedProvider = this.gitlabProvider;
    } else {
      // Check Forgejo / Gitea
      const isForgejo = await this.forgejoProvider.matches(remoteUrl, host);
      if (isForgejo) {
        selectedProvider = this.forgejoProvider;
      }
    }

    const providerType: RemoteProviderType = selectedProvider
      ? selectedProvider.type
      : host.includes('bitbucket')
      ? 'bitbucket'
      : 'other';

    let webUrl = '';
    if (selectedProvider) {
      webUrl = selectedProvider.getWebUrl(parsed);
    } else if (providerType === 'bitbucket') {
      webUrl = `https://${host}/${parsed.owner}/${parsed.repo}`;
    } else {
      const proto = parsed.protocol === 'http' ? 'http' : 'https';
      webUrl = `${proto}://${host}/${parsed.owner}/${parsed.repo}`;
    }

    const isPrivate =
      parsed.protocol === 'ssh' ||
      providerType === 'forgejo' ||
      host !== 'github.com' && host !== 'gitlab.com' && host !== 'bitbucket.org';

    let badgeType: RemoteRepoInfo['badgeType'] = 'private';
    let badgeLabel = '🔒 Repositorio Privado';

    if (providerType === 'forgejo') {
      badgeType = 'forgejo';
      badgeLabel = host.includes('forgejo')
        ? '🔒 Forgejo Privado'
        : '🔒 Forgejo Self-Hosted';
    } else if (providerType === 'github') {
      badgeType = 'github';
      badgeLabel = isPrivate ? '🔒 GitHub Privado' : 'GitHub';
    } else if (providerType === 'gitlab') {
      badgeType = 'gitlab';
      badgeLabel = isPrivate ? '🔒 GitLab Privado' : 'GitLab';
    }

    return {
      provider: providerType,
      owner: parsed.owner,
      repo: parsed.repo,
      webUrl,
      isPrivate,
      authConnected: true,
      host,
      port: parsed.resolvedPort || parsed.port,
      badgeType,
      badgeLabel,
    };
  }

  public getProvider(providerType: RemoteProviderType): RemoteProvider | undefined {
    switch (providerType) {
      case 'forgejo':
        return this.forgejoProvider;
      case 'github':
        return this.githubProvider;
      case 'gitlab':
        return this.gitlabProvider;
      default:
        return undefined;
    }
  }

  public getCommitUrl(repoInfo: RemoteRepoInfo, commitHash: string): string {
    const prov = this.getProvider(repoInfo.provider);
    if (prov) return prov.getCommitUrl(repoInfo, commitHash);
    if (repoInfo.provider === 'bitbucket') return `${repoInfo.webUrl}/commits/${commitHash}`;
    return `${repoInfo.webUrl}/commit/${commitHash}`;
  }

  public getBranchUrl(repoInfo: RemoteRepoInfo, branchName: string): string {
    const prov = this.getProvider(repoInfo.provider);
    if (prov) return prov.getBranchUrl(repoInfo, branchName);
    const clean = branchName.replace(/^origin\//, '');
    if (repoInfo.provider === 'bitbucket') return `${repoInfo.webUrl}/src/${encodeURIComponent(clean)}`;
    return `${repoInfo.webUrl}/tree/${encodeURIComponent(clean)}`;
  }

  public getIssueOrPrUrl(repoInfo: RemoteRepoInfo, issueNumber: number | string): string {
    const prov = this.getProvider(repoInfo.provider);
    if (prov) return prov.getIssueUrl(repoInfo, issueNumber);
    if (repoInfo.provider === 'bitbucket') return `${repoInfo.webUrl}/issues/${issueNumber}`;
    return `${repoInfo.webUrl}/issues/${issueNumber}`;
  }

  public getPullRequestUrl(repoInfo: RemoteRepoInfo, prNumber: number | string): string {
    const prov = this.getProvider(repoInfo.provider);
    if (prov) return prov.getPullRequestUrl(repoInfo, prNumber);
    if (repoInfo.provider === 'bitbucket') return `${repoInfo.webUrl}/pull-requests/${prNumber}`;
    return `${repoInfo.webUrl}/pull/${prNumber}`;
  }

  public autolinkIssues(repoInfo: RemoteRepoInfo, text: string): string {
    return text.replace(/(^|[\s(])#([0-9]+)(?=[\s).,;:]|$)/g, (match, prefix, num) => {
      const url = this.getIssueOrPrUrl(repoInfo, num);
      return `${prefix}[#${num}](${url})`;
    });
  }
}
