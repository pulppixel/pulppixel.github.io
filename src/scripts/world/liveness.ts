// Living world elements: windmill (rotating blades), bird flock, fish jumps
// 정적 구조는 생성 시 한 번 빌드하고, update()에서 동적인 부분만 애니메이션.
// draw calls: ~6 (풍차 5 boxes + 블레이드 그룹 + 새 1 그룹 + 물고기 N)

import * as THREE from 'three';
import { stdBox, stdMat } from '../core/helpers';
import { perf } from '../core/performance';
import { getGroundHeight } from '../core/data';
import { addObstacle } from '../core/obstacles';

export interface LivenessSystem {
    update(dt: number, t: number): void;
}

// =============================================
// Windmill — Spawn 영역 환영용 랜드마크
// =============================================
//
// Spawn 평면(h=1.0)의 비어있는 서쪽에 배치. 첫 진입 시 정면에서 시야에 들어옴.
// 블레이드는 +z 방향(Hub 방향)을 바라보도록 회전.

const WIND_X = -5, WIND_Z = -3;

function buildWindmill(scene: THREE.Scene): THREE.Group {
    const STONE = 0x9a948a;
    const STONE_LT = 0xb0aa9e;
    const WOOD = 0x8a6540;
    const WOOD_DK = 0x6a4a2a;
    const ROOF = 0xc55a3a;
    const BLADE = 0xeae0c8;

    const groundH = getGroundHeight(WIND_X, WIND_Z);

    // --- Tower ---
    const base = stdBox(1.6, 0.5, 1.6, STONE_LT);
    base.position.set(WIND_X, groundH + 0.25, WIND_Z);
    base.castShadow = true; base.receiveShadow = true;
    scene.add(base);

    const mid = stdBox(1.3, 1.8, 1.3, STONE);
    mid.position.set(WIND_X, groundH + 0.5 + 0.9, WIND_Z);
    mid.castShadow = true; mid.receiveShadow = true;
    scene.add(mid);

    const top = stdBox(1.0, 1.4, 1.0, STONE_LT);
    top.position.set(WIND_X, groundH + 2.3 + 0.7, WIND_Z);
    top.castShadow = true;
    scene.add(top);

    // 작은 창문 (글로우)
    const winMat = new THREE.MeshStandardMaterial({
        color: 0xf5e8a0, emissive: 0xf5e8a0, emissiveIntensity: 0.4, roughness: 0.5,
    });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.04), winMat);
    win.position.set(WIND_X, groundH + 1.6, WIND_Z + 0.66);
    scene.add(win);

    // 지붕 (원뿔 대용 박스 2단)
    const roof1 = stdBox(1.15, 0.35, 1.15, ROOF);
    roof1.position.set(WIND_X, groundH + 3.7 + 0.18, WIND_Z);
    scene.add(roof1);
    const roof2 = stdBox(0.6, 0.35, 0.6, ROOF);
    roof2.position.set(WIND_X, groundH + 4.05 + 0.18, WIND_Z);
    scene.add(roof2);

    // 블레이드 허브 (앞으로 살짝 돌출)
    const hub = stdBox(0.35, 0.35, 0.55, WOOD_DK);
    hub.position.set(WIND_X, groundH + 3.2, WIND_Z + 0.7);
    scene.add(hub);

    // --- Blades (rotating group) ---
    const blades = new THREE.Group();
    blades.position.set(WIND_X, groundH + 3.2, WIND_Z + 1.0);

    // 블레이드 4개 — 십자 패턴
    const bladeGeo = new THREE.BoxGeometry(0.18, 2.4, 0.5);
    const bladeMat = stdMat(BLADE);
    for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(bladeGeo, bladeMat);
        // 블레이드를 위로 뻗게 하려면 baseY = +1.2 (geo 중심이 높이 절반에 있음)
        b.position.set(0, 1.2, 0);
        b.castShadow = true;
        // 각도별 회전
        const wrap = new THREE.Group();
        wrap.add(b);
        wrap.rotation.z = (i / 4) * Math.PI * 2;
        blades.add(wrap);
    }
    scene.add(blades);

    // Collider — base + mid + top 둘러싸는 정사각형
    addObstacle({ x: WIND_X, z: WIND_Z, hw: 0.85, hd: 0.85 });

    return blades;
}

