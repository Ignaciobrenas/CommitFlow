import { GitCommit, GraphNode, GraphRouteLine, IncomingLine, PassingLane } from '../git/types';

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
   * Accurately calculates:
   * 1. Assigned lane for current commit
   * 2. Passing lanes (active branches running straight down through this row)
   * 3. Incoming lines from children above (cubic Bezier curves)
   * 4. Outgoing lines to parents below (cubic Bezier curves & merges)
   * Handles edge cases: empty lists, octopus merges (3+ parents), disconnected roots, shallow clones.
   */
  public static compute(commits: GitCommit[]): GraphNode[] {
    if (!commits || commits.length === 0) {
      return [];
    }

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
      const nodeColor =
        GraphLayout.LANE_COLORS[safeLane % GraphLayout.LANE_COLORS.length];

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
