// ─── 포스트 프로세싱 ───
// UnrealBloom + Vignette · 시간대별 bloom 강도 자동 조절
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostFX {
    render(): void;
    resize(w: number, h: number): void;
    /** 시간대 라벨에 따라 bloom 강도 자동 조절 */
    updateForTime(timeLabel: string, dt: number): void;
}

// ── Vignette Shader ──

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uIntensity: { value: 0.3 },
        uSoftness: { value: 0.45 },
    },
    vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSoftness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(uSoftness, uSoftness + 0.35, dist);
      color.rgb *= 1.0 - vig * uIntensity;
      gl_FragColor = color;
    }
  `,
};

// ── Bloom 강도 맵 ──

const BLOOM_MAP: Record<string, number> = {
    dawn: 0.35,
    day: 0.2,
    sunset: 0.45,
    night: 0.65,
};

const VIGNETTE_MAP: Record<string, number> = {
    dawn: 0.25,
    day: 0.15,
    sunset: 0.35,
    night: 0.45,
};

// ── Factory ──

export function createPostFX(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    isMobile: boolean,
): PostFX {
    const composer = new EffectComposer(renderer);

    // 1. Render pass
    composer.addPass(new RenderPass(scene, camera));

    // 2. Bloom
    const res = new THREE.Vector2(
        isMobile ? innerWidth * 0.5 : innerWidth,
        isMobile ? innerHeight * 0.5 : innerHeight,
    );
    const bloomPass = new UnrealBloomPass(
        res,
        isMobile ? 0.2 : 0.3,  // strength (초기값, 시간대별로 변동)
        0.5,                     // radius
        0.82,                    // threshold — 이 밝기 이상만 bloom
    );
    composer.addPass(bloomPass);

    // 3. Vignette (모바일은 생략 — 성능)
    let vignettePass: ShaderPass | null = null;
    if (!isMobile) {
        vignettePass = new ShaderPass(VignetteShader);
        composer.addPass(vignettePass);
    }

    // 현재 bloom/vignette 값 (smooth lerp용)
    let curBloom = bloomPass.strength;
    let curVig = 0.3;

    return {
        render() {
            composer.render();
        },

        resize(w, h) {
            composer.setSize(w, h);
            bloomPass.resolution.set(
                isMobile ? w * 0.5 : w,
                isMobile ? h * 0.5 : h,
            );
        },

        updateForTime(timeLabel, dt) {
            const targetBloom = BLOOM_MAP[timeLabel] ?? 0.3;
            const targetVig = VIGNETTE_MAP[timeLabel] ?? 0.25;

            // Smooth transition (2초)
            curBloom += (targetBloom - curBloom) * Math.min(1, 2 * dt);
            bloomPass.strength = curBloom;

            if (vignettePass) {
                curVig += (targetVig - curVig) * Math.min(1, 2 * dt);
                vignettePass.uniforms.uIntensity.value = curVig;
            }
        },
    };
}