// =============================================
// Bird Flock — 하늘을 가로지르는 새 떼
// =============================================
//
// 6마리 V-formation. 월드 중심을 기준으로 천천히 원궤도. y는 25 부근.
// 각 새는 wing flap (scale.x 펄스). 거리감 위해 frustumCulled false.

interface BirdRef {
    group: THREE.Group;
    offsetX: number;   // formation 내 상대 위치
    offsetZ: number;
    wingL: THREE.Mesh;
    wingR: THREE.Mesh;
    flapPhase: number;
}

function buildBirdFlock(scene: THREE.Scene, count: number): BirdRef[] {
    const COL = 0x3a3540;
    const COL_LT = 0x5a5258;

    const birds: BirdRef[] = [];
    const bodyGeo = new THREE.BoxGeometry(0.22, 0.14, 0.4);
    const wingGeo = new THREE.BoxGeometry(0.4, 0.05, 0.22);
    const bodyMat = stdMat(COL);
    const wingMat = stdMat(COL_LT);

    for (let i = 0; i < count; i++) {
        const g = new THREE.Group();

        const body = new THREE.Mesh(bodyGeo, bodyMat);
        g.add(body);

        const wingL = new THREE.Mesh(wingGeo, wingMat);
        wingL.position.set(-0.28, 0.02, 0);
        g.add(wingL);

        const wingR = new THREE.Mesh(wingGeo, wingMat);
        wingR.position.set(0.28, 0.02, 0);
        g.add(wingR);

        // V-formation: 리더 0번이 선두, 나머지는 좌우 뒤로
        const tier = Math.ceil(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        const offsetX = i === 0 ? 0 : side * tier * 1.3;
        const offsetZ = i === 0 ? 0 : tier * 1.1;

        scene.add(g);
        birds.push({
            group: g, offsetX, offsetZ, wingL, wingR,
            flapPhase: Math.random() * Math.PI * 2,
        });
    }

    return birds;
}

function updateBirds(birds: BirdRef[], t: number): void {
    // 리더는 월드 둘레를 천천히 (period ~50s) 도는 큰 원 궤도
    const angle = t * 0.125; // rad/s
    const radius = 42;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius - 25; // z 중심을 -25로 (월드 중심 부근)
    const cy = 26 + Math.sin(t * 0.4) * 1.2;

    // 리더 진행 방향 (탄젠트)
    const heading = Math.atan2(-Math.sin(angle), Math.cos(angle));

    for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        // 진행 방향 기준 회전된 offset
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const ox = b.offsetX * cos - b.offsetZ * sin;
        const oz = b.offsetX * sin + b.offsetZ * cos;

        b.group.position.set(cx + ox, cy + Math.sin(t * 0.6 + i) * 0.3, cz + oz);
        b.group.rotation.y = heading + Math.PI / 2;

        // Wing flap (scale + 약간의 회전)
        const flap = Math.sin(t * 8 + b.flapPhase);
        b.wingL.rotation.z = flap * 0.45;
        b.wingR.rotation.z = -flap * 0.45;
    }
}

// =============================================
// Fish jumps — 바다에서 가끔 튀어 오르는 물고기
// =============================================
//
// 풀에서 비활성 fish 하나를 골라 spawn. 포물선 궤적, 0.9~1.2s 수명.
// 모바일: 2마리 풀, 데스크톱: 4마리 풀. 한 번에 한 마리씩 spawn.

interface FishRef {
    group: THREE.Group;
    vx: number; vy: number; vz: number;
    life: number; maxLife: number;
    active: boolean;
}

