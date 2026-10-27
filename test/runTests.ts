import assert from 'assert';
import { AvatarService } from '../src/avatars/avatarService';
import { GitParser } from '../src/git/gitParser';
import { GraphLayout } from '../src/graph/graphLayout';
import { GitContentProvider } from '../src/git/gitContentProvider';
import { LruCache } from '../src/utils/lruCache';
import { GitClient } from '../src/git/gitClient';
import { GitCommit } from '../src/git/types';

console.log('🧪 Starting Branchify Extended Test Suite...\n');

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
assert.strictEqual(diffUri.scheme, 'branchify-revision');
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

// 5. Test GraphLayout DAG
console.log('\n▶ Testing GraphLayout...');
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

console.log('\n🎉 ALL 6 BRANCHIFY TEST SUITES PASSED WITH 100% SUCCESS!\n');
