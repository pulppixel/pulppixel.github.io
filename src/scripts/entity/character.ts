// Player character: 5 voxel skins (Bunny, Frog, Bear, Robot, Penguin)
// + Per-skin palette for theme tinting
import * as THREE from 'three';
import { setPos, facePlane } from '../core/helpers';

export interface SkinPalette {
  particle: number;    // pollen/dust color
  fogTint: number;     // fog color tint
  accent: number;      // UI accent override
  ambient: number;     // ambient light tint
  groundGlow: number;  // ground glow color
}

export interface Character {
  group: THREE.Group;
  animate(t: number, moving: boolean, sprinting?: boolean, groundY?: number): void;
  landSquash(): void;
  skinName: string;
  skinIndex: number;
  palette: SkinPalette;
}

// --- Character-specific materials ---

function BX(w: number, h: number, d: number, c: number, ei = 0.3): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: ei, metalness: 0.05, roughness: 0.85 }),
  );
  m.castShadow = true;
  return m;
}

function SB(w: number, h: number, d: number, c: number): THREE.Mesh {
  return BX(w, h, d, c, 0.15);
}

function GL(w: number, h: number, d: number, c: number, ei = 0.8): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x080810, emissive: c, emissiveIntensity: ei, metalness: 0.3, roughness: 0.5 }),
  );
}

const HEAD_Y = 1.02, BODY_Y = 0.56, ARM_Y = 0.68;
const ARM_X = 0.24, LEG_Y = 0.38, LEG_X = 0.09;
const FZ = 0.245;

interface SP {
  eyeL: THREE.Mesh; eyeR: THREE.Mesh;
  hlL?: THREE.Mesh; hlR?: THREE.Mesh;
  blushMat?: THREE.MeshBasicMaterial;
  tail?: THREE.Mesh[];
  extra?: (t: number, moving: boolean, sprinting: boolean) => void;
}

type Builder = (hd: THREE.Group, bd: THREE.Group, aL: THREE.Group, aR: THREE.Group, lL: THREE.Group, lR: THREE.Group, root: THREE.Group) => SP;

function addEyes(hd: THREE.Group, spacing = 0.09, size = 0.065, yOff = 0) {
  const eyeL = setPos(facePlane(size, size + 0.01, 0x1a1528), -spacing, yOff, FZ); hd.add(eyeL);
  const eyeR = setPos(facePlane(size, size + 0.01, 0x1a1528), spacing, yOff, FZ); hd.add(eyeR);
  const hlL = setPos(facePlane(0.025, 0.025, 0xffffff), -spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlL);
  const hlR = setPos(facePlane(0.025, 0.025, 0xffffff), spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlR);
  return { eyeL, eyeR, hlL, hlR };
}

function addBlush(hd: THREE.Group, color: number, spacing = 0.14, yOff = -0.04): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  hd.add(setPos(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat), -spacing, yOff, FZ));
  hd.add(setPos(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat), spacing, yOff, FZ));
  return mat;
}

function addArms(aL: THREE.Group, aR: THREE.Group, armC: number, handC: number): void {
  aL.add(setPos(BX(0.12, 0.28, 0.13, armC), 0, -0.14, 0));
  aL.add(setPos(SB(0.08, 0.08, 0.08, handC), 0, -0.32, 0));
  aR.add(setPos(BX(0.12, 0.28, 0.13, armC), 0, -0.14, 0));
  aR.add(setPos(SB(0.08, 0.08, 0.08, handC), 0, -0.32, 0));
}

function addLegs(lL: THREE.Group, lR: THREE.Group, legC: number, bootC: number, soleC: number): void {
  const build = (g: THREE.Group) => {
    g.add(setPos(BX(0.13, 0.24, 0.14, legC), 0, -0.12, 0));
    g.add(setPos(BX(0.15, 0.08, 0.17, bootC), 0, -0.30, 0.015));
    g.add(setPos(GL(0.15, 0.025, 0.17, soleC, 0.5), 0, -0.35, 0.015));
  };
  build(lL); build(lR);
}

