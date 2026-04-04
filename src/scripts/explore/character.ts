// ─── 캐릭터 · 6 랜덤 복셀 스킨 ───
// Crossy Road × 파스텔 치비 · Image 3 (Bunny) 기반 리디자인
import * as THREE from 'three';

export interface Character {
  group: THREE.Group;
  animate(t: number, moving: boolean, sprinting? : boolean, groundY?: number): void;
  landSquash(): void;
  skinName: string;
  skinIndex: number;
}

// ═══════════════════════════════════════
// ── Material Helpers ──
// ═══════════════════════════════════════

/** Standard box — emissive glow in dark world */
function BX(w: number, h: number, d: number, c: number, ei = 0.3): THREE.Mesh {
  const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: ei, metalness: 0.05, roughness: 0.85 }),
  );
  m.castShadow = true;
  return m;
}

/** Skin-tone box — subtler glow */
function SB(w: number, h: number, d: number, c: number): THREE.Mesh {
  return BX(w, h, d, c, 0.15);
}

/** Glow box — dark base, strong emissive */
function GL(w: number, h: number, d: number, c: number, ei = 0.8): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x080810, emissive: c, emissiveIntensity: ei, metalness: 0.3, roughness: 0.5 }),
  );
}

/** Face plane (eyes, mouth, blush) */
function FP(w: number, h: number, c: number, opacity = 1): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: opacity < 1, opacity }),
  );
}

/** Position helper — position is read-only in Three.js r170+ */
function at<T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T {
  m.position.set(x, y, z);
  return m;
}

// ═══════════════════════════════════════
// ── Layout Constants ──
// ═══════════════════════════════════════

const HEAD_Y = 1.02, BODY_Y = 0.56, ARM_Y = 0.68;
const ARM_X = 0.24, LEG_Y = 0.38, LEG_X = 0.09;
const FZ = 0.245; // face plane Z (front of head)

// ═══════════════════════════════════════
// ── Skin Parts Interface ──
// ═══════════════════════════════════════

interface SP {
  eyeL: THREE.Mesh;
  eyeR: THREE.Mesh;
  hlL?: THREE.Mesh;
  hlR?: THREE.Mesh;
  blushMat?: THREE.MeshBasicMaterial;
  tail?: THREE.Mesh[];
  extra?: (t: number, moving: boolean, sprinting: boolean) => void;
}

type Builder = (
    hd: THREE.Group, bd: THREE.Group,
    aL: THREE.Group, aR: THREE.Group,
    lL: THREE.Group, lR: THREE.Group,
    root: THREE.Group,
) => SP;

// ═══════════════════════════════════════
// ── Shared Part Builders ──
// ═══════════════════════════════════════

function addEyes(
    hd: THREE.Group, spacing = 0.09, size = 0.065, yOff = 0,
): { eyeL: THREE.Mesh; eyeR: THREE.Mesh; hlL: THREE.Mesh; hlR: THREE.Mesh } {
  const eyeL = FP(size, size + 0.01, 0x1a1528);
  eyeL.position.set(-spacing, yOff, FZ); hd.add(eyeL);
  const eyeR = FP(size, size + 0.01, 0x1a1528);
  eyeR.position.set(spacing, yOff, FZ); hd.add(eyeR);
  const hlL = FP(0.025, 0.025, 0xffffff);
  hlL.position.set(-spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlL);
  const hlR = FP(0.025, 0.025, 0xffffff);
  hlR.position.set(spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlR);
  return { eyeL, eyeR, hlL, hlR };
}

function addBlush(
    hd: THREE.Group, color: number, spacing = 0.14, yOff = -0.04,
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const bL = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat);
  bL.position.set(-spacing, yOff, FZ); hd.add(bL);
  const bR = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat);
  bR.position.set(spacing, yOff, FZ); hd.add(bR);
  return mat;
}

function addArms(aL: THREE.Group, aR: THREE.Group, armC: number, handC: number): void {
  aL.add(at(BX(0.12, 0.28, 0.13, armC), 0, -0.14, 0));
  aL.add(at(SB(0.08, 0.08, 0.08, handC), 0, -0.32, 0));
  aR.add(at(BX(0.12, 0.28, 0.13, armC), 0, -0.14, 0));
  aR.add(at(SB(0.08, 0.08, 0.08, handC), 0, -0.32, 0));
}

