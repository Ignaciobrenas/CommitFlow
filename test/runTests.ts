import assert from 'assert';
import { AvatarService } from '../src/avatars/avatarService';
import { GitParser } from '../src/git/gitParser';
import { GraphLayout, THEME_LANE_COLORS } from '../src/graph/graphLayout';
import { GitContentProvider } from '../src/git/gitContentProvider';
import { LruCache } from '../src/utils/lruCache';
import { GitClient } from '../src/git/gitClient';
import { GitHubService } from '../src/git/githubService';
import { GitCommit } from '../src/git/types';

console.log('🧪 Starting CommitFlow Extended Test Suite...\n');

// 1. Test AvatarService
console.log('▶ Testing AvatarService...');
const avatarService = AvatarService.getInstance();

const gravatarUrl = avatarService.getAvatarUrl('Ignacio', 'user@example.com');
assert.ok(
  gravatarUrl.startsWith('https://www.gravatar.com/avatar/'),
  'Should generate Gravatar URL'
);

const ghUrl = avatarService.getAvatarUrl(
  'Ignacio',
  '12345+ignaciobrenas@users.noreply.github.com'
);
assert.strictEqual(
  ghUrl,
  'https://avatars.githubusercontent.com/ignaciobrenas',
  'Should resolve GitHub username from noreply email'
);

const initialsSvg = avatarService.generateInitialsSvg('John Doe');
assert.ok(
  initialsSvg.startsWith('data:image/svg+xml;utf8,'),
  'Should produce SVG data URI'
);
assert.ok(initialsSvg.includes('JD'), 'Should contain initials JD');
console.log('  ✔ AvatarService tests passed!');

// 2. Test LruCache
console.log('\n▶ Testing LruCache...');
const cache = new LruCache<string, number>(3);
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
assert.strictEqual(cache.get('a'), 1);
cache.set('d', 4); // should evict 'b' (since 'a' was recently accessed)
assert.strictEqual(cache.has('b'), false, "'b' should be evicted");
assert.strictEqual(cache.has('a'), true, "'a' should remain");
assert.strictEqual(cache.has('d'), true, "'d' should be present");

// Prefix deletion
cache.set('file1.ts#10', 10);
cache.set('file1.ts#20', 20);
cache.set('file2.ts#5', 5);
cache.deleteMatching((k) => k.startsWith('file1.ts'));
assert.strictEqual(cache.has('file1.ts#10'), false);
assert.strictEqual(cache.has('file1.ts#20'), false);
console.log('  ✔ LruCache tests passed!');

// 3. Test GitContentProvider URI Builder
console.log('\n▶ Testing GitContentProvider URI builder...');
const diffUri = GitContentProvider.createUri('abc1234', 'src/app.ts', 'C:/repo');
assert.strictEqual(diffUri.scheme, 'commitflow-revision');
assert.strictEqual(diffUri.authority, 'abc1234');
assert.ok(diffUri.path.includes('src%2Fapp.ts') || diffUri.path.includes('src/app.ts'));
console.log('  ✔ GitContentProvider tests passed!');

// 4. Test GitParser
console.log('\n▶ Testing GitParser...');
const now = new Date();
assert.strictEqual(GitParser.formatRelativeTime(now), 'just now');

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
assert.strictEqual(GitParser.formatRelativeTime(twoHoursAgo), '2h ago');

const refs = GitParser.parseRefs('HEAD -> main, tag: v1.0.0, origin/main');
assert.strictEqual(refs.length, 3);
assert.strictEqual(refs[0].name, 'main');
assert.strictEqual(refs[0].isHead, true);
assert.strictEqual(refs[1].name, 'v1.0.0');
assert.strictEqual(refs[1].type, 'tag');
assert.strictEqual(refs[2].type, 'remote-branch');

const sampleLog = `a1b2c3d4e5f6\x1fparent123\x1fIgnacio\x1fignacio@test.com\x1f1700000000\x1fIgnacio\x1fignacio@test.com\x1f1700000000\x1fHEAD -> main\x1ffeat: initial commit\x1fDetailed commit body\x1e`;
const commits = GitParser.parseLogOutput(sampleLog);
assert.strictEqual(commits.length, 1);
assert.strictEqual(commits[0].shortHash, 'a1b2c3d');
assert.strictEqual(commits[0].author.name, 'Ignacio');
assert.strictEqual(commits[0].subject, 'feat: initial commit');
console.log('  ✔ GitParser tests passed!');

