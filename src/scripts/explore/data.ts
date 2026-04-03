// ─── 데이터 정의 ───
// 밝은 복셀 월드 — 바다 위 섬 레이아웃

export interface CompanyData {
  name: string;
  color: number;
  position: { x: number; z: number };
}

export interface ProjectData {
  co: string;
  title: string;
  sub: string;
  period: string;
  role: string;
  badge: string | null;
  bc: string | null;
  color: number;
  coHex: string;
  desc: string;
  tags: string[];
  details: string[];
  link: string;
  off: { x: number; z: number };
  minigame?: string;
}

export interface Platform {
  x: number; z: number;
  w: number; d: number;
  h: number;
}

// 존 배치
export const COMPANIES: CompanyData[] = [
  { name: 'The Nether (2025-2026)', color: 0xa78bfa, position: { x: 0, z: -18 } },
  { name: 'Treasure Isle (2023)', color: 0x6ee7b7, position: { x: 28, z: -40 } },
  { name: 'Beacon Peak (2026)', color: 0xfbbf24, position: { x: -28, z: -40 } },
  { name: 'Overworld (2019-2022)', color: 0xff6b9d, position: { x: 0, z: -58 } },
];

// 플랫폼 — 바다 위 섬 구조
// 모든 플랫폼 h > 0 (바다 수면 = 0, 섬은 그 위)
export const PLATFORMS: Platform[] = [
  // ── 메인 섬 ──
  { x: 0, z: 0, w: 14, d: 12, h: 0.5 },                    // 스폰
  { x: 0, z: -18, w: 18, d: 14, h: 1.0 },                   // Zone 0
  { x: 28, z: -40, w: 18, d: 14, h: 2.5 },                  // Zone 1
  { x: -28, z: -40, w: 18, d: 14, h: 2.0 },                 // Zone 2
  { x: 0, z: -58, w: 18, d: 14, h: 3.2 },                   // Zone 3

  // ═══ 스폰 → Zone 0 ═══
  { x: 0, z: -9, w: 8, d: 8, h: 0.75 },

  // ═══ Zone 0 → Zone 1 (오른쪽) ═══
  { x: 9, z: -24, w: 8, d: 7, h: 1.3 },
  { x: 18, z: -32, w: 8, d: 7, h: 1.9 },

  // ═══ Zone 0 → Zone 2 (왼쪽) ═══
  { x: -9, z: -24, w: 8, d: 7, h: 1.3 },
  { x: -18, z: -32, w: 8, d: 7, h: 1.65 },

  // ═══ Zone 0 → Zone 3 (중앙 메인) ═══
  { x: 0, z: -31, w: 8, d: 8, h: 1.6 },
  { x: 0, z: -44, w: 8, d: 8, h: 2.4 },

  // ═══ Zone 1 → Zone 3 ═══
  { x: 15, z: -50, w: 8, d: 7, h: 2.9 },

  // ═══ Zone 2 → Zone 3 ═══
  { x: -15, z: -50, w: 8, d: 7, h: 2.7 },
];

/** 위치 (x,z)의 지면 높이 반환 — 겹치는 플랫폼 중 가장 높은 값 */
export function getGroundHeight(x: number, z: number): number {
  let maxH = -0.5; // 바다 아래가 기본
  for (const p of PLATFORMS) {
    const hw = p.w / 2, hd = p.d / 2;
    if (x >= p.x - hw && x <= p.x + hw && z >= p.z - hd && z <= p.z + hd) {
      if (p.h > maxH) maxH = p.h;
    }
  }
  return maxH;  // 플랫폼 밖이면 -0.5 (바다)
}

// ═══════════════════════════════════════
// ── Fence Collision System ──
// ═══════════════════════════════════════
// scene.ts의 buildFences와 동일한 인접 판정 알고리즘으로
// 울타리 위치를 AABB collider로 생성.
// 비주얼은 scene.ts, 충돌은 여기서 담당 (데이터 의존성만 있으므로 순환참조 없음)

export interface FenceCollider {
  x: number; z: number;
  hw: number; hd: number;  // half-width, half-depth
  top: number;             // fence top Y (아래는 platform height)
}

