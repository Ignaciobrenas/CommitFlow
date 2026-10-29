import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { PersistenceManager } from '../state/persistenceManager';

export interface ForkSharedState {
  isForkInstalled: boolean;
  forkExecutablePath?: string;
  isRebasing: boolean;
  isMerging: boolean;
  isCherryPicking: boolean;
  isReverting: boolean;
  mergeHeadSha?: string;
  rebaseOnto?: string;
}

export class ForkIntegration {
  private static instance: ForkIntegration;
  private readonly persistence = PersistenceManager.getInstance();
  private cachedForkPath: string | null | undefined = undefined;

  public static getInstance(): ForkIntegration {
    if (!ForkIntegration.instance) {
      ForkIntegration.instance = new ForkIntegration();
    }
    return ForkIntegration.instance;
  }

  /**
   * Locates the Fork executable on the user's operating system
   */
  public findForkExecutable(): string | null {
    if (this.cachedForkPath !== undefined) {
      return this.cachedForkPath;
    }

    const platform = process.platform;
    let foundPath: string | null = null;

    if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      const candidates = [
        path.join(localAppData, 'Fork', 'Fork.exe'),
        path.join(programFiles, 'Fork', 'Fork.exe'),
        path.join(programFilesX86, 'Fork', 'Fork.exe'),
      ];

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          foundPath = cand;
          break;
        }
      }
    } else if (platform === 'darwin') {
      const macPath = '/Applications/Fork.app';
      if (fs.existsSync(macPath)) {
        foundPath = macPath;
      }
    } else {
      // Linux
      try {
        const out = cp.execSync('which fork', { encoding: 'utf8' }).trim();
        if (out && fs.existsSync(out)) {
          foundPath = out;
        }
      } catch {}
    }

    this.cachedForkPath = foundPath;
    return foundPath;
  }

  /**
   * Detects shared Git state such as in-progress rebase, merge, cherry-pick or revert
   * that may have been initiated in Fork or terminal
   */
  public detectSharedState(repoRoot: string): ForkSharedState {
    const gitDir = path.join(repoRoot, '.git');
    const forkPath = this.findForkExecutable();
    const isForkInstalled = !!forkPath;

    if (!fs.existsSync(gitDir)) {
      return {
        isForkInstalled,
        forkExecutablePath: forkPath || undefined,
        isRebasing: false,
        isMerging: false,
        isCherryPicking: false,
        isReverting: false,
      };
    }

    const rebaseMerge = path.join(gitDir, 'rebase-merge');
    const rebaseApply = path.join(gitDir, 'rebase-apply');
    const mergeHead = path.join(gitDir, 'MERGE_HEAD');
    const cherryPickHead = path.join(gitDir, 'CHERRY_PICK_HEAD');
    const revertHead = path.join(gitDir, 'REVERT_HEAD');

    const isRebasing = fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply);
    const isMerging = fs.existsSync(mergeHead);
    const isCherryPicking = fs.existsSync(cherryPickHead);
    const isReverting = fs.existsSync(revertHead);

    let mergeHeadSha: string | undefined;
    if (isMerging) {
      try {
        mergeHeadSha = fs.readFileSync(mergeHead, 'utf8').trim().slice(0, 7);
      } catch {}
    }

    let rebaseOnto: string | undefined;
    if (isRebasing) {
      try {
        const ontoPath = fs.existsSync(rebaseMerge)
          ? path.join(rebaseMerge, 'onto')
          : path.join(rebaseApply, 'onto');
        if (fs.existsSync(ontoPath)) {
          rebaseOnto = fs.readFileSync(ontoPath, 'utf8').trim().slice(0, 7);
        }
      } catch {}
    }

    return {
      isForkInstalled,
      forkExecutablePath: forkPath || undefined,
      isRebasing,
      isMerging,
      isCherryPicking,
      isReverting,
      mergeHeadSha,
      rebaseOnto,
    };
  }

  /**
   * Opens the repository or worktree directly in the Fork desktop client
   */
  public async openInFork(targetPath: string): Promise<boolean> {
    if (!this.persistence.isForkIntegrationEnabled()) {
      vscode.window.showInformationMessage('Fork integration is disabled in CommitFlow settings.');
      return false;
    }

    const forkPath = this.findForkExecutable();

    if (process.platform === 'win32') {
      if (forkPath && fs.existsSync(forkPath)) {
        try {
          cp.spawn(forkPath, [targetPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
          }).unref();
          return true;
        } catch (err: any) {
          console.warn('[ForkIntegration] Failed to launch Fork executable:', err);
        }
      }

      // Fallback: Custom URL protocol handler fork://open?repo=...
      try {
        const uri = vscode.Uri.parse(`fork://open?repo=${encodeURIComponent(targetPath)}`);
        await vscode.env.openExternal(uri);
        return true;
      } catch (err: any) {
        vscode.window.showErrorMessage(
          'Could not open Fork. Ensure Fork is installed from https://git-fork.com.'
        );
        return false;
      }
    } else if (process.platform === 'darwin') {
      try {
        cp.spawn('open', ['-a', 'Fork', targetPath], { detached: true, stdio: 'ignore' }).unref();
        return true;
      } catch (err: any) {
        vscode.window.showErrorMessage('Could not open Fork. Ensure Fork is installed in /Applications.');
        return false;
      }
    } else {
      // Linux
      try {
        cp.spawn('fork', [targetPath], { detached: true, stdio: 'ignore' }).unref();
        return true;
      } catch {
        vscode.window.showErrorMessage('Could not find `fork` command on Linux.');
        return false;
      }
    }
  }
}
