import * as vscode from 'vscode';
import { GitClient } from './gitClient';
import { t, Language } from '../i18n/locales';

export class BranchWatcherService implements vscode.Disposable {
  private readonly gitClient = GitClient.getInstance();
  private readonly disposables: vscode.Disposable[] = [];
  private fetchTimer: NodeJS.Timeout | null = null;
  private lastAlertedState: string | null = null;
  private isChecking = false;

  constructor(private readonly onRefreshRequired: () => void) {
    this.setupFileWatcher();
    this.setupAutoFetchTimer();

    // Listen to settings changes affecting watcher
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('branchify.sync')) {
          this.setupAutoFetchTimer();
        }
      },
      null,
      this.disposables
    );
  }

  private setupFileWatcher(): void {
    // Watch ref updates (branch commits, checkouts, pulls, fetches)
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/.git/{refs/heads/**,refs/remotes/**,FETCH_HEAD,HEAD}'
    );

    watcher.onDidChange(() => this.onGitRefChanged(), this, this.disposables);
    watcher.onDidCreate(() => this.onGitRefChanged(), this, this.disposables);
    this.disposables.push(watcher);
  }

  private setupAutoFetchTimer(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
    }

    const config = vscode.workspace.getConfiguration('branchify.sync');
    const autoFetch = config.get<boolean>('autoFetch', true);
    const intervalMinutes = config.get<number>('fetchIntervalMinutes', 5);

    if (autoFetch && intervalMinutes > 0) {
      const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
      this.fetchTimer = setInterval(() => {
        this.performBackgroundFetch();
      }, intervalMs);
    }
  }

  private async onGitRefChanged(): Promise<void> {
    // Trigger graph refresh
    this.onRefreshRequired();

    // Check upstream status
    await this.checkUpstreamAndNotify();
  }

  private async performBackgroundFetch(): Promise<void> {
    const root = await this.gitClient.getRepoRoot();
    if (!root) return;

    try {
      await this.gitClient.fetch(root);
      await this.checkUpstreamAndNotify();
    } catch {}
  }

  /**
   * Checks upstream status and displays interactive pull notification if merge or commits detected
   */
  public async checkUpstreamAndNotify(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const root = await this.gitClient.getRepoRoot();
      if (!root) return;

      const config = vscode.workspace.getConfiguration('branchify');
      const notifyEnabled = config.get<boolean>('sync.notifyOnBranchMerge', true);
      if (!notifyEnabled) return;

      const lang = config.get<Language>('language', 'auto');
      const sysLang = vscode.env.language;

      const status = await this.gitClient.getUpstreamStatus(root);
      if (!status || status.behind <= 0) {
        return;
      }

      // Avoid repeating notification for the exact same behind/upstream state
      const stateKey = `${status.upstreamBranch}:${status.behind}:${status.hasMerge}`;
      if (this.lastAlertedState === stateKey) {
        return;
      }
      this.lastAlertedState = stateKey;

      const mergeText = status.hasMerge ? ' (Merge)' : '';
      const message = `${t('watcher.mergeDetected', lang, sysLang)} '${status.upstreamBranch}'${mergeText}: ${status.behind} ${t('watcher.commitsBehind', lang, sysLang)} ${t('watcher.pullPrompt', lang, sysLang)}`;

      const btnPull = t('watcher.pullNow', lang, sysLang);
      const btnView = t('watcher.viewInGraph', lang, sysLang);
      const btnDismiss = t('watcher.dismiss', lang, sysLang);

      vscode.window
        .showInformationMessage(message, btnPull, btnView, btnDismiss)
        .then(async (selection) => {
          if (selection === btnPull) {
            await this.executePull(root, lang, sysLang);
          } else if (selection === btnView) {
            vscode.commands.executeCommand('branchify.openGraph');
          }
        });
    } catch {
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Executes git pull with progress notification and refreshes UI
   */
  public async executePull(
    root: string,
    lang?: Language,
    sysLang?: string
  ): Promise<boolean> {
    const resolvedLang =
      lang || vscode.workspace.getConfiguration('branchify').get<Language>('language', 'auto');
    const resolvedSysLang = sysLang || vscode.env.language;

    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('watcher.pullingProgress', resolvedLang, resolvedSysLang),
        cancellable: false,
      },
      async () => {
        try {
          const result = await this.gitClient.pull(root);
          vscode.window.showInformationMessage(
            `${t('watcher.pullSuccess', resolvedLang, resolvedSysLang)} (${result.split('\n')[0] || 'OK'})`
          );
          this.onRefreshRequired();
          return true;
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `${t('watcher.pullError', resolvedLang, resolvedSysLang)} ${err.message || String(err)}`
          );
          return false;
        }
      }
    );
  }

  public dispose(): void {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
    }
    vscode.Disposable.from(...this.disposables).dispose();
  }
}
