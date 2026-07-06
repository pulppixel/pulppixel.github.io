// 터미널 포트폴리오 콘텐츠. claude.ai/design "Pulppixel LazyGit" 안을 바닐라로 옮기면서
// 프로젝트를 11개(+이음·PEEKAR=13)로 확장. 색상은 Rosé Pine 팔레트.
// 원본 .dc.html 의 DATA 구조를 1:1 로 유지 → 엔진(terminal.ts)이 그대로 소비.

export const C = {
  fg: '#cdc9de', dim: '#6e6a86', faint: '#524f67',
  foam: '#9ccfd8', iris: '#c4a7e7', gold: '#f6c177',
  love: '#eb6f92', rose: '#ebbcba', white: '#e0def4',
} as const;

export interface ProjectLong {
  role: string;
  play?: string;
  image?: string;
  stack: string[];
  overview: string;
  sections: { title: string; items: string[] }[];
  progress: { t: string; done: boolean }[];
}
export interface ProjectItem {
  icon?: string; label: string; meta: string;
  name: string; sub: string; period: string;
  badge: string; badgeColor: string;
  desc: string; stack: string[]; points: string[];
  url?: string; play?: string; long?: ProjectLong;
}
export interface JobItem {
  icon?: string; label: string; meta: string;
  company: string; role: string; period: string; dur: string;
  desc: string; points: string[];
}
export interface SkillItem {
  icon?: string; label: string; meta?: string;
  title: string; sub: string; rows: { k: string; v: string }[];
}
export interface ContactItem {
  icon?: string; label: string; meta?: string;
  value: string; cta: string; note: string; url: string;
}
export interface ProfileItem { icon?: string; label: string; meta?: string; }

export type PanelKind = 'profile' | 'project' | 'job' | 'skill' | 'contact';
export interface Panel {
  key: string; title: string; kind: PanelKind;
  items: (ProfileItem | ProjectItem | JobItem | SkillItem | ContactItem)[];
}

const I = C.iris, G = C.gold, F = C.foam, L = C.love, R = C.rose;

