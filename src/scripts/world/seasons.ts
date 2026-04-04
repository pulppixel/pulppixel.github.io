// Season palette system - dramatic color transitions
// Scans scene for vegetation meshes and applies strong seasonal tinting
import * as THREE from 'three';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

interface SeasonPreset {
  leafTint: THREE.Color;
  flowerTint: THREE.Color;
  grassTint: THREE.Color;
}

// 훨씬 강한 계절 효과
const PRESETS: Record<SeasonName, SeasonPreset> = {
  spring: {
    leafTint: new THREE.Color(0.85, 1.15, 0.90),     // 연초록 + 살짝 핑크
    flowerTint: new THREE.Color(1.4, 0.85, 1.2),     // 벚꽃 핑크 강화
    grassTint: new THREE.Color(0.85, 1.15, 0.75),    // 봄 연두
  },
  summer: {
    leafTint: new THREE.Color(1.0, 1.0, 1.0),
    flowerTint: new THREE.Color(1.0, 1.0, 1.0),
    grassTint: new THREE.Color(1.0, 1.0, 1.0),
  },
  autumn: {
    leafTint: new THREE.Color(1.6, 0.65, 0.25),      // 강한 단풍 (주황~빨강)
    flowerTint: new THREE.Color(1.3, 0.7, 0.35),     // 따뜻한 갈색 꽃
    grassTint: new THREE.Color(1.2, 1.0, 0.55),      // 누런 잔디
  },
  winter: {
    leafTint: new THREE.Color(0.55, 0.60, 0.80),     // 확실한 회색-파랑
    flowerTint: new THREE.Color(0.45, 0.50, 0.75),   // 서리
    grassTint: new THREE.Color(0.75, 0.85, 1.05),    // 얼음 잔디
  },
};

// 식별할 색상 목록 (terrain.ts에서 사용하는 모든 자연 색상)
// 잎: 초록, 주황, 핑크 계열
const LEAF_HEX = [
  0x4aaa4a, 0x3a8a3a,             // 초록 잎
  0xf09050, 0xe87040,             // 주황 잎
  0xf0a0b8, 0xe888a0,             // 핑크 잎
  0x4a9a4a, 0x5aaa5a, 0x3a8a3a,  // 울타리 헤지
];
// 꽃
const FLOWER_HEX = [
  0xf5a8c0, 0xf0d060, 0x88c8e8, 0xf5c8e0,  // 꽃
];
// 잔디
const GRASS_HEX = [
  0x80d880, 0x68c068,  // 잔디
  0x58b858, 0x48a048,  // 풀
];

interface TintedMesh {
  mesh: THREE.Mesh;
  originalColor: THREE.Color;
  type: 'leaf' | 'flower' | 'grass';
}

export interface SeasonSystem {
  setSeason(name: SeasonName): void;
  getSeason(): SeasonName;
  update(dt: number): void;
}

function colorDist(a: THREE.Color, b: THREE.Color): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function matchType(hex: number): 'leaf' | 'flower' | 'grass' | null {
  const c = new THREE.Color(hex);
  const THRESHOLD = 0.25;  // 넉넉한 매칭 범위

  for (const h of LEAF_HEX) {
    if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'leaf';
  }
  for (const h of FLOWER_HEX) {
    if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'flower';
  }
  for (const h of GRASS_HEX) {
    if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'grass';
  }
  return null;
}

export function createSeasonSystem(scene: THREE.Scene): SeasonSystem {
  let currentSeason: SeasonName = 'summer';
  let targetPreset = PRESETS.summer;
  const currentLeafTint = new THREE.Color(1, 1, 1);
  const currentFlowerTint = new THREE.Color(1, 1, 1);
  const currentGrassTint = new THREE.Color(1, 1, 1);

  const tinted: TintedMesh[] = [];
  let scanned = false;

  function scanScene(): void {
    if (scanned) return;
    scanned = true;

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (!mat || !(mat instanceof THREE.MeshStandardMaterial)) return;
      if (!mat.color) return;

      const type = matchType(mat.color.getHex());
      if (type) {
        tinted.push({
          mesh: obj,
          originalColor: mat.color.clone(),
          type,
        });
      }
    });
  }

  const _tmp = new THREE.Color();

  return {
    setSeason(name: SeasonName) {
      currentSeason = name;
      targetPreset = PRESETS[name];
    },

    getSeason() { return currentSeason; },

    update(dt: number) {
      // 첫 프레임에서 씬 스캔 (모든 메시가 생성된 후)
      if (!scanned) {
        setTimeout(() => scanScene(), 300);
        return;
      }

      // 부드럽게 보간
      const spd = Math.min(1, 2.5 * dt);
      currentLeafTint.lerp(targetPreset.leafTint, spd);
      currentFlowerTint.lerp(targetPreset.flowerTint, spd);
      currentGrassTint.lerp(targetPreset.grassTint, spd);

      // 모든 식물 메시에 tint 적용
      for (const t of tinted) {
        const tint = t.type === 'leaf' ? currentLeafTint
                   : t.type === 'flower' ? currentFlowerTint
                   : currentGrassTint;

        _tmp.copy(t.originalColor);
        _tmp.r = Math.min(1, _tmp.r * tint.r);
        _tmp.g = Math.min(1, _tmp.g * tint.g);
        _tmp.b = Math.min(1, _tmp.b * tint.b);

        (t.mesh.material as THREE.MeshStandardMaterial).color.copy(_tmp);
      }
    },
  };
}
