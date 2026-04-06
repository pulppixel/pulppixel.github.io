// Ambient particle effects: Fireflies, Campfire smoke, Seasonal petals/leaves
// 공용 ShaderMaterial로 per-particle size/alpha/color 지원
// draw calls: 3 (fireflies + smoke + seasonal)
import * as THREE from 'three';
import type { SeasonName } from './seasons';

// =============================================
// Shared particle shader
// =============================================

function makeParticleMat(additive = false): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
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
// Buffer helpers
// =============================================

interface ParticleBuf {
    geo: THREE.BufferGeometry;
    pos: Float32Array;
    size: Float32Array;
    alpha: Float32Array;
    color: Float32Array;
    count: number;
}

function createBuf(count: number): ParticleBuf {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const alpha = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    return { geo, pos, size, alpha, color, count };
}

function markDirty(buf: ParticleBuf): void {
    buf.geo.attributes.position.needsUpdate = true;
    (buf.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (buf.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (buf.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
}

// =============================================
// 1. Fireflies — night에만 등장
// =============================================

interface Firefly {
    homeX: number; homeZ: number; homeY: number;
    phase: number;    // wander phase
    speed: number;    // wander speed
    radius: number;   // wander radius
    pulsePhase: number;
    pulseSpeed: number;
}

function createFireflies(scene: THREE.Scene, count: number) {
    const buf = createBuf(count);
    const mat = makeParticleMat(true); // additive
    const points = new THREE.Points(buf.geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);

    // 반딧불 색: 따뜻한 황록색
    const glowR = 0.85, glowG = 1.0, glowB = 0.45;

    // 플랫폼 근처 spawn 위치
    const ZONES: [number, number, number][] = [
        // Spawn
        [-3, 1.2, 2], [4, 1.2, -2],
        // Zone 0
        [-6, 1.8, -16], [5, 1.8, -20], [0, 1.8, -14],
        // Zone 1
        [26, 3.2, -38], [32, 3.2, -42],
        // Zone 2
        [-30, 2.8, -38], [-24, 2.8, -42],
        // Zone 3
        [-4, 4.0, -56], [5, 4.0, -60], [0, 4.0, -54],
        // Stepping stones
        [14, 2.2, -28], [-14, 1.8, -28], [0, 2.0, -35],
    ];

    const flies: Firefly[] = [];
    for (let i = 0; i < count; i++) {
        const zone = ZONES[i % ZONES.length];
        flies.push({
            homeX: zone[0] + (Math.random() - 0.5) * 6,
            homeY: zone[1] + 0.5 + Math.random() * 2,
            homeZ: zone[2] + (Math.random() - 0.5) * 6,
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.5,
            radius: 1.5 + Math.random() * 2.5,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 1.5 + Math.random() * 2.0,
        });
    }

    let currentAlpha = 0; // global fade (0 = hidden, 1 = fully visible)

    return {
        update(dt: number, t: number, timeLabel: string) {
            // night: fade in, 그 외: fade out
            const targetAlpha = timeLabel === 'night' ? 1.0 : timeLabel === 'sunset' ? 0.3 : 0;
            currentAlpha += (targetAlpha - currentAlpha) * Math.min(1, 2 * dt);
            points.visible = currentAlpha > 0.01;
            if (!points.visible) return;

            for (let i = 0; i < count; i++) {
                const f = flies[i];
                const i3 = i * 3;

                // 8자형 wandering
                const wx = Math.sin(t * f.speed + f.phase) * f.radius;
                const wz = Math.sin(t * f.speed * 1.7 + f.phase * 0.6) * f.radius * 0.6;
                const wy = Math.sin(t * f.speed * 0.5 + f.phase * 1.3) * 0.8;

                buf.pos[i3] = f.homeX + wx;
                buf.pos[i3 + 1] = f.homeY + wy;
                buf.pos[i3 + 2] = f.homeZ + wz;

                // Pulse glow
                const pulse = 0.3 + Math.pow(Math.max(0, Math.sin(t * f.pulseSpeed + f.pulsePhase)), 3) * 0.7;
                buf.alpha[i] = pulse * currentAlpha;
                buf.size[i] = 2.5 + pulse * 3.0;

                buf.color[i3] = glowR;
                buf.color[i3 + 1] = glowG;
                buf.color[i3 + 2] = glowB;
            }
            markDirty(buf);
        },
    };
}

// =============================================
// 2. Campfire Smoke — 상시 (fire 위치에서 상승)
// =============================================

interface SmokeP {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    life: number; maxLife: number;
    baseSize: number;
}

const FIRE_X = 0, FIRE_Y = 3.7, FIRE_Z = -60;

function createSmoke(scene: THREE.Scene, count: number) {
    const buf = createBuf(count);
    const mat = makeParticleMat(false);
    const points = new THREE.Points(buf.geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    const particles: SmokeP[] = [];
    let spawnTimer = 0;

    // 연기 색: 따뜻한 회갈색
    const smokeR = 0.45, smokeG = 0.40, smokeB = 0.35;

    function spawn(): SmokeP {
        return {
            x: FIRE_X + (Math.random() - 0.5) * 0.3,
            y: FIRE_Y + Math.random() * 0.2,
            z: FIRE_Z + (Math.random() - 0.5) * 0.3,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 1.2 + Math.random() * 0.8,
            vz: (Math.random() - 0.5) * 0.2,
            life: 0,
            maxLife: 2.5 + Math.random() * 2.0,
            baseSize: 3 + Math.random() * 4,
        };
    }

    // 초기 파티클 (일부만 살아있게)
    for (let i = 0; i < count; i++) {
        const p = spawn();
        p.life = p.maxLife * 0.8; // 대부분 거의 죽은 상태로 시작
        particles.push(p);
    }

    return {
        update(dt: number, t: number) {
            // Spawn
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnTimer = 0.15 + Math.random() * 0.1;
                // 죽은 파티클을 재활용
                for (const p of particles) {
                    if (p.life >= p.maxLife) {
                        Object.assign(p, spawn());
                        break;
                    }
                }
            }

            // 바람 — 느린 사인파로 방향 변화
            const windX = Math.sin(t * 0.3) * 0.4;
            const windZ = Math.cos(t * 0.25) * 0.2;

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.life += dt;
                if (p.life >= p.maxLife) {
                    buf.alpha[i] = 0;
                    continue;
                }

                const progress = p.life / p.maxLife; // 0 → 1

                // 이동: 위로 올라가면서 풍향에 쏠림
                p.x += (p.vx + windX * progress) * dt;
                p.y += p.vy * dt;
                p.z += (p.vz + windZ * progress) * dt;
                // 상승 속도 감소 (실제 연기처럼)
                p.vy *= 1 - 0.3 * dt;

                const i3 = i * 3;
                buf.pos[i3] = p.x;
                buf.pos[i3 + 1] = p.y;
                buf.pos[i3 + 2] = p.z;

                // 크기: 시간에 따라 커짐 (연기 확산)
                buf.size[i] = p.baseSize * (1 + progress * 2.5);

                // 알파: 나타났다 사라짐 (0→peak→0)
                const fadeIn = Math.min(1, p.life / 0.3);
                const fadeOut = Math.max(0, 1 - (progress - 0.4) / 0.6);
                buf.alpha[i] = fadeIn * fadeOut * 0.25;

                buf.color[i3] = smokeR + progress * 0.1;
                buf.color[i3 + 1] = smokeG + progress * 0.08;
                buf.color[i3 + 2] = smokeB + progress * 0.05;
            }
            markDirty(buf);
        },
    };
}

// =============================================
// 3. Seasonal Particles — 봄 벚꽃잎, 가을 낙엽
// =============================================
// summer: 없음 (기존 pollen으로 충분)
// winter: 없음 (기존 snow 시스템 사용)

interface Petal {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    rotPhase: number;
    life: number; maxLife: number;
    sizeBase: number;
}

// 계절별 설정
interface SeasonalConfig {
    colors: [number, number, number][]; // RGB 배열
    sizeMin: number; sizeMax: number;
    fallSpeed: number;
    driftStrength: number;
    spawnRate: number;
}

const SEASONAL_CONFIGS: Partial<Record<SeasonName, SeasonalConfig>> = {
    spring: {
        colors: [
            [0.96, 0.66, 0.75], // 분홍
            [1.0, 0.94, 0.96],  // 연분홍
            [0.98, 0.80, 0.85],  // 중간
            [1.0, 1.0, 0.98],    // 거의 흰색
        ],
        sizeMin: 2.5, sizeMax: 4.5,
        fallSpeed: 0.8,
        driftStrength: 1.5,
        spawnRate: 0.25, // 초당 스폰 간격
    },
    autumn: {
        colors: [
            [0.94, 0.56, 0.31], // 주황
            [0.88, 0.38, 0.18], // 진주황
            [0.94, 0.75, 0.25], // 노랑
            [0.80, 0.30, 0.15], // 빨강
        ],
        sizeMin: 3.5, sizeMax: 6.0,
        fallSpeed: 1.2,
        driftStrength: 1.0,
        spawnRate: 0.3,
    },
};

// 스폰 영역 (월드 전체)
const SPAWN_X_MIN = -40, SPAWN_X_MAX = 40;
const SPAWN_Z_MIN = -65, SPAWN_Z_MAX = 5;
const SPAWN_Y_MIN = 6, SPAWN_Y_MAX = 14;
const GROUND_Y = -0.5; // 이 아래로 내려가면 재활용

function createSeasonalParticles(scene: THREE.Scene, count: number) {
    const buf = createBuf(count);
    const mat = makeParticleMat(false);
    const points = new THREE.Points(buf.geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);

    const petals: Petal[] = [];
    for (let i = 0; i < count; i++) {
        petals.push({
            x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0,
            rotPhase: Math.random() * Math.PI * 2,
            life: 999, maxLife: 1, // 시작 시 죽은 상태
            sizeBase: 3,
        });
    }

    let currentSeason: SeasonName = 'summer';
    let spawnTimer = 0;
    let fadeAlpha = 0; // 계절 전환 fade

    function spawnPetal(p: Petal, cfg: SeasonalConfig): void {
        p.x = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN);
        p.y = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
        p.z = SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN);
        p.vy = -(cfg.fallSpeed + Math.random() * cfg.fallSpeed * 0.5);
        p.vx = (Math.random() - 0.5) * cfg.driftStrength;
        p.vz = (Math.random() - 0.5) * cfg.driftStrength * 0.6;
        p.rotPhase = Math.random() * Math.PI * 2;
        p.life = 0;
        p.maxLife = 8 + Math.random() * 6;
        p.sizeBase = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
    }

    return {
        update(dt: number, t: number, season: SeasonName) {
            const cfg = SEASONAL_CONFIGS[season];
            const shouldShow = !!cfg;

            // Fade in/out
            const targetFade = shouldShow ? 1 : 0;
            fadeAlpha += (targetFade - fadeAlpha) * Math.min(1, 1.5 * dt);
            points.visible = fadeAlpha > 0.01;
            if (!points.visible) return;

            // 계절 바뀌면 기억
            if (season !== currentSeason) {
                currentSeason = season;
            }

            if (!cfg) {
                // 활성 계절이 아니면 기존 파티클만 서서히 fade
                for (let i = 0; i < count; i++) {
                    buf.alpha[i] *= 0.95;
                }
                markDirty(buf);
                return;
            }

            // Spawn
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnTimer = cfg.spawnRate;
                for (const p of petals) {
                    if (p.life >= p.maxLife) {
                        spawnPetal(p, cfg);
                        break;
                    }
                }
            }

            // 글로벌 바람
            const windX = Math.sin(t * 0.2) * 0.6 + Math.sin(t * 0.7) * 0.3;
            const windZ = Math.cos(t * 0.15) * 0.3;

            for (let i = 0; i < petals.length; i++) {
                const p = petals[i];
                p.life += dt;
                if (p.life >= p.maxLife || p.y < GROUND_Y) {
                    buf.alpha[i] = 0;
                    p.life = p.maxLife; // 재활용 대기
                    continue;
                }

                // 이동: 떨어지면서 좌우로 흔들림 (나뭇잎 tumble 느낌)
                const tumble = Math.sin(t * 2.5 + p.rotPhase) * 0.8;
                p.x += (p.vx + windX * 0.3 + tumble * 0.15) * dt;
                p.y += p.vy * dt;
                p.z += (p.vz + windZ * 0.2) * dt;

                const i3 = i * 3;
                buf.pos[i3] = p.x;
                buf.pos[i3 + 1] = p.y;
                buf.pos[i3 + 2] = p.z;

                // 크기: 약간의 펄스 (회전하는 느낌)
                const sizePulse = 1 + Math.sin(t * 3 + p.rotPhase) * 0.2;
                buf.size[i] = p.sizeBase * sizePulse;

                // 알파: fade in → sustain → fade out
                const progress = p.life / p.maxLife;
                const fadeIn = Math.min(1, p.life / 0.5);
                const fadeOut = Math.max(0, 1 - (progress - 0.7) / 0.3);
                buf.alpha[i] = fadeIn * fadeOut * 0.6 * fadeAlpha;

                // 색상: cfg에서 랜덤 선택 (spawn 시 결정, i로 일관성)
                const ci = cfg.colors[i % cfg.colors.length];
                buf.color[i3] = ci[0];
                buf.color[i3 + 1] = ci[1];
                buf.color[i3 + 2] = ci[2];
            }
            markDirty(buf);
        },
    };
}

// =============================================
// Factory
// =============================================

export interface ParticleEffects {
    update(dt: number, t: number, timeLabel: string, season: SeasonName): void;
}

export function createParticleEffects(scene: THREE.Scene, isMobile: boolean): ParticleEffects {
    const fireflyCount = isMobile ? 15 : 35;
    const smokeCount = isMobile ? 10 : 20;
    const seasonCount = isMobile ? 12 : 25;

    const fireflies = createFireflies(scene, fireflyCount);
    const smoke = createSmoke(scene, smokeCount);
    const seasonal = createSeasonalParticles(scene, seasonCount);

    return {
        update(dt, t, timeLabel, season) {
            fireflies.update(dt, t, timeLabel);
            smoke.update(dt, t);
            seasonal.update(dt, t, season);
        },
    };
}