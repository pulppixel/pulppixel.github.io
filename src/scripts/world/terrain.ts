// Static world geometry: terrain, vegetation, fences, lanterns
// v3: InstancedMesh batching for static repeated elements
//     ~250 draw calls -> ~15 for batched categories
import * as THREE from 'three';
import { COMPANIES, PLATFORMS } from '../core/data';
import { stdMat, stdBox } from '../core/helpers';
import { perf } from '../core/performance';
import { isEdgeConnected } from '../core/collision';

// =============================================
// Instance Batcher
// =============================================

interface IBItem { x: number; y: number; z: number; ry: number; }
interface IBGroup { geo: THREE.BufferGeometry; mat: THREE.Material; items: IBItem[]; shadow: boolean; }

const _ib = new Map<string, IBGroup>();
const _dummy = new THREE.Object3D();

function ib(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, shadow = true): void {
  let g = _ib.get(key);
  if (!g) { g = { geo, mat, items: [], shadow }; _ib.set(key, g); }
  g.items.push({ x, y, z, ry });
}

/** scene.ts에서 모든 build 함수 호출 후 마지막에 호출 */
export function flushInstances(scene: THREE.Scene): void {
  for (const [, g] of _ib) {
    if (g.items.length === 0) continue;
    const im = new THREE.InstancedMesh(g.geo, g.mat, g.items.length);
    for (let i = 0; i < g.items.length; i++) {
      const d = g.items[i];
      _dummy.position.set(d.x, d.y, d.z);
      _dummy.rotation.set(0, d.ry, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = g.shadow;
    im.receiveShadow = true;
    scene.add(im);
  }
  _ib.clear();
}

// =============================================
// Zone Palette (unchanged)
// =============================================

interface ZonePalette {
  grass: number; grassEdge: number;
  stone: number; stoneDark: number;
  dirt: number; rockAccent: number;
}

const PALETTES: Record<string, ZonePalette> = {
  spawn:     { grass: 0x80d880, grassEdge: 0x68c068, stone: 0x8a8598, stoneDark: 0x6a6578, dirt: 0xa08860, rockAccent: 0x9a9088 },
  nether:    { grass: 0x5a8870, grassEdge: 0x487860, stone: 0x706080, stoneDark: 0x504068, dirt: 0x686058, rockAccent: 0x7a6890 },
  treasure:  { grass: 0x78d868, grassEdge: 0x60c050, stone: 0xb8a880, stoneDark: 0x988868, dirt: 0xc8b070, rockAccent: 0xd0c090 },
  beacon:    { grass: 0xa8b850, grassEdge: 0x90a040, stone: 0x988868, stoneDark: 0x787050, dirt: 0xa89058, rockAccent: 0xb8a060 },
  overworld: { grass: 0x90c888, grassEdge: 0x78b070, stone: 0x908898, stoneDark: 0x706878, dirt: 0x987868, rockAccent: 0xa08890 },
  bridge:    { grass: 0x70b870, grassEdge: 0x58a058, stone: 0x8a8598, stoneDark: 0x6a6578, dirt: 0xa08860, rockAccent: 0x9a9088 },
};

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
  if (bestDist > 14) return PALETTES.bridge;
  return PALETTES[bestKey];
}

type LeafType = 'green' | 'orange' | 'pink';
const WOOD = 0x8a6540, WOOD_LT = 0xb09868, BARK = 0x6a4a2a;
const LEAF_GR = 0x4aaa4a, LEAF_DK = 0x3a8a3a;
const LEAF_OR = 0xf09050, LEAF_RD = 0xe87040;
const LEAF_PK = 0xf0a0b8, LEAF_PK2 = 0xe888a0;
const FL_PK = 0xf5a8c0, FL_YL = 0xf0d060, FL_BL = 0x88c8e8;

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

// Platforms

export function buildPlatforms(scene: THREE.Scene): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const pal = getZonePalette(p.x, p.z);

    const stoneH = Math.max(0.1, p.h - 0.12);
    const stone = stdBox(p.w, stoneH, p.d, pal.stone);
    stone.position.set(p.x, stoneH / 2, p.z);
    scene.add(stone);

    const grass = stdBox(p.w + 0.1, 0.12, p.d + 0.1, pal.grass);
    grass.position.set(p.x, p.h - 0.06, p.z);
    scene.add(grass);

    if (perf.edgeWireframes) {
      const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w + 0.1, 0.12, p.d + 0.1)),
          new THREE.LineBasicMaterial({ color: pal.grassEdge, transparent: true, opacity: 0.15 }),
      );
      edge.position.copy(grass.position);
      scene.add(edge);
    }
  }
}

