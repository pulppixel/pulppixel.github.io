// ─── 존 · 프로젝트 큐브 · 마크 데코레이션 ───
import * as THREE from 'three';
import { COMPANIES, PROJECTS } from './data';
import { mk, ae, mkWire, mkGlow, makeTextSprite } from './helpers';

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

const LAV = 0x9B8EC4, WARM = 0xFBBF24, PINK = 0xE8A0A0, TEAL = 0x67E8F9;

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

  // ── Zone infra + Project cubes ──
  const pcG = new THREE.BoxGeometry(0.65, 0.65, 0.65);
  const pcE = new THREE.EdgesGeometry(pcG);

  COMPANIES.forEach((co, zi) => {
    const cx = co.position.x, cz = co.position.z;

    const pf = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.15, 7.6),
        new THREE.MeshStandardMaterial({ color: 0x1a1824, emissive: co.color, emissiveIntensity: 0.03, metalness: 0.6, roughness: 0.4 }));
    pf.position.set(cx, 0.04, cz); pf.receiveShadow = true; scene.add(pf);

    const rn = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.85, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.06, side: THREE.DoubleSide }));
    rn.rotation.x = -Math.PI / 2; rn.position.set(cx, 0.09, cz); scene.add(rn);

    const pl = mk(0.2, 2.2, 0.2, 0x1a1824, co.color, 0.2);
    pl.position.set(cx, 1.1, cz - 3.6); scene.add(pl); ae(pl, co.color);

    const pL = new THREE.PointLight(co.color, 0.15, 5);
    pL.position.set(cx, 2.5, cz - 3.6); scene.add(pL);

    const fl = new THREE.Mesh(new THREE.CircleGeometry(3.7, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.01, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.01, cz); scene.add(fl);

    const burstRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 4),
        new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    burstRing.rotation.x = -Math.PI / 2; burstRing.position.set(cx, 0.12, cz); burstRing.scale.setScalar(0);
    scene.add(burstRing);

    zones.push({ cx, cz, color: co.color, platform: pf, ring: rn, fill: fl,
      pillarLight: pL, pillar: pl, burstRing,
      active: false, wasActive: false, activationTime: 0, proximity: 0 });

    // Project cubes
    PROJECTS.filter(p => p.co === co.name).forEach(proj => {
      const mt = new THREE.MeshStandardMaterial({
        color: 0x1a1824, emissive: proj.color, emissiveIntensity: 0.15, metalness: 0.7, roughness: 0.25 });
      const ms = new THREE.Mesh(pcG, mt);
      const px = cx + proj.off.x * 1.8, pz = cz + proj.off.z * 1.8;
      ms.position.set(px, 0.55, pz); ms.castShadow = true;
      ms.userData = { project: proj, baseY: 0.55, index: projectMeshes.length, zone: zi };
      ms.add(new THREE.LineSegments(pcE, new THREE.LineBasicMaterial({ color: proj.color, transparent: true, opacity: 0.1 })));

      const st = mk(0.3, 0.15, 0.3, 0x1e1c28, proj.color, 0.08);
      st.position.set(px, 0.075, pz); scene.add(st); ae(st, proj.color);

      const br = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.48, 4),
          new THREE.MeshBasicMaterial({ color: proj.color, transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
      br.rotation.x = -Math.PI / 2; br.position.set(px, 0.01, pz); scene.add(br);
      scene.add(ms); projectMeshes.push(ms);
    });
  });

  // Labels
  COMPANIES.forEach(co => {
    const hex = '#' + co.color.toString(16).padStart(6, '0');
    const label = makeTextSprite(co.name, hex);
    label.position.set(co.position.x, 2.8, co.position.z - 3.6); scene.add(label);
  });

  // ══════════════════════════════════════
  // ── ZONE DECORATIONS ──
  // ══════════════════════════════════════

  // Zone 0: 2025-2026 · Nether Portal
  _zIdx = 0;
  {
    const cx = 0, cz = -8;
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x1a1028, emissive: LAV, emissiveIntensity: 0.15, metalness: 0.6, roughness: 0.35 });
    const portalFrame = new THREE.Group();
    const fb = new THREE.BoxGeometry(0.4, 0.4, 0.2);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(fb, obsMat); b.position.set(-0.6 + i * 0.4, 0, 0); portalFrame.add(b);
      const t = new THREE.Mesh(fb, obsMat); t.position.set(-0.6 + i * 0.4, 2.0, 0); portalFrame.add(t);
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(fb, obsMat); l.position.set(-0.6, 0.4 + i * 0.4, 0); portalFrame.add(l);
      const r = new THREE.Mesh(fb, obsMat); r.position.set(0.6, 0.4 + i * 0.4, 0); portalFrame.add(r);
    }
    const portalFill = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6),
        new THREE.MeshBasicMaterial({ color: LAV, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    portalFill.position.set(0, 1.0, 0); portalFrame.add(portalFill);
    portalFrame.position.set(cx + 5, 0.2, cz); portalFrame.rotation.y = 0.3; scene.add(portalFrame);
    za({ mesh: portalFill, type: 'pulse', baseOp: 0.08, range: 0.04 });
    { const _l = new THREE.PointLight(LAV, 0.4, 4); _l.position.set(cx + 5, 1.5, cz); scene.add(_l); }

    const book = mkGlow(new THREE.BoxGeometry(0.3, 0.04, 0.22), WARM, 0.7);
    book.position.set(cx - 4, 1.0, cz + 1); scene.add(book);
    za({ mesh: book, type: 'float', baseY: 1.0, range: 0.2, speed: 0.8, phase: 0 });

    for (let i = 0; i < 2; i++) {
      const shelf = mkGlow(new THREE.BoxGeometry(0.8, 0.8, 0.4), LAV, 0.15);
      shelf.position.set(cx - 5 + i * 1.2, 0.4, cz - 1.5); scene.add(shelf); ae(shelf, LAV);
    }
  }

  // Zone 1: 2023 · Treasure
  _zIdx = 1;
  {
    const cx = 13, cz = -16;
    const goldMat = new THREE.MeshStandardMaterial({ color: 0x3a2a08, emissive: WARM, emissiveIntensity: 0.4, metalness: 0.75, roughness: 0.2 });
    const goldGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    [[0,0,0],[0.6,0,0],[0,0,0.6],[0.3,0.6,0.3]].forEach(([gx, gy, gz], i) => {
      const g = new THREE.Mesh(goldGeo, goldMat);
      g.position.set(cx + 4.5 + gx, 0.3 + gy, cz + gz); scene.add(g);
      if (i === 3) za({ mesh: g, type: 'float', baseY: 0.9, range: 0.15, speed: 1.0, phase: 0 });
    });
    { const _l = new THREE.PointLight(WARM, 0.3, 3); _l.position.set(cx + 4.8, 1.5, cz + 0.3); scene.add(_l); }

    const chest = new THREE.Group();
    const cb = mkGlow(new THREE.BoxGeometry(0.7, 0.4, 0.45), WARM, 0.25); chest.add(cb); ae(cb, WARM);
    const lid = mkGlow(new THREE.BoxGeometry(0.72, 0.15, 0.47), WARM, 0.3); lid.position.y = 0.27; lid.rotation.x = -0.3; chest.add(lid); ae(lid, WARM);
    const lock = mkGlow(new THREE.BoxGeometry(0.08, 0.1, 0.02), TEAL, 1.0); lock.position.set(0, 0.15, 0.24); chest.add(lock);
    chest.position.set(cx - 4, 0.2, cz + 1); scene.add(chest);

    const emerald = new THREE.Group();
    const ec = mkGlow(new THREE.BoxGeometry(0.25, 0.25, 0.25), TEAL, 0.8);
    ec.rotation.set(Math.PI / 4, 0, Math.PI / 4); emerald.add(ec);
    emerald.position.set(cx - 4, 1.5, cz - 1); scene.add(emerald);
    za({ mesh: emerald, type: 'spin', axis: 'y', speed: 1.2, baseY: 1.5, float: 0.2 });
  }

  // Zone 2: 2026 · Beacon
  _zIdx = 2;
  {
    const cx = -13, cz = -16;
    const beacon = mkGlow(new THREE.BoxGeometry(0.8, 0.5, 0.8), TEAL, 0.5);
    beacon.position.set(cx + 4.5, 0.25, cz); scene.add(beacon); ae(beacon, TEAL);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 8, 0.15),
        new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.06 }));
    beam.position.set(cx + 4.5, 4.5, cz); scene.add(beam);
    za({ mesh: beam, type: 'pulse', baseOp: 0.06, range: 0.03 });
    { const _l = new THREE.PointLight(TEAL, 0.5, 6); _l.position.set(cx + 4.5, 2, cz); scene.add(_l); }

    const crystal = new THREE.Group();
    const cc = mkGlow(new THREE.BoxGeometry(0.35, 0.35, 0.35), TEAL, 1.2);
    cc.rotation.set(Math.PI / 4, 0, Math.PI / 4); crystal.add(cc);
    crystal.add(mkWire(new THREE.BoxGeometry(0.55, 0.55, 0.55), TEAL, 0.25));
    crystal.position.set(cx - 4.5, 2.0, cz - 0.5); scene.add(crystal);
    za({ mesh: crystal, type: 'spin', axis: 'y', speed: 0.8, baseY: 2.0, float: 0.3 });

    for (let i = 0; i < 3; i++) {
      const ob = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x141028, emissive: TEAL, emissiveIntensity: 0.08, metalness: 0.6, roughness: 0.3 }));
      ob.position.set(cx - 4.5 + (i - 1) * 0.85, 0.15, cz + 1.5); scene.add(ob);
    }
  }

  // Zone 3: 2019-2022 · Overworld
  _zIdx = 3;
  {
    const cx = 0, cz = -24;
    const campfire = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x2a1e16, emissive: WARM, emissiveIntensity: 0.1, metalness: 0.1, roughness: 0.85 });
    const logGeo = new THREE.BoxGeometry(0.6, 0.15, 0.15);
    const log1 = new THREE.Mesh(logGeo, logMat); log1.rotation.y = 0.4; campfire.add(log1);
    const log2 = new THREE.Mesh(logGeo, logMat); log2.rotation.y = -0.4; log2.position.y = 0.1; campfire.add(log2);
    const fire = mkGlow(new THREE.BoxGeometry(0.2, 0.3, 0.2), WARM, 1.5); fire.position.y = 0.25; campfire.add(fire);
    campfire.position.set(cx + 5, 0.1, cz + 1); scene.add(campfire);
    za({ mesh: fire, type: 'pulse', baseEi: 1.5, range: 0.6 });
    { const _l = new THREE.PointLight(WARM, 0.5, 4); _l.position.set(cx + 5, 0.8, cz + 1); scene.add(_l); }

    const fColors = [PINK, WARM, LAV, PINK, LAV];
    [[-4.5, 0.5], [-3.8, -1], [-5.2, -0.5], [-4, 1.5], [-5, 1]].forEach(([fx, fz], i) => {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x1a2e20, metalness: 0.1, roughness: 0.8 }));
      stem.position.set(cx + fx, 0.15, cz + fz); scene.add(stem);
      const petal = mkGlow(new THREE.BoxGeometry(0.18, 0.18, 0.18), fColors[i], 0.5);
      petal.position.set(cx + fx, 0.38, cz + fz); petal.rotation.y = Math.PI / 4; scene.add(petal);
      za({ mesh: petal, type: 'float', baseY: 0.38, range: 0.05, speed: 1.2, phase: i * 1.3 });
    });

    const jukebox = mkGlow(new THREE.BoxGeometry(0.6, 0.6, 0.6), PINK, 0.25);
    jukebox.position.set(cx + 5, 0.3, cz - 1.5); scene.add(jukebox); ae(jukebox, PINK);
    const note = mkGlow(new THREE.BoxGeometry(0.15, 0.15, 0.15), PINK, 0.9);
    note.rotation.set(Math.PI / 4, 0, Math.PI / 4); note.position.set(cx + 5, 1.2, cz - 1.5); scene.add(note);
    za({ mesh: note, type: 'float', baseY: 1.2, range: 0.3, speed: 0.9, phase: 2 });

    const swordG = new THREE.Group();
    swordG.add(mkGlow(new THREE.BoxGeometry(0.06, 0.7, 0.03), PINK, 0.8));
    const guard = mkGlow(new THREE.BoxGeometry(0.2, 0.05, 0.05), WARM, 0.6); guard.position.y = -0.3; swordG.add(guard);
    swordG.position.set(cx - 5, 1.8, cz); swordG.rotation.z = 0.3; scene.add(swordG);
    za({ mesh: swordG, type: 'float', baseY: 1.8, range: 0.2, speed: 0.7, phase: 1 });

    const pickG = new THREE.Group();
    pickG.add(mkGlow(new THREE.BoxGeometry(0.06, 0.6, 0.03), TEAL, 0.8));
    const pickHead = mkGlow(new THREE.BoxGeometry(0.35, 0.06, 0.05), TEAL, 0.6); pickHead.position.y = 0.3; pickG.add(pickHead);
    pickG.position.set(cx - 5, 1.8, cz); pickG.rotation.z = -0.3; scene.add(pickG);
    za({ mesh: pickG, type: 'float', baseY: 1.8, range: 0.2, speed: 0.7, phase: 1.5 });
  }

  // ══════════════════════════════════════
  // ── Update ──
  // ══════════════════════════════════════
  function update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void {
    const ZONE_R = 6, ZONE_IN = 4;

    projectMeshes.forEach((m, i) => {
      m.position.y = m.userData.baseY + Math.sin(t * 1.5 + i * 0.8) * 0.12;
      m.rotation.y = t * 0.35;
      const isNearest = m === nearestMesh;
      const ts = isNearest ? 1.25 : 1;
      m.scale.setScalar(m.scale.x + (ts - m.scale.x) * 0.08);
      const zi = m.userData.zone ?? -1;
      const zp = zi >= 0 ? zones[zi].proximity : 0.3;
      const tei = isNearest ? 1.2 + Math.sin(t * 4) * 0.4 : zp * 0.6;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity += (tei - (m.material as THREE.MeshStandardMaterial).emissiveIntensity) * 0.1;
      if (m.children[0] && (m.children[0] as THREE.LineSegments).material)
        ((m.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = zp * 0.3;
    });

    zones.forEach(z => {
      const dx = charPos.x - z.cx, dz = charPos.z - z.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const prox = Math.max(0, Math.min(1, (ZONE_R - dist) / (ZONE_R - ZONE_IN)));
      z.proximity += (prox - z.proximity) * 4 * dt;
      const p = z.proximity;
      const isIn = p > 0.85;
      if (isIn && !z.active) { z.active = true; z.activationTime = t; }
      if (!isIn) z.active = false;

      (z.platform.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.02 + p * 0.15;
      (z.ring.material as THREE.MeshBasicMaterial).opacity = 0.06 + p * 0.2;
      (z.fill.material as THREE.MeshBasicMaterial).opacity = 0.01 + p * 0.04;
      z.pillarLight.intensity = 0.15 + p * 0.6;
      (z.pillar.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + p * 0.5;

      if (z.active && !z.wasActive) { z.burstRing.scale.setScalar(1); (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.6; }
      if (z.active) {
        const age = t - z.activationTime, bp = Math.min(age * 1.8, 1);
        z.burstRing.scale.setScalar(1 + bp * 7);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - bp);
        if (bp >= 1) { z.burstRing.scale.setScalar(0); (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0; }
      }
      z.wasActive = z.active;
    });

    zoneAnims.forEach(a => {
      const m = a.mesh, p = zones[a.zone].proximity;
      const targetScale = 0.15 + p * 0.85;
      if (m.scale) m.scale.setScalar(m.scale.x + (targetScale - m.scale.x) * 3 * dt);

      if ((m as THREE.Mesh).material) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (a.baseEi !== undefined && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = a.baseEi * (0.1 + p * 0.9);
        if (a.baseOp !== undefined && mat.opacity !== undefined && a.type !== 'pulse') mat.opacity = a.baseOp * (0.1 + p * 0.9);
      }

      const s = Math.max(0, (p - 0.1) / 0.9);
      if (a.type === 'float') m.position.y = a.baseY! + Math.sin(t * a.speed! + (a.phase || 0)) * a.range! * s;
      else if (a.type === 'bounce') m.position.y = a.baseY! + Math.abs(Math.sin(t * a.speed! + (a.phase || 0))) * a.range! * s;
      else if (a.type === 'spin') {
        if (a.axis === 'z') m.rotation.z = t * a.speed! * s;
        else if (a.axis === 'y') m.rotation.y = t * a.speed! * s;
        else m.rotation.x = t * a.speed! * s;
        if (a.float) m.position.y = a.baseY! + Math.sin(t * 0.8) * a.float * s;
      } else if (a.type === 'pulse') {
        const mat = (m as THREE.Mesh).material as any;
        if (a.baseOp !== undefined) mat.opacity = a.baseOp * p + Math.sin(t * 2) * a.range! * p;
        else if (a.baseEi !== undefined) mat.emissiveIntensity = a.baseEi * (0.1 + p * 0.9) + Math.sin(t * 3) * (a.range || 0) * p;
      }
    });
  }

  return { zones, projectMeshes, update };
}