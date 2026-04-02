# Math Master (일프로연산) — 코드 샘플

> 2021–2022 · 초등 수학 교육 앱 · 라이브 서비스 (SKT ZEM 선정)  
> 가져온 17개 스크립트 중 5개 선별

## 포함된 파일

### 도메인 타입
- **`Fraction.cs`** — 분수를 `struct`로 완전 구현.
  - 대분수/진분수/자연수 자동 분류 (`FSort` enum)
  - 연산자 오버로딩: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, `<=`, `>=`
  - GCD(유클리드 호제법), LCM
  - `IsReducible()` — 약분 가능 여부 + 정답 채점 로직 내장
  - `Reduce()` — 기약분수 변환
  - `IEquatable<Fraction>`, `params` 오버로드 `Max`/`Min`

### 알고리즘
- **`MazeGenerator.cs`** — Recursive Backtracker로 미로 생성. `WallState`를 `[Flags]` enum(비트마스크)으로 표현. `ignores` 배열로 특정 셀 사전 고정 가능.
- **`MazePathFinder.cs`** — A* 알고리즘으로 생성된 미로의 최단 경로 탐색.

### 자체 Tween 라이브러리
- **`ExpandFuncs.cs`** — DOTween 없이 Coroutine 기반으로 만든 Tween 시스템.
  - `DoLocalMove`, `DoScale`, `DoFade`, `DoColor`, `DoFillAmount`, `DoLocalRotate` 등
  - `LoopType` (Yoyo/Restart/Incremental) + 무한 반복(-1)
  - RectTransform, Transform, Graphic, Material, CanvasGroup, AudioSource, VideoPlayer 대응
  - 수학 유틸리티: QuickSort, 에라토스테네스의 체, 약수 목록/개수, Fisher-Yates 셔플
- **`Ease.cs`** — Easing 함수 구현 (easings.net 참조).
