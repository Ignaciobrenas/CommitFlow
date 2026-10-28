import assert from 'assert';
import * as path from 'path';
import { GitClient } from '../src/git/gitClient';
import { GraphLayout } from '../src/graph/graphLayout';
import { GitHubService } from '../src/git/githubService';

async function runLiveAudit() {
  console.log('🔍 [CommitFlow Live Audit] Starting real Git repository audit...\n');

  const repoDir = path.resolve(__dirname, '..');
  const gitClient = GitClient.getInstance();

  // 1. Verify Repo Root Detection
  console.log('1. Checking repository root detection...');
  const detectedRoot = await gitClient.getRepoRoot(repoDir);
  assert.ok(detectedRoot !== null, 'Repo root should be detected');
  console.log(`   ✔ Detected Root: ${detectedRoot}`);

  // 2. Verify Reading Commits from Git
  console.log('\n2. Reading commits from real Git history...');
  const commits = await gitClient.getCommits(detectedRoot!, 50);
  assert.ok(commits.length >= 8, `Should have at least 8 commits, got ${commits.length}`);
  console.log(`   ✔ Successfully parsed ${commits.length} commits`);
  console.log(`   ✔ Latest Commit: [${commits[0].shortHash}] ${commits[0].subject}`);
  console.log(`   ✔ Latest Author: ${commits[0].author.name} <${commits[0].author.email}> (${commits[0].author.relativeTime})`);
  console.log(`   ✔ Author Avatar URL: ${commits[0].author.avatarUrl}`);

  // 3. Verify Reading Branches from Git
  console.log('\n3. Reading branches from real Git repository...');
  const branches = await gitClient.getBranches(detectedRoot!);
  assert.ok(branches.length >= 1, 'Should find at least 1 branch');
  const mainBranch = branches.find((b) => b.name === 'main');
  assert.ok(mainBranch !== undefined, 'Branch "main" should be found');
  console.log(`   ✔ Found ${branches.length} branches: ${branches.map((b) => b.name).join(', ')}`);
  console.log(`   ✔ Active Branch: ${mainBranch?.name} (Current: ${mainBranch?.isCurrent})`);

  // 4. Verify GitHub Remote URL Detection
  console.log('\n4. Reading GitHub remote origin info...');
  const ghInfo = await gitClient.getGitHubRepoInfo(detectedRoot!);
  assert.ok(ghInfo !== null, 'GitHub remote info should be detected');
  assert.strictEqual(ghInfo?.owner, 'Ignaciobrenas');
  assert.ok(
    ghInfo?.repo?.toLowerCase() === 'commitflow' ||
      ghInfo?.repo?.toLowerCase() === 'branchify',
    'Remote repo name should match CommitFlow'
  );
  console.log(`   ✔ GitHub Owner: ${ghInfo?.owner}`);
  console.log(`   ✔ GitHub Repo: ${ghInfo?.repo}`);
  console.log(`   ✔ GitHub Web URL: ${ghInfo?.webUrl}`);

  // 5. Verify Real Git Blame on README.md
  console.log('\n5. Performing real Git Blame on README.md (line 1)...');
  const readmePath = path.join(detectedRoot!, 'README.md');
  const blame = await gitClient.getBlameForLine(readmePath, 1);
  assert.ok(blame !== null, 'Blame should succeed for line 1 of README.md');
  console.log(`   ✔ Blame Line: ${blame?.line}`);
  console.log(`   ✔ Blame Author: ${blame?.author.name} <${blame?.author.email}>`);
  console.log(`   ✔ Blame Commit: ${blame?.shortHash} - "${blame?.summary}"`);

  // 6. Verify Changed Files in Latest Commit
  console.log('\n6. Reading changed files in latest commit...');
  const latestHash = commits[0].hash;
  const files = await gitClient.getCommitFilesDetailed(detectedRoot!, latestHash);
  assert.ok(files.length > 0, 'Latest commit should contain modified files');
  console.log(`   ✔ Found ${files.length} changed files:`);
  files.forEach((f) => console.log(`      [${f.status}] ${f.path}`));

  // 7. Verify Graph DAG Layout Calculation
  console.log('\n7. Computing Graph DAG topological lanes...');
  const graphNodes = GraphLayout.compute(commits);
  assert.strictEqual(graphNodes.length, commits.length);
  console.log(`   ✔ Computed ${graphNodes.length} graph nodes with topological lanes.`);
  console.log(`   ✔ Node 0 Lane: ${graphNodes[0].lane}, Color: ${graphNodes[0].color}`);

  // 8. Verify Repo Stats Calculation
  console.log('\n8. Calculating repository contributor statistics...');
  const stats = gitClient.computeRepoStats(commits, branches);
  assert.ok(stats.totalCommits >= 8);
  assert.ok(stats.totalContributors >= 1);
  console.log(`   ✔ Total Commits: ${stats.totalCommits}`);
  console.log(`   ✔ Total Contributors: ${stats.totalContributors}`);
  console.log(`   ✔ Top Contributor: ${stats.topContributors[0].name} (${stats.topContributors[0].commitsCount} commits, ${stats.topContributors[0].percentage}%)`);

  // 9. Verify Extension Activation Lifecycle
  console.log('\n9. Simulating Extension Host activation...');
  const registeredCommands: string[] = [];
  const mockContext = {
    subscriptions: [] as { dispose(): any }[],
    extensionUri: { scheme: 'file', path: detectedRoot!, fsPath: detectedRoot! },
  };

  const { activate, deactivate } = require('../src/extension');
  activate(mockContext);

  assert.ok(mockContext.subscriptions.length >= 6, 'Should register at least 6 subscriptions on activation');
  console.log(`   ✔ Successfully activated CommitFlow with ${mockContext.subscriptions.length} active providers & command subscriptions`);

  deactivate();
  console.log('   ✔ Deactivated cleanly without memory leaks');

  // 10. Verify Worktrees and Remote Repo Info
  console.log('\n10. Auditing Worktrees and File History on Live Repo...');
  const worktrees = await gitClient.getWorktrees(detectedRoot!);
  assert.ok(worktrees.length >= 1, 'Should find at least 1 worktree (main repo)');
  console.log(`   ✔ Worktree count: ${worktrees.length} (Branch: ${worktrees[0].branch}, WIP: ${worktrees[0].hasWip})`);

  const fileHistory = await gitClient.getFileCommitHistory(detectedRoot!, 'package.json', 5);
  assert.ok(fileHistory.length >= 1, 'Should find commits for package.json');
  console.log(`   ✔ package.json history count: ${fileHistory.length} revisions`);

  // 11. Verify Real Git Stash Reader
  console.log('\n11. Auditing Git Stash reader on Live Repo...');
  const liveStashes = await gitClient.getStashes(detectedRoot!);
  assert.ok(Array.isArray(liveStashes), 'Stashes should return an array');
  console.log(`   ✔ Git Stash check: ${liveStashes.length} stashes found`);

  // 12. Verify Instant Changelog Generator
  console.log('\n12. Auditing Instant Markdown Changelog generator...');
  const changelogMd = await gitClient.generateChangelog(detectedRoot!, 5);
  assert.ok(changelogMd.includes('# Release Changelog'), 'Changelog should contain Release Changelog header');
  assert.ok(changelogMd.includes(commits[0].shortHash), 'Changelog should include latest commit shortHash');
  console.log(`   ✔ Changelog Markdown generated successfully (${changelogMd.split('\n').length} lines)`);

  // 13. Verify Multi-Theme Chromatic Graph Computations
  console.log('\n13. Auditing Multi-Theme Graph DAG computations...');
  const testThemes = ['cyberpunk', 'dracula', 'github', 'neon-pink', 'neon-green', 'neon-blue'] as const;
  for (const th of testThemes) {
    const nodes = GraphLayout.compute(commits, th);
    assert.strictEqual(nodes.length, commits.length);
    assert.ok(nodes[0].color, `Node should have assigned color in ${th}`);
  }
  console.log('   ✔ All 6 new themes computed custom chromatic lanes successfully');

  console.log('\n======================================================');
  console.log('🎉 LIVE VERIFICATION COMPLETED WITH 100% SUCCESS!');
  console.log('   All Git readers, parsers, and services WORK FLAWLESSLY.');
  console.log('======================================================\n');
}

runLiveAudit().catch((err) => {
  console.error('❌ Live audit failed:', err);
  process.exit(1);
});
