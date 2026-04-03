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

    // Zone platform overlay (light stone)
    const pf = nb(7.6, 0.15, 7.6, PEDESTAL);
    pf.position.set(cx, ph + 0.12, cz);
    pf.receiveShadow = true;
    scene.add(pf);

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
  // ── Zone Decorations (Nature) ──
  // ═══════════════════════════════════════

  // Zone 0: The Nether (2025-2026) — Garden with flower arch
  _zIdx = 0;
  {
    const cx = COMPANIES[0].position.x, cz = COMPANIES[0].position.z;
    const ph = zoneHeight(cx, cz);

    // Wooden arch
    const archL = nb(0.2, 1.8, 0.2, WOOD);
    archL.position.set(cx + 6.2, ph + 0.9, cz); scene.add(archL);
    const archR = nb(0.2, 1.8, 0.2, WOOD);
    archR.position.set(cx + 7.6, ph + 0.9, cz); scene.add(archR);
    const archTop = nb(1.6, 0.15, 0.25, WOOD);
    archTop.position.set(cx + 6.9, ph + 1.85, cz); scene.add(archTop);
    // Flowers on arch
    const archFlower = gem(0.25, 0.25, 0.25, PINK, 0.15);
    archFlower.position.set(cx + 6.9, ph + 2.0, cz); scene.add(archFlower);
    za({ mesh: archFlower, type: 'float', baseY: ph + 2.0, range: 0.08, speed: 1.0, phase: 0 });

    // Wooden well
    const wellBase = nb(0.8, 0.5, 0.8, WOOD_LT);
    wellBase.position.set(cx - 6, ph + 0.25, cz + 1); scene.add(wellBase);
    const wellWater = gem(0.5, 0.1, 0.5, TEAL, 0.3);
    wellWater.position.set(cx - 6, ph + 0.52, cz + 1); scene.add(wellWater);
    za({ mesh: wellWater, type: 'pulse', baseEi: 0.3, range: 0.15 });
  }

  // Zone 1: Treasure Isle (2023) — Treasure chest & gold
  _zIdx = 1;
  {
    const cx = COMPANIES[1].position.x, cz = COMPANIES[1].position.z;
    const ph = zoneHeight(cx, cz);

    // Treasure chest
    const chestBody = nb(0.7, 0.4, 0.45, WOOD);
    chestBody.position.set(cx + 6, ph + 0.2, cz); scene.add(chestBody);
    const lid = nb(0.72, 0.15, 0.47, WOOD_LT);
    lid.position.set(cx + 6, ph + 0.47, cz); lid.rotation.x = -0.2; scene.add(lid);

    // Gold blocks
    [[0, 0, 0], [0.55, 0, 0], [0, 0, 0.55], [0.25, 0.55, 0.25]].forEach(([gx, gy, gz], i) => {
      const g = gem(0.5, 0.5, 0.5, WARM, 0.25);
      g.position.set(cx + 6 + gx - 0.3, ph + 0.25 + gy, cz - 2 + gz); scene.add(g);
      if (i === 3) za({ mesh: g, type: 'float', baseY: ph + 0.8, range: 0.12, speed: 0.8, phase: 0 });
    });

    // Floating emerald
    const emerald = gem(0.3, 0.3, 0.3, 0x50c878, 0.4);
    emerald.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    emerald.position.set(cx - 5.5, ph + 1.5, cz); scene.add(emerald);
    za({ mesh: emerald, type: 'spin', axis: 'y', speed: 1.0, baseY: ph + 1.5, float: 0.2 });
  }

  // Zone 2: Beacon Peak (2026) — Crystal beacon
  _zIdx = 2;
  {
    const cx = COMPANIES[2].position.x, cz = COMPANIES[2].position.z;
    const ph = zoneHeight(cx, cz);

    // Beacon base (stone stack)
    const base1 = nb(0.9, 0.4, 0.9, STONE_LT);
    base1.position.set(cx + 5, ph + 0.2, cz); scene.add(base1);
    const base2 = nb(0.7, 0.3, 0.7, STONE_LT);
    base2.position.set(cx + 5, ph + 0.55, cz); scene.add(base2);

    // Crystal on top
    const crystal = gem(0.35, 0.5, 0.35, TEAL, 0.5);
    crystal.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    crystal.position.set(cx + 5, ph + 1.1, cz); scene.add(crystal);
    za({ mesh: crystal, type: 'spin', axis: 'y', speed: 0.8, baseY: ph + 1.1, float: 0.15 });

    // Beacon beam
    const beamMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 6, 0.1),
        new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.06 }),
    );
    beamMesh.position.set(cx + 5, ph + 4, cz); scene.add(beamMesh);
    za({ mesh: beamMesh, type: 'pulse', baseOp: 0.06, range: 0.03 });

    // Stone steps
    for (let i = 0; i < 3; i++) {
      const step = nb(0.8, 0.25, 0.8, STONE_LT);
      step.position.set(cx - 4.5 + i * 0.85, ph + 0.125, cz + 1.5); scene.add(step);
    }
  }

  // Zone 3: Overworld (2019-2022) — Campfire & flower garden
  _zIdx = 3;
  {
    const cx = COMPANIES[3].position.x, cz = COMPANIES[3].position.z;
    const ph = zoneHeight(cx, cz);

    // Campfire
    const log1 = nb(0.6, 0.12, 0.12, WOOD);
    log1.rotation.y = 0.4; log1.position.set(cx + 5, ph + 0.06, cz + 1); scene.add(log1);
    const log2 = nb(0.6, 0.12, 0.12, WOOD);
    log2.rotation.y = -0.4; log2.position.set(cx + 5, ph + 0.16, cz + 1); scene.add(log2);
    const fire = gem(0.2, 0.35, 0.2, 0xf08030, 0.8);
    fire.position.set(cx + 5, ph + 0.35, cz + 1); scene.add(fire);
    za({ mesh: fire, type: 'pulse', baseEi: 0.8, range: 0.4 });

    // Campfire light
    const fireLight = new THREE.PointLight(0xf5a040, 0.6, 4);
    fireLight.position.set(cx + 5, ph + 0.8, cz + 1); scene.add(fireLight);

    // Flower garden (colorful small blocks)
    const flowerColors = [PINK, 0xf5d060, 0x88c8e8, PINK, 0xe888a0];
    [[-6, 0.5], [-5.5, -1.2], [-6.5, -0.3], [-5.8, 1.8], [-6.8, 1]].forEach(([fx, fz], i) => {
      const stem = nb(0.06, 0.3, 0.06, 0x48a048);
      stem.position.set(cx + fx, ph + 0.15, cz + fz); scene.add(stem);
      const petal = gem(0.2, 0.2, 0.2, flowerColors[i], 0.15);
      petal.position.set(cx + fx, ph + 0.38, cz + fz); petal.rotation.y = Math.PI / 4; scene.add(petal);
      za({ mesh: petal, type: 'float', baseY: ph + 0.38, range: 0.04, speed: 1.2, phase: i * 1.3 });
    });

    // Wooden cart
    const cartBase = nb(0.8, 0.15, 0.5, WOOD_LT);
    cartBase.position.set(cx - 6.5, ph + 0.25, cz - 1.5); scene.add(cartBase);
    const cartSide1 = nb(0.05, 0.3, 0.5, WOOD);
    cartSide1.position.set(cx - 6.9, ph + 0.4, cz - 1.5); scene.add(cartSide1);
    const cartSide2 = nb(0.05, 0.3, 0.5, WOOD);
    cartSide2.position.set(cx - 6.1, ph + 0.4, cz - 1.5); scene.add(cartSide2);
  }

  // ═══════════════════════════════════════
  // ── Update ──
  // ═══════════════════════════════════════

  function update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void {
    const ZONE_R = 8, ZONE_IN = 5;

    // Project cube animation
    projectMeshes.forEach((m, i) => {
      m.position.y = m.userData.baseY + Math.sin(t * 1.5 + i * 0.8) * 0.18;
      m.rotation.y = t * 0.5;

      const isNearest = m === nearestMesh;
      const ts = isNearest ? 1.35 : 1;
      m.scale.setScalar(m.scale.x + (ts - m.scale.x) * 0.08);

      const zi = m.userData.zone ?? -1;
      const zp = zi >= 0 ? zones[zi].proximity : 0.3;
      const tei = isNearest ? 0.6 + Math.sin(t * 4) * 0.2 : 0.1 + zp * 0.2;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity +=
          (tei - (m.material as THREE.MeshStandardMaterial).emissiveIntensity) * 0.1;

      if (m.children[0] && (m.children[0] as THREE.LineSegments).material)
        ((m.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = 0.2 + zp * 0.2;
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
      const targetScale = 0.3 + p * 0.7;
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