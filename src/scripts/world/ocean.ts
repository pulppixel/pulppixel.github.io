// Voxel-friendly animated ocean: gentle waves, quantized color, cell grid
// v2: perf.oceanSegments 기반 세그먼트 수 조절
import * as THREE from 'three';
import { perf } from '../core/performance';
import { stdMat } from '../core/helpers';

export function buildOcean(scene: THREE.Scene): THREE.Mesh {
  const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 180),
      stdMat(0x2a9098, 0.6),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -5.0, -29);
  floor.receiveShadow = true;
  scene.add(floor);

  const seg = perf.oceanSegments;

  // low 티어: custom shader 대신 단순 MeshStandardMaterial (fragment 부하 제거)
  if (perf.tier === 'low') {
    const simpleMat = new THREE.MeshStandardMaterial({
      color: 0x3ab0c8, transparent: true, opacity: 0.7,
      metalness: 0.2, roughness: 0.4,
    });
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(220, 180, 4, 4),
        simpleMat,
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -2.0, -29);
    water.renderOrder = 1;
    scene.add(water);
    // uTime uniform이 없으므로 updateEnvironment에서 안전하게 스킵됨
    return water;
  }

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x3ab0c8) },
      uShallow: { value: new THREE.Color(0x78dce8) },
      uFoam: { value: new THREE.Color(0xd0f4ff) },
      uOpacity: { value: 0.76 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWaveH;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float h = 0.0;
        h += sin(pos.x * 0.2 + uTime * 0.35) * 0.08;
        h += sin(pos.y * 0.18 + uTime * 0.28) * 0.06;
        h += sin((pos.x * 0.3 + pos.y * 0.2) + uTime * 0.45) * 0.04;
        h += sin((pos.x * 0.15 - pos.y * 0.25) + uTime * 0.3) * 0.03;
        pos.z += h;
        vWaveH = h;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uFoam;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vWaveH;
      varying vec3 vWorldPos;

      void main() {
        float depth = smoothstep(-0.06, 0.12, vWaveH);
        depth = floor(depth * 3.0 + 0.5) / 3.0;
        vec3 col = mix(uDeep, uShallow, depth);
        vec2 cell = fract(vWorldPos.xz * 0.12 + uTime * 0.03);
        float grid = step(0.93, max(cell.x, cell.y));
        col += uShallow * grid * 0.05;
        vec2 sp = floor(vWorldPos.xz * 0.5);
        float seed = fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453);
        float sparkle = step(0.97, seed) * (0.5 + 0.5 * sin(uTime * 2.0 + seed * 20.0));
        col += vec3(1.0, 1.0, 0.95) * sparkle * 0.12;
        float foam = smoothstep(0.08, 0.14, vWaveH) * 0.10;
        col = mix(col, uFoam, foam);
        float shimmer = sin(vWorldPos.x * 0.6 + uTime * 0.3)
                      * sin(vWorldPos.z * 0.5 - uTime * 0.25);
        col += uShallow * max(0.0, shimmer) * 0.04;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });

  const water = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 180, seg, seg),
      waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -2.0, -29);
  water.renderOrder = 1;
  scene.add(water);

  return water;
}