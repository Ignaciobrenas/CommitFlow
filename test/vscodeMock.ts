// Lightweight mock of the vscode module for running unit tests in headless Node.js
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

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: (key: string, defaultValue: any) => defaultValue,
  }),
};

export class EventEmitter<T = any> {
  public event = (listener: (e: T) => any) => ({ dispose: () => {} });
  public fire(data: T): void {}
  public dispose(): void {}
}

export class CancellationError extends Error {}

export class CancellationTokenSource {
  public token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
  public cancel() { this.token.isCancellationRequested = true; }
  public dispose() {}
}

export default {
  Uri,
  workspace,
  EventEmitter,
  CancellationError,
  CancellationTokenSource,
};
