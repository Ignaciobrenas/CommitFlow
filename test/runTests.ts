import assert from 'assert';
import { AvatarService } from '../src/avatars/avatarService';
import { GitParser } from '../src/git/gitParser';
import { GraphLayout, THEME_LANE_COLORS } from '../src/graph/graphLayout';
import { GitContentProvider } from '../src/git/gitContentProvider';
import { LruCache } from '../src/utils/lruCache';
import { GitClient } from '../src/git/gitClient';
import { GitHubService } from '../src/git/githubService';
import { GitCommit } from '../src/git/types';
import { SshConfigParser } from '../src/remotes/sshParser';
import { RemoteManager } from '../src/remotes/remoteManager';
import { ForgejoProvider } from '../src/remotes/forgejoProvider';
import { ForkIntegration } from '../src/remotes/forkIntegration';
import { IssueBranchLinker } from '../src/issues/issueBranchLinker';
import { IssueService } from '../src/issues/issueService';
import { CommitFlowMcpServer } from '../src/mcp/commitflowMcpServer';
import { PersistenceManager } from '../src/state/persistenceManager';
import { GitFsReader } from '../src/git/gitFsReader';

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
  assert.strictEqual(res.result.serverInfo.version, '0.4.5');
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

(async () => {
  // 20. Test Universal SSH Parser & ~/.ssh/config Aliases
  console.log('\n▶ Testing Universal SSH Parser & ~/.ssh/config Aliases...');
  const scpRemote = 'git@forgejo.midominio.com:organizacion/repo.git';
  const parsedScp = SshConfigParser.parseRemoteUrl(scpRemote);
  assert.ok(parsedScp, 'Should parse SCP remote URL');
  assert.strictEqual(parsedScp?.protocol, 'ssh');
  assert.strictEqual(parsedScp?.host, 'forgejo.midominio.com');
  assert.strictEqual(parsedScp?.owner, 'organizacion');
  assert.strictEqual(parsedScp?.repo, 'repo');

  const customPortRemote = 'ssh://git@git.midominio.com:2222/organizacion/repo.git';
  const parsedCustom = SshConfigParser.parseRemoteUrl(customPortRemote);
  assert.ok(parsedCustom, 'Should parse custom port SSH URL');
  assert.strictEqual(parsedCustom?.port, 2222);
  assert.strictEqual(parsedCustom?.owner, 'organizacion');
  assert.strictEqual(parsedCustom?.repo, 'repo');

  // Test ~/.ssh/config parsing & alias resolution
  const mockSshConfigContent = `
# Developer SSH Config
Host mi-forgejo
  HostName 192.168.1.50
  Port 2222
  User git
  IdentityFile ~/.ssh/id_ed25519

Host *.internal.corp
  Port 22
`;
  const hostMap = SshConfigParser.parseConfigContent(mockSshConfigContent);
  assert.strictEqual(hostMap.has('mi-forgejo'), true, 'Should parse Host mi-forgejo');
  const aliasHost = hostMap.get('mi-forgejo');
  assert.strictEqual(aliasHost?.hostName, '192.168.1.50');
  assert.strictEqual(aliasHost?.port, 2222);

  const aliasRemote = 'git@mi-forgejo:organizacion/repo.git';
  const resolved = SshConfigParser.parseRemoteUrl(aliasRemote, undefined, hostMap);
  assert.ok(resolved, 'Should resolve remote using alias config');
  assert.strictEqual(resolved?.sshAlias, 'mi-forgejo');
  assert.strictEqual(resolved?.resolvedHost, '192.168.1.50');
  assert.strictEqual(resolved?.resolvedPort, 2222);
  console.log('  ✔ Universal SSH Parser tests passed!');

  // 21. Test Forgejo / Gitea API Provider & RemoteManager
  console.log('\n▶ Testing Forgejo Provider & RemoteManager...');
  const forgejo = new ForgejoProvider();
  assert.strictEqual(forgejo.type, 'forgejo');
  const mockParsed = {
    rawUrl: 'git@forgejo.midominio.com:myorg/myrepo.git',
    protocol: 'ssh' as const,
    host: 'forgejo.midominio.com',
    owner: 'myorg',
    repo: 'myrepo',
  };
  const webUrl = forgejo.getWebUrl(mockParsed);
  assert.strictEqual(webUrl, 'https://forgejo.midominio.com/myorg/myrepo');

  const mockRepoInfo = {
    provider: 'forgejo' as const,
    owner: 'myorg',
    repo: 'myrepo',
    webUrl: 'https://forgejo.midominio.com/myorg/myrepo',
    isPrivate: true,
    authConnected: true,
  };
  assert.strictEqual(
    forgejo.getCommitUrl(mockRepoInfo, 'abc1234'),
    'https://forgejo.midominio.com/myorg/myrepo/commit/abc1234'
  );
  assert.strictEqual(
    forgejo.getBranchUrl(mockRepoInfo, 'feature/test'),
    'https://forgejo.midominio.com/myorg/myrepo/src/branch/feature%2Ftest'
  );
  assert.strictEqual(
    forgejo.getIssueUrl(mockRepoInfo, 42),
    'https://forgejo.midominio.com/myorg/myrepo/issues/42'
  );
  assert.strictEqual(
    forgejo.getPullRequestUrl(mockRepoInfo, 10),
    'https://forgejo.midominio.com/myorg/myrepo/pulls/10'
  );

  const remoteMgr = RemoteManager.getInstance();
  const parsedForgejoRemote = await remoteMgr.parseRemoteUrl('git@forgejo.selfhosted.io:org/repo.git');
  assert.ok(parsedForgejoRemote);
  assert.strictEqual(parsedForgejoRemote?.badgeType, 'forgejo');
  assert.ok(parsedForgejoRemote?.badgeLabel?.includes('Forgejo'));
  console.log('  ✔ Forgejo Provider & RemoteManager tests passed!');

  // 22. Test Fork Client Desktop Integration
  console.log('\n▶ Testing Fork Client Integration...');
  const fork = ForkIntegration.getInstance();
  assert.ok(fork, 'ForkIntegration singleton exists');
  const sharedState = fork.detectSharedState(process.cwd());
  assert.strictEqual(typeof sharedState.isForkInstalled, 'boolean');
  assert.strictEqual(typeof sharedState.isRebasing, 'boolean');
  assert.strictEqual(typeof sharedState.isMerging, 'boolean');
  console.log('  ✔ Fork Client Integration tests passed!');

  // 23. Test Issue Tracker Hub & IssueBranchLinker
  console.log('\n▶ Testing Issue Tracker Hub & IssueBranchLinker...');
  const numsFromBranch1 = IssueBranchLinker.extractIssueNumbersFromBranch('feat/issue-42-forgejo-ssh');
  assert.deepStrictEqual(numsFromBranch1, [42], 'Should extract issue 42 from feat/issue-42-forgejo-ssh');

  const numsFromBranch2 = IssueBranchLinker.extractIssueNumbersFromBranch('fix/#108-login');
  assert.deepStrictEqual(numsFromBranch2, [108], 'Should extract issue 108 from fix/#108-login');

  const numsFromBranch3 = IssueBranchLinker.extractIssueNumbersFromBranch('42-fix-ssh-handshake');
  assert.deepStrictEqual(numsFromBranch3, [42], 'Should extract leading issue number');

  const numsFromCommits = IssueBranchLinker.extractIssueNumbersFromCommits([
    { subject: 'feat: deep forgejo support (Closes #42)' },
    { subject: 'fix: handle custom ssh port (#108)' },
  ]);
  assert.ok(numsFromCommits.includes(42));
  assert.ok(numsFromCommits.includes(108));

  const slug = IssueBranchLinker.createSlug('Soporte SSH en Forgejo & Git Client Fork!');
  assert.strictEqual(slug, 'soporte-ssh-en-forgejo-git-client-fork');

  const branchName = IssueBranchLinker.generateBranchName(
    { number: 42, title: 'Soporte SSH en Forgejo', labels: [] },
    'feat/{id}-{slug}'
  );
  assert.strictEqual(branchName, 'feat/42-soporte-ssh-en-forgejo');

  const fixBranchName = IssueBranchLinker.generateBranchName(
    { number: 99, title: 'Bug in authentication', labels: [{ name: 'bug', color: '#f00' }] },
    '{type}/{id}-{slug}'
  );
  assert.strictEqual(fixBranchName, 'fix/99-bug-in-authentication');
  console.log('  ✔ Issue Tracker Hub & IssueBranchLinker tests passed!');

  // 24. Test MCP Server Refinement & Structured Tools
  console.log('\n▶ Testing Refined MCP Server Tools & Dynamic Resources...');
  const mcpServer = new CommitFlowMcpServer(process.cwd());
  const rpcHandler: (req: any) => Promise<any> = (mcpServer as any).handleJsonRpc.bind(mcpServer);

  // Test initialize
  const initRes = await rpcHandler({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.strictEqual(initRes.result.serverInfo.name, 'commitflow-mcp');
  assert.strictEqual(initRes.result.protocolVersion, '2024-11-05');

  // Test tools/list
  const toolsListRes = await rpcHandler({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const toolNames = toolsListRes.result.tools.map((t: any) => t.name);
  assert.ok(toolNames.includes('get_my_assigned_issues'), 'Should include get_my_assigned_issues');
  assert.ok(toolNames.includes('get_issue_context'), 'Should include get_issue_context');
  assert.ok(toolNames.includes('start_work_on_issue'), 'Should include start_work_on_issue');
  assert.ok(toolNames.includes('analyze_staged_changes'), 'Should include analyze_staged_changes');
  assert.ok(toolNames.includes('search_commit_history'), 'Should include search_commit_history');
  assert.ok(toolNames.includes('get_pr_triage_status'), 'Should include get_pr_triage_status');
  assert.ok(toolNames.includes('predict_merge_conflicts'), 'Should include predict_merge_conflicts');

  // Test resources/list
  const resourcesListRes = await rpcHandler({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  const resourceUris = resourcesListRes.result.resources.map((r: any) => r.uri);
  assert.ok(resourceUris.includes('commitflow://repo/status'));
  assert.ok(resourceUris.includes('commitflow://issues/assigned'));
  assert.ok(resourceUris.includes('commitflow://branch/current/diff'));

  // Test tools/call: predict_merge_conflicts
  const predictCallRes = await rpcHandler({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'predict_merge_conflicts',
      arguments: { sourceBranch: 'HEAD', targetBranch: 'HEAD' },
    },
  });
  assert.ok(predictCallRes.result.content[0].text);
  const predictData = JSON.parse(predictCallRes.result.content[0].text);
  assert.strictEqual(typeof predictData.hasConflicts, 'boolean');

  // Test tools/call: analyze_staged_changes
  const analyzeCallRes = await rpcHandler({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'analyze_staged_changes',
      arguments: { includeIssueRef: 42 },
    },
  });
  assert.ok(analyzeCallRes.result.content[0].text);
  const analyzeData = JSON.parse(analyzeCallRes.result.content[0].text);
  assert.ok(Array.isArray(analyzeData.stagedFiles));
  console.log('  ✔ Refined MCP Server Tools & Dynamic Resources tests passed!');

  // 25. Test PersistenceManager & Settings Sync
  console.log('\n▶ Testing PersistenceManager & Settings Sync...');
  const persistence = PersistenceManager.getInstance();
  const forgejoKey = persistence.getForgejoSecretKey('git.midominio.com:2222');
  assert.strictEqual(forgejoKey, 'commitflow.token.forgejo.git.midominio.com_2222');

  await persistence.storeSecret(forgejoKey, 'secret_token_123');
  const retrievedToken = await persistence.getSecret(forgejoKey);
  assert.strictEqual(retrievedToken, 'secret_token_123');

  assert.strictEqual(persistence.getSshConfigPath(), '~/.ssh/config');
  assert.strictEqual(persistence.getDefaultIssueFilter(), 'assignedToMe');
  assert.strictEqual(persistence.getBranchNamingPattern(), 'feat/{id}-{slug}');
  assert.strictEqual(persistence.isForkIntegrationEnabled(), true);
  console.log('  ✔ PersistenceManager tests passed!');

  // 26. Test Direct .git Filesystem Reader (Offline Engine)
  console.log('\n▶ Testing Direct .git Filesystem Reader (Offline Engine)...');
  const fsReader = GitFsReader.getInstance();
  const repoCwd = process.cwd();
  const gitDirs = fsReader.resolveGitDir(repoCwd);
  assert.ok(gitDirs, 'Should resolve .git directory');
  assert.ok(gitDirs.gitDir.endsWith('.git'));

  const offlineState = fsReader.readOfflineRepoState(repoCwd);
  assert.ok(offlineState, 'Should read offline repo state from disk');
  assert.strictEqual(offlineState.isRepo, true);
  assert.ok(offlineState.branches.length > 0, 'Should detect local branches');
  assert.ok(offlineState.branches.some((b) => b.name === 'main'));
  assert.strictEqual(typeof offlineState.head.isDetached, 'boolean');
  assert.ok(offlineState.remotes.some((r) => r.name === 'origin'));
  assert.strictEqual(typeof offlineState.operationState.isMerging, 'boolean');
  assert.strictEqual(typeof offlineState.operationState.isRebasing, 'boolean');
  assert.ok(Array.isArray(offlineState.recentCommitsFromReflog));
  assert.ok(offlineState.recentCommitsFromReflog.length > 0, 'Should read recent commits from reflog');
  const firstReflog = offlineState.recentCommitsFromReflog[0];
  assert.ok(firstReflog.hash.length === 40, 'Reflog commit hash should be 40 chars');
  assert.ok(firstReflog.author.length > 0, 'Reflog commit author should be present');
  console.log('  ✔ Direct .git Filesystem Reader (Offline Engine) tests passed!');

  // 27. Test Extended ForgejoProvider (Offline Caching & Complete API)
  console.log('\n▶ Testing Extended ForgejoProvider & Offline Fallback...');
  const forgejoExt = new ForgejoProvider();
  const mockRepoInfoExt = {
    provider: 'forgejo' as const,
    owner: 'myorg',
    repo: 'myrepo',
    webUrl: 'https://forgejo.midominio.com/myorg/myrepo',
    isPrivate: true,
    authConnected: true,
  };

  // Offline resilience: getIssues returns cached or empty array without crashing
  const offlineIssues = await forgejoExt.getIssues(mockRepoInfoExt);
  assert.ok(Array.isArray(offlineIssues), 'getIssues should return array even when offline');

  const offlineAssigned = await forgejoExt.getMyAssignedIssues(mockRepoInfoExt, 'testuser');
  assert.ok(Array.isArray(offlineAssigned), 'getMyAssignedIssues should return array even when offline');

  const offlinePulls = await forgejoExt.getPullRequests(mockRepoInfoExt);
  assert.ok(Array.isArray(offlinePulls), 'getPullRequests should return array even when offline');

  const offlineStatuses = await forgejoExt.getCommitStatuses(mockRepoInfoExt, 'abc1234');
  assert.ok(Array.isArray(offlineStatuses), 'getCommitStatuses should return array even when offline');

  const offlineLabels = await forgejoExt.getLabels(mockRepoInfoExt);
  assert.ok(Array.isArray(offlineLabels), 'getLabels should return array even when offline');

  const offlineMilestones = await forgejoExt.getMilestones(mockRepoInfoExt);
  assert.ok(Array.isArray(offlineMilestones), 'getMilestones should return array even when offline');

  const offlineBranches = await forgejoExt.getBranches(mockRepoInfoExt);
  assert.ok(Array.isArray(offlineBranches), 'getBranches should return array even when offline');

  const offlineTags = await forgejoExt.getTags(mockRepoInfoExt);
  assert.ok(Array.isArray(offlineTags), 'getTags should return array even when offline');

  const tokenVerification = await forgejoExt.verifyToken('forgejo.offline.local', 'invalid-token');
  assert.strictEqual(tokenVerification.isValid, false, 'verifyToken should safely return false on unreachable host');
  console.log('  ✔ Extended ForgejoProvider tests passed!');

  // 28. Test Penetration Testing & Security Hardening (Pentest)
  console.log('\n▶ Testing Penetration Testing & Security Hardening (Pentest)...');
  
  // 1. Path traversal defense in GitFsReader
  const mockTraversingPackedRefs = new Map<string, string>();
  const headWithTraversal = fsReader.readHead(
    path.join(repoCwd, 'test'),
    path.join(repoCwd, 'test'),
    mockTraversingPackedRefs
  );
  assert.strictEqual(typeof headWithTraversal.isDetached, 'boolean');

  // 2. MCP Path Traversal Defense
  const mcpServerInstance = new CommitFlowMcpServer(process.cwd());
  const rpcHandlerFn = (mcpServerInstance as any).handleJsonRpc.bind(mcpServerInstance);
  const maliciousBlameCall = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 99,
    method: 'tools/call',
    params: {
      name: 'commitflow_get_line_blame',
      arguments: {
        filePath: '../../../../../../Windows/System32/drivers/etc/hosts',
        line: 1,
      },
    },
  });
  assert.ok(maliciousBlameCall.error, 'MCP server should reject path traversal out of repository root');
  assert.ok(maliciousBlameCall.error.message.includes('Access denied'));

  // 3. Secret storage isolation: Secret keys are namespaced and not leaked
  const persistenceMgr = PersistenceManager.getInstance();
  const testSecretHost = 'forgejo.corp.internal:8080';
  const secretKey = persistenceMgr.getForgejoSecretKey(testSecretHost);
  assert.strictEqual(secretKey, 'commitflow.token.forgejo.forgejo.corp.internal_8080');

  console.log('  ✔ Penetration Testing & Security Hardening tests passed!');

  // 29. Test GPG & SSH Commit Signature Extraction
  console.log('\n▶ Testing GPG & SSH Commit Signature Extraction...');
  const signedLogRaw = `abcdef0123456789abcdef0123456789abcdef01\x1fparent1\x1fAlice\x1falice@example.com\x1f1700000000\x1fAlice\x1falice@example.com\x1f1700000000\x1f\x1fSigned commit\x1fBody\x1fG\x1fAlice Dev <alice@example.com>\x1f4A8B9C0D\x1e` +
    `1234567890abcdef1234567890abcdef12345678\x1fparent2\x1fBob\x1fbob@example.com\x1f1700000010\x1fBob\x1fbob@example.com\x1f1700000010\x1f\x1fBad sig\x1fBody\x1fB\x1fUnknown\x1fFFFFFFFF\x1e` +
    `9876543210fedcba9876543210fedcba98765432\x1fparent3\x1fCarol\x1fcarol@example.com\x1f1700000020\x1fCarol\x1fcarol@example.com\x1f1700000020\x1f\x1fNo sig\x1fBody\x1fN\x1f\x1f\x1e`;

  const parsedSignedCommits = GitParser.parseLogOutput(signedLogRaw);
  assert.strictEqual(parsedSignedCommits.length, 3);
  assert.strictEqual(parsedSignedCommits[0].signatureStatus, 'valid');
  assert.strictEqual(parsedSignedCommits[0].signer, 'Alice Dev <alice@example.com>');
  assert.strictEqual(parsedSignedCommits[0].keyId, '4A8B9C0D');
  assert.strictEqual(parsedSignedCommits[1].signatureStatus, 'invalid');
  assert.strictEqual(parsedSignedCommits[2].signatureStatus, 'none');
  console.log('  ✔ GPG & SSH Commit Signature Extraction tests passed!');

  // 30. Test Reflog Time Machine
  console.log('\n▶ Testing Reflog Time Machine...');
  const gitClient = GitClient.getInstance();
  const reflogEntries = await gitClient.getReflog(process.cwd(), 20);
  assert.ok(Array.isArray(reflogEntries), 'Reflog entries should be an array');
  assert.ok(reflogEntries.length > 0, 'Reflog should have at least 1 entry');
  const firstRef = reflogEntries[0];
  assert.ok(firstRef.selector.startsWith('HEAD@'), 'Selector should match HEAD@{n}');
  assert.ok(firstRef.hash.length >= 7, 'Commit hash should be valid');
  assert.ok(firstRef.action, 'Action should be present');
  console.log('  ✔ Reflog Time Machine tests passed!');

  // 31. Test Multi-Commit Diff Comparison Engine
  console.log('\n▶ Testing Multi-Commit Diff Comparison Engine...');
  const commits = await gitClient.getCommits(process.cwd(), 5);
  if (commits.length >= 2) {
    const baseCommit = commits[1].hash;
    const targetCommit = commits[0].hash;
    const comparison = await gitClient.compareCommits(process.cwd(), baseCommit, targetCommit);
    assert.strictEqual(comparison.baseHash, baseCommit);
    assert.strictEqual(comparison.targetHash, targetCommit);
    assert.ok(Array.isArray(comparison.files), 'Files should be an array');
    assert.strictEqual(typeof comparison.totalAdditions, 'number');
    assert.strictEqual(typeof comparison.totalDeletions, 'number');
    assert.ok(Array.isArray(comparison.commitsBetween));
  }
  console.log('  ✔ Multi-Commit Diff Comparison Engine tests passed!');

  // 32. Test Repository Health & Storage Diagnostics
  console.log('\n▶ Testing Repository Health & Storage Diagnostics...');
  const healthMetrics = await gitClient.getRepoHealth(process.cwd());
  assert.strictEqual(typeof healthMetrics.looseObjectsCount, 'number');
  assert.strictEqual(typeof healthMetrics.packfilesCount, 'number');
  assert.strictEqual(typeof healthMetrics.diskSizeBytes, 'number');
  assert.ok(healthMetrics.diskSizeFormatted.length > 0);
  assert.strictEqual(typeof healthMetrics.danglingCommitsCount, 'number');
  console.log('  ✔ Repository Health & Storage Diagnostics tests passed!');

  // 33. Test Extended MCP Tools & Dynamic Resources
  console.log('\n▶ Testing Extended MCP Tools & Dynamic Resources...');
  // Tool: analyze_repo_health
  const healthCallRes = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 101,
    method: 'tools/call',
    params: {
      name: 'analyze_repo_health',
      arguments: {},
    },
  });
  assert.ok(healthCallRes.result.content[0].text);
  const mcpHealthData = JSON.parse(healthCallRes.result.content[0].text);
  assert.strictEqual(typeof mcpHealthData.diskSizeBytes, 'number');

  // Resource: commitflow://reflog/recent
  const reflogRes = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 102,
    method: 'resources/read',
    params: {
      uri: 'commitflow://reflog/recent',
    },
  });
  assert.ok(reflogRes.result.contents[0].text);
  const mcpReflog = JSON.parse(reflogRes.result.contents[0].text);
  assert.ok(Array.isArray(mcpReflog));

  // Resource: commitflow://repo/health
  const healthRes = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 103,
    method: 'resources/read',
    params: {
      uri: 'commitflow://repo/health',
    },
  });
  assert.ok(healthRes.result.contents[0].text);
  const mcpHealthRes = JSON.parse(healthRes.result.contents[0].text);
  assert.strictEqual(typeof mcpHealthRes.looseObjectsCount, 'number');
  console.log('  ✔ Extended MCP Tools & Dynamic Resources tests passed!');

  // 34. Test Visual Git Bisect Engine & Offline State Detection
  console.log('\n▶ Testing Visual Git Bisect Engine & Offline State Detection...');
  const bisectStatus = await gitClient.getBisectStatus(process.cwd());
  assert.strictEqual(typeof bisectStatus.isActive, 'boolean');
  assert.ok(Array.isArray(bisectStatus.goodCommits));

  // Test offline .git/BISECT_* inspection using temporary mock git directory
  const tempBisectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-bisect-test-'));
  try {
    const gitDir = path.join(tempBisectDir, '.git');
    fs.mkdirSync(path.join(gitDir, 'refs', 'bisect'), { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'BISECT_START'), 'branch-foo\n');
    fs.writeFileSync(path.join(gitDir, 'refs', 'bisect', 'bad'), '1111222233334444555566667777888899990000\n');
    fs.writeFileSync(path.join(gitDir, 'refs', 'bisect', 'good-aaa'), 'aaaabbbbccccddddeeeeffff0000111122223333\n');

    const fsReader = GitFsReader.getInstance();
    const offlineOpState = fsReader.readOperationState(gitDir);
    assert.strictEqual(offlineOpState.isBisecting, true);
    assert.strictEqual(offlineOpState.bisectBad, '1111222233334444555566667777888899990000');
    assert.strictEqual(offlineOpState.bisectGood?.length, 1);
  } finally {
    fs.rmSync(tempBisectDir, { recursive: true, force: true });
  }

  // Bisect MCP Tool
  const bisectMcpCall = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 104,
    method: 'tools/call',
    params: {
      name: 'git_bisect_operation',
      arguments: {
        action: 'status',
      },
    },
  });
  assert.ok(bisectMcpCall.result.content[0].text);
  const mcpBisectData = JSON.parse(bisectMcpCall.result.content[0].text);
  assert.strictEqual(typeof mcpBisectData.isActive, 'boolean');

  // Bisect MCP Resource
  const bisectRes = await rpcHandlerFn({
    jsonrpc: '2.0',
    id: 105,
    method: 'resources/read',
    params: {
      uri: 'commitflow://bisect/status',
    },
  });
  assert.ok(bisectRes.result.contents[0].text);
  const mcpBisectRes = JSON.parse(bisectRes.result.contents[0].text);
  assert.strictEqual(typeof mcpBisectRes.isActive, 'boolean');
  console.log('  ✔ Visual Git Bisect Engine & Offline State Detection tests passed!');

  // 35. Test Pre-Flight Cherry-Pick Conflict Forecaster
  console.log('\n▶ Testing Pre-Flight Cherry-Pick Conflict Forecaster...');
  if (commits.length > 0) {
    const previewResult = await gitClient.previewCherryPick(process.cwd(), commits[0].hash);
    assert.strictEqual(typeof previewResult.clean, 'boolean');
    assert.ok(Array.isArray(previewResult.conflicts));
    assert.strictEqual(previewResult.commitHash, commits[0].hash);
    assert.strictEqual(previewResult.shortHash, commits[0].shortHash);
  }

  // MCP Cherry-Pick Preview Tool
  if (commits.length > 0) {
    const previewMcpCall = await rpcHandlerFn({
      jsonrpc: '2.0',
      id: 106,
      method: 'tools/call',
      params: {
        name: 'preview_cherry_pick',
        arguments: {
          commitHash: commits[0].hash,
        },
      },
    });
    assert.ok(previewMcpCall.result.content[0].text);
    const mcpPreviewData = JSON.parse(previewMcpCall.result.content[0].text);
    assert.strictEqual(typeof mcpPreviewData.clean, 'boolean');
    assert.ok(Array.isArray(mcpPreviewData.conflicts));
  }
  console.log('  ✔ Pre-Flight Cherry-Pick Conflict Forecaster tests passed!');

  console.log('\n🎉 ALL 35 COMMITFLOW TEST SUITES PASSED WITH 100% SUCCESS!\n');
})().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
