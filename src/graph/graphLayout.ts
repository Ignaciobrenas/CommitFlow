import { GitCommit, GraphNode, GraphRouteLine, IncomingLine, PassingLane } from '../git/types';

export class GraphLayout {
  // Theme-specific vibrant chromatic lane palettes
  public static readonly THEME_LANE_COLORS: Record<string, string[]> = {
    cyberpunk: ['#ffe600', '#d946ef', '#00f0ff', '#a855f7', '#00ffcc', '#ff0055', '#ff9900'],
    dracula: ['#bd93f9', '#8be9fd', '#50fa7b', '#ff79c6', '#ffb86c', '#f1fa8c', '#ff5555'],
    github: ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f85149', '#79c0ff', '#56d364'],
    'neon-pink': ['#ff2a85', '#00f5d4', '#fee440', '#c084fc', '#00bbf9', '#ff007f', '#f15bb5'],
    'neon-green': ['#00ff66', '#a3e635', '#00e676', '#38bdf8', '#34d399', '#6ee7b7', '#a7f3d0'],
    'neon-blue': ['#00e5ff', '#38bdf8', '#3b82f6', '#6366f1', '#06b6d4', '#93c5fd', '#00f5d4'],
    light: ['#0969da', '#1a7f37', '#9a6700', '#8250df', '#cf222e', '#0550ae', '#116329'],
    dark: [
      '#38bdf8',
      '#10b981',
      '#f59e0b',
      '#ec4899',
      '#8b5cf6',
      '#06b6d4',
      '#f43f5e',
      '#a855f7',
      '#14b8a6',
      '#eab308',
    ],
    default: [
      '#38bdf8', // Electric Cyan
      '#10b981', // Neon Emerald
      '#f59e0b', // Radiant Amber
      '#ec4899', // Hot Pink
      '#8b5cf6', // Electric Violet
      '#06b6d4', // Cyber Teal
      '#f43f5e', // Glitch Rose
      '#a855f7', // Vivid Purple
      '#14b8a6', // Jade Mint
      '#eab308', // Sun Gold
    ],
  };

  public static readonly LANE_COLORS: string[] = GraphLayout.THEME_LANE_COLORS.default;

  /**
   * Computes topological lanes and connecting route lines for a list of commits.
   */
  public static compute(commits: GitCommit[], theme?: string): GraphNode[] {
    if (!commits || commits.length === 0) {
      return [];
    }

    const palette = (theme && GraphLayout.THEME_LANE_COLORS[theme]) || GraphLayout.LANE_COLORS;
    const nodes: GraphNode[] = [];
    const activeLanes: (string | null)[] = []; // maps lane index -> expected parent commit hash
    const incomingMap = new Map<string, { fromLane: number; color: string }[]>();

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      let assignedLane = -1;

      // 1. Check if this commit was expected in an active lane
      for (let l = 0; l < activeLanes.length; l++) {
        if (activeLanes[l] === commit.hash) {
          assignedLane = l;
          activeLanes[l] = null;
          break;
        }
      }

      // If not found in active lanes, assign to the first empty lane or push a new lane
      if (assignedLane === -1) {
        assignedLane = activeLanes.indexOf(null);
        if (assignedLane === -1) {
          assignedLane = activeLanes.length;
          activeLanes.push(null);
        }
      }

      const safeLane = Math.max(0, assignedLane);
      const nodeColor = palette[safeLane % palette.length];

      // 2. Identify passing lanes at this exact row
      // (any other active lane whose expected parent is below this row)
      const passingLanes: PassingLane[] = [];
      for (let l = 0; l < activeLanes.length; l++) {
        if (l !== safeLane && activeLanes[l] !== null) {
          passingLanes.push({
            lane: l,
            color: GraphLayout.LANE_COLORS[l % GraphLayout.LANE_COLORS.length],
          });
        }
      }

      // 3. Compute incoming lines from child commits above
      const incoming: IncomingLine[] = [];
      const registeredIncoming = incomingMap.get(commit.hash);
      if (registeredIncoming && registeredIncoming.length > 0) {
        registeredIncoming.forEach((inc) => {
          incoming.push({
            fromLane: inc.fromLane,
            toLane: safeLane,
            color: inc.color,
          });
        });
        incomingMap.delete(commit.hash);
      }

      // 4. Compute outgoing lines to parents below
      const lines: GraphRouteLine[] = [];
      const parents = commit.parentHashes || [];

      if (parents.length > 0) {
        // First parent continues on the current lane
        const firstParent = parents[0];
        activeLanes[safeLane] = firstParent;

        const firstParentColor = nodeColor;
        lines.push({
          fromLane: safeLane,
          toLane: safeLane,
          toHash: firstParent,
          isMerge: false,
          isFork: false,
          color: firstParentColor,
        });

        // Register incoming connection for firstParent
        if (!incomingMap.has(firstParent)) {
          incomingMap.set(firstParent, []);
        }
        incomingMap.get(firstParent)!.push({
          fromLane: safeLane,
          color: firstParentColor,
        });

        // Additional parents (Octopus / multi-parent merges)
        for (let p = 1; p < parents.length; p++) {
          const mergeParent = parents[p];
          let parentLane = activeLanes.indexOf(mergeParent);

          if (parentLane === -1) {
            parentLane = activeLanes.indexOf(null);
            if (parentLane === -1) {
              parentLane = activeLanes.length;
              activeLanes.push(mergeParent);
            } else {
              activeLanes[parentLane] = mergeParent;
            }
          }

          const mergeColor =
            GraphLayout.LANE_COLORS[parentLane % GraphLayout.LANE_COLORS.length];

          lines.push({
            fromLane: safeLane,
            toLane: parentLane,
            toHash: mergeParent,
            isMerge: true,
            isFork: false,
            color: mergeColor,
          });

          if (!incomingMap.has(mergeParent)) {
            incomingMap.set(mergeParent, []);
          }
          incomingMap.get(mergeParent)!.push({
            fromLane: parentLane,
            color: mergeColor,
          });
        }
      } else {
        // Root commit (no parents) frees up the lane
        activeLanes[safeLane] = null;
      }

      // Trim trailing nulls from activeLanes to prevent unbound lane expansion
      while (
        activeLanes.length > 0 &&
        activeLanes[activeLanes.length - 1] === null
      ) {
        activeLanes.pop();
      }

      nodes.push({
        commit,
        lane: safeLane,
        color: nodeColor,
        lines,
        passingLanes,
        incomingLines: incoming,
      });
    }

    return nodes;
  }
}

export const THEME_LANE_COLORS = GraphLayout.THEME_LANE_COLORS;
