const { execSync } = require('child_process');

try {
  const diffs = execSync('git log -p -n 100', { maxBuffer: 20 * 1024 * 1024 }).toString();
  const secretPatterns = [
    { name: 'GitHub Personal Access Token', regex: /ghp_[a-zA-Z0-9]{36}/g },
    { name: 'GitHub Fine-grained PAT', regex: /github_pat_[a-zA-Z0-9_]{82}/g },
    { name: 'GitLab Personal Access Token', regex: /glpat-[a-zA-Z0-9\-]{20,}/g },
    { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
    { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { name: 'Hardcoded Bearer Token', regex: /bearer\s+[a-zA-Z0-9_\-\.]{35,}/gi }
  ];

  let totalMatches = 0;
  secretPatterns.forEach(({ name, regex }) => {
    const matches = diffs.match(regex);
    if (matches) {
      console.warn(`[WARNING] Pattern match for ${name}: ${matches.length} occurrences`);
      totalMatches += matches.length;
    }
  });

  if (totalMatches === 0) {
    console.log('Secret audit clean: 0 credentials or private tokens found in git history.');
  } else {
    process.exit(1);
  }
} catch (err) {
  console.error('Scan error:', err.message);
  process.exit(1);
}
