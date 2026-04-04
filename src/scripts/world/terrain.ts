// Static world geometry: terrain, vegetation, fences, lanterns
// v2: Zone-specific palettes, cliff strata, rocks, safer object placement
import * as THREE from 'three';
import { COMPANIES, PLATFORMS } from '../core/data';
import { stdMat, stdBox } from '../core/helpers';
import { isEdgeConnected } from '../core/collision';

// --- Zone Palette System ---

interface ZonePalette {
  grass: number;
  grassEdge: number;
  stone: number;
  stoneDark: number;
  dirt: number;
  rockAccent: number;
}

const PALETTES: Record<string, ZonePalette> = {
  // Spawn - fresh neutral green
  spawn: {
    grass: 0x80d880, grassEdge: 0x68c068,
    stone: 0x8a8598, stoneDark: 0x6a6578,
    dirt: 0xa08860, rockAccent: 0x9a9088,
  },
  // Nether (Zone 0) - dark mystical teal
  nether: {
    grass: 0x5a8870, grassEdge: 0x487860,
    stone: 0x706080, stoneDark: 0x504068,
    dirt: 0x686058, rockAccent: 0x7a6890,
  },
  // Treasure Isle (Zone 1) - bright tropical
  treasure: {
    grass: 0x78d868, grassEdge: 0x60c050,
    stone: 0xb8a880, stoneDark: 0x988868,
    dirt: 0xc8b070, rockAccent: 0xd0c090,
  },
  // Beacon Peak (Zone 2) - golden highland
  beacon: {
    grass: 0xa8b850, grassEdge: 0x90a040,
    stone: 0x988868, stoneDark: 0x787050,
    dirt: 0xa89058, rockAccent: 0xb8a060,
  },
  // Overworld (Zone 3) - soft sakura green
  overworld: {
    grass: 0x90c888, grassEdge: 0x78b070,
    stone: 0x908898, stoneDark: 0x706878,
    dirt: 0x987868, rockAccent: 0xa08890,
  },
  // Bridges - muted neutral
  bridge: {
    grass: 0x70b870, grassEdge: 0x58a058,
    stone: 0x8a8598, stoneDark: 0x6a6578,
    dirt: 0xa08860, rockAccent: 0x9a9088,
  },
};

// Zone centers from COMPANIES data
const ZONE_CENTERS: { x: number; z: number; key: string }[] = [
  { x: 0, z: 0, key: 'spawn' },
  { x: 0, z: -18, key: 'nether' },
  { x: 28, z: -40, key: 'treasure' },
  { x: -28, z: -40, key: 'beacon' },
  { x: 0, z: -58, key: 'overworld' },
];

function getZonePalette(px: number, pz: number): ZonePalette {
  let bestKey = 'bridge';
  let bestDist = Infinity;
  for (const zc of ZONE_CENTERS) {
    const d = Math.hypot(px - zc.x, pz - zc.z);
    if (d < bestDist) { bestDist = d; bestKey = zc.key; }
  }
  // If too far from any zone center, use bridge palette
  if (bestDist > 14) return PALETTES.bridge;
  return PALETTES[bestKey];
}

// --- Leaf types per zone ---

type LeafType = 'green' | 'orange' | 'pink';

function getZoneLeafType(x: number, z: number): LeafType {
  const pal = getZonePalette(x, z);
  if (pal === PALETTES.beacon) return 'orange';
  if (pal === PALETTES.overworld) return 'pink';
  return 'green';
}

// --- Static Palette ---

const WOOD = 0x8a6540, WOOD_LT = 0xb09868, BARK = 0x6a4a2a;
const LEAF_GR = 0x4aaa4a, LEAF_DK = 0x3a8a3a;
const LEAF_OR = 0xf09050, LEAF_RD = 0xe87040;
const LEAF_PK = 0xf0a0b8, LEAF_PK2 = 0xe888a0;
const FL_PK = 0xf5a8c0, FL_YL = 0xf0d060, FL_BL = 0x88c8e8;
const STONE_LT = 0xc8c0b8;

