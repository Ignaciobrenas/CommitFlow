import * as fs from 'fs';
import * as path from 'path';

export const CONVENTIONAL_COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'chore',
  'ci',
] as const;

export type ConventionalCommitType = (typeof CONVENTIONAL_COMMIT_TYPES)[number];

export interface ConventionalCommitParts {
  type: string;
  scope?: string;
  breaking?: boolean;
  subject: string;
  body?: string;
  footer?: string;
}

export interface IssueSuggestionItem {
  number: number;
  title: string;
  state?: string;
}

/**
 * Formats structured Conventional Commit fields into a standard Git commit message.
 */
export function formatConventionalCommit(parts: ConventionalCommitParts): string {
  const cleanType = (parts.type || 'feat').trim().toLowerCase() || 'feat';
  const cleanScope = parts.scope ? parts.scope.trim().replace(/[()\r\n]/g, '') : '';
  const cleanSubject = (parts.subject || '').trim().replace(/\r?\n/g, ' ');
  const bang = parts.breaking ? '!' : '';
  const scopeSegment = cleanScope ? `(${cleanScope})` : '';

  const header = `${cleanType}${scopeSegment}${bang}: ${cleanSubject}`;
  const sections: string[] = [header];

  const cleanBody = parts.body ? parts.body.trim() : '';
  if (cleanBody) {
    sections.push(cleanBody);
  }

  let cleanFooter = parts.footer ? parts.footer.trim() : '';
  if (parts.breaking && !/BREAKING CHANGE:/i.test(cleanFooter)) {
    const breakingNote = `BREAKING CHANGE: ${cleanSubject || 'introduces breaking changes'}`;
    cleanFooter = cleanFooter ? `${cleanFooter}\n${breakingNote}` : breakingNote;
  }
  if (cleanFooter) {
    sections.push(cleanFooter);
  }

  return sections.join('\n\n');
}

/**
 * Parses a Conventional Commit string back into its structured parts if it matches the spec.
 */
export function parseConventionalCommit(message: string): ConventionalCommitParts | null {
  const normalized = (message || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const firstNewline = normalized.indexOf('\n');
  const header = firstNewline === -1 ? normalized : normalized.slice(0, firstNewline);
  const rest = firstNewline === -1 ? '' : normalized.slice(firstNewline + 1).trim();

  const match = header.match(/^([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!match) return null;

  const hasBreakingFooter = /BREAKING CHANGE:/i.test(rest);
  return {
    type: match[1].toLowerCase(),
    scope: match[2]?.trim() || undefined,
    breaking: Boolean(match[3]) || hasBreakingFooter,
    subject: match[4].trim(),
    body: rest || undefined,
  };
}

/**
 * Strips `#` comment lines from a `.gitmessage` template while collapsing extra blank lines.
 */
export function stripGitTemplateComments(rawTemplate: string): string {
  const lines = rawTemplate
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'));

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Reads a repository's commit template from `.gitmessage`, `.git/.gitmessage`, or `.github/COMMIT_TEMPLATE`.
 */
export function readGitMessageTemplate(repoRoot: string): string | null {
  if (!repoRoot) return null;

  const candidatePaths = [
    path.join(repoRoot, '.gitmessage'),
    path.join(repoRoot, '.gitmessage.txt'),
    path.join(repoRoot, '.git', '.gitmessage'),
    path.join(repoRoot, '.github', 'COMMIT_TEMPLATE'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const cleaned = stripGitTemplateComments(raw);
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    } catch {
      // Ignore unreadable template files and continue fallback chain
    }
  }

  return null;
}

/**
 * Filters repository issues for `#issue` inline autocomplete in the commit builder.
 */
export function filterIssueSuggestions(
  issues: IssueSuggestionItem[],
  query: string,
  limit = 8
): IssueSuggestionItem[] {
  const normalizedQuery = (query || '').replace(/^#/, '').trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(25, limit));

  const sorted = [...issues].sort((a, b) => {
    const aClosed = a.state === 'closed' ? 1 : 0;
    const bClosed = b.state === 'closed' ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;
    return b.number - a.number;
  });

  if (!normalizedQuery) {
    return sorted.slice(0, safeLimit);
  }

  return sorted
    .filter(
      (issue) =>
        String(issue.number).includes(normalizedQuery) ||
        (issue.title || '').toLowerCase().includes(normalizedQuery)
    )
    .slice(0, safeLimit);
}
