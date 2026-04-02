// ─── 캐릭터 생성 · 애니메이션 ───
import * as THREE from 'three';
import { mk, ae } from './helpers';

export interface Character {
  group: THREE.Group;
  animate(t: number, moving: boolean): void;
}

export function createCharacter(scene: THREE.Scene): Character {
  const ch = new THREE.Group(); scene.add(ch);

  // Body
  const bd = mk(0.38, 0.48, 0.22, 0x111115, 0x6ee7b7, 0.4); bd.position.y = 0.66; ch.add(bd); ae(bd, 0x6ee7b7);
  const cp = mk(0.3, 0.15, 0.01, 0x0a0a0a, 0x6ee7b7, 0.8); cp.position.set(0, 0.72, 0.12); ch.add(cp);
  const belt = mk(0.4, 0.05, 0.24, 0x0a0a0a, 0xa78bfa, 0.6); belt.position.set(0, 0.44, 0); ch.add(belt);
  const buckle = mk(0.08, 0.04, 0.01, 0x111111, 0x6ee7b7, 1.5); buckle.position.set(0, 0.44, 0.13); ch.add(buckle);

  // Head
  const hd = mk(0.3, 0.28, 0.26, 0x111115, 0x6ee7b7, 0.5); hd.position.y = 1.08; ch.add(hd); ae(hd, 0x6ee7b7);
  const vs = mk(0.28, 0.1, 0.02, 0x050508, 0x6ee7b7, 1.2); vs.position.set(0, 1.1, 0.14); ch.add(vs);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.09, 0.06, 0.025);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
  const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.07, 1.1, 0.145); ch.add(eL);
  const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(0.07, 1.1, 0.145); ch.add(eR);
  const eyeGlowL = new THREE.PointLight(0x6ee7b7, 0.3, 1); eyeGlowL.position.set(-0.07, 1.1, 0.2); ch.add(eyeGlowL);
  const eyeGlowR = new THREE.PointLight(0x6ee7b7, 0.3, 1); eyeGlowR.position.set(0.07, 1.1, 0.2); ch.add(eyeGlowR);

  // Ears + Antenna
  const earL = mk(0.04, 0.08, 0.06, 0x0a0a0a, 0xa78bfa, 1.0); earL.position.set(-0.17, 1.1, 0); ch.add(earL);
  const earR = mk(0.04, 0.08, 0.06, 0x0a0a0a, 0xa78bfa, 1.0); earR.position.set(0.17, 1.1, 0); ch.add(earR);
  const antBase = mk(0.03, 0.15, 0.03, 0x111115, 0xa78bfa, 0.4); antBase.position.set(0.08, 1.3, 0); ch.add(antBase);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0x6ee7b7 }));
  antTip.position.set(0.08, 1.4, 0); ch.add(antTip);
  const antLight = new THREE.PointLight(0x6ee7b7, 0.4, 2); antLight.position.set(0.08, 1.45, 0); ch.add(antLight);

  // Shoulders + Arms + Hands
  const shL = mk(0.14, 0.06, 0.15, 0x0a0a0a, 0xa78bfa, 0.7); shL.position.set(-0.26, 0.88, 0); ch.add(shL);
  const shR = mk(0.14, 0.06, 0.15, 0x0a0a0a, 0xa78bfa, 0.7); shR.position.set(0.26, 0.88, 0); ch.add(shR);
  const aL = mk(0.11, 0.38, 0.13, 0x111115, 0xa78bfa, 0.4); aL.position.set(-0.29, 0.66, 0); ch.add(aL);
  const aR = mk(0.11, 0.38, 0.13, 0x111115, 0xa78bfa, 0.4); aR.position.set(0.29, 0.66, 0); ch.add(aR);
  const hL = mk(0.08, 0.08, 0.08, 0x0a0a0a, 0x6ee7b7, 0.8); hL.position.set(-0.29, 0.44, 0); ch.add(hL);
  const hR = mk(0.08, 0.08, 0.08, 0x0a0a0a, 0x6ee7b7, 0.8); hR.position.set(0.29, 0.44, 0); ch.add(hR);

  // Legs + Knees + Shoes + Soles
  const lL = mk(0.13, 0.38, 0.15, 0x111115, 0x6ee7b7, 0.2); lL.position.set(-0.11, 0.22, 0); ch.add(lL);
  const lR = mk(0.13, 0.38, 0.15, 0x111115, 0x6ee7b7, 0.2); lR.position.set(0.11, 0.22, 0); ch.add(lR);
  const kneeL = mk(0.08, 0.06, 0.02, 0x0a0a0a, 0x6ee7b7, 0.6); kneeL.position.set(-0.11, 0.28, 0.09); ch.add(kneeL);
  const kneeR = mk(0.08, 0.06, 0.02, 0x0a0a0a, 0x6ee7b7, 0.6); kneeR.position.set(0.11, 0.28, 0.09); ch.add(kneeR);
  const sL = mk(0.14, 0.06, 0.2, 0x0a0a0a, 0xa78bfa, 0.6); sL.position.set(-0.11, 0.03, 0.02); ch.add(sL);
  const sR = mk(0.14, 0.06, 0.2, 0x0a0a0a, 0xa78bfa, 0.6); sR.position.set(0.11, 0.03, 0.02); ch.add(sR);
  const soleL = mk(0.14, 0.02, 0.2, 0x000000, 0x6ee7b7, 1.5); soleL.position.set(-0.11, 0.005, 0.02); ch.add(soleL);
  const soleR = mk(0.14, 0.02, 0.2, 0x000000, 0x6ee7b7, 1.5); soleR.position.set(0.11, 0.005, 0.02); ch.add(soleR);

  // Backpack
  const bpBody = mk(0.24, 0.3, 0.12, 0x0e0e12, 0xa78bfa, 0.3); bpBody.position.set(0, 0.72, -0.18); ch.add(bpBody); ae(bpBody, 0xa78bfa);
  const bpScreen = mk(0.16, 0.08, 0.01, 0x000000, 0x6ee7b7, 1.8); bpScreen.position.set(0, 0.76, -0.25); ch.add(bpScreen);
  const bpLight = new THREE.PointLight(0x6ee7b7, 0.3, 1.5); bpLight.position.set(0, 0.76, -0.3); ch.add(bpLight);

  // Character light + shadow
  const cLight = new THREE.PointLight(0x6ee7b7, 1.2, 5); cLight.position.y = 1.5; ch.add(cLight);
  const cSh = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 }));
  cSh.rotation.x = -Math.PI / 2; cSh.position.y = 0.005; ch.add(cSh);

  // ── Animate ──
  function animate(t: number, moving: boolean): void {
    const wp = moving ? t * 10 : 0, sw = moving ? Math.sin(wp) : 0;

    // Walk cycle
    lL.rotation.x = sw * 0.5; lR.rotation.x = -sw * 0.5;
    sL.rotation.x = sw * 0.3; sR.rotation.x = -sw * 0.3;
    kneeL.rotation.x = sw * 0.3; kneeR.rotation.x = -sw * 0.3;

    // Breathe / bob
    const breathe = Math.sin(t * 2) * 0.015;
    const idleSway = Math.sin(t * 0.8) * 0.02;
    const bob = moving ? Math.abs(Math.sin(wp)) * 0.05 : breathe;

    // Vertical offsets
    bd.position.y = 0.66 + bob; hd.position.y = 1.08 + bob; vs.position.y = 1.1 + bob; cp.position.y = 0.72 + bob;
    eL.position.y = 1.1 + bob; eR.position.y = 1.1 + bob;
    belt.position.y = 0.44 + bob * 0.5; buckle.position.y = 0.44 + bob * 0.5;
    bpBody.position.y = 0.72 + bob; bpScreen.position.y = 0.76 + bob;
    shL.position.y = 0.88 + bob; shR.position.y = 0.88 + bob;
    earL.position.y = 1.1 + bob; earR.position.y = 1.1 + bob;
    antBase.position.y = 1.3 + bob; antTip.position.y = 1.4 + bob;

    // Arms
    if (moving) {
      aL.rotation.x = -sw * 0.45; aR.rotation.x = sw * 0.45;
      hL.rotation.x = -sw * 0.45; hR.rotation.x = sw * 0.45;
      aL.rotation.z = 0; aR.rotation.z = 0;
    } else {
      aL.rotation.x = idleSway; aR.rotation.x = -idleSway;
      aL.rotation.z = -0.06; aR.rotation.z = 0.06;
      hL.rotation.x = idleSway; hR.rotation.x = -idleSway;
    }

    // Antenna
    antBase.rotation.z = Math.sin(t * 1.5) * 0.1 + (moving ? sw * 0.08 : 0);
    antTip.position.x = 0.08 + Math.sin(t * 1.5) * 0.015;
    (antTip.material as THREE.MeshBasicMaterial).color.setHSL(0.45, 0.8, 0.5 + Math.sin(t * 3) * 0.15);
    antLight.intensity = 0.3 + Math.sin(t * 3) * 0.15;

    // Backpack screen flicker
    (bpScreen.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 5) * 0.5;
    bpLight.intensity = 0.2 + Math.sin(t * 5) * 0.1;

    // Shoe sole glow
    (soleL.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + (moving ? Math.abs(sw) * 0.5 : Math.sin(t * 2) * 0.2);
    (soleR.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + (moving ? Math.abs(-sw) * 0.5 : Math.sin(t * 2) * 0.2);

    // Eye blink
    const blinkCycle = t % 3.5;
    const isBlinking = blinkCycle > 3.2 && blinkCycle < 3.4;
    eL.scale.y = isBlinking ? 0 : 1; eR.scale.y = isBlinking ? 0 : 1;
    eL.visible = !isBlinking; eR.visible = !isBlinking;
    eyeGlowL.intensity = isBlinking ? 0 : 0.3;
    eyeGlowR.intensity = isBlinking ? 0 : 0.3;
    // Double blink
    const dblBlink = t % 7 > 6.6 && t % 7 < 6.75;
    if (dblBlink) { eL.visible = false; eR.visible = false; eyeGlowL.intensity = 0; eyeGlowR.intensity = 0; }
  }

  return { group: ch, animate };
}
