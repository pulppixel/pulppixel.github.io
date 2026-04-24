// Overworld (19-22) — 초원 마을, 커리어 시작
//
// Major landmarks:
//  - Oak Cottage: 5x5 base, 3 wall + 3 roof layers (6 y-layers), scale 0.7
//    → world size ~3.5 x 3.5 x 4.2 unit (캐릭터 키 2-3배)
//  - Well: 3x3 base, 6 y-layers, scale 0.6
//    → world size ~1.8 x 1.8 x 3.6 unit
//
// 배치 이유: 프로젝트 큐브는 zone 중심(-2~+2, -18~-16.5)에 모여 있어서
//   오두막은 뒤쪽 구석 (-5, -22), 우물은 앞쪽 (4, -13)에.
//   spawn→Overworld 진입 시 정면으로 우물이 먼저 보이고, 더 깊이 들어가면 오두막.

import * as THREE from 'three';
import { buildVoxel, getVoxelBounds, type VoxelColorMap } from '../../core/helpers';
import { ZONE_PALETTE } from '../../core/palette';
import { getGroundHeight } from '../../core/data';
import { addObstacle } from '../../core/obstacles';

const P = ZONE_PALETTE.overworld;

// --- Local utility palette (stone/water는 palette.ts에 없어서 로컬 상수) ---
//     향후 다른 존에서도 필요해지면 palette.ts의 COMMON 섹션으로 승격
const STONE        = 0x9a948a;
const STONE_LIGHT  = 0xb0aa9e;
const WATER        = 0x3a88cc;

// =============================================================================
// Oak Cottage
// =============================================================================
//
// 문이 향하는 방향 = +z 바깥쪽 (인덱스 0)
// 벽 3단: y=0 바닥(문), y=1 중간(창문), y=2 상단(구조)
// 지붕 3단: y=3 처마, y=4 박공, y=5 마루
//
// 문자 의미:
//   W = wood (통나무)
//   D = door (짙은 나무)
//   Y = window (emissive 창문)
//   R = roof (빨강)

const COTTAGE_PATTERN: string[][] = [
    // y=0: 벽 + 문 (앞면 가운데 2칸)
    [
        'WWDDW',
        'W...W',
        'W...W',
        'W...W',
        'WWWWW',
    ],
    // y=1: 벽 + 창문 4면
    [
        'WYWYW',   // 앞면 창문 2개
        'Y...Y',   // 좌우 측면 창문 (z=1)
        'W...W',
        'Y...Y',   // 좌우 측면 창문 (z=3)
        'WYWYW',   // 뒷면 창문 2개
    ],
    // y=2: 상단 벽 (구조용)
    [
        'WWWWW',
        'W...W',
        'W...W',
        'W...W',
        'WWWWW',
    ],
    // y=3: 지붕 처마 (5x5 전체 덮음)
    [
        'RRRRR',
        'RRRRR',
        'RRRRR',
        'RRRRR',
        'RRRRR',
    ],
    // y=4: 지붕 박공 (x 방향 3칸으로 후퇴, z는 유지)
    [
        '.RRR.',
        '.RRR.',
        '.RRR.',
        '.RRR.',
        '.RRR.',
    ],
    // y=5: 지붕 마루 (x 방향 1칸, z 따라 길게)
    [
        '..R..',
        '..R..',
        '..R..',
        '..R..',
        '..R..',
    ],
];

const COTTAGE_COLORS: VoxelColorMap = {
    'W': P.landmarkPrimary,      // 통나무 연갈
    'D': P.landmarkTrim,          // 문 짙은 나무
    'R': P.landmarkSecondary,     // 지붕 빨강
    'Y': {
        color: P.landmarkGlow,       // 창문 노랑
        emissive: P.landmarkGlow,
        emissiveIntensity: 0.6,
        roughness: 0.4,
    },
};

function addCottage(scene: THREE.Scene, x: number, z: number, rotY = 0): void {
    const scale = 0.7;
    const cottage = buildVoxel(COTTAGE_PATTERN, COTTAGE_COLORS, { scale });
    const groundH = getGroundHeight(x, z);
    cottage.position.set(x, groundH, z);
    cottage.rotation.y = rotY;
    scene.add(cottage);

    // Collider: rotY=0 기준 그대로. 90도 회전 시 hw/hd swap 필요 (현재 0만 사용).
    const b = getVoxelBounds(COTTAGE_PATTERN, scale);
    const rotated = Math.abs(Math.sin(rotY)) > 0.5;
    addObstacle({
        x, z,
        hw: rotated ? b.hd : b.hw,
        hd: rotated ? b.hw : b.hd,
    });
}

// =============================================================================
// Well
// =============================================================================
//
// 3x3 base, 양 옆 기둥 2개, 박공 지붕.
//
//   S = stone (돌)
//   L = stone light (돌 하이라이트)
//   I = water (안쪽 물, emissive 살짝)
//   P = post (나무 기둥)
//   R = roof (빨강, 오두막과 연관)

const WELL_PATTERN: string[][] = [
    // y=0: 돌 베이스 + 물
    [
        'SSS',
        'SIS',
        'SSS',
    ],
    // y=1: 돌 링 (속 비움, 라이트 점박이)
    [
        'SLS',
        'L.L',
        'SLS',
    ],
    // y=2: 나무 기둥 2개 (좌우 코너)
    [
        'P.P',
        '...',
        'P.P',
    ],
    // y=3: 기둥 계속
    [
        'P.P',
        '...',
        'P.P',
    ],
    // y=4: 지붕 베이스 (3x3 덮음)
    [
        'RRR',
        'RRR',
        'RRR',
    ],
    // y=5: 지붕 마루 (중앙 1줄)
    [
        '.R.',
        '.R.',
        '.R.',
    ],
];

const WELL_COLORS: VoxelColorMap = {
    'S': STONE,
    'L': STONE_LIGHT,
    'I': {
        color: WATER,
        emissive: WATER,
        emissiveIntensity: 0.15,
        roughness: 0.3,
    },
    'P': P.trunk,
    'R': P.landmarkSecondary,
};

function addWell(scene: THREE.Scene, x: number, z: number, rotY = 0): void {
    const scale = 0.6;
    const well = buildVoxel(WELL_PATTERN, WELL_COLORS, { scale });
    const groundH = getGroundHeight(x, z);
    well.position.set(x, groundH, z);
    well.rotation.y = rotY;
    scene.add(well);

    const b = getVoxelBounds(WELL_PATTERN, scale);
    const rotated = Math.abs(Math.sin(rotY)) > 0.5;
    addObstacle({
        x, z,
        hw: rotated ? b.hd : b.hw,
        hd: rotated ? b.hw : b.hd,
    });
}

// =============================================================================
// Zone assembly
// =============================================================================
//
// Overworld 플랫폼: x=[-9, 9], z=[-25, -11]
// 프로젝트 큐브 영역: x=[-2, 2], z=[-18, -16.5] (중앙 피함)
//
// 오두막 (-5, -22): 플랫폼 뒤쪽, 문이 +z (진입 방향) 보게 회전 없음
// 우물 (4, -13):    플랫폼 앞쪽 오른편, spawn 진입 시 정면 시야

export function buildOverworldLandmarks(scene: THREE.Scene): void {
    addCottage(scene, -5, -22, 0);
    addWell(scene, 4, -13, 0);
}