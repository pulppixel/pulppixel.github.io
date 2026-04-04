// Wind animation: gentle swaying for vegetation
// Scans scene for leaf/flower meshes and applies procedural wind sway
// Non-destructive: stores original positions, applies offset each frame
import * as THREE from 'three';

export interface WindSystem {
  update(t: number): void;
}

interface SwayTarget {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  // Per-mesh variation
  phase: number;
  amplitude: number;
  speed: number;
  type: 'leaf' | 'flower' | 'mushroom' | 'hedge';
}

// 식별 색상 (terrain.ts에서 사용하는 색상들)
const LEAF_HEX = new Set([0x4aaa4a, 0x3a8a3a, 0xf09050, 0xe87040, 0xf0a0b8, 0xe888a0]);
const HEDGE_HEX = new Set([0x4a9a4a, 0x5aaa5a, 0x3a8a3a]);
const FLOWER_HEX = new Set([0xf5a8c0, 0xf0d060, 0x88c8e8, 0xf5c8e0]);
const MUSHROOM_CAP_HEX = new Set([0xf5a8c0, 0xf09050]); // 버섯 캡 (꽃과 겹침 → y로 구분)

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

export function createWindSystem(scene: THREE.Scene): WindSystem {
  const targets: SwayTarget[] = [];

  // 씬 스캔 (지연 실행)
  setTimeout(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (hasTaggedAncestor(obj)) return;
      const mat = obj.material;
      if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.color) return;

      const c = mat.color;
      const y = obj.position.y;

      // 나뭇잎 (높은 위치의 초록/주황/핑크 박스)
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

      // 울타리 헤지 (중간 높이)
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

      // 꽃 (낮은 위치 작은 메시)
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
      for (const s of targets) {
        // 바람 = 다층 사인파 (자연스러운 흔들림)
        const wind1 = Math.sin(t * s.speed + s.phase) * s.amplitude;
        const wind2 = Math.sin(t * s.speed * 1.7 + s.phase * 0.7) * s.amplitude * 0.4;
        const wind3 = Math.sin(t * 0.3 + s.baseX * 0.1) * s.amplitude * 0.6; // 글로벌 바람

        const totalX = wind1 + wind3;
        const totalZ = wind2;

        if (s.type === 'leaf') {
          s.mesh.position.x = s.baseX + totalX;
          s.mesh.position.z = s.baseZ + totalZ;
          // 나뭇잎은 약간의 회전도 추가
          s.mesh.rotation.z = wind1 * 0.8;
          s.mesh.rotation.x = wind2 * 0.5;
        } else if (s.type === 'hedge') {
          s.mesh.position.x = s.baseX + totalX * 0.5;
          s.mesh.rotation.z = wind1 * 0.3;
        } else {
          // 꽃: 줄기처럼 한쪽 방향으로 기울기
          s.mesh.position.x = s.baseX + totalX * 0.7;
          s.mesh.rotation.z = (wind1 + wind3) * 1.5;
        }
      }
    },
  };
}