function addLegs(
    lL: THREE.Group, lR: THREE.Group,
    legC: number, bootC: number, soleC: number,
): void {
  const build = (g: THREE.Group) => {
    const leg = BX(0.13, 0.24, 0.14, legC); leg.position.y = -0.12; g.add(leg);
    const boot = BX(0.15, 0.08, 0.17, bootC); boot.position.set(0, -0.30, 0.015); g.add(boot);
    const sole = GL(0.15, 0.025, 0.17, soleC, 0.5); sole.position.set(0, -0.35, 0.015); g.add(sole);
  };
  build(lL); build(lR);
}

// ═══════════════════════════════════════
// 🐰 BUNNY — 파스텔 핑크 토끼 코스튬
// ═══════════════════════════════════════

const buildBunny: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const PK = 0xFFB5C2, DK = 0xE8919F, WH = 0xFFF5F5, SK = 0xF5D6C3, MINT = 0x7ECCAA;

  // Head — pink bunny hood
  hd.add(BX(0.50, 0.48, 0.46, PK));
  // Face window (skin peek)
  const face = SB(0.42, 0.22, 0.02, SK);
  face.position.set(0, -0.06, 0.225); hd.add(face);
  // Green headband
  const band = BX(0.51, 0.045, 0.47, MINT, 0.4);
  band.position.y = 0.06; hd.add(band);

  // Tall ears
  const earL = BX(0.10, 0.26, 0.08, PK);
  earL.position.set(-0.12, 0.37, 0.02); hd.add(earL);
  const earR = BX(0.10, 0.26, 0.08, PK);
  earR.position.set(0.12, 0.37, 0.02); hd.add(earR);
  const earInL = BX(0.05, 0.16, 0.02, DK);
  earInL.position.set(-0.12, 0.38, 0.05); hd.add(earInL);
  const earInR = BX(0.05, 0.16, 0.02, DK);
  earInR.position.set(0.12, 0.38, 0.05); hd.add(earInR);

  // Bunny face on hood (above face window)
  [[-0.07, 0.14], [0.07, 0.14]].forEach(([x, y]) => {
    const e = FP(0.035, 0.035, 0x1a1528); e.position.set(x, y, FZ); hd.add(e);
  });
  const bNose = FP(0.035, 0.025, DK);
  bNose.position.set(0, 0.10, FZ); hd.add(bNose);

  // Character face (in skin window)
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.08, 0.055, -0.06);
  const blushMat = addBlush(hd, 0xFF8AAE, 0.13, -0.10);
  const mouth = FP(0.04, 0.015, DK);
  mouth.position.set(0, -0.12, FZ); hd.add(mouth);

  // Body — pink costume
  bd.add(BX(0.34, 0.26, 0.22, PK));
  const belly = BX(0.20, 0.16, 0.01, WH, 0.15);
  belly.position.z = 0.115; bd.add(belly);

  addArms(aL, aR, PK, SK);
  addLegs(lL, lR, PK, PK, DK);

  // Cotton tail
  const tail = BX(0.10, 0.10, 0.08, WH, 0.4);
  tail.position.set(0, 0.62, -0.20); root.add(tail);

  return {
    eyeL, eyeR, hlL, hlR, blushMat, tail: [tail],
    extra(t, moving) {
      const f = moving ? Math.sin(t * 8) * 0.12 : Math.sin(t * 1.5) * 0.03;
      earL.rotation.z = 0.05 + f;
      earR.rotation.z = -0.05 - Math.sin(moving ? t * 8 + 0.5 : t * 1.5 + 0.5) * (moving ? 0.12 : 0.03);
    },
  };
};

// ═══════════════════════════════════════
// 🐸 FROG — 민트 개구리
// ═══════════════════════════════════════

