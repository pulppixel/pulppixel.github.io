// ─── 존 · 프로젝트 큐브 · 데코레이션 ───
import * as THREE from 'three';
import { COMPANIES, PROJECTS } from './data';
import { mk, ae, mkWire, mkGlow, makeTextSprite } from './helpers';

// ── Types ──
export interface ZoneState {
  cx: number; cz: number; color: number;
  platform: THREE.Mesh; ring: THREE.Mesh; fill: THREE.Mesh;
  pillarLight: THREE.PointLight; pillar: THREE.Mesh; burstRing: THREE.Mesh;
  active: boolean; wasActive: boolean; activationTime: number; proximity: number;
}

interface ZoneAnim {
  mesh: THREE.Object3D; zone: number; type: string;
  baseY?: number; range?: number; speed?: number; phase?: number;
  axis?: string; float?: number; baseOp?: number;
  baseEi?: number;
}

export interface ZonesContext {
  zones: ZoneState[];
  projectMeshes: THREE.Mesh[];
  update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void;
}

export function createZones(scene: THREE.Scene): ZonesContext {
  const zones: ZoneState[] = [];
  const projectMeshes: THREE.Mesh[] = [];
  const zoneAnims: ZoneAnim[] = [];
  let _zIdx = 0;

  // za() — 등록 시 원본 material 값 저장 (곱셈 누적 방지)
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

  // ── Zone infrastructure + Project cubes ──
  const pcG = new THREE.BoxGeometry(0.65, 0.65, 0.65);
  const pcE = new THREE.EdgesGeometry(pcG);

  COMPANIES.forEach((co, zi) => {
    const cx = co.position.x, cz = co.position.z;
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x111115, emissive: co.color, emissiveIntensity: 0.02, metalness: 0.9, roughness: 0.3 }));
    pf.position.set(cx, 0.04, cz); pf.receiveShadow = true; scene.add(pf);
    const rn = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.85, 48), new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.06, side: THREE.DoubleSide }));
    rn.rotation.x = -Math.PI / 2; rn.position.set(cx, 0.09, cz); scene.add(rn);
    const pl = mk(0.08, 2.2, 0.08, 0x111115, co.color, 0.2); pl.position.set(cx, 1.1, cz - 3.6); scene.add(pl);
    const pL = new THREE.PointLight(co.color, 0.15, 5); pL.position.set(cx, 2.5, cz - 3.6); scene.add(pL);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(3.7, 48), new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.01, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.01, cz); scene.add(fl);
    const burstRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 32), new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    burstRing.rotation.x = -Math.PI / 2; burstRing.position.set(cx, 0.12, cz); burstRing.scale.setScalar(0);
    scene.add(burstRing);

    zones.push({ cx, cz, color: co.color, platform: pf, ring: rn, fill: fl, pillarLight: pL, pillar: pl, burstRing, active: false, wasActive: false, activationTime: 0, proximity: 0 });

    PROJECTS.filter(p => p.co === co.name).forEach(proj => {
      const mt = new THREE.MeshStandardMaterial({ color: 0x111115, emissive: proj.color, emissiveIntensity: 0.15, metalness: 0.85, roughness: 0.2 });
      const ms = new THREE.Mesh(pcG, mt);
      const px = cx + proj.off.x * 1.8, pz = cz + proj.off.z * 1.8;
      ms.position.set(px, 0.55, pz); ms.castShadow = true;
      ms.userData = { project: proj, baseY: 0.55, index: projectMeshes.length, zone: zi };
      ms.add(new THREE.LineSegments(pcE, new THREE.LineBasicMaterial({ color: proj.color, transparent: true, opacity: 0.1 })));
      const st = mk(0.06, 0.4, 0.06, 0x111115, proj.color, 0.1); st.position.y = -0.3; ms.add(st);
      const br = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.48, 20), new THREE.MeshBasicMaterial({ color: proj.color, transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
      br.rotation.x = -Math.PI / 2; br.position.set(px, 0.01, pz); scene.add(br);
      scene.add(ms); projectMeshes.push(ms);
    });
  });

  // ── Company labels ──
  COMPANIES.forEach(co => {
    const hex = '#' + co.color.toString(16).padStart(6, '0');
    const label = makeTextSprite(co.name, hex);
    label.position.set(co.position.x, 2.8, co.position.z - 3.6);
    scene.add(label);
  });

  // ═══════════════════════════════════════
  // ── ZONE DECORATIONS ──
  // ═══════════════════════════════════════

  // 2025-2026 — Portal + mini avatars + controller
  _zIdx = 0;
  {
    const cx = 0, cz = -8, c = 0xa78bfa;
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: 0x111115, emissive: c, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.2 }));
    portal.position.set(cx + 5, 2.5, cz); portal.rotation.y = 0.4; scene.add(portal);
    za({ mesh: portal, type: 'spin', axis: 'z', speed: 0.3, baseY: 2.5, float: 0.3 });

    const portalFill = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
    portalFill.position.copy(portal.position); portalFill.rotation.copy(portal.rotation); scene.add(portalFill);
    za({ mesh: portalFill, type: 'pulse', baseOp: 0.04, range: 0.03 });

    for (let i = 0; i < 3; i++) {
      const av = new THREE.Group();
      av.add(mkGlow(new THREE.BoxGeometry(0.12, 0.2, 0.08), c, 0.5));
      const avHead = mkGlow(new THREE.BoxGeometry(0.1, 0.1, 0.08), c, 0.7); avHead.position.y = 0.18; av.add(avHead);
      const avAL = mkGlow(new THREE.BoxGeometry(0.16, 0.05, 0.05), c, 0.4); avAL.position.set(-0.14, 0.05, 0); av.add(avAL);
      const avAR = mkGlow(new THREE.BoxGeometry(0.16, 0.05, 0.05), c, 0.4); avAR.position.set(0.14, 0.05, 0); av.add(avAR);
      av.position.set(cx - 4 + i * 1.5, 1.5 + i * 0.4, cz + 2 - i * 0.5); av.scale.setScalar(0.8 + i * 0.15);
      scene.add(av);
      za({ mesh: av, type: 'float', baseY: av.position.y, range: 0.25, speed: 0.8 + i * 0.3, phase: i * 2 });
    }

    const ctrl = new THREE.Group();
    ctrl.add(mkGlow(new THREE.BoxGeometry(0.5, 0.08, 0.25), c, 0.6));
    const s1 = mkGlow(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), c, 1); s1.position.set(-0.12, 0.06, 0.04); ctrl.add(s1);
    const s2 = mkGlow(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), c, 1); s2.position.set(0.12, 0.06, -0.04); ctrl.add(s2);
    ctrl.position.set(cx - 5, 1.8, cz - 1); ctrl.rotation.set(0.2, 0.5, 0.1); scene.add(ctrl);
    za({ mesh: ctrl, type: 'float', baseY: 1.8, range: 0.2, speed: 1.2, phase: 1 });
  }

  // 2023 — Hexagons + chain links + mini buildings
  _zIdx = 1;
  {
    const cx = 13, cz = -16, c = 0x6ee7b7;
    for (let i = 0; i < 4; i++) {
      const hex = mkWire(new THREE.CylinderGeometry(0.3 + i * 0.1, 0.3 + i * 0.1, 0.05, 6), c, 0.35);
      const angle = (i / 4) * Math.PI * 2;
      hex.position.set(cx + Math.cos(angle) * 4.5, 1.5 + i * 0.5, cz + Math.sin(angle) * 4.5);
      hex.rotation.x = Math.PI / 2; scene.add(hex);
      za({ mesh: hex, type: 'float', baseY: hex.position.y, range: 0.3, speed: 0.6 + i * 0.2, phase: i * 1.5 });
    }
    for (let i = 0; i < 3; i++) {
      const link = mkWire(new THREE.TorusGeometry(0.12, 0.02, 4, 8), c, 0.2);
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      link.position.set(cx + Math.cos(angle) * 4.2, 2 + i * 0.3, cz + Math.sin(angle) * 4.2); scene.add(link);
      za({ mesh: link, type: 'spin', axis: 'y', speed: 1.5, baseY: link.position.y, float: 0.15 });
    }
    ([[0.25, 0.6, 0.25], [0.2, 0.9, 0.2], [0.3, 0.45, 0.3], [0.18, 0.75, 0.18]] as number[][]).forEach((s, i) => {
      const bld = mkGlow(new THREE.BoxGeometry(s[0], s[1], s[2]), c, 0.3);
      const angle = Math.PI * 0.3 + i * 0.5;
      bld.position.set(cx + Math.cos(angle) * 5, s[1] / 2 + 0.08, cz + Math.sin(angle) * 5);
      scene.add(bld); ae(bld, c);
      for (let w = 0; w < 3; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), new THREE.MeshBasicMaterial({ color: c }));
        win.position.set((Math.random() - 0.5) * s[0] * 0.6, (w - 1) * s[1] * 0.25, s[2] / 2 + 0.005);
        bld.add(win);
      }
    });
  }

  // 2026 — Ammo crates + danger markers + crosshair
  _zIdx = 2;
  {
    const cx = -13, cz = -16, c = 0xfbbf24;
    for (let i = 0; i < 3; i++) {
      const crate = mkGlow(new THREE.BoxGeometry(0.35, 0.25, 0.3), c, 0.4);
      const angle = Math.PI * 1.2 + i * 0.7;
      crate.position.set(cx + Math.cos(angle) * 4.8, 0.21, cz + Math.sin(angle) * 4.8);
      crate.rotation.y = Math.random() * 0.5; scene.add(crate); ae(crate, c);
      const strap = mkGlow(new THREE.BoxGeometry(0.3, 0.02, 0.01), c, 1); strap.position.set(0, 0.05, 0.16); crate.add(strap);
    }
    for (let i = 0; i < 2; i++) {
      const triShape = new THREE.BufferGeometry();
      triShape.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.3, 0, -0.2, 0, 0, 0.2, 0, 0]), 3));
      const tri = new THREE.Line(triShape, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.5 }));
      tri.position.set(cx + 5 - i * 10, 2.5, cz + 2 - i); scene.add(tri);
      za({ mesh: tri, type: 'float', baseY: 2.5, range: 0.2, speed: 1, phase: i * 3 });
    }
    const crossG = new THREE.Group();
    crossG.add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.33, 16), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
    crossG.add(mkGlow(new THREE.BoxGeometry(0.5, 0.02, 0.02), c, 1));
    crossG.add(mkGlow(new THREE.BoxGeometry(0.02, 0.5, 0.02), c, 1));
    crossG.position.set(cx - 4.5, 2, cz - 1); scene.add(crossG);
    za({ mesh: crossG, type: 'spin', axis: 'z', speed: 0.5, baseY: 2, float: 0.3 });
  }

  // 2019-2022 — Bouncing spheres + math symbols + sword
  _zIdx = 3;
  {
    const cx = 0, cz = -24, c = 0xff6b9d;
    const ballColors = [0xff6b9d, 0x6ee7b7, 0xa78bfa, 0xfbbf24];
    for (let i = 0; i < 5; i++) {
      const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0x111115, emissive: ballColors[i % 4], emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }),
      );
      const angle = (i / 5) * Math.PI * 2;
      ball.position.set(cx + Math.cos(angle) * 4.5, 0.8 + i * 0.3, cz + Math.sin(angle) * 4.5); scene.add(ball);
      za({ mesh: ball, type: 'bounce', baseY: 0.8 + i * 0.3, range: 0.6, speed: 1.5 + i * 0.3, phase: i * 1.2 });
    }
    ['+', '−', '×', '÷', '=', 'π', '∑'].forEach((sym, i) => {
      const cv = document.createElement('canvas'); const ctx = cv.getContext('2d')!;
      cv.width = 64; cv.height = 64;
      ctx.font = 'bold 40px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff6b9d'; ctx.globalAlpha = 0.5; ctx.fillText(sym, 32, 32);
      const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.scale.set(0.5, 0.5, 1);
      const angle = (i / 7) * Math.PI * 2 + 0.3;
      sp.position.set(cx + Math.cos(angle) * 5.5, 2 + Math.sin(i * 1.5) * 0.5, cz + Math.sin(angle) * 5.5); scene.add(sp);
      za({ mesh: sp, type: 'float', baseY: sp.position.y, range: 0.3, speed: 0.5 + i * 0.15, phase: i * 0.9 });
    });
    const swordG = new THREE.Group();
    swordG.add(mkGlow(new THREE.BoxGeometry(0.04, 0.6, 0.02), c, 1.2));
    const guard = mkGlow(new THREE.BoxGeometry(0.2, 0.04, 0.04), c, 0.8); guard.position.y = -0.28; swordG.add(guard);
    const hilt = mkGlow(new THREE.BoxGeometry(0.05, 0.18, 0.04), 0xfbbf24, 0.6); hilt.position.y = -0.4; swordG.add(hilt);
    swordG.position.set(cx + 5.5, 2.2, cz + 1); swordG.rotation.z = 0.3; scene.add(swordG);
    za({ mesh: swordG, type: 'float', baseY: 2.2, range: 0.25, speed: 0.9, phase: 2 });
  }

  // ═══════════════════════════════════════
  // ── Update (매 프레임) ──
  // ═══════════════════════════════════════
  function update(t: number, dt: number, charPos: THREE.Vector3, nearestMesh: THREE.Mesh | null): void {
    const ZONE_R = 6, ZONE_IN = 4;

    // ── Project cubes ──
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

    // ── Zone proximity + activation ──
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

      // Burst ring
      if (z.active && !z.wasActive) { z.burstRing.scale.setScalar(1); (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.6; }
      if (z.active) {
        const age = t - z.activationTime;
        const bp = Math.min(age * 1.8, 1);
        z.burstRing.scale.setScalar(1 + bp * 7);
        (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - bp);
        if (bp >= 1) { z.burstRing.scale.setScalar(0); (z.burstRing.material as THREE.MeshBasicMaterial).opacity = 0; }
      }
      z.wasActive = z.active;
    });

    // ── Zone decorations — 원본 baseEi/baseOp 기준 (곱셈 누적 방지) ──
    zoneAnims.forEach(a => {
      const m = a.mesh;
      const p = zones[a.zone].proximity;
      const targetScale = 0.15 + p * 0.85;
      if (m.scale) { m.scale.setScalar(m.scale.x + (targetScale - m.scale.x) * 3 * dt); }

      if ((m as THREE.Mesh).material) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (a.baseEi !== undefined && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = a.baseEi * (0.1 + p * 0.9);
        if (a.baseOp !== undefined && mat.opacity !== undefined && a.type !== 'pulse') mat.opacity = a.baseOp * (0.1 + p * 0.9);
      }

      const animStrength = Math.max(0, (p - 0.1) / 0.9);
      if (a.type === 'float') { m.position.y = a.baseY! + Math.sin(t * a.speed! + (a.phase || 0)) * a.range! * animStrength; }
      else if (a.type === 'bounce') { m.position.y = a.baseY! + Math.abs(Math.sin(t * a.speed! + (a.phase || 0))) * a.range! * animStrength; }
      else if (a.type === 'spin') {
        if (a.axis === 'z') m.rotation.z = t * a.speed! * animStrength;
        else if (a.axis === 'y') m.rotation.y = t * a.speed! * animStrength;
        else m.rotation.x = t * a.speed! * animStrength;
        if (a.float) m.position.y = a.baseY! + Math.sin(t * 0.8) * a.float * animStrength;
      } else if (a.type === 'pulse') {
        ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = a.baseOp! * p + Math.sin(t * 2) * a.range! * p;
      }
    });
  }

  return { zones, projectMeshes, update };
}