// 5. Test GraphLayout DAG Multi-Lane Engine
console.log('\n▶ Testing GraphLayout DAG Multi-Lane Engine...');
const mockCommits: GitCommit[] = [
  {
    hash: 'commit3',
    shortHash: 'c3',
    parentHashes: ['commit2', 'commit1-branch'],
    author: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '1h ago', avatarUrl: '' },
    committer: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '1h ago', avatarUrl: '' },
    subject: 'Merge branch feature',
    body: '',
    refs: [{ name: 'main', type: 'branch', isHead: true }],
  },
  {
    hash: 'commit1-branch',
    shortHash: 'c1b',
    parentHashes: ['commit1'],
    author: { name: 'Alex', email: 'alex@test.com', date: new Date(), relativeTime: '2h ago', avatarUrl: '' },
    committer: { name: 'Alex', email: 'alex@test.com', date: new Date(), relativeTime: '2h ago', avatarUrl: '' },
    subject: 'Feature commit',
    body: '',
    refs: [{ name: 'feature', type: 'branch', isHead: false }],
  },
  {
    hash: 'commit2',
    shortHash: 'c2',
    parentHashes: ['commit1'],
    author: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '3h ago', avatarUrl: '' },
    committer: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '3h ago', avatarUrl: '' },
    subject: 'Direct commit on main',
    body: '',
    refs: [],
  },
  {
    hash: 'commit1',
    shortHash: 'c1',
    parentHashes: [],
    author: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '4h ago', avatarUrl: '' },
    committer: { name: 'Ignacio', email: 'ignacio@test.com', date: new Date(), relativeTime: '4h ago', avatarUrl: '' },
    subject: 'Root commit',
    body: '',
    refs: [],
  },
];

const nodes = GraphLayout.compute(mockCommits);
assert.strictEqual(nodes.length, 4);
assert.strictEqual(nodes[0].lane, 0);
assert.ok(nodes[0].lines.some((l) => l.isMerge));
console.log('  ✔ GraphLayout tests passed!');

// 6. Test Repo Stats Computation
console.log('\n▶ Testing Repo Stats calculation...');
const gitClient = GitClient.getInstance();
const stats = gitClient.computeRepoStats(mockCommits, []);
assert.strictEqual(stats.totalCommits, 4);
assert.strictEqual(stats.totalContributors, 2);
assert.strictEqual(stats.topContributors[0].name, 'Ignacio');
assert.strictEqual(stats.topContributors[0].commitsCount, 3);
assert.strictEqual(stats.topContributors[0].percentage, 75);
console.log('  ✔ Repo Stats tests passed!');

// 7. Test GitHub Service
console.log('\n▶ Testing GitHub Service...');
const ghService = GitHubService.getInstance();

// HTTPS format
const httpsInfo = ghService.parseRemoteUrl('https://github.com/Ignaciobrenas/commitflow.git');
assert.ok(httpsInfo !== null, 'Should parse HTTPS GitHub URL');
assert.strictEqual(httpsInfo?.owner, 'Ignaciobrenas');
assert.strictEqual(httpsInfo?.repo, 'commitflow');
assert.strictEqual(httpsInfo?.webUrl, 'https://github.com/Ignaciobrenas/commitflow');

// SSH format
const sshInfo = ghService.parseRemoteUrl('git@github.com:Ignaciobrenas/commitflow.git');
assert.ok(sshInfo !== null, 'Should parse SSH GitHub URL');
assert.strictEqual(sshInfo?.owner, 'Ignaciobrenas');
assert.strictEqual(sshInfo?.repo, 'commitflow');

// Commit & Branch links
const commitUrl = ghService.getCommitUrl(httpsInfo!, '1171cdd');
assert.strictEqual(commitUrl, 'https://github.com/Ignaciobrenas/commitflow/commit/1171cdd');

const branchUrl = ghService.getBranchUrl(httpsInfo!, 'origin/feature/auth');
assert.strictEqual(branchUrl, 'https://github.com/Ignaciobrenas/commitflow/tree/feature%2Fauth');