const buildFrog: Builder = (hd, bd, aL, aR, lL, lR) => {
  const GR = 0x7EC89F, DK = 0x5AA87A, LT = 0xB8E8C8, BELLY = 0xF5E6C3, RED = 0xE85050;

  // Head
  hd.add(BX(0.52, 0.46, 0.44, GR));

  // Big protruding eye bumps
  const bumpL = BX(0.14, 0.14, 0.14, LT, 0.25);
  bumpL.position.set(-0.14, 0.28, 0.08); hd.add(bumpL);
  const bumpR = BX(0.14, 0.14, 0.14, LT, 0.25);
  bumpR.position.set(0.14, 0.28, 0.08); hd.add(bumpR);

  // Pupils on bumps
  const eyeL = FP(0.07, 0.08, 0x1a1528);
  eyeL.position.set(-0.14, 0.28, 0.155); hd.add(eyeL);
  const eyeR = FP(0.07, 0.08, 0x1a1528);
  eyeR.position.set(0.14, 0.28, 0.155); hd.add(eyeR);
  const hlL = FP(0.025, 0.025, 0xffffff);
  hlL.position.set(-0.12, 0.30, 0.157); hd.add(hlL);
  const hlR = FP(0.025, 0.025, 0xffffff);
  hlR.position.set(0.16, 0.30, 0.157); hd.add(hlR);

  // Wide smile + nostrils + cheeks
  hd.add(at(FP(0.16, 0.02, DK), 0, -0.10, FZ));
  hd.add(at(FP(0.02, 0.02, DK), -0.03, -0.02, FZ));
  hd.add(at(FP(0.02, 0.02, DK), 0.03, -0.02, FZ));
  const blushMat = addBlush(hd, RED, 0.16, -0.06);

  // Body
  bd.add(BX(0.34, 0.24, 0.22, GR));
  const belly = BX(0.22, 0.16, 0.01, BELLY, 0.15);
  belly.position.z = 0.115; bd.add(belly);

  // Webbed hands
  const buildFrogArm = (g: THREE.Group) => {
    g.add(at(BX(0.12, 0.26, 0.13, GR), 0, -0.13, 0));
    g.add(at(BX(0.11, 0.06, 0.11, DK, 0.2), 0, -0.30, 0));
  };
  buildFrogArm(aL); buildFrogArm(aR);
  addLegs(lL, lR, GR, DK, GR);

  // Lily pad accessory (floating)
  const lily = GL(0.18, 0.03, 0.18, GR, 0.5);
  lily.position.set(0.28, 0.75, 0); lily.rotation.y = 0.3;

  return {
    eyeL, eyeR, hlL, hlR, blushMat,
    extra(t) {
      // Eye bumps bob independently
      bumpL.position.y = 0.28 + Math.sin(t * 2.5) * 0.015;
      bumpR.position.y = 0.28 + Math.sin(t * 2.5 + 1) * 0.015;
      eyeL.position.y = bumpL.position.y;
      eyeR.position.y = bumpR.position.y;
      hlL.position.y = bumpL.position.y + 0.02;
      hlR.position.y = bumpR.position.y + 0.02;
    },
  };
};

// ═══════════════════════════════════════
// 🐻 BEAR — 코코아 곰돌이
// ═══════════════════════════════════════

const buildBear: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const BR = 0xC4956A, DK = 0x8B6540, LT = 0xDDB88A, CREAM = 0xE8D0B0, ROSY = 0xFF9090;

  // Head
  hd.add(BX(0.50, 0.48, 0.44, BR));
  // Round ears
  const earL = BX(0.14, 0.12, 0.06, BR);
  earL.position.set(-0.22, 0.22, 0); hd.add(earL);
  const earR = BX(0.14, 0.12, 0.06, BR);
  earR.position.set(0.22, 0.22, 0); hd.add(earR);
  hd.add(at(BX(0.08, 0.07, 0.02, LT, 0.2), -0.22, 0.22, 0.035));
  hd.add(at(BX(0.08, 0.07, 0.02, LT, 0.2), 0.22, 0.22, 0.035));

  // Muzzle
  const muzzle = BX(0.20, 0.14, 0.04, CREAM, 0.15);
  muzzle.position.set(0, -0.08, 0.22); hd.add(muzzle);

  // Face
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.09, 0.06, 0.02);
  const blushMat = addBlush(hd, ROSY, 0.15, -0.04);
  hd.add(at(FP(0.06, 0.04, DK), 0, -0.04, FZ)); // nose
  hd.add(at(FP(0.04, 0.015, DK), 0, -0.10, FZ)); // mouth

  // Body
  bd.add(BX(0.34, 0.26, 0.22, BR));
  bd.add(at(BX(0.20, 0.16, 0.01, CREAM, 0.15), 0, 0, 0.115));

  addArms(aL, aR, BR, BR);
  addLegs(lL, lR, BR, DK, BR);

  // Tiny tail
  const tail = BX(0.06, 0.06, 0.04, DK, 0.2);
  tail.position.set(0, 0.60, -0.18); root.add(tail);

  // Honey pot (floating)
  const pot = GL(0.10, 0.10, 0.10, 0xFBBF24, 0.6);
  pot.position.set(-0.28, 0.55, 0); root.add(pot);

  return {
    eyeL, eyeR, hlL, hlR, blushMat, tail: [tail],
    extra(t) {
      earL.rotation.z = Math.sin(t * 1.8) * 0.05;
      earR.rotation.z = -Math.sin(t * 1.8 + 0.5) * 0.05;
      pot.position.y = 0.55 + Math.sin(t * 1.2) * 0.04;
      pot.rotation.y = t * 0.5;
    },
  };
};

