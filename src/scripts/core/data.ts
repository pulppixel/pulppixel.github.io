// World data: zones, platforms, projects
// PEAK redesign: ascending height from Spawn(1.0) → Summit(12.0)
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
  { name: 'Overworld (19-22)', color: 0xff6b9d, position: { x: 0, z: -18 } },
  { name: 'Treasure Isle (23)', color: 0x6ee7b7, position: { x: 28, z: -40 } },
  { name: 'The Nether (25-26)', color: 0xa78bfa, position: { x: -28, z: -40 } },
  { name: 'Beacon Peak (26)', color: 0xfbbf24, position: { x: 0, z: -58 } },
];

// --- Platforms ---
// PEAK 등산 컨셉: Spawn이 최하단, Beacon Peak가 정상
//
// Height map:
//   Spawn(1.0) → Hub(4.0) → East(9.0) / West(8.0) → Summit(12.0)
//
// Jump physics: JUMP_FORCE=9.6, GRAVITY=-18.9
//   max_jump_height ≈ 2.44 units
//   모든 인접 스텝 높이차 < 1.5 (안전 마진 유지)
//
// STEP_H = 0.35 in main.ts. 이상은 점프 필요.

export const PLATFORMS: Platform[] = [
  // ===== MAIN ISLANDS (PEAK heights) =====
  { x: 0, z: 0, w: 14, d: 12, h: 1.0 },         // Spawn — Base Camp
  { x: 0, z: -18, w: 18, d: 14, h: 4.0 },        // Zone 0 — First Ridge (hub)
  { x: 28, z: -40, w: 18, d: 14, h: 9.0 },       // Zone 1 — Eastern Cliff (Treasure Isle)
  { x: -28, z: -40, w: 18, d: 14, h: 8.0 },      // Zone 2 — Western Ridge (The Nether)
  { x: 0, z: -58, w: 18, d: 14, h: 12.0 },       // Zone 3 — Summit! (Beacon Peak)

  // ===== SPAWN → ZONE 0 (gentle intro, 2 stones) =====
  // 높이: 1.0 → 2.0 → 3.0 → 4.0 (zone 0)
  { x: 1, z: -7.5, w: 3, d: 2.5, h: 2.0 },      // S1 — 첫 점프 (+1.0)
  { x: -0.5, z: -10, w: 2.5, d: 2, h: 3.0 },    // S2 — 두번째 (+1.0)

  // ===== ZONE 0 → ZONE 1 (right diagonal, 5 stones) =====
  // 높이: 4.0 → 5.0 → 6.0 → 7.0 → 7.8 → 8.5 → 9.0
  { x: 11, z: -23, w: 3.5, d: 3, h: 5.0 },      // R1 (+1.0)
  { x: 14, z: -27, w: 3, d: 3, h: 6.0 },         // R2 (+1.0) — first real jump
  { x: 17, z: -29, w: 3, d: 3, h: 7.0 },         // R3 (+1.0)
  { x: 19.5, z: -31, w: 3, d: 2.5, h: 7.8 },    // R4 (+0.8)
  { x: 22, z: -32, w: 2.5, d: 2, h: 8.5 },      // R5 (+0.7) — approach zone 1

  // ===== ZONE 0 → ZONE 2 (left diagonal, 5 stones) =====
  // 높이: 4.0 → 5.0 → 5.8 → 6.4 → 7.0 → 7.5 → 8.0
  { x: -11, z: -23, w: 3.5, d: 3, h: 5.0 },     // L1 (+1.0)
  { x: -14, z: -27, w: 3, d: 3, h: 5.8 },        // L2 (+0.8)
  { x: -17, z: -29, w: 3, d: 3, h: 6.4 },        // L3 (+0.6)
  { x: -19.5, z: -31, w: 3, d: 2.5, h: 7.0 },   // L4 (+0.6)
  { x: -22, z: -32, w: 2.5, d: 2, h: 7.5 },     // L5 (+0.5) — approach zone 2

  // ===== ZONE 0 → ZONE 3 (center path, 6 stones — longest) =====
  // 높이: 4.0 → 5.2 → 6.4 → 7.5 → 8.5 → 9.5 → 10.5 → 12.0
  { x: 0, z: -27, w: 3.5, d: 3, h: 5.2 },        // C1 (+1.2)
  { x: -1.5, z: -31, w: 3, d: 2.5, h: 6.4 },    // C2 (+1.2)
  { x: 1, z: -35, w: 2.5, d: 2.5, h: 7.5 },     // C3 (+1.1) — big gap, requires jump
  { x: -0.5, z: -39, w: 3.5, d: 3, h: 8.5 },    // C4 (+1.0) — rest area (wider)
  { x: 0.5, z: -43, w: 3, d: 2.5, h: 9.5 },     // C5 (+1.0)
  { x: 0, z: -47, w: 3, d: 3, h: 10.5 },         // C6 (+1.0)

  // ===== ZONE 1 → ZONE 3 (right shortcut, 3 stones) =====
  // 높이: 9.0 → 10.0 → 10.8 → 11.4 → 12.0
  { x: 20, z: -48, w: 3, d: 2.5, h: 10.0 },     // TR1 (+1.0)
  { x: 14, z: -50, w: 3, d: 3, h: 10.8 },        // TR2 (+0.8)
  { x: 8, z: -52, w: 3.5, d: 2.5, h: 11.4 },    // TR3 (+0.6)

  // ===== ZONE 2 → ZONE 3 (left shortcut, 3 stones) =====
  // 높이: 8.0 → 9.0 → 10.0 → 11.0 → 12.0
  { x: -20, z: -48, w: 3, d: 2.5, h: 9.0 },     // TL1 (+1.0)
  { x: -14, z: -50, w: 3, d: 3, h: 10.0 },       // TL2 (+1.0)
  { x: -8, z: -52, w: 3.5, d: 2.5, h: 11.0 },   // TL3 (+1.0)
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
  if (bestP.w >= 5) return 'stone';   // medium stepping stones = stone
  return 'wood';                        // tiny stones = wood
}

