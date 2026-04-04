// Fence collision: AABB colliders generated from platform adjacency
import { PLATFORMS, type Platform } from './data';

export interface FenceCollider {
  x: number; z: number;
  hw: number; hd: number; // half-width, half-depth
  top: number;            // fence top Y
}

// --- Adjacency detection (shared with terrain.ts fence visuals) ---

const ADJ_THRESHOLD = 5.0;

export function isEdgeConnected(
  ex: number, ez: number,
  axis: 'x' | 'z', dir: number,
  self: Platform,
): boolean {
  for (const q of PLATFORMS) {
    if (q === self || q.h <= 0) continue;
    if (axis === 'x') {
      const qEdge = dir > 0 ? q.x - q.w / 2 : q.x + q.w / 2;
      const pEdge = self.x + dir * self.w / 2;
      if (Math.abs(qEdge - pEdge) < ADJ_THRESHOLD &&
          ez >= q.z - q.d / 2 - 1.5 && ez <= q.z + q.d / 2 + 1.5) return true;
    } else {
      const qEdge = dir > 0 ? q.z - q.d / 2 : q.z + q.d / 2;
      const pEdge = self.z + dir * self.d / 2;
      if (Math.abs(qEdge - pEdge) < ADJ_THRESHOLD &&
          ex >= q.x - q.w / 2 - 1.5 && ex <= q.x + q.w / 2 + 1.5) return true;
    }
  }
  return false;
}

// --- Collider generation (runs once at module load) ---

function computeColliders(): FenceCollider[] {
  const STEP = 1.15;
  const THICK = 0.25;
  const colliders: FenceCollider[] = [];

  function closeSeg(
    start: number, end: number,
    runsZ: boolean, edgePos: number, fenceTop: number,
    axis: 'x' | 'z', dir: number, p: Platform,
  ): void {
    const halfLen = (end - start) / 2 + 0.15;
    const mid = (start + end) / 2;
    if (runsZ) {
      colliders.push({ x: p.x + dir * (p.w / 2 + 0.05), z: mid, hw: THICK, hd: halfLen, top: fenceTop });
    } else {
      colliders.push({ x: mid, z: p.z + dir * (p.d / 2 + 0.05), hw: halfLen, hd: THICK, top: fenceTop });
    }
  }

  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const hw = p.w / 2, hd = p.d / 2;
    const isMain = p.w >= 14;
    const fenceTop = p.h + (isMain ? 0.85 : 0.70);

    const edges: { axis: 'x' | 'z'; dir: number; from: number; to: number }[] = [
      { axis: 'x', dir: 1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },
      { axis: 'x', dir: -1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },
      { axis: 'z', dir: 1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },
      { axis: 'z', dir: -1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },
    ];

    for (const edge of edges) {
      const len = edge.to - edge.from;
      if (len < 0.5) continue;
      const steps = Math.max(1, Math.round(len / STEP));
      const runsZ = edge.axis === 'x';

      let segStart: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const along = edge.from + (i / steps) * len;
        const ex = runsZ ? p.x + edge.dir * hw : along;
        const ez = runsZ ? along : p.z + edge.dir * hd;

        if (!isEdgeConnected(ex, ez, edge.axis, edge.dir, p)) {
          if (segStart === null) segStart = along;
          if (i === steps) {
            closeSeg(segStart, along, runsZ, 0, fenceTop, edge.axis, edge.dir, p);
            segStart = null;
          }
        } else {
          if (segStart !== null) {
            const prev = edge.from + ((i - 1) / steps) * len;
            closeSeg(segStart, prev, runsZ, 0, fenceTop, edge.axis, edge.dir, p);
            segStart = null;
          }
        }
      }
      if (segStart !== null) {
        closeSeg(segStart, edge.to, runsZ, 0, fenceTop, edge.axis, edge.dir, p);
      }
    }

    // Corner colliders
    const corners: [number, number][] = [
      [p.x + hw, p.z + hd], [p.x + hw, p.z - hd],
      [p.x - hw, p.z + hd], [p.x - hw, p.z - hd],
    ];
    for (const [cx, cz] of corners) {
      const cX = isEdgeConnected(cx, cz, 'x', cx > p.x ? 1 : -1, p);
      const cZ = isEdgeConnected(cx, cz, 'z', cz > p.z ? 1 : -1, p);
      if (cX && cZ) continue;
      colliders.push({ x: cx, z: cz, hw: 0.22, hd: 0.22, top: fenceTop });
    }
  }

  return colliders;
}

// Computed once (PLATFORMS is const)
export const FENCE_COLLIDERS = computeColliders();

export function isFenceBlocked(px: number, pz: number, py: number, radius = 0.25): boolean {
  for (const f of FENCE_COLLIDERS) {
    if (py > f.top) continue;
    if (px + radius > f.x - f.hw && px - radius < f.x + f.hw &&
        pz + radius > f.z - f.hd && pz - radius < f.z + f.hd) {
      return true;
    }
  }
  return false;
}
