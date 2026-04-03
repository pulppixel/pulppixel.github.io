// ─── 씬 · 밝은 복셀 월드 ───
// Blue sky · Layered terrain · Water · Clouds · Colorful trees
import * as THREE from 'three';
import { COMPANIES, PLATFORMS } from './data';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: { geo: THREE.BufferGeometry; count: number };
  stars: { geo: THREE.BufferGeometry; baseColors: Float32Array; count: number };
  clouds: THREE.Group[];
}

// ═══════════════════════════════════════
// ── Palette ──
// ═══════════════════════════════════════

const GRASS = 0x80d880, GRASS_EDGE = 0x68c068;
const DIRT = 0xa08860;
const STONE = 0x8a8598;
const WOOD = 0x8a6540, WOOD_LT = 0xb09868, BARK = 0x6a4a2a;
const LEAF_GR = 0x4aaa4a, LEAF_DK = 0x3a8a3a;
const LEAF_OR = 0xf09050, LEAF_RD = 0xe87040;
const LEAF_PK = 0xf0a0b8, LEAF_PK2 = 0xe888a0;
const FL_PK = 0xf5a8c0, FL_YL = 0xf0d060, FL_BL = 0x88c8e8;

// ── Material helpers ──

function nat(c: number, r = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: c, metalness: 0.05, roughness: r });
}

function box(w: number, h: number, d: number, c: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), nat(c));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ═══════════════════════════════════════
// ── Ocean (base water plane) ──
// ═══════════════════════════════════════

function buildOcean(scene: THREE.Scene): void {
  // Deep ocean floor (dark)
  const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 120),
      nat(0x2088a0, 0.6),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.5, -29);
  floor.receiveShadow = true;
  scene.add(floor);

  // Water surface (translucent, at y=0)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x48c0d8,
    metalness: 0.1,
    roughness: 0.25,
    transparent: true,
    opacity: 0.78,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.05, -29);
  water.receiveShadow = true;
  scene.add(water);

  // Surface highlight strips (shimmering feel)
  const shineMat = new THREE.MeshBasicMaterial({
    color: 0xa0ecf5, transparent: true, opacity: 0.08,
  });
  const strips: [number, number, number, number][] = [
    [-15, -10, 12, 1.5], [20, -35, 10, 1], [-25, -50, 8, 1.2],
    [10, -20, 6, 0.8], [-8, -55, 9, 1.3], [30, -25, 7, 1],
  ];
  strips.forEach(([x, z, w, d]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shineMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, -0.02, z);
    scene.add(s);
  });
}

// ═══════════════════════════════════════
// ── Platforms (grass/dirt/stone layers) ──
// ═══════════════════════════════════════

function buildPlatforms(scene: THREE.Scene, isMobile: boolean): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue; // only skip truly zero-height

    // Stone base (bulk)
    const stoneH = Math.max(0.1, p.h - 0.30);
    const stone = box(p.w, stoneH, p.d, STONE);
    stone.position.set(p.x, stoneH / 2, p.z);
    scene.add(stone);

    // Dirt band
    const dirtH = 0.15;
    const dirt = box(p.w, dirtH, p.d, DIRT);
    dirt.position.set(p.x, stoneH + dirtH / 2, p.z);
    scene.add(dirt);

    // Grass cap
    const grassH = 0.12;
    const grass = box(p.w + 0.1, grassH, p.d + 0.1, GRASS);
    grass.position.set(p.x, p.h - grassH / 2, p.z);
    scene.add(grass);

    // Edge highlight (desktop only)
    if (!isMobile) {
      const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w + 0.1, grassH, p.d + 0.1)),
          new THREE.LineBasicMaterial({ color: GRASS_EDGE, transparent: true, opacity: 0.15 }),
      );
      edge.position.copy(grass.position);
      scene.add(edge);
    }
  }
}

// ═══════════════════════════════════════
// ── Trees ──
// ═══════════════════════════════════════

