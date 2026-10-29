import * as vscode from 'vscode';

export class PersistenceManager {
  private static instance: PersistenceManager;
  private secretStorage?: vscode.SecretStorage;
  private inMemorySecrets: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  public init(context: vscode.ExtensionContext): void {
    this.secretStorage = context.secrets;
  }

  /**
   * Reads a typed configuration setting under 'commitflow' namespace
   */
  public getSetting<T>(section: string, defaultValue: T): T {
    try {
      const config = vscode.workspace.getConfiguration('commitflow');
      const val = config.get<T>(section);
      return val !== undefined && val !== null ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Updates a configuration setting in settings.json
   */
  public async updateSetting<T>(
    section: string,
    value: T,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('commitflow');
      await config.update(section, value, target);
    } catch (err) {
      console.error(`Failed to update setting commitflow.${section}:`, err);
    }
  }

  /**
   * Retrieves a secret (e.g. API token) securely from SecretStorage
   */
  public async getSecret(key: string): Promise<string | undefined> {
    if (this.secretStorage) {
      try {
        return await this.secretStorage.get(key);
      } catch (err) {
        console.warn(`Failed to read secret ${key} from SecretStorage, falling back:`, err);
      }
    }
    return this.inMemorySecrets.get(key);
  }

  /**
   * Securely stores an API token in SecretStorage
   */
  public async storeSecret(key: string, value: string): Promise<void> {
    if (this.secretStorage) {
      try {
        await this.secretStorage.store(key, value);
        return;
      } catch (err) {
        console.warn(`Failed to store secret ${key} in SecretStorage, saving in-memory:`, err);
      }
    }
    this.inMemorySecrets.set(key, value);
  }

  /**
   * Deletes a stored secret
   */
  public async deleteSecret(key: string): Promise<void> {
    if (this.secretStorage) {
      try {
        await this.secretStorage.delete(key);
      } catch {}
    }
    this.inMemorySecrets.delete(key);
  }

  // --- Specific Forgejo Token Helpers ---
  public getForgejoSecretKey(host: string): string {
    const cleanHost = host.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    return `commitflow.token.forgejo.${cleanHost}`;
  }

  public async getForgejoToken(host: string): Promise<string | undefined> {
    return this.getSecret(this.getForgejoSecretKey(host));
  }

  public async setForgejoToken(host: string, token: string): Promise<void> {
    await this.storeSecret(this.getForgejoSecretKey(host), token);
  }

  // --- Forgejo Instances List ---
  public getForgejoInstances(): string[] {
    return this.getSetting<string[]>('remotes.forgejoInstances', []);
  }

  public async addForgejoInstance(host: string): Promise<void> {
    const list = this.getForgejoInstances();
    if (!list.includes(host)) {
      list.push(host);
      await this.updateSetting('remotes.forgejoInstances', list);
    }
  }

  // --- SSH Config Path ---
  public getSshConfigPath(): string {
    return this.getSetting<string>('ssh.configPath', '~/.ssh/config');
  }

  // --- Issues Settings ---
  public getDefaultIssueFilter(): 'assignedToMe' | 'linkedToBranch' | 'createdByMe' | 'allOpen' {
    return this.getSetting<'assignedToMe' | 'linkedToBranch' | 'createdByMe' | 'allOpen'>(
      'issues.defaultFilter',
      'assignedToMe'
    );
  }

  public getBranchNamingPattern(): string {
    return this.getSetting<string>('issues.branchNamingPattern', 'feat/{id}-{slug}');
  }

  // --- Fork Integration Setting ---
  public isForkIntegrationEnabled(): boolean {
    return this.getSetting<boolean>('integrations.enableForkButton', true);
  }
}