// Trees (잎은 개별 유지 — wind 애니메이션 대상)

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
    // Spawn: 1 작은 나무 (탁 트인 초원)
    [5, 3, 2.5, 'green'],
    // Hub: 밀도 높은 숲 (갈림길 분위기)
    [-7, -14, 5, 'green'], [7, -15, 4.5, 'green'], [-5, -23, 4, 'green'], [6, -22, 3.5, 'green'],
    // Treasure: 2그루만 (해안 절벽, 탁 트인 뷰)
    [24, -36, 3.5, 'green'], [33, -43, 3, 'green'],
    // Nether: 주황/붉은 나무 (어둡고 신비)
    [-33, -36, 5, 'orange'], [-24, -38, 4.5, 'orange'], [-30, -44, 4, 'orange'],
    // Peak: 벚꽃 3그루 (정원, 정돈된 배치)
    [-5, -55, 5, 'pink'], [5, -61, 4.5, 'pink'], [-3, -63, 4, 'pink'],
  ];
  for (const [x, z, h, type] of trees) addTree(scene, x, z, h, type);
}

// =============================================
// Flowers & Grass
// 잔디 tufts + 꽃 줄기 -> BATCHED (wind 미대상)
// 꽃 머리 -> 개별 유지 (wind 대상)
// =============================================

export function buildFlowers(scene: THREE.Scene): void {
  const spots: [number, number][] = [
    // Spawn: 2곳만 (깔끔한 초원)
    [-3, 2], [4, -1],
    // Hub: 풍성 (숲속 분위기)
    [-4, -14], [3, -16], [-6, -21], [5, -20], [0, -17],
    // Treasure: 3곳 (해안가 야생화)
    [25, -37], [31, -39], [23, -41],
    // Nether: 2곳만 (어둡고 척박)
    [-32, -37], [-25, -43],
    // Peak: 4곳 (정원 꽃, 정돈된 배치)
    [-5, -54], [4, -56], [-3, -61], [6, -59],
  ];

  // 공유 geometry (인스턴싱용)
  const tuftGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
  const stemGeo = new THREE.BoxGeometry(0.06, 0.35, 0.06);
  const flowerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  const tuftMat = stdMat(0x58b858);
  const stemMat = stdMat(0x48a048);

  const zoneFlowerColors: Record<string, number[]> = {
    spawn:     [FL_PK, FL_YL, FL_BL, 0xf5c8e0],
    nether:    [0xa78bfa, 0x8080c0, FL_BL, 0xb098d0],
    treasure:  [FL_YL, 0xf0d060, FL_PK, 0xf8e878],
    beacon:    [0xf0c040, 0xe8a830, FL_PK, 0xf8d050],
    overworld: [FL_PK, 0xf5c8e0, 0xf0b0c8, FL_BL],
    bridge:    [FL_PK, FL_YL, FL_BL, 0xf5c8e0],
  };

  spots.forEach(([sx, sz], i) => {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    const pal = getZonePalette(sx, sz);
    const palKey = Object.entries(PALETTES).find(([, v]) => v === pal)?.[0] || 'bridge';
    const colors = zoneFlowerColors[palKey] || zoneFlowerColors.bridge;

    // Grass tufts -> BATCHED
    for (let j = 0; j < 2 + (i % 2); j++) {
      ib('tuft', tuftGeo, tuftMat, sx + (j - 1) * 0.25, base + 0.2, sz + (j % 2) * 0.2);
    }

    // Flower stem -> BATCHED, flower head -> 개별 (wind 대상)
    if (i % 2 === 0) {
      ib('stem', stemGeo, stemMat, sx + 0.3, base + 0.175, sz);

      const flower = new THREE.Mesh(flowerGeo, stdMat(colors[i % colors.length]));
      flower.position.set(sx + 0.3, base + 0.42, sz);
      scene.add(flower);
    }
  });
}

// Mushrooms

