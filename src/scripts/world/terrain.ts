// Static world geometry: terrain, vegetation, fences, lanterns
import * as THREE from 'three';
import { COMPANIES, PLATFORMS } from '../core/data';
import { stdMat, stdBox } from '../core/helpers';
import { isEdgeConnected } from '../core/collision';

// --- Palette ---

const GRASS = 0x80d880, GRASS_EDGE = 0x68c068;
const DIRT = 0xa08860;
const STONE = 0x8a8598, STONE_LT = 0xc8c0b8;
const WOOD = 0x8a6540, WOOD_LT = 0xb09868, BARK = 0x6a4a2a;
const LEAF_GR = 0x4aaa4a, LEAF_DK = 0x3a8a3a;
const LEAF_OR = 0xf09050, LEAF_RD = 0xe87040;
const LEAF_PK = 0xf0a0b8, LEAF_PK2 = 0xe888a0;
const FL_PK = 0xf5a8c0, FL_YL = 0xf0d060, FL_BL = 0x88c8e8;

// --- Helpers ---

function getH(x: number, z: number): number {
  let h = -1;
  for (const p of PLATFORMS) {
    if (x >= p.x - p.w / 2 - 1 && x <= p.x + p.w / 2 + 1 &&
        z >= p.z - p.d / 2 - 1 && z <= p.z + p.d / 2 + 1) {
      if (p.h > h) h = p.h;
    }
  }
  return h;
}

function nearZone(x: number, z: number, r: number): boolean {
  return COMPANIES.some(co => Math.hypot(x - co.position.x, z - co.position.z) < r);
}

type LeafType = 'green' | 'orange' | 'pink';

// --- Platforms ---

export function buildPlatforms(scene: THREE.Scene, isMobile: boolean): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;

    const stoneH = Math.max(0.1, p.h - 0.30);
    const stone = stdBox(p.w, stoneH, p.d, STONE);
    stone.position.set(p.x, stoneH / 2, p.z);
    scene.add(stone);

    const dirt = stdBox(p.w, 0.15, p.d, DIRT);
    dirt.position.set(p.x, stoneH + 0.075, p.z);
    scene.add(dirt);

    const grass = stdBox(p.w + 0.1, 0.12, p.d + 0.1, GRASS);
    grass.position.set(p.x, p.h - 0.06, p.z);
    scene.add(grass);

    if (!isMobile) {
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w + 0.1, 0.12, p.d + 0.1)),
        new THREE.LineBasicMaterial({ color: GRASS_EDGE, transparent: true, opacity: 0.15 }),
      );
      edge.position.copy(grass.position);
      scene.add(edge);
    }
  }
}

// --- Trees ---

function addTree(scene: THREE.Scene, tx: number, tz: number, h: number, type: LeafType): void {
  if (nearZone(tx, tz, 6)) return;
  const base = getH(tx, tz);
  if (base < 0) return;

  const trunk = stdBox(0.5, h * 0.75, 0.5, BARK);
  trunk.position.set(tx, base + h * 0.375, tz);
  scene.add(trunk);

  const cols = type === 'green' ? [LEAF_GR, LEAF_DK, LEAF_GR]
    : type === 'orange' ? [LEAF_OR, LEAF_RD, LEAF_OR]
    : [LEAF_PK, LEAF_PK2, LEAF_PK];

  const leafGeo = new THREE.BoxGeometry(1.1, 0.9, 1.1);
  const offsets: [number, number, number][] = [
    [0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1],
    [0, 0, 1], [0, 0.9, 0], [-1, 0, 1], [1, 0, -1],
  ];

  for (let i = 0; i < offsets.length; i++) {
    const [lx, ly, lz] = offsets[i];
    const leaf = new THREE.Mesh(leafGeo, stdMat(cols[i % cols.length]));
    leaf.position.set(tx + lx * 1.05, base + h * 0.75 + ly + 0.4, tz + lz * 1.05);
    leaf.castShadow = true;
    scene.add(leaf);
  }
}

export function buildTrees(scene: THREE.Scene): void {
  const trees: [number, number, number, LeafType][] = [
    [-8, -4, 4, 'green'], [9, -2, 3, 'orange'],
    [-12, -14, 5, 'pink'], [12, -14, 4, 'green'],
    [20, -20, 4, 'orange'], [30, -30, 3, 'green'],
    [-20, -20, 4, 'pink'], [-32, -30, 5, 'green'],
    [-8, -52, 6, 'orange'], [8, -52, 5, 'pink'],
    [-5, -63, 4, 'green'], [6, -64, 5, 'orange'],
    [-38, -48, 4, 'green'], [38, -48, 4, 'pink'],
    [25, -55, 3, 'orange'], [-25, -55, 5, 'green'],
  ];
  for (const [x, z, h, type] of trees) addTree(scene, x, z, h, type);
}

