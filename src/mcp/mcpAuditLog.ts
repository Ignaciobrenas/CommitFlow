export interface McpAuditLogEntry {
  timestamp: string;
  transport: 'http' | 'stdio';
  method: string;
  path: string;
  status: number;
  rpcMethod?: string;
  keyId?: string;
  keyName?: string;
  clientIp?: string;
  durationMs: number;
  reason?: string;
}

/**
 * Bounded in-memory ring buffer storing recent MCP security and RPC audit events.
 */
export class McpAuditRingBuffer {
  private readonly entries: McpAuditLogEntry[] = [];

  constructor(private readonly capacity: number = 500) {}

  public record(entry: McpAuditLogEntry): void {
    if (this.entries.length >= this.capacity) {
      this.entries.shift();
    }
    this.entries.push(entry);
  }

  public getAll(): McpAuditLogEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries.length = 0;
  }
}

export const sharedMcpAuditLog = new McpAuditRingBuffer(500);
