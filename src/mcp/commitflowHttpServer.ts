import * as http from 'http';
import { ApiKeyManager } from './apiKeyManager';
import { CommitFlowMcpServer } from './commitflowMcpServer';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  repoRoot?: string;
}

export class CommitFlowHttpServer {
  private server: http.Server | null = null;
  private readonly apiKeyManager = ApiKeyManager.getInstance();
  private readonly port: number;
  private readonly host: string = '127.0.0.1';
  private readonly repoRoot: string;
  private mcpEngine: CommitFlowMcpServer;
  private sseClients: Set<http.ServerResponse> = new Set();

  constructor(options?: HttpServerOptions) {
    this.port = options?.port || 47291;
    this.host = '127.0.0.1';
    this.repoRoot = options?.repoRoot || process.cwd();
    this.mcpEngine = new CommitFlowMcpServer(this.repoRoot);
  }

  public async start(): Promise<{ port: number; host: string }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err: any) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
          }
        }
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.sseClients) {
        try {
          client.end();
        } catch {}
      }
      this.sseClients.clear();

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  public getPort(): number {
    return this.port;
  }

  public getHost(): string {
    return this.host;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const origin = req.headers['origin'];
    if (origin) {
      const allowed =
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('vscode-webview://');
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: invalid origin' }));
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${this.host}:${this.port}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'commitflow-mcp', host: this.host, port: this.port }));
      return;
    }

    const authHeader = req.headers['authorization'];
    const queryToken = parsedUrl.searchParams.get('token') || undefined;
    const token = authHeader || queryToken;

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: missing API key token' }));
      return;
    }

    const authValidation = await this.apiKeyManager.validateKey(token, 'read', this.repoRoot);
    if (!authValidation.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden', reason: authValidation.reason }));
      return;
    }

    if (pathname === '/sse' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`event: endpoint\ndata: /message?sessionId=1\n\n`);
      this.sseClients.add(res);
      req.on('close', () => {
        this.sseClients.delete(res);
      });
      return;
    }

    if ((pathname === '/mcp' || pathname === '/rpc' || pathname === '/message') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) {
          req.destroy();
        }
      });

      req.on('end', async () => {
        try {
          const jsonRpcRequest = JSON.parse(body);
          const response = await this.mcpEngine.processDirectRequest(jsonRpcRequest, authValidation.key);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: `Parse error: ${err.message}` },
            })
          );
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
