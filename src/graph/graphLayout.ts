import { GitCommit, GraphNode, GraphRouteLine } from '../git/types';

export class GraphLayout {
  // Vibrant, high-contrast accessible color palette for branch lanes
  public static readonly LANE_COLORS: string[] = [
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
  ];

  /**
   * Computes topological lanes and connecting route lines for a list of commits.
   * Handles edge cases: empty lists, octopus merges (3+ parents), disconnected roots, shallow clones.
   */
  public static compute(commits: GitCommit[]): GraphNode[] {
    if (!commits || commits.length === 0) {
      return [];
    }

    const nodes: GraphNode[] = [];
    const activeLanes: (string | null)[] = []; // maps lane index -> expected parent commit hash
    const knownHashes = new Set(commits.map((c) => c.hash));

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      let assignedLane = -1;

      // Check if this commit was expected in an active lane
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

      const lines: GraphRouteLine[] = [];
      const parents = commit.parentHashes || [];

      if (parents.length > 0) {
        // First parent continues on the current lane
        const firstParent = parents[0];
        activeLanes[assignedLane] = firstParent;

        lines.push({
          fromLane: assignedLane,
          toLane: assignedLane,
          toHash: firstParent,
          isMerge: false,
          isFork: false,
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

          lines.push({
            fromLane: assignedLane,
            toLane: parentLane,
            toHash: mergeParent,
            isMerge: true,
            isFork: false,
          });
        }
      } else {
        // Root commit (no parents) frees up the lane
        activeLanes[assignedLane] = null;
      }

      // Trim trailing nulls from activeLanes to prevent unbound lane expansion
      while (
        activeLanes.length > 0 &&
        activeLanes[activeLanes.length - 1] === null
      ) {
        activeLanes.pop();
      }

      // Ensure lane is never negative
      const safeLane = Math.max(0, assignedLane);
      const color =
        GraphLayout.LANE_COLORS[safeLane % GraphLayout.LANE_COLORS.length];

      nodes.push({
        commit,
        lane: safeLane,
        color,
        lines,
      });
    }

    return nodes;
  }
}
