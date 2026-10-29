import { IssueInfo } from '../remotes/types';

export class IssueBranchLinker {
  /**
   * Extracts issue number(s) from a branch name like 'feat/issue-42-login' or 'fix/#108-auth'
   */
  public static extractIssueNumbersFromBranch(branchName: string): number[] {
    if (!branchName) return [];

    const numbers = new Set<number>();
    const cleanBranch = branchName.replace(/^origin\//, '');

    // Pattern 1: explicit prefix like issue-42, issue/42, #42, fix-42, feat-42
    const prefixRegex = /(?:issue|fix|feat|bug|ticket|gh|task)[-_/#](\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = prefixRegex.exec(cleanBranch)) !== null) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) numbers.add(num);
    }

    // Pattern 2: start of branch name number like 42-feature-name or 42/feature
    const leadingRegex = /^(?:[a-zA-Z]+\/)?(\d+)[-_/]/;
    const leadMatch = cleanBranch.match(leadingRegex);
    if (leadMatch) {
      const num = parseInt(leadMatch[1], 10);
      if (!isNaN(num) && num > 0) numbers.add(num);
    }

    // Pattern 3: #123 anywhere
    const hashRegex = /#(\d+)/g;
    while ((match = hashRegex.exec(cleanBranch)) !== null) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) numbers.add(num);
    }

    return Array.from(numbers);
  }

  /**
   * Extracts issue references from commit subjects or bodies: #42, Closes #42, Refs #42
   */
  public static extractIssueNumbersFromCommits(
    commits: Array<{ subject: string; body?: string }>
  ): number[] {
    const numbers = new Set<number>();
    const issueRefRegex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|see)?\s*#(\d+)/gi;

    for (const c of commits) {
      const fullText = `${c.subject} ${c.body || ''}`;
      let match: RegExpExecArray | null;
      while ((match = issueRefRegex.exec(fullText)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) numbers.add(num);
      }
    }

    return Array.from(numbers);
  }

  /**
   * Converts issue title into a standard hyphenated slug
   */
  public static createSlug(text: string, maxLength: number = 40): string {
    const slug = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '')   // Remove special characters
      .trim()
      .replace(/\s+/g, '-')          // Spaces to dashes
      .replace(/-+/g, '-');          // Deduplicate dashes

    return slug.slice(0, maxLength).replace(/-$/, '');
  }

  /**
   * Generates a standardized branch name using a template pattern:
   * e.g. "feat/{id}-{slug}" -> "feat/42-soporte-ssh-en-forgejo"
   */
  public static generateBranchName(
    issue: Pick<IssueInfo, 'number' | 'title' | 'labels'>,
    pattern: string = 'feat/{id}-{slug}'
  ): string {
    const slug = this.createSlug(issue.title);
    const id = String(issue.number);

    // Determine type prefix: fix if has bug label or starts with bug/fix
    let type = 'feat';
    const labels = issue.labels || [];
    const hasBugLabel = labels.some(
      (l) => l.name.toLowerCase().includes('bug') || l.name.toLowerCase().includes('fix')
    );
    if (hasBugLabel || /^(?:bug|fix)/i.test(issue.title)) {
      type = 'fix';
    }

    return pattern
      .replace(/\{type\}/gi, type)
      .replace(/\{id\}/gi, id)
      .replace(/\{number\}/gi, id)
      .replace(/\{slug\}/gi, slug);
  }
}