// --- Projects ---

export const PROJECTS: ProjectData[] = [
  { co: 'The Nether (25-26)', title: 'ETERNA', sub: '\uC544\uACE0\uB77C \uC2DC\uC2A4\uD15C', period: '2025.11 - 2026.04', role: '\uC544\uD0A4\uD14D\uCC98 \uC124\uACC4, \uAD6C\uD604 \uC804\uB2F4', badge: 'ARCHITECT', bc: '#6ee7b7', color: 0xa78bfa, coHex: '#a78bfa', desc: '\uB514\uC2A4\uCF54\uB4DC\uD615 \uCEE4\uBBA4\uB2C8\uD2F0 \uC2DC\uC2A4\uD15C. Service/Repository/State 3\uACC4\uCE35 \uC544\uD0A4\uD14D\uCC98 \uC9C1\uC811 \uC124\uACC4.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'Tencent IM', 'FlatBuffers'], details: ['\uC544\uACE0\uB77C CRUD, \uC54C\uB9BC, \uAC80\uC0C9, \uAD8C\uD55C \uC804\uCCB4 \uAD6C\uD604', '\uD06C\uB85C\uC2A4\uD50C\uB7AB\uD3FC STT \uC9C1\uC811 \uAD6C\uD604', '\uD55C\uAE00 \uC870\uD569 \uCEE4\uC2A4\uD140 InputField', 'UaaL \uC591\uBC29\uD5A5 \uD1B5\uC2E0 \uAC80\uC99D'], link: '/projects/eterna/', off: { x: -2.5, z: 0 } },
  { co: 'The Nether (25-26)', title: 'REIW', sub: '3D \uBA54\uD0C0\uBC84\uC2A4', period: '2025.06 - 2025.11', role: '\uCC44\uD305 \uC7AC\uC124\uACC4, \uD558\uC6B0\uC9D5, \uD034\uC2A4\uD2B8', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: 'Tencent IM \uCC44\uD305 \uC7AC\uC124\uACC4, \uD558\uC6B0\uC9D5 \uD504\uB85C\uD1A0\uD0C0\uC785, NPC \uD034\uC2A4\uD2B8.', tags: ['Unity', 'C#', 'R3', 'UniTask', 'DOTween'], details: ['\uCC44\uD305, \uCE5C\uAD6C \uC2DC\uC2A4\uD15C \uC7AC\uC124\uACC4', '\uD558\uC6B0\uC9D5 \uBC30\uCE58, \uD3B8\uC9D1, Undo/Redo', 'NPC \uD034\uC2A4\uD2B8 \uC2DC\uC2A4\uD15C', 'DataTableSO \uC5D0\uB514\uD130 \uD234'], link: '/projects/reiw/', off: { x: 0, z: 0 } },
  { co: 'The Nether (25-26)', title: 'IW Zombie', sub: '\uD300 \uC11C\uBC14\uC774\uBC8C', period: '2025.02 - 2025.06', role: '\uAC8C\uC784 \uB8E8\uD504, \uCC44\uD305, AI NPC', badge: null, bc: null, color: 0xa78bfa, coHex: '#a78bfa', desc: '5\uB2E8\uACC4 \uAC8C\uC784 \uB8E8\uD504 \uC804\uBC18\uACFC Tencent IM \uCC44\uD305 \uCCAB \uB3C4\uC785.', tags: ['Unity', 'C#', 'Tencent IM', 'DOTween'], details: ['5\uB2E8\uACC4 \uAC8C\uC784 \uB8E8\uD504 \uAD6C\uD604', 'Tencent IM \uCC44\uD305 \uCCAB \uB3C4\uC785', '3D \uC0AC\uC6B4\uB4DC \uD480\uB9C1', '\uBC94\uC6A9 \uB514\uBC84\uADF8 \uCE58\uD2B8 \uC2DC\uC2A4\uD15C'], link: '/projects/iw-zombie/', off: { x: 2.5, z: 0 } },
  { co: 'Treasure Isle (23)', title: 'STELSI Wallet', sub: '\uC774\uB354\uB9AC\uC6C0 HD \uC9C0\uAC11', period: '2023.02 - 2023.08', role: '\uC124\uACC4, \uAD6C\uD604, \uCD9C\uC2DC (1\uC778)', badge: 'SOLO', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#6ee7b7', desc: 'Unity->Flutter \uC2A4\uD0DD \uC804\uD658. BIP39/BIP44 HD \uC9C0\uAC11. \uC591\uB300 \uC2A4\uD1A0\uC5B4 \uCD9C\uC2DC.', tags: ['Flutter', 'Dart', 'Riverpod', 'web3dart'], details: ['HD \uC9C0\uAC11 10\uAC1C \uC8FC\uC18C \uD30C\uC0DD', '\uC2A4\uB9C8\uD2B8 \uCEE8\uD2B8\uB799\uD2B8 3\uC885', 'SecureStorage \uC554\uD638\uD654', 'App Store + Google Play \uCD9C\uC2DC'], link: '/projects/stelsi-wallet/', off: { x: -1.8, z: 0 } },
  { co: 'Treasure Isle (23)', title: 'Nomads Planet', sub: '\uBA40\uD2F0\uD50C\uB808\uC774\uC5B4 \uBA54\uD0C0\uBC84\uC2A4', period: '2023.06 - 2023.09', role: '\uAE30\uD68D, \uC124\uACC4, \uAD6C\uD604 (1\uC778)', badge: '\uC218\uC0C1', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#6ee7b7', desc: 'Unity Netcode + Vivox \uBA40\uD2F0\uD50C\uB808\uC774\uC5B4. K-\uBA54\uD0C0\uBC84\uC2A4 \uACBD\uC9C4\uB300\uD68C \uC7A5\uB824\uC0C1.', tags: ['Unity', 'C#', 'Netcode', 'Vivox'], details: ['3-Singleton \uAD6C\uC870', 'Matchmaker + Backfill', 'NPC \uAD50\uD1B5 FSM', '\uC2E4\uC2DC\uAC04 \uB9AC\uB354\uBCF4\uB4DC'], link: '/projects/nomads-planet/', off: { x: 1.8, z: 0 }, minigame: 'nomads' },
  { co: 'Treasure Isle (23)', title: 'Nine to Six', sub: 'Frenzy Circle', period: '2024.06 - 2024.10', role: '\uAC8C\uC784 \uB85C\uC9C1 \uAC1C\uBC1C', badge: null, bc: null, color: 0x6ee7b7, coHex: '#6ee7b7', desc: 'TON \uC0DD\uD0DC\uACC4 \uD154\uB808\uADF8\uB7A8(WebGL) \uBBF8\uB2C8 \uAC8C\uC784. \uCF54\uC778 \uBC00 \uD14C\uB9C8, \uB7AD\uD0B9.', tags: ['Unity', 'C#', 'WebGL'], details: ['\uD154\uB808\uADF8\uB7A8 API \uB85C\uADF8\uC778', '\uCF54\uC778 \uBC00 \uD14C\uB9C8', '\uB7AD\uD0B9 \uC2DC\uC2A4\uD15C', 'WebGL \uBE4C\uB4DC'], link: '/projects/frenzy-circle/', off: { x: 0, z: -1.5 }, minigame: 'ninetosix' },  { co: 'Beacon Peak (26)', title: 'HAUL', sub: '2D PvPvE Extraction', period: '2025.10 - \uD604\uC7AC', role: '\uAE30\uD68D, \uC124\uACC4, \uAD6C\uD604 (1\uC778)', badge: 'IN PROGRESS', bc: '#fbbf24', color: 0xfbbf24, coHex: '#fbbf24', desc: 'Server-authoritative \uBA40\uD2F0\uD50C\uB808\uC774\uC5B4. CSP, \uC11C\uBC84 \uB9AC\uCF58, NPC AI 1\uC778 \uAD6C\uD604 \uC911.', tags: ['Godot 4', 'C#', 'ASP.NET', 'gRPC', 'LiteNetLib'], details: ['\uB3D9\uC77C \uBB3C\uB9AC \uC5D4\uC9C4 misprediction \uCD5C\uC18C\uD654', 'Client-side prediction + Reconciliation', 'NPC fake InputCmd \uD328\uD134', '7-state FSM Human NPC'], link: '/projects/haul/', off: { x: 0, z: 0 }, minigame: 'haul' },
  { co: 'Overworld (19-22)', title: 'SPODY', sub: 'XR \uC720\uC544 \uAD50\uC721', period: '2020.01 - 2021.06', role: '\uAC1C\uBC1C \uC804\uB2F4 (1\uC778->5\uC778 \uB9AC\uB4DC)', badge: 'SOLO->LEAD', bc: '#6ee7b7', color: 0x6ee7b7, coHex: '#ff6b9d', desc: 'Kinect/ASTRA + OpenCV XR \uAD50\uC721. \uC591\uC0B0 \uCCB4\uACC4 \uAD6C\uCD95, \uACF5\uACF5\uAE30\uAD00 \uB0A9\uD488.', tags: ['Unity', 'C#', 'OpenCV', 'Kinect'], details: ['\uAE4A\uC774\uC13C\uC11C->UI \uD130\uCE58 \uD30C\uC774\uD504\uB77C\uC778', 'OpenCV \uC790\uB3D9 \uCE98\uB9AC\uBE0C\uB808\uC774\uC158', '24\uAC1C+ \uBAA8\uB4C8 \uC591\uC0B0', '\uACF5\uACF5\uAE30\uAD00 \uB0A9\uD488, \uC778\uB3C4\uB124\uC2DC\uC544 \uC218\uCD9C'], link: '/projects/spody/', off: { x: -1.8, z: 0 }, minigame: 'spody' },
  { co: 'Overworld (19-22)', title: 'Math Master', sub: '\uBBF8\uB85C \uD0C8\uCD9C', period: '2021.06 - 2022.06', role: '\uAC8C\uC784 \uB85C\uC9C1 \uAC1C\uBC1C', badge: null, bc: null, color: 0xff6b9d, coHex: '#ff6b9d', desc: '\uCD08\uB4F1 \uC218\uD559 \uB77C\uC774\uBE0C \uC11C\uBE44\uC2A4. Recursive Backtracker + A* \uC54C\uACE0\uB9AC\uC998.', tags: ['Unity', 'C#'], details: ['Recursive Backtracker \uBBF8\uB85C \uC0DD\uC131', 'A* \uCD5C\uB2E8 \uACBD\uB85C \uD0D0\uC0C9', '\uBD84\uC218 \uB3C4\uBA54\uC778 \uD0C0\uC785 \uC124\uACC4', '\uC790\uCCB4 Tween \uB77C\uC774\uBE0C\uB7EC\uB9AC'], link: '/projects/math-master/', off: { x: 0, z: 1.5 }, minigame: 'maze' },
  { co: 'Overworld (19-22)', title: '\uB8E8\uBE44\uC758 \uBAA8\uD5D8', sub: '3D \uC561\uC158 RPG', period: '2019.09 - 2019.11', role: '\uAE30\uD68D, \uC124\uACC4, \uAD6C\uD604 (1\uC778)', badge: '\uC6B0\uC218\uC0C1', bc: '#ff6b9d', color: 0xff6b9d, coHex: '#ff6b9d', desc: '1\uC778 \uAC1C\uBC1C 3D \uC561\uC158 RPG. \uC878\uC5C5\uC804\uC2DC \uC6B0\uC218\uC0C1.', tags: ['Unity', 'C#', 'NavMesh', 'Timeline'], details: ['5-state FSM \uD50C\uB808\uC774\uC5B4', '\uCF64\uBCF4 + \uC2A4\uD0AC 3\uC885', 'NavMesh AI + \uC720\uB3C4\uD0C4 \uB9C8\uBC95\uC0AC', 'ScriptableObject \uC778\uBCA4\uD1A0\uB9AC'], link: '/projects/ruby-adventure/', off: { x: 1.8, z: 0 }, minigame: 'ruby' },
];