// ─── 존 · 프로젝트 큐브 · 자연 데코 ───
// Bright voxel world version
import * as THREE from 'three';
import { COMPANIES, PROJECTS, PLATFORMS } from './data';
import { mk, ae, mkGlow, makeTextSprite } from './helpers';

export interface ZoneState {
  cx: number; cz: number; color: number;
  platform: THREE.Mesh; ring: THREE.Mesh; fill: THREE.Mesh;
  pillarLight: THREE.PointLight; pillar: THREE.Mesh; burstRing: THREE.Mesh;
  active: boolean; wasActive: boolean; activationTime: number; proximity: number;
}

interface ZoneAnim {
  mesh: THREE.Object3D; zone: number; type: string;
  baseY?: number; range?: number; speed?: number; phase?: number;
  axis?: string; float?: number; baseOp?: number; baseEi?: number;
}

export interface ZonesContext {
  zones: ZoneState[];
  projectMeshes: THREE.Mesh[];
  update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void;
}

// ═══════════════════════════════════════
// ── Palette ──
// ═══════════════════════════════════════

const STONE_LT = 0xc8c0b8, WOOD = 0x8a6540, WOOD_LT = 0xb09868;
const WARM = 0xf5c870, PINK = 0xf0a0b8, TEAL = 0x50c8d8;
const PEDESTAL = 0xd8d0c0;

function zoneHeight(x: number, z: number): number {
  for (const p of PLATFORMS) {
    if (Math.abs(p.x - x) < 1 && Math.abs(p.z - z) < 1) return p.h;
  }
  return 0;
}

/** Natural colored box */
function nb(w: number, h: number, d: number, c: number): THREE.Mesh {
  const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, metalness: 0.05, roughness: 0.85 }),
  );
  m.castShadow = true;
  return m;
}

/** Gem/accent box — subtle glow for special items */
function gem(w: number, h: number, d: number, c: number, ei = 0.2): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: ei, metalness: 0.25, roughness: 0.45 }),
  );
}

// ═══════════════════════════════════════
// ── Create Zones ──
// ═══════════════════════════════════════