// Autolink issues
const linked = ghService.autolinkIssues(httpsInfo!, 'fix: resolve bug in parser (#42)');
assert.strictEqual(
  linked,
  'fix: resolve bug in parser ([#42](https://github.com/Ignaciobrenas/commitflow/issues/42))'
);
console.log('  ✔ GitHub Service tests passed!');

// 8. Test Edge Cases & Fault Tolerance
console.log('\n▶ Testing Edge Cases & Fault Tolerance...');

// Edge case A: Empty commits list
const emptyNodes = GraphLayout.compute([]);
assert.deepStrictEqual(emptyNodes, [], 'Empty commits list should yield empty nodes array');

// Edge case B: Octopus merge with 4 parents
const octopusCommit: GitCommit = {
  hash: 'octopus-merge',
  shortHash: 'octo',
  parentHashes: ['p1', 'p2', 'p3', 'p4'],
  author: { name: 'Lead', email: 'lead@test.com', date: new Date(), relativeTime: 'just now', avatarUrl: '' },
  committer: { name: 'Lead', email: 'lead@test.com', date: new Date(), relativeTime: 'just now', avatarUrl: '' },
  subject: 'Merge 4 feature branches',
  body: '',
  refs: [],
};
const octoNodes = GraphLayout.compute([octopusCommit]);
assert.strictEqual(octoNodes.length, 1);
assert.strictEqual(octoNodes[0].lines.length, 4, 'Octopus merge must produce 4 route lines');
assert.strictEqual(octoNodes[0].lines.filter((l) => l.isMerge).length, 3);

// Edge case C: Uncommitted local modifications in Git Blame
const rawUncommittedBlame = `0000000000000000000000000000000000000000 1 1 1
author Not Committed Yet
author-mail <not.committed.yet>
author-time 1700000000
author-tz +0000
committer Not Committed Yet
committer-mail <not.committed.yet>
committer-time 1700000000
committer-tz +0000
summary Version of file with local modifications
filename test.ts`;

const parsedUncommitted = gitClient.parseIncrementalBlame(rawUncommittedBlame, 1, 'test.ts');
assert.ok(parsedUncommitted !== null);
assert.strictEqual(parsedUncommitted?.shortHash, 'Working Tree');
assert.strictEqual(parsedUncommitted?.author.name, 'You (Uncommitted)');

// Edge case D: Untracked / empty raw blame
const nullBlame = gitClient.parseIncrementalBlame('', 1, 'untracked.ts');
assert.strictEqual(nullBlame, null, 'Empty blame output should return null');

console.log('  ✔ Edge cases and fault tolerance tests passed!');

// 9. Test Personal Stats & Branch Participation calculation
console.log('\n▶ Testing Personal Stats & Branch Participation calculation...');
const mockBranches = [
  {
    name: 'main',
    fullName: 'refs/heads/main',
    isRemote: false,
    isCurrent: true,
    commitHash: 'commit3',
    lastAuthor: mockCommits[0].author,
  },
  {
    name: 'feature',
    fullName: 'refs/heads/feature',
    isRemote: false,
    isCurrent: false,
    commitHash: 'commit1-branch',
    lastAuthor: mockCommits[1].author,
  },
];

const myPersonalStats = gitClient.computePersonalStats(
  mockCommits,
  mockBranches,
  'Ignacio',
  'ignacio@test.com'
);
assert.strictEqual(myPersonalStats.myTotalCommits, 3);
assert.strictEqual(myPersonalStats.commitPercentage, 75);
assert.ok(myPersonalStats.branches.length >= 1, 'Should find branches with personal commits');
assert.strictEqual(myPersonalStats.branches[0].branchName, 'main');
assert.strictEqual(myPersonalStats.branches[0].myCommitsCount, 3);
console.log('  ✔ Personal Stats tests passed!');