// --- Flowers & Grass ---

export function buildFlowers(scene: THREE.Scene): void {
  const flowerColors = [FL_PK, FL_YL, FL_BL, FL_PK, 0xf5c8e0];
  const spots: [number, number][] = [
    [-5, -3], [7, -8], [-14, -12], [10, -20], [-9, -25],
    [19, -23], [-23, -32], [26, -28], [-16, -44], [8, -36],
    [-30, -50], [22, -53], [3, -50], [-6, -62], [12, -58],
    [-40, -38], [40, -42], [4, -14], [-4, -16], [15, -38],
  ];

  const tuftGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
  const flowerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  spots.forEach(([sx, sz], i) => {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    for (let j = 0; j < 2 + (i % 2); j++) {
      const tuft = new THREE.Mesh(tuftGeo, stdMat(0x58b858));
      tuft.position.set(sx + (j - 1) * 0.25, base + 0.2, sz + (j % 2) * 0.2);
      scene.add(tuft);
    }

    if (i % 2 === 0) {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), stdMat(0x48a048));
      stem.position.set(sx + 0.3, base + 0.175, sz);
      scene.add(stem);

      const flower = new THREE.Mesh(flowerGeo, stdMat(flowerColors[i % flowerColors.length]));
      flower.position.set(sx + 0.3, base + 0.42, sz);
      scene.add(flower);
    }
  });
}

// --- Mushrooms ---

export function buildMushrooms(scene: THREE.Scene): void {
  const spots: [number, number, number][] = [
    [7, -8, FL_PK], [-14, -12, LEAF_OR], [19, -23, FL_PK],
    [-23, -32, LEAF_OR], [8, -36, FL_PK], [3, -50, LEAF_OR],
    [-6, -62, FL_PK], [12, -58, LEAF_OR],
  ];

  for (const [sx, sz, col] of spots) {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    const stem = stdBox(0.15, 0.35, 0.15, 0xe0d8c0);
    stem.position.set(sx, base + 0.175, sz);
    scene.add(stem);

    const cap = stdBox(0.5, 0.2, 0.5, col);
    cap.position.set(sx, base + 0.45, sz);
    scene.add(cap);

    const spot = stdBox(0.1, 0.02, 0.1, 0xfff5e8);
    spot.position.set(sx + 0.1, base + 0.57, sz + 0.05);
    scene.add(spot);
  }
}

// --- Fences ---

