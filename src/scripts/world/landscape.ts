// 롤링 지형 본체 + 먼 산맥 실루엣 (Veloren풍 깊이감)
//
// 기존 월드는 바다 위 "떠 있는 흙기둥" 플랫폼들이었다. 이 모듈은:
//   1) buildLowland   — 섬들 사이 빈 공간을 메우는 완만한 로우폴리 구릉 지면
//   2) buildDistantRange — fog 너머 먼 산맥 실루엣 (깊이감)
// 둘 다 순수 시각 요소(충돌 없음). 워크어블 플랫폼 상단(p.h)은 건드리지 않으며,
// lowland 높이는 플랫폼 안에서 항상 상단보다 낮게 클램프되어 위로 솟지 않는다.
//
// 성능: lowland/산맥 모두 단일(또는 병합) 메시 → draw call 최소. 세그먼트 수는 perf.tier 연동.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { perf } from '../core/performance';
import { getGroundHeight } from '../core/data';

// 월드 중심 (대부분 시스템이 z=-29 기준). lowland/산맥 배치 기준점.
const WORLD_CX = 0;
const WORLD_CZ = -29;

// =============================================
// Value noise (rolling 지형용)
// =============================================

function vhash(i: number, j: number): number {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** 부드러운 value noise, 0..1 */
function vnoise(x: number, z: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = vhash(x0, z0), b = vhash(x0 + 1, z0);
  const c = vhash(x0, z0 + 1), d = vhash(x0 + 1, z0 + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 다중 주파수 합성 → 자연스러운 기복 (대략 -1.3 .. 1.6) */
function fbm(x: number, z: number): number {
  let h = 0;
  h += Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.11 - 0.6) * 0.55;
  h += Math.sin(x * 0.07 - z * 0.05) * 0.45;
  h += Math.sin((x + z) * 0.21 + 2.1) * 0.22;
  h += (vnoise(x * 0.09, z * 0.09) - 0.5) * 1.2;
  return h;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// =============================================
// Lowland: 섬들 사이를 메우는 완만한 구릉 지면
// =============================================

// 색 팔레트 (terrainTop 계열과 조화, 약간 차분하게)
const C_GRASS = new THREE.Color(0x82ab5e);   // 초원 (overworld 톤보다 살짝 차분)
const C_GRASS_D = new THREE.Color(0x6b9850);  // 그늘진 골짜기
const C_SAND = new THREE.Color(0xd8c79a);    // 물가 모래
const C_WET = new THREE.Color(0x9aaa8a);     // 젖은 가장자리
const C_NETHER = new THREE.Color(0x7a5246);  // 네더 방향 척박 토양
const C_BEACON = new THREE.Color(0xb8c4a6);  // 비콘 방향 한랭 톤

const _tmpCol = new THREE.Color();

/** lowland 정점 높이. 플랫폼 안에서는 상단 아래로 클램프, 바깥쪽은 바다로 가라앉음. */
function lowlandHeight(wx: number, wz: number): number {
  // 기본 롤링: 평균 약 -0.3, 진폭 작게 (peak ~0.7) — spawn(h=1.0)을 뚫지 않도록
  let H = -0.35 + fbm(wx, wz) * 0.6;
  H = Math.min(H, 0.75);

  // 가장자리: 중심에서 멀어지면 바다로 가라앉힘 (물이 덮어 자연스러운 해안)
  const cd = Math.hypot(wx - WORLD_CX, wz - WORLD_CZ);
  const sink = smoothstep(40, 62, cd);          // 40~62 구간에서 하강
  H = H * (1 - sink) + (-3.2) * sink;

  // 플랫폼 footprint 안에서는 상단보다 낮게 (위로 솟아 잔디를 뚫지 않게)
  const pg = getGroundHeight(wx, wz);
  if (pg > -0.5) H = Math.min(H, pg - 0.3);

  return H;
}

/** 정점 색 — 높이/위치 기반 바이옴 블렌딩 */
function lowlandColor(wx: number, wz: number, H: number, out: THREE.Color): void {
  // 골짜기 깊이에 따른 명암
  const shade = smoothstep(-0.6, 0.6, H);
  out.copy(C_GRASS_D).lerp(C_GRASS, shade);

  // 방향별 바이옴 틴트 (treasure +x / nether -x / beacon -z)
  const towardNether = smoothstep(-6, -26, wx);   // x가 음수로 갈수록
  out.lerp(C_NETHER, towardNether * 0.5);
  const towardBeacon = smoothstep(-40, -56, wz);  // z가 더 음수로(정상 방향)
  out.lerp(C_BEACON, towardBeacon * 0.45);

  // 물가: 모래 → 젖은 가장자리
  const beach = smoothstep(-0.3, -1.4, H);
  out.lerp(C_SAND, beach * 0.7);
  const wet = smoothstep(-1.4, -2.6, H);
  out.lerp(C_WET, wet * 0.8);

  // 미세 노이즈로 페인터리한 얼룩
  const n = vnoise(wx * 0.6, wz * 0.6);
  out.offsetHSL(0, 0, (n - 0.5) * 0.05);
}

export function buildLowland(scene: THREE.Scene): void {
  const W = 132, D = 112;
  const segX = perf.tier === 'high' ? 96 : perf.tier === 'medium' ? 64 : 34;
  const segZ = perf.tier === 'high' ? 80 : perf.tier === 'medium' ? 54 : 28;

  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry는 XY 평면. rotation.x=-PI/2 후: worldX = x, worldZ = -y + posZ
    const lx = pos.getX(i), ly = pos.getY(i);
    const wx = lx + WORLD_CX;
    const wz = -ly + WORLD_CZ;

    const H = lowlandHeight(wx, wz);
    pos.setZ(i, H); // 회전 전 z = 높이

    lowlandColor(wx, wz, H, _tmpCol);
    colors[i * 3] = _tmpCol.r;
    colors[i * 3 + 1] = _tmpCol.g;
    colors[i * 3 + 2] = _tmpCol.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.0, roughness: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(WORLD_CX, 0, WORLD_CZ);
  mesh.receiveShadow = perf.shadows;
  mesh.renderOrder = -2; // 물(renderOrder 1)보다 먼저
  scene.add(mesh);
}

// =============================================
// Distant range: fog 너머 먼 산맥 실루엣
// =============================================

const C_MTN_NEAR = new THREE.Color(0x93aac6);  // 가까운 능선 (하늘빛 도는 슬레이트)
const C_MTN_FAR = new THREE.Color(0xb2c6dc);   // 먼 능선 (하늘색에 가깝게 → fog 블렌드)

export function buildDistantRange(scene: THREE.Scene): void {
  const count = perf.tier === 'high' ? 30 : perf.tier === 'medium' ? 22 : 14;
  const geoms: THREE.BufferGeometry[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const ang = t * Math.PI * 2 + vhash(i, 3) * 0.4;
    // 2겹 능선: 안쪽(가까운)·바깥쪽(먼)
    const ring = i % 3 === 0 ? 1 : 0;
    const radius = (ring ? 130 : 94) + (vhash(i, 7) - 0.5) * 18;
    const mx = WORLD_CX + Math.cos(ang) * radius;
    const mz = WORLD_CZ + Math.sin(ang) * radius;

    const height = (ring ? 24 : 15) + vhash(i, 11) * 14;
    const baseR = (ring ? 20 : 13) + vhash(i, 13) * 10;
    const seg = 5 + (i % 3); // 5~7각 → 패싯한 로우폴리

    const cone = new THREE.ConeGeometry(baseR, height, seg, 1);
    // 살짝 비대칭하게 흔들어 자연스럽게
    const cp = cone.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < cp.count; v++) {
      const vy = cp.getY(v);
      if (vy < height * 0.4) {
        cp.setX(v, cp.getX(v) * (0.85 + vhash(i * 7 + v, 5) * 0.4));
        cp.setZ(v, cp.getZ(v) * (0.85 + vhash(i * 9 + v, 6) * 0.4));
      }
    }
    cone.translate(mx, -2 + height / 2 - 1.5, mz);

    // 정점 색: 먼 능선일수록 하늘색에 가깝게 (fog와 자연 블렌드)
    cone.computeVertexNormals();
    const cc = new Float32Array(cp.count * 3);
    const col = ring ? C_MTN_FAR : C_MTN_NEAR;
    for (let v = 0; v < cp.count; v++) {
      const vy = cp.getY(v) - (-2 + height / 2 - 1.5);
      const up = THREE.MathUtils.clamp(vy / height + 0.5, 0, 1);
      _tmpCol.copy(col).offsetHSL(0, 0, up * 0.06);
      cc[v * 3] = _tmpCol.r; cc[v * 3 + 1] = _tmpCol.g; cc[v * 3 + 2] = _tmpCol.b;
    }
    cone.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    geoms.push(cone);
  }

  const merged = mergeGeometries(geoms);
  geoms.forEach(g => g.dispose());
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.0, roughness: 1.0, flatShading: true, fog: true,
  });
  const range = new THREE.Mesh(merged, mat);
  range.castShadow = false;
  range.receiveShadow = false;
  scene.add(range);
}

