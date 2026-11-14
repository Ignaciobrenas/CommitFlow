import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { ApiKeyManager } from '../src/mcp/apiKeyManager';
import { CommitFlowHttpServer } from '../src/mcp/commitflowHttpServer';
import { CommitFlowMcpServer } from '../src/mcp/commitflowMcpServer';
import { sharedMcpAuditLog } from '../src/mcp/mcpAuditLog';

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readFirstSseEvent(url: string): Promise<{ statusCode: number; contentType: string; chunk: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const statusCode = res.statusCode || 0;
      const contentType = String(res.headers['content-type'] || '');
      let chunk = '';
      res.on('data', (d) => {
        chunk += d.toString('utf8');
        if (chunk.includes('event: endpoint')) {
          req.destroy();
          resolve({ statusCode, contentType, chunk });
        }
      });
      res.on('error', (err) => {
        if (chunk.includes('event: endpoint')) {
          resolve({ statusCode, contentType, chunk });
        } else {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => {
      req.destroy(new Error('SSE read timed out'));
    });
  });
}

/**
 * End-to-End integration test suite (Issue #19) exercising the real CommitFlow MCP
 * stdio and Streamable HTTP/SSE servers against a temporary Git repository.
 */
export async function runMcpE2eTestSuite(): Promise<void> {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-mcp-e2e-'));
  let httpServer: CommitFlowHttpServer | null = null;
  let generatedKeyId: string | null = null;

  try {
    // 1. Initialize a real Git repo with 2 commits, a branch, and a tag
    runGit(tmpRepo, ['init']);
    runGit(tmpRepo, ['config', 'user.name', 'CommitFlow E2E']);
    runGit(tmpRepo, ['config', 'user.email', 'e2e@commitflow.dev']);

    fs.writeFileSync(path.join(tmpRepo, 'README.md'), '# CommitFlow E2E Repo\n', 'utf8');
    runGit(tmpRepo, ['add', 'README.md']);
    runGit(tmpRepo, ['commit', '-m', 'chore: initial repository scaffold']);

    runGit(tmpRepo, ['checkout', '-b', 'feat/42-mcp-e2e']);
    fs.writeFileSync(path.join(tmpRepo, 'feature.ts'), 'export const e2e = true;\n', 'utf8');
    runGit(tmpRepo, ['add', 'feature.ts']);
    runGit(tmpRepo, ['commit', '-m', 'feat(mcp): add e2e fixture feature (#42)']);
    runGit(tmpRepo, ['tag', 'v0.9.0-test']);

    // 2. Direct stdio JSON-RPC checks
    sharedMcpAuditLog.clear();
    const mcpServer = new CommitFlowMcpServer(tmpRepo);

    const initRes = await mcpServer.processDirectRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    assert.strictEqual(initRes.result.protocolVersion, '2024-11-05');
    assert.strictEqual(initRes.result.serverInfo.name, 'commitflow-mcp');

    const toolsRes = await mcpServer.processDirectRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.ok(Array.isArray(toolsRes.result.tools) && toolsRes.result.tools.length >= 15);

    const toolNames = [
      'get_repo_state',
      'get_commit_history',
      'read_offline_repo_state',
      'analyze_repo_health',
      'git_bisect_operation',
      'commitflow_get_repo_summary',
    ];
    for (let idx = 0; idx < toolNames.length; idx++) {
      const name = toolNames[idx];
      const args =
        name === 'get_commit_history'
          ? { limit: 5 }
          : name === 'git_bisect_operation'
          ? { action: 'status' }
          : {};
      const callRes = await mcpServer.processDirectRequest({
        jsonrpc: '2.0',
        id: 10 + idx,
        method: 'tools/call',
        params: { name, arguments: args },
      });
      assert.ok(callRes.result && Array.isArray(callRes.result.content), `Tool ${name} returned invalid result`);
      assert.ok(!callRes.result.isError, `Tool ${name} unexpectedly errored`);
    }

    const resourcesList = await mcpServer.processDirectRequest({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    const uris = resourcesList.result.resources.map((r: any) => r.uri);
    assert.ok(uris.includes('commitflow://repo/status'));
    assert.ok(uris.includes('commitflow://repo/graph-summary'));
    assert.ok(uris.includes('commitflow://mcp/audit-log'));

    for (const uri of [
      'commitflow://repo/graph-summary',
      'commitflow://repo/offline-status',
      'commitflow://mcp/audit-log',
    ]) {
      const readRes = await mcpServer.processDirectRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/read',
        params: { uri },
      });
      assert.ok(readRes.result.contents[0].text.length > 0, `Resource ${uri} returned empty text`);
    }

    // 3. HTTP / SSE Transport E2E
    const keyMgr = ApiKeyManager.getInstance();
    const { plaintextKey, metadata } = await keyMgr.generateKey('E2E Test Key', 'read');
    generatedKeyId = metadata.id;

    httpServer = new CommitFlowHttpServer({
      port: 0,
      repoRoot: tmpRepo,
      rateLimitMax: 25,
      rateLimitWindowMs: 60_000,
    });
    const started = await httpServer.start();
    const baseUrl = `http://${started.host}:${started.port}`;

    // Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.strictEqual(healthJson.status, 'ok');
    assert.strictEqual(healthJson.server, 'commitflow-mcp');

    // Missing token -> 401
    const unauthRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 20, method: 'tools/list' }),
    });
    assert.strictEqual(unauthRes.status, 401);

    // Invalid token -> 403
    const badTokenRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer cf_live_invalid_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 21, method: 'tools/list' }),
    });
    assert.strictEqual(badTokenRes.status, 403);

    // Valid token -> tools/list and get_repo_state -> 200
    const httpToolsRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${plaintextKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 22, method: 'tools/list' }),
    });
    assert.strictEqual(httpToolsRes.status, 200);
    const httpToolsJson: any = await httpToolsRes.json();
    assert.ok(httpToolsJson.result.tools.length >= 15);

    const httpStateRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${plaintextKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 23,
        method: 'tools/call',
        params: { name: 'get_repo_state', arguments: {} },
      }),
    });
    assert.strictEqual(httpStateRes.status, 200);
    const httpStateJson: any = await httpStateRes.json();
    assert.ok(
      httpStateJson.result.content[0].text.includes('feat/42-mcp-e2e'),
      'get_repo_state over HTTP must reflect active temp repo branch'
    );

    // SSE endpoint check
    const sse = await readFirstSseEvent(`${baseUrl}/sse?token=${encodeURIComponent(plaintextKey)}`);
    assert.strictEqual(sse.statusCode, 200);
    assert.ok(sse.contentType.includes('text/event-stream'));
    assert.ok(sse.chunk.includes('event: endpoint'));

    // Revoke key -> subsequent request rejected with 403
    const revoked = await keyMgr.revokeKey(metadata.id);
    assert.strictEqual(revoked, true);
    const afterRevokeRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${plaintextKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 24, method: 'tools/list' }),
    });
    assert.strictEqual(afterRevokeRes.status, 403);

    // Audit trail verification
    const auditLogs = httpServer.getAuditLogs();
    assert.ok(auditLogs.length >= 5, `Expected >= 5 audit entries, got ${auditLogs.length}`);

    console.log('   ✔ [MCP E2E] Stdio JSON-RPC + HTTP/SSE + Auth/Revocation E2E tests passed!');
  } finally {
    if (httpServer) {
      await httpServer.stop();
    }
    if (generatedKeyId) {
      await ApiKeyManager.getInstance().revokeKey(generatedKeyId);
    }
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
}
