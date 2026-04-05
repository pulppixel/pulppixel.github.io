// Wind animation: gentle swaying for vegetation
// v2: Mobile throttle (매 3프레임마다 갱신)
import * as THREE from 'three';

export interface WindSystem {
  update(t: number): void;
}

interface SwayTarget {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  amplitude: number;
  speed: number;
  type: 'leaf' | 'flower' | 'mushroom' | 'hedge';
}

const LEAF_HEX = new Set([0x4aaa4a, 0x3a8a3a, 0xf09050, 0xe87040, 0xf0a0b8, 0xe888a0]);
const HEDGE_HEX = new Set([0x4a9a4a, 0x5aaa5a, 0x3a8a3a]);
const FLOWER_HEX = new Set([0xf5a8c0, 0xf0d060, 0x88c8e8, 0xf5c8e0]);

function colorClose(c: THREE.Color, targets: Set<number>, threshold = 0.2): boolean {
  for (const hex of targets) {
    const t = new THREE.Color(hex);
    if (Math.abs(c.r - t.r) + Math.abs(c.g - t.g) + Math.abs(c.b - t.b) < threshold) return true;
  }
  return false;
}

function hasTaggedAncestor(obj: THREE.Object3D): boolean {
  let p = obj.parent;
  while (p) {
    if (p.userData?.isCharacter || p.userData?.isAnimal) return true;
    p = p.parent;
  }
  return false;
}

export function createWindSystem(scene: THREE.Scene, isMobile = false): WindSystem {
  const targets: SwayTarget[] = [];
  let frameCount = 0;

  setTimeout(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (hasTaggedAncestor(obj)) return;
      const mat = obj.material;
      if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.color) return;

      const c = mat.color;
      const y = obj.position.y;

      if (y > 2.0 && colorClose(c, LEAF_HEX)) {
        targets.push({
          mesh: obj,
          baseX: obj.position.x, baseY: obj.position.y, baseZ: obj.position.z,
          phase: Math.random() * Math.PI * 2,
          amplitude: 0.03 + Math.random() * 0.04,
          speed: 0.8 + Math.random() * 0.6,
          type: 'leaf',
        });
        return;
      }

      if (y > 0.3 && colorClose(c, HEDGE_HEX)) {
        targets.push({
          mesh: obj,
          baseX: obj.position.x, baseY: obj.position.y, baseZ: obj.position.z,
          phase: Math.random() * Math.PI * 2,
          amplitude: 0.01 + Math.random() * 0.015,
          speed: 0.6 + Math.random() * 0.4,
          type: 'hedge',
        });
        return;
      }

      if (y < 3.0 && colorClose(c, FLOWER_HEX)) {
        const geo = obj.geometry;
        if (geo instanceof THREE.BoxGeometry) {
          const params = geo.parameters;
          if (params.width < 0.4 && params.height < 0.4) {
            targets.push({
              mesh: obj,
              baseX: obj.position.x, baseY: obj.position.y, baseZ: obj.position.z,
              phase: Math.random() * Math.PI * 2,
              amplitude: 0.02 + Math.random() * 0.025,
              speed: 1.2 + Math.random() * 0.8,
              type: 'flower',
            });
          }
        }
      }
    });
  }, 250);

  return {
    update(t: number) {
      if (isMobile) {
        frameCount++;
        if (frameCount % 3 !== 0) return;
      }

      for (const s of targets) {
        const wind1 = Math.sin(t * s.speed + s.phase) * s.amplitude;
        const wind2 = Math.sin(t * s.speed * 1.7 + s.phase * 0.7) * s.amplitude * 0.4;
        const wind3 = Math.sin(t * 0.3 + s.baseX * 0.1) * s.amplitude * 0.6;

        const totalX = wind1 + wind3;
        const totalZ = wind2;

        if (s.type === 'leaf') {
          s.mesh.position.x = s.baseX + totalX;
          s.mesh.position.z = s.baseZ + totalZ;
          s.mesh.rotation.z = wind1 * 0.8;
          s.mesh.rotation.x = wind2 * 0.5;
        } else if (s.type === 'hedge') {
          s.mesh.position.x = s.baseX + totalX * 0.5;
          s.mesh.rotation.z = wind1 * 0.3;
        } else {
          s.mesh.position.x = s.baseX + totalX * 0.7;
          s.mesh.rotation.z = (wind1 + wind3) * 1.5;
        }
      }
    },
  };
}