// --- Bunny ---
const buildBunny: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const PK = 0xFFB5C2, DK = 0xE8919F, WH = 0xFFF5F5, SK = 0xF5D6C3, MINT = 0x7ECCAA;
  hd.add(BX(0.50, 0.48, 0.46, PK));
  hd.add(setPos(SB(0.42, 0.22, 0.02, SK), 0, -0.06, 0.225));
  const band = BX(0.51, 0.045, 0.47, MINT, 0.4); band.position.y = 0.06; hd.add(band);
  const earL = setPos(BX(0.10, 0.26, 0.08, PK), -0.12, 0.37, 0.02); hd.add(earL);
  const earR = setPos(BX(0.10, 0.26, 0.08, PK), 0.12, 0.37, 0.02); hd.add(earR);
  hd.add(setPos(BX(0.05, 0.16, 0.02, DK), -0.12, 0.38, 0.05));
  hd.add(setPos(BX(0.05, 0.16, 0.02, DK), 0.12, 0.38, 0.05));
  [[-0.07, 0.14], [0.07, 0.14]].forEach(([x, y]) => hd.add(setPos(facePlane(0.035, 0.035, 0x1a1528), x, y, FZ)));
  hd.add(setPos(facePlane(0.035, 0.025, DK), 0, 0.10, FZ));
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.08, 0.055, -0.06);
  const blushMat = addBlush(hd, 0xFF8AAE, 0.13, -0.10);
  hd.add(setPos(facePlane(0.04, 0.015, DK), 0, -0.12, FZ));
  bd.add(BX(0.34, 0.26, 0.22, PK)); bd.add(setPos(BX(0.20, 0.16, 0.01, WH, 0.15), 0, 0, 0.115));
  addArms(aL, aR, PK, SK); addLegs(lL, lR, PK, PK, DK);
  const tail = setPos(BX(0.10, 0.10, 0.08, WH, 0.4), 0, 0.62, -0.20); root.add(tail);
  return { eyeL, eyeR, hlL, hlR, blushMat, tail: [tail],
    extra(t, moving) {
      const f = moving ? Math.sin(t * 8) * 0.12 : Math.sin(t * 1.5) * 0.03;
      earL.rotation.z = 0.05 + f;
      earR.rotation.z = -0.05 - Math.sin(moving ? t * 8 + 0.5 : t * 1.5 + 0.5) * (moving ? 0.12 : 0.03);
    },
  };
};

// --- Frog ---
const buildFrog: Builder = (hd, bd, aL, aR, lL, lR) => {
  const GR = 0x7EC89F, DK = 0x5AA87A, LT = 0xB8E8C8, BELLY = 0xF5E6C3, RED = 0xE85050;
  hd.add(BX(0.52, 0.46, 0.44, GR));
  const bumpL = setPos(BX(0.14, 0.14, 0.14, LT, 0.25), -0.14, 0.28, 0.08); hd.add(bumpL);
  const bumpR = setPos(BX(0.14, 0.14, 0.14, LT, 0.25), 0.14, 0.28, 0.08); hd.add(bumpR);
  const eyeL = setPos(facePlane(0.07, 0.08, 0x1a1528), -0.14, 0.28, 0.155); hd.add(eyeL);
  const eyeR = setPos(facePlane(0.07, 0.08, 0x1a1528), 0.14, 0.28, 0.155); hd.add(eyeR);
  const hlL = setPos(facePlane(0.025, 0.025, 0xffffff), -0.12, 0.30, 0.157); hd.add(hlL);
  const hlR = setPos(facePlane(0.025, 0.025, 0xffffff), 0.16, 0.30, 0.157); hd.add(hlR);
  hd.add(setPos(facePlane(0.16, 0.02, DK), 0, -0.10, FZ));
  hd.add(setPos(facePlane(0.02, 0.02, DK), -0.03, -0.02, FZ));
  hd.add(setPos(facePlane(0.02, 0.02, DK), 0.03, -0.02, FZ));
  const blushMat = addBlush(hd, RED, 0.16, -0.06);
  bd.add(BX(0.34, 0.24, 0.22, GR)); bd.add(setPos(BX(0.22, 0.16, 0.01, BELLY, 0.15), 0, 0, 0.115));
  const buildArm = (g: THREE.Group) => { g.add(setPos(BX(0.12, 0.26, 0.13, GR), 0, -0.13, 0)); g.add(setPos(BX(0.11, 0.06, 0.11, DK, 0.2), 0, -0.30, 0)); };
  buildArm(aL); buildArm(aR); addLegs(lL, lR, GR, DK, GR);
  return { eyeL, eyeR, hlL, hlR, blushMat,
    extra(t) {
      bumpL.position.y = 0.28 + Math.sin(t * 2.5) * 0.015; bumpR.position.y = 0.28 + Math.sin(t * 2.5 + 1) * 0.015;
      eyeL.position.y = bumpL.position.y; eyeR.position.y = bumpR.position.y;
      hlL.position.y = bumpL.position.y + 0.02; hlR.position.y = bumpR.position.y + 0.02;
    },
  };
};