export function buildFences(scene: THREE.Scene): void {
  const STEP = 1.15;
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };

  // Shared geometries
  const wallGeo = new THREE.BoxGeometry(1.1, 0.30, 0.28);
  const hedgeGeo = new THREE.BoxGeometry(1.15, 0.38, 0.44);
  const postGeo = new THREE.BoxGeometry(0.16, 0.70, 0.16);
  const cornerGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
  const flowerGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  // Shared materials
  const wallMat = stdMat(STONE);
  const wallLtMat = stdMat(0x9a9488);
  const hedgeMat = stdMat(0x4a9a4a);
  const hedgeLtMat = stdMat(0x5aaa5a);
  const hedgeDkMat = stdMat(0x3a8a3a);
  const postMat = stdMat(WOOD);
  const railMat = stdMat(WOOD_LT);
  const cornerMat = stdMat(0x7a7568);
  const flowerMats = [stdMat(FL_PK), stdMat(FL_YL), stdMat(FL_BL), stdMat(0xf5c8e0)];

  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const hw = p.w / 2, hd = p.d / 2;
    const isMain = p.w >= 14;

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
      const openRuns: { start: number; end: number }[] = [];
      let runStart: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const along = edge.from + (i / steps) * len;
        const ex = runsZ ? p.x + edge.dir * hw : along;
        const ez = runsZ ? along : p.z + edge.dir * hd;

        if (isEdgeConnected(ex, ez, edge.axis, edge.dir, p)) {
          if (runStart !== null) { openRuns.push({ start: runStart, end: along }); runStart = null; }
          continue;
        }
        if (runStart === null) runStart = along;

        const fx = runsZ ? p.x + edge.dir * (hw + 0.05) : along;
        const fz = runsZ ? along : p.z + edge.dir * (hd + 0.05);
        const h = hash(fx * 7.1, fz * 3.7);

        if (isMain) {
          const wall = new THREE.Mesh(wallGeo, h > 0.5 ? wallMat : wallLtMat);
          wall.position.set(fx, p.h + 0.15, fz);
          if (runsZ) wall.rotation.y = Math.PI / 2;
          wall.castShadow = true;
          scene.add(wall);

          if (h > 0.30) {
            const hedge = new THREE.Mesh(hedgeGeo, h > 0.7 ? hedgeDkMat : h > 0.5 ? hedgeMat : hedgeLtMat);
            hedge.position.set(fx, p.h + 0.49, fz);
            if (runsZ) hedge.rotation.y = Math.PI / 2;
            hedge.castShadow = true;
            scene.add(hedge);
          }

          if (h > 0.88) {
            const fl = new THREE.Mesh(flowerGeo, flowerMats[Math.floor(h * 40) % flowerMats.length]);
            fl.position.set(fx, p.h + 0.76, fz);
            fl.rotation.y = Math.PI / 4;
            scene.add(fl);
          }
        } else if (i % 2 === 0) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(fx, p.h + 0.35, fz);
          post.castShadow = true;
          scene.add(post);
        }
      }

      if (runStart !== null) openRuns.push({ start: runStart, end: edge.to });

      // Bridge rails
      if (!isMain) {
        for (const run of openRuns) {
          if (run.end - run.start < 0.5) continue;
          const mid = (run.start + run.end) / 2;
          const rx = runsZ ? p.x + edge.dir * (hw + 0.05) : mid;
          const rz = runsZ ? mid : p.z + edge.dir * (hd + 0.05);
          const segLen = run.end - run.start;

          for (let r = 0; r < 2; r++) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(runsZ ? 0.06 : segLen + 0.1, 0.05, runsZ ? segLen + 0.1 : 0.06),
              railMat,
            );
            rail.position.set(rx, p.h + 0.22 + r * 0.22, rz);
            scene.add(rail);
          }
        }
      }
    }

    // Corner posts
    const corners: [number, number][] = [
      [p.x + hw, p.z + hd], [p.x + hw, p.z - hd],
      [p.x - hw, p.z + hd], [p.x - hw, p.z - hd],
    ];
    for (const [cx, cz] of corners) {
      const connX = isEdgeConnected(cx, cz, 'x', cx > p.x ? 1 : -1, p);
      const connZ = isEdgeConnected(cx, cz, 'z', cz > p.z ? 1 : -1, p);
      if (connX && connZ) continue;

      if (isMain) {
        const corner = new THREE.Mesh(cornerGeo, cornerMat);
        corner.position.set(cx, p.h + 0.21, cz);
        corner.castShadow = true;
        scene.add(corner);

        const ball = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.30, 0.32), hedgeMat);
        ball.position.set(cx, p.h + 0.57, cz);
        ball.castShadow = true;
        scene.add(ball);
      } else {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(cx, p.h + 0.35, cz);
        post.castShadow = true;
        scene.add(post);
      }
    }
  }
}

// --- Lanterns ---

export function buildLanterns(scene: THREE.Scene): void {
  const spots: [number, number][] = [
    [0, -4], [0, -14],
    [10, -24], [17, -28], [22, -33],
    [-10, -24], [-17, -28], [-22, -33],
    [1, -30], [-1, -42], [0, -48],
  ];

  for (const [lx, lz] of spots) {
    if (nearZone(lx, lz, 4.5)) continue;
    const base = getH(lx, lz);
    if (base < 0) continue;

    const post = stdBox(0.12, 1.5, 0.12, WOOD);
    post.position.set(lx, base + 0.75, lz);
    scene.add(post);

    const lamp = stdBox(0.3, 0.25, 0.3, 0xf5e8c0);
    lamp.position.set(lx, base + 1.65, lz);
    scene.add(lamp);

    const light = new THREE.PointLight(0xf5c870, 0.4, 6);
    light.position.set(lx, base + 1.9, lz);
    scene.add(light);
  }
}

// --- Zone ground patches ---

export function buildZonePatches(scene: THREE.Scene): void {
  for (const co of COMPANIES) {
    for (const p of PLATFORMS) {
      if (Math.abs(p.x - co.position.x) < 1 && Math.abs(p.z - co.position.z) < 1) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(3.5, 3.7, 32),
          new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(co.position.x, p.h + 0.01, co.position.z);
        scene.add(ring);
        break;
      }
    }
  }
}

// --- Path stepping stones ---

export function buildPathDots(scene: THREE.Scene): void {
  const dotMat = stdMat(STONE_LT);
  const dotGeo = new THREE.BoxGeometry(0.3, 0.06, 0.3);

  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      const total = Math.max(10, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 5));
      for (let s = 0; s < total; s += 2) {
        const t = s / total;
        const px = a.x + (b.x - a.x) * t;
        const pz = a.z + (b.z - a.z) * t;
        const ph = getH(px, pz);
        if (ph < 0) continue;
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(px, ph + 0.03, pz);
        scene.add(dot);
      }
    }
  }
}