// --- Helpers ---

function getH(x: number, z: number): number {
  let h = -1;
  for (const p of PLATFORMS) {
    if (x >= p.x - p.w / 2 && x <= p.x + p.w / 2 &&
        z >= p.z - p.d / 2 && z <= p.z + p.d / 2) {
      if (p.h > h) h = p.h;
    }
  }
  return h;
}

function nearZone(x: number, z: number, r: number): boolean {
  return COMPANIES.some(co => Math.hypot(x - co.position.x, z - co.position.z) < r);
}

function hash(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// --- Platforms (zone-colored, cliff strata) ---

export function buildPlatforms(scene: THREE.Scene, isMobile: boolean): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const pal = getZonePalette(p.x, p.z);

    // Stone body (single color, full height minus grass)
    const stoneH = Math.max(0.1, p.h - 0.12);
    const stone = stdBox(p.w, stoneH, p.d, pal.stone);
    stone.position.set(p.x, stoneH / 2, p.z);
    scene.add(stone);

    // Grass cap only (no dirt, no strata, no accent)
    const grass = stdBox(p.w + 0.1, 0.12, p.d + 0.1, pal.grass);
    grass.position.set(p.x, p.h - 0.06, p.z);
    scene.add(grass);

    if (!isMobile) {
      const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w + 0.1, 0.12, p.d + 0.1)),
          new THREE.LineBasicMaterial({ color: pal.grassEdge, transparent: true, opacity: 0.15 }),
      );
      edge.position.copy(grass.position);
      scene.add(edge);
    }
  }
}

// --- Trees (zone-aware, safe positions) ---

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
    // Spawn island
    [-4, 4, 3.5, 'green'],
    [5, 3, 3, 'green'],

    // Zone 0 - Nether
    [-7, -14, 5, 'green'],
    [7, -15, 4, 'green'],
    [-5, -23, 4, 'green'],
    [6, -22, 3.5, 'green'],

    // Zone 1 - Treasure Isle
    [24, -36, 4.5, 'green'],
    [33, -38, 4, 'green'],
    [30, -44, 3.5, 'green'],
    [22, -42, 3, 'green'],

    // Zone 2 - Beacon Peak
    [-33, -36, 5, 'orange'],
    [-24, -38, 4, 'orange'],
    [-30, -44, 3.5, 'orange'],
    [-22, -42, 3, 'orange'],

    // Zone 3 - Overworld
    [-6, -55, 5, 'pink'],
    [5, -56, 4, 'pink'],
    [-4, -63, 4.5, 'pink'],
    [7, -62, 5, 'pink'],
    [-2, -59, 3.5, 'pink'],
  ];
  for (const [x, z, h, type] of trees) addTree(scene, x, z, h, type);
}

// --- Flowers & Grass (zone-aware, on-platform positions) ---

