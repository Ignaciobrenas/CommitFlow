# Privacy & Compliance Policy

**Last Updated:** October 2026

## 1. Zero Telemetry & Privacy by Design
CommitFlow is built with strict **Privacy-First** and **Air-Gapped Compliance** principles:
* **No Telemetry Collected:** CommitFlow does not track, collect, log, or transmit any user behavior, clicks, keystrokes, editor contents, or analytics data.
* **100% Local Git Processing:** All Git operations (`git log`, `git blame`, `git branch`, `diff-tree`, `git stash`, `git rebase`, `git merge`) execute strictly on your local machine using the native Git client within your workspace. No code, file contents, repository metadata, or commit histories are ever sent to external cloud servers.

## 2. Avatar Resolution & Pseudonymization (GDPR Compliant)
CommitFlow provides profile pictures for commit and branch authors:
* **Gravatar:** Author emails are hashed using one-way cryptographic MD5 on your machine before making an HTTPS request (`https://www.gravatar.com/avatar/<hash>`). The raw email address is never transmitted over the network in cleartext.
* **GitHub Noreply:** Author emails formatted as `*@users.noreply.github.com` resolve avatars directly using GitHub's public avatar CDN (`https://avatars.githubusercontent.com/<username>`).
* **Offline / Air-Gapped Fallback:** When network access is unavailable, or when `commitflow.avatars.enabled` is set to `false`, CommitFlow generates dynamic vector SVG initials locally without making any external HTTP/HTTPS calls.

## 3. Configuration & Opt-Out
Enterprise users and privacy-sensitive environments can disable all external network calls entirely through VS Code Settings:
```json
{
  "commitflow.avatars.enabled": false
}
```

## 4. Open Source & License Compliance
* **License:** CommitFlow is licensed under the permissive [MIT License](LICENSE).
* **Dependencies:** CommitFlow has zero runtime `node_modules` dependencies in production. All code is compiled into a lightweight standalone bundle, eliminating third-party security vulnerabilities and GPL viral licensing conflicts.
