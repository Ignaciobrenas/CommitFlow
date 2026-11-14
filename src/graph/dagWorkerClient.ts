import { GitCommit, GraphNode } from '../git/types';
import { GraphLayout } from './graphLayout';

export interface MinimapRenderOptions {
  width?: number;
  height?: number;
  selectedIndex?: number;
  viewportStartRatio?: number;
  viewportEndRatio?: number;
}

/**
 * Off-thread DAG layout & OffscreenCanvas rendering engine with synchronous
 * main-thread / Node.js fallback for constrained environments.
 */
export class DagWorkerEngine {
  private static instance: DagWorkerEngine;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<
    number,
    { resolve: (nodes: GraphNode[]) => void; reject: (err: Error) => void }
  >();

  public static getInstance(): DagWorkerEngine {
    if (!DagWorkerEngine.instance) {
      DagWorkerEngine.instance = new DagWorkerEngine();
    }
    return DagWorkerEngine.instance;
  }

  public isWorkerSupported(): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    );
  }

  public isOffscreenCanvasSupported(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * Computes topological DAG layout off the UI thread when Web Workers are available,
   * seamlessly falling back to direct GraphLayout computation in Node/test runtimes.
   */
  public async computeLayoutAsync(commits: GitCommit[], theme: any = 'auto'): Promise<GraphNode[]> {
    if (!this.isWorkerSupported()) {
      return GraphLayout.compute(commits, theme);
    }

    try {
      const worker = this.ensureWorker();
      const id = this.nextRequestId++;
      return await new Promise<GraphNode[]>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        worker.postMessage({ id, commits, theme });
      });
    } catch {
      return GraphLayout.compute(commits, theme);
    }
  }

  /**
   * Renders a condensed branch/lane overview onto a Canvas or OffscreenCanvas.
   */
  public renderMinimap(
    nodes: GraphNode[],
    canvas: HTMLCanvasElement | OffscreenCanvas,
    options: MinimapRenderOptions = {}
  ): void {
    const width = options.width ?? (canvas.width || 120);
    const height = options.height ?? (canvas.height || 320);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = (canvas as any).getContext?.('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (nodes.length === 0) return;

    let maxLane = 1;
    for (const node of nodes) {
      if (node.lane + 1 > maxLane) maxLane = node.lane + 1;
    }

    const total = nodes.length;
    const stepY = height / Math.max(total, 1);
    const laneStepX = Math.max(4, Math.min(12, (width - 16) / Math.max(maxLane, 1)));
    const offsetX = 8;

    for (let i = 0; i < total; i++) {
      const node = nodes[i];
      const y = i * stepY + stepY * 0.5;
      const x = offsetX + node.lane * laneStepX;

      ctx.fillStyle = node.color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, Math.min(3, stepY * 0.45)), 0, Math.PI * 2);
      ctx.fill();

      if (node.commit.refs?.some((r) => r.isHead || r.type === 'head')) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (
      typeof options.viewportStartRatio === 'number' &&
      typeof options.viewportEndRatio === 'number'
    ) {
      const topY = Math.max(0, options.viewportStartRatio * height);
      const bottomY = Math.min(height, options.viewportEndRatio * height);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(0, topY, width, Math.max(6, bottomY - topY));
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, topY + 0.5, width - 1, Math.max(5, bottomY - topY - 1));
    }

    if (typeof options.selectedIndex === 'number' && options.selectedIndex >= 0 && options.selectedIndex < total) {
      const selY = options.selectedIndex * stepY;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, Math.max(0, selY - 1), width, 2);
    }
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const rawFn = GraphLayout.compute.toString().trim();
    const computeMember = /^(async\s+)?function\b|^\(|^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/.test(rawFn)
      ? `compute: ${rawFn}`
      : rawFn;
    const workerScript = `
      const THEME_LANE_COLORS = ${JSON.stringify(GraphLayout.THEME_LANE_COLORS)};
      const GraphLayoutWorker = { THEME_LANE_COLORS, ${computeMember} };
      self.onmessage = function (ev) {
        const { id, commits, theme } = ev.data;
        try {
          const nodes = GraphLayoutWorker.compute(commits, theme);
          self.postMessage({ id, nodes });
        } catch (err) {
          self.postMessage({ id, error: err && err.message ? err.message : String(err) });
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);

    worker.onmessage = (ev: MessageEvent) => {
      const { id, nodes, error } = ev.data || {};
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (error) entry.reject(new Error(error));
      else entry.resolve(nodes);
    };

    worker.onerror = () => {
      for (const [, entry] of this.pending) {
        entry.reject(new Error('DAG Web Worker execution failed'));
      }
      this.pending.clear();
      this.worker = null;
    };

    this.worker = worker;
    return worker;
  }
}