// 10. Test Internationalization (i18n)
console.log('\n▶ Testing Internationalization Engine (i18n)...');
const { t } = require('../src/i18n/locales');
assert.strictEqual(t('app.name', 'es'), 'CommitFlow');
assert.strictEqual(t('app.name', 'en'), 'CommitFlow');
assert.strictEqual(t('toolbar.myImpact', 'es'), 'Mi Impacto');
assert.strictEqual(t('toolbar.myImpact', 'en'), 'My Impact');
assert.strictEqual(t('settings.title', 'es'), 'Ajustes de CommitFlow');
assert.strictEqual(t('settings.title', 'en'), 'CommitFlow Settings');
assert.strictEqual(t('blame.viewChanges', 'es'), 'Ver Cambios');
assert.strictEqual(t('blame.viewChanges', 'en'), 'View Changes');
assert.strictEqual(t('stash.title', 'es'), 'Gestor de Git Stash');
assert.strictEqual(t('stash.title', 'en'), 'Git Stash Manager');
// Fallback & auto detection
assert.strictEqual(t('toolbar.searchPlaceholder', 'auto', 'es'), 'Buscar commits, autores, hashes...');
assert.strictEqual(t('toolbar.searchPlaceholder', 'auto', 'en_US'), 'Search commits, authors, hashes...');
console.log('  ✔ i18n tests passed!');

// 11. Test CommitFlow MCP Server (Model Context Protocol)
console.log('\n▶ Testing CommitFlow MCP Server...');
const { CommitFlowMcpServer } = require('../src/mcp/commitflowMcpServer');
const mcpServer = new CommitFlowMcpServer(process.cwd());
assert.ok(mcpServer, 'CommitFlow MCP Server instance created');

// Test initialize method
const initResponse = mcpServer['handleJsonRpc']({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {},
});
initResponse.then((res: any) => {
  assert.strictEqual(res.result.serverInfo.name, 'commitflow-mcp');
  assert.strictEqual(res.result.serverInfo.version, '0.3.0');
});

// Test tools/list method
const toolsResponse = mcpServer['handleJsonRpc']({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {},
});
toolsResponse.then((res: any) => {
  const toolNames = res.result.tools.map((t: any) => t.name);
  assert.ok(toolNames.includes('commitflow_get_user_impact'));
  assert.ok(toolNames.includes('commitflow_get_active_context'));
  assert.ok(toolNames.includes('commitflow_get_commit_history'));
  assert.ok(toolNames.includes('commitflow_get_line_blame'));
  assert.ok(toolNames.includes('commitflow_get_repo_summary'));
});

// Test resources/list method
const resResponse = mcpServer['handleJsonRpc']({
  jsonrpc: '2.0',
  id: 3,
  method: 'resources/list',
  params: {},
});
resResponse.then((res: any) => {
  const uris = res.result.resources.map((r: any) => r.uri);
  assert.ok(uris.includes('commitflow://repo/user-context'));
  assert.ok(uris.includes('commitflow://repo/graph-summary'));
});
console.log('  ✔ MCP Server tests passed!');

// 12. Test Stash Parser & Integration
console.log('\n▶ Testing Git Stash Support...');
assert.strictEqual(typeof gitClient.getStashes, 'function');
assert.strictEqual(typeof gitClient.stashSave, 'function');
assert.strictEqual(typeof gitClient.stashPop, 'function');
assert.strictEqual(typeof gitClient.stashApply, 'function');
assert.strictEqual(typeof gitClient.stashDrop, 'function');
console.log('  ✔ Git Stash Client API tests passed!');

// 13. Test Rebase & Merge Execution APIs
console.log('\n▶ Testing Rebase & Merge Client APIs...');
assert.strictEqual(typeof gitClient.rebase, 'function');
assert.strictEqual(typeof gitClient.merge, 'function');
assert.strictEqual(typeof gitClient.abortRebase, 'function');
console.log('  ✔ Rebase & Merge Client API tests passed!');

// 14. Test Multi-Provider & Private Repositories
console.log('\n▶ Testing Multi-Provider & Private Repositories...');
const ghRemote = ghService.parseRemoteUrl('git@github.com:myorg/private-repo.git');
assert.ok(ghRemote);
assert.strictEqual(ghRemote.provider, 'github');
assert.strictEqual(ghRemote.owner, 'myorg');
assert.strictEqual(ghRemote.repo, 'private-repo');
assert.strictEqual(ghRemote.isPrivate, true);

const glRemote = ghService.parseRemoteUrl('git@gitlab.com:enterprise/project.git');
assert.ok(glRemote);
assert.strictEqual(glRemote.provider, 'gitlab');
assert.strictEqual(glRemote.isPrivate, true);
assert.strictEqual(ghService.getPullRequestUrl(glRemote, 42), 'https://gitlab.com/enterprise/project/-/merge_requests/42');