// --- Bear ---
const buildBear: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const BR = 0xC4956A, DK = 0x8B6540, LT = 0xDDB88A, CREAM = 0xE8D0B0, ROSY = 0xFF9090;
  hd.add(BX(0.50, 0.48, 0.44, BR));
  const earL = setPos(BX(0.14, 0.12, 0.06, BR), -0.22, 0.22, 0); hd.add(earL);
  const earR = setPos(BX(0.14, 0.12, 0.06, BR), 0.22, 0.22, 0); hd.add(earR);
  hd.add(setPos(BX(0.08, 0.07, 0.02, LT, 0.2), -0.22, 0.22, 0.035));
  hd.add(setPos(BX(0.08, 0.07, 0.02, LT, 0.2), 0.22, 0.22, 0.035));
  hd.add(setPos(BX(0.20, 0.14, 0.04, CREAM, 0.15), 0, -0.08, 0.22));
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.09, 0.06, 0.02);
  const blushMat = addBlush(hd, ROSY, 0.15, -0.04);
  hd.add(setPos(facePlane(0.06, 0.04, DK), 0, -0.04, FZ));
  hd.add(setPos(facePlane(0.04, 0.015, DK), 0, -0.10, FZ));
  bd.add(BX(0.34, 0.26, 0.22, BR)); bd.add(setPos(BX(0.20, 0.16, 0.01, CREAM, 0.15), 0, 0, 0.115));
  addArms(aL, aR, BR, BR); addLegs(lL, lR, BR, DK, BR);
  const tail = setPos(BX(0.06, 0.06, 0.04, DK, 0.2), 0, 0.60, -0.18); root.add(tail);
  const pot = setPos(GL(0.10, 0.10, 0.10, 0xFBBF24, 0.6), -0.28, 0.55, 0); root.add(pot);
  return { eyeL, eyeR, hlL, hlR, blushMat, tail: [tail],
    extra(t) {
      earL.rotation.z = Math.sin(t * 1.8) * 0.05; earR.rotation.z = -Math.sin(t * 1.8 + 0.5) * 0.05;
      pot.position.y = 0.55 + Math.sin(t * 1.2) * 0.04; pot.rotation.y = t * 0.5;
    },
  };
};

