// Season palette system - dramatic color transitions
// v2: Mobile throttle (매 4프레임마다 갱신)
import * as THREE from 'three';
import { perf } from '../core/performance';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

interface SeasonPreset {
  leafTint: THREE.Color;
  flowerTint: THREE.Color;
  grassTint: THREE.Color;
}

const PRESETS: Record<SeasonName, SeasonPreset> = {
  spring: {
    leafTint: new THREE.Color(0.85, 1.15, 0.90),
    flowerTint: new THREE.Color(1.4, 0.85, 1.2),
    grassTint: new THREE.Color(0.85, 1.15, 0.75),
  },
  summer: {
    leafTint: new THREE.Color(1.0, 1.0, 1.0),
    flowerTint: new THREE.Color(1.0, 1.0, 1.0),
    grassTint: new THREE.Color(1.0, 1.0, 1.0),
  },
  autumn: {
    leafTint: new THREE.Color(1.6, 0.65, 0.25),
    flowerTint: new THREE.Color(1.3, 0.7, 0.35),
    grassTint: new THREE.Color(1.2, 1.0, 0.55),
  },
  winter: {
    leafTint: new THREE.Color(0.55, 0.60, 0.80),
    flowerTint: new THREE.Color(0.45, 0.50, 0.75),
    grassTint: new THREE.Color(0.75, 0.85, 1.05),
  },
};

const LEAF_HEX = [
  0x4aaa4a, 0x3a8a3a,
  0xf09050, 0xe87040,
  0xf0a0b8, 0xe888a0,
  0x4a9a4a, 0x5aaa5a, 0x3a8a3a,
];
const FLOWER_HEX = [0xf5a8c0, 0xf0d060, 0x88c8e8, 0xf5c8e0];
const GRASS_HEX = [0x80d880, 0x68c068, 0x58b858, 0x48a048];

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
  const THRESHOLD = 0.25;
  for (const h of LEAF_HEX) if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'leaf';
  for (const h of FLOWER_HEX) if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'flower';
  for (const h of GRASS_HEX) if (colorDist(c, new THREE.Color(h)) < THRESHOLD) return 'grass';
  return null;
}

function hasTaggedAncestor(obj: THREE.Object3D): boolean {
  let p = obj.parent;
  while (p) {
    if (p.userData?.isCharacter || p.userData?.isAnimal) return true;
    p = p.parent;
  }
  return false;
}

export function createSeasonSystem(scene: THREE.Scene): SeasonSystem {
  let currentSeason: SeasonName = 'summer';
  let targetPreset = PRESETS.summer;
  const currentLeafTint = new THREE.Color(1, 1, 1);
  const currentFlowerTint = new THREE.Color(1, 1, 1);
  const currentGrassTint = new THREE.Color(1, 1, 1);

  const tinted: TintedMesh[] = [];
  let scanned = false;
  let frameCount = 0;

  function scanScene(): void {
    if (scanned) return;
    scanned = true;

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (hasTaggedAncestor(obj)) return;
      const mat = obj.material;
      if (!mat || !(mat instanceof THREE.MeshStandardMaterial)) return;
      if (!mat.color) return;

      const type = matchType(mat.color.getHex());
      if (type) {
        tinted.push({ mesh: obj, originalColor: mat.color.clone(), type });
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
      if (!scanned) {
        setTimeout(() => scanScene(), 300);
        return;
      }

      if (perf.throttleSkip > 1) {
        frameCount++;
        if (frameCount % perf.throttleSkip !== 0) return;
        dt *= perf.throttleSkip;
      }

      const spd = Math.min(1, 2.5 * dt);
      currentLeafTint.lerp(targetPreset.leafTint, spd);
      currentFlowerTint.lerp(targetPreset.flowerTint, spd);
      currentGrassTint.lerp(targetPreset.grassTint, spd);

      for (const t of tinted) {
        const tint = t.type === 'leaf' ? currentLeafTint : t.type === 'flower' ? currentFlowerTint : currentGrassTint;

        _tmp.copy(t.originalColor);
        _tmp.r = Math.min(1, _tmp.r * tint.r);
        _tmp.g = Math.min(1, _tmp.g * tint.g);
        _tmp.b = Math.min(1, _tmp.b * tint.b);

        (t.mesh.material as THREE.MeshStandardMaterial).color.copy(_tmp);
      }
    },
  };
}