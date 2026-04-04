// World data: zones, platforms, projects
// Collision logic is in collision.ts

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

// --- Zone layout ---

export const COMPANIES: CompanyData[] = [
  { name: 'The Nether (2025-2026)', color: 0xa78bfa, position: { x: 0, z: -18 } },
  { name: 'Treasure Isle (2023)', color: 0x6ee7b7, position: { x: 28, z: -40 } },
  { name: 'Beacon Peak (2026)', color: 0xfbbf24, position: { x: -28, z: -40 } },
  { name: 'Overworld (2019-2022)', color: 0xff6b9d, position: { x: 0, z: -58 } },
];

// --- Platforms (sea level = 0, islands above) ---

export const PLATFORMS: Platform[] = [
  // Main islands
  { x: 0, z: 0, w: 14, d: 12, h: 0.5 },
  { x: 0, z: -18, w: 18, d: 14, h: 1.0 },
  { x: 28, z: -40, w: 18, d: 14, h: 2.5 },
  { x: -28, z: -40, w: 18, d: 14, h: 2.0 },
  { x: 0, z: -58, w: 18, d: 14, h: 3.2 },

  // Spawn -> Zone 0
  { x: 0, z: -9, w: 8, d: 8, h: 0.75 },

  // Zone 0 -> Zone 1 (right)
  { x: 9, z: -24, w: 8, d: 7, h: 1.3 },
  { x: 18, z: -32, w: 8, d: 7, h: 1.9 },

  // Zone 0 -> Zone 2 (left)
  { x: -9, z: -24, w: 8, d: 7, h: 1.3 },
  { x: -18, z: -32, w: 8, d: 7, h: 1.65 },

  // Zone 0 -> Zone 3 (center)
  { x: 0, z: -31, w: 8, d: 8, h: 1.6 },
  { x: 0, z: -44, w: 8, d: 8, h: 2.4 },

  // Zone 1 -> Zone 3
  { x: 15, z: -50, w: 8, d: 7, h: 2.9 },

  // Zone 2 -> Zone 3
  { x: -15, z: -50, w: 8, d: 7, h: 2.7 },
];

/** Ground height at (x,z). Returns highest overlapping platform, or -0.5 (below sea). */
export function getGroundHeight(x: number, z: number): number {
  let maxH = -0.5;
  for (const p of PLATFORMS) {
    const hw = p.w / 2, hd = p.d / 2;
    if (x >= p.x - hw && x <= p.x + hw && z >= p.z - hd && z <= p.z + hd) {
      if (p.h > maxH) maxH = p.h;
    }
  }
  return maxH;
}

/** Surface material at (x,z) for footstep sound selection. */
export function getSurface(x: number, z: number): 'grass' | 'stone' | 'wood' {
  let bestH = -1;
  let bestP: Platform | null = null;
  for (const p of PLATFORMS) {
    const hw = p.w / 2, hd = p.d / 2;
    if (x >= p.x - hw && x <= p.x + hw && z >= p.z - hd && z <= p.z + hd) {
      if (p.h > bestH) { bestH = p.h; bestP = p; }
    }
  }
  if (!bestP) return 'stone';
  if (bestP.w >= 14) return 'grass';
  if (bestP.w >= 8) return 'stone';
  return 'wood';
}

// --- Projects ---

