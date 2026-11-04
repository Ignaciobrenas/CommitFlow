import * as crypto from 'crypto';
import { PersistenceManager } from '../state/persistenceManager';

export type ApiKeyPermission = 'read' | 'read-write';

export interface ApiKeyMetadata {
  id: string;
  name: string;
  keyPrefix: string;
  hash: string;
  permissions: ApiKeyPermission;
  allowedRepos?: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export interface GeneratedKeyResult {
  plaintextKey: string;
  metadata: ApiKeyMetadata;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private readonly persistence = PersistenceManager.getInstance();
  private readonly SECRET_KEY = 'commitflow.ai_keys.metadata';

  private constructor() {}

  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  public hashKey(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext.trim()).digest('hex');
  }

  public async listKeys(): Promise<ApiKeyMetadata[]> {
    const raw = await this.persistence.getSecret(this.SECRET_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public async generateKey(
    name: string,
    permissions: ApiKeyPermission = 'read',
    allowedRepos?: string[],
    expiresInDays?: number
  ): Promise<GeneratedKeyResult> {
    const rawRandom = crypto.randomBytes(24).toString('hex');
    const plaintextKey = `cf_live_${rawRandom}`;
    const hash = this.hashKey(plaintextKey);
    const keyPrefix = plaintextKey.slice(0, 15) + '...';

    const now = new Date();
    let expiresAt: string | undefined = undefined;
    if (expiresInDays && expiresInDays > 0) {
      const exp = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
      expiresAt = exp.toISOString();
    }

    const metadata: ApiKeyMetadata = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      name: name.trim() || 'AI Assistant',
      keyPrefix,
      hash,
      permissions,
      allowedRepos: allowedRepos && allowedRepos.length > 0 ? allowedRepos : undefined,
      createdAt: now.toISOString(),
      expiresAt,
      revoked: false,
    };

    const keys = await this.listKeys();
    keys.unshift(metadata);
    await this.persistence.storeSecret(this.SECRET_KEY, JSON.stringify(keys));

    return {
      plaintextKey,
      metadata,
    };
  }

  public async revokeKey(id: string): Promise<boolean> {
    const keys = await this.listKeys();
    const item = keys.find((k) => k.id === id);
    if (!item) return false;

    item.revoked = true;
    await this.persistence.storeSecret(this.SECRET_KEY, JSON.stringify(keys));
    return true;
  }

  public async validateKey(
    rawKey: string,
    requiredPermission: ApiKeyPermission = 'read',
    targetRepo?: string
  ): Promise<{ valid: boolean; reason?: string; key?: ApiKeyMetadata }> {
    if (!rawKey) {
      return { valid: false, reason: 'Missing API key' };
    }

    const clean = rawKey.replace(/^Bearer\s+/i, '').trim();
    const targetHash = this.hashKey(clean);
    const keys = await this.listKeys();
    const match = keys.find((k) => k.hash === targetHash);

    if (!match) {
      return { valid: false, reason: 'Invalid API key' };
    }

    if (match.revoked) {
      return { valid: false, reason: 'API key has been revoked' };
    }

    if (match.expiresAt && new Date(match.expiresAt) < new Date()) {
      return { valid: false, reason: 'API key has expired' };
    }

    if (requiredPermission === 'read-write' && match.permissions !== 'read-write') {
      return {
        valid: false,
        reason: 'Permission denied: key has read-only access but operation requires read-write',
      };
    }

    if (targetRepo && match.allowedRepos && match.allowedRepos.length > 0) {
      const allowed = match.allowedRepos.some(
        (r) => targetRepo.startsWith(r) || r.startsWith(targetRepo)
      );
      if (!allowed) {
        return { valid: false, reason: 'API key is not authorized for this repository' };
      }
    }

    match.lastUsedAt = new Date().toISOString();
    await this.persistence.storeSecret(this.SECRET_KEY, JSON.stringify(keys));

    return { valid: true, key: match };
  }
}
