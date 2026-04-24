// World-space AABB obstacles (horizontal XZ only)
//
// 용도: 랜드마크, 펜스 등 캐릭터가 "뚫고 지나가면 안 되는" 구조물.
// Y축 판정은 기존 getGroundHeight() 흐름에 위임 (지붕 위 걷기 등은 지면 없음 → 자동 낙하).
//
// 랜드마크 생성 시 addObstacle()로 등록.
// main.ts 이동 로직이 isBlocked(nx, nz) 체크해 이동 거부.

export interface Obstacle {
    /** center in world coords */
    x: number; z: number;
    /** half extents */
    hw: number; hd: number;
}

const _obstacles: Obstacle[] = [];

/** 캐릭터 반경 — obstacle 바깥으로 이 거리만큼 여유를 둬서 벽에 박히지 않게 함.
 *  character.ts의 실제 반경과 일치시키는 게 이상적이지만, 0.3이 일반적인 복셀 캐릭터 기준. */
const CHAR_RADIUS = 0.3;

export function addObstacle(o: Obstacle): void {
    _obstacles.push(o);
}

export function clearObstacles(): void {
    _obstacles.length = 0;
}

/** True if character center at (x, z) would intersect any obstacle. */
export function isBlocked(x: number, z: number): boolean {
    for (const o of _obstacles) {
        if (x > o.x - o.hw - CHAR_RADIUS && x < o.x + o.hw + CHAR_RADIUS &&
            z > o.z - o.hd - CHAR_RADIUS && z < o.z + o.hd + CHAR_RADIUS) {
            return true;
        }
    }
    return false;
}

/** Debug / inspection only. */
export function getObstacles(): readonly Obstacle[] {
    return _obstacles;
}