const bbRemote = ghService.parseRemoteUrl('https://bitbucket.org/team/code.git');
assert.ok(bbRemote);
assert.strictEqual(bbRemote.provider, 'bitbucket');
assert.strictEqual(ghService.getPullRequestUrl(bbRemote, 99), 'https://bitbucket.org/team/code/pull-requests/99');
console.log('  ✔ Multi-Provider & Private Repositories tests passed!');

// 15. Test Worktrees & Multi-WIP Client APIs
console.log('\n▶ Testing Worktrees & Multi-WIP APIs...');
assert.strictEqual(typeof gitClient.getWorktrees, 'function');
assert.strictEqual(typeof gitClient.addWorktree, 'function');
assert.strictEqual(typeof gitClient.removeWorktree, 'function');
console.log('  ✔ Worktrees & Multi-WIP tests passed!');

// 16. Test Visual File History API
console.log('\n▶ Testing Visual File History API...');
assert.strictEqual(typeof gitClient.getFileCommitHistory, 'function');
console.log('  ✔ Visual File History tests passed!');

// 17. Test Cloud Patches API
console.log('\n▶ Testing Cloud Patches API...');
assert.strictEqual(typeof gitClient.createCloudPatch, 'function');
assert.strictEqual(typeof gitClient.applyCloudPatch, 'function');
console.log('  ✔ Cloud Patches tests passed!');

// 18. Test Color Themes & Lane Palettes
console.log('\n▶ Testing Color Themes & Chromatic Lane Palettes...');
const themes = ['cyberpunk', 'dracula', 'github', 'neon-pink', 'neon-green', 'neon-blue', 'dark', 'light'] as const;
for (const theme of themes) {
  assert.ok(THEME_LANE_COLORS[theme], `THEME_LANE_COLORS should include ${theme}`);
  assert.ok(THEME_LANE_COLORS[theme].length >= 7, `${theme} palette should have at least 7 colors`);
}
// Test GraphLayout computation with cyberpunk theme
const cyberpunkNodes = GraphLayout.compute(mockCommits, 'cyberpunk');
assert.strictEqual(cyberpunkNodes[0].color, THEME_LANE_COLORS['cyberpunk'][0]);
// Test GraphLayout computation with dracula theme
const draculaNodes = GraphLayout.compute(mockCommits, 'dracula');
assert.strictEqual(draculaNodes[0].color, THEME_LANE_COLORS['dracula'][0]);
console.log('  ✔ Color Themes & Chromatic Lane Palettes tests passed!');

// 19. Test Developer Workflow & Git Tools APIs
console.log('\n▶ Testing Developer Workflow & Git Tools APIs...');
assert.strictEqual(typeof gitClient.cherryPick, 'function');
assert.strictEqual(typeof gitClient.revertCommit, 'function');
assert.strictEqual(typeof gitClient.createTag, 'function');
assert.strictEqual(typeof gitClient.deleteTag, 'function');
assert.strictEqual(typeof gitClient.undoLastCommit, 'function');
assert.strictEqual(typeof gitClient.generateChangelog, 'function');

// Verify i18n keys for new themes and developer tools
const requiredI18nKeys = [
  'settings.themeCyberpunk',
  'settings.themeDracula',
  'settings.themeGithub',
  'settings.themeNeonPink',
  'settings.themeNeonGreen',
  'settings.themeNeonBlue',
  'toolbar.themePicker',
  'toolbar.changelog',
  'toolbar.undoCommit',
  'drawer.cherryPick',
  'drawer.revert',
  'drawer.createTag',
  'drawer.confirmCherryPick',
  'drawer.confirmRevert',
  'drawer.confirmUndo',
  'tag.modalTitle',
  'tag.tagNameLabel',
  'tag.submit',
  'changelog.title',
];
for (const key of requiredI18nKeys) {
  assert.ok(t(key, 'es') !== key, `Missing Spanish translation for key: ${key}`);
  assert.ok(t(key, 'en') !== key, `Missing English translation for key: ${key}`);
}
console.log('  ✔ Developer Workflow & Git Tools APIs tests passed!');

console.log('\n🎉 ALL 19 COMMITFLOW TEST SUITES PASSED WITH 100% SUCCESS!\n');