export function buildFlowers(scene: THREE.Scene): void {
  // Positions guaranteed to be on platforms with 2+ unit margin
  const spots: [number, number][] = [
    // Spawn
    [-3, 2], [4, -1], [-2, -3], [3, 3],
    // Zone 0 - Nether
    [-4, -14], [3, -16], [-6, -21], [5, -20], [0, -17],
    // Zone 1 - Treasure
    [25, -37], [31, -39], [27, -43], [34, -36], [23, -41],
    // Zone 2 - Beacon
    [-32, -37], [-25, -39], [-29, -43], [-23, -36], [-34, -41],
    // Zone 3 - Overworld
    [-5, -54], [4, -56], [-3, -61], [6, -59], [0, -57],
  ];

  const tuftGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
  const flowerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  // Zone-aware flower color selection
  const zoneFlowerColors: Record<string, number[]> = {
    spawn:    [FL_PK, FL_YL, FL_BL, 0xf5c8e0],
    nether:   [0xa78bfa, 0x8080c0, FL_BL, 0xb098d0],
    treasure: [FL_YL, 0xf0d060, FL_PK, 0xf8e878],
    beacon:   [0xf0c040, 0xe8a830, FL_PK, 0xf8d050],
    overworld:[FL_PK, 0xf5c8e0, 0xf0b0c8, FL_BL],
    bridge:   [FL_PK, FL_YL, FL_BL, 0xf5c8e0],
  };

  spots.forEach(([sx, sz], i) => {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    const pal = getZonePalette(sx, sz);
    const palKey = Object.entries(PALETTES).find(([, v]) => v === pal)?.[0] || 'bridge';
    const colors = zoneFlowerColors[palKey] || zoneFlowerColors.bridge;

    // Grass tufts
    for (let j = 0; j < 2 + (i % 2); j++) {
      const tuft = new THREE.Mesh(tuftGeo, stdMat(0x58b858));
      tuft.position.set(sx + (j - 1) * 0.25, base + 0.2, sz + (j % 2) * 0.2);
      scene.add(tuft);
    }

    // Flower (every other spot)
    if (i % 2 === 0) {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), stdMat(0x48a048));
      stem.position.set(sx + 0.3, base + 0.175, sz);
      scene.add(stem);

      const flower = new THREE.Mesh(flowerGeo, stdMat(colors[i % colors.length]));
      flower.position.set(sx + 0.3, base + 0.42, sz);
      scene.add(flower);
    }
  });
}

// --- Mushrooms ---

export function buildMushrooms(scene: THREE.Scene): void {
  // Positions verified on platforms
  const spots: [number, number, number][] = [
    [3, -1, FL_PK],
    [-6, -20, LEAF_OR],
    [32, -40, FL_PK],
    [-31, -40, LEAF_OR],
    [-3, -60, FL_PK],
    [5, -57, LEAF_OR],
    [0, -29, FL_PK],
    [-1, -43, LEAF_OR],
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

// --- Rocks (NEW - scattered on platforms for detail) ---

export function buildRocks(scene: THREE.Scene): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    if (p.w < 10) continue;
    const pal = getZonePalette(p.x, p.z);
    const isMain = p.w >= 14;
    const count = isMain ? 6 : 2;
    const margin = isMain ? 2.0 : 1.0;

    for (let i = 0; i < count; i++) {
      const seed = hash(p.x * 7.3 + i * 13.1, p.z * 11.7 + i * 17.3);
      const seed2 = hash(p.x + i * 31, p.z + i * 47);

      const rx = p.x + (seed - 0.5) * (p.w - margin * 2);
      const rz = p.z + (seed2 - 0.5) * (p.d - margin * 2);

      if (nearZone(rx, rz, 4)) continue;

      // Vary size per rock
      const sz = 0.2 + seed * 0.25;
      const rock = stdBox(sz, sz * 0.65, sz * (0.8 + seed2 * 0.4), pal.rockAccent);
      rock.position.set(rx, p.h + sz * 0.32, rz);
      rock.rotation.y = seed * Math.PI * 2;
      rock.castShadow = true;
      scene.add(rock);

      // Small pebble next to some rocks
      if (seed > 0.6) {
        const peb = stdBox(sz * 0.4, sz * 0.3, sz * 0.4, pal.stone);
        peb.position.set(rx + sz * 0.6, p.h + sz * 0.15, rz + sz * 0.3);
        scene.add(peb);
      }
    }
  }
}

// --- Fences (unchanged logic) ---

export function buildFences(scene: THREE.Scene): void {
  const STEP = 1.15;

  const wallGeo = new THREE.BoxGeometry(1.1, 0.30, 0.28);
  const hedgeGeo = new THREE.BoxGeometry(1.15, 0.38, 0.44);
  const postGeo = new THREE.BoxGeometry(0.16, 0.70, 0.16);
  const cornerGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
  const flowerGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  const STONE = 0x8a8598;
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
    if (p.w < 10) continue;
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

        const pal = getZonePalette(px, pz);
        const dot = new THREE.Mesh(dotGeo, stdMat(pal.rockAccent));
        dot.position.set(px, ph + 0.03, pz);
        scene.add(dot);
      }
    }
  }
}