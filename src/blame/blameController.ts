import * as vscode from 'vscode';
import { GitClient } from '../git/gitClient';
import { BlameDecorator } from './blameDecorator';
import { BlameStatusBar } from './blameStatusBar';

export class BlameController implements vscode.Disposable {
  private readonly gitClient = GitClient.getInstance();
  private readonly decorator = new BlameDecorator();
  private readonly statusBar = new BlameStatusBar();
  private readonly disposables: vscode.Disposable[] = [];

  private debounceTimer: NodeJS.Timeout | null = null;
  private cts: vscode.CancellationTokenSource | null = null;
  private isEnabled = true;
  private currentBlame: GitBlameLine | null = null;

  public getCurrentBlame(): GitBlameLine | null {
    return this.currentBlame;
  }

  constructor() {
    this.readConfiguration();

    // Listen to editor selection and active editor changes
    vscode.window.onDidChangeTextEditorSelection(
      this.onSelectionChange,
      this,
      this.disposables
    );

    vscode.window.onDidChangeActiveTextEditor(
      this.onActiveEditorChange,
      this,
      this.disposables
    );

    // Invalidate blame cache on file save and refresh
    vscode.workspace.onDidSaveTextDocument(
      (doc) => {
        this.gitClient.invalidateBlameForFile(doc.uri.fsPath);
        if (vscode.window.activeTextEditor?.document === doc) {
          this.triggerUpdate(vscode.window.activeTextEditor);
        }
      },
      null,
      this.disposables
    );

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('branchify.inlineBlame')) {
          this.readConfiguration();
          this.triggerUpdate(vscode.window.activeTextEditor);
        }
      },
      null,
      this.disposables
    );

    // Initial update if an editor is already open
    if (vscode.window.activeTextEditor) {
      this.triggerUpdate(vscode.window.activeTextEditor);
    }
  }

  private readConfiguration(): void {
    const config = vscode.workspace.getConfiguration('branchify.inlineBlame');
    this.isEnabled = config.get<boolean>('enabled', true);
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    const editor = vscode.window.activeTextEditor;
    if (!this.isEnabled) {
      this.decorator.clear(editor);
      this.statusBar.hide();
    } else {
      this.triggerUpdate(editor);
    }
    return this.isEnabled;
  }

  private onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.textEditor === vscode.window.activeTextEditor) {
      this.triggerUpdate(e.textEditor);
    }
  }

  private onActiveEditorChange(editor?: vscode.TextEditor): void {
    this.triggerUpdate(editor);
  }

  private triggerUpdate(editor?: vscode.TextEditor): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.cts) {
      this.cts.cancel();
      this.cts.dispose();
      this.cts = null;
    }

    if (!editor || !this.isEnabled) {
      this.decorator.clear(editor);
      this.statusBar.hide();
      return;
    }

    const doc = editor.document;
    if (doc.isUntitled || doc.uri.scheme !== 'file') {
      this.decorator.clear(editor);
      this.statusBar.hide();
      return;
    }

    const delay = vscode.workspace
      .getConfiguration('branchify.inlineBlame')
      .get<number>('delay', 120);

    this.debounceTimer = setTimeout(() => {
      this.updateBlame(editor);
    }, delay);
  }

  private async updateBlame(editor: vscode.TextEditor): Promise<void> {
    const doc = editor.document;
    const lineNumber = editor.selection.active.line + 1;

    this.cts = new vscode.CancellationTokenSource();
    const token = this.cts.token;

    try {
      const blame = await this.gitClient.getBlameForLine(
        doc.uri.fsPath,
        lineNumber,
        token
      );

      if (token.isCancellationRequested) {
        return;
      }

      if (blame) {
        this.currentBlame = blame;
        this.decorator.applyDecoration(editor, blame);
        this.statusBar.update(blame);
      } else {
        this.currentBlame = null;
        this.decorator.clear(editor);
        this.statusBar.update(null);
      }
    } catch (err) {
      if (!(err instanceof vscode.CancellationError)) {
        this.currentBlame = null;
        this.decorator.clear(editor);
        this.statusBar.update(null);
      }
    }
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.cts) {
      this.cts.cancel();
      this.cts.dispose();
    }
    this.decorator.dispose();
    this.statusBar.dispose();
    vscode.Disposable.from(...this.disposables).dispose();
  }
}