function getH(x: number, z: number): number {
  let h = -1; // -1 = in water (no platform)
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

function addTree(scene: THREE.Scene, tx: number, tz: number, h: number, type: LeafType): void {
  if (nearZone(tx, tz, 6)) return;
  const base = getH(tx, tz);
  if (base < 0) return; // in water — skip

  // Trunk
  const trunk = box(0.5, h * 0.75, 0.5, BARK);
  trunk.position.set(tx, base + h * 0.375, tz);
  scene.add(trunk);

  // Leaf colors per type
  const cols = type === 'green' ? [LEAF_GR, LEAF_DK, LEAF_GR]
      : type === 'orange' ? [LEAF_OR, LEAF_RD, LEAF_OR]
          : [LEAF_PK, LEAF_PK2, LEAF_PK];

  // Leaf cluster (8 boxes)
  const leafGeo = new THREE.BoxGeometry(1.1, 0.9, 1.1);
  const offsets: [number, number, number][] = [
    [0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 0.9, 0], [-1, 0, 1], [1, 0, -1],
  ];
  offsets.forEach(([lx, ly, lz], i) => {
    const leaf = new THREE.Mesh(leafGeo, nat(cols[i % cols.length]));
    leaf.position.set(tx + lx * 1.05, base + h * 0.75 + ly + 0.4, tz + lz * 1.05);
    leaf.castShadow = true;
    scene.add(leaf);
  });
}

function buildTrees(scene: THREE.Scene): void {
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
  trees.forEach(([x, z, h, type]) => addTree(scene, x, z, h, type));
}

// ═══════════════════════════════════════
// ── Flowers & Grass Tufts ──
// ═══════════════════════════════════════

function buildFlowers(scene: THREE.Scene): void {
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
    if (base < 0) return; // in water — skip

    // Grass tufts (2-3 per spot)
    for (let j = 0; j < 2 + (i % 2); j++) {
      const ox = (j - 1) * 0.25;
      const tuft = new THREE.Mesh(tuftGeo, nat(0x58b858));
      tuft.position.set(sx + ox, base + 0.2, sz + (j % 2) * 0.2);
      scene.add(tuft);
    }

    // Flower on some spots
    if (i % 2 === 0) {
      const stem = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.35, 0.06),
          nat(0x48a048),
      );
      stem.position.set(sx + 0.3, base + 0.175, sz);
      scene.add(stem);

      const flower = new THREE.Mesh(flowerGeo, nat(flowerColors[i % flowerColors.length]));
      flower.position.set(sx + 0.3, base + 0.42, sz);
      scene.add(flower);
    }
  });
}

// ═══════════════════════════════════════
// ── Mushrooms ──
// ═══════════════════════════════════════

function buildMushrooms(scene: THREE.Scene): void {
  const spots: [number, number, number][] = [
    [7, -8, FL_PK], [-14, -12, LEAF_OR], [19, -23, FL_PK],
    [-23, -32, LEAF_OR], [8, -36, FL_PK], [3, -50, LEAF_OR],
    [-6, -62, FL_PK], [12, -58, LEAF_OR],
  ];

  spots.forEach(([sx, sz, col]) => {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    const stem = box(0.15, 0.35, 0.15, 0xe0d8c0);
    stem.position.set(sx, base + 0.175, sz);
    scene.add(stem);

    const cap = box(0.5, 0.2, 0.5, col);
    cap.position.set(sx, base + 0.45, sz);
    scene.add(cap);

    // Spots on cap
    const spot = box(0.1, 0.02, 0.1, 0xfff5e8);
    spot.position.set(sx + 0.1, base + 0.57, sz + 0.05);
    scene.add(spot);
  });
}

// ═══════════════════════════════════════
// ── Fences — Auto-edge with adjacency detection ──
// ═══════════════════════════════════════