// =============================================
// Lowland scatter: 구릉 위 침엽수·바위·풀 (분위기용, 충돌 無)
// =============================================

const C_CONIFER = [new THREE.Color(0x466e3c), new THREE.Color(0x3c6236), new THREE.Color(0x547c44)];
const C_TRUNK = new THREE.Color(0x5a4530);
const C_ROCK = [new THREE.Color(0x8a8278), new THREE.Color(0x767064)];
const C_TUFT = new THREE.Color(0x6f9a52);

export function buildLowlandScatter(scene: THREE.Scene): void {
  if (perf.tier === 'low') return; // 모바일/저사양: 스킵
  const N = perf.tier === 'high' ? 110 : 60;

  // 머티리얼별 geometry 수집 → 색별 1 draw call
  const buckets = new Map<string, { mat: THREE.Material; geoms: THREE.BufferGeometry[] }>();
  const push = (key: string, mat: THREE.Material, g: THREE.BufferGeometry) => {
    let b = buckets.get(key);
    if (!b) { b = { mat, geoms: [] }; buckets.set(key, b); }
    b.geoms.push(g);
  };
  const colorGeo = (g: THREE.BufferGeometry, col: THREE.Color) => {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };

  for (let i = 0; i < N; i++) {
    const a = vhash(i, 17) * Math.PI * 2;
    const r = 8 + vhash(i, 23) * 50;
    const wx = WORLD_CX + Math.cos(a) * r;
    const wz = WORLD_CZ + Math.sin(a) * r * 0.85;

    // 플랫폼 위/물속엔 배치 안 함
    if (getGroundHeight(wx, wz) > -0.5) continue;
    const H = lowlandHeight(wx, wz);
    if (H < -0.7) continue;

    const kind = vhash(i, 31);
    if (kind < 0.42) {
      // 침엽수 (2단 콘) — 언덕 위 숲
      const s = 0.8 + vhash(i, 41) * 0.9;
      const cidx = i % 3;
      const trunk = new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.7 * s, 5);
      trunk.translate(wx, H + 0.35 * s, wz);
      push('trunk', _scatterMat('trunk', C_TRUNK), colorGeo(trunk, C_TRUNK));
      const c1 = new THREE.ConeGeometry(0.62 * s, 1.1 * s, 6);
      c1.translate(wx, H + 1.0 * s, wz);
      const c2 = new THREE.ConeGeometry(0.44 * s, 0.85 * s, 6);
      c2.translate(wx, H + 1.6 * s, wz);
      push(`con${cidx}`, _scatterMat(`con${cidx}`, C_CONIFER[cidx]), colorGeo(c1, C_CONIFER[cidx]));
      push(`con${cidx}`, _scatterMat(`con${cidx}`, C_CONIFER[cidx]), colorGeo(c2, C_CONIFER[cidx]));
    } else if (kind < 0.62) {
      // 바위
      const s = 0.4 + vhash(i, 43) * 0.7;
      const ridx = i % 2;
      const rock = new THREE.DodecahedronGeometry(s, 0);
      rock.scale(1, 0.7, 1);
      rock.translate(wx, H + s * 0.4, wz);
      push(`rock${ridx}`, _scatterMat(`rock${ridx}`, C_ROCK[ridx]), colorGeo(rock, C_ROCK[ridx]));
    } else {
      // 풀 다발 (작은 박스 2~3개)
      const cnt = 2 + (i % 2);
      for (let j = 0; j < cnt; j++) {
        const tuft = new THREE.BoxGeometry(0.14, 0.34, 0.14);
        tuft.translate(wx + (j - 1) * 0.18, H + 0.17, wz + (vhash(i + j, 51) - 0.5) * 0.3);
        push('tuft', _scatterMat('tuft', C_TUFT), colorGeo(tuft, C_TUFT));
      }
    }
  }

  for (const [, b] of buckets) {
    if (!b.geoms.length) continue;
    const merged = mergeGeometries(b.geoms);
    b.geoms.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = perf.shadows;
    mesh.receiveShadow = false;
    scene.add(mesh);
  }
}

const _scatterMatCache = new Map<string, THREE.MeshStandardMaterial>();
function _scatterMat(key: string, _col: THREE.Color): THREE.MeshStandardMaterial {
  let m = _scatterMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.0, roughness: 0.95, flatShading: true });
    _scatterMatCache.set(key, m);
  }
  return m;
}

export function buildLandscape(scene: THREE.Scene): void {
  buildLowland(scene);
  buildDistantRange(scene);
  buildLowlandScatter(scene);
}