// --- Robot ---
const buildRobot: Builder = (hd, bd, aL, aR, lL, lR) => {
  const TEAL = 0x67E8F9, GY = 0x444455, DK = 0x333344, LT = 0x666677;
  hd.add(BX(0.48, 0.46, 0.44, GY, 0.15));
  hd.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.49, 0.47, 0.45)), new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.15 })));
  hd.add(setPos(BX(0.03, 0.18, 0.03, LT, 0.1), 0, 0.32, 0));
  const antBall = setPos(GL(0.07, 0.07, 0.07, TEAL, 1.2), 0, 0.44, 0); hd.add(antBall);
  const eyeL = setPos(GL(0.10, 0.06, 0.01, TEAL, 1.0), -0.09, 0.02, FZ); hd.add(eyeL);
  const eyeR = setPos(GL(0.10, 0.06, 0.01, TEAL, 1.0), 0.09, 0.02, FZ); hd.add(eyeR);
  for (let i = 0; i < 3; i++) hd.add(setPos(GL(0.025, 0.025, 0.005, TEAL, 0.6), -0.03 + i * 0.03, -0.08, FZ));
  bd.add(BX(0.34, 0.26, 0.22, DK, 0.1));
  const panel = setPos(GL(0.16, 0.10, 0.01, TEAL, 0.4), 0, 0.02, 0.115); bd.add(panel);
  bd.add(setPos(BX(0.015, 0.24, 0.23, TEAL, 0.3), -0.16, 0, 0));
  bd.add(setPos(BX(0.015, 0.24, 0.23, TEAL, 0.3), 0.16, 0, 0));
  const buildArm = (g: THREE.Group) => { g.add(setPos(BX(0.12, 0.28, 0.13, GY, 0.12), 0, -0.14, 0)); g.add(setPos(GL(0.08, 0.03, 0.09, TEAL, 0.5), 0, -0.30, 0)); };
  buildArm(aL); buildArm(aR); addLegs(lL, lR, DK, GY, TEAL);
  return { eyeL, eyeR,
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

// --- Penguin ---
const buildPenguin: Builder = (hd, bd, aL, aR, lL, lR, root) => {
  const BK = 0x3A3A55, WH = 0xF0F0F5, OR = 0xF5A623, DK = 0x2A2A3E;
  hd.add(BX(0.48, 0.46, 0.44, BK, 0.2));
  hd.add(setPos(BX(0.32, 0.30, 0.02, WH, 0.15), 0, -0.02, 0.22));
  [[-0.08, 0.02], [0.08, 0.02]].forEach(([x, y]) => hd.add(setPos(facePlane(0.09, 0.09, WH), x, y, FZ)));
  const eyeL = setPos(facePlane(0.05, 0.06, 0x1a1528), -0.08, 0.02, FZ + 0.002); hd.add(eyeL);
  const eyeR = setPos(facePlane(0.05, 0.06, 0x1a1528), 0.08, 0.02, FZ + 0.002); hd.add(eyeR);
  const hlL = setPos(facePlane(0.02, 0.02, 0xffffff), -0.065, 0.04, FZ + 0.004); hd.add(hlL);
  const hlR = setPos(facePlane(0.02, 0.02, 0xffffff), 0.095, 0.04, FZ + 0.004); hd.add(hlR);
  hd.add(setPos(BX(0.06, 0.04, 0.06, OR, 0.4), 0, -0.08, 0.24));
  bd.add(BX(0.34, 0.26, 0.22, BK, 0.2)); bd.add(setPos(BX(0.20, 0.22, 0.01, WH, 0.15), 0, 0, 0.115));
  const buildFlipper = (g: THREE.Group) => g.add(setPos(BX(0.08, 0.22, 0.16, BK, 0.2), 0, -0.11, 0));
  buildFlipper(aL); buildFlipper(aR); addLegs(lL, lR, BK, OR, OR);
  const fish = setPos(GL(0.12, 0.06, 0.03, 0x38bdf8, 0.7), 0.26, 0.70, 0); root.add(fish);
  const fishTail = setPos(GL(0.06, 0.08, 0.02, 0x38bdf8, 0.5), 0.34, 0.70, 0); root.add(fishTail);
  return { eyeL, eyeR, hlL, hlR,
    extra(t) {
      fish.position.y = 0.70 + Math.sin(t * 1.5) * 0.05; fish.rotation.z = Math.sin(t * 1.5) * 0.15;
      fishTail.position.y = fish.position.y; fishTail.rotation.z = fish.rotation.z + Math.sin(t * 3) * 0.2;
    },
  };
};

// --- Skin registry with palettes ---

const SKINS: { name: string; light: number; palette: SkinPalette; build: Builder }[] = [
  { name: 'Bunny', light: 0xFFB5C2,
    palette: { particle: 0xffc8d8, fogTint: 0xf5e0e8, accent: 0xFFB5C2, ambient: 0xf0d0d8, groundGlow: 0xffa0b8 },
    build: buildBunny },
  { name: 'Frog', light: 0x7EC89F,
    palette: { particle: 0xa8e8c0, fogTint: 0xd8f0e0, accent: 0x7EC89F, ambient: 0xc0e8d0, groundGlow: 0x60b880 },
    build: buildFrog },
  { name: 'Bear', light: 0xC4956A,
    palette: { particle: 0xe0c8a0, fogTint: 0xf0e0c8, accent: 0xC4956A, ambient: 0xe0d0b8, groundGlow: 0xb88850 },
    build: buildBear },
  { name: 'Robot', light: 0x67E8F9,
    palette: { particle: 0x80e8f8, fogTint: 0xd0f0f8, accent: 0x67E8F9, ambient: 0xb8e8f0, groundGlow: 0x40c8e0 },
    build: buildRobot },
  { name: 'Penguin', light: 0x9999bb,
    palette: { particle: 0xb0b0d0, fogTint: 0xd8d8e8, accent: 0x9999bb, ambient: 0xc0c0d8, groundGlow: 0x7878a0 },
    build: buildPenguin },
];

export const SKIN_INFO = SKINS.map((s, i) => ({
  index: i, name: s.name,
  emoji: ['\uD83D\uDC30', '\uD83D\uDC38', '\uD83D\uDC3B', '\uD83E\uDD16', '\uD83D\uDC27'][i],
}));

export function createCharacter(scene: THREE.Scene, skinIndex?: number): Character {
  const ch = new THREE.Group();
  scene.add(ch);

  const idx = skinIndex !== undefined ? skinIndex % SKINS.length : Math.floor(Math.random() * SKINS.length);
  const skin = SKINS[idx];

  const headGrp = new THREE.Group(); headGrp.position.y = HEAD_Y; ch.add(headGrp);
  const bodyGrp = new THREE.Group(); bodyGrp.position.y = BODY_Y; ch.add(bodyGrp);
  const armPivotL = new THREE.Group(); armPivotL.position.set(-ARM_X, ARM_Y, 0); ch.add(armPivotL);
  const armPivotR = new THREE.Group(); armPivotR.position.set(ARM_X, ARM_Y, 0); ch.add(armPivotR);
  const legPivotL = new THREE.Group(); legPivotL.position.set(-LEG_X, LEG_Y, 0); ch.add(legPivotL);
  const legPivotR = new THREE.Group(); legPivotR.position.set(LEG_X, LEG_Y, 0); ch.add(legPivotR);

  const parts = skin.build(headGrp, bodyGrp, armPivotL, armPivotR, legPivotL, legPivotR, ch);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({ color: 0x080810, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; ch.add(shadow);

  const cLight = new THREE.PointLight(skin.light, 0.5, 4);
  cLight.position.y = 1.4; ch.add(cLight);

  let squashT = 0;
  function landSquash(): void { squashT = 0.18; }

  function animate(t: number, moving: boolean, sprinting = false, groundY?: number): void {
    const animSpd = sprinting ? 13 : 9;
    const wp = moving ? t * animSpd : 0;
    const sw = moving ? Math.sin(wp) : 0;
    const swingArm = sprinting ? 0.70 : 0.50;
    const swingLeg = sprinting ? 0.60 : 0.40;
    armPivotL.rotation.x = moving ? -sw * swingArm : Math.sin(t * 1.2) * 0.05;
    armPivotR.rotation.x = moving ? sw * swingArm : -Math.sin(t * 1.2) * 0.05;
    legPivotL.rotation.x = sw * swingLeg; legPivotR.rotation.x = -sw * swingLeg;
    const leanTarget = sprinting ? 0.10 : 0;
    bodyGrp.rotation.x += (leanTarget - bodyGrp.rotation.x) * 0.15;
    const bob = moving ? Math.abs(Math.sin(wp)) * (sprinting ? 0.055 : 0.035) : Math.sin(t * 2) * 0.01;
    shadow.position.y = groundY !== undefined ? groundY - ch.position.y + 0.01 : 0.005;
    let sqY = 1, sqXZ = 1;
    if (squashT > 0) { const p = squashT / 0.18; sqY = 1 - p * 0.2; sqXZ = 1 + p * 0.12; squashT = Math.max(0, squashT - 1 / 60 * 1.2); }
    ch.scale.set(sqXZ, sqY, sqXZ);
    headGrp.position.y = HEAD_Y + bob; bodyGrp.position.y = BODY_Y + bob * 0.6;
    armPivotL.position.y = ARM_Y + bob * 0.6; armPivotR.position.y = ARM_Y + bob * 0.6;
    legPivotL.position.y = LEG_Y + bob * 0.3; legPivotR.position.y = LEG_Y + bob * 0.3;
    const bc = t % 3.8;
    const blink = (bc > 3.5 && bc < 3.65) || (t % 7 > 6.7 && t % 7 < 6.85);
    parts.eyeL.scale.y = blink ? 0.1 : 1; parts.eyeR.scale.y = blink ? 0.1 : 1;
    if (parts.hlL) parts.hlL.visible = !blink; if (parts.hlR) parts.hlR.visible = !blink;
    if (parts.blushMat) parts.blushMat.opacity = 0.40 + Math.sin(t) * 0.05;
    if (parts.tail) { const ta = moving ? (sprinting ? 3 : 2) : 1; parts.tail.forEach((tp, i) => { tp.position.x = Math.sin(t * 2.5 + i * 0.8) * 0.06 * (i + 1) * 0.5 * ta; }); }
    if (parts.extra) parts.extra(t, moving, sprinting);
  }

  return { group: ch, animate, landSquash, skinName: skin.name, skinIndex: idx, palette: skin.palette };
}