export function buildMushrooms(): void {
  // Hub + Nether에만 배치 (숲/신비 분위기)
  const spots: [number, number, number][] = [
    // Hub
    [-6, -20, LEAF_OR], [3, -14, FL_PK],
    // Nether
    [-31, -40, LEAF_OR], [-25, -36, LEAF_OR], [-29, -43, FL_PK],
  ];

  const stemGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
  const capGeo = new THREE.BoxGeometry(0.5, 0.2, 0.5);
  const spotGeo = new THREE.BoxGeometry(0.1, 0.02, 0.1);
  const stemMat = stdMat(0xe0d8c0);
  const spotMat = stdMat(0xfff5e8);

  for (const [sx, sz, col] of spots) {
    if (nearZone(sx, sz, 5)) return;
    const base = getH(sx, sz);
    if (base < 0) return;

    ib('mush-stem', stemGeo, stemMat, sx, base + 0.175, sz);
    ib(`mush-cap-${col}`, capGeo, stdMat(col), sx, base + 0.45, sz);
    ib('mush-spot', spotGeo, spotMat, sx + 0.1, base + 0.57, sz + 0.05);
  }
}

// =============================================
// Rocks (개별 유지 — 각각 다른 크기)
// =============================================

export function buildRocks(scene: THREE.Scene): void {
  for (const p of PLATFORMS) {
    if (p.h <= 0 || p.w < 10) continue;
    const pal = getZonePalette(p.x, p.z);
    const isMain = p.w >= 14;

    // 존별 밀도 조절
    let count: number;
    if (!isMain) { count = 1; }
    else if (pal === PALETTES.spawn) { count = 2; }       // 초원: 적게
    else if (pal === PALETTES.beacon) { count = 8; }      // Nether: 많이 (척박)
    else if (pal === PALETTES.overworld) { count = 3; }   // Peak: 정돈된 돌
    else { count = 5; }                                    // Hub, Treasure: 보통
    const margin = isMain ? 2.0 : 1.0;

    for (let i = 0; i < count; i++) {
      const seed = hash(p.x * 7.3 + i * 13.1, p.z * 11.7 + i * 17.3);
      const seed2 = hash(p.x + i * 31, p.z + i * 47);
      const rx = p.x + (seed - 0.5) * (p.w - margin * 2);
      const rz = p.z + (seed2 - 0.5) * (p.d - margin * 2);
      if (nearZone(rx, rz, 4)) continue;

      const sz = 0.2 + seed * 0.25;
      const rock = stdBox(sz, sz * 0.65, sz * (0.8 + seed2 * 0.4), pal.rockAccent);
      rock.position.set(rx, p.h + sz * 0.32, rz);
      rock.rotation.y = seed * Math.PI * 2;
      rock.castShadow = true;
      scene.add(rock);

      if (seed > 0.6) {
        const peb = stdBox(sz * 0.4, sz * 0.3, sz * 0.4, pal.stone);
        peb.position.set(rx + sz * 0.6, p.h + sz * 0.15, rz + sz * 0.3);
        scene.add(peb);
      }
    }
  }
}

// =============================================
// Fences
// walls, posts, corners -> BATCHED
// hedges, hedge flowers, corner balls -> 개별 (wind 대상)
// rails -> 개별 (각각 다른 길이)
// =============================================

