const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const esbuild = require('esbuild');

function loadDagModules() {
  const repoRoot = path.resolve(__dirname, '..');
  const tmpOut = path.join(os.tmpdir(), `commitflow-bench-${process.pid}-${Date.now()}.js`);
  esbuild.buildSync({
    stdin: {
      contents: `
        export { GraphLayout } from './src/graph/graphLayout';
        export { DagWorkerEngine } from './src/graph/dagWorkerClient';
      `,
      resolveDir: repoRoot,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: tmpOut,
  });

  try {
    return require(tmpOut);
  } finally {
    try {
      fs.rmSync(tmpOut, { force: true });
    } catch {
      // ignore cleanup errors on temp file
    }
  }
}

function generateSyntheticCommits(count) {
  const commits = new Array(count);
  const baseMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const hexHashes = new Array(count);

  for (let i = 0; i < count; i++) {
    hexHashes[i] = i.toString(16).padStart(8, '0').padEnd(40, 'a');
  }

  for (let i = 0; i < count; i++) {
    const parentHashes = [];
    if (i + 1 < count) {
      parentHashes.push(hexHashes[i + 1]);
    }
    // Every 20th commit forms a merge/branch topology edge
    if (i % 20 === 0 && i + 7 < count) {
      parentHashes.push(hexHashes[i + 7]);
    }

    const author = {
      name: i % 4 === 0 ? 'Elena' : 'Ignacio',
      email: 'dev@commitflow.local',
      date: new Date(baseMs - i * 60000),
      relativeTime: `${i}m ago`,
      avatarUrl: '',
    };

    commits[i] = {
      hash: hexHashes[i],
      shortHash: hexHashes[i].slice(0, 7),
      parentHashes,
      author,
      committer: author,
      subject: i % 20 === 0 ? `merge: integrate topic-${i} into main` : `feat(dag): commit #${i}`,
      body: '',
      refs:
        i === 0
          ? [{ type: 'head', name: 'main', isHead: true }]
          : i % 2500 === 0
          ? [{ type: 'tag', name: `v0.${Math.floor(i / 2500)}.0`, isHead: false }]
          : [],
    };
  }

  return commits;
}

async function runBenchmark() {
  const COMMIT_COUNT = 50000;
  const BUDGET_MS = 2500;

  console.log(`\n======================================================`);
  console.log(`CommitFlow 50k DAG Layout Performance Benchmark`);
  console.log(`======================================================`);

  const { GraphLayout, DagWorkerEngine } = loadDagModules();
  const commits = generateSyntheticCommits(COMMIT_COUNT);

  const memBeforeSync = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const syncNodes = GraphLayout.compute(commits, 'cyberpunk');
  const syncElapsedMs = performance.now() - t0;
  const memAfterSync = process.memoryUsage().heapUsed;

  assert.strictEqual(syncNodes.length, COMMIT_COUNT, `Expected ${COMMIT_COUNT} nodes from GraphLayout.compute`);
  assert.ok(
    syncElapsedMs < BUDGET_MS,
    `GraphLayout.compute(50k) exceeded ${BUDGET_MS}ms budget: ${syncElapsedMs.toFixed(2)}ms`
  );

  const engine = DagWorkerEngine.getInstance();
  const t1 = performance.now();
  const asyncNodes = await engine.computeLayoutAsync(commits, 'cyberpunk');
  const asyncElapsedMs = performance.now() - t1;
  engine.dispose();

  assert.strictEqual(asyncNodes.length, COMMIT_COUNT, `Expected ${COMMIT_COUNT} nodes from DagWorkerEngine`);
  assert.ok(
    asyncElapsedMs < BUDGET_MS,
    `DagWorkerEngine.computeLayoutAsync(50k) exceeded ${BUDGET_MS}ms budget: ${asyncElapsedMs.toFixed(2)}ms`
  );

  const deltaMb = ((memAfterSync - memBeforeSync) / (1024 * 1024)).toFixed(2);
  const throughput = Math.round(COMMIT_COUNT / (syncElapsedMs / 1000));

  console.log(`  Commits rendered  : ${COMMIT_COUNT.toLocaleString()}`);
  console.log(`  GraphLayout sync  : ${syncElapsedMs.toFixed(2)} ms (${throughput.toLocaleString()} commits/sec)`);
  console.log(`  DagWorkerEngine   : ${asyncElapsedMs.toFixed(2)} ms`);
  console.log(`  Heap delta (sync) : ${deltaMb} MB`);
  console.log(`  SLA Budget        : < ${BUDGET_MS} ms [PASS]\n`);
}

runBenchmark().catch((err) => {
  console.error('[CommitFlow] 50k Benchmark failed:', err);
  process.exit(1);
});