function buildFences(scene: THREE.Scene): void {
  const STEP = 1.15;   // spacing between fence elements
  const ADJ = 5.0;     // adjacency threshold — platforms closer than this are "connected"

  // ── Shared geometries (reused across all fence elements) ──
  const wallGeo = new THREE.BoxGeometry(1.1, 0.30, 0.28);
  const hedgeGeo = new THREE.BoxGeometry(1.15, 0.38, 0.44);
  const postGeo = new THREE.BoxGeometry(0.16, 0.70, 0.16);
  const cornerGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
  const flowerGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  // ── Shared materials ──
  const wallMat = nat(STONE);
  const wallLtMat = nat(0x9a9488);
  const hedgeMat = nat(0x4a9a4a);
  const hedgeLtMat = nat(0x5aaa5a);
  const hedgeDkMat = nat(0x3a8a3a);
  const postMat = nat(WOOD);
  const railMat = nat(WOOD_LT);
  const cornerMat = nat(0x7a7568);
  const flowerMats = [nat(FL_PK), nat(FL_YL), nat(FL_BL), nat(0xf5c8e0)];

  // Position-based deterministic random
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };

  // Check if a point on platform edge has a neighboring platform (= path opening)
  function isConnected(
      ex: number, ez: number,
      axis: 'x' | 'z', dir: number,
      self: typeof PLATFORMS[0],
  ): boolean {
    for (const q of PLATFORMS) {
      if (q === self || q.h <= 0) continue;
      if (axis === 'x') {
        // Right/left edge — check if Q's opposite edge is nearby
        const qEdge = dir > 0 ? q.x - q.w / 2 : q.x + q.w / 2;
        const pEdge = self.x + dir * self.w / 2;
        if (Math.abs(qEdge - pEdge) < ADJ &&
            ez >= q.z - q.d / 2 - 1.5 && ez <= q.z + q.d / 2 + 1.5) return true;
      } else {
        const qEdge = dir > 0 ? q.z - q.d / 2 : q.z + q.d / 2;
        const pEdge = self.z + dir * self.d / 2;
        if (Math.abs(qEdge - pEdge) < ADJ &&
            ex >= q.x - q.w / 2 - 1.5 && ex <= q.x + q.w / 2 + 1.5) return true;
      }
    }
    return false;
  }

  // ── Iterate all platforms ──
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const hw = p.w / 2, hd = p.d / 2;
    const isMain = p.w >= 14;  // main islands get stone wall + hedge

    // 4 edges — inset 0.3 from corners to avoid z-fighting & overlaps
    const edges: { axis: 'x' | 'z'; dir: number; from: number; to: number }[] = [
      { axis: 'x', dir:  1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },  // right
      { axis: 'x', dir: -1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },  // left
      { axis: 'z', dir:  1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },  // back (+z)
      { axis: 'z', dir: -1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },  // front (-z)
    ];

    for (const edge of edges) {
      const len = edge.to - edge.from;
      if (len < 0.5) continue;
      const steps = Math.max(1, Math.round(len / STEP));
      const runsAlongZ = edge.axis === 'x';  // right/left edge → fence runs along z

      // Track consecutive open segments for bridge rails
      const openRuns: { start: number; end: number }[] = [];
      let runStart: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const along = edge.from + (i / steps) * len;
        const ex = runsAlongZ ? p.x + edge.dir * hw : along;
        const ez = runsAlongZ ? along : p.z + edge.dir * hd;

        if (isConnected(ex, ez, edge.axis, edge.dir, p)) {
          // Connected to another platform — leave opening
          if (runStart !== null) {
            openRuns.push({ start: runStart, end: along });
            runStart = null;
          }
          continue;
        }

        if (runStart === null) runStart = along;

        // Place fence element at platform edge
        const fx = runsAlongZ ? p.x + edge.dir * (hw + 0.05) : along;
        const fz = runsAlongZ ? along : p.z + edge.dir * (hd + 0.05);
        const h = hash(fx * 7.1, fz * 3.7);

        if (isMain) {
          // ── Main island: Stone wall base + hedge + flowers ──
          const wall = new THREE.Mesh(wallGeo, h > 0.5 ? wallMat : wallLtMat);
          wall.position.set(fx, p.h + 0.15, fz);
          if (runsAlongZ) wall.rotation.y = Math.PI / 2;
          wall.castShadow = true;
          scene.add(wall);

          // Hedge on top (~70%)
          if (h > 0.30) {
            const hMat = h > 0.7 ? hedgeDkMat : h > 0.5 ? hedgeMat : hedgeLtMat;
            const hedge = new THREE.Mesh(hedgeGeo, hMat);
            hedge.position.set(fx, p.h + 0.49, fz);
            if (runsAlongZ) hedge.rotation.y = Math.PI / 2;
            hedge.castShadow = true;
            scene.add(hedge);
          }

          // Flower accent (~12%)
          if (h > 0.88) {
            const fl = new THREE.Mesh(flowerGeo, flowerMats[Math.floor(h * 40) % flowerMats.length]);
            fl.position.set(fx, p.h + 0.76, fz);
            fl.rotation.y = Math.PI / 4;
            scene.add(fl);
          }
        } else {
          // ── Bridge / path: Wooden fence posts ──
          if (i % 2 === 0) {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(fx, p.h + 0.35, fz);
            post.castShadow = true;
            scene.add(post);
          }
        }
      }

      // Close last open run
      if (runStart !== null) openRuns.push({ start: runStart, end: edge.to });

      // ── Bridge rails — connect posts with horizontal bars ──
      if (!isMain) {
        openRuns.forEach(run => {
          const segLen = run.end - run.start;
          if (segLen < 0.5) return;
          const mid = (run.start + run.end) / 2;
          const rx = runsAlongZ ? p.x + edge.dir * (hw + 0.05) : mid;
          const rz = runsAlongZ ? mid : p.z + edge.dir * (hd + 0.05);

          for (let r = 0; r < 2; r++) {
            const ry = p.h + 0.22 + r * 0.22;
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(
                    runsAlongZ ? 0.06 : segLen + 0.1,
                    0.05,
                    runsAlongZ ? segLen + 0.1 : 0.06,
                ),
                railMat,
            );
            rail.position.set(rx, ry, rz);
            scene.add(rail);
          }
        });
      }
    }

    // ── Corner posts (4 corners of each platform) ──
    const corners: [number, number][] = [
      [p.x + hw, p.z + hd], [p.x + hw, p.z - hd],
      [p.x - hw, p.z + hd], [p.x - hw, p.z - hd],
    ];
    corners.forEach(([cx, cz]) => {
      // Skip if both adjacent edges are connected (i.e. corner is an opening)
      const connX = isConnected(cx, cz, 'x', cx > p.x ? 1 : -1, p);
      const connZ = isConnected(cx, cz, 'z', cz > p.z ? 1 : -1, p);
      if (connX && connZ) return;

      if (isMain) {
        const corner = new THREE.Mesh(cornerGeo, cornerMat);
        corner.position.set(cx, p.h + 0.21, cz);
        corner.castShadow = true;
        scene.add(corner);
        // Small hedge ball on corner
        const ball = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.30, 0.32),
            hedgeMat,
        );
        ball.position.set(cx, p.h + 0.57, cz);
        ball.castShadow = true;
        scene.add(ball);
      } else {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(cx, p.h + 0.35, cz);
        post.castShadow = true;
        scene.add(post);
      }
    });
  }
}

