// 플레이어 캐릭터: 보크셀 스킨 5종 (Bunny, Frog, Bear, Robot, Penguin)
// + 스킨별 팔레트(테마 틴팅용)
//
// "미니 Veloren" 무드:
//  - 매트 머티리얼(발광은 야간 가시성용 최소 floor만) — 씬 라이팅이 음영을 만든다.
//  - 관절 실루엣: 어깨/팔꿈치, 엉덩이/무릎 서브 피벗 + 목 + 테이퍼 몸통.
//  - 차분(머트)한 팔레트로 색 조화.
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

// --- 캐릭터 전용 머티리얼 ---

// 매트 보디 박스. emissive는 야간에 캐릭터가 까맣게 죽지 않게 하는 최소 floor.
// 라이팅이 면별 음영을 만들도록 roughness를 높게, metalness 0으로.
function VX(w: number, h: number, d: number, c: number, ei = 0.1): THREE.Mesh {
  const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: ei, metalness: 0.0, roughness: 0.92 }),
  );
  m.castShadow = true;
  return m;
}

// 더 차분한 디테일(배·손·발 등) — floor 더 낮게.
function SB(w: number, h: number, d: number, c: number): THREE.Mesh {
  return VX(w, h, d, c, 0.06);
}

// 진짜 발광체(로봇 눈/안테나, 꿀단지, 물고기, 보석)용.
function GL(w: number, h: number, d: number, c: number, ei = 0.8): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x080810, emissive: c, emissiveIntensity: ei, metalness: 0.3, roughness: 0.5 }),
  );
}

// --- 스켈레톤 기준값 ---
// 목·테이퍼 몸통으로 머리:몸 비율을 개선. 발은 y≈0, 머리 꼭대기 y≈1.27.
const HEAD_Y = 1.04, BODY_Y = 0.62;
const SHO_Y = 0.82, SHO_X = 0.205;   // 어깨 피벗
const HIP_Y = 0.46, HIP_X = 0.085;   // 엉덩이 피벗
const FZ = 0.245;                    // 얼굴 평면 z

interface SP {
  eyeL: THREE.Mesh; eyeR: THREE.Mesh;
  hlL?: THREE.Mesh; hlR?: THREE.Mesh;
  blushMat?: THREE.MeshBasicMaterial;
  tail?: THREE.Mesh[];
  elbowL?: THREE.Group; elbowR?: THREE.Group;  // 팔꿈치 — 걷기 시 굽힘
  kneeL?: THREE.Group; kneeR?: THREE.Group;     // 무릎
  extra?: (t: number, moving: boolean, sprinting: boolean) => void;
}

type Builder = (hd: THREE.Group, bd: THREE.Group, sL: THREE.Group, sR: THREE.Group, hL: THREE.Group, hR: THREE.Group, root: THREE.Group) => SP;

function addEyes(hd: THREE.Group, spacing = 0.09, size = 0.065, yOff = 0) {
  const eyeL = setPos(facePlane(size, size + 0.01, 0x1a1528), -spacing, yOff, FZ); hd.add(eyeL);
  const eyeR = setPos(facePlane(size, size + 0.01, 0x1a1528), spacing, yOff, FZ); hd.add(eyeR);
  const hlL = setPos(facePlane(0.025, 0.025, 0xffffff), -spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlL);
  const hlR = setPos(facePlane(0.025, 0.025, 0xffffff), spacing + 0.015, yOff + 0.02, FZ + 0.002); hd.add(hlR);
  return { eyeL, eyeR, hlL, hlR };
}

function addBlush(hd: THREE.Group, color: number, spacing = 0.14, yOff = -0.04): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  hd.add(setPos(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat), -spacing, yOff, FZ));
  hd.add(setPos(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), mat), spacing, yOff, FZ));
  return mat;
}

// 부드러운 몸통: 어깨 쪽이 살짝 넓고 허리로 좁아지는 2단 + 목.
// 배/가슴 패치는 스킨이 직접 추가.
function addTorso(bd: THREE.Group, mainC: number): void {
  bd.add(setPos(VX(0.36, 0.17, 0.23, mainC), 0, 0.085, 0));   // 윗몸통(어깨)
  bd.add(setPos(VX(0.31, 0.16, 0.205, mainC), 0, -0.075, 0)); // 아랫몸통(허리)
  bd.add(setPos(VX(0.155, 0.11, 0.15, mainC), 0, 0.205, 0));  // 목
}

