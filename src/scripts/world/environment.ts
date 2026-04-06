// 1. Waterfall — Overworld 섬 가장자리에서 바다로 떨어지는 물줄기 + 안개
// 2. Coastal waves — foam strip opacity pulse
// 3. Cloud shadows — 구름 아래 이동하는 그림자
import * as THREE from 'three';

// =============================================
// Shared particle shader (particles.ts와 동일 구조)
// =============================================

function makeWaterMat(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 aColor;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vAlpha = aAlpha;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (250.0 / -mv.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
        fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float soft = 1.0 - smoothstep(0.15, 0.5, d);
        gl_FragColor = vec4(vColor, vAlpha * soft);
      }
    `,
    });
}

// =============================================
// 1. Waterfall
// =============================================

const FALL_X = -9;       // 섬 왼쪽 가장자리
const FALL_Z = -58;      // 섬 Z 중앙
const FALL_TOP = 12.0;   // 절벽 꼭대기
const FALL_BOT = -1.0;   // 수면 근처
const FALL_WIDTH = 2.5;  // 폭포 폭

interface WaterfallP {
    x: number; y: number; z: number;
    vy: number; vx: number;
    life: number; maxLife: number;
    type: 'drop' | 'mist';
}

function createWaterfall(scene: THREE.Scene, isMobile: boolean) {
    const dropCount = isMobile ? 25 : 50;
    const mistCount = isMobile ? 8 : 16;
    const total = dropCount + mistCount;

    const pos = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const alpha = new Float32Array(total);
    const color = new Float32Array(total * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

    const mat = makeWaterMat();
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    const particles: WaterfallP[] = [];
    let spawnTimer = 0;

    // 물방울 색: 연한 시안~흰색
    const dropCols: [number, number, number][] = [
        [0.78, 0.92, 0.98], [0.85, 0.95, 1.0], [0.70, 0.88, 0.95],
    ];
    // 안개 색: 더 연한 흰색
    const mistCol: [number, number, number] = [0.88, 0.94, 0.98];

    function spawnDrop(): WaterfallP {
        return {
            x: FALL_X + (Math.random() - 0.5) * 0.4,
            y: FALL_TOP + Math.random() * 0.3,
            z: FALL_Z + (Math.random() - 0.5) * FALL_WIDTH,
            vy: -(5 + Math.random() * 3),
            vx: -(0.2 + Math.random() * 0.3), // 살짝 바깥으로
            life: 0,
            maxLife: 1.2 + Math.random() * 0.5,
            type: 'drop',
        };
    }

    function spawnMist(): WaterfallP {
        return {
            x: FALL_X - 0.5 + (Math.random() - 0.5) * 1.5,
            y: FALL_BOT + Math.random() * 0.8,
            z: FALL_Z + (Math.random() - 0.5) * FALL_WIDTH * 1.5,
            vy: 0.3 + Math.random() * 0.5,
            vx: -(0.1 + Math.random() * 0.3),
            life: 0,
            maxLife: 2 + Math.random() * 1.5,
            type: 'mist',
        };
    }

    // 초기 파티클
    for (let i = 0; i < dropCount; i++) {
        const p = spawnDrop();
        p.life = Math.random() * p.maxLife; // 다양한 시작점
        particles.push(p);
    }
    for (let i = 0; i < mistCount; i++) {
        const p = spawnMist();
        p.life = Math.random() * p.maxLife;
        particles.push(p);
    }

    return {
        update(dt: number, t: number) {
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnTimer = 0.03;
                // 죽은 파티클 재활용
                for (const p of particles) {
                    if (p.life >= p.maxLife) {
                        if (p.type === 'drop') Object.assign(p, spawnDrop());
                        else Object.assign(p, spawnMist());
                        break;
                    }
                }
            }

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.life += dt;
                if (p.life >= p.maxLife) {
                    alpha[i] = 0;
                    continue;
                }

                const progress = p.life / p.maxLife;

                if (p.type === 'drop') {
                    // 물방울: 가속하며 떨어짐
                    p.vy -= 8 * dt; // 중력
                    p.y += p.vy * dt;
                    p.x += p.vx * dt;

                    // 수면에 닿으면 재스폰
                    if (p.y < FALL_BOT) {
                        Object.assign(p, spawnDrop());
                        continue;
                    }

                    const i3 = i * 3;
                    pos[i3] = p.x;
                    pos[i3 + 1] = p.y;
                    pos[i3 + 2] = p.z;

                    size[i] = 2.5 + Math.random() * 1.5;
                    alpha[i] = 0.5 * (1 - progress * 0.3);

                    const c = dropCols[i % dropCols.length];
                    color[i3] = c[0]; color[i3 + 1] = c[1]; color[i3 + 2] = c[2];
                } else {
                    // 안개: 천천히 위로 + 바깥으로 퍼짐
                    p.y += p.vy * dt;
                    p.x += p.vx * dt;
                    p.vy *= 1 - 0.5 * dt; // 감속

                    const i3 = i * 3;
                    pos[i3] = p.x;
                    pos[i3 + 1] = p.y;
                    pos[i3 + 2] = p.z;

                    // 안개는 크게, 투명하게
                    size[i] = 5 + progress * 8;
                    const fadeIn = Math.min(1, p.life / 0.5);
                    const fadeOut = Math.max(0, 1 - (progress - 0.5) / 0.5);
                    alpha[i] = fadeIn * fadeOut * 0.15;

                    color[i3] = mistCol[0]; color[i3 + 1] = mistCol[1]; color[i3 + 2] = mistCol[2];
                }
            }

            geo.attributes.position.needsUpdate = true;
            (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
            (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
            (geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
        },
    };
}

// =============================================
// 2. Coastal Wave Pulse
// =============================================

function createCoastalWaves(scene: THREE.Scene) {
    const foamMaterials: THREE.MeshBasicMaterial[] = [];

    // 씬에서 foam strip 검색 (color 0xc8f0f5, MeshBasicMaterial)
    setTimeout(() => {
        scene.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const mat = obj.material;
            if (!(mat instanceof THREE.MeshBasicMaterial)) return;
            if (!mat.transparent) return;

            // foam strip 판별: 색상 + opacity 범위
            const c = mat.color;
            if (Math.abs(c.r - 0.784) < 0.05 &&
                Math.abs(c.g - 0.941) < 0.05 &&
                Math.abs(c.b - 0.961) < 0.05) {
                // foam strip material 발견
                if (!foamMaterials.includes(mat)) {
                    foamMaterials.push(mat);
                }
            }
        });
    }, 500);

    return {
        update(t: number) {
            // 여러 주파수의 파도 중첩 (자연스러운 느낌)
            const wave = 0.12 + Math.sin(t * 0.8) * 0.05
                + Math.sin(t * 1.3 + 1.5) * 0.03
                + Math.sin(t * 2.1 + 0.7) * 0.02;

            for (const mat of foamMaterials) {
                mat.opacity = wave;
            }
        },
    };
}

// =============================================
// 3. Cloud Shadows
// =============================================

function createCloudShadows(scene: THREE.Scene, isMobile: boolean) {
    if (isMobile) {
        // 모바일: 구름 그림자 스킵 (오버헤드 대비 효과 미미)
        return { update() {} };
    }

    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
    });

    // sky.ts의 구름 정의와 동일한 초기 위치
    const cloudDefs: [number, number, number][] = [
        [-25, -15, 1.2], [20, -35, 1.0], [-10, -55, 0.9],
        [35, -20, 1.1], [-35, -45, 0.8], [15, -60, 1.0],
        [40, -50, 0.7], [-20, -30, 1.3],
    ];

    interface Shadow {
        mesh: THREE.Mesh;
        x: number; // current X (drifts with cloud)
        baseZ: number;
        scale: number;
        speed: number; // index-based speed factor
    }

    const shadows: Shadow[] = [];

    cloudDefs.forEach(([cx, cz, s], i) => {
        const w = 3.5 * s + Math.random() * 2;
        const d = 2 * s + Math.random() * 1.5;
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            shadowMat,
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.03, cz); // 지면 바로 위
        mesh.renderOrder = -1;
        scene.add(mesh);

        shadows.push({
            mesh, x: cx, baseZ: cz, scale: s,
            speed: 0.15 * (0.5 + (i % 3) * 0.2), // sky.ts와 동일한 속도
        });
    });

    return {
        update(dt: number) {
            for (const s of shadows) {
                // sky.ts 구름과 동일한 이동 패턴
                s.x += s.speed * dt;
                if (s.x > 55) s.x = -55;
                s.mesh.position.x = s.x;
            }
        },
    };
}

// =============================================
// Factory
// =============================================

export interface EnvironmentEffects {
    update(dt: number, t: number): void;
}

export function createEnvironmentEffects(scene: THREE.Scene, isMobile: boolean): EnvironmentEffects {
    const waterfall = createWaterfall(scene, isMobile);
    const waves = createCoastalWaves(scene);
    const cloudShadows = createCloudShadows(scene, isMobile);

    return {
        update(dt, t) {
            waterfall.update(dt, t);
            waves.update(t);
            cloudShadows.update(dt);
        },
    };
}