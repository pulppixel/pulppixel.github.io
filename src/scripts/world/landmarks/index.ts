// Zone landmarks entry point
//
// Phase 1-4에서 각 존의 큰 랜드마크(오두막, 포털, 비콘 빔 등)를 여기서 조립.
// scene.ts에서 buildAllLandmarks(scene)을 한 번 호출하면 전부 씬에 추가됨.

import type * as THREE from 'three';
import { buildOverworldLandmarks } from './overworld';
import { buildTreasureLandmarks } from './treasure';
import { buildNetherLandmarks } from './nether';
import { buildBeaconLandmarks } from './beacon';

export function buildAllLandmarks(scene: THREE.Scene): void {
    buildOverworldLandmarks(scene);
    buildTreasureLandmarks(scene);
    buildNetherLandmarks(scene);
    buildBeaconLandmarks(scene);
}

export {
    buildOverworldLandmarks,
    buildTreasureLandmarks,
    buildNetherLandmarks,
    buildBeaconLandmarks,
};