import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitFsReader } from '../src/git/gitFsReader';
import { GitCommit } from '../src/git/types';
import { GraphLayout } from '../src/graph/graphLayout';
import { IssueBranchLinker } from '../src/issues/issueBranchLinker';
import { SshConfigParser } from '../src/remotes/sshParser';
import { IpcSchemaValidator } from '../src/utils/ipcValidator';

/**
 * Deterministic 32-bit PRNG (Mulberry32) so every fuzz test run is reproducible.
 */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randString(rng: () => number, maxLen: number): string {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./\\:#@!$%^&*()[]{} \t\n\0';
  const len = randInt(rng, 0, maxLen);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[randInt(rng, 0, alphabet.length - 1)];
  }
  return out;
}

function randBytes(rng: () => number, minLen: number, maxLen: number): Buffer {
  const len = randInt(rng, minLen, maxLen);
  const buf = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    buf[i] = randInt(rng, 0, 255);
  }
  return buf;
}

function randHex(rng: () => number, len: number): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += hex[randInt(rng, 0, 15)];
  }
  return out;
}

/**
 * Zero-dependency deterministic fuzzing suite (Issue #18) covering binary parsers,
 * SSH config/remote parsing, branch-issue linking, cyclic DAG topologies, and IPC validation.
 */