export function buildFences(scene: THREE.Scene): void {
  const STEP = 1.15;

  // 공유 geometry
  const wallGeo = new THREE.BoxGeometry(1.1, 0.30, 0.28);
  const hedgeGeo = new THREE.BoxGeometry(1.15, 0.38, 0.44);
  const postGeo = new THREE.BoxGeometry(0.16, 0.70, 0.16);
  const cornerGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
  const flowerGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  // 공유 material (캐시 활용)
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
    if (p.h <= 0 || p.w < 10) continue;
    const hw = p.w / 2, hd = p.d / 2;
    const isMain = p.w >= 14;
    const zk = getZonePalette(p.x, p.z);

    // Spawn: 펜스 없음 (탁 트인 초원)
    if (isMain && zk === PALETTES.spawn) continue;

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
        const ry = runsZ ? Math.PI / 2 : 0;

        if (isMain) {
          if (zk === PALETTES.treasure) {
            // Treasure: 나무 기둥만 (해안/부두 느낌)
            if (i % 2 === 0) ib('fp', postGeo, postMat, fx, p.h + 0.35, fz);
          } else if (zk === PALETTES.beacon) {
            // Nether: 돌벽만 (어둡고 무거움), hedge 없음
            ib(h > 0.5 ? 'fw' : 'fwl', wallGeo, h > 0.5 ? wallMat : wallLtMat, fx, p.h + 0.15, fz, ry);
          } else if (zk === PALETTES.overworld) {
            // Peak: 낮은 돌 보더 듬성듬성 (젠 가든, 미니멀)
            if (i % 3 === 0) ib('fwl', wallGeo, wallLtMat, fx, p.h + 0.15, fz, ry);
          } else {
            // Hub: 돌벽 + hedge (기존 스타일 유지)
            ib(h > 0.5 ? 'fw' : 'fwl', wallGeo, h > 0.5 ? wallMat : wallLtMat, fx, p.h + 0.15, fz, ry);
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
          }
        } else if (i % 2 === 0) {
          // Small platform post -> BATCHED
          ib('fp', postGeo, postMat, fx, p.h + 0.35, fz);
        }
      }

      if (runStart !== null) openRuns.push({ start: runStart, end: edge.to });

      // Rails -> 개별 (각각 다른 길이의 geometry)
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

    // Corners
    const corners: [number, number][] = [
      [p.x + hw, p.z + hd], [p.x + hw, p.z - hd],
      [p.x - hw, p.z + hd], [p.x - hw, p.z - hd],
    ];
    for (const [cx, cz] of corners) {
      const connX = isEdgeConnected(cx, cz, 'x', cx > p.x ? 1 : -1, p);
      const connZ = isEdgeConnected(cx, cz, 'z', cz > p.z ? 1 : -1, p);
      if (connX && connZ) continue;

      if (isMain) {
        if (zk === PALETTES.treasure) {
          // Treasure: 나무 기둥
          ib('fp', postGeo, postMat, cx, p.h + 0.35, cz);
        } else if (zk === PALETTES.beacon) {
          // Nether: 코너 돌만
          ib('fc', cornerGeo, cornerMat, cx, p.h + 0.21, cz);
        } else if (zk === PALETTES.overworld) {
          // Peak: 코너 돌만 (미니멀)
          ib('fc', cornerGeo, cornerMat, cx, p.h + 0.21, cz);
        } else {
          // Hub: 코너 돌 + hedge ball
          ib('fc', cornerGeo, cornerMat, cx, p.h + 0.21, cz);
          const ball = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.30, 0.32), hedgeMat);
          ball.position.set(cx, p.h + 0.57, cz);
          ball.castShadow = true;
          scene.add(ball);
        }
      } else {
        // Small platform corner post -> BATCHED
        ib('fp', postGeo, postMat, cx, p.h + 0.35, cz);
      }
    }
  }
}

// Lanterns

export function buildLanterns(scene: THREE.Scene): void {
  // 주요 갈림길에만 배치 (디딤돌 위 과밀 방지)
  const spots: [number, number][] = [
    [0, -4],                           // Spawn->Hub 입구
    [10, -24], [-10, -24], [1, -30],   // Hub 출구 갈림길 3개
    [0, -48],                           // 센터루트 후반
  ];

  const postGeo = new THREE.BoxGeometry(0.12, 1.5, 0.12);
  const lampGeo = new THREE.BoxGeometry(0.3, 0.25, 0.3);
  const postMat = stdMat(WOOD);
  const lampMat = stdMat(0xf5e8c0);

  for (const [lx, lz] of spots) {
    if (nearZone(lx, lz, 4.5)) continue;
    const base = getH(lx, lz);
    if (base < 0) continue;

    ib('lant-post', postGeo, postMat, lx, base + 0.75, lz);
    ib('lant-lamp', lampGeo, lampMat, lx, base + 1.65, lz);

    // PointLight는 instance 불가 -> 개별 유지
    if (perf.edgeWireframes) {
      const light = new THREE.PointLight(0xf5c870, 0.4, 6);
      light.position.set(lx, base + 1.9, lz);
      scene.add(light);
    }
  }
}

// --- Zone Ground Patches (소량, 개별 유지) ---

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

// --- zone palette별 그룹 ---

export function buildPathDots(): void {
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
        ib(`dot-${pal.rockAccent}`, dotGeo, stdMat(pal.rockAccent), px, ph + 0.03, pz);
      }
    }
  }
}