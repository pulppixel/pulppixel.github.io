// Animated ocean: multi-wave vertex displacement + caustics + foam
import * as THREE from 'three';
import { stdMat } from '../core/helpers';

export function buildOcean(scene: THREE.Scene, isMobile: boolean): THREE.Mesh {
  // Deep ocean floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), stdMat(0x1a6878, 0.6));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.8, -29);
  floor.receiveShadow = true;
  scene.add(floor);

  // Water surface
  const seg = isMobile ? 64 : 128;
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1a7888) },
      uShallow: { value: new THREE.Color(0x58d8e8) },
      uFoam: { value: new THREE.Color(0xc8f0f5) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uOpacity: { value: 0.82 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWaveH;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float wave(vec2 p, float t) {
        float w = 0.0;
        w += sin(p.x * 0.35 + t * 0.6) * 0.18;
        w += sin(p.y * 0.28 + t * 0.45) * 0.15;
        w += sin((p.x * 0.6 + p.y * 0.4) + t * 0.9) * 0.08;
        w += sin((p.x * 0.3 - p.y * 0.7) + t * 0.7) * 0.06;
        w += sin(p.x * 1.8 + t * 1.8) * 0.025;
        w += sin(p.y * 2.1 - t * 1.5) * 0.02;
        w += sin((p.x + p.y) * 2.5 + t * 2.2) * 0.015;
        return w;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;
        float h = wave(pos.xy, uTime);
        pos.z += h;
        vWaveH = h;

        float eps = 0.5;
        float hx = wave(pos.xy + vec2(eps, 0.0), uTime);
        float hz = wave(pos.xy + vec2(0.0, eps), uTime);
        vNormal = normalize(cross(
          vec3(0.0, eps, hz - h),
          vec3(eps, 0.0, hx - h)
        ));

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uFoam, uSunDir;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vWaveH;
      varying vec3 vWorldPos, vNormal;

      float caustic(vec2 p, float t) {
        vec2 i = floor(p), f = fract(p);
        float md = 1.0;
        for (int x = -1; x <= 1; x++) {
          for (int y = -1; y <= 1; y++) {
            vec2 n = vec2(float(x), float(y));
            vec2 o = fract(vec2(
              sin(dot(i + n, vec2(127.1, 311.7))) * 43758.5453,
              sin(dot(i + n, vec2(269.5, 183.3))) * 43758.5453
            ));
            o = 0.5 + 0.5 * sin(t * 0.8 + 6.2831 * o);
            md = min(md, length(n + o - f));
          }
        }
        return md;
      }

      void main() {
        float depth = smoothstep(-0.15, 0.2, vWaveH);
        vec3 col = mix(uDeep, uShallow, depth);

        // Caustics
        float c1 = caustic(vWorldPos.xz * 0.4, uTime);
        float c2 = caustic(vWorldPos.xz * 0.3 + 5.0, uTime * 0.7);
        col += uShallow * (smoothstep(0.15, 0.0, c1) * 0.3 + smoothstep(0.2, 0.0, c2) * 0.15) * 0.6;

        // Foam
        float foam = smoothstep(0.15, 0.30, vWaveH) + smoothstep(0.22, 0.35, vWaveH) * 0.4;
        foam *= 0.5 + sin(vWorldPos.x * 3.0 + uTime * 1.2) * sin(vWorldPos.z * 2.8 - uTime * 0.9) * 0.5;
        col = mix(col, uFoam, clamp(foam * 0.35, 0.0, 0.3));

        // Fresnel
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0);
        col += vec3(0.15, 0.22, 0.25) * fresnel * 0.4;

        // Sun specular
        vec3 halfDir = normalize(uSunDir + viewDir);
        col += vec3(1.0, 0.95, 0.85) * pow(max(0.0, dot(vNormal, halfDir)), 120.0) * 0.5;

        // Shimmer
        float shimmer = sin(vWorldPos.x * 1.5 + uTime * 0.5) * sin(vWorldPos.z * 1.2 - uTime * 0.4);
        col += uShallow * max(0.0, shimmer) * 0.05;

        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 120, seg, seg), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.05, -29);
  water.renderOrder = 1;
  scene.add(water);

  return water;
}