function computeFenceColliders(): FenceCollider[] {
  const ADJ = 5.0;     // 인접 임계값 (scene.ts와 동일)
  const STEP = 1.15;    // 샘플링 간격
  const THICK = 0.25;   // collider 반 두께
  const colliders: FenceCollider[] = [];

  /** 해당 지점에 인접 플랫폼이 있는지 (= 통로 개구부) */
  function isConn(
      ex: number, ez: number,
      axis: 'x' | 'z', dir: number,
      self: Platform,
  ): boolean {
    for (const q of PLATFORMS) {
      if (q === self || q.h <= 0) continue;
      if (axis === 'x') {
        const qE = dir > 0 ? q.x - q.w / 2 : q.x + q.w / 2;
        const pE = self.x + dir * self.w / 2;
        if (Math.abs(qE - pE) < ADJ &&
            ez >= q.z - q.d / 2 - 1.5 && ez <= q.z + q.d / 2 + 1.5) return true;
      } else {
        const qE = dir > 0 ? q.z - q.d / 2 : q.z + q.d / 2;
        const pE = self.z + dir * self.d / 2;
        if (Math.abs(qE - pE) < ADJ &&
            ex >= q.x - q.w / 2 - 1.5 && ex <= q.x + q.w / 2 + 1.5) return true;
      }
    }
    return false;
  }

  for (const p of PLATFORMS) {
    if (p.h <= 0) continue;
    const hw = p.w / 2, hd = p.d / 2;
    const isMain = p.w >= 14;
    const fenceTop = p.h + (isMain ? 0.85 : 0.70);

    const edges: { axis: 'x' | 'z'; dir: number; from: number; to: number }[] = [
      { axis: 'x', dir:  1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },
      { axis: 'x', dir: -1, from: p.z - hd + 0.4, to: p.z + hd - 0.4 },
      { axis: 'z', dir:  1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },
      { axis: 'z', dir: -1, from: p.x - hw + 0.4, to: p.x + hw - 0.4 },
    ];

    for (const edge of edges) {
      const len = edge.to - edge.from;
      if (len < 0.5) continue;
      const steps = Math.max(1, Math.round(len / STEP));
      const runsZ = edge.axis === 'x'; // right/left edge → collider runs along Z

      let segStart: number | null = null;

      /** 연속된 open 구간을 하나의 AABB collider로 합침 */
      const closeSeg = (s: number, e: number) => {
        const halfLen = (e - s) / 2 + 0.15; // 약간 여유
        const mid = (s + e) / 2;
        if (runsZ) {
          colliders.push({
            x: p.x + edge.dir * (hw + 0.05),
            z: mid, hw: THICK, hd: halfLen, top: fenceTop,
          });
        } else {
          colliders.push({
            x: mid,
            z: p.z + edge.dir * (hd + 0.05),
            hw: halfLen, hd: THICK, top: fenceTop,
          });
        }
      };

      for (let i = 0; i <= steps; i++) {
        const along = edge.from + (i / steps) * len;
        const ex = runsZ ? p.x + edge.dir * hw : along;
        const ez = runsZ ? along : p.z + edge.dir * hd;

        if (!isConn(ex, ez, edge.axis, edge.dir, p)) {
          if (segStart === null) segStart = along;
          if (i === steps) { closeSeg(segStart, along); segStart = null; }
        } else {
          if (segStart !== null) {
            const prev = edge.from + ((i - 1) / steps) * len;
            closeSeg(segStart, prev);
            segStart = null;
          }
        }
      }
      if (segStart !== null) closeSeg(segStart, edge.to);
    }

    // Corner colliders
    const corners: [number, number][] = [
      [p.x + hw, p.z + hd], [p.x + hw, p.z - hd],
      [p.x - hw, p.z + hd], [p.x - hw, p.z - hd],
    ];
    corners.forEach(([cx, cz]) => {
      const cX = isConn(cx, cz, 'x', cx > p.x ? 1 : -1, p);
      const cZ = isConn(cx, cz, 'z', cz > p.z ? 1 : -1, p);
      if (cX && cZ) return;
      colliders.push({ x: cx, z: cz, hw: 0.22, hd: 0.22, top: fenceTop });
    });
  }

  return colliders;
}

/** 모듈 로드 시 한 번만 계산 (PLATFORMS가 const이므로 안전) */
export const FENCE_COLLIDERS = computeFenceColliders();

/** 캐릭터 위치가 울타리 collider와 겹치는지 체크 */
export function isFenceBlocked(px: number, pz: number, py: number, radius = 0.25): boolean {
  for (const f of FENCE_COLLIDERS) {
    if (py > f.top) continue; // 울타리 위로 점프해서 넘어가면 통과
    if (px + radius > f.x - f.hw && px - radius < f.x + f.hw &&
        pz + radius > f.z - f.hd && pz - radius < f.z + f.hd) {
      return true;
    }
  }
  return false;
}

