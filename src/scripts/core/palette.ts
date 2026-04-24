// Zone block palette system
//
// 각 존의 색을 한 곳에서 관리. terrain/foliage/landmark/atmosphere 4축으로 분리.
// 새 prop 만들 때: ZONE_PALETTE.nether.landmarkPrimary 같이 참조.
// 새 존 추가하려면: ZONE_PALETTE에 키 하나 추가.

export interface ZonePalette {
    // --- Terrain (플랫폼 상단/측면/잡블록) ---
    terrainTop: number;      // 상단 주 색 (잔디/모래/네더랙/엔드스톤)
    terrainSide: number;     // 측면 (흙/베이지석/블랙스톤/흑요석)
    terrainAccent: number;   // 상단 dot/세공 블록
    terrainDark: number;     // 그늘/바위 균열

    // --- Vegetation / 자연 filler ---
    foliage: number;         // 주 잎사귀 / 덤불
    foliageAlt: number;      // 보조 (꽃, 강조)
    trunk: number;           // 나무 줄기

    // --- Landmark (랜드마크 전용) ---
    landmarkPrimary: number;   // 주 구조체 색
    landmarkSecondary: number; // 포인트 악센트
    landmarkTrim: number;      // 테두리/디테일
    landmarkGlow: number;      // emissive 요소 (포털, 비콘, 보물)

    // --- Atmosphere ---
    ambientTint: number;     // 존 진입 시 하늘/안개 미세 틴트 (Phase 5)
    particleColor: number;   // 존 파티클 기본색

    // --- Signature (UI/pillar/ring에 전파되는 브랜드 컬러) ---
    signature: number;       // COMPANIES[].color 와 매칭되어야 함
}

// ===========================================================================
// 4 zones + spawn/bridge (neutral)
// ===========================================================================

