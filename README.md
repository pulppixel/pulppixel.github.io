# pulppixel.github.io

Game Client Engineer 포트폴리오 사이트.
Astro 정적 빌드 + Three.js 3D 씬 + Canvas 2D 미니게임으로 구성.

- **Live**: https://pulppixel.github.io
- **Author**: HWANKEE BAIK · `devenvy100@gmail.com`
- **Stack**: Astro / Three.js / TypeScript / Supabase

---

## Table of Contents

1. [구성](#구성)
2. [Tech Stack](#tech-stack)
3. [사이트 맵](#사이트-맵)
4. [Local Development](#local-development)
5. [디렉토리 구조](#디렉토리-구조)
6. [3D World](#3d-world)
7. [Performance Tier System](#performance-tier-system)
8. [Time / Weather / Season](#time--weather--season)
9. [Audio System](#audio-system)
10. [Mobile Optimization](#mobile-optimization)
11. [Minigames](#minigames)
12. [Leaderboard](#leaderboard)
13. [Guestbook](#guestbook)
14. [Featured Projects](#featured-projects)
15. [Performance Journey](#performance-journey)
16. [Credits](#credits)
17. [License](#license)

---

## 구성

사이트는 두 개의 진입점을 가집니다.

**Classic** (`/`) - 정적 포트폴리오. 프로젝트 카드 11개, 경력 타임라인,
기술 스택, 학력, 수상 내역. Astro로 사전 렌더링되며 JS는 거의 없습니다.

**3D Explore** (`/explore/`) - Three.js 풀스크린 씬. 4개의 zone에 프로젝트
큐브가 배치되어 있고, 캐릭터로 걸어가서 `E`로 상호작용합니다. 일부 큐브는
상세 패널을 열고, 일부는 해당 프로젝트의 핵심 메커닉을 단순화한 Canvas 2D
미니게임을 실행합니다.

두 진입점은 우측 상단의 `classic view` / 사이트 상단의 `3D Explore`
링크로 양방향 이동 가능합니다.

---

## Tech Stack

| Layer       | Choice                                      |
|-------------|---------------------------------------------|
| Framework   | Astro 6 (`output: 'static'`)                |
| 3D          | Three.js r170 (vanilla, 별도 엔진 없음)        |
| Minigames   | Canvas 2D, 외부 라이브러리 0개                  |
| Backend     | Supabase REST (leaderboard / guestbook)     |
| Audio       | Web Audio API (procedural, asset 0개)        |
| Fonts       | Pretendard Variable, JetBrains Mono         |
| Hosting     | GitHub Pages (Actions 자동 배포)               |
| Build       | `astro build`, `@astrojs/sitemap`           |

설계 원칙은 "가벼운 정적 사이트". React/Vue 없음, 3D 모델 파일 없음
(전부 Three.js primitive로 조립), 사운드 파일 없음 (Web Audio API로 합성),
이미지는 프로젝트 상세 페이지의 스크린샷/YouTube embed가 전부.

---

## 사이트 맵

```
/                                  Classic 포트폴리오
/explore/                          3D 월드 (풀스크린, BaseLayout 미사용)
/leaderboard/                      미니게임 리더보드
/guestbook/                        방명록
/projects/{slug}/                  프로젝트 상세 (x11)
/projects/{slug}/play/{key}/       미니게임 풀스크린 (x7, 정적 빌드)
```

프로젝트 slug: `eterna`, `reiw`, `iw-zombie`, `stelsi-wallet`, `stelsi`,
`frenzy-circle`, `haul`, `nomads-planet`, `math-master`, `spody`,
`ruby-adventure`.

리더보드와 방명록은 두 경로로 접근 가능합니다. 전용 페이지(`/leaderboard/`,
`/guestbook/`)와 3D 씬 내부 인터랙션. 3D 씬에서는 ETERNA 큐브 근처에서 `E`,
또는 우측 상단 별 / 연필 버튼으로 호출됩니다. 동일한 Supabase 테이블을
공유합니다.

---

## Local Development

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # ./dist/
npm run preview
```

요구사항: Node.js 20+. 환경변수 없음 (Supabase publishable key는
RLS로 보호되어 클라이언트에 직접 포함).

**Performance tier 강제 (디버깅용)**:

```
/explore/?perf=low
/explore/?perf=medium
/explore/?perf=high
```

자동 GPU 감지 + FPS 모니터링을 우회합니다. 자세한 동작은 Performance
섹션 참고.

---

## 디렉토리 구조

```
src/
├── pages/                              Astro 라우트
│   ├── index.astro                     Classic 포트폴리오
│   ├── explore.astro                   3D 씬 진입 (풀스크린)
│   ├── leaderboard.astro
│   ├── guestbook.astro
│   └── projects/
│       ├── {slug}.astro                프로젝트 상세 x11
│       └── {slug}/play/[key].astro     미니게임 풀스크린 (정적 라우트 7개)
├── layouts/
│   ├── BaseLayout.astro
│   └── ProjectLayout.astro
├── components/                         Hero, Nav, Footer, ProjectCard, YouTube
└── scripts/                            TypeScript: 3D 월드 + 미니게임
    ├── main.ts                         3D 씬 entry point
    ├── core/                           data, performance, input, helpers, collision
    ├── world/                          scene, terrain, sky, ocean, zones,
    │                                   time/weather/seasons, particles, wind
    ├── entity/                         character, npcs, animals, interactions
    ├── system/                         audio, postfx, ui, collectibles
    └── minigames/                      spody, maze, ruby, circles, nomads,
                                        haul, guestbook, leaderboard, base
code-samples/                           별도 repo로 분리한 Unity C# 코드 샘플
```

---

## 3D World

`/explore/`는 Three.js로 만든 작은 등산형 월드입니다. main entry는
`src/scripts/main.ts`이고, 여기서 모든 시스템(scene, character, zones,
NPCs, animals, time/weather, audio, particles)을 조립합니다.

씬은 4개의 zone(섬)으로 구성되며, 각 zone은 특정 시기/회사를 나타냅니다.
플레이어는 spawn 지점에서 시작해 점프 플랫폼을 타고 점진적으로 위로
올라가는 구조입니다.

### 지형: 등산형 플랫폼 배치

`src/scripts/core/data.ts`의 `PLATFORMS` 배열이 모든 발판을 정의합니다.
높이는 spawn에서 정상으로 갈수록 단조 증가합니다.

```
Spawn (h=1)
  -- Hub (h=4) -- East: Treasure Isle (h=9)   : 2023년 zone
              |-- West: The Nether (h=8)      : 2025-26년 zone
              |-- North Summit: Beacon Peak (h=12)
                                              : 2026년 진행중 (HAUL)
```

플랫폼 배치는 점프 물리에 맞춰 역산되었습니다.

```ts
// main.ts
const JUMP_FORCE = 9.6;
const GRAVITY = -18.9;
// max jump height ~ 2.44

const STEP_H = 0.35;  // 자동 step-up 허용 범위
```

`max jump ~ 2.44`이고 인접 플랫폼 간 높이 차는 모두 1.5 미만으로
제한되어 있어, 어떤 zone도 막다른 길 없이 도달 가능합니다. 작은 단차는
`STEP_H = 0.35` 이하이면 점프 없이 자동으로 올라갑니다.

`getGroundHeight(x, z)`는 특정 좌표에서 가장 높은 겹치는 플랫폼을 반환하고,
`getSurface(x, z)`는 플랫폼 폭으로부터 표면 종류를 추론합니다.

```ts
// w >= 14 -> grass   (큰 섬)
// w >=  5 -> stone   (중간 발판)
// else    -> wood    (좁은 점프 플랫폼)
```

이 표면 종류는 발소리 합성에 그대로 사용됩니다 (Audio 섹션 참고).

### Zones

4개의 zone이 있습니다 (`COMPANIES` in `data.ts`).

| Zone           | 좌표        | 색상      | 시기      | 담긴 프로젝트                              |
|----------------|-------------|-----------|-----------|--------------------------------------------|
| Overworld      | (0, -18)    | `#ff6b9d` | 2019-22   | SPODY, Math Master, 루비의 모험             |
| Treasure Isle  | (28, -40)   | `#6ee7b7` | 2023      | STELSI Wallet, Nomads Planet, Nine to Six  |
| The Nether     | (-28, -40)  | `#a78bfa` | 2025-26   | ETERNA, REIW, IW Zombie                    |
| Beacon Peak    | (0, -58)    | `#fbbf24` | 2026~     | HAUL (in progress)                          |

각 zone은 기둥(pillar) + 바닥 ring + 색상 light를 가지며, 플레이어가
다가가면 ring opacity와 light intensity가 부드럽게 올라갑니다. 처음으로
zone에 진입하는 순간 `burstRing`이 확장되며 한 번 펄스합니다.

```ts
// zones.ts
const prox = clamp01((ZONE_R - dist) / (ZONE_R - ZONE_IN));
z.proximity += (prox - z.proximity) * 4 * dt;  // 부드러운 lerp
const isIn = z.proximity > 0.85;
if (isIn && !z.active) {
  z.active = true;
  z.activationTime = t;  // burst 트리거
}
```

이 `proximity` 값은 zone 내부의 모든 장식 요소(crystal, emerald 등)
애니메이션 강도에도 곱해집니다. zone에서 멀어지면 장식이 작아지고,
가까워지면 부풀어오르며 회전이 빨라지는 식입니다.

### Project Cubes

11개 프로젝트가 4개 zone에 분산되어 큐브 형태로 떠 있습니다. 큐브 정의는
`PROJECTS` in `data.ts`이며, 각 프로젝트는 zone 중심으로부터의 offset
(`off: { x, z }`)으로 배치됩니다.

큐브 애니메이션 (`zones.ts`의 update 루프):

```ts
const zp = zones[zi].proximity;          // zone 활성화 정도
const isNearest = m === nearestMesh;     // 카메라 ray와 가장 가까운지

// scale: zone에서 멀면 거의 안 보이고, 가까우면 등장.
// 추가로 nearest cube는 1.35x 강조.
const baseScale = 0.05 + zp * 0.95;
const ts = isNearest ? baseScale * 1.35 : baseScale;
m.scale.lerp(ts, 0.08);

// y bobbing + y축 회전
m.position.y = baseY + Math.sin(t * 1.5 + idx * 0.8) * 0.18 * zp;
m.rotation.y = t * 0.5 * (0.2 + zp * 0.8);

// emissive: nearest는 4Hz 펄스, 그 외는 zone proximity에 비례
const tei = isNearest ? 0.7 + Math.sin(t * 4) * 0.25 : 0.02 + zp * 0.45;
mat.emissiveIntensity += (tei - mat.emissiveIntensity) * 0.1;
```

요약하면 zone에 들어가면 큐브들이 등장하면서 떠다니고 회전하며,
조준한 큐브 하나는 추가로 펄스합니다. `E`를 누르면 해당 프로젝트의
패널이 우측에서 슬라이드되거나, `minigame` 필드가 정의되어 있으면
미니게임이 실행됩니다.

`PROJECTS[i].minigame` 매핑:

```
ETERNA          -> guestbook    (Supabase 방명록)
Nomads Planet   -> nomads       (범퍼카)
Nine to Six     -> ninetosix    (Frenzy Circle)
HAUL            -> haul         (1-hit 플랫포머)
SPODY           -> spody        (타겟 슈팅)
Math Master     -> maze         (미로)
루비의 모험      -> ruby         (탑다운 ARPG)
```

매핑이 없는 프로젝트(REIW, IW Zombie, STELSI Wallet, STELSI UE5)는
패널만 열리고, "View detail page" 링크로 `/projects/{slug}/`로 이동합니다.

### NPCs

`src/scripts/entity/npcs.ts`. 4-state FSM으로 동작하는 휴머노이드
NPC들입니다.

```
idle --+--> wander  (랜덤 방향, 일정 거리 후 idle)
       +--> alert   (플레이어 감지, 회전해서 바라봄)
                +--> talk  (E 거리 진입, 말풍선 표시)
```

각 NPC는 `wanderRadius` 내에서 wander하고, 다리(legs) 메시가 walk
animation을 가지며, 머리에 액세서리가 붙습니다 (`guide`, `straw`,
`pirate`, `sage`, `crown`).

말풍선은 3D -> 2D screen projection으로 매 프레임 위치를 갱신하지만,
CSS transition을 쓰지 않고 JS에서 수동 보간합니다. 이유는 CSS transition을
쓰면 플레이어가 움직일 때마다 transition이 reset되어 떨림이 생기기
때문입니다 (코드 주석에 명시되어 있음).

가장 첫 NPC는 spawn 근처의 "안내자"로, 기본 조작법을 알려줍니다.

### Animals

`src/scripts/entity/animals.ts`. 분위기를 채우는 동물들. 각 종은 다른
state machine을 가집니다.

**Rabbit** - 4-state FSM (`idle` / `hop` / `alert` / `flee`).
`homeX/Z`를 중심으로 `range` 내에서 hop하고, 플레이어가 가까워지면
alert를 거쳐 flee 상태로 도망갑니다.

**Bird** - perch / fly / glide. 나무나 zone 기둥에 앉아 있다가
주기적으로 이륙해 한 바퀴 돌고 다시 착륙합니다.

**Butterfly** - figure-8 궤적을 따라 정해진 위치 주변을 비행.

`src/scripts/entity/interactions.ts`에서 동물 위치를 추적해서, 플레이어가
가까이 가면 머리 위에 작은 이모지 말풍선을 띄웁니다. 이모지 텍스처는
canvas에서 한 번 렌더한 뒤 `EMOJI_CACHE`에 저장해 재사용합니다.

```ts
// interactions.ts
state: 'hidden' -> 'appearing' -> 'visible' -> 'fading'
```

말풍선은 동물의 group 위치를 따라가지만 alpha만 lerp되도록 분리되어 있어,
부드럽게 페이드 인/아웃합니다.

### Quest Log (Teleport)

좌측 상단의 `TELEPORT` 패널은 8개 zone 방문 진행도를 추적합니다.
방문한 zone은 `localStorage`에 저장되며 다음 접속 시에도 유지됩니다.
`reset` 버튼으로 초기화 가능. 각 항목을 클릭하면 해당 zone으로 워프합니다
(걷기 귀찮을 때 + 모바일 사용자용).

### 캐릭터와 컨트롤

플레이어 캐릭터는 5종 스킨을 가집니다 (Bunny / Frog / Bear / Robot /
Penguin). 우측 하단 settings 패널에서 즉시 교체 가능. 스킨 교체 시
파티클 색상과 dust 색상도 함께 tint됩니다 (`applySkinPalette`).

**데스크탑**:

| Key       | Action        |
|-----------|---------------|
| `WASD`    | 이동           |
| `Shift`   | 달리기 (1.7x) |
| `Space`   | 점프           |
| `Mouse`   | 카메라 회전    |
| `E`       | 상호작용       |

**모바일**:

화면이 상하로 분할됩니다. 하단 절반은 가상 조이스틱(터치한 곳에서
joystick base가 나타남), 상단 절반은 카메라 드래그. 우측 하단에 점프
버튼과 interact 버튼이 떠 있고, 큐브에 가까워지면 interact 버튼이
활성화됩니다.

```ts
// main.ts
const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)
              || navigator.maxTouchPoints > 1;
```

### Settings 패널 (`#tw-panel`)

좌측 하단의 `+` 버튼을 누르면 펼쳐지는 패널. 토글 가능 항목:

- **Time** - `auto` / `dawn` / `day` / `sunset` / `night`
- **Weather** - `clear` / `rain` / `snow`
- **Season** - `spring` / `summer` / `autumn` / `winter`
- **Character** - Bunny / Frog / Bear / Robot / Penguin

`Time`의 `auto`는 클라이언트의 실제 시각을 4개 프리셋 사이로 보간합니다
(Time / Weather / Season 섹션 참고).

---

## Performance Tier System

`src/scripts/core/performance.ts`. 디바이스 성능에 맞춰 렌더링 옵션을
3단계로 조정합니다. 목표는 모바일/저사양에서도 30fps 이상 유지.

### 3-Tier Preset

```ts
type PerfTier = 'high' | 'medium' | 'low';
```

각 tier는 다음 옵션을 결정합니다.

| Option           | high  | medium | low   |
|------------------|-------|--------|-------|
| bloom (postFX)   | on    | off    | off   |
| shadows          | on    | on     | off   |
| shadowMapSize    | 1024  | 512    | 0     |
| pointLights      | on    | on     | off   |
| particleMul      | 1.0   | 0.5    | 0.25  |
| oceanSegments    | 80    | 48     | 24    |
| phase2Decor      | on    | on     | off   |
| maxPixelRatio    | 2     | 1.5    | 1     |
| edgeWireframes   | on    | on     | off   |
| throttleSkip     | 1     | 2      | 4     |

`particleMul`은 모든 파티클 시스템이 spawn count에 곱하는 multiplier이고,
`throttleSkip`은 매 N프레임마다 한 번씩만 갱신하는 시스템(seasons,
animal interaction, wind 등)에서 참조됩니다. low tier는 4프레임에 한 번
갱신하고 dt를 4배로 보정해 자연스럽게 보이도록 합니다.

`pointLights` 플래그는 모바일에서 특히 중요합니다. forward rendering에서
PointLight는 fragment shader cost가 빠르게 폭증하므로, low tier는
PointLight를 0개로 만들고 ambient + hemi + directional만으로 조명을
구성합니다.

### 자동 감지 흐름

```ts
// 1. 임시 canvas로 GPU 문자열 얻기
const gl = canvas.getContext('webgl');
const gpu = gl.getExtension('WEBGL_debug_renderer_info')
              .getParameter(UNMASKED_RENDERER_WEBGL).toLowerCase();

// 2. 모바일이면 무조건 low
if (isMobile) return 'low';

// 3. GPU 문자열 매칭
if (gpu.includes('intel'))   return gpu.includes('arc') ? 'medium' : 'low';
if (gpu.includes('mali|adreno|powervr'))     return 'low';
if (gpu.includes('apple'))   return /m[1-9]/.test(gpu) ? 'high' : 'medium';
if (gpu.includes('nvidia|geforce|rtx|gtx'))  return 'high';
if (gpu.includes('radeon|amd'))              return 'high';
return 'medium';

// 4. GPU 정보가 없으면 hardwareConcurrency / deviceMemory로 추정
//    Intel Mac OS X는 별도로 감지해서 low로
```

### FPS 자동 다운그레이드

GPU 추정만으로는 부족합니다. 실제로 돌려보고 느리면 한 단계 내리는 로직이
있습니다.

```ts
export function startFpsMonitor(onDowngrade) {
  if (perf.tier === 'low') return;  // 더 내릴 곳 없음

  // 첫 6초 동안 2초 간격으로 3개 sample 수집
  // 평균 FPS가 22 미만이면 한 단계 다운그레이드
  // 결과는 sessionStorage에 저장 -> 다음 로드부터 즉시 적용
}
```

`high -> medium -> low` 순으로 한 단계씩만 내리고, 결과는 세션이
유지되는 동안 캐시됩니다. 새로 고침해도 반복 측정하지 않습니다.

### URL Override

디버깅용으로 자동 감지를 우회할 수 있습니다.

```
/explore/?perf=low
/explore/?perf=medium
/explore/?perf=high
```

이 파라미터가 있으면 GPU 감지와 FPS 모니터를 모두 건너뜁니다.

---

## Time / Weather / Season

`src/scripts/world/timeweather.ts`, `src/scripts/world/seasons.ts`.

이 두 시스템은 독립적으로 동작합니다. 시간/날씨는 조명/안개/하늘 색을
바꾸고, 계절은 식물(잎/꽃/풀) 색을 tint합니다. 두 시스템은 곱집합으로
조합 가능합니다 (예: "겨울 + 눈 + 밤", "가을 + 비 + 새벽").

### Time of Day

4개의 프리셋이 있습니다.

```ts
type TimeName = 'auto' | 'dawn' | 'day' | 'sunset' | 'night';
```

각 프리셋은 다음 값들의 묶음입니다 (`interface P`).

- `skyTop / skyMid / skyBot / bg` (4단계 그라디언트 + 배경색)
- `sunCol / sunI / sunPos` (directional light)
- `ambCol / ambI` (ambient light)
- `hemiSky / hemiGnd / hemiI` (hemisphere light)
- `fillCol / fillI` (보조 directional)
- `fogCol / fogD` (exponential fog)
- `starOp` (밤하늘 별 opacity)
- `exposure` (renderer toneMappingExposure)
- `waterDeep / waterShallow` (바다 색)

수동 선택 시 0.5초에 걸쳐 lerp되고, `auto` 모드는 클라이언트의 실제
시각(`Date().getHours()`)을 기준으로 두 인접 프리셋 사이를 smoothstep으로
보간합니다.

```ts
function getAutoBlend(hour) {
  if (hour <  4) return { a: NIGHT,  b: NIGHT,  t: 0 };
  if (hour <  6) return { a: NIGHT,  b: DAWN,   t: smoothstep((hour-4)/2) };
  if (hour <  8) return { a: DAWN,   b: DAY,    t: smoothstep((hour-6)/2) };
  if (hour < 16) return { a: DAY,    b: DAY,    t: 0 };
  if (hour < 18) return { a: DAY,    b: SUNSET, t: smoothstep((hour-16)/2) };
  if (hour < 20) return { a: SUNSET, b: NIGHT,  t: smoothstep((hour-18)/2) };
  return             { a: NIGHT,  b: NIGHT,  t: 0 };
}
```

새벽 5시에 접속하면 night와 dawn의 중간 상태를 보게 됩니다.

### Weather

```ts
type WeatherName = 'clear' | 'rain' | 'snow';
```

날씨는 시간 프리셋 위에 modifier로 적용됩니다. `applyWeather(p, weather)`가
원본 프리셋을 받아 새 프리셋을 반환합니다.

- **rain**: 하늘을 어둡게 lerp, sun intensity 0.25배, ambient/hemi/fill
  intensity 감소, 안개 1.8배 진하게, exposure 0.75배, 물 색을 어둡고
  탁하게.
- **snow**: 하늘을 회백색으로 lerp, sun 0.55배, ambient를 차가운
  blue-grey로, 안개 1.4배.

이렇게 하면 4개 시간 x 3개 날씨 = 12개의 조합이 자동으로 생성됩니다.
밤 + 비, 새벽 + 눈처럼 임의 조합이 모두 일관되게 보입니다.

### Rain / Snow Particle System

날씨가 `clear`가 아니면 파티클 시스템이 활성화됩니다.

```ts
// 비: LineSegments (line shower)
//   각 라인이 하나의 빗방울 (start, end 두 점)
//   매 프레임 y 감소, 바닥에 닿으면 위로 reset
//   색 0x8899bb, opacity 0.35

// 눈: Points
//   각 점이 하나의 눈송이
//   drift 벡터 + sin 기반 좌우 흔들림
//   색 0xeef0f8, sizeAttenuation true
```

파티클 개수는 `perf.particleMul`로 곱해집니다. low tier에서는 25%만
나옵니다.

### Season

`src/scripts/world/seasons.ts`. 시즌 시스템은 시간/날씨와 다르게
material color에 직접 작용합니다.

```ts
type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';
```

원리: 씬의 모든 mesh를 한 번 traverse하면서 material color를 검사하고,
미리 정의한 LEAF/FLOWER/GRASS hex 팔레트와 거리(L1 norm)가 가까운
mesh를 골라냅니다.

```ts
const LEAF_HEX   = [0x4aaa4a, 0x3a8a3a, 0xf09050, ...];
const FLOWER_HEX = [0xf5a8c0, 0xf0d060, 0x88c8e8, 0xf5c8e0];
const GRASS_HEX  = [0x80d880, 0x68c068, 0x58b858, 0x48a048];

// 컬러 거리가 0.25 이하면 매칭
// 매칭된 mesh와 원본 색을 별도 배열에 저장
```

이렇게 분류된 mesh들은 시즌 변경 시 type별 tint(`leafTint`, `flowerTint`,
`grassTint`)가 곱해집니다.

```ts
spring: { leaf: (0.85, 1.15, 0.90), flower: (1.4, 0.85, 1.2),  grass: (0.85, 1.15, 0.75) }
summer: { leaf: (1.00, 1.00, 1.00), flower: (1.0, 1.0, 1.0),   grass: (1.00, 1.00, 1.00) }
autumn: { leaf: (1.60, 0.65, 0.25), flower: (1.3, 0.7, 0.35),  grass: (1.20, 1.00, 0.55) }
winter: { leaf: (0.55, 0.60, 0.80), flower: (0.45, 0.50, 0.75), grass: (0.75, 0.85, 1.05) }
```

캐릭터/동물에 붙어 있는 mesh는 제외됩니다 (토끼가 가을이라고 주황색이
되면 곤란). `hasTaggedAncestor`가 부모 체인을 거슬러 올라가서
`isCharacter` / `isAnimal` 플래그가 있으면 스킵합니다.

low tier에서는 `perf.throttleSkip = 4`라서 4프레임에 한 번만 tint
갱신이 실행됩니다. 이때 `dt *= throttleSkip`으로 보정해서 lerp 속도가
같아 보이도록 합니다.

---

## Audio System

`src/scripts/system/audio.ts`. 사운드 파일 0개, 모두 Web Audio API로
절차적으로 합성합니다.

브라우저 자동재생 정책 때문에 첫 사용자 입력(키 입력 또는 터치)이 있을
때까지 AudioContext는 suspended 상태이고, 첫 입력에서 `init()`이 호출되며
ambient loop가 시작됩니다.

### 합성하는 사운드

```
// 월드
footstep(surface, sprint)   grass / stone / wood, sprint면 더 짧고 톤 높음
jump()                      짧은 swoosh
land(impact)                충격에 따라 thud
splash()                    물에 닿음
zoneChime(colorHex)         zone 진입 시 (zone 색상에 따라 음정)
cubeTick()                  큐브가 nearest로 잡힐 때
mgEnter() / mgExit()        미니게임 진입/종료 transition

// BGM
startAmbient()              시간대 mood에 맞는 ambient pad
setBGMMood(timeLabel)       dawn / day / sunset / night

// 미니게임
mgGem(count)                코인/젬 줍기 (count로 음정 상승)
mgCoin(pitch)
mgHit() / mgHurt()
mgCombo(level)              콤보 레벨에 따라 음정 상승
mgWaveClear()
```

발소리는 단순한 노이즈 burst + 표면별 envelope로 합성됩니다. grass는
부드러운 short noise, stone은 sharp click, wood는 약간 hollow한 톤.
sprint면 attack이 짧아지고 pitch가 약간 올라갑니다.

`getSurface(x, z)`가 매 발걸음 좌표를 보고 표면 종류를 반환하므로,
플레이어가 풀밭에서 돌 플랫폼으로 올라가면 발소리가 자동으로 바뀝니다.

zoneChime은 zone 색상의 hue에서 음정을 결정합니다. 4개 zone이 모두
다른 음으로 ding 합니다.

### Mute

우측 상단 sound toggle 버튼으로 mute 가능. 상태는 `localStorage`에 저장되어
다음 접속 시에도 유지됩니다.

---

## Mobile Optimization

3D 씬을 모바일에서 안정적으로 돌리는 게 목표였고, 실제로 처음에는 플랫포머
구간에서 프레임이 떨어지는 문제가 있었습니다. 원인은 draw call 폭발이었고,
이를 잡기 위해 다음 작업들이 들어갔습니다. 단계별 진행 기록은 [Performance
Journey](#performance-journey) 섹션에 따로 정리되어 있습니다.

### 1. Tier 자동 low

`isMobile` 감지 시 무조건 `low` tier. 사용자가 URL로 강제하지 않는 한
PointLight 0개, particle 25%, shadow off, bloom off, pixelRatio 1.

### 2. PointLight 제거

forward rendering에서 PointLight는 모든 fragment마다 lighting 계산을
수행하므로 mobile GPU에서 비용이 폭증합니다. zone pillar light, project
cube highlight light 등 모든 PointLight를 low tier에서는 생성 자체를
건너뜁니다. ambient + hemi + directional만으로 조명이 충분히 살아납니다.

### 3. 모바일 PostFX 완전 스킵

원래는 `UnrealBloomPass`를 모바일에서 해상도만 낮춰서 사용했는데,
bloom은 fragment shader 부하가 큰 effect라 그것만으로는 부족했습니다.

`postfx.ts`는 `perf.bloom`이 false면 EffectComposer를 만들지 않고 순수
`renderer.render()`로 우회합니다. low/medium tier 모두 bloom OFF.

```ts
// postfx.ts
if (!perf.bloom) {
  // composer 생성 skip, 순수 renderer.render() 사용
  return { render: () => renderer.render(scene, camera) };
}
```

### 4. InstancedMesh Batching (가장 큰 효과)

이게 모바일 성능 개선의 핵심이었습니다. 처음 코드는 모든 정적 오브젝트를
개별 `Mesh`로 만들어서, 플랫포머 구간을 카메라에 담으면 draw call이
800개를 넘어갔습니다. 이걸 100 미만으로 줄이는 게 목표였습니다.

`terrain.ts`에 InstanceBatcher 패턴을 도입했습니다.

```ts
// terrain.ts
interface IBGroup { geo, mat, items: Transform[] }
const _ib = new Map<string, IBGroup>();

// 빌드 단계에서 같은 geo+mat 조합을 key로 묶어서 transform만 누적
function ib(key, geo, mat, x, y, z, ry) {
  let g = _ib.get(key);
  if (!g) { g = { geo, mat, items: [] }; _ib.set(key, g); }
  g.items.push({ x, y, z, ry });
}

// scene 빌드가 끝난 뒤 한 번 호출
export function flushInstances(scene) {
  for (const [, g] of _ib) {
    const im = new THREE.InstancedMesh(g.geo, g.mat, g.items.length);
    for (let i = 0; i < g.items.length; i++) {
      dummy.position.set(...);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    scene.add(im);
  }
}
```

batching 대상과 결과:

```
울타리 벽    ~120 -> 2  (밝은색/어두운색 2개로 분리)
울타리 포스트  ~40 -> 1
울타리 코너    ~20 -> 1
랜턴          ~20 -> 2  (포스트 + 램프)
경로 돌       ~30 -> 5  (palette 색상별)
잔디 tuft     ~25 -> 1
꽃줄기        ~10 -> 1
버섯          ~24 -> 4  (줄기 + 캡 + 점박이)
                ----
합계        ~289 -> ~17 draw calls
```

bird's-eye로 약 270개 draw call 절감.

batching에서 의도적으로 제외한 것:

- **나뭇잎, 헤지, 꽃 머리**: `wind.ts`가 매 프레임 position/rotation을
  조작하므로 individual mesh 유지
- **바위**: 각각 다른 크기 (seed 기반 random geometry)
- **플랫폼**: 각각 다른 크기
- **울타리 레일**: 구간별 다른 길이

### 5. Material Cache

InstancedMesh를 써도 `stdMat()`이 호출될 때마다 새 `MeshStandardMaterial`을
만들면 GPU 입장에서 전부 별개 material이라 batching이 무력화됩니다.
`helpers.ts`에 캐시를 추가했습니다.

```ts
// helpers.ts
const _matCache = new Map<string, THREE.MeshStandardMaterial>();

export function stdMat(color, roughness = 0.85) {
  const key = `${color}|${roughness}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness });
    _matCache.set(key, m);
  }
  return m;
}
```

같은 색상 조합은 모두 동일 material 인스턴스를 공유합니다.

### 6. Phase 2 Decoration 통째로 스킵

씬 빌더는 두 단계로 나뉩니다.

```
Phase 1: 지형, 메인 zone monument, project cube, 필수 prop
Phase 2: 추가 장식 (작은 식물, 부유 crystal, 분위기 prop)
```

`perf.phase2Decor === false`면 Phase 2를 통째로 스킵합니다. 메쉬 수가
크게 줄어듭니다.

### 7. 갱신 빈도 throttle

매 프레임 갱신할 필요 없는 시스템은 `throttleSkip` 만큼 건너뛰고 dt를
보정합니다. 적용 대상:

- `seasons.ts`: low에서 4프레임에 1번 (식물 색 tint)
- `wind.ts`: low에서 4프레임에 1번 (잎 흔들림)
- `interactions.ts`: 동물 emoji sprite 위치 갱신
- `zoneparticles.ts`: 일부 비주얼 갱신

### 8. UI / 입력 분기

- 가상 조이스틱: 화면 하단 절반 터치 시 그 자리에 base가 나타남
- 카메라: 화면 상단 절반에서 드래그
- 점프 / interact 버튼: 우측 하단에 floating
- `<meta name="viewport" content="user-scalable=no">` + `touch-action: none`
- `-webkit-user-select: none`으로 텍스트 선택 방지
- nav의 일부 링크(github, email)는 `.hide-mobile`로 숨김

### 9. 미니게임 Canvas DPR 처리

미니게임은 별도의 Canvas 2D 렌더러를 씁니다. 모바일 retina 디스플레이에서
선명도와 좌표 정합성을 모두 잡으려면 buffer size와 logical size를 분리해야
합니다.

```ts
// minigames/base.ts
private _dpr = 1;
private _lw = 0;  // logical width  (CSS px)
private _lh = 0;  // logical height (CSS px)

// W/H getter는 항상 CSS 픽셀 기준 반환
get W() { return this._lw; }
get H() { return this._lh; }

private rsz() {
  this._dpr = Math.min(devicePixelRatio || 1, 2.5);
  this._lw = innerWidth;
  this._lh = innerHeight;

  // canvas buffer는 DPR 배수로
  this.cv.width  = this._lw * this._dpr;
  this.cv.height = this._lh * this._dpr;

  // context transform으로 자동 스케일
  this.cx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
}
```

이렇게 하면:

- 게임 로직과 히트테스트는 CSS 픽셀 기준으로 동작
- 실제 렌더링은 물리 픽셀 1:1로 선명
- 클릭/터치 이벤트(`e.clientX`)는 이미 CSS 픽셀이라 변환 불필요
- 각 미니게임 코드는 `this.W`, `this.H`만 쓰면 자동으로 맞음

DPR 상한 2.5는 메인 Three.js 씬(모바일 1.0)보다 넉넉합니다. 2D Canvas는
GPU 부하가 적어서 retina를 살릴 여유가 있습니다.

### 10. 작은 디테일

- `oceanSegments` 80에서 24로 (low). 멀리서 보면 차이 거의 없음.
- `maxPixelRatio` clamp. 고해상도 iPhone에서 retina 풀 렌더링은 부담이 큼.
- `edgeWireframes` 비활성. low tier에서는 큐브 wireframe overlay 제거.

---

## Minigames

`src/scripts/minigames/`. 6개의 미니게임이 Canvas 2D만으로 구현되어 있습니다.
외부 라이브러리 0개, 이미지 asset 0개, 모든 그래픽은 path/rect/text로
직접 그립니다.

### 세 가지 진입점

미니게임은 세 군데에서 실행 가능합니다.

1. **3D Explore 씬 안에서**: project cube 근처에서 `E`. 미니게임이
   인라인으로 뜨고, 종료 시 3D 씬의 같은 위치로 복귀.
2. **프로젝트 상세 페이지에서**: `/projects/{slug}/`에 "미니게임 하러가기"
   CTA 버튼이 떠 있음. 클릭하면 `/projects/{slug}/play/{key}/`로 이동.
   풀스크린, ESC로 프로젝트 페이지 복귀.
3. **인게임 방명록**: ETERNA 프로젝트의 경우 일반 미니게임 대신 Supabase
   방명록이 같은 슬롯에 매핑됨.

세 번째 진입점이 의외로 중요합니다. 채용 담당자가 굳이 3D 씬을
돌아다니지 않아도, 각 프로젝트 페이지에서 바로 미니게임을 플레이해볼 수
있어요.

`src/pages/projects/{slug}/play/[key].astro`는 단일 파일이지만
`getStaticPaths`로 7개 정적 라우트를 만들어 빌드됩니다. 이 파일 안에서
동적 import로 해당 미니게임 모듈만 로드하므로, 한 미니게임 페이지에서
다른 미니게임 코드를 받지 않습니다.

`ProjectLayout.astro`의 `minigameMap`이 slug에서 미니게임 key를 lookup해서
CTA를 조건부 렌더링합니다.

### 매핑

`data.ts`의 `PROJECTS[i].minigame` 필드:

```
ETERNA          guestbook    (Supabase 방명록, 미니게임은 아님)
SPODY           spody        (타겟 슈팅)
Math Master     maze         (미로)
루비의 모험      ruby         (탑다운 ARPG)
Nine to Six     ninetosix    (Frenzy Circle, 동심원 점프)
Nomads Planet   nomads       (범퍼카 아레나)
HAUL            haul         (1-hit 플랫포머)
```

각 미니게임은 원본 프로젝트의 핵심 메커닉을 단순화해서 재현한 것입니다.
"이 사람이 이런 걸 만들었다"는 걸 글로 읽는 대신 직접 플레이할 수 있게
하는 게 목적이에요.

### MinigameBase (`base.ts`, 630줄)

모든 미니게임은 `MinigameBase` abstract class를 상속합니다. base가 다음을
처리합니다:

- Canvas 생성 / DPR 처리 / resize
- 키보드 + 마우스 + 터치 입력 라우팅
- 모바일 가상 컨트롤 (조이스틱 / action button / jump button)
- 파티클 / 팝업 텍스트 풀
- 인트로 / 결과 화면 / HUD 헬퍼
- 리더보드 통합 (top10 fetch, 자격 판정, submit form 표시)
- Audio hook
- Lifecycle (`resetGame`, `updateGame`, `renderGame`, `onClickAt`)

서브클래스는 핵심 게임 로직만 작성합니다.

```ts
abstract class MinigameBase {
  // 서브클래스가 구현해야 하는 것
  protected abstract resetGame(): void;
  protected abstract updateGame(dt: number): void;
  protected abstract renderGame(now: number): void;
  protected abstract onClickAt(x: number, y: number): void;

  // 선택적으로 override
  protected onTouchMoveAt(x, y) {}
  protected onTouchEndAt() {}
  protected onMouseMoveAt(x, y) {}
  protected onResized() {}
}
```

`setupMobileControls(config)`로 모바일 컨트롤을 게임별로 켤 수 있습니다.
HAUL과 ruby는 jump + action 둘 다, maze는 swipe만, spody는 tap만 쓰는
식으로.

### 1. SPODY (`spody.ts`, 276줄)

원본: SPODY (XR 유아 교육, Kinect 센서로 화면의 움직이는 타겟 터치).

미니게임 버전: 마우스/탭으로 화면을 움직이는 도형을 맞추는 슈터.

```ts
const WAVES = [
  { n: 4, r: 24, sMin:  70, sMax: 130, splash: 54 },
  { n: 5, r: 19, sMin: 120, sMax: 200, splash: 44 },
  { n: 7, r: 15, sMin: 160, sMax: 280, splash: 36 },
];
const MAX_AMMO = 3;
const AMMO_CD = 0.85;     // 탄약 재충전 간격
const COMBO_WIN = 1.8;    // 콤보 유지 시간
```

3 wave, 각 wave마다 타겟 수 증가 + 크기 감소 + 속도 증가. 한 wave를
끝내면 다음 wave로 넘어갑니다. 탄약 3발을 다 쓰면 0.85초 cooldown 후
재충전. 1.8초 안에 연속 명중하면 combo가 쌓이고 점수가 배가됩니다.

타겟에는 5종 색상에 수학/도형 심볼이 그려져 있어서, 원본 SPODY의 교육
컨텐츠 느낌을 시각적으로 재현합니다.

### 2. Math Master / Maze (`maze.ts`, 680줄)

원본: Math Master (초등 수학 라이브 서비스). Recursive Backtracker로
미로를 생성하고 A*로 정답 경로를 탐색하는 알고리즘이 들어가 있었습니다.

미니게임 버전: 그 알고리즘을 그대로 포팅한 미로 탈출. 3 stage, fog of war,
타임어택, 보석 수집.

```ts
const STAGES = [
  { w:  7, h:  7, fog: 0, time:  60 },
  { w: 11, h: 11, fog: 6, time:  90 },
  { w: 15, h: 15, fog: 4, time: 120 },
];
```

Stage 1은 fog 없음(전체 보임). Stage 2부터 fog of war가 활성화되어
플레이어 주변 일정 반경만 보입니다. Stage 3은 더 큰 미로 + 약간 좁은 fog.

미로 셀은 4비트 wall mask로 표현됩니다.

```ts
const WL = 1, WR = 2, WU = 4, WD = 8, WV = 128;
// WL = wall left, WR = wall right, WU = wall up, WD = wall down
// WV = visited (생성 알고리즘용)
```

`generateMaze(w, h)`가 Recursive Backtracker로 wall을 깎아내고,
`findPath(start, end)`가 A*로 최단 경로를 찾습니다 (힌트 trail 표시용).

데스크탑은 화살표/WASD, 모바일은 swipe로 한 칸씩 이동. 각 이동은
0.18초 (모바일은 0.22초)의 step animation으로 부드럽게 보간됩니다.

### 3. 루비의 모험 / Ruby (`ruby.ts`, 393줄)

원본: 루비의 모험 (졸업전시작 3D 액션 RPG). 디아블로식 탑다운, 콤보 + 스킬,
NavMesh AI.

미니게임 버전: 같은 컨셉의 2D 탑다운 ARPG. 클릭 이동, 자동 근접 공격, 콤보,
3 wave.

```ts
const MD = {
  normal: { hp: 1, spd: 48, r: 16, sym: 'circle', pts:  50, rng:  32 },
  orc:    { hp: 2, spd: 74, r: 20, sym: 'diamond',pts: 100, rng:  38 },
  mage:   { hp: 1, spd: 26, r: 16, sym: 'star',   pts:  80, rng: 185, shoots: true },
};
```

Wave 1은 normal만, Wave 2에 orc 추가, Wave 3에 원거리 공격하는 mage 합류.
mage는 멀리서 투사체를 쏩니다. melee 콤보는 2.0초 안에 연속 공격하면
이어지고, lunge로 짧게 전진합니다.

플레이어 상태머신:

```ts
type CState = 'idle' | 'atk' | 'cd';
// idle    : 입력 받음
// atk     : 공격 모션 중
// cd      : 짧은 cooldown (0.12초)
```

WASD 직접 이동 + 클릭 이동/공격 둘 다 지원. 모바일은 가상 조이스틱.

### 4. Nine to Six / Frenzy Circle (`circles.ts`, 604줄)

원본: Nine to Six (TON 생태계 텔레그램 미니게임, WebGL). 풀 게임 자체는
다른 장르였지만, 미니게임은 "TON 코인" 테마와 "랭킹" 시스템을 포트폴리오용
새 메커닉으로 재구현한 버전입니다.

메커닉: 동심원이 중심을 향해 줄어듭니다. 각 ring은 회전하고, 일부 구간은
"safe" 일부는 "gap". 플레이어는 현재 ring과 함께 회전하다가, 바깥 ring의
safe 구간이 정렬되면 점프해서 옮겨갑니다. gap에 떨어지면 죽음.

```ts
const RING_W = 22;        // ring 폭
const MIN_R = 22;         // 중심 ring 최소 반경
const RING_GAP = 36;      // ring 간격
const BASE_SHRINK = 20;   // 초당 ring 수축 속도
const BASE_ROT = 0.8;     // ring 회전 속도
const COMBO_WIN = 2.5;    // 콤보 유지 시간
```

각 ring은 자체 회전 속도를 가지고, 시간이 지날수록 수축이 빨라집니다.
연속으로 점프 성공하면 콤보가 쌓이고, 콤보 보너스로 점수가 가속됩니다.

### 5. Nomads Planet (`nomads.ts`, 1015줄)

원본: Nomads Planet (Unity Netcode 멀티플레이어 메타버스, K-메타버스
경진대회 장려상).

미니게임 버전: 5명의 NPC와 경쟁하는 범퍼카 아레나. 코인을 모으고, 적을
들이받아 코인을 빼앗고, 3 stage 동안 살아남기.

```ts
const NPC_COUNT = 5;
const NPC_NAMES = ['ROVER', 'BLITZ', 'NOVA', 'GRIM', 'ZEPH'];

const ACCEL = 520, MAX_SPD = 180;
const BOOST_MULT = 1.7, FRICTION = 3.6, TURN_SPD = 7.5;
const HIT_R = 16, RAM_COOLDOWN = 0.6, STUN_DUR = 1.0;

const DROP_PCT = 0.35;     // 들이받혔을 때 흩뿌리는 코인 비율
const BOOST_DUR = 4.0;     // 부스트 패드 효과 시간
const BOOST_SPAWN = 12.0;  // 부스트 패드 재생성 간격
```

NPC는 단순한 BT(Behavior Tree)로 동작합니다. 가까운 코인 추적, 약한
플레이어 추격, 부스트 패드 우선순위, hit 후 잠시 stun. 각 NPC가 다른
공격성을 가지도록 weight를 다르게 줬습니다.

```ts
type CState = 'idle' | 'chase_coin' | 'attack' | 'flee' | 'boost' | 'stunned';
```

플레이어는 drift 물리(가속 + 마찰 + 관성)로 움직이고, 부스트 패드를 먹으면
4초간 1.7배 속도. 들이받기에 RAM_COOLDOWN과 stun이 있어서 무한 스팸 방지.

### 6. HAUL (`haul.ts`, 997줄)

원본: HAUL (현재 1인 개발 중인 2D PvPvE Extraction shooter).

미니게임 버전: 1-hit die 정밀 플랫포머. 3 stage, 모든 적/위험에 한 번
닿으면 죽음. 죽으면 stage 입구에서 부활.

```ts
const GRAV = 1400;
const MOVE_SPD = 220;
const JUMP_V = -520;
const COYOTE_TIME = 0.08;       // 발판에서 떨어진 후 점프 허용 시간
const JUMP_BUFFER = 0.10;       // 착지 전 점프 입력 버퍼
```

`COYOTE_TIME`과 `JUMP_BUFFER`는 정밀 플랫포머의 표준 game feel 패턴입니다.
입력 타이밍이 살짝 어긋나도 점프가 의도대로 나가게 해줍니다.

플랫폼은 3종:

```ts
type Plat = { kind: 'solid' | 'falling' | 'fake' };
//  solid   : 일반
//  falling : 밟으면 떨림 -> 0.125초 후 낙하 -> 4초 후 재생성
//  fake    : 처음엔 진짜처럼 보이다가 통과해버림. 4초 후 재생성
```

코어(수집물) 두 종:

```ts
type Core = { fake: boolean; tier: 1 | 2 | 3 };
//  진짜 코어 : 점수 추가
//  가짜 코어 : 떨림 애니메이션이 살짝 다름. 먹으면 즉사
```

Stage 3에서는 가짜 코어 위치가 매번 랜덤화되어 외워서 풀 수 없습니다.

추가로 `humans`라는 NPC가 stage 2부터 등장합니다. 정해진 patrol 구간
(`pL`, `pR`)을 왕복하며 닿으면 죽음.

```ts
interface Human {
  x, y, pL, pR, dir: 1 | -1, walkPhase: number;
}
```

이 게임이 6개 중에서 가장 큽니다 (997줄). HAUL 본 프로젝트의 server-auth
멀티플레이는 미니게임에서 재현하기 어려워서, 대신 "정밀 플랫포머 + 트롤
함정"이라는 다른 각도로 핵심 game feel을 표현했습니다.

---

## Leaderboard

`src/scripts/minigames/leaderboard.ts` + `src/pages/leaderboard.astro`.

Supabase REST API를 직접 호출합니다. 별도의 클라이언트 라이브러리 없음.

### Schema

```sql
table game_scores (
  id          bigint primary key,
  game_id     text,           -- 'spody' | 'maze' | 'ruby' | ...
  nickname    text,
  score       integer,
  metadata    jsonb,           -- { combo, time, gems, cores, ... }
  created_at  timestamptz
)
```

`metadata`는 게임마다 다른 부가 정보를 담습니다. 예: SPODY는 max combo,
maze는 수집한 gem 개수와 클리어 시간, HAUL은 모은 core 개수.

### Game Registry

```ts
export const GAMES: Record<string, GameInfo> = {
  spody:     { id: 'spody',     title: 'SPODY',         color: '#6ee7b7',
               maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `x${e.metadata.combo}` : '' },
  ruby:      { id: 'ruby',      title: '루비의 모험',     color: '#ff6b9d',
               maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `x${e.metadata.combo}` : '' },
  maze:      { id: 'maze',      title: 'Math Master',   color: '#a78bfa',
               maxScore: 30000,  formatExtra: e => `${e.metadata?.gems ?? 0} ${e.metadata?.time?.toFixed(1)}s` },
  nomads:    { id: 'nomads',    title: 'Nomads Planet', color: '#fbbf24',
               maxScore: 999999, formatExtra: e => e.metadata?.combo ? `x${e.metadata.combo}` : '' },
  haul:      { id: 'haul',      title: 'HAUL',          color: '#ff966b',
               maxScore: 99999,  formatExtra: e => `${e.metadata?.cores ?? 0}` },
  ninetosix: { id: 'ninetosix', title: 'Frenzy Circle', color: '#22d3ee',
               maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `x${e.metadata.combo}` : '' },
};
```

각 게임마다 `maxScore`(서버 사이드 기본 검증용)와 `formatExtra`(리더보드
행에 보여줄 부가 정보 포맷터)가 정의됩니다.

### 점수 제출 흐름

```ts
async function submitScore(gameId, nickname, score, metadata) {
  // 1. Cooldown 검사 (5초 안에 두 번 제출 방지)
  if (Date.now() - lastSubmit < COOLDOWN_MS) return { ok: false, error: '...' };

  // 2. 클라이언트 사이드 sanity check
  if (score > GAMES[gameId].maxScore) return { ok: false, error: 'out of range' };

  // 3. POST + return=representation으로 새 row id 받기
  const res = await fetch(API, { method: 'POST', body: JSON.stringify(...) });

  // 4. 닉네임을 localStorage에 캐시 (다음 제출 시 prefill)
  saveNickname(nick);
  return { ok: true, newId: rows[0]?.id };
}
```

미니게임 base는 게임 종료 직후 `fetchTop10`으로 현재 top10을 가져와서
`willMakeTop10`으로 자격을 판정하고, 자격이 있으면 닉네임 입력 form을
띄웁니다.

```ts
function willMakeTop10(top10, score) {
  if (score <= 0) return false;
  if (top10.length < 10) return true;       // 빈 자리 있음
  return score > top10[top10.length - 1].score;  // 10등보다 높음
}
```

부정 행위 방어는 가벼운 수준입니다. 점수 범위 검증, 5초 cooldown,
RLS로 익명 INSERT만 허용하고 UPDATE/DELETE 차단. 의도적으로 over-engineer
하지 않았어요. 포트폴리오 사이트 미니게임에 적당한 수준이라고 판단.

### 페이지 (`/leaderboard/`)

전용 페이지는 6개 게임의 top10을 탭으로 보여줍니다. 탭을 클릭하면 해당
게임만 fetch하고, 한 번 fetch한 결과는 페이지 세션 동안 cache합니다.

```ts
const cache: Record<string, ScoreEntry[]> = {};

async function renderContent() {
  if (!cache[currentGame]) {
    cache[currentGame] = await fetchTop10(currentGame);
  }
  // render
}
```

페이지 상단에는 "3D 씬으로 이동" CTA가 있어서, 점수를 만들고 싶으면 바로
3D 씬으로 점프할 수 있습니다.

---

## Guestbook

`src/scripts/minigames/guestbook.ts` (인게임 버전, 357줄)
`src/pages/guestbook.astro` (전용 페이지)

리더보드와 같은 Supabase 백엔드, 다른 테이블.

### Schema

```sql
table guestbook (
  id          bigint primary key,
  nickname    text,
  message     text,           -- max 200 chars
  created_at  timestamptz
)
```

### 두 개의 UI

같은 데이터를 두 가지 방식으로 보여줍니다.

**전용 페이지 (`/guestbook/`)**: 일반적인 웹 form. nickname + textarea +
submit. 아래에 최근 메시지 리스트.

**3D 씬 인게임 버전**: ETERNA project cube에 매핑됨. `E`로 진입하면
풀스크린 미니게임 스타일로 뜸. 3-phase state machine.

```ts
type Phase = 'loading' | 'browse' | 'write';
```

`browse`에서는 메시지를 카드 형식으로 스크롤하며 보여주고, write 버튼을
누르면 `write` phase로 전환되어 입력 form이 나옵니다. 등록 후 다시 browse로
돌아가며 새 메시지가 리스트 맨 위에 표시됩니다.

이 인게임 버전은 ETERNA 프로젝트의 "디스코드형 커뮤니티 시스템"이라는
컨셉을 살리려고 일부러 메시지 카드 UI로 만들었습니다. 일반 form을 그대로
띄우는 것보다 메인 프로젝트(ETERNA)와 결이 맞아요.

### Validation

```ts
const MAX_MSG = 200;
const MAX_NICK = 20;
```

서버 사이드 RLS로 INSERT만 허용. 클라이언트는 길이 제한과 빈 메시지
체크만 하고 fetch.

---

## Featured Projects

자세한 내용은 각 프로젝트 페이지(`/projects/{slug}/`)에 동영상과 스크린샷,
역할 설명과 함께 정리되어 있습니다. 여기서는 README에 짧게만 언급합니다.

### ETERNA - 아고라 시스템 (2025.11 - 2026.04)

VOYAGER에서 진행 중인 실시간 커뮤니티 플랫폼 프로젝트. 디스코드형
"아고라" 시스템의 아키텍처 설계와 구현을 전담했습니다.

Service / Repository / State 3계층으로 분리한 구조를 적용했고, R3와
UniTask 기반의 reactive 흐름으로 데이터 갱신을 관리합니다. CRUD, 알림,
검색, 권한, 크로스플랫폼 STT, 한글 조합 커스텀 InputField, UaaL 양방향
통신까지 작업.

Stack: Unity, C#, R3, UniTask, Tencent IM, FlatBuffers

### REIW - 3D 메타버스 (2025.06 - 2025.11)

같은 회사의 이전 프로젝트. Tencent IM 기반 채팅과 친구 시스템을 차세대
아키텍처로 재설계했고, 하우징 프로토타입과 NPC 퀘스트 시스템을 구현.
DataTableSO 에디터 툴도 만들었습니다.

Stack: Unity, C#, R3, UniTask, DOTween

### IW Zombie - 팀 서바이벌 (2025.02 - 2025.06)

VOYAGER에서 첫 프로젝트. 5단계 게임 루프 전반과 Tencent IM 채팅 첫 도입.
3D 사운드 풀링, 전투 로직, AI NPC, 범용 디버그 치트 시스템.

Stack: Unity, C#, Tencent IM, DOTween

### STELSI Wallet (2023.02 - 2023.08)

VERS.에서 1인 개발한 이더리움 HD 지갑 앱. 회사의 Unity 스택을 Flutter로
전환하는 결정을 주도했고, 설계부터 양대 스토어 출시까지 혼자 진행.
BIP39/BIP44 HD 지갑, 스마트 컨트랙트 3종 연동, SecureStorage 암호화.

Stack: Flutter, Dart, Riverpod, web3dart, Web3.js

### STELSI - UE5 메타버스 (2023.08 - 2024.12)

UE5 메타버스 프로젝트에 중간 투입. Bink2 영상 재생, 360도 촬영 툴, UI,
외주 관리. SM그룹과 정림건축 MOU에 기여.

Stack: Unreal Engine 5, C++, Bink2

### Nine to Six - Frenzy Circle (2024.06 - 2024.10)

TON 생태계 텔레그램 환경(WebGL) 미니게임. 코인 밈 테마, 랭킹 시스템.
이 프로젝트의 랭킹 시스템 작업이 본 포트폴리오 사이트의 6개 미니게임
리더보드로 일반화되었습니다.

Stack: Unity, C#, WebGL, RESTful API

### HAUL - 2D PvPvE Extraction (2025.10 - Present)

현재 1인 개발 중인 사이드 프로젝트. Server-authoritative 멀티플레이어
구조로, Client-side prediction과 Server reconciliation을 직접 구현하고
있습니다. 동일 물리 엔진을 클라이언트와 서버 양쪽에서 돌려 misprediction을
최소화하는 방식. NPC도 fake InputCmd 패턴으로 동작합니다.

Stack: Godot 4, C#, ASP.NET, gRPC, LiteNetLib

### Nomads Planet (2023.06 - 2023.09)

K-메타버스 경진대회 장려상 수상작. Unity Netcode + Vivox로 만든
멀티플레이어 메타버스. 1인으로 기획/설계/구현 진행. Matchmaker + Backfill,
NPC 교통 FSM, 실시간 리더보드.

Stack: Unity, C#, Netcode, Vivox

### Math Master / 일프로연산 (2021.06 - 2022.06)

SKT ZEM에 선정된 초등 수학 라이브 서비스. 분수 도메인 타입을 직접
설계해서 연산자 오버로딩, GCD/LCM, 약분/채점 로직을 일관되게 다뤘고,
Recursive Backtracker와 A* 알고리즘으로 미로 컨텐츠를 만들었습니다.
DOTween 대신 Ease/Loop/Coroutine 기반의 자체 Tween 라이브러리도 작성.

Stack: Unity, C#, UGUI, DOTween, UniRx

### SPODY - XR 유아 교육 (2020.01 - 2021.06)

VVR에서 1인 개발자로 시작해 5인 팀 리드까지 맡은 프로젝트.
Kinect/ASTRA 센서 + OpenCV 자동 캘리브레이션 기반 XR 교육 콘텐츠.
양산 체계를 구축해서 24개 이상의 모듈을 만들었고, 공공기관 납품과
인도네시아 수출까지 진행.

Stack: Unity, C#, OpenCV, Kinect, ASTRA

### 루비의 모험 (2019.09 - 2019.11)

홍익대 게임학부 졸업전시 우수상. 1인 개발 3D 액션 RPG. 콤보/스킬 전투,
BT 기반 몬스터 AI, 2페이즈 보스, Timeline 연출.

Stack: Unity, C#, NavMesh, Timeline

---

## Performance Journey

처음 3D 씬을 만들었을 때는 모바일에서 플랫포머 구간을 지날 때 프레임이
눈에 띄게 떨어졌습니다. 디바이스마다 다르긴 했지만 안정적으로 30fps를
유지하지 못하는 케이스가 꽤 있었어요. 원인을 추적해서 단계적으로 개선한
기록입니다.

### 진단

`renderer.info.render.calls`로 draw call 수를 봤더니 800개를 넘어가는
구간이 있었습니다. 100 미만이 모바일 60fps의 일반적인 가이드라인이라고
들었던 것에 비하면 8배 이상 많은 수치였어요.

원인은 `terrain.ts`의 빌드 패턴이었습니다. 모든 정적 오브젝트(나무, 울타리,
꽃, 돌, 잔디, 버섯, zone 장식)를 개별 `Mesh`로 생성하고 있었고, 같은
색상의 `stdMat()`도 호출할 때마다 새 material을 만들어서 GPU 입장에서
batching이 전혀 안 되는 상태였습니다.

```
대략적 추산:
  메인 섬 5개 x (돌체 + 잔디 + 에지)  ~15
  디딤돌 30개 x 3 (kinds)              ~90
  나무 19그루 x 9 (줄기 1 + 잎 8)      ~171
  울타리 세그먼트                        ~200+
  꽃 / 버섯 / 돌 / 랜턴 / 부쉬           ~150+
  Zone 장식                              ~120+
  동물                                   ~60+
  ---------
  합계                                  ~800+ draw calls
```

### Phase 1: Instancing + Material Cache + Mobile PostFX 제거

가장 효과가 큰 항목들부터 잡았습니다.

**`stdMat()`에 캐시 추가** (`helpers.ts`).
같은 color + roughness 조합은 단일 material 인스턴스를 공유합니다. 이걸
먼저 해야 InstancedMesh가 의미를 가집니다.

**InstanceBatcher 패턴** (`terrain.ts`).
같은 geometry + material 조합을 key로 묶어서 transform만 누적해두고,
씬 빌드가 끝난 뒤 `flushInstances(scene)`에서 한 번에 `InstancedMesh`로
변환합니다.

batching 결과:

```
항목              before    after
울타리 벽         ~120  ->     2  (밝은색/어두운색)
울타리 포스트      ~40  ->     1
울타리 코너        ~20  ->     1
랜턴               ~20  ->     2  (포스트 + 램프)
경로 돌            ~30  ->     5  (palette별)
잔디 tuft          ~25  ->     1
꽃줄기             ~10  ->     1
버섯               ~24  ->     4
---------------------------------
batched 합계      ~289  ->    17
절감              ~272 draw calls
```

의도적으로 individual mesh로 남긴 것:

- 나뭇잎, 헤지, 꽃 머리: `wind.ts`가 매 프레임 position/rotation을
  조작하므로 InstancedMesh의 일괄 transform과 안 맞음
- 바위: 각각 다른 크기 (seed 기반 random geometry)
- 플랫폼, 울타리 레일: 구간별 다른 길이

**모바일 PostFX 완전 스킵** (`postfx.ts`).
원래는 `UnrealBloomPass`의 해상도만 모바일에서 낮춰 쓰고 있었는데, bloom
자체가 fragment shader 부하가 큰 effect라 그것만으로는 부족했습니다.
`perf.bloom === false`일 때 EffectComposer를 만들지 않고 순수
`renderer.render()`로 우회하도록 변경.

**Wind / Season 갱신 빈도 조절**.
`wind.ts`와 `seasons.ts`를 매 프레임이 아니라 `perf.throttleSkip`만큼
건너뛰고 dt를 보정해서 갱신.

### Phase 2: Custom Particle Shader

분위기를 해치지 않으면서 파티클 시스템을 추가하고 싶었습니다 (반딧불,
캠프파이어 연기, 계절별 벚꽃잎/낙엽). 그냥 `PointsMaterial`을 쓰면
per-particle size를 지원하지 않아서, 연기처럼 시간에 따라 크기가 변하는
효과가 안 나옵니다.

해결: 공용 `ShaderMaterial`을 만들어서 `aSize`, `aAlpha` attribute를 직접
정의하고, 3개 시스템(fireflies, smoke, seasonal)이 같은 shader를
공유합니다. fireflies만 additive blending으로 분리.

총 비용: +3 draw calls. Phase 1에서 ~272개를 줄였으므로 충분한 여유.

### Phase 3: Zone Proximity Particles

zone별로 다른 ambient particle을 추가했습니다 (`zoneparticles.ts`).
Pink Hub는 wisp, Green Treasure는 firefly, Purple Nether는 crystal 첨탑
주변 orbit, Yellow Beacon은 벚꽃잎 낙하. zone에 가까이 가면 활성화되고
멀어지면 fade out.

### 결과

정확한 draw call 수치를 매 빌드마다 측정해두지는 않았지만, 체감상
저사양 모바일에서도 플랫포머 구간을 안정적으로 통과할 수 있게 됐습니다.
같은 작업을 한 번에 다 한 게 아니라 Phase로 나눠서 단계별로 한 게,
회귀 버그를 찾기에 도움이 됐어요.

### 미니게임 DPR 처리

별도 작업이지만 같은 시기에 해결한 모바일 이슈. 미니게임은 별도 Canvas 2D
렌더러를 쓰는데, 모바일 retina에서 buffer size와 logical size를 분리하지
않으면 텍스트가 흐릿하거나 터치 좌표가 어긋났습니다. `base.ts`에 DPR
처리 패턴을 넣어서 해결. 자세한 내용은 [Mobile Optimization](#mobile-optimization)
섹션 참고.

---

## Credits

**Fonts**
- Pretendard Variable (https://github.com/orioncactus/pretendard)
- JetBrains Mono (https://www.jetbrains.com/lp/mono/)
- Outfit (https://github.com/Outfitio/Outfit-Fonts)

**Libraries**
- Three.js (https://threejs.org/)
- Astro (https://astro.build/)
- Supabase (https://supabase.com/)

**Inspirations**
- 3D 인터랙티브 포트폴리오 컨셉은 Bruno Simon의 portfolio
  (https://bruno-simon.com/) 와 Awwwards의 여러 사례에서 영감을 받았습니다.
- 등산형 zone 구조는 작업 중 유기적으로 도출되었습니다.

**Author**
- 환기 (Hwankee Baik)
- Email: devenvy100@gmail.com
- GitHub: https://github.com/pulppixel
- LinkedIn: https://www.linkedin.com/in/hwankee-baik-272948266/

---

## License

이 repository는 **All Rights Reserved**입니다. MIT나 Apache 같은 오픈
소스 라이선스가 아닙니다. 포트폴리오 시연과 코드 리뷰 목적으로만 소스를
공개(source-available)하고 있습니다.

**허용:**
- 소스 코드와 asset을 열람하기
- GitHub의 Terms of Service 범위 내에서 fork 하기

**금지:**
- 코드 또는 asset의 사용, 복사, 수정, 배포
- 본 프로젝트 기반의 파생 저작물 생성
- 상업적/비상업적 용도로의 일부 또는 전부 사용
- 어떤 형태로든 재배포

모든 코드, 3D 모델, 텍스처, 디자인, 그 외 asset의 지적재산권은 저작권자
(환기)에게 귀속됩니다. 라이선싱 문의는 repository 소유자에게 연락
바랍니다.

Featured Projects 섹션에서 언급한 회사 프로젝트들(ETERNA, REIW, IW Zombie
등)은 각 소속 회사의 소유이며, 본 repository에는 포함되어 있지 않습니다.
포트폴리오에 표시되는 영상/스크린샷은 각 저작권자의 양해 하에 사용되었습니다.

자세한 라이선스 조건은 [LICENSE](./LICENSE) 파일을 참고하세요.~~~~