// Shared mesh/material utilities
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { perf } from './performance';

// --- Position ---

export function setPos<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// --- Materials (cached) ---

const _matCache = new Map<string, THREE.MeshStandardMaterial>();

export function stdMat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness });
    _matCache.set(key, m);
  }
  return m;
}

// --- Mesh Factories ---

export function stdBox(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function glowBox(w: number, h: number, d: number, color: number, ei = 0.3): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: ei,
        metalness: 0.2, roughness: 0.5,
        transparent: true, opacity: 0.9,
      }),
  );
}

export function facePlane(w: number, h: number, color: number, opacity = 1): THREE.Mesh {
  return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide,
        transparent: opacity < 1, opacity,
      }),
  );
}

// --- Wireframe ---

export function addEdges(mesh: THREE.Mesh, color: number, opacity = 0.2): void {
  mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  ));
}

export function wireOnly(geo: THREE.BufferGeometry, color: number, opacity = 0.3): THREE.LineSegments {
  return new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

// --- Text ---

export function textSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 64;

  ctx.font = '600 22px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, 256, 32);

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.fillText(text, 257, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set(5.5, 0.7, 1);
  return sprite;
}

// ===========================================================================
// Voxel Pattern Builder
// ===========================================================================
//
// 2D/3D 문자 패턴을 voxel (큐브 블록) 구조로 변환.
// 같은 색 voxel은 mergeGeometries로 병합되어 draw call 1개로 처리됨.
//
// ------ 패턴 형식 ------
//
// pattern: string[][]  - [y][z] 배열, 각 원소는 x 방향 문자열
//
//   y축 = 높이 (배열 인덱스 0 = 바닥, 위로 쌓임)
//   z축 = 깊이 (레이어 내 행)
//   x축 = 너비 (행 내 문자 위치)
//
// 예시: 2x2x2 작은 빨간 큐브
//   [
//     ["RR", "RR"],   // y=0 (바닥 레이어)
//     ["RR", "RR"],   // y=1 (위 레이어)
//   ]
//
// 빈 공간은 '.' 또는 ' '. colorMap에 없는 문자도 무시됨.
//
// ------ colorMap ------
//
// 단순: { 'R': 0xff0000 }  -> 불투명 standard
// 발광: { 'G': { color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.8 } }
// 반투명: { 'P': { color: 0xa855f7, transparent: true, opacity: 0.7 } }
//
// ------ 반환 ------
//
// THREE.Group. 자식 = 색별 병합된 Mesh 하나씩.
// 그룹 전체를 position/rotation/scale하면 애니메이션 가능 (큐브 개별은 아님).
// 기본적으로 XZ 중앙 정렬, Y는 0부터 위로 쌓임 (바닥면이 y=0에 붙음).

export interface VoxelColorDef {
  color: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
}

export type VoxelColorMap = Record<string, number | VoxelColorDef>;

export interface VoxelOpts {
  /** 블록 한 변 크기 (world unit). 기본 0.5. */
  scale?: number;
  /** XZ 중앙 정렬. 기본 true. false면 (0,0,0)부터 +x/+z로 쌓임. */
  center?: boolean;
  /** 그림자. 기본값은 perf.shadows 연동 (저사양 기기 자동 off). */
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// --- Emissive material cache (포털/비콘/크리스털 등 반복 발광 요소) ---
const _emissiveMatCache = new Map<string, THREE.MeshStandardMaterial>();

function getVoxelMat(def: number | VoxelColorDef): THREE.Material {
  if (typeof def === 'number') return stdMat(def);
  const em = def.emissive ?? 0;
  const ei = def.emissiveIntensity ?? 0;
  const tr = def.transparent ? 1 : 0;
  const op = def.opacity ?? 1;
  const ro = def.roughness ?? 0.85;
  const key = `${def.color}|${em}|${ei}|${tr}|${op}|${ro}`;
  let m = _emissiveMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: em,
      emissiveIntensity: ei,
      transparent: def.transparent ?? false,
      opacity: op,
      roughness: ro,
      metalness: 0.05,
    });
    _emissiveMatCache.set(key, m);
  }
  return m;
}

export function buildVoxel(
    pattern: string[][],
    colorMap: VoxelColorMap,
    opts: VoxelOpts = {},
): THREE.Group {
  const scale = opts.scale ?? 0.5;
  const center = opts.center ?? true;
  // 모바일 저사양 자동 연동
  const castShadow = opts.castShadow ?? perf.shadows;
  const receiveShadow = opts.receiveShadow ?? perf.shadows;

  // --- Pass 1: 크기 파악 & 색별 좌표 수집 ---

  let xMax = 0, zMax = 0;
  const yMax = pattern.length;
  for (const layer of pattern) {
    zMax = Math.max(zMax, layer.length);
    for (const row of layer) xMax = Math.max(xMax, row.length);
  }

  const byColor = new Map<string, { x: number; y: number; z: number }[]>();

  for (let y = 0; y < yMax; y++) {
    const layer = pattern[y];
    for (let z = 0; z < layer.length; z++) {
      const row = layer[z];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        if (colorMap[ch] === undefined) continue;
        if (!byColor.has(ch)) byColor.set(ch, []);
        byColor.get(ch)!.push({ x, y, z });
      }
    }
  }

  // --- Pass 2: 색별 merged geometry 생성 ---

  const ox = center ? -(xMax - 1) / 2 : 0;
  const oz = center ? -(zMax - 1) / 2 : 0;
  const unitGeo = new THREE.BoxGeometry(scale, scale, scale);

  const group = new THREE.Group();

  byColor.forEach((positions, ch) => {
    const geoms: THREE.BufferGeometry[] = [];
    for (const p of positions) {
      const g = unitGeo.clone();
      g.translate(
          (p.x + ox) * scale,
          p.y * scale + scale / 2,   // 바닥면 y=0에 붙도록
          (p.z + oz) * scale,
      );
      geoms.push(g);
    }
    const merged = mergeGeometries(geoms);
    geoms.forEach((g) => g.dispose());

    const def = colorMap[ch];
    const material = getVoxelMat(def);

    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  });

  unitGeo.dispose();
  return group;
}

/**
 * buildVoxel이 생성할 group의 XZ bound와 높이를 계산.
 * 랜드마크 생성 후 obstacle(collider) 등록 시 크기 계산용.
 *
 * center: true (buildVoxel 기본값) 기준이라, 반환값 hw/hd는 중심 기준 half-extent.
 * 즉 그대로 addObstacle({ x, z, hw, hd })에 사용 가능.
 */
export function getVoxelBounds(pattern: string[][], scale: number): {
  hw: number;
  hd: number;
  height: number;
} {
  let xMax = 0, zMax = 0;
  const yMax = pattern.length;
  for (const layer of pattern) {
    zMax = Math.max(zMax, layer.length);
    for (const row of layer) xMax = Math.max(xMax, row.length);
  }
  return {
    hw: (xMax * scale) / 2,
    hd: (zMax * scale) / 2,
    height: yMax * scale,
  };
}