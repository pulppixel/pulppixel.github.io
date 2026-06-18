## 배경

SKT ZEM 기본앱에 선정된 초등 수학 교육 앱입니다. 도메인 전문가(수학 기획자)와의 긴밀한 협업을 통해 초등 연산 스테이지를 개발했습니다. 분수, 소수, 자릿수 등 다양한 예외 케이스를 포괄하는 유연한 알고리즘을 설계하여 문제 자동 생성 시스템의 완성도를 높였습니다.

::youtube 8ZuPu_M-23U Math Master - 내가 만든 스테이지

## 분수 도메인 타입 - Fraction struct

분수를 `struct`로 완전히 구현했습니다. 초등 수학의 분수 연산, 약분, 채점까지 이 타입 하나로 처리할 수 있도록 설계했습니다.

- 대분수/진분수/자연수 자동 분류 (`FSort` enum)
- 연산자 오버로딩: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, `<=`, `>=`
- GCD(유클리드 호제법), LCM
- `IsReducible()` - 약분 가능 여부 + 정답 채점 로직 내장
- `Reduce()` - 기약분수 변환
- `IEquatable<Fraction>`, `params` 오버로드 `Max`/`Min`

::youtube tjmf8ihzEs0 Math Master - 분수 연산 시연

## 미로 알고리즘 - 생성 + 탐색

- **MazeGenerator** - Recursive Backtracker로 미로 생성. `WallState`를 `[Flags]` enum(비트마스크)으로 표현. `ignores` 배열로 특정 셀 사전 고정 가능
- **MazePathFinder** - A* 알고리즘으로 생성된 미로의 최단 경로 탐색. 대각선 이동을 무시하는 커스텀 Heuristic 적용

::youtube 4qKHTCeyNno Math Master - 미로 생성 및 길찾기 알고리즘

## 자체 Tween 라이브러리

DOTween 없이 Coroutine 기반으로 만든 Tween 시스템입니다. easings.net의 30가지 Easing 함수를 직접 구현했고, `LoopType`(Yoyo/Restart/Incremental) + 무한 반복(-1)을 지원합니다.

- `DoLocalMove`, `DoScale`, `DoFade`, `DoColor`, `DoFillAmount`, `DoLocalRotate` 등
- RectTransform, Transform, Graphic, Material, CanvasGroup, AudioSource, VideoPlayer 대응

## 우수 스테이지

::youtube j8j0GjdrKUE Math Master - 사내 우수 스테이지 선정

## 팀 기여

- 소프트웨어 설계, 정보처리기사 스터디 등 팀 개발 실력 향상 기여
- 상급자로부터 "꼭 필요한 인재, 성장하는 분위기를 만든다"는 평가

![Math Master - 랭킹 시스템 기사 자료](/images/mm_com.jpg)

## 성과

- 사내 우수 스테이지 선정
- SKT ZEM 기본앱 선정
- 구글 창구 프로그램 (구글플레이, 중소벤처기업부, 창업진흥원) 선정
