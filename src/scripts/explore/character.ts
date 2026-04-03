// ─── 캐릭터 생성 · 애니메이션 ───
// Chibi Minecraft · Lavender Cat-Ear Hoodie
import * as THREE from 'three';

export interface Character {
  group: THREE.Group;
  animate(t: number, moving: boolean, sprinting?: boolean): void;
  /** 착지 스쿼시 트리거 */
  landSquash(): void;
}

export function createCharacter(scene: THREE.Scene): Character {
  const ch = new THREE.Group();
  scene.add(ch);

  const LAV = 0x8B7EB8, LAVDK = 0x6B5E98, LAVLT = 0xA899D4;
  const SKIN = 0xF0DFC8, PANT = 0x3B3960, BOOT = 0x2E2845;
  const BLUSH = 0xE8A0A0, SOLEC = 0x9B8EC4;

  function flat(w: number, h: number, d: number, c: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, metalness: 0.05, roughness: 0.85 }));
    m.castShadow = true; return m;
  }
  function glow(w: number, h: number, d: number, c: number, e: number, ei: number): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, metalness: 0.3, roughness: 0.5 }));
  }

  // ── HEAD ──
  const head = flat(0.50, 0.48, 0.48, SKIN); head.position.y = 1.24; ch.add(head);

  // Hood (z=-0.04 to avoid front Z-fight with face)
  const hood = flat(0.54, 0.30, 0.46, LAV); hood.position.set(0, 1.33, -0.04); ch.add(hood);
  const hoodRim = flat(0.55, 0.06, 0.49, LAVDK); hoodRim.position.set(0, 1.17, -0.03); ch.add(hoodRim);
  const hoodBack = flat(0.50, 0.20, 0.08, LAVDK); hoodBack.position.set(0, 1.04, -0.28); ch.add(hoodBack);

  // Cat ears
  const earGeo = new THREE.BoxGeometry(0.12, 0.16, 0.10);
  const earL = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: LAV, metalness: 0.05, roughness: 0.8 }));
  earL.position.set(-0.16, 1.54, 0.02); earL.rotation.z = 0.15; ch.add(earL);
  const earR = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: LAV, metalness: 0.05, roughness: 0.8 }));
  earR.position.set(0.16, 1.54, 0.02); earR.rotation.z = -0.15; ch.add(earR);
  const earInL = flat(0.06, 0.10, 0.04, BLUSH); earInL.position.set(-0.16, 1.55, 0.06); earInL.rotation.z = 0.15; ch.add(earInL);
  const earInR = flat(0.06, 0.10, 0.04, BLUSH); earInR.position.set(0.16, 1.55, 0.06); earInR.rotation.z = -0.15; ch.add(earInR);

  // ── Face (FZ=0.255 safely clears head front z=0.24) ──
  const FZ = 0.255;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1528, side: THREE.DoubleSide });
  const eL = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), eyeMat); eL.position.set(-0.10, 1.24, FZ); ch.add(eL);
  const eR = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), eyeMat); eR.position.set(0.10, 1.24, FZ); ch.add(eR);

  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const hlL = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), hlMat); hlL.position.set(-0.08, 1.27, FZ + 0.002); ch.add(hlL);
  const hlR = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), hlMat); hlR.position.set(0.12, 1.27, FZ + 0.002); ch.add(hlR);

  const blushMat = new THREE.MeshBasicMaterial({ color: BLUSH, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const blushL = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.04), blushMat); blushL.position.set(-0.18, 1.18, FZ); ch.add(blushL);
  const blushR = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.04), blushMat.clone()); blushR.position.set(0.18, 1.18, FZ); ch.add(blushR);

  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x8B6B6B, side: THREE.DoubleSide }));
  mouth.position.set(0, 1.14, FZ); ch.add(mouth);

  // ── BODY ──
  const torso = flat(0.38, 0.36, 0.24, LAV); torso.position.y = 0.76; ch.add(torso);
  const pocket = flat(0.20, 0.10, 0.01, LAVDK); pocket.position.set(0, 0.65, 0.125); ch.add(pocket);
  const dsL = flat(0.015, 0.12, 0.01, LAVLT); dsL.position.set(-0.04, 0.88, 0.125); ch.add(dsL);
  const dsR = flat(0.015, 0.12, 0.01, LAVLT); dsR.position.set(0.04, 0.88, 0.125); ch.add(dsR);

  // ── ARMS ──
  const armPivotL = new THREE.Group(); armPivotL.position.set(-0.25, 0.90, 0); ch.add(armPivotL);
  const armL = flat(0.13, 0.32, 0.14, LAV); armL.position.y = -0.16; armPivotL.add(armL);
  const handL = flat(0.09, 0.09, 0.09, SKIN); handL.position.y = -0.34; armPivotL.add(handL);

  const armPivotR = new THREE.Group(); armPivotR.position.set(0.25, 0.90, 0); ch.add(armPivotR);
  const armR = flat(0.13, 0.32, 0.14, LAV); armR.position.y = -0.16; armPivotR.add(armR);
  const handR = flat(0.09, 0.09, 0.09, SKIN); handR.position.y = -0.34; armPivotR.add(handR);

  // ── LEGS (sole Y offset fixes Z-fight) ──
  const legPivotL = new THREE.Group(); legPivotL.position.set(-0.09, 0.58, 0); ch.add(legPivotL);
  const legL = flat(0.14, 0.32, 0.15, PANT); legL.position.y = -0.16; legPivotL.add(legL);
  const bootL = flat(0.16, 0.09, 0.19, BOOT); bootL.position.set(0, -0.345, 0.02); legPivotL.add(bootL);
  const soleL = glow(0.16, 0.025, 0.19, 0x1a1528, SOLEC, 0.6); soleL.position.set(0, -0.40, 0.02); legPivotL.add(soleL);

  const legPivotR = new THREE.Group(); legPivotR.position.set(0.09, 0.58, 0); ch.add(legPivotR);
  const legR = flat(0.14, 0.32, 0.15, PANT); legR.position.y = -0.16; legPivotR.add(legR);
  const bootR = flat(0.16, 0.09, 0.19, BOOT); bootR.position.set(0, -0.345, 0.02); legPivotR.add(bootR);
  const soleR = glow(0.16, 0.025, 0.19, 0x1a1528, SOLEC, 0.6); soleR.position.set(0, -0.40, 0.02); legPivotR.add(soleR);

  // ── TAIL ──
  const tailParts: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const t = flat(0.06, 0.06, 0.06, LAV); t.position.set(0, 0.55 - i * 0.06, -0.16 - i * 0.06);
    ch.add(t); tailParts.push(t);
  }
  const tailTip = flat(0.07, 0.07, 0.07, LAVDK); tailTip.position.set(0, 0.31, -0.38); ch.add(tailTip);

  // ── BACKPACK ──
  const bpBody = flat(0.22, 0.18, 0.08, LAVDK); bpBody.position.set(0, 0.82, -0.24); ch.add(bpBody);
  const bpScreen = glow(0.12, 0.06, 0.01, 0x1a1528, LAVLT, 1.0); bpScreen.position.set(0, 0.84, -0.285); ch.add(bpScreen);

  // ── LIGHTS ──
  const cLight = new THREE.PointLight(0xddc8ee, 0.5, 4); cLight.position.y = 1.4; ch.add(cLight);
  const cSh = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0x080810, transparent: true, opacity: 0.3 }));
  cSh.rotation.x = -Math.PI / 2; cSh.position.y = 0.005; ch.add(cSh);

  // ★ 착지 스쿼시 상태
  let squashT = 0;

  function landSquash(): void {
    squashT = 0.18; // 0.18초간 스쿼시
  }

  // ════════════════════════════════════
  function animate(t: number, moving: boolean, sprinting = false): void {
    // ★ 스프린트 시 애니메이션 속도/진폭 증가
    const animSpd = sprinting ? 13 : 9;
    const wp = moving ? t * animSpd : 0, sw = moving ? Math.sin(wp) : 0;

    const swingArm = sprinting ? 0.75 : 0.55;
    const swingLeg = sprinting ? 0.65 : 0.45;
    armPivotL.rotation.x = moving ? -sw * swingArm : Math.sin(t * 1.2) * 0.05;
    armPivotR.rotation.x = moving ? sw * swingArm : -Math.sin(t * 1.2) * 0.05;
    legPivotL.rotation.x = sw * swingLeg;
    legPivotR.rotation.x = -sw * swingLeg;

    // ★ 스프린트 시 앞으로 살짝 기울기
    const leanTarget = sprinting ? 0.12 : 0;
    torso.rotation.x += (leanTarget - torso.rotation.x) * 0.15;

    const bob = moving ? Math.abs(Math.sin(wp)) * (sprinting ? 0.06 : 0.04) : Math.sin(t * 2) * 0.012;

    // ★ 착지 스쿼시 (Y 스케일 줄이고 XZ 늘리기)
    let sqY = 1, sqXZ = 1;
    if (squashT > 0) {
      const p = squashT / 0.18;
      sqY = 1 - p * 0.2;
      sqXZ = 1 + p * 0.12;
      squashT = Math.max(0, squashT - 1 / 60 * 1.2); // ~60fps 기준
    }
    ch.scale.set(sqXZ, sqY, sqXZ);

    head.position.y = 1.24 + bob;
    hood.position.y = 1.33 + bob; hoodRim.position.y = 1.17 + bob; hoodBack.position.y = 1.04 + bob;
    earL.position.y = 1.54 + bob; earR.position.y = 1.54 + bob;
    earInL.position.y = 1.55 + bob; earInR.position.y = 1.55 + bob;
    torso.position.y = 0.76 + bob * 0.6;
    pocket.position.y = 0.65 + bob * 0.6; dsL.position.y = 0.88 + bob * 0.6; dsR.position.y = 0.88 + bob * 0.6;
    armPivotL.position.y = 0.90 + bob * 0.6; armPivotR.position.y = 0.90 + bob * 0.6;
    legPivotL.position.y = 0.58 + bob * 0.3; legPivotR.position.y = 0.58 + bob * 0.3;
    bpBody.position.y = 0.82 + bob * 0.6; bpScreen.position.y = 0.84 + bob * 0.6;

    const fy = 1.24 + bob;
    eL.position.y = fy; eR.position.y = fy;
    hlL.position.y = fy + 0.03; hlR.position.y = fy + 0.03;
    blushL.position.y = 1.18 + bob; blushR.position.y = 1.18 + bob;
    mouth.position.y = 1.14 + bob;

    const bc = t % 3.8;
    const blink = (bc > 3.5 && bc < 3.65) || (t % 7 > 6.7 && t % 7 < 6.85);
    eL.scale.y = blink ? 0.1 : 1; eR.scale.y = blink ? 0.1 : 1;
    hlL.visible = !blink; hlR.visible = !blink;
    (blushMat).opacity = 0.30 + Math.sin(t) * 0.05;

    const twitch = t % 5 > 4.7 && t % 5 < 4.9;
    earR.rotation.z = twitch ? -0.35 : -0.15; earInR.rotation.z = twitch ? -0.35 : -0.15;

    const ta = moving ? (sprinting ? 3 : 2) : 1;
    tailParts.forEach((tp, i) => { tp.position.x = Math.sin(t * 2.5 + i * 0.8) * 0.08 * (i + 1) * 0.5 * ta; });
    tailTip.position.x = Math.sin(t * 2.5 + 3.2) * 0.08 * 2 * ta * 1.2;

    (bpScreen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.2;

    // ★ 스프린트 시 신발 발광 강화
    const soleBase = sprinting ? 1.2 : 0.5;
    const soleBoost = moving ? (sprinting ? 0.5 : 0.2) : 0;
    (soleL.material as THREE.MeshStandardMaterial).emissiveIntensity = soleBase + soleBoost;
    (soleR.material as THREE.MeshStandardMaterial).emissiveIntensity = soleBase + soleBoost;
  }

  return { group: ch, animate, landSquash };
}