export const ZONE_PALETTE = {

    // --- Spawn/Hub (중립, 기준) ---
    spawn: {
        terrainTop:        0x8fc862,   // 생생한 잔디
        terrainSide:       0x8b6b47,   // 흙
        terrainAccent:     0x72b048,   // 진한 잔디 도트
        terrainDark:       0x5c4a30,

        foliage:           0x4fa848,
        foliageAlt:        0xffd3e0,   // 핑크 꽃
        trunk:             0x6b4a2a,

        landmarkPrimary:   0xc8a878,   // 오두막 나무
        landmarkSecondary: 0xe85858,   // 오두막 지붕 빨강
        landmarkTrim:      0x4a3318,
        landmarkGlow:      0xfff0a0,   // 창문 따뜻한 불빛

        ambientTint:       0xfff0d8,
        particleColor:     0xfff5c8,

        signature:         0x8fc862,
    } as ZonePalette,

    // --- Overworld (19-22): 초원 마을, 커리어 시작 ---
    overworld: {
        terrainTop:        0x7fb852,   // 잔디 초록
        terrainSide:       0x8b6b47,   // 흙
        terrainAccent:     0x6ba642,
        terrainDark:       0x5c4a30,

        foliage:           0x4a9848,
        foliageAlt:        0xffd3e0,
        trunk:             0x6b4a2a,

        landmarkPrimary:   0xc8a878,   // 오두막 통나무
        landmarkSecondary: 0xd84848,   // 지붕 빨강
        landmarkTrim:      0x4a3318,   // 지붕 프레임 짙은 갈색
        landmarkGlow:      0xffd878,   // 창문/랜턴 노랑

        ambientTint:       0xfff0d8,
        particleColor:     0xfff5c8,

        signature:         0x7fb852,   // 존 시그니처 = 잔디 초록
    } as ZonePalette,

    // --- Treasure Isle (23): 해변 섬, 보물 ---
    treasure: {
        terrainTop:        0xf5deb3,   // 모래
        terrainSide:       0xc8b999,   // 베이지석
        terrainAccent:     0xeac894,
        terrainDark:       0x998573,

        foliage:           0x3aa878,   // 야자수 잎 초록 (채도 높음)
        foliageAlt:        0xfff5c8,   // 조개 크림
        trunk:             0x8b6b47,

        landmarkPrimary:   0x8b4a2a,   // 보물상자 나무
        landmarkSecondary: 0xf5b838,   // 금색 띠/자물쇠
        landmarkTrim:      0x4a2818,
        landmarkGlow:      0xfbbf24,   // 보물 금빛 빔

        ambientTint:       0xfff8e0,
        particleColor:     0xfbbf24,   // 금가루

        signature:         0xfbbf24,   // 보물 금색
    } as ZonePalette,

    // --- The Nether (25-26): 용암, 포털 ---
    nether: {
        terrainTop:        0x9f2d2d,   // 네더랙 빨강
        terrainSide:       0x2a1818,   // 블랙스톤
        terrainAccent:     0xc83838,
        terrainDark:       0x1a0808,

        foliage:           0x6a3060,   // 네더 버섯 자주
        foliageAlt:        0xf5a038,   // 글로스톤 노랑
        trunk:             0x4a1818,   // 네더 나무 검붉은

        landmarkPrimary:   0x1a0a24,   // 흑요석 (포털 프레임)
        landmarkSecondary: 0xff5a3a,   // 용암 오렌지
        landmarkTrim:      0x0a0410,
        landmarkGlow:      0xa855f7,   // 포털 보라

        ambientTint:       0xff8060,   // 붉은 안개 기
        particleColor:     0xff7030,   // 붉은 재

        signature:         0xff5a3a,   // 용암 오렌지
    } as ZonePalette,

    // --- Beacon Peak (26): 정상, 엔드 분위기 ---
    beacon: {
        terrainTop:        0xe8e5c0,   // 엔드스톤 크림 (채도 낮음)
        terrainSide:       0x1a0f2e,   // 흑요석 짙은 보라
        terrainAccent:     0xd8d4a8,
        terrainDark:       0x0a0618,

        foliage:           0xc8b0e8,   // 엔드 잎 (연보라)
        foliageAlt:        0x8ef7d6,   // 청록 포인트
        trunk:             0x2a1f3e,

        landmarkPrimary:   0x1a0f2e,   // 흑요석
        landmarkSecondary: 0xf5e8a0,   // 엔드 로드 노랑
        landmarkTrim:      0x0a0618,
        landmarkGlow:      0x8ef7d6,   // 비콘 청록 빔

        ambientTint:       0xb0f0e8,   // 청록 기
        particleColor:     0xc0a8f0,   // 엔더 보라

        signature:         0x8ef7d6,   // 비콘 청록
    } as ZonePalette,

    // --- Bridge (존 사이 경로, 혼합 톤) ---
    bridge: {
        terrainTop:        0x8a9868,
        terrainSide:       0x8b6b47,
        terrainAccent:     0x7a8858,
        terrainDark:       0x5c4a30,

        foliage:           0x68a868,
        foliageAlt:        0xfff5c8,
        trunk:             0x6b4a2a,

        landmarkPrimary:   0xc8a878,
        landmarkSecondary: 0xa89868,
        landmarkTrim:      0x4a3318,
        landmarkGlow:      0xffd878,

        ambientTint:       0xfff0d8,
        particleColor:     0xfff5c8,

        signature:         0x8a9868,
    } as ZonePalette,

} as const;

export type ZoneKey = keyof typeof ZONE_PALETTE;

// --- Lookup by (x, z) ---
//
// 기존 terrain.ts의 getZonePalette(sx, sz) 대체 가능. 단 기존 PALETTES 참조
// 코드가 있을 수 있으므로 마이그레이션 때 한 번에 정리 (Phase 1).

const ZONE_BOUNDS: { key: ZoneKey; cx: number; cz: number; r: number }[] = [
    { key: 'overworld', cx: 0,   cz: -18, r: 14 },
    { key: 'treasure',  cx: 28,  cz: -40, r: 14 },
    { key: 'nether',    cx: -28, cz: -40, r: 14 },
    { key: 'beacon',    cx: 0,   cz: -58, r: 14 },
];

/** Nearest zone palette at world (x,z). Spawn < 10 from origin, else bridge fallback. */
export function paletteAt(x: number, z: number): ZonePalette {
    if (Math.hypot(x, z) < 10) return ZONE_PALETTE.spawn;
    for (const b of ZONE_BOUNDS) {
        if (Math.hypot(x - b.cx, z - b.cz) < b.r) return ZONE_PALETTE[b.key];
    }
    return ZONE_PALETTE.bridge;
}

export function paletteOf(key: ZoneKey): ZonePalette {
    return ZONE_PALETTE[key];
}