export async function runFuzzTestSuite(): Promise<void> {
  const rng = createSeededRng(0xc0ffee01);
  const reader = GitFsReader.getInstance();
  let iterations = 0;

  // 1. Fuzz GitFsReader binary/offline parsers (250 iterations)
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fuzz-'));
  try {
    const gitDir = path.join(tmpRepo, '.git');
    fs.mkdirSync(gitDir, { recursive: true });

    for (let i = 0; i < 250; i++) {
      iterations++;
      const sha = randHex(rng, 40);

      // Malformed/fuzzed .git/index (including DIRC v2/v3/v4 prefixes with truncated bodies)
      const indexBuf =
        i % 3 === 0
          ? Buffer.concat([
              Buffer.from('DIRC'),
              Buffer.from([0, 0, 0, (i % 3) + 2, 0, 0, 0, randInt(rng, 1, 20)]),
              randBytes(rng, 0, 180),
            ])
          : randBytes(rng, 0, 220);
      fs.writeFileSync(path.join(gitDir, 'index'), indexBuf);
      const entries = reader.readIndexEntries(gitDir);
      assert.ok(Array.isArray(entries), 'readIndexEntries must always return an array');

      // Malformed .gitmodules
      fs.writeFileSync(path.join(tmpRepo, '.gitmodules'), randString(rng, 250), 'utf8');
      const subs = reader.readSubmodules(tmpRepo, gitDir);
      assert.ok(Array.isArray(subs), 'readSubmodules must always return an array');

      // Fuzzed HEAD & merge state
      fs.writeFileSync(
        path.join(gitDir, 'HEAD'),
        i % 2 === 0 ? `ref: refs/heads/${randString(rng, 40)}` : randString(rng, 80),
        'utf8'
      );
      if (i % 4 === 0) {
        fs.writeFileSync(path.join(gitDir, 'MERGE_HEAD'), randString(rng, 64), 'utf8');
      } else {
        fs.rmSync(path.join(gitDir, 'MERGE_HEAD'), { force: true });
      }
      const opState = reader.readOperationState(gitDir);
      assert.strictEqual(typeof opState.isMerging, 'boolean');

      // Pack v2 index lookup on non-magic buffers must safely return null
      const nonMagicBuf = randBytes(rng, 0, 1200);
      if (nonMagicBuf.length >= 4 && nonMagicBuf.readUInt32BE(0) === 0xff744f63) {
        nonMagicBuf[0] = 0x00;
      }
      const idxRes = reader.readPackIndexV2(nonMagicBuf, sha);
      assert.strictEqual(idxRes, null);

      // Parse arbitrary commit and tree payloads safely
      const commitObj = reader.parseCommitObject(sha, randBytes(rng, 0, 300));
      assert.strictEqual(commitObj.hash, sha);
      const treeEntries = reader.parseTreeObject(randBytes(rng, 0, 200));
      assert.ok(Array.isArray(treeEntries));
    }
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }

  // 2. Fuzz SshConfigParser (200 iterations)
  for (let i = 0; i < 200; i++) {
    iterations++;
    const fuzzedCfg = [
      `Host ${randString(rng, 25).replace(/\n/g, '')}`,
      `  HostName ${randString(rng, 30).replace(/\n/g, '')}`,
      `  Port ${randString(rng, 10).replace(/\n/g, '')}`,
      `  IdentityFile ${randString(rng, 40).replace(/\n/g, '')}`,
      randString(rng, 120),
    ].join('\n');

    const map = SshConfigParser.parseConfigContent(fuzzedCfg);
    assert.ok(map instanceof Map, 'parseConfigContent must always return a Map');

    const remoteUrl = i % 2 === 0
      ? `git@${randString(rng, 15)}:${randString(rng, 12)}/${randString(rng, 12)}.git`
      : randString(rng, 80);
    const parsedRemote = SshConfigParser.parseRemoteUrl(remoteUrl, '~/.ssh/nonexistent', map);
    assert.ok(parsedRemote === null || typeof parsedRemote === 'object');
  }

  // 3. Fuzz IssueBranchLinker (200 iterations)
  for (let i = 0; i < 200; i++) {
    iterations++;
    const rawBranch =
      i % 2 === 0
        ? `feat/${randInt(rng, 1, 9999)}-${randString(rng, 30)}-#${randInt(rng, 1, 999)}`
        : randString(rng, 80);
    const extracted = IssueBranchLinker.extractIssueNumbersFromBranch(rawBranch);
    assert.ok(Array.isArray(extracted));
    for (const num of extracted) {
      assert.ok(Number.isInteger(num) && num > 0, `Invalid extracted issue id: ${num}`);
    }

    const maxLen = randInt(rng, 8, 48);
    const slug = IssueBranchLinker.createSlug(randString(rng, 90), maxLen);
    assert.ok(slug.length <= maxLen, `Slug exceeded maxLength ${maxLen}: ${slug}`);
    assert.ok(!slug.startsWith('-') && !slug.endsWith('-'), `Unwrapped hyphen in slug: ${slug}`);

    const branchName = IssueBranchLinker.generateBranchName({
      number: randInt(rng, 1, 99999),
      title: randString(rng, 60) || 'fallback-title',
      labels: [{ name: i % 3 === 0 ? 'bug' : 'enhancement', color: 'ff0000' }],
    });
    assert.ok(typeof branchName === 'string' && !branchName.includes('..'));
  }

  // 4. Fuzz GraphLayout with random & cyclic DAG topologies (150 iterations)
  for (let i = 0; i < 150; i++) {
    iterations++;
    const count = randInt(rng, 0, 35);
    const hashes = Array.from({ length: count }, (_, idx) => `${idx.toString(16).padStart(4, '0')}${randHex(rng, 36)}`);
    const commits: GitCommit[] = hashes.map((hash, idx) => {
      const parents: string[] = [];
      if (count > 0) {
        const numParents = randInt(rng, 0, 3);
        for (let p = 0; p < numParents; p++) {
          // Intentionally allow forward pointers and self-loops to test cycle resilience
          const targetIdx = randInt(rng, 0, count - 1);
          parents.push(hashes[targetIdx]);
        }
        if (i % 5 === 0 && idx < count - 1) {
          parents.push(randHex(rng, 40)); // dangling missing parent
        }
      }
      const author = {
        name: randString(rng, 20) || 'Fuzz',
        email: 'fuzz@example.com',
        date: new Date(1700000000000 - idx * 60000),
        relativeTime: `${idx}m ago`,
        avatarUrl: '',
      };
      return {
        hash,
        shortHash: hash.slice(0, 7),
        parentHashes: parents,
        author,
        committer: author,
        subject: randString(rng, 60) || `Commit ${idx}`,
        body: '',
        refs: idx === 0 ? [{ type: 'head', name: 'main', isHead: true }] : [],
      };
    });

    const nodes = GraphLayout.compute(commits, 'cyberpunk');
    assert.strictEqual(nodes.length, commits.length, 'GraphLayout output must match commit count');
    for (const node of nodes) {
      assert.ok(node.lane >= 0 && Number.isFinite(node.lane), `Invalid lane: ${node.lane}`);
    }
  }

  // 5. Fuzz IpcSchemaValidator security invariants (250 iterations)
  const dangerousPayloads: unknown[] = [
    null,
    undefined,
    42,
    'requestData',
    [],
    { command: 'execArbitraryShell', payload: { cmd: 'rm -rf /' } },
    { command: 'openExternal', payload: 'javascript:alert(1)' },
    { command: 'openExternal', payload: 'file:///etc/passwd' },
    { command: 'openDiff', payload: { commitHash: '; cat /etc/passwd', filePath: '../../etc/passwd' } },
    { command: 'resolveConflictFile', payload: { filePath: '../outside.txt', strategy: 'ours' } },
    { command: 'resolveConflictFile', payload: { filePath: 'src/a.ts\0.png', strategy: 'theirs' } },
    JSON.parse('{"command":"requestData","payload":{"__proto__":{"isAdmin":true}}}'),
    JSON.parse('{"command":"requestData","__proto__":{"polluted":true}}'),
  ];

  for (let i = 0; i < 250; i++) {
    iterations++;
    const payload: any =
      i < dangerousPayloads.length
        ? dangerousPayloads[i]
        : {
            command: i % 4 === 0 ? 'requestData' : randString(rng, 24),
            payload: {
              commitHash: i % 4 === 0 ? 'a1b2c3d4' : randString(rng, 45),
              filePath: i % 2 === 0 ? `../../${randString(rng, 16)}` : randString(rng, 32),
              branch: randString(rng, 40),
            },
          };

    const res = IpcSchemaValidator.validateWebviewMessage(payload);
    assert.strictEqual(typeof res.valid, 'boolean');
    if (i < dangerousPayloads.length) {
      assert.strictEqual(res.valid, false, `Dangerous IPC payload #${i} should be rejected`);
    }
    const inner = payload?.payload;
    if (
      inner &&
      typeof inner.filePath === 'string' &&
      (inner.filePath.includes('..') || inner.filePath.includes('\0'))
    ) {
      assert.strictEqual(res.valid, false, 'Path traversal payload must never pass validation');
    }
  }

  assert.ok(iterations >= 1000, `Expected at least 1000 fuzz iterations, ran ${iterations}`);
  console.log(`   ✔ [Fuzz] Completed ${iterations} deterministic fuzzing iterations with 0 invariant failures`);
}