const WATER_Y = -2.0;
const FISH_SPAWN_Y = -1.6;
const FISH_X_RANGE: [number, number] = [-40, 40];
// 섬에서 너무 가까이 spawn 안 되게 z 범위 축소 (주요 플랫폼 사이의 바다 영역)
const FISH_Z_RANGE: [number, number] = [-65, 0];

function buildFish(scene: THREE.Scene): FishRef {
    const COL = 0x6ea8c8;
    const COL_BELLY = 0xc8d8e0;
    const FIN = 0x4878a0;

    const g = new THREE.Group();

    const body = stdBox(0.25, 0.15, 0.45, COL);
    g.add(body);

    const belly = stdBox(0.2, 0.05, 0.4, COL_BELLY);
    belly.position.set(0, -0.07, 0);
    g.add(belly);

    // 꼬리
    const tail = stdBox(0.05, 0.18, 0.15, FIN);
    tail.position.set(0, 0.02, -0.3);
    g.add(tail);

    g.visible = false;
    scene.add(g);

    return { group: g, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, active: false };
}

function spawnFish(f: FishRef): void {
    const x = FISH_X_RANGE[0] + Math.random() * (FISH_X_RANGE[1] - FISH_X_RANGE[0]);
    const z = FISH_Z_RANGE[0] + Math.random() * (FISH_Z_RANGE[1] - FISH_Z_RANGE[0]);

    // 플랫폼 위 spawn 회피 (해당 좌표에 지면이 있으면 패스)
    if (getGroundHeight(x, z) > -0.3) return;

    f.group.position.set(x, FISH_SPAWN_Y, z);
    f.group.rotation.y = Math.random() * Math.PI * 2;
    // 위로 튀어 오르는 속도 (포물선 — vy가 점점 줄어들면서 다시 떨어짐)
    f.vy = 4.5 + Math.random() * 1.5;
    f.vx = (Math.random() - 0.5) * 0.6;
    f.vz = (Math.random() - 0.5) * 0.6;
    f.life = 0;
    f.maxLife = 1.0 + Math.random() * 0.4;
    f.active = true;
    f.group.visible = true;
}

function updateFish(fish: FishRef[], dt: number): void {
    const GRAV = -12;
    for (const f of fish) {
        if (!f.active) continue;

        f.life += dt;
        f.vy += GRAV * dt;
        f.group.position.x += f.vx * dt;
        f.group.position.y += f.vy * dt;
        f.group.position.z += f.vz * dt;

        // 점프 중 회전 (전진 방향으로 핏치)
        f.group.rotation.x = Math.atan2(-f.vy, 3) * 0.8;
        f.group.rotation.z += dt * 1.5;

        if (f.group.position.y < WATER_Y - 0.3 || f.life > f.maxLife) {
            f.active = false;
            f.group.visible = false;
        }
    }
}

// =============================================
// Factory
// =============================================

export function createLiveness(scene: THREE.Scene): LivenessSystem {
    const blades = buildWindmill(scene);
    const birds = buildBirdFlock(scene, perf.tier === 'low' ? 4 : 6);

    const fishCount = perf.tier === 'low' ? 2 : 4;
    const fish: FishRef[] = [];
    for (let i = 0; i < fishCount; i++) fish.push(buildFish(scene));

    let fishSpawnTimer = 2.5;

    return {
        update(dt: number, t: number) {
            // Windmill blades — 일정 속도 회전 (z축이 frontal-axis)
            blades.rotation.z = t * 0.45;

            updateBirds(birds, t);

            fishSpawnTimer -= dt;
            if (fishSpawnTimer <= 0) {
                fishSpawnTimer = 3.5 + Math.random() * 4;
                for (const f of fish) {
                    if (!f.active) {
                        spawnFish(f);
                        break;
                    }
                }
            }
            updateFish(fish, dt);
        },
    };
}