// ═══════════════════════════════════════
// 🤖 ROBOT — 틸 사이버
// ═══════════════════════════════════════

const buildRobot: Builder = (hd, bd, aL, aR, lL, lR) => {
  const TEAL = 0x67E8F9, GY = 0x444455, DK = 0x333344, LT = 0x666677;

  // Head — metallic
  hd.add(BX(0.48, 0.46, 0.44, GY, 0.15));
  hd.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.49, 0.47, 0.45)),
      new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.15 }),
  ));

  // Antenna
  hd.add(at(BX(0.03, 0.18, 0.03, LT, 0.1), 0, 0.32, 0));
  const antBall = GL(0.07, 0.07, 0.07, TEAL, 1.2);
  antBall.position.set(0, 0.44, 0); hd.add(antBall);

  // Visor eyes
  const eyeL = GL(0.10, 0.06, 0.01, TEAL, 1.0);
  eyeL.position.set(-0.09, 0.02, FZ); hd.add(eyeL);
  const eyeR = GL(0.10, 0.06, 0.01, TEAL, 1.0);
  eyeR.position.set(0.09, 0.02, FZ); hd.add(eyeR);

  // LED mouth
  for (let i = 0; i < 3; i++) {
    const led = GL(0.025, 0.025, 0.005, TEAL, 0.6);
    led.position.set(-0.03 + i * 0.03, -0.08, FZ); hd.add(led);
  }

  // Body — dark metallic
  bd.add(BX(0.34, 0.26, 0.22, DK, 0.1));
  const panel = GL(0.16, 0.10, 0.01, TEAL, 0.4);
  panel.position.set(0, 0.02, 0.115); bd.add(panel);
  bd.add(at(BX(0.015, 0.24, 0.23, TEAL, 0.3), -0.16, 0, 0));
  bd.add(at(BX(0.015, 0.24, 0.23, TEAL, 0.3), 0.16, 0, 0));

  // Boxy arms
  const buildRobotArm = (g: THREE.Group) => {
    g.add(at(BX(0.12, 0.28, 0.13, GY, 0.12), 0, -0.14, 0));
    g.add(at(GL(0.08, 0.03, 0.09, TEAL, 0.5), 0, -0.30, 0));
  };
  buildRobotArm(aL); buildRobotArm(aR);
  addLegs(lL, lR, DK, GY, TEAL);

  return {
    eyeL, eyeR,
    extra(t) {
      antBall.position.y = 0.44 + Math.sin(t * 3) * 0.03;
      (antBall.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + Math.sin(t * 4) * 0.3;
      const f = 0.8 + Math.sin(t * 5) * 0.2;
      (eyeL.material as THREE.MeshStandardMaterial).emissiveIntensity = f;
      (eyeR.material as THREE.MeshStandardMaterial).emissiveIntensity = f;
      (panel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
    },
  };
};

// ═══════════════════════════════════════
// 🐧 PENGUIN — 턱시도 펭귄
// ═══════════════════════════════════════

const buildPenguin: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const BK = 0x3A3A55, WH = 0xF0F0F5, OR = 0xF5A623, DK = 0x2A2A3E;

  // Head — dark
  hd.add(BX(0.48, 0.46, 0.44, BK, 0.2));
  // White face patch
  hd.add(at(BX(0.32, 0.30, 0.02, WH, 0.15), 0, -0.02, 0.22));

  // Eyes — white circles + pupils
  [[-0.08, 0.02], [0.08, 0.02]].forEach(([x, y]) => {
    hd.add(at(FP(0.09, 0.09, WH), x, y, FZ));
  });
  const eyeL = FP(0.05, 0.06, 0x1a1528);
  eyeL.position.set(-0.08, 0.02, FZ + 0.002); hd.add(eyeL);
  const eyeR = FP(0.05, 0.06, 0x1a1528);
  eyeR.position.set(0.08, 0.02, FZ + 0.002); hd.add(eyeR);
  const hlL = FP(0.02, 0.02, 0xffffff);
  hlL.position.set(-0.065, 0.04, FZ + 0.004); hd.add(hlL);
  const hlR = FP(0.02, 0.02, 0xffffff);
  hlR.position.set(0.095, 0.04, FZ + 0.004); hd.add(hlR);

  // Orange beak
  const beak = BX(0.06, 0.04, 0.06, OR, 0.4);
  beak.position.set(0, -0.08, 0.24); hd.add(beak);

  // Body — tuxedo
  bd.add(BX(0.34, 0.26, 0.22, BK, 0.2));
  bd.add(at(BX(0.20, 0.22, 0.01, WH, 0.15), 0, 0, 0.115));

  // Flipper arms (wider, flatter)
  const buildFlipper = (g: THREE.Group) => {
    g.add(at(BX(0.08, 0.22, 0.16, BK, 0.2), 0, -0.11, 0));
  };
  buildFlipper(aL); buildFlipper(aR);

  // Orange feet
  addLegs(lL, lR, BK, OR, OR);

  // Fish accessory
  const fish = GL(0.12, 0.06, 0.03, 0x38bdf8, 0.7);
  fish.position.set(0.26, 0.70, 0); root.add(fish);
  const fishTail = GL(0.06, 0.08, 0.02, 0x38bdf8, 0.5);
  fishTail.position.set(0.34, 0.70, 0); root.add(fishTail);

  return {
    eyeL, eyeR, hlL, hlR,
    extra(t) {
      fish.position.y = 0.70 + Math.sin(t * 1.5) * 0.05;
      fish.rotation.z = Math.sin(t * 1.5) * 0.15;
      fishTail.position.y = fish.position.y;
      fishTail.rotation.z = fish.rotation.z + Math.sin(t * 3) * 0.2;
    },
  };
};

