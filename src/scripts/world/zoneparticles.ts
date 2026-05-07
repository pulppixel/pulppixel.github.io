// Per-zone ambient particles: wisp, firefly, orbit, petal
// Proximity-based activation — 가까이 가면 파티클이 나타남
import * as THREE from 'three';
import { ZONE_CENTERS } from '../core/data';
import { ZONE_PALETTE } from '../core/palette';
import { perf } from '../core/performance';

export interface ZoneParticles {
    update(dt: number, t: number, playerPos: THREE.Vector3): void;
}

interface ZoneCloud {
    cx: number; cz: number; h: number;
    color: number;
    points: THREE.Points;
    pos: Float32Array;
    vel: Float32Array;
    count: number;
    type: 'wisp' | 'firefly' | 'orbit' | 'petal';
    range: number;
    // orbit type: center offset for spire position
    orbitCx: number; orbitCz: number;
}

export function createZoneParticles(scene: THREE.Scene): ZoneParticles {
    // Type-zone 매핑은 테마에 묶임:
    //   petal  → Overworld (sacred garden 벚꽃잎)
    //   firefly→ Treasure  (동전 반짝임)
    //   orbit  → Nether    (크리스탈 첨탑 공전, orbitOff로 첨탑 위치 보정)
    //   wisp   → Beacon    (천상의 빛 상승)
    // 색은 palette의 zone 토큰에서 가져옴 → palette 바꾸면 자동 전파.
    const DEFS = [
        { ...ZONE_CENTERS.overworld, color: ZONE_PALETTE.overworld.foliageAlt,    type: 'petal'   as const, count: Math.round(40 * perf.particleMul), size: 0.1,   orbitOff: [0, 0]  as const },
        { ...ZONE_CENTERS.treasure,  color: ZONE_PALETTE.treasure.signature,      type: 'firefly' as const, count: Math.round(30 * perf.particleMul), size: 0.06,  orbitOff: [0, 0]  as const },
        { ...ZONE_CENTERS.nether,    color: ZONE_PALETTE.nether.landmarkGlow,     type: 'orbit'   as const, count: Math.round(35 * perf.particleMul), size: 0.065, orbitOff: [5, -4] as const },
        { ...ZONE_CENTERS.beacon,    color: ZONE_PALETTE.beacon.signature,        type: 'wisp'    as const, count: Math.round(35 * perf.particleMul), size: 0.07,  orbitOff: [0, 0]  as const },
    ];

    const clouds: ZoneCloud[] = [];

    for (const d of DEFS) {
        const n = d.count;
        const pos = new Float32Array(n * 3);
        const vel = new Float32Array(n * 3);

        for (let i = 0; i < n; i++) {
            const i3 = i * 3;
            pos[i3] = d.x + (Math.random() - 0.5) * 14;
            pos[i3 + 1] = d.h + 0.5 + Math.random() * 5;
            pos[i3 + 2] = d.z + (Math.random() - 0.5) * 10;

            switch (d.type) {
                case 'wisp':
                    vel[i3] = (Math.random() - 0.5) * 0.3;
                    vel[i3 + 1] = 0.2 + Math.random() * 0.3;
                    vel[i3 + 2] = (Math.random() - 0.5) * 0.3;
                    break;
                case 'firefly':
                    vel[i3] = (Math.random() - 0.5) * 0.8;
                    vel[i3 + 1] = (Math.random() - 0.5) * 0.5;
                    vel[i3 + 2] = (Math.random() - 0.5) * 0.8;
                    break;
                case 'orbit':
                    vel[i3 + 1] = 0.1 + Math.random() * 0.25;
                    break;
                case 'petal':
                    vel[i3] = (Math.random() - 0.5) * 0.5;
                    vel[i3 + 1] = -(0.3 + Math.random() * 0.4);
                    vel[i3 + 2] = (Math.random() - 0.5) * 0.4;
                    break;
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        const mat = new THREE.PointsMaterial({
            color: d.color,
            size: d.size,
            transparent: true,
            opacity: 0,
            sizeAttenuation: true,
            depthWrite: false,
        });

        const points = new THREE.Points(geo, mat);
        points.frustumCulled = false;
        scene.add(points);

        clouds.push({
            cx: d.x, cz: d.z, h: d.h,
            color: d.color,
            points, pos, vel, count: n,
            type: d.type,
            range: 14,
            orbitCx: d.x + d.orbitOff[0],
            orbitCz: d.z + d.orbitOff[1],
        });
    }

    return {
        update(dt, t, playerPos) {
            for (const c of clouds) {
                const dx = playerPos.x - c.cx;
                const dz = playerPos.z - c.cz;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Proximity fade
                const tgtOp = dist < c.range
                    ? Math.min(0.55, (c.range - dist) / (c.range * 0.35))
                    : 0;
                const mat = c.points.material as THREE.PointsMaterial;
                mat.opacity += (tgtOp - mat.opacity) * 3 * dt;

                if (mat.opacity < 0.01) continue;

                const p = c.pos, v = c.vel;

                for (let i = 0; i < c.count; i++) {
                    const i3 = i * 3;

                    switch (c.type) {
                        case 'wisp': {
                            p[i3] += (v[i3] + Math.sin(t * 0.5 + i * 1.3) * 0.15) * dt;
                            p[i3 + 1] += v[i3 + 1] * dt;
                            p[i3 + 2] += (v[i3 + 2] + Math.cos(t * 0.4 + i * 0.9) * 0.12) * dt;
                            if (p[i3 + 1] > c.h + 6.5) {
                                p[i3] = c.cx + (Math.random() - 0.5) * 14;
                                p[i3 + 1] = c.h + 0.3;
                                p[i3 + 2] = c.cz + (Math.random() - 0.5) * 10;
                            }
                            break;
                        }
                        case 'firefly': {
                            v[i3] += (Math.random() - 0.5) * 2.5 * dt;
                            v[i3 + 1] += (Math.random() - 0.5) * 1.8 * dt;
                            v[i3 + 2] += (Math.random() - 0.5) * 2.5 * dt;
                            v[i3] *= 0.97; v[i3 + 1] *= 0.97; v[i3 + 2] *= 0.97;
                            p[i3] += v[i3] * dt;
                            p[i3 + 1] += v[i3 + 1] * dt;
                            p[i3 + 2] += v[i3 + 2] * dt;
                            if (Math.abs(p[i3] - c.cx) > 8) v[i3] *= -1;
                            if (p[i3 + 1] < c.h + 0.3 || p[i3 + 1] > c.h + 5) v[i3 + 1] *= -1;
                            if (Math.abs(p[i3 + 2] - c.cz) > 6) v[i3 + 2] *= -1;
                            break;
                        }
                        case 'orbit': {
                            const angle = t * 0.35 + i * (Math.PI * 2 / c.count);
                            const radius = 1.8 + Math.sin(t * 0.2 + i * 0.7) * 1.2;
                            p[i3] = c.orbitCx + Math.cos(angle) * radius;
                            p[i3 + 2] = c.orbitCz + Math.sin(angle) * radius;
                            p[i3 + 1] += v[i3 + 1] * dt;
                            if (p[i3 + 1] > c.h + 8.5) p[i3 + 1] = c.h + 1;
                            break;
                        }
                        case 'petal': {
                            p[i3] += (v[i3] + Math.sin(t * 0.8 + i * 2.1) * 0.4) * dt;
                            p[i3 + 1] += v[i3 + 1] * dt;
                            p[i3 + 2] += (v[i3 + 2] + Math.cos(t * 0.6 + i * 1.7) * 0.3) * dt;
                            if (p[i3 + 1] < c.h + 0.2) {
                                p[i3] = c.cx + (Math.random() - 0.5) * 13;
                                p[i3 + 1] = c.h + 5.5 + Math.random() * 3;
                                p[i3 + 2] = c.cz + (Math.random() - 0.5) * 10;
                            }
                            break;
                        }
                    }
                }

                c.points.geometry.attributes.position.needsUpdate = true;
            }
        },
    };
}