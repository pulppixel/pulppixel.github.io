// Zone monuments, project cubes, proximity activation
import * as THREE from 'three';
import { COMPANIES, PROJECTS, PLATFORMS } from '../core/data';
import { stdBox, glowBox, textSprite } from '../core/helpers';

// --- Types ---

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
  alwaysOn?: boolean;
}

export interface ZonesContext {
  zones: ZoneState[];
  projectMeshes: THREE.Mesh[];
  update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void;
}

// --- Palette ---

const STONE_LT = 0xc8c0b8, WOOD = 0x8a6540, WOOD_LT = 0xb09868;
const PEDESTAL = 0xd8d0c0;

function zoneHeight(x: number, z: number): number {
  for (const p of PLATFORMS) {
    if (Math.abs(p.x - x) < 1 && Math.abs(p.z - z) < 1) return p.h;
  }
  return 0;
}

// --- Factory ---

export function createZones(scene: THREE.Scene, isMobile = false): ZonesContext {
  const zones: ZoneState[] = [];
  const projectMeshes: THREE.Mesh[] = [];
  const zoneAnims: ZoneAnim[] = [];
  let _zIdx = 0;

  function za(obj: Omit<ZoneAnim, 'zone'>): void {
    const a = obj as ZoneAnim;
    a.zone = _zIdx;
    const m = a.mesh as THREE.Mesh;
    if (m.material) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (a.baseEi === undefined && mat.emissiveIntensity !== undefined) a.baseEi = mat.emissiveIntensity;
      if (a.baseOp === undefined && mat.opacity !== undefined) a.baseOp = mat.opacity;
    }
    zoneAnims.push(a);
  }

  // Project cube geometry
  const pcG = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const pcE = new THREE.EdgesGeometry(pcG);

  // --- Build each zone ---

  COMPANIES.forEach((co, zi) => {
    const cx = co.position.x, cz = co.position.z;
    const ph = zoneHeight(cx, cz);

    // Zone ground accent
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

    // Ground rune ring (8 stones)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rs = stdBox(0.25, 0.02, 0.25, co.color);
      (rs.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(co.color);
      (rs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
      (rs.material as THREE.MeshStandardMaterial).transparent = true;
      (rs.material as THREE.MeshStandardMaterial).opacity = 0.6;
      rs.position.set(cx + Math.cos(a) * 2.8, ph + 0.02, cz + Math.sin(a) * 2.8);
      rs.rotation.y = a + Math.PI / 4;
      scene.add(rs);
    }

    // Zone ring
    const rn = new THREE.Mesh(
        new THREE.RingGeometry(3.7, 3.85, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    rn.rotation.x = -Math.PI / 2;
    rn.position.set(cx, ph + 0.09, cz);
    scene.add(rn);

    // Pillar
    const pl = stdBox(0.2, 2.2, 0.2, WOOD);
    pl.position.set(cx, ph + 1.1, cz - 3.6);
    scene.add(pl);

    let pL: THREE.PointLight;
    if (!isMobile) {
      pL = new THREE.PointLight(co.color, 0.2, 5);
      pL.position.set(cx, ph + 2.5, cz - 3.6);
      scene.add(pL);
    } else {
      pL = new THREE.PointLight(co.color, 0, 0); // dummy, no scene.add
    }

    // Fill + burst ring
    const fl = new THREE.Mesh(
        new THREE.CircleGeometry(3.7, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.02, side: THREE.DoubleSide }),
    );
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(cx, ph + 0.01, cz);
    scene.add(fl);

    const burstRing = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.7, 4),
        new THREE.MeshBasicMaterial({
          color: co.color, transparent: true, opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
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

    // Project cubes
    PROJECTS.filter(p => p.co === co.name).forEach(proj => {
      const mt = new THREE.MeshStandardMaterial({
        color: proj.color, emissive: proj.color, emissiveIntensity: 0.15,
        metalness: 0.3, roughness: 0.4,
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

      // Beacon beam
      const beam = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 3, 0.03),
          new THREE.MeshBasicMaterial({ color: proj.color, transparent: true, opacity: 0.08 }),
      );
      beam.position.set(px, ph + 1.8, pz);
      scene.add(beam);

      // Pedestal
      const st = stdBox(0.3, 0.15, 0.3, PEDESTAL);
      st.position.set(px, ph + 0.075, pz);
      scene.add(st);

      scene.add(ms);
      projectMeshes.push(ms);
    });
  });

  // Zone labels
  COMPANIES.forEach(co => {
    const hex = '#' + co.color.toString(16).padStart(6, '0');
    const ph = zoneHeight(co.position.x, co.position.z);
    const label = textSprite(co.name, hex);
    label.position.set(co.position.x, ph + 2.8, co.position.z - 3.6);
    scene.add(label);
  });

  // --- Zone 0: Sacred Tree + Campfire ---
  _zIdx = 0;
  {
    const cx = COMPANIES[3].position.x, cz = COMPANIES[3].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xff6b9d, LEAF = 0xf0a0b8;

    // Sacred tree
    const trunk = stdBox(0.6, 4.0, 0.6, 0x6a4a2a); trunk.position.set(cx, ph + 2.0, cz - 4.5); scene.add(trunk);
    const leafGeo = new THREE.BoxGeometry(1.5, 1.2, 1.5);
    const leafCols = [LEAF, 0xe888a0, LEAF, 0xf5c8d8];
    [[0, 0, 0], [-1.3, -0.2, 0], [1.3, -0.2, 0], [0, -0.2, -1.3],
      [0, -0.2, 1.3], [0, 1.1, 0], [-1, 0.8, 1], [1, 0.8, -1]].forEach(([lx, ly, lz], i) => {
      const leaf = new THREE.Mesh(leafGeo,
          new THREE.MeshStandardMaterial({ color: leafCols[i % leafCols.length], metalness: 0.05, roughness: 0.85 }));
      leaf.castShadow = true;
      leaf.position.set(cx + lx * 1.1, ph + 4.2 + ly, cz - 4.5 + lz * 1.1);
      scene.add(leaf);
    });

    // Floating petals
    [[-1.5, 2.8, -3], [1.5, 3.2, -3], [0, 3.5, -5.5]].forEach(([ox, h, oz], i) => {
      const petal = glowBox(0.2, 0.2, 0.2, COL, 0.3);
      petal.rotation.y = Math.PI / 4;
      petal.position.set(cx + ox, ph + h, cz + oz); scene.add(petal);
      za({ mesh: petal, type: 'float', baseY: ph + h, range: 0.2, speed: 0.5 + i * 0.2, phase: i * 2.0 });
    });

    // Stone circle
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = stdBox(0.4, 0.25, 0.4, STONE_LT);
      stone.position.set(cx + Math.cos(a) * 1.6, ph + 0.12, cz - 2 + Math.sin(a) * 1.6);
      stone.rotation.y = a; scene.add(stone);
    }

    // Campfire
    const log1 = stdBox(0.7, 0.15, 0.15, WOOD); log1.rotation.y = 0.4; log1.position.set(cx, ph + 0.08, cz - 2); scene.add(log1);
    const log2 = stdBox(0.7, 0.15, 0.15, WOOD); log2.rotation.y = -0.4; log2.position.set(cx, ph + 0.2, cz - 2); scene.add(log2);
    const fire = glowBox(0.3, 0.5, 0.3, 0xe88040, 0.55);
    fire.position.set(cx, ph + 0.5, cz - 2); scene.add(fire);
    za({ mesh: fire, type: 'pulse', baseEi: 0.55, range: 0.25, alwaysOn: true });

    if (!isMobile) {
      const fireLight = new THREE.PointLight(0xf5a040, 0.6, 6);
      fireLight.position.set(cx, ph + 1.2, cz - 2); scene.add(fireLight);
    }

    // Flowers around tree
    const flowerCols = [COL, 0xf5d060, 0x88c8e8, 0xe888a0];
    [[-2.5, -3], [2.5, -3], [-3, -5.5], [3, -5.5]].forEach(([fx, fz], i) => {
      const stem = stdBox(0.06, 0.4, 0.06, 0x48a048);
      stem.position.set(cx + fx, ph + 0.2, cz + fz); scene.add(stem);
      const fl = glowBox(0.25, 0.25, 0.25, flowerCols[i], 0.2);
      fl.position.set(cx + fx, ph + 0.48, cz + fz); fl.rotation.y = Math.PI / 4;
      scene.add(fl);
      za({ mesh: fl, type: 'float', baseY: ph + 0.48, range: 0.06, speed: 1.0, phase: i * 1.5 });
    });
  }

  // --- Zone 1: Treasure Isle ---
  _zIdx = 1;
  {
    const cx = COMPANIES[1].position.x, cz = COMPANIES[1].position.z;
    const ph = zoneHeight(cx, cz);
    const GOLD = 0xf5c870;

    const mast = stdBox(0.2, 4.0, 0.2, WOOD); mast.position.set(cx, ph + 2.0, cz - 4.5); scene.add(mast);
    const flag = glowBox(1.2, 0.8, 0.05, 0x6ee7b7, 0.3);
    flag.position.set(cx + 0.7, ph + 3.5, cz - 4.5); scene.add(flag);
    za({ mesh: flag, type: 'float', baseY: ph + 3.5, range: 0.06, speed: 1.5, phase: 0 });

    const chestBody = stdBox(1.2, 0.7, 0.8, WOOD); chestBody.position.set(cx, ph + 0.35, cz - 3.5); scene.add(chestBody);
    const lid = stdBox(1.25, 0.2, 0.85, WOOD_LT); lid.position.set(cx, ph + 0.8, cz - 3.5); lid.rotation.x = -0.25; scene.add(lid);

    [[0, 0.9, 0], [-0.5, 0.2, 0.6], [0.5, 0.2, 0.6], [0, 0.2, -0.6], [0.3, 1.2, 0.2]].forEach(([gx, gy, gz], i) => {
      const g = glowBox(0.45, 0.45, 0.45, GOLD, 0.3);
      g.position.set(cx + gx, ph + gy, cz - 3.5 + gz); scene.add(g);
      if (i === 4) za({ mesh: g, type: 'float', baseY: ph + 1.2, range: 0.15, speed: 0.7, phase: 0 });
    });

    const emerald = glowBox(0.5, 0.5, 0.5, 0x50c878, 0.5);
    emerald.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    emerald.position.set(cx + 3.5, ph + 2.5, cz - 3); scene.add(emerald);
    za({ mesh: emerald, type: 'spin', axis: 'y', speed: 0.8, baseY: ph + 2.5, float: 0.25 });

    if (!isMobile) {
      const treasureLight = new THREE.PointLight(GOLD, 0.6, 6);
      treasureLight.position.set(cx, ph + 1.5, cz - 3.5); scene.add(treasureLight);
    }

    [[-2, -2], [2, -2], [-3, 0], [3, 0], [-1, -5], [1, -5]].forEach(([ox, oz]) => {
      const coin = glowBox(0.25, 0.06, 0.25, GOLD, 0.2);
      coin.position.set(cx + ox, ph + 0.03, cz + oz); scene.add(coin);
    });
  }

  // --- Zone 2: Purple Portal Arch ---
  _zIdx = 2;
  {
    const cx = COMPANIES[0].position.x, cz = COMPANIES[0].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xa78bfa, COL_DK = 0x7c5cbf;

    const pillarL = stdBox(0.4, 3.5, 0.4, COL_DK); pillarL.position.set(cx - 1.8, ph + 1.75, cz - 5); scene.add(pillarL);
    const pillarR = stdBox(0.4, 3.5, 0.4, COL_DK); pillarR.position.set(cx + 1.8, ph + 1.75, cz - 5); scene.add(pillarR);
    const crossbar = stdBox(4.0, 0.35, 0.35, COL_DK); crossbar.position.set(cx, ph + 3.7, cz - 5); scene.add(crossbar);

    const portalFill = glowBox(3.2, 3.0, 0.08, COL, 0.4);
    (portalFill.material as THREE.MeshStandardMaterial).transparent = true;
    (portalFill.material as THREE.MeshStandardMaterial).opacity = 0.15;
    portalFill.position.set(cx, ph + 2.0, cz - 5); scene.add(portalFill);
    za({ mesh: portalFill, type: 'pulse', baseOp: 0.15, range: 0.08 });

    [[cx, ph + 4.5, cz - 5], [cx - 3.2, ph + 2.0, cz - 3.5], [cx + 3.2, ph + 2.0, cz - 3.5]].forEach(([x, y, z], i) => {
      const cry = glowBox(0.4, 0.6, 0.4, COL, 0.5);
      cry.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      cry.position.set(x, y, z); scene.add(cry);
      za({ mesh: cry, type: 'spin', axis: 'y', speed: 0.6 + i * 0.3, baseY: y, float: 0.15 + i * 0.05 });
    });

    [[-2, -3], [2, -3], [-3, -1], [3, -1]].forEach(([ox, oz]) => {
      const rune = glowBox(0.3, 0.08, 0.3, COL, 0.2);
      rune.position.set(cx + ox, ph + 0.04, cz + oz); rune.rotation.y = Math.PI / 4;
      scene.add(rune);
    });

    if (!isMobile) {
      const portalLight = new THREE.PointLight(COL, 0.8, 8);
      portalLight.position.set(cx, ph + 2.5, cz - 4.5); scene.add(portalLight);
    }
  }

  // --- Zone 3: Beacon Peak ---
  _zIdx = 3;
  {
    const cx = COMPANIES[2].position.x, cz = COMPANIES[2].position.z;
    const ph = zoneHeight(cx, cz);
    const COL = 0xfbbf24, CRYSTAL = 0x50c8d8;

    [1.6, 1.2, 0.8].forEach((w, i) => {
      const b = stdBox(w, 0.5, w, STONE_LT);
      b.position.set(cx, ph + 0.25 + i * 0.5, cz - 4.5); scene.add(b);
    });

    const crystal = glowBox(0.7, 1.0, 0.7, CRYSTAL, 0.6);
    crystal.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    crystal.position.set(cx, ph + 2.2, cz - 4.5); scene.add(crystal);
    za({ mesh: crystal, type: 'spin', axis: 'y', speed: 0.6, baseY: ph + 2.2, float: 0.2 });

    const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 12, 0.15),
        new THREE.MeshBasicMaterial({ color: CRYSTAL, transparent: true, opacity: 0.08 }),
    );
    beam.position.set(cx, ph + 8, cz - 4.5); scene.add(beam);
    za({ mesh: beam, type: 'pulse', baseOp: 0.08, range: 0.05 });

    [[-2.5, 1.0, -3], [2.5, 0.8, -3], [-1.5, 0.6, -6], [1.5, 0.6, -6]].forEach(([ox, h, oz], i) => {
      const c = glowBox(0.3, h, 0.3, CRYSTAL, 0.35);
      c.rotation.set(0, i * 0.7, (i % 2 === 0 ? 0.15 : -0.15));
      c.position.set(cx + ox, ph + h / 2, cz + oz); scene.add(c);
    });

    if (!isMobile) {
      const beaconLight = new THREE.PointLight(COL, 0.7, 8);
      beaconLight.position.set(cx, ph + 3.0, cz - 4.5); scene.add(beaconLight);
    }
  }

  // --- Update ---

  function update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void {
    const ZONE_R = 8, ZONE_IN = 5;

    // Project cube animation
    for (const m of projectMeshes) {
      const zi = m.userData.zone ?? -1;
      const zp = zi >= 0 ? zones[zi].proximity : 1;

      const isNearest = m === nearestMesh;
      const baseScale = 0.05 + zp * 0.95;
      const ts = isNearest ? baseScale * 1.35 : baseScale;
      m.scale.setScalar(m.scale.x + (ts - m.scale.x) * 0.08);

      m.position.y = m.userData.baseY + Math.sin(t * 1.5 + m.userData.index * 0.8) * 0.18 * zp;
      m.rotation.y = t * 0.5 * (0.2 + zp * 0.8);

      const tei = isNearest ? 0.7 + Math.sin(t * 4) * 0.25 : 0.02 + zp * 0.45;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += (tei - mat.emissiveIntensity) * 0.1;

      const wire = m.children[0] as THREE.LineSegments;
      if (wire?.material) (wire.material as THREE.LineBasicMaterial).opacity = zp * 0.4;
    }

    // Zone proximity
    for (const z of zones) {
      const dx = charPos.x - z.cx, dz = charPos.z - z.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const prox = Math.max(0, Math.min(1, (ZONE_R - dist) / (ZONE_R - ZONE_IN)));
      z.proximity += (prox - z.proximity) * 4 * dt;
      const p = z.proximity;
      const isIn = p > 0.85;
      if (isIn && !z.active) { z.active = true; z.activationTime = t; }
      if (!isIn) z.active = false;

      (z.ring.material as THREE.MeshBasicMaterial).opacity = 0.08 + p * 0.15;
      (z.fill.material as THREE.MeshBasicMaterial).opacity = 0.02 + p * 0.06;
      z.pillarLight.intensity = 0.2 + p * 0.5;

      // Burst ring
      if (z.active && !z.wasActive) {
        z.burstRing.scale.setScalar(1);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.5;
      }
      if (z.active) {
        const age = t - z.activationTime;
        const bp = Math.min(age * 1.2, 1);
        z.burstRing.scale.setScalar(1 + bp * 7);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - bp);
        if (bp >= 1) {
          z.burstRing.scale.setScalar(0);
          (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }
      z.wasActive = z.active;
    }

    // Decoration animations
    for (const a of zoneAnims) {
      const m = a.mesh;
      const p = zones[a.zone].proximity;
      const minS = a.alwaysOn ? 0.8 : 0;
      const tgtS = minS + (1 - minS) * p * p;
      if (m.scale) m.scale.setScalar(m.scale.x + (tgtS - m.scale.x) * 3 * dt);

      if ((m as THREE.Mesh).material) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (a.baseEi !== undefined && a.type !== 'pulse') {
          const minEi = a.alwaysOn ? 0.5 : 0.2;
          mat.emissiveIntensity = a.baseEi * (minEi + (1 - minEi) * p);
        }
      }

      const s = Math.max(0, (p - 0.1) / 0.9);
      if (a.type === 'float') {
        m.position.y = a.baseY! + Math.sin(t * a.speed! + (a.phase || 0)) * a.range! * s;
      } else if (a.type === 'spin') {
        if (a.axis === 'y') m.rotation.y = t * a.speed! * s;
        else m.rotation.x = t * a.speed! * s;
        if (a.float) m.position.y = a.baseY! + Math.sin(t * 0.8) * a.float * s;
      } else if (a.type === 'pulse') {
        const mat = (m as THREE.Mesh).material as any;
        if (a.baseOp !== undefined) mat.opacity = a.baseOp * p + Math.sin(t * 2) * a.range! * p;
        else if (a.baseEi !== undefined) mat.emissiveIntensity = a.baseEi * (0.2 + p * 0.8) + Math.sin(t * 3) * (a.range || 0) * p;
      }
    }
  }

  return { zones, projectMeshes, update };
}