// ═══════════════════════════════════════
// ── Skin Registry ──
// ═══════════════════════════════════════

const SKINS: { name: string; light: number; build: Builder }[] = [
  { name: 'Bunny',   light: 0xFFB5C2, build: buildBunny },
  { name: 'Frog',    light: 0x7EC89F, build: buildFrog },
  { name: 'Bear',    light: 0xC4956A, build: buildBear },
  { name: 'Robot',   light: 0x67E8F9, build: buildRobot },
  { name: 'Penguin', light: 0x9999bb, build: buildPenguin },
];

export const SKIN_INFO = SKINS.map((s, i) => ({ index: i, name: s.name, emoji: ['🐰', '🐸', '🐻', '🤖', '🐧'][i] }));

// ═══════════════════════════════════════
// ── Create Character ──
// ═══════════════════════════════════════

export function createCharacter(scene: THREE.Scene, skinIndex?: number): Character {
  const ch = new THREE.Group();
  scene.add(ch);

  // Random skin selection
  const idx = skinIndex !== undefined ? skinIndex % SKINS.length : Math.floor(Math.random() * SKINS.length);
  const skin = SKINS[idx];

  // ── Build skeleton ──
  const headGrp = new THREE.Group();
  headGrp.position.y = HEAD_Y;
  ch.add(headGrp);

  const bodyGrp = new THREE.Group();
  bodyGrp.position.y = BODY_Y;
  ch.add(bodyGrp);

  const armPivotL = new THREE.Group();
  armPivotL.position.set(-ARM_X, ARM_Y, 0);
  ch.add(armPivotL);
  const armPivotR = new THREE.Group();
  armPivotR.position.set(ARM_X, ARM_Y, 0);
  ch.add(armPivotR);

  const legPivotL = new THREE.Group();
  legPivotL.position.set(-LEG_X, LEG_Y, 0);
  ch.add(legPivotL);
  const legPivotR = new THREE.Group();
  legPivotR.position.set(LEG_X, LEG_Y, 0);
  ch.add(legPivotR);

  // ── Build skin geometry ──
  const parts = skin.build(headGrp, bodyGrp, armPivotL, armPivotR, legPivotL, legPivotR, ch);

  // ── Shadow ──
  const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({color: 0x080810, transparent: true, opacity: 0.3}),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  ch.add(shadow);

  // ── Character light (skin-colored) ──
  const cLight = new THREE.PointLight(skin.light, 0.5, 4);
  cLight.position.y = 1.4;
  ch.add(cLight);

  // ── Animation ──
  let squashT = 0;

  function landSquash(): void {
    squashT = 0.18;
  }

  function animate(t: number, moving: boolean, sprinting = false, groundY?: number): void {
    const animSpd = sprinting ? 13 : 9;
    const wp = moving ? t * animSpd : 0;
    const sw = moving ? Math.sin(wp) : 0;
    const swingArm = sprinting ? 0.70 : 0.50;
    const swingLeg = sprinting ? 0.60 : 0.40;

    // Arm swing
    armPivotL.rotation.x = moving ? -sw * swingArm : Math.sin(t * 1.2) * 0.05;
    armPivotR.rotation.x = moving ? sw * swingArm : -Math.sin(t * 1.2) * 0.05;

    // Leg swing
    legPivotL.rotation.x = sw * swingLeg;
    legPivotR.rotation.x = -sw * swingLeg;

    // Body lean (sprint)
    const leanTarget = sprinting ? 0.10 : 0;
    bodyGrp.rotation.x += (leanTarget - bodyGrp.rotation.x) * 0.15;

    // Bob
    const bob = moving
        ? Math.abs(Math.sin(wp)) * (sprinting ? 0.055 : 0.035)
        : Math.sin(t * 2) * 0.01;

    // 그림자를 지면에 고정
    shadow.position.y = groundY !== undefined
        ? groundY - ch.position.y + 0.01
        : 0.005;

    // Squash (landing)
    let sqY = 1, sqXZ = 1;
    if (squashT > 0) {
      const p = squashT / 0.18;
      sqY = 1 - p * 0.2;
      sqXZ = 1 + p * 0.12;
      squashT = Math.max(0, squashT - 1 / 60 * 1.2);
    }
    ch.scale.set(sqXZ, sqY, sqXZ);

    // Apply bob to skeleton
    headGrp.position.y = HEAD_Y + bob;
    bodyGrp.position.y = BODY_Y + bob * 0.6;
    armPivotL.position.y = ARM_Y + bob * 0.6;
    armPivotR.position.y = ARM_Y + bob * 0.6;
    legPivotL.position.y = LEG_Y + bob * 0.3;
    legPivotR.position.y = LEG_Y + bob * 0.3;

    // Blink
    const bc = t % 3.8;
    const blink = (bc > 3.5 && bc < 3.65) || (t % 7 > 6.7 && t % 7 < 6.85);
    parts.eyeL.scale.y = blink ? 0.1 : 1;
    parts.eyeR.scale.y = blink ? 0.1 : 1;
    if (parts.hlL) parts.hlL.visible = !blink;
    if (parts.hlR) parts.hlR.visible = !blink;

    // Blush pulse
    if (parts.blushMat) {
      parts.blushMat.opacity = 0.40 + Math.sin(t) * 0.05;
    }

    // Tail wag
    if (parts.tail) {
      const ta = moving ? (sprinting ? 3 : 2) : 1;
      parts.tail.forEach((tp, i) => {
        tp.position.x = Math.sin(t * 2.5 + i * 0.8) * 0.06 * (i + 1) * 0.5 * ta;
      });
    }

    // Skin-specific animation
    if (parts.extra) parts.extra(t, moving, sprinting);
  }

  return {group: ch, animate, landSquash, skinName: skin.name, skinIndex: idx};
}