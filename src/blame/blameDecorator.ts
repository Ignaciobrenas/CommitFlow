import * as vscode from 'vscode';
import { GitBlameLine } from '../git/types';

export class BlameDecorator implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 3.5em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });
  }

  /**
   * Applies the inline blame ghost text decoration to the active line
   */
  public applyDecoration(editor: vscode.TextEditor, blame: GitBlameLine): void {
    const lineIndex = blame.line - 1;
    if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
      return;
    }

    const line = editor.document.lineAt(lineIndex);
    const range = new vscode.Range(line.range.end, line.range.end);

    // Format text: e.g. "⎇ CommitFlow › Ignacio • 2h ago • feat: add branch graph"
    const text = `  ⎇ CommitFlow › ${blame.author.name} • ${blame.author.relativeTime} • ${blame.summary}`;

    const decoration: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: text,
        },
      },
    };

    editor.setDecorations(this.decorationType, [decoration]);
  }

  /**
   * Clears any active blame decorations
   */
  public clear(editor?: vscode.TextEditor): void {
    if (editor) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  public dispose(): void {
    this.decorationType.dispose();
  }
}