// 관절 팔: 어깨 피벗에 상박 + 팔꿈치 피벗 + 전박/손. 팔꿈치 반환.
function addArm(shoulder: THREE.Group, armC: number, handC: number): THREE.Group {
  shoulder.add(setPos(VX(0.115, 0.20, 0.12, armC), 0, -0.10, 0));      // 상박
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.20, 0);
  shoulder.add(elbow);
  elbow.add(setPos(VX(0.10, 0.16, 0.105, armC), 0, -0.08, 0));         // 전박
  elbow.add(setPos(SB(0.085, 0.085, 0.09, handC), 0, -0.185, 0.005));  // 손
  return elbow;
}

// 관절 다리: 엉덩이 피벗에 허벅지 + 무릎 피벗 + 정강이/발. 무릎 반환.
function addLeg(hip: THREE.Group, legC: number, bootC: number, soleC: number): THREE.Group {
  hip.add(setPos(VX(0.135, 0.22, 0.14, legC), 0, -0.11, 0));           // 허벅지
  const knee = new THREE.Group();
  knee.position.set(0, -0.22, 0);
  hip.add(knee);
  knee.add(setPos(VX(0.12, 0.18, 0.125, legC), 0, -0.09, 0));          // 정강이
  knee.add(setPos(VX(0.15, 0.08, 0.18, bootC), 0, -0.20, 0.02));       // 발
  knee.add(setPos(GL(0.15, 0.022, 0.18, soleC, 0.35), 0, -0.245, 0.02)); // 밑창 접지광
  return knee;
}

// --- Bunny ---
const buildBunny: Builder = (hd, bd, sL, sR, hL, hR, root) => {
  const PK = 0xE3A4B2, DK = 0xC07E8D, WH = 0xF3E7E2, SK = 0xEAD0C2, MINT = 0x8FBFA8;
  hd.add(VX(0.49, 0.47, 0.45, PK));
  hd.add(setPos(SB(0.42, 0.22, 0.02, SK), 0, -0.06, 0.225));
  const band = VX(0.50, 0.045, 0.46, MINT, 0.25); band.position.y = 0.06; hd.add(band);
  const earL = setPos(VX(0.10, 0.26, 0.08, PK), -0.12, 0.37, 0.02); hd.add(earL);
  const earR = setPos(VX(0.10, 0.26, 0.08, PK), 0.12, 0.37, 0.02); hd.add(earR);
  hd.add(setPos(VX(0.05, 0.16, 0.02, DK, 0.06), -0.12, 0.38, 0.05));
  hd.add(setPos(VX(0.05, 0.16, 0.02, DK, 0.06), 0.12, 0.38, 0.05));
  hd.add(setPos(facePlane(0.035, 0.025, DK), 0, 0.10, FZ));
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.08, 0.055, -0.06);
  const blushMat = addBlush(hd, 0xE38AA0, 0.13, -0.10);
  hd.add(setPos(facePlane(0.04, 0.015, DK), 0, -0.12, FZ));
  addTorso(bd, PK);
  bd.add(setPos(SB(0.18, 0.20, 0.02, WH), 0, -0.04, 0.118));
  const elbowL = addArm(sL, PK, SK), elbowR = addArm(sR, PK, SK);
  const kneeL = addLeg(hL, PK, PK, DK), kneeR = addLeg(hR, PK, PK, DK);
  const tail = setPos(VX(0.10, 0.10, 0.08, WH, 0.12), 0, 0.30, -0.16); root.add(tail);
  return { eyeL, eyeR, hlL, hlR, blushMat, tail: [tail], elbowL, elbowR, kneeL, kneeR,
    extra(t, moving) {
      const f = moving ? Math.sin(t * 8) * 0.12 : Math.sin(t * 1.5) * 0.03;
      earL.rotation.z = 0.05 + f;
      earR.rotation.z = -0.05 - Math.sin(moving ? t * 8 + 0.5 : t * 1.5 + 0.5) * (moving ? 0.12 : 0.03);
    },
  };
};