// ═══════════════════════════════════════
// ── Lanterns (warm light posts) ──
// ═══════════════════════════════════════

function buildLanterns(scene: THREE.Scene): void {
  const spots: [number, number][] = [
    [0, -4], [0, -14],
    [10, -24], [17, -28], [22, -33],
    [-10, -24], [-17, -28], [-22, -33],
    [1, -30], [-1, -42], [0, -48],
  ];

  spots.forEach(([lx, lz]) => {
    if (nearZone(lx, lz, 4.5)) return;
    const base = getH(lx, lz);
    if (base < 0) return;

    const post = box(0.12, 1.5, 0.12, WOOD);
    post.position.set(lx, base + 0.75, lz);
    scene.add(post);

    const lamp = box(0.3, 0.25, 0.3, 0xf5e8c0);
    lamp.position.set(lx, base + 1.65, lz);
    scene.add(lamp);

    // Warm point light
    const light = new THREE.PointLight(0xf5c870, 0.4, 6);
    light.position.set(lx, base + 1.9, lz);
    scene.add(light);
  });
}

// ═══════════════════════════════════════
// ── Clouds (Minecraft-style white blocks) ──
// ═══════════════════════════════════════

function buildClouds(scene: THREE.Scene): THREE.Group[] {
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0, roughness: 1, transparent: true, opacity: 0.85,
  });
  const cloudGeo = new THREE.BoxGeometry(3, 0.8, 2);
  const clouds: THREE.Group[] = [];

  const defs: [number, number, number, number][] = [
    // x, y, z, scale
    [-25, 18, -15, 1.2], [20, 20, -35, 1.0], [-10, 22, -55, 0.9],
    [35, 19, -20, 1.1], [-35, 21, -45, 0.8], [15, 23, -60, 1.0],
    [40, 17, -50, 0.7], [-20, 24, -30, 1.3],
  ];

  defs.forEach(([cx, cy, cz, s]) => {
    const g = new THREE.Group();
    // Central block
    const c1 = new THREE.Mesh(cloudGeo, cloudMat);
    g.add(c1);
    // Side blocks for fluffy shape
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1.5), cloudMat);
    c2.position.set(-1.8, 0.1, 0.3);
    g.add(c2);
    const c3 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.8), cloudMat);
    c3.position.set(1.5, -0.05, -0.2);
    g.add(c3);
    const c4 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.2), cloudMat);
    c4.position.set(0.2, 0.4, 0.5);
    g.add(c4);

    g.position.set(cx, cy, cz);
    g.scale.setScalar(s);
    scene.add(g);
    clouds.push(g);
  });

  return clouds;
}