export const PROJECTS: ProjectData[] = [
  { co: 'The Nether (2025-2026)', title: 'ETERNA', sub: '아고라 시스템', period: '2025.11 — 2026.04', role: '아키텍처 설계 · 구현 전담', badge: 'ARCHITECT', bc: '#6ee7b7', color: 0xa78bfa, coHex: '#a78bfa', desc: '디스코드형 커뮤니티 시스템. Service/Repository/State 3계층 아키텍처 직접 설계.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'Tencent IM', 'FlatBuffers'], details: ['아고라 CRUD·알림·검색·권한 전체 구현', '크로스플랫폼 STT 직접 구현', '한글 조합 커스텀 InputField', 'UaaL 양방향 통신 검증'], link: '/projects/eterna/', off: { x: -2.5, z: 0 } },
  { co: 'The Nether (2025-2026)', title: 'REIW', sub: '3D 메타버스', period: '2025.06 — 2025.11', role: '채팅 재설계 · 하우징 · 퀘스트', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: 'Tencent IM 채팅 재설계, 하우징 프로토타입, NPC 퀘스트.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'DOTween'], details: ['채팅·친구 시스템 재설계', '하우징 배치·편집·Undo/Redo', 'NPC 퀘스트 시스템', 'DataTableSO 에디터 툴'], link: '/projects/reiw/', off: { x: 0, z: 0 } },
  { co: 'The Nether (2025-2026)', title: 'IW Zombie', sub: '팀 서바이벌', period: '2025.02 — 2025.06', role: '게임 루프 · 채팅 · AI NPC', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: '5단계 게임 루프 전반과 Tencent IM 채팅 첫 도입.', tags: ['Unity', 'C#', 'Tencent IM', 'DOTween'], details: ['5단계 게임 루프 구현', 'Tencent IM 채팅 첫 도입', '3D 사운드 풀링', '범용 디버그 치트 시스템'], link: '/projects/iw-zombie/', off: { x: 2.5, z: 0 } },
  { co: 'Treasure Isle (2023)', title: 'STELSI Wallet', sub: '이더리움 HD 지갑', period: '2023.02 — 2023.08', role: '설계 · 구현 · 출시 (1인)', badge: 'SOLO', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#6ee7b7', desc: 'Unity→Flutter 스택 전환. BIP39/BIP44 HD 지갑. 양대 스토어 출시.', tags: ['Flutter', 'Dart', 'Riverpod', 'web3dart'], details: ['HD 지갑 10개 주소 파생', '스마트 컨트랙트 3종', 'SecureStorage 암호화', 'App Store + Google Play 출시'], link: '/projects/stelsi-wallet/', off: { x: -1.8, z: 0 } },
  { co: 'Treasure Isle (2023)', title: 'Nomads Planet', sub: '멀티플레이어 메타버스', period: '2023.06 — 2023.09', role: '기획·설계·구현 (1인)', badge: '수상', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#6ee7b7', desc: 'Unity Netcode + Vivox 멀티플레이어. K-메타버스 경진대회 장려상.', tags: ['Unity', 'C#', 'Netcode', 'Vivox'], details: ['3-Singleton 구조', 'Matchmaker + Backfill', 'NPC 교통 FSM', '실시간 리더보드'], link: '/projects/nomads-planet/', off: { x: 1.8, z: 0 }, minigame: 'nomads' },
  { co: 'Beacon Peak (2026)', title: 'HAUL', sub: '2D PvPvE Extraction', period: '2025.10 — 현재', role: '기획·설계·구현 (1인)', badge: 'IN PROGRESS', bc: '#fbbf24', color: 0xfbbf24, coHex: '#fbbf24', desc: 'Server-authoritative 멀티플레이어. CSP, 서버 리콘, NPC AI 1인 구현 중.', tags: ['Godot 4', 'C#', 'ASP.NET', 'gRPC', 'LiteNetLib'], details: ['동일 물리 엔진 misprediction 최소화', 'Client-side prediction + Reconciliation', 'NPC fake InputCmd 패턴', '7-state FSM Human NPC'], link: '/projects/haul/', off: { x: 0, z: 0 }, minigame: 'haul' },
  { co: 'Overworld (2019-2022)', title: 'SPODY', sub: 'XR 유아 교육', period: '2020.01 — 2021.06', role: '개발 전담 (1인→5인 리드)', badge: 'SOLO→LEAD', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#ff6b9d', desc: 'Kinect/ASTRA + OpenCV XR 교육. 양산 체계 구축, 공공기관 납품.', tags: ['Unity', 'C#', 'OpenCV', 'Kinect'], details: ['깊이센서→UI 터치 파이프라인', 'OpenCV 자동 캘리브레이션', '24개+ 모듈 양산', '공공기관 납품, 인도네시아 수출'], link: '/projects/spody/', off: { x: -1.8, z: 0 }, minigame: 'spody' },
  { co: 'Overworld (2019-2022)', title: 'Math Master', sub: '미로 탈출', period: '2021.06 — 2022.06', role: '게임 로직 개발', badge: null, bc: null, color: 0xff6b9d, coHex: '#ff6b9d', desc: '초등 수학 라이브 서비스. Recursive Backtracker + A* 알고리즘.', tags: ['Unity', 'C#'], details: ['Recursive Backtracker 미로 생성', 'A* 최단 경로 탐색', '분수 도메인 타입 설계', '자체 Tween 라이브러리'], link: '#', off: { x: 0, z: 1.5 }, minigame: 'maze' },
  { co: 'Overworld (2019-2022)', title: '루비의 모험', sub: '3D 액션 RPG', period: '2019.09 — 2019.11', role: '기획·설계·구현 (1인)', badge: '우수상', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#ff6b9d', desc: '1인 개발 3D 액션 RPG. 졸업전시 우수상.', tags: ['Unity', 'C#', 'NavMesh', 'Timeline'], details: ['5-state FSM 플레이어', '콤보 + 스킬 3종', 'NavMesh AI + 유도탄 마법사', 'ScriptableObject 인벤토리'], link: '/projects/ruby-adventure/', off: { x: 1.8, z: 0 }, minigame: 'ruby' },
];