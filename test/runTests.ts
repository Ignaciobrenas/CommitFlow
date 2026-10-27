import assert from 'assert';
import { AvatarService } from '../src/avatars/avatarService';
import { GitParser } from '../src/git/gitParser';
import { GraphLayout } from '../src/graph/graphLayout';
import { GitCommit } from '../src/git/types';

console.log('🧪 Starting Branchify Test Suite...\n');

// 1. Test AvatarService
console.log('▶ Testing AvatarService...');
const avatarService = AvatarService.getInstance();

// Gravatar MD5
const gravatarUrl = avatarService.getAvatarUrl('Ignacio', 'user@example.com');
assert.ok(
  gravatarUrl.startsWith('https://www.gravatar.com/avatar/'),
  'Should generate Gravatar URL'
);

// GitHub noreply email resolution
const ghUrl = avatarService.getAvatarUrl(
  'Ignacio',
  '12345+ignaciobrenas@users.noreply.github.com'
);
assert.strictEqual(
  ghUrl,
  'https://avatars.githubusercontent.com/ignaciobrenas',
  'Should resolve GitHub username from noreply email'
);

// Fallback SVG initials
const initialsSvg = avatarService.generateInitialsSvg('John Doe');
assert.ok(
  initialsSvg.startsWith('data:image/svg+xml;utf8,'),
  'Should produce SVG data URI'
);
assert.ok(initialsSvg.includes('JD'), 'Should contain initials JD');
console.log('  ✔ AvatarService tests passed!');

// 2. Test GitParser
console.log('\n▶ Testing GitParser...');

// Relative time
const now = new Date();
assert.strictEqual(GitParser.formatRelativeTime(now), 'just now');

const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
assert.strictEqual(GitParser.formatRelativeTime(twoHoursAgo), '2h ago');

const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
assert.strictEqual(GitParser.formatRelativeTime(threeDaysAgo), '3d ago');

// Ref parser
const refs = GitParser.parseRefs('HEAD -> main, tag: v1.0.0, origin/main');
assert.strictEqual(refs.length, 3);
assert.strictEqual(refs[0].name, 'main');
assert.strictEqual(refs[0].isHead, true);
assert.strictEqual(refs[1].name, 'v1.0.0');
assert.strictEqual(refs[1].type, 'tag');
assert.strictEqual(refs[2].type, 'remote-branch');

// Log output parser
const sampleLog = `a1b2c3d4e5f6\x1fparent123\x1fIgnacio\x1fignacio@test.com\x1f1700000000\x1fIgnacio\x1fignacio@test.com\x1f1700000000\x1fHEAD -> main\x1ffeat: initial commit\x1fDetailed commit body\x1e`;
const commits = GitParser.parseLogOutput(sampleLog);
assert.strictEqual(commits.length, 1);
assert.strictEqual(commits[0].shortHash, 'a1b2c3d');
assert.strictEqual(commits[0].author.name, 'Ignacio');
assert.strictEqual(commits[0].subject, 'feat: initial commit');
assert.strictEqual(commits[0].refs[0].name, 'main');
console.log('  ✔ GitParser tests passed!');

// 3. Test GraphLayout DAG lane assignment
console.log('\n▶ Testing GraphLayout...');
const mockCommits: GitCommit[] = [
  {
    hash: 'commit3',
    shortHash: 'c3',
    parentHashes: ['commit2', 'commit1-branch'],
    author: { name: 'Dev', email: '', date: new Date(), relativeTime: '1h ago', avatarUrl: '' },
    committer: { name: 'Dev', email: '', date: new Date(), relativeTime: '1h ago', avatarUrl: '' },
    subject: 'Merge branch feature',
    body: '',
    refs: [{ name: 'main', type: 'branch', isHead: true }],
  },
  {
    hash: 'commit1-branch',
    shortHash: 'c1b',
    parentHashes: ['commit1'],
    author: { name: 'Dev', email: '', date: new Date(), relativeTime: '2h ago', avatarUrl: '' },
    committer: { name: 'Dev', email: '', date: new Date(), relativeTime: '2h ago', avatarUrl: '' },
    subject: 'Feature commit',
    body: '',
    refs: [{ name: 'feature', type: 'branch', isHead: false }],
  },
  {
    hash: 'commit2',
    shortHash: 'c2',
    parentHashes: ['commit1'],
    author: { name: 'Dev', email: '', date: new Date(), relativeTime: '3h ago', avatarUrl: '' },
    committer: { name: 'Dev', email: '', date: new Date(), relativeTime: '3h ago', avatarUrl: '' },
    subject: 'Direct commit on main',
    body: '',
    refs: [],
  },
  {
    hash: 'commit1',
    shortHash: 'c1',
    parentHashes: [],
    author: { name: 'Dev', email: '', date: new Date(), relativeTime: '4h ago', avatarUrl: '' },
    committer: { name: 'Dev', email: '', date: new Date(), relativeTime: '4h ago', avatarUrl: '' },
    subject: 'Root commit',
    body: '',
    refs: [],
  },
];

const nodes = GraphLayout.compute(mockCommits);
assert.strictEqual(nodes.length, 4);
assert.strictEqual(nodes[0].lane, 0, 'Merge commit should be on lane 0');
assert.ok(nodes[0].lines.length >= 2, 'Merge commit should have multiple route lines');
assert.ok(nodes[0].lines.some((l) => l.isMerge), 'Should have isMerge route line');
console.log('  ✔ GraphLayout tests passed!');

console.log('\n🎉 ALL BRANCHIFY UNIT TESTS PASSED WITH 100% SUCCESS!\n');
