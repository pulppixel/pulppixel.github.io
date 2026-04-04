// Post processing: UnrealBloom + Vignette, auto-adjusts by time-of-day
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostFX {
  render(): void;
  resize(w: number, h: number): void;
  updateForTime(timeLabel: string, dt: number): void;
}

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.3 },
    uSoftness: { value: 0.45 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uIntensity; uniform float uSoftness; varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float vig = smoothstep(uSoftness, uSoftness + 0.35, distance(vUv, vec2(0.5)));
      color.rgb *= 1.0 - vig * uIntensity;
      gl_FragColor = color;
    }
  `,
};

const BLOOM_MAP: Record<string, number> = { dawn: 0.35, day: 0.2, sunset: 0.45, night: 0.65 };
const VIGNETTE_MAP: Record<string, number> = { dawn: 0.25, day: 0.15, sunset: 0.35, night: 0.45 };

export function createPostFX(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.PerspectiveCamera, isMobile: boolean,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const res = new THREE.Vector2(
    isMobile ? innerWidth * 0.5 : innerWidth,
    isMobile ? innerHeight * 0.5 : innerHeight,
  );
  const bloomPass = new UnrealBloomPass(res, isMobile ? 0.2 : 0.3, 0.5, 0.82);
  composer.addPass(bloomPass);

  let vignettePass: ShaderPass | null = null;
  if (!isMobile) { vignettePass = new ShaderPass(VignetteShader); composer.addPass(vignettePass); }

  let curBloom = bloomPass.strength;
  let curVig = 0.3;

  return {
    render() { composer.render(); },
    resize(w, h) {
      composer.setSize(w, h);
      bloomPass.resolution.set(isMobile ? w * 0.5 : w, isMobile ? h * 0.5 : h);
    },
    updateForTime(timeLabel, dt) {
      curBloom += ((BLOOM_MAP[timeLabel] ?? 0.3) - curBloom) * Math.min(1, 2 * dt);
      bloomPass.strength = curBloom;
      if (vignettePass) {
        curVig += ((VIGNETTE_MAP[timeLabel] ?? 0.25) - curVig) * Math.min(1, 2 * dt);
        vignettePass.uniforms.uIntensity.value = curVig;
      }
    },
  };
}
