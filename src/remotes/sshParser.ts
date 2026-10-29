import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ParsedRemote, SshHostConfig } from './types';

export class SshConfigParser {
  /**
   * Resolves '~' or environment variables in config path
   */
  public static resolvePath(filePath: string): string {
    if (!filePath) return '';
    if (filePath.startsWith('~/') || filePath === '~') {
      return path.join(os.homedir(), filePath.slice(1));
    }
    if (process.platform === 'win32' && filePath.startsWith('~\\')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return path.resolve(filePath);
  }

  /**
   * Parses an OpenSSH config file (e.g. ~/.ssh/config)
   */
  public static parseConfigFile(configPath: string): Map<string, SshHostConfig> {
    const resolvedPath = this.resolvePath(configPath);
    const hostMap = new Map<string, SshHostConfig>();

    if (!fs.existsSync(resolvedPath)) {
      return hostMap;
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      return this.parseConfigContent(content);
    } catch (err) {
      console.warn(`[CommitFlow] Could not read SSH config at ${resolvedPath}:`, err);
      return hostMap;
    }
  }

  /**
   * Parses string content of ssh config
   */
  public static parseConfigContent(content: string): Map<string, SshHostConfig> {
    const hostMap = new Map<string, SshHostConfig>();
    const lines = content.split(/\r?\n/);
    let currentHosts: string[] = [];
    let currentConfig: Partial<SshHostConfig> = {};

    const commitCurrent = () => {
      if (currentHosts.length > 0 && Object.keys(currentConfig).length > 0) {
        for (const h of currentHosts) {
          // Skip wildcard global settings
          if (h !== '*') {
            hostMap.set(h.toLowerCase(), {
              host: h,
              ...currentConfig,
            });
          }
        }
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Matches: Key Value or Key = Value
      const match = line.match(/^(\w+)(?:\s*=\s*|\s+)(.+)$/);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const value = match[2].trim().replace(/^["']|["']$/g, '');

      if (key === 'host') {
        commitCurrent();
        currentHosts = value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
        currentConfig = {};
      } else if (key === 'hostname') {
        currentConfig.hostName = value;
      } else if (key === 'port') {
        const p = parseInt(value, 10);
        if (!isNaN(p)) currentConfig.port = p;
      } else if (key === 'user') {
        currentConfig.user = value;
      } else if (key === 'identityfile') {
        currentConfig.identityFile = this.resolvePath(value);
      }
    }

    commitCurrent();
    return hostMap;
  }

  /**
   * Normalizes and parses any Git remote URL (SSH SCP, SSH URL, custom port, HTTP/S)
   * and optionally resolves aliases using the provided or default ~/.ssh/config.
   */
  public static parseRemoteUrl(
    remoteUrl: string,
    sshConfigPath: string = '~/.ssh/config',
    inMemoryConfig?: Map<string, SshHostConfig>
  ): ParsedRemote | null {
    if (!remoteUrl || !remoteUrl.trim()) {
      return null;
    }

    const clean = remoteUrl.trim();
    let protocol: 'ssh' | 'https' | 'http' | 'file' = 'ssh';
    let host = '';
    let port: number | undefined;
    let owner = '';
    let repo = '';

    // 1. SSH URL with scheme: ssh://[user@]host[:port]/owner/repo[.git]
    const sshUrlMatch = clean.match(/^ssh:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
    if (sshUrlMatch) {
      protocol = 'ssh';
      host = sshUrlMatch[2];
      if (sshUrlMatch[3]) port = parseInt(sshUrlMatch[3], 10);
      owner = sshUrlMatch[4];
      repo = sshUrlMatch[5];
    }

    // 2. HTTP/HTTPS: http(s)://[user@]host[:port]/owner/repo[.git]
    if (!host) {
      const httpMatch = clean.match(/^(https?):\/\/(?:[^@]+@)?([^:/]+)(?::(\d+))?\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
      if (httpMatch) {
        protocol = httpMatch[1].toLowerCase() as 'http' | 'https';
        host = httpMatch[2];
        if (httpMatch[3]) port = parseInt(httpMatch[3], 10);
        owner = httpMatch[4];
        repo = httpMatch[5];
      }
    }

    // 3. Standard SCP-like SSH syntax: [user@]host:owner/repo[.git] or host:port/owner/repo
    if (!host) {
      const scpMatch = clean.match(/^(?:([a-zA-Z0-9_.-]+)@)?([^:]+):(?:\/?(?:(\d+)\/)?)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
      if (scpMatch) {
        protocol = 'ssh';
        host = scpMatch[2];
        if (scpMatch[3]) port = parseInt(scpMatch[3], 10);
        owner = scpMatch[4];
        repo = scpMatch[5];
      }
    }

    // 4. Fallback for nested subgroups or complex paths: e.g. git@host:group/sub/repo.git
    if (!host) {
      const genericMatch = clean.match(/^(?:(?:[a-zA-Z0-9_.-]+@|(?:https?|ssh):\/\/)(?:[^@]+@)?)([^:/]+)(?::(\d+))?[:/](.+?)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i);
      if (genericMatch) {
        protocol = clean.startsWith('http://') ? 'http' : clean.startsWith('https://') ? 'https' : 'ssh';
        host = genericMatch[1];
        if (genericMatch[2]) port = parseInt(genericMatch[2], 10);
        owner = genericMatch[3];
        repo = genericMatch[4];
      }
    }

    if (!host || !repo) {
      return null;
    }

    // Resolve SSH Alias via ~/.ssh/config
    const sshHosts = inMemoryConfig || this.parseConfigFile(sshConfigPath);
    const aliasConfig = sshHosts.get(host.toLowerCase());

    const result: ParsedRemote = {
      rawUrl: clean,
      protocol,
      host,
      port,
      owner,
      repo,
    };

    if (aliasConfig) {
      result.sshAlias = host;
      if (aliasConfig.hostName) {
        result.resolvedHost = aliasConfig.hostName;
      }
      if (aliasConfig.port) {
        result.resolvedPort = aliasConfig.port;
      }
      if (aliasConfig.identityFile) {
        result.identityFile = aliasConfig.identityFile;
      }
    }

    return result;
  }
}