// --- Frog ---
const buildFrog: Builder = (hd, bd, sL, sR, hL, hR) => {
  const GR = 0x82B891, DK = 0x577E63, LT = 0xBFD9C2, BELLY = 0xE9DCC0, RED = 0xD98A7E;
  hd.add(VX(0.51, 0.45, 0.43, GR));
  const bumpL = setPos(VX(0.14, 0.14, 0.14, LT, 0.12), -0.14, 0.27, 0.08); hd.add(bumpL);
  const bumpR = setPos(VX(0.14, 0.14, 0.14, LT, 0.12), 0.14, 0.27, 0.08); hd.add(bumpR);
  const eyeL = setPos(facePlane(0.07, 0.08, 0x1a1528), -0.14, 0.27, 0.155); hd.add(eyeL);
  const eyeR = setPos(facePlane(0.07, 0.08, 0x1a1528), 0.14, 0.27, 0.155); hd.add(eyeR);
  const hlL = setPos(facePlane(0.025, 0.025, 0xffffff), -0.12, 0.29, 0.157); hd.add(hlL);
  const hlR = setPos(facePlane(0.025, 0.025, 0xffffff), 0.16, 0.29, 0.157); hd.add(hlR);
  hd.add(setPos(facePlane(0.16, 0.02, DK), 0, -0.10, FZ));
  hd.add(setPos(facePlane(0.02, 0.02, DK), -0.03, -0.02, FZ));
  hd.add(setPos(facePlane(0.02, 0.02, DK), 0.03, -0.02, FZ));
  const blushMat = addBlush(hd, RED, 0.16, -0.06);
  addTorso(bd, GR);
  bd.add(setPos(SB(0.21, 0.20, 0.02, BELLY), 0, -0.04, 0.118));
  // 개구리 팔: 짧고 굵게 (손은 물갈퀴 톤)
  const elbowL = addArm(sL, GR, DK), elbowR = addArm(sR, GR, DK);
  const kneeL = addLeg(hL, GR, DK, GR), kneeR = addLeg(hR, GR, DK, GR);
  return { eyeL, eyeR, hlL, hlR, blushMat, elbowL, elbowR, kneeL, kneeR,
    extra(t) {
      bumpL.position.y = 0.27 + Math.sin(t * 2.5) * 0.015; bumpR.position.y = 0.27 + Math.sin(t * 2.5 + 1) * 0.015;
      eyeL.position.y = bumpL.position.y; eyeR.position.y = bumpR.position.y;
      hlL.position.y = bumpL.position.y + 0.02; hlR.position.y = bumpR.position.y + 0.02;
    },
  };
};

// --- Bear ---
const buildBear: Builder = (hd, bd, sL, sR, hL, hR, root) => {
  const BR = 0xBC9468, DK = 0x7E5E3F, LT = 0xD7B98C, CREAM = 0xE2CFB0, ROSY = 0xE39C8E;
  hd.add(VX(0.49, 0.47, 0.43, BR));
  const earL = setPos(VX(0.14, 0.12, 0.06, BR), -0.22, 0.22, 0); hd.add(earL);
  const earR = setPos(VX(0.14, 0.12, 0.06, BR), 0.22, 0.22, 0); hd.add(earR);
  hd.add(setPos(VX(0.08, 0.07, 0.02, LT, 0.08), -0.22, 0.22, 0.035));
  hd.add(setPos(VX(0.08, 0.07, 0.02, LT, 0.08), 0.22, 0.22, 0.035));
  hd.add(setPos(VX(0.20, 0.14, 0.04, CREAM, 0.08), 0, -0.08, 0.22));
  const { eyeL, eyeR, hlL, hlR } = addEyes(hd, 0.09, 0.06, 0.02);
  const blushMat = addBlush(hd, ROSY, 0.15, -0.04);
  hd.add(setPos(facePlane(0.06, 0.04, DK), 0, -0.04, FZ));
  hd.add(setPos(facePlane(0.04, 0.015, DK), 0, -0.10, FZ));
  addTorso(bd, BR);
  bd.add(setPos(SB(0.19, 0.20, 0.02, CREAM), 0, -0.04, 0.118));
  const elbowL = addArm(sL, BR, BR), elbowR = addArm(sR, BR, BR);
  const kneeL = addLeg(hL, BR, DK, BR), kneeR = addLeg(hR, BR, DK, BR);
  const tail = setPos(VX(0.06, 0.06, 0.04, DK, 0.06), 0, 0.30, -0.14); root.add(tail);
  const pot = setPos(GL(0.10, 0.10, 0.10, 0xE0A94A, 0.55), -0.28, 0.55, 0); root.add(pot);
  return { eyeL, eyeR, hlL, hlR, blushMat, tail: [tail], elbowL, elbowR, kneeL, kneeR,
    extra(t) {
      earL.rotation.z = Math.sin(t * 1.8) * 0.05; earR.rotation.z = -Math.sin(t * 1.8 + 0.5) * 0.05;
      pot.position.y = 0.55 + Math.sin(t * 1.2) * 0.04; pot.rotation.y = t * 0.5;
    },
  };
};