export const PROJECTS: ProjectData[] = [
  { co: 'The Nether (2025-2026)', title: 'ETERNA', sub: '아고라 시스템', period: '2025.11 - 2026.04', role: '아키텍처 설계, 구현 전담', badge: 'ARCHITECT', bc: '#6ee7b7', color: 0xa78bfa, coHex: '#a78bfa', desc: '디스코드형 커뮤니티 시스템. Service/Repository/State 3계층 아키텍처 직접 설계.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'Tencent IM', 'FlatBuffers'], details: ['아고라 CRUD, 알림, 검색, 권한 전체 구현', '크로스플랫폼 STT 직접 구현', '한글 조합 커스텀 InputField', 'UaaL 양방향 통신 검증'], link: '/projects/eterna/', off: { x: -2.5, z: 0 } },
  { co: 'The Nether (2025-2026)', title: 'REIW', sub: '3D 메타버스', period: '2025.06 - 2025.11', role: '채팅 재설계, 하우징, 퀘스트', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: 'Tencent IM 채팅 재설계, 하우징 프로토타입, NPC 퀘스트.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'DOTween'], details: ['채팅, 친구 시스템 재설계', '하우징 배치, 편집, Undo/Redo', 'NPC 퀘스트 시스템', 'DataTableSO 에디터 툴'], link: '/projects/reiw/', off: { x: 0, z: 0 } },
  { co: 'The Nether (2025-2026)', title: 'IW Zombie', sub: '팀 서바이벌', period: '2025.02 - 2025.06', role: '게임 루프, 채팅, AI NPC', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: '5단계 게임 루프 전반과 Tencent IM 채팅 첫 도입.', tags: ['Unity', 'C#', 'Tencent IM', 'DOTween'], details: ['5단계 게임 루프 구현', 'Tencent IM 채팅 첫 도입', '3D 사운드 풀링', '범용 디버그 치트 시스템'], link: '/projects/iw-zombie/', off: { x: 2.5, z: 0 } },
  { co: 'Treasure Isle (2023)', title: 'STELSI Wallet', sub: '이더리움 HD 지갑', period: '2023.02 - 2023.08', role: '설계, 구현, 출시 (1인)', badge: 'SOLO', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#6ee7b7', desc: 'Unity->Flutter 스택 전환. BIP39/BIP44 HD 지갑. 양대 스토어 출시.', tags: ['Flutter', 'Dart', 'Riverpod', 'web3dart'], details: ['HD 지갑 10개 주소 파생', '스마트 컨트랙트 3종', 'SecureStorage 암호화', 'App Store + Google Play 출시'], link: '/projects/stelsi-wallet/', off: { x: -1.8, z: 0 } },
  { co: 'Treasure Isle (2023)', title: 'Nomads Planet', sub: '멀티플레이어 메타버스', period: '2023.06 - 2023.09', role: '기획, 설계, 구현 (1인)', badge: '수상', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#6ee7b7', desc: 'Unity Netcode + Vivox 멀티플레이어. K-메타버스 경진대회 장려상.', tags: ['Unity', 'C#', 'Netcode', 'Vivox'], details: ['3-Singleton 구조', 'Matchmaker + Backfill', 'NPC 교통 FSM', '실시간 리더보드'], link: '/projects/nomads-planet/', off: { x: 1.8, z: 0 }, minigame: 'nomads' },
  { co: 'Beacon Peak (2026)', title: 'HAUL', sub: '2D PvPvE Extraction', period: '2025.10 - 현재', role: '기획, 설계, 구현 (1인)', badge: 'IN PROGRESS', bc: '#fbbf24', color: 0xfbbf24, coHex: '#fbbf24', desc: 'Server-authoritative 멀티플레이어. CSP, 서버 리콘, NPC AI 1인 구현 중.', tags: ['Godot 4', 'C#', 'ASP.NET', 'gRPC', 'LiteNetLib'], details: ['동일 물리 엔진 misprediction 최소화', 'Client-side prediction + Reconciliation', 'NPC fake InputCmd 패턴', '7-state FSM Human NPC'], link: '/projects/haul/', off: { x: 0, z: 0 }, minigame: 'haul' },
  { co: 'Overworld (2019-2022)', title: 'SPODY', sub: 'XR 유아 교육', period: '2020.01 - 2021.06', role: '개발 전담 (1인->5인 리드)', badge: 'SOLO->LEAD', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#ff6b9d', desc: 'Kinect/ASTRA + OpenCV XR 교육. 양산 체계 구축, 공공기관 납품.', tags: ['Unity', 'C#', 'OpenCV', 'Kinect'], details: ['깊이센서->UI 터치 파이프라인', 'OpenCV 자동 캘리브레이션', '24개+ 모듈 양산', '공공기관 납품, 인도네시아 수출'], link: '/projects/spody/', off: { x: -1.8, z: 0 }, minigame: 'spody' },
  { co: 'Overworld (2019-2022)', title: 'Math Master', sub: '미로 탈출', period: '2021.06 - 2022.06', role: '게임 로직 개발', badge: null, bc: null, color: 0xff6b9d, coHex: '#ff6b9d', desc: '초등 수학 라이브 서비스. Recursive Backtracker + A* 알고리즘.', tags: ['Unity', 'C#'], details: ['Recursive Backtracker 미로 생성', 'A* 최단 경로 탐색', '분수 도메인 타입 설계', '자체 Tween 라이브러리'], link: '/projects/math-master/', off: { x: 0, z: 1.5 }, minigame: 'maze' },
  { co: 'Overworld (2019-2022)', title: '루비의 모험', sub: '3D 액션 RPG', period: '2019.09 - 2019.11', role: '기획, 설계, 구현 (1인)', badge: '우수상', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#ff6b9d', desc: '1인 개발 3D 액션 RPG. 졸업전시 우수상.', tags: ['Unity', 'C#', 'NavMesh', 'Timeline'], details: ['5-state FSM 플레이어', '콤보 + 스킬 3종', 'NavMesh AI + 유도탄 마법사', 'ScriptableObject 인벤토리'], link: '/projects/ruby-adventure/', off: { x: 1.8, z: 0 }, minigame: 'ruby' },
];
