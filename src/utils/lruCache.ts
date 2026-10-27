export class LruCache<K, V> {
  private readonly map = new Map<K, { value: V; expiresAt?: number }>();

  constructor(
    private readonly maxCapacity: number = 200,
    private readonly defaultTtlMs?: number
  ) {}

  public get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh position to mark as recently used
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  public set(key: K, value: V, customTtlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxCapacity) {
      // Evict least recently used (first key in iteration)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const ttl = customTtlMs ?? this.defaultTtlMs;
    const expiresAt = ttl ? Date.now() + ttl : undefined;

    this.map.set(key, { value, expiresAt });
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: K): boolean {
    return this.map.delete(key);
  }

  public clear(): void {
    this.map.clear();
  }

  public get size(): number {
    return this.map.size;
  }

  /**
   * Clears entries matching a prefix predicate (e.g. all entries for a specific file path)
   */
  public deleteMatching(predicate: (key: K) => boolean): void {
    for (const key of this.map.keys()) {
      if (predicate(key)) {
        this.map.delete(key);
      }
    }
  }
}