export function createZones(scene: THREE.Scene): ZonesContext {
  const zones: ZoneState[] = [];
  const projectMeshes: THREE.Mesh[] = [];
  const zoneAnims: ZoneAnim[] = [];
  let _zIdx = 0;

  function za(obj: Omit<ZoneAnim, 'zone'>): void {
    const a = obj as ZoneAnim; a.zone = _zIdx;
    const m = a.mesh as THREE.Mesh;
    if (m.material) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (a.baseEi === undefined && mat.emissiveIntensity !== undefined) a.baseEi = mat.emissiveIntensity;
      if (a.baseOp === undefined && mat.opacity !== undefined) a.baseOp = mat.opacity;
    }
    zoneAnims.push(a);
  }

  // Project cube geometry (diamond)
  const pcG = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const pcE = new THREE.EdgesGeometry(pcG);

  COMPANIES.forEach((co, zi) => {
    const cx = co.position.x, cz = co.position.z;
    const ph = zoneHeight(cx, cz);

    // Zone-colored ground accent (존별 테마 적용)
    const pf = new THREE.Mesh(
        new THREE.BoxGeometry(7.6, 0.06, 7.6),
        new THREE.MeshStandardMaterial({
          color: co.color, metalness: 0.15, roughness: 0.7,
          emissive: new THREE.Color(co.color), emissiveIntensity: 0.03,
          transparent: true, opacity: 0.2,
        }),
    );
    pf.position.set(cx, ph + 0.04, cz);
    pf.receiveShadow = true;
    scene.add(pf);

    // Zone ground rune ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rs = nb(0.5, 0.04, 0.5, co.color);
      (rs.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(co.color);
      (rs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08;
      rs.position.set(cx + Math.cos(a) * 2.8, ph + 0.03, cz + Math.sin(a) * 2.8);
      rs.rotation.y = a;
      scene.add(rs);
    }

    // Zone ring (colored, on grass)
    const rn = new THREE.Mesh(
        new THREE.RingGeometry(3.7, 3.85, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    rn.rotation.x = -Math.PI / 2;
    rn.position.set(cx, ph + 0.09, cz);
    scene.add(rn);

    // Pillar (wooden post)
    const pl = nb(0.2, 2.2, 0.2, WOOD);
    pl.position.set(cx, ph + 1.1, cz - 3.6);
    scene.add(pl);

    // Pillar light
    const pL = new THREE.PointLight(co.color, 0.2, 5);
    pL.position.set(cx, ph + 2.5, cz - 3.6);
    scene.add(pL);

    // Activation fill
    const fl = new THREE.Mesh(
        new THREE.CircleGeometry(3.7, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.02, side: THREE.DoubleSide }),
    );
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(cx, ph + 0.01, cz);
    scene.add(fl);

    // Burst ring
    const burstRing = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.7, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    burstRing.rotation.x = -Math.PI / 2;
    burstRing.position.set(cx, ph + 0.12, cz);
    burstRing.scale.setScalar(0);
    scene.add(burstRing);

    zones.push({
      cx, cz, color: co.color, platform: pf, ring: rn, fill: fl,
      pillarLight: pL, pillar: pl, burstRing,
      active: false, wasActive: false, activationTime: 0, proximity: 0,
    });

    // ── Project Cubes (gem diamonds) ──
    PROJECTS.filter(p => p.co === co.name).forEach(proj => {
      const mt = new THREE.MeshStandardMaterial({
        color: proj.color,
        emissive: proj.color,
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.4,
      });
      const ms = new THREE.Mesh(pcG, mt);
      const px = cx + proj.off.x * 1.8, pz = cz + proj.off.z * 1.8;
      const cubeBaseY = ph + 0.8;
      ms.position.set(px, cubeBaseY, pz);
      ms.castShadow = true;
      ms.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      ms.userData = { project: proj, baseY: cubeBaseY, index: projectMeshes.length, zone: zi };
      ms.add(new THREE.LineSegments(pcE,
          new THREE.LineBasicMaterial({ color: proj.color, transparent: true, opacity: 0.3 })));

      // Ground glow ring
      const glowRing = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 0.65, 16),
          new THREE.MeshBasicMaterial({ color: proj.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.set(px, ph + 0.02, pz);
      scene.add(glowRing);

      // Thin beacon beam
      const beam = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 3, 0.03),
          new THREE.MeshBasicMaterial({ color: proj.color, transparent: true, opacity: 0.08 }),
      );
      beam.position.set(px, ph + 1.8, pz);
      scene.add(beam);

      // Stone pedestal
      const st = nb(0.3, 0.15, 0.3, PEDESTAL);
      st.position.set(px, ph + 0.075, pz);
      scene.add(st);

      scene.add(ms);
      projectMeshes.push(ms);
    });
  });

  // ── Labels ──
  COMPANIES.forEach(co => {
    const hex = '#' + co.color.toString(16).padStart(6, '0');
    const ph = zoneHeight(co.position.x, co.position.z);
    const label = makeTextSprite(co.name, hex);
    label.position.set(co.position.x, ph + 2.8, co.position.z - 3.6);
    scene.add(label);
  });

  // ═══════════════════════════════════════
  // ── Zone Decorations — Monuments ──
  // ═══════════════════════════════════════

  // Zone 0: The Nether (2025-2026) — Purple Portal Arch
  _zIdx = 0;
  {
    const cx = COMPANIES[0].position.x, cz = COMPANIES[0].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xa78bfa, COL_DK = 0x7c5cbf;

    // 포탈 기둥 2개 (높이 3.5)
    const pillarL = nb(0.4, 3.5, 0.4, COL_DK);
    pillarL.position.set(cx - 1.8, ph + 1.75, cz - 5); scene.add(pillarL);
    const pillarR = nb(0.4, 3.5, 0.4, COL_DK);
    pillarR.position.set(cx + 1.8, ph + 1.75, cz - 5); scene.add(pillarR);

    // 포탈 가로대
    const crossbar = nb(4.0, 0.35, 0.35, COL_DK);
    crossbar.position.set(cx, ph + 3.7, cz - 5); scene.add(crossbar);

    // 포탈 내부 빛 (큰 면)
    const portalFill = gem(3.2, 3.0, 0.08, COL, 0.4);
    (portalFill.material as THREE.MeshStandardMaterial).transparent = true;
    (portalFill.material as THREE.MeshStandardMaterial).opacity = 0.15;
    portalFill.position.set(cx, ph + 2.0, cz - 5); scene.add(portalFill);
    za({ mesh: portalFill, type: 'pulse', baseOp: 0.15, range: 0.08 });

    // 떠 있는 크리스탈 3개
    const cryPositions: [number, number, number][] = [
      [cx, ph + 4.5, cz - 5],
      [cx - 3.2, ph + 2.0, cz - 3.5],
      [cx + 3.2, ph + 2.0, cz - 3.5],
    ];
    cryPositions.forEach(([x, y, z], i) => {
      const cry = gem(0.4, 0.6, 0.4, COL, 0.5);
      cry.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      cry.position.set(x, y, z); scene.add(cry);
      za({ mesh: cry, type: 'spin', axis: 'y', speed: 0.6 + i * 0.3, baseY: y, float: 0.15 + i * 0.05 });
    });

    // 바닥 룬 조각
    [[-2, -3], [2, -3], [-3, -1], [3, -1]].forEach(([ox, oz]) => {
      const rune = gem(0.3, 0.08, 0.3, COL, 0.2);
      rune.position.set(cx + ox, ph + 0.04, cz + oz); rune.rotation.y = Math.PI / 4;
      scene.add(rune);
    });

    // 포탈 포인트 라이트
    const portalLight = new THREE.PointLight(COL, 0.8, 8);
    portalLight.position.set(cx, ph + 2.5, cz - 4.5); scene.add(portalLight);
  }

  // Zone 1: Treasure Isle (2023) — Ship Monument
  _zIdx = 1;
  {
    const cx = COMPANIES[1].position.x, cz = COMPANIES[1].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0x6ee7b7, GOLD = 0xf5c870;

    // 돛대 (4 units)
    const mast = nb(0.2, 4.0, 0.2, WOOD);
    mast.position.set(cx, ph + 2.0, cz - 4.5); scene.add(mast);

    // 깃발 (삼각형 근사)
    const flag = gem(1.2, 0.8, 0.05, COL, 0.3);
    flag.position.set(cx + 0.7, ph + 3.5, cz - 4.5); scene.add(flag);
    za({ mesh: flag, type: 'float', baseY: ph + 3.5, range: 0.06, speed: 1.5, phase: 0 });

    // 보물 더미 (중앙, 크게)
    const chestBody = nb(1.2, 0.7, 0.8, WOOD);
    chestBody.position.set(cx, ph + 0.35, cz - 3.5); scene.add(chestBody);
    const lid = nb(1.25, 0.2, 0.85, WOOD_LT);
    lid.position.set(cx, ph + 0.8, cz - 3.5); lid.rotation.x = -0.25; scene.add(lid);

    // 넘치는 금괴
    [[0, 0.9, 0], [-0.5, 0.2, 0.6], [0.5, 0.2, 0.6], [0, 0.2, -0.6], [0.3, 1.2, 0.2]].forEach(([gx, gy, gz], i) => {
      const g = gem(0.45, 0.45, 0.45, GOLD, 0.3);
      g.position.set(cx + gx, ph + gy, cz - 3.5 + gz); scene.add(g);
      if (i === 4) za({ mesh: g, type: 'float', baseY: ph + 1.2, range: 0.15, speed: 0.7, phase: 0 });
    });

    // 떠 있는 에메랄드 (크게)
    const emerald = gem(0.5, 0.5, 0.5, 0x50c878, 0.5);
    emerald.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    emerald.position.set(cx + 3.5, ph + 2.5, cz - 3); scene.add(emerald);
    za({ mesh: emerald, type: 'spin', axis: 'y', speed: 0.8, baseY: ph + 2.5, float: 0.25 });

    // 보물 라이트
    const treasureLight = new THREE.PointLight(GOLD, 0.6, 6);
    treasureLight.position.set(cx, ph + 1.5, cz - 3.5); scene.add(treasureLight);

    // 바닥 동전
    [[-2, -2], [2, -2], [-3, 0], [3, 0], [-1, -5], [1, -5]].forEach(([ox, oz]) => {
      const coin = gem(0.25, 0.06, 0.25, GOLD, 0.2);
      coin.position.set(cx + ox, ph + 0.03, cz + oz);
      scene.add(coin);
    });
  }

  // Zone 2: Beacon Peak (2026) — Crystal Beacon Tower
  _zIdx = 2;
  {
    const cx = COMPANIES[2].position.x, cz = COMPANIES[2].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xfbbf24, CRYSTAL = 0x50c8d8;

    // 타워 베이스 (3단)
    const b1 = nb(1.6, 0.5, 1.6, STONE_LT);
    b1.position.set(cx, ph + 0.25, cz - 4.5); scene.add(b1);
    const b2 = nb(1.2, 0.5, 1.2, STONE_LT);
    b2.position.set(cx, ph + 0.75, cz - 4.5); scene.add(b2);
    const b3 = nb(0.8, 0.5, 0.8, STONE_LT);
    b3.position.set(cx, ph + 1.25, cz - 4.5); scene.add(b3);

    // 크리스탈 (큰 다이아몬드)
    const crystal = gem(0.7, 1.0, 0.7, CRYSTAL, 0.6);
    crystal.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    crystal.position.set(cx, ph + 2.2, cz - 4.5); scene.add(crystal);
    za({ mesh: crystal, type: 'spin', axis: 'y', speed: 0.6, baseY: ph + 2.2, float: 0.2 });

    // 빔 (하늘까지)
    const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 12, 0.15),
        new THREE.MeshBasicMaterial({ color: CRYSTAL, transparent: true, opacity: 0.08 }),
    );
    beam.position.set(cx, ph + 8, cz - 4.5); scene.add(beam);
    za({ mesh: beam, type: 'pulse', baseOp: 0.08, range: 0.05 });

    // 주변 크리스탈 군집
    [[-2.5, 1.0, -3], [2.5, 0.8, -3], [-1.5, 0.6, -6], [1.5, 0.6, -6]].forEach(([ox, h, oz], i) => {
      const c = gem(0.3, h, 0.3, CRYSTAL, 0.35);
      c.rotation.set(0, i * 0.7, (i % 2 === 0 ? 0.15 : -0.15));
      c.position.set(cx + ox, ph + h / 2, cz + oz); scene.add(c);
    });

    // 비콘 라이트
    const beaconLight = new THREE.PointLight(COL, 0.7, 8);
    beaconLight.position.set(cx, ph + 3.0, cz - 4.5); scene.add(beaconLight);
  }

  // Zone 3: Overworld (2019-2022) — Sacred Tree + Campfire Circle
  _zIdx = 3;
  {
    const cx = COMPANIES[3].position.x, cz = COMPANIES[3].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xff6b9d, LEAF = 0xf0a0b8;

    // 큰 나무 (특별한 나무 — 일반 나무보다 크고 핑크)
    const trunk = nb(0.6, 4.0, 0.6, 0x6a4a2a);
    trunk.position.set(cx, ph + 2.0, cz - 4.5); scene.add(trunk);
    // 잎 클러스터 (8개, 핑크)
    const leafGeo = new THREE.BoxGeometry(1.5, 1.2, 1.5);
    const leafCols = [LEAF, 0xe888a0, LEAF, 0xf5c8d8];
    [
      [0, 0, 0], [-1.3, -0.2, 0], [1.3, -0.2, 0], [0, -0.2, -1.3],
      [0, -0.2, 1.3], [0, 1.1, 0], [-1, 0.8, 1], [1, 0.8, -1],
    ].forEach(([lx, ly, lz], i) => {
      const leaf = new THREE.Mesh(leafGeo,
          new THREE.MeshStandardMaterial({ color: leafCols[i % leafCols.length], metalness: 0.05, roughness: 0.85 }));
      leaf.castShadow = true;
      leaf.position.set(cx + lx * 1.1, ph + 4.2 + ly, cz - 4.5 + lz * 1.1);
      scene.add(leaf);
    });

    // 떨어지는 꽃잎 (부유 아이템)
    [[-1.5, 2.8, -3], [1.5, 3.2, -3], [0, 3.5, -5.5]].forEach(([ox, h, oz], i) => {
      const petal = gem(0.2, 0.2, 0.2, COL, 0.3);
      petal.rotation.y = Math.PI / 4;
      petal.position.set(cx + ox, ph + h, cz + oz); scene.add(petal);
      za({ mesh: petal, type: 'float', baseY: ph + h, range: 0.2, speed: 0.5 + i * 0.2, phase: i * 2.0 });
    });

    // 스톤 서클 (캠프파이어 주변)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = nb(0.4, 0.25, 0.4, STONE_LT);
      stone.position.set(cx + Math.cos(a) * 1.6, ph + 0.12, cz - 2 + Math.sin(a) * 1.6);
      stone.rotation.y = a; scene.add(stone);
    }

    // 캠프파이어 (중앙 근처)
    const log1 = nb(0.7, 0.15, 0.15, WOOD);
    log1.rotation.y = 0.4; log1.position.set(cx, ph + 0.08, cz - 2); scene.add(log1);
    const log2 = nb(0.7, 0.15, 0.15, WOOD);
    log2.rotation.y = -0.4; log2.position.set(cx, ph + 0.2, cz - 2); scene.add(log2);
    const fire = gem(0.3, 0.5, 0.3, 0xf08030, 0.9);
    fire.position.set(cx, ph + 0.5, cz - 2); scene.add(fire);
    za({ mesh: fire, type: 'pulse', baseEi: 0.9, range: 0.5 });

    // 캠프파이어 라이트
    const fireLight = new THREE.PointLight(0xf5a040, 0.8, 6);
    fireLight.position.set(cx, ph + 1.2, cz - 2); scene.add(fireLight);

    // 꽃들 (나무 주변)
    const flowerCols = [COL, 0xf5d060, 0x88c8e8, 0xe888a0];
    [[-2.5, -3], [2.5, -3], [-3, -5.5], [3, -5.5]].forEach(([fx, fz], i) => {
      const stem = nb(0.06, 0.4, 0.06, 0x48a048);
      stem.position.set(cx + fx, ph + 0.2, cz + fz); scene.add(stem);
      const fl = gem(0.25, 0.25, 0.25, flowerCols[i], 0.2);
      fl.position.set(cx + fx, ph + 0.48, cz + fz); fl.rotation.y = Math.PI / 4;
      scene.add(fl);
      za({ mesh: fl, type: 'float', baseY: ph + 0.48, range: 0.06, speed: 1.0, phase: i * 1.5 });
    });
  }

  // ═══════════════════════════════════════
  // ── Update ──
  // ═══════════════════════════════════════

  function update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void {
    const ZONE_R = 8, ZONE_IN = 5;

    // Project cube animation
    projectMeshes.forEach((m, i) => {
      const zi = m.userData.zone ?? -1;
      const zp = zi >= 0 ? zones[zi].proximity : 1;

      // proximity 기반 스케일 (0.05 → 1.0) + 가까울 때 확대
      const isNearest = m === nearestMesh;
      const baseScale = 0.05 + zp * 0.95;
      const ts = isNearest ? baseScale * 1.35 : baseScale;
      m.scale.setScalar(m.scale.x + (ts - m.scale.x) * 0.08);

      // 부유 + 회전도 proximity 비례
      m.position.y = m.userData.baseY + Math.sin(t * 1.5 + i * 0.8) * 0.18 * zp;
      m.rotation.y = t * 0.5 * (0.2 + zp * 0.8);

      // glow 강화 (멀면 거의 안 보임, 가까우면 빛남)
      const tei = isNearest ? 0.7 + Math.sin(t * 4) * 0.25 : 0.02 + zp * 0.45;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity +=
          (tei - (m.material as THREE.MeshStandardMaterial).emissiveIntensity) * 0.1;

      // 와이어프레임 opacity
      if (m.children[0] && (m.children[0] as THREE.LineSegments).material)
        ((m.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = zp * 0.4;
    });

    // Zone proximity
    zones.forEach(z => {
      const dx = charPos.x - z.cx, dz = charPos.z - z.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const prox = Math.max(0, Math.min(1, (ZONE_R - dist) / (ZONE_R - ZONE_IN)));
      z.proximity += (prox - z.proximity) * 4 * dt;
      const p = z.proximity;
      const isIn = p > 0.85;
      if (isIn && !z.active) { z.active = true; z.activationTime = t; }
      if (!isIn) z.active = false;

      // Animate zone elements based on proximity
      (z.ring.material as THREE.MeshBasicMaterial).opacity = 0.08 + p * 0.15;
      (z.fill.material as THREE.MeshBasicMaterial).opacity = 0.02 + p * 0.06;
      z.pillarLight.intensity = 0.2 + p * 0.5;

      // Burst ring on activation
      if (z.active && !z.wasActive) {
        z.burstRing.scale.setScalar(1);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.5;
      }
      if (z.active) {
        const age = t - z.activationTime, bp = Math.min(age * 1.8, 1);
        z.burstRing.scale.setScalar(1 + bp * 7);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - bp);
        if (bp >= 1) { z.burstRing.scale.setScalar(0); (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0; }
      }
      z.wasActive = z.active;
    });

    // Decoration animations
    zoneAnims.forEach(a => {
      const m = a.mesh, p = zones[a.zone].proximity;
      const targetScale = p * p;
      if (m.scale) m.scale.setScalar(m.scale.x + (targetScale - m.scale.x) * 3 * dt);

      if ((m as THREE.Mesh).material) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (a.baseEi !== undefined && a.type !== 'pulse')
          mat.emissiveIntensity = a.baseEi * (0.2 + p * 0.8);
      }

      const s = Math.max(0, (p - 0.1) / 0.9);
      if (a.type === 'float')
        m.position.y = a.baseY! + Math.sin(t * a.speed! + (a.phase || 0)) * a.range! * s;
      else if (a.type === 'spin') {
        if (a.axis === 'y') m.rotation.y = t * a.speed! * s;
        else m.rotation.x = t * a.speed! * s;
        if (a.float) m.position.y = a.baseY! + Math.sin(t * 0.8) * a.float * s;
      } else if (a.type === 'pulse') {
        const mat = (m as THREE.Mesh).material as any;
        if (a.baseOp !== undefined)
          mat.opacity = a.baseOp * p + Math.sin(t * 2) * a.range! * p;
        else if (a.baseEi !== undefined)
          mat.emissiveIntensity = a.baseEi * (0.2 + p * 0.8) + Math.sin(t * 3) * (a.range || 0) * p;
      }
    });
  }

  return { zones, projectMeshes, update };
}