// --- Robot ---
const buildRobot: Builder = (hd, bd, sL, sR, hL, hR) => {
  const TEAL = 0x6FD8E8, GY = 0x5A6470, DK = 0x434C57, LT = 0x7E8893;
  hd.add(VX(0.47, 0.45, 0.43, GY, 0.06));
  hd.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.48, 0.46, 0.44)), new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.18 })));
  hd.add(setPos(VX(0.03, 0.18, 0.03, LT, 0.06), 0, 0.32, 0));
  const antBall = setPos(GL(0.07, 0.07, 0.07, TEAL, 1.2), 0, 0.44, 0); hd.add(antBall);
  const eyeL = setPos(GL(0.10, 0.06, 0.01, TEAL, 1.0), -0.09, 0.02, FZ); hd.add(eyeL);
  const eyeR = setPos(GL(0.10, 0.06, 0.01, TEAL, 1.0), 0.09, 0.02, FZ); hd.add(eyeR);
  for (let i = 0; i < 3; i++) hd.add(setPos(GL(0.025, 0.025, 0.005, TEAL, 0.6), -0.03 + i * 0.03, -0.08, FZ));
  addTorso(bd, DK);
  const panel = setPos(GL(0.16, 0.10, 0.01, TEAL, 0.4), 0, 0.0, 0.118); bd.add(panel);
  bd.add(setPos(VX(0.015, 0.24, 0.21, TEAL, 0.3), -0.155, 0, 0));
  bd.add(setPos(VX(0.015, 0.24, 0.21, TEAL, 0.3), 0.155, 0, 0));
  // 로봇 팔: 관절 + 발광 손
  const armColor = GY, handColor = TEAL;
  const buildRArm = (shoulder: THREE.Group): THREE.Group => {
    shoulder.add(setPos(VX(0.12, 0.20, 0.13, armColor, 0.06), 0, -0.10, 0));
    const elbow = new THREE.Group(); elbow.position.set(0, -0.20, 0); shoulder.add(elbow);
    elbow.add(setPos(VX(0.105, 0.15, 0.11, armColor, 0.06), 0, -0.08, 0));
    elbow.add(setPos(GL(0.08, 0.05, 0.09, handColor, 0.5), 0, -0.18, 0));
    return elbow;
  };
  const elbowL = buildRArm(sL), elbowR = buildRArm(sR);
  const kneeL = addLeg(hL, DK, GY, TEAL), kneeR = addLeg(hR, DK, GY, TEAL);
  return { eyeL, eyeR, elbowL, elbowR, kneeL, kneeR,
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
const buildPenguin: Builder = (hd, bd, sL, sR, hL, hR, root) => {
  const BK = 0x3D3F58, WH = 0xEDE9E2, OR = 0xE0A24E, DK = 0x2C2E42;
  hd.add(VX(0.47, 0.45, 0.43, BK, 0.08));
  hd.add(setPos(VX(0.32, 0.30, 0.02, WH, 0.06), 0, -0.02, 0.22));
  [[-0.08, 0.02], [0.08, 0.02]].forEach(([x, y]) => hd.add(setPos(facePlane(0.09, 0.09, WH), x, y, FZ)));
  const eyeL = setPos(facePlane(0.05, 0.06, 0x1a1528), -0.08, 0.02, FZ + 0.002); hd.add(eyeL);
  const eyeR = setPos(facePlane(0.05, 0.06, 0x1a1528), 0.08, 0.02, FZ + 0.002); hd.add(eyeR);
  const hlL = setPos(facePlane(0.02, 0.02, 0xffffff), -0.065, 0.04, FZ + 0.004); hd.add(hlL);
  const hlR = setPos(facePlane(0.02, 0.02, 0xffffff), 0.095, 0.04, FZ + 0.004); hd.add(hlR);
  hd.add(setPos(VX(0.06, 0.04, 0.06, OR, 0.2), 0, -0.08, 0.24));
  addTorso(bd, BK);
  bd.add(setPos(SB(0.20, 0.22, 0.02, WH), 0, -0.03, 0.118));
  // 펭귄: 관절 없는 물갈퀴 (몸에 붙어 앞뒤로만 퍼덕)
  const buildFlipper = (shoulder: THREE.Group) => shoulder.add(setPos(VX(0.07, 0.24, 0.15, BK, 0.08), 0, -0.13, 0));
  buildFlipper(sL); buildFlipper(sR);
  const kneeL = addLeg(hL, BK, OR, OR), kneeR = addLeg(hR, BK, OR, OR);
  const fish = setPos(GL(0.12, 0.06, 0.03, 0x4FB0D0, 0.6), 0.26, 0.55, 0); root.add(fish);
  const fishTail = setPos(GL(0.06, 0.08, 0.02, 0x4FB0D0, 0.45), 0.34, 0.55, 0); root.add(fishTail);
  return { eyeL, eyeR, hlL, hlR, kneeL, kneeR,
    extra(t) {
      fish.position.y = 0.55 + Math.sin(t * 1.5) * 0.05; fish.rotation.z = Math.sin(t * 1.5) * 0.15;
      fishTail.position.y = fish.position.y; fishTail.rotation.z = fish.rotation.z + Math.sin(t * 3) * 0.2;
    },
  };
};

// --- 스킨 레지스트리 + 팔레트 (머트 톤) ---

const SKINS: { name: string; light: number; palette: SkinPalette; build: Builder }[] = [
  { name: 'Bunny', light: 0xE3A4B2,
    palette: { particle: 0xe8c4cf, fogTint: 0xeadbe1, accent: 0xE3A4B2, ambient: 0xe6d2d8, groundGlow: 0xd49db0 },
    build: buildBunny },
  { name: 'Frog', light: 0x82B891,
    palette: { particle: 0xbcdcc6, fogTint: 0xdcebe0, accent: 0x82B891, ambient: 0xcfe2d4, groundGlow: 0x6fa886 },
    build: buildFrog },
  { name: 'Bear', light: 0xBC9468,
    palette: { particle: 0xdcc7a4, fogTint: 0xebe0cd, accent: 0xBC9468, ambient: 0xe0d2bb, groundGlow: 0xae8a5e },
    build: buildBear },
  { name: 'Robot', light: 0x8FC8D4,
    palette: { particle: 0xaecdd6, fogTint: 0xd6e4e8, accent: 0x6FD8E8, ambient: 0xc2dadf, groundGlow: 0x69b3c4 },
    build: buildRobot },
  { name: 'Penguin', light: 0x9aa0c0,
    palette: { particle: 0xb6b6cf, fogTint: 0xdadae6, accent: 0x9aa0c0, ambient: 0xc4c4da, groundGlow: 0x7c7ca2 },
    build: buildPenguin },
];

export const SKIN_INFO = SKINS.map((s, i) => ({
  index: i, name: s.name,
  emoji: ['🐰', '🐸', '🐻', '🤖', '🐧'][i],
}));

export function createCharacter(scene: THREE.Scene, skinIndex?: number): Character {
  const ch = new THREE.Group();
  ch.userData = { isCharacter: true };
  scene.add(ch);

  const idx = skinIndex !== undefined ? skinIndex % SKINS.length : Math.floor(Math.random() * SKINS.length);
  const skin = SKINS[idx];

  const headGrp = new THREE.Group(); headGrp.position.y = HEAD_Y; ch.add(headGrp);
  const bodyGrp = new THREE.Group(); bodyGrp.position.y = BODY_Y; ch.add(bodyGrp);
  const shoulderL = new THREE.Group(); shoulderL.position.set(-SHO_X, SHO_Y, 0); ch.add(shoulderL);
  const shoulderR = new THREE.Group(); shoulderR.position.set(SHO_X, SHO_Y, 0); ch.add(shoulderR);
  const hipL = new THREE.Group(); hipL.position.set(-HIP_X, HIP_Y, 0); ch.add(hipL);
  const hipR = new THREE.Group(); hipR.position.set(HIP_X, HIP_Y, 0); ch.add(hipR);

  const parts = skin.build(headGrp, bodyGrp, shoulderL, shoulderR, hipL, hipR, ch);

  const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({
        color: 0x080810, transparent: true, opacity: 0.28,
        depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; ch.add(shadow);

  const cLight = new THREE.PointLight(skin.light, 0.65, 4.5);
  cLight.position.y = 1.0; ch.add(cLight);

  let squashT = 0;
  function landSquash(): void { squashT = 0.18; }

  function animate(t: number, moving: boolean, sprinting = false, groundY?: number): void {
    const animSpd = sprinting ? 13 : 9;
    const wp = moving ? t * animSpd : 0;
    const sw = moving ? Math.sin(wp) : 0;
    const swingArm = sprinting ? 0.70 : 0.50;
    const swingLeg = sprinting ? 0.62 : 0.42;

    // 어깨 스윙 (정지 시 미세한 호흡 흔들림)
    shoulderL.rotation.x = moving ? -sw * swingArm : Math.sin(t * 1.1) * 0.04;
    shoulderR.rotation.x = moving ? sw * swingArm : -Math.sin(t * 1.1) * 0.04;
    // 어깨를 살짝 안쪽으로 → 부드러운 실루엣
    shoulderL.rotation.z = 0.06; shoulderR.rotation.z = -0.06;

    // 엉덩이 스윙
    hipL.rotation.x = sw * swingLeg; hipR.rotation.x = -sw * swingLeg;

    // 무릎: 다리가 뒤로 빠질 때 굽혀 자연스러운 보폭. 정지 시 살짝만.
    const kb = sprinting ? 0.7 : 0.55;
    if (parts.kneeL) parts.kneeL.rotation.x = moving ? Math.max(0, -sw) * kb + 0.05 : 0.05;
    if (parts.kneeR) parts.kneeR.rotation.x = moving ? Math.max(0, sw) * kb + 0.05 : 0.05;

    // 팔꿈치: 항상 살짝 굽힘 + 이동 시 앞스윙에서 더 굽힘
    const eb = moving ? (sprinting ? 0.45 : 0.30) : 0;
    if (parts.elbowL) parts.elbowL.rotation.x = -(0.18 + Math.max(0, sw) * eb);
    if (parts.elbowR) parts.elbowR.rotation.x = -(0.18 + Math.max(0, -sw) * eb);

    // 몸통 — 질주 시 앞으로, 걷기 시 미세한 비틀림
    const leanTarget = sprinting ? 0.12 : 0;
    bodyGrp.rotation.x += (leanTarget - bodyGrp.rotation.x) * 0.15;
    bodyGrp.rotation.y = moving ? Math.sin(wp) * 0.04 : 0;
    headGrp.rotation.y = moving ? -Math.sin(wp) * 0.03 : Math.sin(t * 0.6) * 0.06;
    headGrp.rotation.z = moving ? Math.sin(wp) * 0.02 : 0;

    const bob = moving ? Math.abs(Math.sin(wp)) * (sprinting ? 0.055 : 0.035) : Math.sin(t * 2) * 0.01;
    shadow.position.y = groundY !== undefined ? groundY - ch.position.y + 0.01 : 0.005;

    let sqY = 1, sqXZ = 1;
    if (squashT > 0) { const p = squashT / 0.18; sqY = 1 - p * 0.2; sqXZ = 1 + p * 0.12; squashT = Math.max(0, squashT - 1 / 60 * 1.2); }
    ch.scale.set(sqXZ, sqY, sqXZ);

    headGrp.position.y = HEAD_Y + bob; bodyGrp.position.y = BODY_Y + bob * 0.6;
    shoulderL.position.y = SHO_Y + bob * 0.55; shoulderR.position.y = SHO_Y + bob * 0.55;
    hipL.position.y = HIP_Y + bob * 0.2; hipR.position.y = HIP_Y + bob * 0.2;

    const bc = t % 3.8;
    const blink = (bc > 3.5 && bc < 3.65) || (t % 7 > 6.7 && t % 7 < 6.85);
    parts.eyeL.scale.y = blink ? 0.1 : 1; parts.eyeR.scale.y = blink ? 0.1 : 1;
    if (parts.hlL) parts.hlL.visible = !blink; if (parts.hlR) parts.hlR.visible = !blink;
    if (parts.blushMat) parts.blushMat.opacity = 0.30 + Math.sin(t) * 0.05;
    if (parts.tail) { const ta = moving ? (sprinting ? 3 : 2) : 1; parts.tail.forEach((tp, i) => { tp.position.x = Math.sin(t * 2.5 + i * 0.8) * 0.06 * (i + 1) * 0.5 * ta; }); }
    if (parts.extra) parts.extra(t, moving, sprinting);
  }

  return { group: ch, animate, landSquash, skinName: skin.name, skinIndex: idx, palette: skin.palette };
}