export const DATA: Panel[] = [
  { key: '1', title: 'Profile', kind: 'profile', items: [{ label: 'whoami' }] },

  { key: '2', title: 'Projects', kind: 'project', items: [
    { label: 'eterna', meta: '25.11', name: 'ETERNA', sub: '아고라 시스템 (디스코드형 소셜)', period: '2025.11 — 2026.04', badge: 'ARCHITECT', badgeColor: I,
      desc: '디스코드와 유사한 실시간 커뮤니티 "아고라" 시스템. Service / Repository / State 3계층 아키텍처를 설계하고, 소프트런칭에 필요한 소셜 기능 전체를 단독으로 구현했습니다.',
      stack: ['Unity', 'C#', 'R3', 'UniTask', 'Tencent IM', 'FlatBuffers'],
      points: ['3계층 아키텍처 설계와 팀 컨벤션 정립', '아고라 생성 · 알림 · 검색 · 권한 전체 구현', '크로스플랫폼 STT · 한글 조합 커스텀 InputField', 'UaaL 양방향 통신 POC 검증'],
      url: '/projects/eterna/' },

    { label: 'ieum', meta: '26.03', name: '이음작명소', sub: '신생아 작명 웹서비스', period: '2026.03 — 현재', badge: 'LIVE', badgeColor: F,
      desc: '훈민정음 해례본의 원리에 근거해 이름을 짓는 신생아 작명 웹서비스. 같은 정보를 넣으면 언제나 같은 결과가 나오도록 설계해, 작명의 근거를 투명하게 보여줍니다. 기획부터 운영까지 동글랩에서 맡고 있습니다.',
      stack: ['Next.js', 'React', '.NET', 'TypeScript', 'PostgreSQL'],
      points: ['훈민정음 해례본 기반 작명 로직', '같은 정보 → 동일 결과 보장', '결제 · 온보딩 · 운영까지 담당'],
      url: 'https://ieum-name.kr' },

    { label: 'peekar', meta: '26.04', name: 'PEEKAR', sub: 'WebAR 갤러리 플랫폼 (B2B)', period: '2026.04 — 현재', badge: 'B2B', badgeColor: L,
      desc: '갤러리 운영자가 작품 이미지와 오버레이 영상을 등록하면, 관람객이 QR로 진입해 카메라로 작품을 비추는 순간 영상이 겹쳐 재생되는 WebAR 갤러리 플랫폼. 앱 설치 없이 브라우저만으로 동작하며, 동글랩에서 운영하는 B2B 서비스입니다.',
      stack: ['Next.js', 'Supabase', 'MindAR.js', 'WebAR', 'TypeScript'],
      points: ['MindAR 이미지 타깃 트래킹', '운영자용 작품 · 영상 등록 CMS', 'QR 진입 → 모바일 AR 뷰어'],
      url: 'https://peekar.kr' },

    { label: 'reiw', meta: '25.06', name: 'REIW', sub: '3D 메타버스', period: '2025.06 — 2025.11', badge: 'SUB-LEAD', badgeColor: F,
      desc: '채팅·친구 시스템을 메타버스 규모에 맞춰 구조적으로 재설계하고, 6면 스냅 하우징과 DataTable 통합 에디터 툴을 개발했습니다. ETERNA 3계층 아키텍처의 토대가 된 프로젝트입니다.',
      stack: ['Unity', 'C#', 'R3', 'UniTask', 'DOTween'],
      points: ['메타버스 규모 채팅 · 친구 시스템 재설계', '6면 스냅 기반 하우징 (배치 · 편집 · Undo/Redo)', 'NPC 퀘스트 시스템 · DataTable 통합 에디터 툴'],
      url: '/projects/reiw/' },

    { label: 'iw-zombie', meta: '25.02', name: 'IW Zombie', sub: '팀 서바이벌', period: '2025.02 — 2025.06', badge: 'TEAM', badgeColor: F,
      desc: '일본 출시를 목표로 한 팀 서바이벌 게임. 탐색부터 생존 판정까지 5단계 게임 루프 전반을 구현하고, 팀 최초로 Tencent IM 채팅을 도입했습니다.',
      stack: ['Unity', 'C#', 'Tencent IM', 'DOTween'],
      points: ['5단계 게임 루프 Server-side FSM 구현', 'Tencent IM 채팅 첫 도입', '3D 사운드 풀링 · 범용 디버그 치트 시스템'],
      url: '/projects/iw-zombie/' },

    { label: 'nine-to-six', meta: '24.06', name: 'Nine to Six', sub: 'Frenzy Circle · 텔레그램 미니게임', period: '2024.06 — 2024.10', badge: 'WEBGL', badgeColor: F,
      desc: 'TON 생태계를 겨냥한 텔레그램(WebGL) 미니게임. 텔레그램 계정 로그인부터 코인 밈 테마, 일·주·월간 랭킹까지 게임 전체를 처음부터 설계했습니다.',
      stack: ['Unity', 'C#', 'WebGL'],
      points: ['텔레그램 계정 연동 로그인 (.jslib interop)', '코인 밈 테마 · 일 / 주 / 월간 랭킹', 'WebGL 빌드 최적화'],
      url: '/projects/frenzy-circle/', play: '/play/ninetosix/' },

    { label: 'stelsi-wallet', meta: '23.02', name: 'STELSI Wallet', sub: '이더리움 HD 지갑', period: '2023.02 — 2023.08', badge: 'SOLO', badgeColor: I,
      desc: 'Unity에서 Flutter로의 스택 전환을 MVP 비교 검증으로 제안해 채택시켰습니다. web3dart + ABI로 ERC-20 / NFT를 연동한 이더리움 HD 지갑을 1인 개발해 양대 스토어에 출시했습니다.',
      stack: ['Flutter', 'Dart', 'Riverpod', 'web3dart', 'BIP39/44'],
      points: ['스택 전환 제안 → MVP 비교 검증 → 채택', 'BIP39/44 HD 지갑 (10개 주소 파생)', 'ERC-20 / NFT 연동 · SecureStorage 암호화', '양대 스토어 출시 완료'],
      url: '/projects/stelsi-wallet/' },

    { label: 'stelsi', meta: '23.08', name: 'STELSI', sub: 'UE5 메타버스', period: '2023.08 — 2024.12', badge: 'UE5', badgeColor: R,
      desc: 'UE5 메타버스 프로젝트에 중간 합류. Bink2 기반 인게임 영상 재생과 6면 큐브맵을 360 파노라마로 변환하는 촬영 툴을 제작하고, 외주 개발사와의 협업을 관리했습니다.',
      stack: ['Unreal Engine 5', 'C++', 'Bink2'],
      points: ['Bink2 기반 인게임 영상 재생 시스템', 'SceneCapture2D 6면 큐브맵 → 360 파노라마 촬영 툴', '외주 개발사 일정 · 품질 관리'],
      url: '/projects/stelsi/' },

    { label: 'nomads', meta: '23.06', name: 'Nomads Planet', sub: '멀티플레이어 메타버스', period: '2023.06 — 2023.09', badge: 'AWARD', badgeColor: L,
      desc: 'Unity Netcode + Vivox 기반 멀티플레이어 차량 메타버스. 매치메이킹부터 Dedicated Server까지 1인으로 구축해 K-메타버스 경진대회 장려상을 수상했습니다.',
      stack: ['Unity', 'C#', 'Netcode', 'Vivox'],
      points: ['3-Singleton 아키텍처 (Client / Host / Server)', 'Matchmaker + Backfill 전 단계 직접 구현', 'NPC 교통 FSM · 실시간 리더보드'],
      url: '/projects/nomads-planet/', play: '/play/nomads/' },

    { label: 'math-master', meta: '21.06', name: 'Math Master', sub: '초등 수학 라이브 서비스', period: '2021.06 — 2022.06', badge: 'LIVE', badgeColor: F,
      desc: 'SKT ZEM 기본앱에 선정된 초등 수학 라이브 서비스. 분수 도메인 타입과 미로 생성·탐색 알고리즘, 자체 Tween 라이브러리를 설계했습니다.',
      stack: ['Unity', 'C#', 'UGUI', 'UniRx'],
      points: ['분수(Fraction) 도메인 타입 설계 — 연산 · 약분 · 채점', 'Recursive Backtracker 미로 생성 + A* 탐색', '자체 Tween 라이브러리(BTweener)'],
      url: '/projects/math-master/', play: '/play/maze/' },

    { label: 'spody', meta: '20.01', name: 'SPODY', sub: 'XR 유아 교육', period: '2020.01 — 2021.06', badge: 'SOLO→LEAD', badgeColor: I,
      desc: '깊이 센서와 OpenCV로 바닥 투사면의 터치를 인식하는 XR 유아 교육 콘텐츠. 1인 개발로 시작해 양산 체계를 갖추고, 유치원·공공기관 납품과 인도네시아 수출까지 이어갔습니다.',
      stack: ['Unity', 'C#', 'OpenCV', 'Kinect', 'ASTRA'],
      points: ['깊이 센서 → UI 터치 변환 파이프라인', 'OpenCV 자동 캘리브레이션 — 비개발자도 현장 세팅', '25개+ 모듈 양산 · 공공기관 납품 · 인도네시아 수출'],
      url: '/projects/spody/', play: '/play/spody/' },

    { label: 'ruby', meta: '19.09', name: '루비의 모험', sub: '3D 액션 RPG', period: '2019.09 — 2019.11', badge: 'AWARD', badgeColor: L,
      desc: '기획부터 구현까지 1인 개발한 졸업작품 3D 액션 RPG. 졸업전시 우수상을 수상하고, 졸업생 대표로 재학생 대상 발표를 진행했습니다.',
      stack: ['Unity', 'C#', 'NavMesh', 'Timeline'],
      points: ['5-state 커스텀 FSM 플레이어 컨트롤러', '콤보 전투 + 스킬 3종', 'NavMesh AI · 유도탄 마법사 · ScriptableObject 인벤토리'],
      url: '/projects/ruby-adventure/', play: '/play/ruby/' },
  ] },

  { key: '3', title: 'Experience', kind: 'job', items: [
    { label: 'Dongle Lab', meta: '26–', company: 'Dongle Lab (동글랩)', role: '1인 스튜디오 · 개인사업자', period: '2026.03 — 현재', dur: 'now',
      desc: '기획·개발·운영을 모두 직접 하는 1인 스튜디오. 아이디어를 실제 서비스로 만들고, 만든 뒤에도 끝까지 책임지는 일에 집중합니다.',
      points: ['이음작명소 — 신생아 작명 웹서비스', 'PEEKAR — WebAR 갤러리 플랫폼 (B2B)'] },
    { label: 'VOYAGER', meta: '25–26', company: 'VOYAGER', role: 'Unity Client Engineer · 서브 리드', period: '2025.02 — 2026.04', dur: '1Y 3M',
      desc: '실시간 소셜·메타버스 프로젝트의 클라이언트 아키텍처를 설계하고, 서브 리드로 팀의 개발 컨벤션을 정립하며 팀을 이끌었습니다.',
      points: ['ETERNA — 아고라 시스템', 'REIW — 3D 메타버스', 'IW Zombie — 팀 서바이벌'] },
    { label: 'VERS.', meta: '22–24', company: 'VERS.', role: 'Unity / Flutter / UE5 Client Developer', period: '2022.06 — 2024.12', dur: '2Y 7M',
      desc: 'Unity·Flutter·UE5를 넘나들며 블록체인 지갑, 메타버스, 텔레그램 게임을 각각 출시까지 책임졌습니다.',
      points: ['STELSI Wallet — 블록체인 지갑', 'STELSI — UE5 메타버스', 'Nine to Six — 텔레그램 게임'] },
    { label: 'Math Master', meta: '21–22', company: 'Math Master', role: 'Unity Client Developer', period: '2021.06 — 2022.06', dur: '1Y 1M',
      desc: '초등 수학 교육 게임 클라이언트를 개발해 SKT ZEM 플랫폼에 납품했습니다.',
      points: ['일프로연산 (SKT ZEM 납품 · 구글 창구 선정)'] },
    { label: 'VVR', meta: '20–21', company: 'VVR', role: 'Unity XR Developer · 초기 1인', period: '2020.01 — 2021.06', dur: '1Y 6M',
      desc: '초기 1인 개발자로 합류해 XR 유아 교육 콘텐츠를 제품화하고, 양산 체계까지 만들었습니다.',
      points: ['SPODY — XR 유아 교육 (인도네시아 수출)'] },
  ] },

  { key: '4', title: 'Skills', kind: 'skill', items: [
    { label: 'engine', title: 'Engine & Language', sub: '주력 엔진과 언어',
      rows: [{ k: 'Unity (C#)', v: '6Y · main' }, { k: 'Unreal Engine 5 (C++)', v: 'shipped' }, { k: 'Godot 4 (.NET/GDScript)', v: 'current' }, { k: 'Flutter (Dart)', v: 'shipped' }] },
    { label: 'architecture', title: 'Architecture & Network', sub: '클라이언트 설계와 실시간 네트워크',
      rows: [{ k: 'Service / Repository / State', v: 'pattern' }, { k: 'VContainer · R3 · UniTask', v: 'DI / Rx' }, { k: 'Netcode (NGO) · Tencent IM', v: 'realtime' }, { k: 'FlatBuffers · gRPC · LiteNetLib', v: 'transport' }] },
    { label: 'web-tools', title: 'Web & Workflow', sub: '웹 스택과 개발 워크플로',
      rows: [{ k: 'Next.js · React · TypeScript', v: 'web' }, { k: 'Supabase · ASP.NET · PostgreSQL', v: 'backend' }, { k: 'Git (Flow · Submodule)', v: 'vcs' }, { k: 'WebGL · UaaL · Native Bridge', v: 'embed' }] },
  ] },

  { key: '5', title: 'Contact', kind: 'contact', items: [
    { label: 'email', value: 'devenvy100@gmail.com', cta: '메일 보내기', note: '협업·채용 제안부터 가벼운 질문까지 모두 환영합니다. 가장 빠르게 답하는 채널입니다.', url: 'mailto:devenvy100@gmail.com' },
    { label: 'github', value: 'github.com/pulppixel', cta: 'GitHub 열기', note: '작업물과 크고 작은 실험들을 공개해 두었습니다.', url: 'https://github.com/pulppixel' },
    { label: 'linkedin', value: 'in/hwankee-baik', cta: 'LinkedIn 열기', note: '경력과 프로젝트 이력을 시간순으로 정리해 두었습니다.', url: 'https://www.linkedin.com/in/hwankee-baik-272948266/' },
  ] },
];

export const BOOT = [
  { t: '❯', m: 'pulppixel', c: C.white },
  { t: '·', m: 'opening repository ~/portfolio', c: '#908caa' },
  { t: '·', m: 'loading refs · 13 projects · 5 companies', c: '#908caa' },
  { t: 'ok', m: 'ready', c: C.foam },
];
