import * as vscode from 'vscode';
import * as path from 'path';
import { GitClient } from '../git/gitClient';
import { GraphLayout } from './graphLayout';
import { GitContentProvider } from '../git/gitContentProvider';
import { t } from '../i18n/locales';
import { IssueService } from '../issues/issueService';
import { ForkIntegration } from '../remotes/forkIntegration';
import { PersistenceManager } from '../state/persistenceManager';
import {
  CommitFlowSettings,
  ExtensionToWebviewMessage,
  LayoutMode,
  WebviewToExtensionMessage,
} from '../git/types';

export class GraphWebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = 'commitflow.graphView';
  public static readonly mainViewType = 'commitflow.mainView';
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private readonly gitClient = GitClient.getInstance();
  private readonly issueService = IssueService.getInstance();
  private readonly forkIntegration = ForkIntegration.getInstance();
  private readonly persistence = PersistenceManager.getInstance();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {
    // 1. Watch for Git HEAD changes to auto-refresh when checking out branches
    const watcher = vscode.workspace.createFileSystemWatcher('**/.git/HEAD');
    watcher.onDidChange(() => this.refreshData(), this, this.disposables);
    watcher.onDidCreate(() => this.refreshData(), this, this.disposables);
    this.disposables.push(watcher);

    // 2. Multi-root workspace: Refresh when switching active editor to a different root
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor?.document.uri.scheme === 'file') {
          this.refreshData();
        }
      },
      null,
      this.disposables
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.setupMessageListener(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshData();
      }
    });
  }

  /**
   * Opens or reveals the Graph as a full editor tab
   */
  public openFullPanel(targetCommitHash?: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'commitflow.graphPanel',
        'CommitFlow: Git Graph & Developer Hub',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist'),
            vscode.Uri.joinPath(this.extensionUri, 'resources'),
          ],
        }
      );

      this.panel.iconPath = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'icon.png'
      );
      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
      this.setupMessageListener(this.panel.webview);

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.refreshData();
  }

  public showPersonalModal(): void {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );
    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'openPersonalModal' });
      } catch {}
    });
  }

  public showSettingsModal(): void {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );
    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'openSettingsModal' });
      } catch {}
    });
  }

  public switchTab(tabId: string): void {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );
    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'switchTab', payload: tabId });
      } catch {}
    });
  }

  /**
   * Refreshes the Git data and sends to all active webviews
   */
  public async refreshData(): Promise<void> {
    const activeWebviews = [this.view?.webview, this.panel?.webview].filter(
      (w): w is vscode.Webview => w !== undefined
    );

    if (activeWebviews.length === 0) {
      return;
    }

    activeWebviews.forEach((w) => {
      try {
        w.postMessage({ command: 'loading' } as ExtensionToWebviewMessage);
      } catch {}
    });

    try {
      const root = await this.gitClient.getRepoRoot();
      if (!root) {
        activeWebviews.forEach((w) => {
          try {
            w.postMessage({
              command: 'error',
              payload:
                'No Git repository detected in the active workspace. Open a folder with a Git repository to view CommitFlow.',
            } as ExtensionToWebviewMessage);
          } catch {}
        });
        return;
      }

      const config = vscode.workspace.getConfiguration('commitflow');
      const limit = config.get<number>('graph.pageSize', 300);

      const [
        commits,
        branches,
        currentBranch,
        githubRepo,
        remoteRepo,
        userIdentity,
        upstreamStatus,
        stashes,
        worktrees,
        pullRequests,
        bisectStatus,
      ] = await Promise.all([
        this.gitClient.getCommits(root, limit),
        this.gitClient.getBranches(root),
        this.gitClient.getCurrentBranch(root),
        this.gitClient.getGitHubRepoInfo(root),
        this.gitClient.getRemoteRepoInfo(root),
        this.gitClient.getUserIdentity(root),
        this.gitClient.getUpstreamStatus(root),
        this.gitClient.getStashes(root),
        this.gitClient.getWorktrees(root),
        this.gitClient.getPullRequests(root),
        this.gitClient.getBisectStatus(root),
      ]);

      const themeConfig = config.get<any>('graph.theme', 'auto');
      const graphNodes = GraphLayout.compute(commits, themeConfig);
      let maxLane = 0;
      graphNodes.forEach((n) => {
        if (n.lane > maxLane) maxLane = n.lane;
        n.passingLanes?.forEach((p) => {
          if (p.lane > maxLane) maxLane = p.lane;
        });
        n.lines.forEach((l) => {
          if (l.toLane > maxLane) maxLane = l.toLane;
        });
      });

      const stats = this.gitClient.computeRepoStats(commits, branches);
      const personalStats = this.gitClient.computePersonalStats(
        commits,
        branches,
        userIdentity.name,
        userIdentity.email
      );

      const settingsPayload: CommitFlowSettings = {
        language: config.get<'auto' | 'es' | 'en'>('language', 'auto'),
        density: config.get<'compact' | 'comfortable' | 'spacious'>(
          'graph.density',
          'comfortable'
        ),
        theme: config.get<any>('graph.theme', 'auto'),
        layoutMode: config.get<LayoutMode>('graph.layoutMode', 'auto'),
        animations: config.get<boolean>('graph.animations', true),
        pageSize: limit,
        inlineBlameEnabled: config.get<boolean>('inlineBlame.enabled', true),
        inlineBlameDelay: config.get<number>('inlineBlame.delay', 120),
        avatarService: config.get<'gravatar' | 'github' | 'initials'>(
          'avatars.service',
          'gravatar'
        ),
        autoFetch: config.get<boolean>('sync.autoFetch', true),
        fetchIntervalMinutes: config.get<number>('sync.fetchIntervalMinutes', 5),
        notifyOnBranchMerge: config.get<boolean>('sync.notifyOnBranchMerge', true),
        askBeforePull: config.get<boolean>('sync.askBeforePull', true),
      };

      const payload = {
        commits: graphNodes,
        branches,
        currentBranch,
        githubRepo,
        remoteRepo,
        worktrees,
        pullRequests,
        stats,
        personalStats,
        upstreamStatus,
        stashes,
        maxLane,
        settings: settingsPayload,
        systemLanguage: vscode.env.language,
        totalCommits: graphNodes.length,
        hasMore: false,
        bisectStatus,
        forkInstalled: this.forkIntegration.findForkExecutable() !== null,
        forkEnabled: this.persistence.isForkIntegrationEnabled(),
      };

      activeWebviews.forEach((w) => {
        try {
          w.postMessage({
            command: 'graphData',
            payload,
          } as ExtensionToWebviewMessage);
        } catch {}
      });
    } catch (err: any) {
      activeWebviews.forEach((w) => {
        try {
          w.postMessage({
            command: 'error',
            payload: err.message || String(err),
          } as ExtensionToWebviewMessage);
        } catch {}
      });
    }
  }

  private setupMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      const root = await this.gitClient.getRepoRoot();

      switch (msg.command) {
        case 'ready':
        case 'requestData':
          await this.refreshData();
          break;

        case 'requestCommitFiles':
          if (root && msg.payload?.commitHash) {
            const files = await this.gitClient.getCommitFilesDetailed(
              root,
              msg.payload.commitHash
            );
            webview.postMessage({
              command: 'commitFiles',
              payload: { commitHash: msg.payload.commitHash, files },
            } as ExtensionToWebviewMessage);
          }
          break;

        case 'openDiff':
          if (root && msg.payload) {
            await this.openFileDiff(root, msg.payload);
          }
          break;

        case 'openFullPanel':
          this.openFullPanel();
          break;

        case 'openFile':
          if (root && msg.payload?.filePath) {
            const absPath = path.isAbsolute(msg.payload.filePath)
              ? msg.payload.filePath
              : path.resolve(root, msg.payload.filePath);
            try {
              const doc = await vscode.workspace.openTextDocument(absPath);
              await vscode.window.showTextDocument(doc);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
            }
          }
          break;

        case 'copyToClipboard':
          if (msg.payload) {
            await vscode.env.clipboard.writeText(msg.payload);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;

        case 'openExternal':
          if (msg.payload) {
            await vscode.env.openExternal(vscode.Uri.parse(msg.payload));
          }
          break;

        case 'checkoutBranch':
          if (msg.payload && root) {
            try {
              await this.gitClient.checkoutBranch(root, msg.payload);
              vscode.window.showInformationMessage(
                `Switched to branch: ${msg.payload}`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Checkout failed: ${e.message}`);
            }
          }
          break;

        case 'checkoutCommit':
          if (msg.payload && root) {
            try {
              await this.gitClient.checkoutCommit(root, msg.payload);
              vscode.window.showInformationMessage(
                `Checked out commit: ${msg.payload.slice(0, 7)}`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Checkout failed: ${e.message}`);
            }
          }
          break;

        case 'pullBranch':
          if (root) {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: 'CommitFlow: Pulling latest commits...',
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.pull(root);
                  vscode.window.showInformationMessage(
                    `Pull succeeded: ${res.split('\n')[0] || 'Already up to date.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(`Pull failed: ${e.message}`);
                }
              }
            );
          }
          break;

        case 'rebaseBranch':
          if (root) {
            const target = msg.payload?.upstream || undefined;
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `CommitFlow: Rebasing onto ${target || 'upstream'}...`,
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.rebase(root, target);
                  vscode.window.showInformationMessage(
                    `Rebase succeeded: ${res.split('\n')[0] || 'Successfully rebased.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(
                    `Rebase failed: ${e.message}. Resolve conflicts or abort with git rebase --abort.`
                  );
                }
              }
            );
          }
          break;

        case 'mergeBranch':
          if (root) {
            const target = msg.payload?.upstream || undefined;
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `CommitFlow: Merging ${target || 'upstream'}...`,
                cancellable: false,
              },
              async () => {
                try {
                  const res = await this.gitClient.merge(root, target);
                  vscode.window.showInformationMessage(
                    `Merge succeeded: ${res.split('\n')[0] || 'Merged successfully.'}`
                  );
                  await this.refreshData();
                } catch (e: any) {
                  vscode.window.showErrorMessage(
                    `Merge failed: ${e.message}. Resolve conflicts or abort with git merge --abort.`
                  );
                }
              }
            );
          }
          break;

        case 'abortRebase':
          if (root) {
            try {
              await this.gitClient.abortRebase(root);
              vscode.window.showInformationMessage('CommitFlow: Rebase aborted successfully.');
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Abort rebase failed: ${e.message}`);
            }
          }
          break;

        case 'stashSave':
          if (root) {
            try {
              const msgText = msg.payload?.message || '';
              const res = await this.gitClient.stashSave(root, msgText);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash saved. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash failed: ${e.message}`);
            }
          }
          break;

        case 'stashPop':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashPop(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash applied and dropped. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash pop failed: ${e.message}`);
            }
          }
          break;

        case 'stashApply':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashApply(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash applied. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash apply failed: ${e.message}`);
            }
          }
          break;

        case 'stashDrop':
          if (root) {
            try {
              const ref = msg.payload?.ref || 'stash@{0}';
              const res = await this.gitClient.stashDrop(root, ref);
              vscode.window.showInformationMessage(
                `CommitFlow: Stash dropped. (${res.split('\n')[0] || 'OK'})`
              );
              await this.refreshData();
            } catch (e: any) {
              vscode.window.showErrorMessage(`Stash drop failed: ${e.message}`);
            }
          }
          break;

        // --- Worktrees & Multi-WIP IPC ---
        case 'requestWorktrees':
          if (root) {
            const wt = await this.gitClient.getWorktrees(root);
            webview.postMessage({
              command: 'worktreesData',
              payload: wt,
            } as ExtensionToWebviewMessage);
          }
          break;

        case 'addWorktree':
          if (root && msg.payload?.path && msg.payload?.branch) {
            try {
              await this.gitClient.addWorktree(root, msg.payload.path, msg.payload.branch);
              vscode.window.showInformationMessage(`Worktree created at ${msg.payload.path}`);
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to create worktree: ${err.message}`);
            }
          }
          break;

        case 'removeWorktree':
          if (root && msg.payload?.path) {
            try {
              await this.gitClient.removeWorktree(root, msg.payload.path, msg.payload.force);
              vscode.window.showInformationMessage(`Worktree removed.`);
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to remove worktree: ${err.message}`);
            }
          }
          break;

        case 'openWorktree':
          if (msg.payload?.path) {
            await vscode.commands.executeCommand(
              'vscode.openFolder',
              vscode.Uri.file(msg.payload.path),
              { forceNewWindow: true }
            );
          }
          break;

        // --- Pull Requests Launchpad IPC ---
        case 'requestPullRequests':
          if (root) {
            const prs = await this.gitClient.getPullRequests(root);
            webview.postMessage({
              command: 'pullRequestsData',
              payload: prs,
            } as ExtensionToWebviewMessage);
          }
          break;

        case 'checkoutPullRequest':
          if (root && msg.payload?.prNumber && msg.payload?.branchName) {
            try {
              await this.gitClient.checkoutPullRequest(
                root,
                msg.payload.prNumber,
                msg.payload.branchName
              );
              vscode.window.showInformationMessage(
                `Checked out PR #${msg.payload.prNumber} (${msg.payload.branchName})`
              );
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to checkout PR: ${err.message}`);
            }
          }
          break;

        // --- Visual File History IPC ---
        case 'requestFileHistory':
          if (root) {
            const targetFile =
              msg.payload?.filePath ||
              vscode.window.activeTextEditor?.document.uri.fsPath;
            if (targetFile) {
              const revisions = await this.gitClient.getFileCommitHistory(
                root,
                targetFile
              );
              webview.postMessage({
                command: 'fileHistoryData',
                payload: {
                  filePath: targetFile,
                  fileName: path.basename(targetFile),
                  revisions,
                },
              } as ExtensionToWebviewMessage);
            }
          }
          break;

        case 'openFileHistoryDiff':
          if (root && msg.payload?.filePath && msg.payload?.commitHash) {
            await this.openFileHistoryDiff(
              root,
              msg.payload.filePath,
              msg.payload.commitHash
            );
          }
          break;

        // --- Cloud Patches IPC ---
        case 'createCloudPatch':
          if (root) {
            try {
              const patch = await this.gitClient.createCloudPatch(
                root,
                msg.payload?.title || 'WIP Patch',
                msg.payload?.description || ''
              );
              webview.postMessage({
                command: 'patchCreated',
                payload: patch,
              } as ExtensionToWebviewMessage);
              vscode.window.showInformationMessage(
                `Cloud Patch "${patch.title}" created successfully!`
              );
            } catch (err: any) {
              vscode.window.showErrorMessage(`Could not create Cloud Patch: ${err.message}`);
            }
          }
          break;

        case 'applyCloudPatch':
          if (root && msg.payload?.patchContent) {
            try {
              const res = await this.gitClient.applyCloudPatch(
                root,
                msg.payload.patchContent,
                msg.payload.reverse
              );
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
              webview.postMessage({
                command: 'patchApplied',
                payload: res,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Patch apply failed: ${err.message}`);
            }
          }
          break;

        case 'setLayoutMode':
          if (msg.payload) {
            const cfg = vscode.workspace.getConfiguration('commitflow');
            await cfg.update('graph.layoutMode', msg.payload, vscode.ConfigurationTarget.Global);
          }
          break;

        // --- Developer Productivity IPC Actions ---
        case 'cherryPickCommit':
          if (root && msg.payload?.hash) {
            try {
              const res = await this.gitClient.cherryPick(root, msg.payload.hash);
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Cherry-pick failed: ${err.message}`);
            }
          }
          break;

        case 'revertCommit':
          if (root && msg.payload?.hash) {
            try {
              const res = await this.gitClient.revertCommit(root, msg.payload.hash);
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Revert failed: ${err.message}`);
            }
          }
          break;

        case 'createTag':
          if (root && msg.payload?.tagName) {
            try {
              const res = await this.gitClient.createTag(
                root,
                msg.payload.tagName,
                msg.payload.hash,
                msg.payload.message
              );
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Create tag failed: ${err.message}`);
            }
          }
          break;

        case 'deleteTag':
          if (root && msg.payload?.tagName) {
            try {
              const res = await this.gitClient.deleteTag(root, msg.payload.tagName);
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Delete tag failed: ${err.message}`);
            }
          }
          break;

        case 'undoLastCommit':
          if (root) {
            try {
              const res = await this.gitClient.undoLastCommit(root);
              if (res.success) {
                vscode.window.showInformationMessage(res.message);
                await this.refreshData();
              } else {
                vscode.window.showErrorMessage(res.message);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Undo commit failed: ${err.message}`);
            }
          }
          break;

        case 'generateChangelog':
          if (root) {
            try {
              const count = msg.payload?.count || 30;
              const md = await this.gitClient.generateChangelog(root, count);
              await vscode.env.clipboard.writeText(md);
              vscode.window.showInformationMessage('CommitFlow: Changelog Markdown copied to clipboard!');
              webview.postMessage({
                command: 'changelogReady',
                payload: md,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Changelog generation failed: ${err.message}`);
            }
          }
          break;

        case 'saveSettings':
          if (msg.payload) {
            const cfg = vscode.workspace.getConfiguration('commitflow');
            const s: CommitFlowSettings = msg.payload;
            await Promise.all([
              cfg.update('language', s.language, vscode.ConfigurationTarget.Global),
              cfg.update('graph.density', s.density, vscode.ConfigurationTarget.Global),
              cfg.update('graph.theme', s.theme, vscode.ConfigurationTarget.Global),
              cfg.update('graph.layoutMode', s.layoutMode || 'auto', vscode.ConfigurationTarget.Global),
              cfg.update('graph.animations', s.animations, vscode.ConfigurationTarget.Global),
              cfg.update('graph.pageSize', s.pageSize, vscode.ConfigurationTarget.Global),
              cfg.update('inlineBlame.enabled', s.inlineBlameEnabled, vscode.ConfigurationTarget.Global),
              cfg.update('inlineBlame.delay', s.inlineBlameDelay, vscode.ConfigurationTarget.Global),
              cfg.update('avatars.service', s.avatarService, vscode.ConfigurationTarget.Global),
              cfg.update('sync.autoFetch', s.autoFetch, vscode.ConfigurationTarget.Global),
              cfg.update('sync.fetchIntervalMinutes', s.fetchIntervalMinutes, vscode.ConfigurationTarget.Global),
              cfg.update('sync.notifyOnBranchMerge', s.notifyOnBranchMerge, vscode.ConfigurationTarget.Global),
            ]);

            webview.postMessage({
              command: 'settingsUpdated',
              payload: s,
            } as ExtensionToWebviewMessage);

            vscode.window.showInformationMessage('CommitFlow: Settings saved successfully!');
          }
          break;

        case 'requestIssues':
          if (root) {
            try {
              const [assigned, linked, allIssues] = await Promise.all([
                this.issueService.getAssignedIssues(root),
                this.issueService.getLinkedIssues(root),
                this.issueService.getAllIssues(root, msg.payload || {}),
              ]);
              webview.postMessage({
                command: 'issuesData',
                payload: {
                  assigned,
                  linked,
                  allIssues,
                  defaultFilter: this.persistence.getDefaultIssueFilter(),
                },
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to fetch issues: ${err.message}`);
            }
          }
          break;

        case 'requestIssueDetails':
          if (root && msg.payload?.issueNumber) {
            try {
              const [issue, comments] = await Promise.all([
                this.issueService.getIssue(root, msg.payload.issueNumber),
                this.issueService.getIssueComments(root, msg.payload.issueNumber),
              ]);
              webview.postMessage({
                command: 'issueDetailsData',
                payload: { issue, comments },
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to load issue details: ${err.message}`);
            }
          }
          break;

        case 'startWorkOnIssue':
          if (root && msg.payload?.issueNumber) {
            try {
              const res = await this.issueService.startWorkOnIssue(
                root,
                msg.payload.issueNumber,
                Boolean(msg.payload.useWorktree)
              );
              vscode.window.showInformationMessage(
                res.isWorktree
                  ? `Created and opened worktree for branch ${res.branchName} at ${res.path}`
                  : `Checked out branch ${res.branchName}`
              );
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Could not start work on issue: ${err.message}`);
            }
          }
          break;

        case 'insertIssueRef':
          if (msg.payload?.issueNumber) {
            const ref = `Closes #${msg.payload.issueNumber}`;
            await vscode.env.clipboard.writeText(ref);
            vscode.window.showInformationMessage(`Copied "${ref}" to clipboard!`);
          }
          break;

        case 'createIssueComment':
          if (root && msg.payload?.issueNumber && msg.payload?.body) {
            try {
              const comment = await this.issueService.createComment(
                root,
                msg.payload.issueNumber,
                msg.payload.body
              );
              vscode.window.showInformationMessage('Comment posted successfully!');
              webview.postMessage({
                command: 'issueCommentAdded',
                payload: { issueNumber: msg.payload.issueNumber, comment },
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to post comment: ${err.message}`);
            }
          }
          break;

        case 'setIssueState':
          if (root && msg.payload?.issueNumber && msg.payload?.state) {
            try {
              await this.issueService.setIssueState(
                root,
                msg.payload.issueNumber,
                msg.payload.state
              );
              vscode.window.showInformationMessage(
                `Issue #${msg.payload.issueNumber} marked as ${msg.payload.state}.`
              );
              const [assigned, linked, allIssues] = await Promise.all([
                this.issueService.getAssignedIssues(root),
                this.issueService.getLinkedIssues(root),
                this.issueService.getAllIssues(root),
              ]);
              webview.postMessage({
                command: 'issuesData',
                payload: { assigned, linked, allIssues },
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to update issue: ${err.message}`);
            }
          }
          break;

        case 'openInFork':
          if (root) {
            await this.forkIntegration.openInFork(root);
          }
          break;

        case 'requestReflog':
          if (root) {
            try {
              const reflog = await this.gitClient.getReflog(root, 100);
              webview.postMessage({
                command: 'reflogData',
                payload: { reflog },
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to load reflog: ${err.message}`);
            }
          }
          break;

        case 'restoreReflogCommit':
          if (root && msg.payload?.commitHash && msg.payload?.branchName) {
            try {
              await this.gitClient.restoreReflogCommit(
                root,
                msg.payload.commitHash,
                msg.payload.branchName
              );
              vscode.window.showInformationMessage(
                `Restored commit ${msg.payload.commitHash.slice(0, 7)} onto new branch '${msg.payload.branchName}'!`
              );
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Could not restore commit: ${err.message}`);
            }
          }
          break;

        case 'compareCommits':
          if (root && msg.payload?.baseHash && msg.payload?.targetHash) {
            try {
              const comparison = await this.gitClient.compareCommits(
                root,
                msg.payload.baseHash,
                msg.payload.targetHash
              );
              webview.postMessage({
                command: 'comparisonData',
                payload: comparison,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Comparison failed: ${err.message}`);
            }
          }
          break;

        case 'requestRepoHealth':
          if (root) {
            try {
              const health = await this.gitClient.getRepoHealth(root);
              webview.postMessage({
                command: 'repoHealthData',
                payload: health,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to get repository health: ${err.message}`);
            }
          }
          break;

        case 'runRepoGc':
          if (root) {
            try {
              await this.gitClient.runRepoGc(root);
              vscode.window.showInformationMessage('Repository optimized successfully via Git GC!');
              const health = await this.gitClient.getRepoHealth(root);
              webview.postMessage({
                command: 'repoHealthData',
                payload: health,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Git GC failed: ${err.message}`);
            }
          }
          break;

        case 'requestBisectStatus':
          if (root) {
            try {
              const bisect = await this.gitClient.getBisectStatus(root);
              webview.postMessage({
                command: 'bisectStatusData',
                payload: bisect,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to get bisect status: ${err.message}`);
            }
          }
          break;

        case 'startBisect':
          if (root && msg.payload?.badCommit && msg.payload?.goodCommit) {
            try {
              const bisect = await this.gitClient.startBisect(
                root,
                msg.payload.badCommit,
                msg.payload.goodCommit
              );
              vscode.window.showInformationMessage(
                `Git Bisect initiated! Testing commit ${bisect.currentShortCommit || 'HEAD'}`
              );
              webview.postMessage({
                command: 'bisectStatusData',
                payload: bisect,
              } as ExtensionToWebviewMessage);
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to start bisect: ${err.message}`);
            }
          }
          break;

        case 'stepBisect':
          if (root && msg.payload?.step) {
            try {
              const bisect = await this.gitClient.stepBisect(
                root,
                msg.payload.step,
                msg.payload.commitHash
              );
              if (bisect.firstBadCommit) {
                vscode.window.showInformationMessage(
                  `CommitFlow Bisect found culprit! First bad commit is: ${bisect.firstBadCommit.slice(0, 7)}`
                );
              }
              webview.postMessage({
                command: 'bisectStatusData',
                payload: bisect,
              } as ExtensionToWebviewMessage);
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Bisect step failed: ${err.message}`);
            }
          }
          break;

        case 'resetBisect':
          if (root) {
            try {
              const bisect = await this.gitClient.resetBisect(root);
              vscode.window.showInformationMessage('Git Bisect session aborted/reset.');
              webview.postMessage({
                command: 'bisectStatusData',
                payload: bisect,
              } as ExtensionToWebviewMessage);
              await this.refreshData();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to reset bisect: ${err.message}`);
            }
          }
          break;

        case 'previewCherryPick':
          if (root && msg.payload?.commitHash) {
            try {
              const preview = await this.gitClient.previewCherryPick(root, msg.payload.commitHash);
              webview.postMessage({
                command: 'cherryPickPreviewData',
                payload: preview,
              } as ExtensionToWebviewMessage);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to preview cherry-pick: ${err.message}`);
            }
          }
          break;
      }
    });
  }

  /**
   * Opens native VS Code diff editor for a specific commit and file
   */
  private async openFileDiff(
    root: string,
    payload: {
      commitHash: string;
      filePath: string;
      status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
    }
  ): Promise<void> {
    const { commitHash, filePath, status } = payload;
    const baseName = path.basename(filePath);

    let leftUri: vscode.Uri;
    let rightUri: vscode.Uri;
    let title: string;

    if (status === 'A') {
      leftUri = GitContentProvider.createUri('EMPTY', filePath, root);
      rightUri = GitContentProvider.createUri(commitHash, filePath, root);
      title = `${baseName} (Added in ${commitHash.slice(0, 7)})`;
    } else if (status === 'D') {
      leftUri = GitContentProvider.createUri(`${commitHash}~1`, filePath, root);
      rightUri = GitContentProvider.createUri('EMPTY', filePath, root);
      title = `${baseName} (Deleted in ${commitHash.slice(0, 7)})`;
    } else {
      leftUri = GitContentProvider.createUri(`${commitHash}~1`, filePath, root);
      rightUri = GitContentProvider.createUri(commitHash, filePath, root);
      title = `${baseName} (${commitHash.slice(0, 7)} vs Parent)`;
    }

    try {
      await vscode.commands.executeCommand(
        'vscode.diff',
        leftUri,
        rightUri,
        title
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Unable to open diff for ${filePath}: ${err.message}`
      );
    }
  }

  /**
   * Opens native VS Code diff for visual file history
   */
  private async openFileHistoryDiff(
    root: string,
    filePath: string,
    commitHash: string
  ): Promise<void> {
    const baseName = path.basename(filePath);
    const leftUri = GitContentProvider.createUri(`${commitHash}~1`, filePath, root);
    const rightUri = GitContentProvider.createUri(commitHash, filePath, root);
    const title = `${baseName} (${commitHash.slice(0, 7)} vs Parent)`;

    try {
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Unable to open revision diff: ${err.message}`);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const config = vscode.workspace.getConfiguration('commitflow');
    const preferredLang = config.get<'auto' | 'es' | 'en'>('language', 'auto');
    const sysLang = vscode.env.language;
    const tr = (k: string, p?: Record<string, string | number>) => t(k, preferredLang, sysLang, p);

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
    );
    const codiconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'codicon.css')
    );
    const logoDarkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'logo-dark.png')
    );
    const logoLightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'logo-light.png')
    );
    const resourcesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources')
    );
    const isotipoColorUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'commitflow-isotipo-color.svg')
    );
    const logotipoWhiteUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'commitflow-logotipo-white.svg')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${codiconCssUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>CommitFlow - Git Graph & Developer Hub</title>
</head>
<body class="density-comfortable layout-auto" data-resources-uri="${resourcesUri}">
  <!-- Top Header Bar -->
  <div class="header-bar" id="header-bar">
    <div class="header-row-primary">
      <div class="brand-section">
        <img src="${isotipoColorUri}" alt="CommitFlow" class="brand-logo logo-neon" />
        <img src="${logoDarkUri}" alt="CommitFlow" class="brand-logo logo-dark-mode" />
        <img src="${logoLightUri}" alt="CommitFlow" class="brand-logo logo-light-mode" />
        <span class="brand-title">CommitFlow</span>
      </div>

      <div id="active-branch-pill" class="active-branch-badge" title="${tr('toolbar.activeBranch')}">
        <div class="branch-pulse-dot"></div>
        <span class="branch-name">main</span>
      </div>

      <!-- Private / Remote Provider / Forgejo Badge -->
      <div id="private-repo-badge" class="private-repo-badge" style="display:none;" title="${tr('remote.private')}">
        <i class="codicon codicon-lock" id="private-repo-icon"></i>
        <span id="private-repo-label">${tr('remote.private')}</span>
      </div>

      <div class="header-quick-actions">
        <!-- Open in Fork Button -->
        <button id="btn-open-fork" class="btn-icon" title="Abrir en Fork" style="display:none;">
          <i class="codicon codicon-link-external"></i>
        </button>

        <!-- Layout Switcher Button -->
        <button id="btn-layout-mode" class="btn-icon btn-layout-toggle" title="${tr('layout.toggleTitle')}">
          <i class="codicon codicon-layout"></i>
        </button>

        <!-- Theme Switcher Button -->
        <button id="btn-theme-mode" class="btn-icon btn-theme-toggle" title="${tr('toolbar.themePicker')}">
          <i class="codicon codicon-symbol-color"></i>
        </button>

        <!-- Git Reflog Time Machine -->
        <button id="btn-reflog" class="btn-icon" title="Git Reflog Time Machine">
          <i class="codicon codicon-history"></i>
        </button>

        <!-- Repo Health & Storage Diagnostics -->
        <button id="btn-repo-health" class="btn-icon" title="Salud y Almacenamiento Git">
          <i class="codicon codicon-pulse"></i>
        </button>

        <!-- Git Bisect Assistant Button -->
        <button id="btn-bisect" class="btn-icon" title="Asistente Git Bisect (Búsqueda de Regresiones)">
          <i class="codicon codicon-search"></i>
        </button>

        <!-- Changelog Export Button -->
        <button id="btn-changelog" class="btn-icon" title="${tr('toolbar.changelog')}">
          <i class="codicon codicon-markdown"></i>
        </button>

        <!-- Undo Last Commit Button -->
        <button id="btn-undo-commit" class="btn-icon" title="${tr('toolbar.undoCommit')}">
          <i class="codicon codicon-discard"></i>
        </button>

        <button id="refresh-btn" class="btn-icon" title="${tr('action.refresh')}">
          <i class="codicon codicon-refresh"></i>
        </button>
        <button id="btn-popout" class="btn-icon" title="${tr('action.popout')}">
          <i class="codicon codicon-link-external"></i>
        </button>
        <button id="btn-stash" class="btn-icon" title="${tr('toolbar.stash')}">
          <i class="codicon codicon-archive"></i>
        </button>
        <button id="btn-personal-stats" class="btn-icon" title="${tr('toolbar.myImpact')}">
          <i class="codicon codicon-graph"></i>
        </button>
        <button id="btn-settings" class="btn-icon" title="${tr('toolbar.settings')}">
          <i class="codicon codicon-settings-gear"></i>
        </button>
      </div>
    </div>

    <!-- Navigation Tab Bar -->
    <div class="nav-tab-bar" id="nav-tab-bar">
      <button class="nav-tab-btn active" data-tab="tab-graph" title="${tr('tabs.graphTitle')}">
        <i class="codicon codicon-git-branch"></i>
        <span id="nav-tab-text-graph">${tr('tabs.graph')}</span>
      </button>
      <button class="nav-tab-btn" data-tab="tab-file-history" title="${tr('tabs.fileHistoryTitle')}">
        <i class="codicon codicon-history"></i>
        <span id="nav-tab-text-history">${tr('tabs.fileHistory')}</span>
      </button>
      <button class="nav-tab-btn" data-tab="tab-issues" title="🎯 Issues Tracker Hub & Mis Issues">
        <i class="codicon codicon-issues"></i>
        <span id="nav-tab-text-issues">Issues</span>
        <span class="tab-badge" id="issues-badge-count">0</span>
      </button>
      <button class="nav-tab-btn" data-tab="tab-prs" title="${tr('tabs.prsTitle')}">
        <i class="codicon codicon-git-pull-request"></i>
        <span id="nav-tab-text-prs">${tr('tabs.prs')}</span>
        <span class="tab-badge" id="pr-badge-count">0</span>
      </button>
      <button class="nav-tab-btn" data-tab="tab-worktrees" title="${tr('tabs.worktreesTitle')}">
        <i class="codicon codicon-repo-forked"></i>
        <span id="nav-tab-text-worktrees">${tr('tabs.worktrees')}</span>
        <span class="tab-badge" id="worktree-badge-count">0</span>
      </button>
      <button class="nav-tab-btn" data-tab="tab-cloud-patches" title="${tr('tabs.cloudPatchesTitle')}">
        <i class="codicon codicon-cloud-upload"></i>
        <span id="nav-tab-text-patches">${tr('tabs.cloudPatches')}</span>
      </button>
    </div>

    <!-- Toolbar Controls (Search & Branch Filter) for Graph -->
    <div class="toolbar-controls" id="toolbar-controls">
      <div class="search-input-wrapper">
        <span class="search-icon"><i class="codicon codicon-search"></i></span>
        <input type="text" id="search-input" class="search-input" placeholder="${tr('toolbar.searchPlaceholder')}" />
        <button id="search-clear-btn" class="search-clear-btn" title="${tr('toolbar.searchClear')}" style="display:none;">
          <i class="codicon codicon-close"></i>
        </button>
      </div>

      <select id="branch-select" class="branch-select" title="${tr('toolbar.allBranches')}">
        <option value="all">${tr('toolbar.allBranches')}</option>
      </select>

      <button id="btn-checkout" class="btn-icon" title="${tr('toolbar.checkout')}">
        <i class="codicon codicon-arrow-swap"></i>
      </button>
    </div>
  </div>

  <!-- Repository Quick Stats Bar -->
  <div id="stats-bar" class="stats-bar">
    <div class="stat-item" title="${tr('stats.commitsTooltip')}">
      <i class="codicon codicon-git-commit stat-icon"></i>
      <span class="stat-label" id="label-stat-commits">${tr('stats.commits')}</span>
      <span class="stat-value" id="stat-total-commits">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" title="${tr('stats.contributorsTooltip')}">
      <i class="codicon codicon-organization stat-icon"></i>
      <span class="stat-label" id="label-stat-contributors">${tr('stats.contributors')}</span>
      <span class="stat-value" id="stat-total-contributors">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" title="${tr('stats.branchesTooltip')}">
      <i class="codicon codicon-git-branch stat-icon"></i>
      <span class="stat-label" id="label-stat-branches">${tr('stats.branches')}</span>
      <span class="stat-value" id="stat-total-branches">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item" id="stat-stash-item" style="cursor:pointer;" title="${tr('stats.stashesTooltip')}">
      <i class="codicon codicon-archive stat-icon"></i>
      <span class="stat-label" id="label-stat-stashes">${tr('stash.stashes')}</span>
      <span class="stat-value" id="stat-total-stashes">0</span>
    </div>
    <div class="stat-divider"></div>
    <div class="top-contributors-row" id="top-contributors-row"></div>
  </div>

  <!-- Upstream Sync Banner Container -->
  <div id="upstream-sync-container"></div>

  <!-- Main Viewport containing tabs -->
  <div class="main-viewport" id="main-viewport">
    <!-- TAB 1: INTERACTIVE COMMIT GRAPH -->
    <div id="tab-graph" class="tab-pane active">
      <!-- Visual Git Bisect Assistant Banner -->
      <div id="bisect-banner" class="bisect-banner" style="display:none;">
        <div class="bisect-banner-content">
          <div class="bisect-status-pill">
            <i class="codicon codicon-search"></i>
            <span class="bisect-badge-text">Git Bisect Activo</span>
          </div>
          <div class="bisect-info" id="bisect-info-text">
            Probando commit <code id="bisect-current-hash">...</code> (<span id="bisect-steps-left">~0</span> pasos restantes)
          </div>
          <div class="bisect-actions">
            <button id="btn-bisect-good" class="btn-sm btn-bisect-good" title="Marcar commit actual como Bueno (sin fallo)">
              <i class="codicon codicon-check"></i> Bueno (Good)
            </button>
            <button id="btn-bisect-bad" class="btn-sm btn-bisect-bad" title="Marcar commit actual como Malo (reproduce fallo)">
              <i class="codicon codicon-close"></i> Malo (Bad)
            </button>
            <button id="btn-bisect-skip" class="btn-sm" title="Omitir este commit (imposible de probar)">
              <i class="codicon codicon-debug-step-over"></i> Skip
            </button>
            <button id="btn-bisect-reset" class="btn-sm btn-bisect-abort" title="Abortar sesión de Git Bisect">
              <i class="codicon codicon-debug-stop"></i> Abortar
            </button>
          </div>
        </div>
      </div>

      <div id="graph-table-container" class="graph-table-container">
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; color:var(--text-muted);">
          <i class="codicon codicon-loading codicon-modifier-spin" style="font-size:24px; color:var(--accent-cyan);"></i>
          <div>${tr('graph.loading')}</div>
        </div>
      </div>
    </div>

    <!-- TAB 2: VISUAL FILE HISTORY -->
    <div id="tab-file-history" class="tab-pane">
      <div class="file-history-container">
        <div class="file-history-header">
          <div class="file-picker-row">
            <i class="codicon codicon-file-text"></i>
            <span id="file-history-current-path" class="file-history-path">${tr('history.currentFileFallback')}</span>
            <button id="btn-pick-file-history" class="btn-sm" title="${tr('history.btnPickFileTitle')}"><i class="codicon codicon-folder-opened"></i> ${tr('history.btnPickFile')}</button>
          </div>
        </div>
        <div id="file-history-timeline" class="file-history-timeline">
          <div class="empty-state">
            <i class="codicon codicon-history" style="font-size:32px; color:var(--accent-cyan);"></i>
            <div style="font-weight:600; margin-top:8px;">${tr('history.title')}</div>
            <div style="font-size:var(--font-size-sm); color:var(--text-muted); max-width:320px; text-align:center; margin-top:4px;">
              ${tr('history.emptyDesc')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: PULL REQUESTS LAUNCHPAD -->
    <div id="tab-prs" class="tab-pane">
      <div class="pr-launchpad-container">
        <div class="pr-filters-bar">
          <button class="pr-filter-pill active" data-filter="all">${tr('pr.filterAll')} (<span id="pr-filter-count-all">0</span>)</button>
          <button class="pr-filter-pill" data-filter="blocked">🔴 ${tr('pr.filterBlocked')} (<span id="pr-filter-count-blocked">0</span>)</button>
          <button class="pr-filter-pill" data-filter="ready">🟢 ${tr('pr.filterReady')} (<span id="pr-filter-count-ready">0</span>)</button>
          <button class="pr-filter-pill" data-filter="pending">🟡 ${tr('pr.filterPending')} (<span id="pr-filter-count-pending">0</span>)</button>
        </div>
        <div id="pr-cards-list" class="pr-cards-list">
          <div class="empty-state">
            <i class="codicon codicon-git-pull-request" style="font-size:32px; color:var(--accent-cyan);"></i>
            <div style="font-weight:600; margin-top:8px;">${tr('pr.title')}</div>
            <div style="font-size:var(--font-size-sm); color:var(--text-muted); text-align:center; margin-top:4px;">
              ${tr('pr.emptyDesc')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: WORKTREES & MULTI-WIP -->
    <div id="tab-worktrees" class="tab-pane">
      <div class="worktrees-container">
        <div class="worktrees-header">
          <div>
            <span style="font-weight:600;">${tr('worktree.title')}</span>
            <div style="font-size:var(--font-size-sm); color:var(--text-muted);">${tr('worktree.emptyDesc')}</div>
          </div>
          <button id="btn-add-worktree" class="btn-sm btn-primary"><i class="codicon codicon-plus"></i> ${tr('worktree.btnNew')}</button>
        </div>
        <div id="worktrees-cards-list" class="worktrees-cards-list"></div>
      </div>
    </div>

    <!-- TAB 5: CLOUD PATCHES -->
    <div id="tab-cloud-patches" class="tab-pane">
      <div class="cloud-patches-container">
        <div class="patches-actions-bar">
          <div>
            <span style="font-weight:600;">${tr('tabs.cloudPatches')}</span>
            <div style="font-size:var(--font-size-sm); color:var(--text-muted);">${tr('patch.emptyDesc')}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="btn-create-patch" class="btn-sm btn-primary"><i class="codicon codicon-add"></i> ${tr('patch.btnCreate')}</button>
            <button id="btn-apply-patch" class="btn-sm"><i class="codicon codicon-cloud-download"></i> ${tr('patch.btnApply')}</button>
          </div>
        </div>
        <div id="cloud-patches-list" class="cloud-patches-list"></div>
      </div>
    </div>

    <!-- TAB 6: ISSUES TRACKER HUB -->
    <div id="tab-issues" class="tab-pane">
      <div class="issues-hub-container">
        <!-- Filter toolbar -->
        <div class="issues-filters-bar">
          <div class="issues-filter-pills">
            <button class="issue-filter-pill active" data-filter="assignedToMe">
              <i class="codicon codicon-account"></i>
              <span>Mis Issues</span>
              <span class="pill-badge" id="issues-assigned-count">0</span>
            </button>
            <button class="issue-filter-pill" data-filter="linkedToBranch">
              <i class="codicon codicon-git-branch"></i>
              <span>Asociados a Rama</span>
              <span class="pill-badge" id="issues-linked-count">0</span>
            </button>
            <button class="issue-filter-pill" data-filter="allOpen">
              <i class="codicon codicon-issues"></i>
              <span>Todos los Abiertos</span>
              <span class="pill-badge" id="issues-all-count">0</span>
            </button>
            <button class="issue-filter-pill" data-filter="closed">
              <i class="codicon codicon-issue-closed"></i>
              <span>Cerrados</span>
            </button>
          </div>
          <div class="issues-search-wrapper">
            <i class="codicon codicon-search search-icon"></i>
            <input type="text" id="issues-search-input" class="issues-search-input" placeholder="Buscar por título, #número o etiqueta..." />
          </div>
        </div>

        <!-- Linked Work Spotlight Card -->
        <div id="linked-issue-spotlight" class="linked-issue-spotlight" style="display:none;"></div>

        <!-- Issue List / Grid -->
        <div id="issues-cards-list" class="issues-cards-list">
          <div class="empty-state">
            <i class="codicon codicon-issues" style="font-size:32px; color:var(--accent-purple);"></i>
            <div style="font-weight:600; margin-top:8px;">Hub de Issues</div>
            <div style="font-size:var(--font-size-sm); color:var(--text-muted); text-align:center; margin-top:4px;">
              Cargando tus tareas pendientes y asignadas...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Hover Popover -->
    <div id="hover-popover" class="hover-popover"></div>

    <!-- Layout Switcher Popover / Picker -->
    <div id="layout-picker-popover" class="layout-picker-popover">
      <div class="picker-header">${tr('layout.mode')}</div>
      <div class="picker-options">
        <button class="layout-option" data-layout="bottom">
          <i class="codicon codicon-layout-panel"></i>
          <div>
            <div class="option-title">${tr('layout.bottom')}</div>
            <div class="option-desc">${tr('layout.bottomDesc')}</div>
          </div>
        </button>
        <button class="layout-option" data-layout="left">
          <i class="codicon codicon-layout-sidebar-left"></i>
          <div>
            <div class="option-title">${tr('layout.left')}</div>
            <div class="option-desc">${tr('layout.leftDesc')}</div>
          </div>
        </button>
        <button class="layout-option" data-layout="right">
          <i class="codicon codicon-layout-sidebar-right"></i>
          <div>
            <div class="option-title">${tr('layout.right')}</div>
            <div class="option-desc">${tr('layout.rightDesc')}</div>
          </div>
        </button>
        <button class="layout-option" data-layout="auto">
          <i class="codicon codicon-screen-normal"></i>
          <div>
            <div class="option-title">${tr('layout.auto')}</div>
            <div class="option-desc">${tr('layout.autoDesc')}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- Theme Switcher Popover / Picker -->
    <div id="theme-picker-popover" class="theme-picker-popover">
      <div class="picker-header">${tr('toolbar.themePicker')}</div>
      <div class="picker-options">
        <button class="theme-option" data-theme="cyberpunk">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#ffe600;"></span>
              <span class="theme-swatch-dot" style="background:#110726;"></span>
              <span class="theme-swatch-dot" style="background:#d946ef;"></span>
            </div>
            <span>${tr('settings.themeCyberpunk')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="dracula">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#bd93f9;"></span>
              <span class="theme-swatch-dot" style="background:#282a36;"></span>
              <span class="theme-swatch-dot" style="background:#50fa7b;"></span>
            </div>
            <span>${tr('settings.themeDracula')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="github">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#58a6ff;"></span>
              <span class="theme-swatch-dot" style="background:#0d1117;"></span>
              <span class="theme-swatch-dot" style="background:#3fb950;"></span>
            </div>
            <span>${tr('settings.themeGithub')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="neon-pink">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#ff2a85;"></span>
              <span class="theme-swatch-dot" style="background:#15031b;"></span>
              <span class="theme-swatch-dot" style="background:#00f5d4;"></span>
            </div>
            <span>${tr('settings.themeNeonPink')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="neon-green">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#00ff66;"></span>
              <span class="theme-swatch-dot" style="background:#031407;"></span>
              <span class="theme-swatch-dot" style="background:#34d399;"></span>
            </div>
            <span>${tr('settings.themeNeonGreen')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="neon-blue">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#00e5ff;"></span>
              <span class="theme-swatch-dot" style="background:#020d1c;"></span>
              <span class="theme-swatch-dot" style="background:#6366f1;"></span>
            </div>
            <span>${tr('settings.themeNeonBlue')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="dark">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#38bdf8;"></span>
              <span class="theme-swatch-dot" style="background:#0d1117;"></span>
              <span class="theme-swatch-dot" style="background:#10b981;"></span>
            </div>
            <span>${tr('settings.themeDark')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="light">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="theme-swatches">
              <span class="theme-swatch-dot" style="background:#0969da;"></span>
              <span class="theme-swatch-dot" style="background:#ffffff;"></span>
              <span class="theme-swatch-dot" style="background:#1a7f37;"></span>
            </div>
            <span>${tr('settings.themeLight')}</span>
          </div>
        </button>
        <button class="theme-option" data-theme="auto">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-screen-normal" style="font-size:12px; margin-right:4px;"></i>
            <span>${tr('settings.themeAuto')}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Git Stash Manager Modal -->
    <div id="stash-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-archive" style="font-size:16px; color:var(--accent-amber);"></i>
            <span id="stash-modal-title" style="font-weight:700; font-size:var(--font-size-base);">${tr('stash.title')}</span>
          </div>
          <button id="stash-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="stash-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Personal Contribution Modal -->
    <div id="personal-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-graph" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span id="personal-modal-title" style="font-weight:700; font-size:var(--font-size-base);">${tr('personal.title')}</span>
          </div>
          <button id="personal-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="personal-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-settings-gear" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span id="settings-modal-title" style="font-weight:700; font-size:var(--font-size-base);">${tr('settings.title')}</span>
          </div>
          <button id="settings-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="settings-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Worktree Create Modal -->
    <div id="worktree-create-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-repo-forked" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">${tr('worktree.modalTitle')}</span>
          </div>
          <button id="worktree-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size:var(--font-size-sm);">
              ${tr('worktree.branchLabel')}
              <input type="text" id="wt-branch-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="${tr('worktree.branchPlaceholder')}" />
            </label>
            <label style="font-size:var(--font-size-sm);">
              ${tr('worktree.pathLabel')}
              <input type="text" id="wt-path-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="${tr('worktree.pathPlaceholder')}" />
            </label>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button id="wt-btn-cancel" class="btn-sm">${tr('worktree.cancel')}</button>
              <button id="wt-btn-submit" class="btn-sm btn-primary">${tr('worktree.submit')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cloud Patch Create Modal -->
    <div id="patch-create-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-cloud-upload" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">${tr('patch.modalCreateTitle')}</span>
          </div>
          <button id="patch-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size:var(--font-size-sm);">
              ${tr('patch.modalTitleLabel')}
              <input type="text" id="patch-title-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="${tr('patch.modalTitlePlaceholder')}" />
            </label>
            <label style="font-size:var(--font-size-sm);">
              ${tr('patch.modalDescLabel')}
              <textarea id="patch-desc-input" class="search-input" style="width:100%; height:60px; margin-top:4px; resize:vertical;" placeholder="${tr('patch.modalDescPlaceholder')}"></textarea>
            </label>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button id="patch-btn-cancel" class="btn-sm">${tr('patch.modalCancel')}</button>
              <button id="patch-btn-submit" class="btn-sm btn-primary">${tr('patch.modalSubmit')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Apply Patch Modal -->
    <div id="patch-apply-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-cloud-download" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">${tr('patch.modalApplyTitle')}</span>
          </div>
          <button id="patch-apply-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size:var(--font-size-sm);">
              ${tr('patch.modalApplyLabel')}
              <textarea id="patch-apply-content" class="search-input" style="width:100%; height:120px; margin-top:4px; font-family:monospace; resize:vertical;" placeholder="diff --git a/... b/..."></textarea>
            </label>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button id="patch-apply-btn-cancel" class="btn-sm">${tr('patch.modalCancel')}</button>
              <button id="patch-apply-btn-submit" class="btn-sm btn-primary">${tr('patch.modalApplySubmit')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Git Tag Modal -->
    <div id="tag-create-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-tag" style="font-size:16px; color:var(--accent-amber);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">${tr('tag.modalTitle')}</span>
          </div>
          <button id="tag-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" id="tag-target-hash" />
            <label style="font-size:var(--font-size-sm);">
              ${tr('tag.tagNameLabel')}
              <input type="text" id="tag-name-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="${tr('tag.tagNamePlaceholder')}" />
            </label>
            <label style="font-size:var(--font-size-sm);">
              ${tr('tag.messageLabel')}
              <textarea id="tag-message-input" class="search-input" style="width:100%; height:60px; margin-top:4px; resize:vertical;" placeholder="${tr('tag.messagePlaceholder')}"></textarea>
            </label>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button id="tag-btn-cancel" class="btn-sm">${tr('tag.cancel')}</button>
              <button id="tag-btn-submit" class="btn-sm btn-primary">${tr('tag.submit')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Git Reflog Time Machine Modal -->
    <div id="reflog-modal" class="modal-overlay">
      <div class="modal-card" style="width: min(720px, calc(100vw - 20px));">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-history" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">Git Reflog Time Machine & Recuperación</span>
          </div>
          <button id="reflog-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="reflog-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Repository Health & Storage Diagnostics Modal -->
    <div id="repo-health-modal" class="modal-overlay">
      <div class="modal-card" style="width: min(640px, calc(100vw - 20px));">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-pulse" style="font-size:16px; color:var(--accent-emerald);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">Diagnóstico de Salud & Almacenamiento Git</span>
          </div>
          <button id="repo-health-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="repo-health-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Multi-Commit Diff Comparison Modal -->
    <div id="comparison-modal" class="modal-overlay">
      <div class="modal-card" style="width: min(780px, calc(100vw - 20px));">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-diff" style="font-size:16px; color:var(--accent-purple);"></i>
            <span id="comparison-modal-title" style="font-weight:700; font-size:var(--font-size-base);">Comparación de Revisiones</span>
          </div>
          <button id="comparison-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="comparison-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Git Bisect Launcher Modal -->
    <div id="bisect-modal" class="modal-overlay">
      <div class="modal-card" style="width: min(560px, calc(100vw - 20px));">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-search" style="font-size:16px; color:var(--accent-cyan);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">Asistente Git Bisect (Caza de Bugs)</span>
          </div>
          <button id="bisect-modal-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <p style="font-size:var(--font-size-sm); color:var(--text-muted); margin:0;">
              Git Bisect utiliza búsqueda binaria en tu historial para encontrar el commit exacto que introdujo un bug o regresión.
            </p>
            <label style="font-size:var(--font-size-sm);">
              Commit con fallo (Bad / Regresión detectada):
              <input type="text" id="bisect-bad-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="HEAD o commit hash..." />
            </label>
            <label style="font-size:var(--font-size-sm);">
              Último commit conocido correcto (Good / Sin fallo):
              <input type="text" id="bisect-good-input" class="search-input" style="width:100%; margin-top:4px;" placeholder="Hash de commit anterior correcto (ej. v1.0.0, a1b2c3d)..." />
            </label>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button id="bisect-btn-cancel" class="btn-sm">Cancelar</button>
              <button id="bisect-btn-start" class="btn-sm btn-primary">Iniciar Bisect</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pre-Flight Cherry-Pick Conflict Forecaster Modal -->
    <div id="cherry-pick-forecast-modal" class="modal-overlay">
      <div class="modal-card" style="width: min(600px, calc(100vw - 20px));">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="codicon codicon-warning" style="font-size:16px; color:var(--accent-amber);"></i>
            <span style="font-weight:700; font-size:var(--font-size-base);">Pre-Flight Conflict Forecaster (Cherry-Pick)</span>
          </div>
          <button id="cherry-pick-forecast-close" class="btn-icon" title="${tr('modal.close')}"><i class="codicon codicon-close"></i></button>
        </div>
        <div id="cherry-pick-forecast-body" class="modal-body"></div>
      </div>
    </div>

    <!-- Slide-in Commit Inspector Drawer -->
    <div id="commit-drawer" class="commit-drawer">
      <div class="drawer-header">
        <span id="drawer-title" style="font-weight:600; font-size:var(--font-size-base);">${tr('drawer.title')}</span>
        <button id="drawer-close-btn" class="btn-icon" title="${tr('drawer.close')}"><i class="codicon codicon-close"></i></button>
      </div>
      <div id="drawer-body" class="drawer-body"></div>
    </div>

    <!-- Slide-in Issue Inspector Drawer -->
    <div id="issue-drawer" class="commit-drawer issue-drawer">
      <div class="drawer-header">
        <span id="issue-drawer-title" style="font-weight:600; font-size:var(--font-size-base);">Inspector de Issue</span>
        <button id="issue-drawer-close-btn" class="btn-icon" title="Cerrar"><i class="codicon codicon-close"></i></button>
      </div>
      <div id="issue-drawer-body" class="drawer-body"></div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