// ═══════════════════════════════════════
// ── Zone Patches (ground glow) ──
// ═══════════════════════════════════════

function buildZonePatches(scene: THREE.Scene): void {
  COMPANIES.forEach(co => {
    for (const p of PLATFORMS) {
      if (Math.abs(p.x - co.position.x) < 1 && Math.abs(p.z - co.position.z) < 1) {
        // Bright zone ring on grass
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
  });
}

// ═══════════════════════════════════════
// ── Path Stepping Stones ──
// ═══════════════════════════════════════

function buildPathDots(scene: THREE.Scene): void {
  const dotMat = nat(STONE);
  const dotGeo = new THREE.BoxGeometry(0.3, 0.06, 0.3);

  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      const steps = Math.max(10, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 5));
      for (let s = 0; s < steps; s++) {
        if (s % 2 !== 0) continue;
        const t = s / steps;
        const px = a.x + (b.x - a.x) * t;
        const pz = a.z + (b.z - a.z) * t;
        const ph = getH(px, pz);
        if (ph < 0) continue; // in water — skip
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(px, ph + 0.03, pz);
        scene.add(dot);
      }
    }
  }
}

// ═══════════════════════════════════════
// ── Sky Dome ──
// ═══════════════════════════════════════

function buildSkyDome(scene: THREE.Scene): void {
  const skyGeo = new THREE.SphereGeometry(90, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4090e0) },
      midColor: { value: new THREE.Color(0x70b8f0) },
      bottomColor: { value: new THREE.Color(0xc8e8fa) },
    },
    vertexShader: `
      varying float vY;
      void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying float vY;
      void main() {
        float t = clamp(vY, 0.0, 1.0);
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t));
        col = mix(col, topColor, smoothstep(0.3, 1.0, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
}

// ═══════════════════════════════════════
// ── Main: createScene ──
// ═══════════════════════════════════════

export function createScene(isMobile: boolean): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8e8fa); // horizon color — kills the black band
  scene.fog = new THREE.FogExp2(0xb8daf0, 0.008);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = !isMobile;
  if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ── Build world ──
  buildOcean(scene);
  buildPlatforms(scene, isMobile);
  buildTrees(scene);
  buildFlowers(scene);
  buildMushrooms(scene);
  buildFences(scene);
  buildLanterns(scene);
  buildZonePatches(scene);
  buildPathDots(scene);
  buildSkyDome(scene);
  const clouds = buildClouds(scene);

  // ── Lighting (bright, warm) ──
  scene.add(new THREE.AmbientLight(0x8899bb, 1.2));
  scene.add(new THREE.HemisphereLight(0x88bbff, 0x446633, 0.7));

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
  sun.position.set(15, 25, 10);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
  }
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x99aacc, 0.4);
  fill.position.set(-10, 15, -8);
  scene.add(fill);

  // Zone area lights (softer, warmer)
  const areaLights: [number, number, number, number, number, number][] = [
    [0xa78bfa, 0.5, 18, 0, 6, -18],
    [0x6ee7b7, 0.4, 16, 28, 5, -40],
    [0xfbbf24, 0.4, 16, -28, 5, -40],
    [0xff6b9d, 0.4, 16, 0, 6, -58],
  ];
  areaLights.forEach(([c, intensity, dist, x, y, z]) => {
    const l = new THREE.PointLight(c, intensity, dist);
    l.position.set(x, y, z);
    scene.add(l);
  });

  // ── Pollen/Dust particles (warm gold) ──
  const pCount = isMobile ? 80 : 180;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 100;
    pPos[i * 3 + 1] = 0.5 + Math.random() * 8;
    pPos[i * 3 + 2] = -29 + (Math.random() - 0.5) * 80;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: 0xf5e8a0, size: 0.06, transparent: true, opacity: 0.4,
  })));

  // ── Subtle sky sparkles (replacing stars) ──
  const starCount = isMobile ? 60 : 120;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random()); // upper hemisphere only
    const r = 60 + Math.random() * 20;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.4 + 12;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    // White/golden sparkles
    starColors[i * 3] = 1;
    starColors[i * 3 + 1] = 0.95 + Math.random() * 0.05;
    starColors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.08, transparent: true, opacity: 0.15, vertexColors: true, sizeAttenuation: true,
  })));
  const starBaseColors = new Float32Array(starColors);

  // ── Zone connection lines (subtle) ──
  const lineMat = new THREE.LineBasicMaterial({ color: 0x90b090, transparent: true, opacity: 0.06 });
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.02, a.z),
        new THREE.Vector3((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2),
        new THREE.Vector3(b.x, 0.02, b.z),
      ]), lineMat));
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return {
    scene, camera, renderer,
    particles: { geo: pGeo, count: pCount },
    stars: { geo: starGeo, baseColors: starBaseColors, count: starCount },
    clouds,
  };
}

// ═══════════════════════════════════════
// ── Update Environment ──
// ═══════════════════════════════════════

export function updateEnvironment(
    t: number,
    particles: SceneContext['particles'],
    stars: SceneContext['stars'],
    clouds?: THREE.Group[],
): void {
  // Pollen float
  const pa = particles.geo.attributes.position.array as Float32Array;
  for (let i = 0; i < particles.count; i++) {
    pa[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.002;
    pa[i * 3] += Math.cos(t * 0.25 + i * 0.7) * 0.001;
    if (pa[i * 3 + 1] > 10) pa[i * 3 + 1] = 0.5;
  }
  particles.geo.attributes.position.needsUpdate = true;

  // Sparkle twinkle
  const sCol = stars.geo.getAttribute('color');
  for (let i = 0; i < stars.count; i += 6) {
    const f = 0.6 + Math.sin(t * 1.2 + i * 0.3) * 0.4;
    sCol.array[i * 3] = stars.baseColors[i * 3] * f;
    sCol.array[i * 3 + 1] = stars.baseColors[i * 3 + 1] * f;
    sCol.array[i * 3 + 2] = stars.baseColors[i * 3 + 2] * f;
  }
  sCol.needsUpdate = true;

  // Cloud drift
  if (clouds) {
    clouds.forEach((c, i) => {
      c.position.x += 0.15 * (0.5 + (i % 3) * 0.2) * (1 / 60);
      if (c.position.x > 55) c.position.x = -55;
    });
  }
}