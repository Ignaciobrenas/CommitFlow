import * as http from 'http';
import { ApiKeyManager } from './apiKeyManager';
import { CommitFlowMcpServer } from './commitflowMcpServer';
import { McpAuditLogEntry, sharedMcpAuditLog } from './mcpAuditLog';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  repoRoot?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export class CommitFlowHttpServer {
  private server: http.Server | null = null;
  private readonly apiKeyManager = ApiKeyManager.getInstance();
  private port: number;
  private readonly host: string = '127.0.0.1';
  private readonly repoRoot: string;
  private readonly rateLimitMax: number;
  private readonly rateLimitWindowMs: number;
  private readonly rateLimitBuckets = new Map<string, number[]>();
  private mcpEngine: CommitFlowMcpServer;
  private sseClients: Set<http.ServerResponse> = new Set();

  constructor(options?: HttpServerOptions) {
    this.port = options?.port ?? 47291;
    this.host = '127.0.0.1';
    this.repoRoot = options?.repoRoot || process.cwd();
    this.rateLimitMax = options?.rateLimitMax && options.rateLimitMax > 0 ? options.rateLimitMax : 120;
    this.rateLimitWindowMs =
      options?.rateLimitWindowMs && options.rateLimitWindowMs > 0 ? options.rateLimitWindowMs : 60_000;
    this.mcpEngine = new CommitFlowMcpServer(this.repoRoot);
  }

  public checkRateLimit(
    clientKey: string,
    now: number = Date.now()
  ): { allowed: boolean; remaining: number; resetMs: number } {
    const windowStart = now - this.rateLimitWindowMs;
    const timestamps = (this.rateLimitBuckets.get(clientKey) || []).filter((ts) => ts > windowStart);

    if (timestamps.length >= this.rateLimitMax) {
      this.rateLimitBuckets.set(clientKey, timestamps);
      const oldest = timestamps[0] || now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(1000, oldest + this.rateLimitWindowMs - now),
      };
    }

    timestamps.push(now);
    this.rateLimitBuckets.set(clientKey, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, this.rateLimitMax - timestamps.length),
      resetMs: this.rateLimitWindowMs,
    };
  }

  public getAuditLogs(): McpAuditLogEntry[] {
    return sharedMcpAuditLog.getAll();
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
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
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
    const startMs = Date.now();
    const clientIp = req.socket?.remoteAddress || '127.0.0.1';
    const method = req.method || 'GET';

    const recordAudit = (
      pathName: string,
      status: number,
      extra?: Partial<Omit<McpAuditLogEntry, 'timestamp' | 'transport' | 'method' | 'path' | 'status' | 'clientIp' | 'durationMs'>>
    ) => {
      sharedMcpAuditLog.record({
        timestamp: new Date().toISOString(),
        transport: 'http',
        method,
        path: pathName,
        status,
        clientIp,
        durationMs: Math.max(0, Date.now() - startMs),
        ...extra,
      });
    };

    const origin = req.headers['origin'];
    if (origin) {
      const allowed =
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('vscode-webview://');
      if (!allowed) {
        recordAudit('/unknown', 403, { reason: 'invalid_origin' });
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
      recordAudit(pathname, 401, { reason: 'missing_token' });
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: missing API key token' }));
      return;
    }

    const authValidation = await this.apiKeyManager.validateKey(token, 'read', this.repoRoot);
    if (!authValidation.valid) {
      recordAudit(pathname, 403, { reason: authValidation.reason || 'invalid_key' });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden', reason: authValidation.reason }));
      return;
    }

    const rateKey = authValidation.key?.id || clientIp;
    const rate = this.checkRateLimit(rateKey);
    res.setHeader('X-RateLimit-Limit', String(this.rateLimitMax));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(rate.resetMs / 1000)));
      recordAudit(pathname, 429, {
        keyId: authValidation.key?.id,
        keyName: authValidation.key?.name,
        reason: 'rate_limit_exceeded',
      });
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too Many Requests', retryAfterMs: rate.resetMs }));
      return;
    }

    if (pathname === '/sse' && req.method === 'GET') {
      recordAudit(pathname, 200, { keyId: authValidation.key?.id, keyName: authValidation.key?.name });
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
          recordAudit(pathname, 200, {
            keyId: authValidation.key?.id,
            keyName: authValidation.key?.name,
            rpcMethod: jsonRpcRequest?.method,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err: any) {
          recordAudit(pathname, 400, {
            keyId: authValidation.key?.id,
            keyName: authValidation.key?.name,
            reason: err.message,
          });
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

    recordAudit(pathname, 404, { keyId: authValidation.key?.id, keyName: authValidation.key?.name });
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
