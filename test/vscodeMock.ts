// Comprehensive headless mock of VS Code API for testing extension activation and services
export const Uri = {
  parse: (str: string) => {
    const match = str.match(/^([a-z0-9+-.]+):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i);
    if (!match) {
      return { scheme: '', authority: '', path: '', query: '', fsPath: str };
    }
    return {
      scheme: match[1] || '',
      authority: match[2] || '',
      path: match[3] || '',
      query: match[4] || '',
      fsPath: str,
    };
  },
  file: (fsPath: string) => ({
    scheme: 'file',
    authority: '',
    path: fsPath,
    query: '',
    fsPath,
  }),
  joinPath: (base: any, ...segments: string[]) => ({
    scheme: base.scheme,
    authority: base.authority,
    path: `${base.path}/${segments.join('/')}`,
    fsPath: `${base.fsPath}/${segments.join('/')}`,
  }),
};

export const window = {
  activeTextEditor: undefined,
  onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  createTextEditorDecorationType: () => ({ dispose: () => {} }),
  createStatusBarItem: () => ({
    show: () => {},
    hide: () => {},
    dispose: () => {},
    text: '',
    tooltip: '',
    command: '',
  }),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
  createWebviewPanel: () => ({
    reveal: () => {},
    webview: {
      options: {},
      html: '',
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      asWebviewUri: (u: any) => u,
      postMessage: () => Promise.resolve(true),
    },
    onDidDispose: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  showInformationMessage: () => Promise.resolve(),
  showErrorMessage: () => Promise.resolve(),
};

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: (key: string, defaultValue: any) => defaultValue,
  }),
  registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
  onDidSaveTextDocument: () => ({ dispose: () => {} }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
};

export const languages = {
  registerHoverProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (name: string, handler: Function) => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(),
};

export const env = {
  clipboard: {
    writeText: () => Promise.resolve(),
  },
  openExternal: () => Promise.resolve(true),
};

export class Range {
  constructor(public start: any, public end: any) {}
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class MarkdownString {
  public value = '';
  public isTrusted = false;
  public supportHtml = false;
  constructor(val = '') { this.value = val; }
  public appendMarkdown(str: string): MarkdownString { this.value += str; return this; }
}

export class Hover {
  constructor(public contents: any, public range?: any) {}
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export class ThemeColor {
  constructor(public id: string) {}
}

export enum DecorationRangeBehavior {
  OpenOpen = 0,
  ClosedClosed = 1,
  OpenClosed = 2,
  ClosedOpen = 3,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class EventEmitter<T = any> {
  public event = (listener: (e: T) => any) => ({ dispose: () => {} });
  public fire(data: T): void {}
  public dispose(): void {}
}

export class Disposable {
  constructor(private callOnDispose: () => any) {}
  public dispose(): any {
    return this.callOnDispose();
  }
  public static from(...disposables: { dispose(): any }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d && d.dispose && d.dispose());
    });
  }
}

export class CancellationError extends Error {}

export class CancellationTokenSource {
  public token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
  public cancel() { this.token.isCancellationRequested = true; }
  public dispose() {}
}

export default {
  Uri,
  window,
  workspace,
  languages,
  commands,
  env,
  Range,
  Position,
  MarkdownString,
  Hover,
  ViewColumn,
  ThemeColor,
  DecorationRangeBehavior,
  StatusBarAlignment,
  EventEmitter,
  Disposable,
  CancellationError,
  CancellationTokenSource,
};
