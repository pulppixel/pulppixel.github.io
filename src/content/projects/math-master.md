## 배경

SKT ZEM 기본앱에 선정된 초등 수학 교육 앱으로, 약 20명 규모의 팀에 중간 경력으로 합류해 연산 스테이지 개발을 맡았습니다.

중심 과제는 문제 자동 생성이었습니다. 라이브 서비스가 요구하는 문제 물량을 수작업으로 감당할 수 없어 알고리즘 생성이 필수였는데, 난수를 돌린다고 끝나는 일이 아니었습니다. 같은 유형 안에서 난이도가 들쭉날쭉하지 않아야 하고, 자릿수 올림·받아내림이나 기약분수처럼 교육과정상 "나와야 하는" 형태 조건도 지켜야 했습니다. 도메인 전문가인 수학 기획자와 긴밀히 협업하며 분수·소수·자릿수 등 예외 케이스를 폭넓게 포괄하는 알고리즘을 설계했습니다.

::youtube 8ZuPu_M-23U Math Master - 내가 만든 스테이지

## 분수 도메인 타입 - Fraction struct

분수는 예외 케이스가 가장 많은 영역이었습니다. 대분수/진분수 분류나 약분 가능 여부 채점 같은 기획 요구를 스테이지마다 따로 처리하면 같은 로직이 반복되며 오류가 스며들 수밖에 없어서, 여러 스테이지가 재사용할 도메인 타입 하나로 묶었습니다. 초등 수학에 등장하는 분수 연산부터 약분, 채점까지 이 `struct` 하나로 처리합니다.

- 대분수/진분수/자연수 자동 분류 (`FSort` enum)
- 연산자 오버로딩: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, `<=`, `>=`
- GCD(유클리드 호제법), LCM
- `IsReducible()` - 약분 가능 여부 + 정답 채점 로직 내장
- `Reduce()` - 기약분수 변환
- `IEquatable<Fraction>`, `params` 오버로드 `Max`/`Min`

::youtube tjmf8ihzEs0 Math Master - 분수 연산 시연

## 미로 알고리즘 - 생성 + 탐색

미로 유형 스테이지를 위해 생성과 탐색 알고리즘을 직접 구현했습니다.

- **MazeGenerator** - Recursive Backtracker로 미로 생성. `WallState`를 `[Flags]` enum(비트마스크)으로 표현. `ignores` 배열로 특정 셀 사전 고정 가능
- **MazePathFinder** - A* 알고리즘으로 생성된 미로의 최단 경로 탐색. 대각선 이동을 무시하는 커스텀 Heuristic 적용

::youtube 4qKHTCeyNno Math Master - 미로 생성 및 길찾기 알고리즘

## 자체 Tween 라이브러리

외부 유료 에셋을 쓰지 않는 팀 방침이 있어, DOTween 없이 Coroutine 기반 Tween 시스템을 직접 만들었습니다. easings.net의 30가지 Easing 함수를 직접 구현했고, `LoopType`(Yoyo/Restart/Incremental) + 무한 반복(-1)을 지원합니다.

- `DoLocalMove`, `DoScale`, `DoFade`, `DoColor`, `DoFillAmount`, `DoLocalRotate` 등
- RectTransform, Transform, Graphic, Material, CanvasGroup, AudioSource, VideoPlayer 대응

## 결과

제가 만든 스테이지가 사내 우수 스테이지로 선정됐고, 앱은 SKT ZEM 기본앱과 구글 창구 프로그램(구글플레이, 중소벤처기업부, 창업진흥원)에 선정됐습니다.

::youtube j8j0GjdrKUE Math Master - 사내 우수 스테이지 선정

팀 차원에서는 소프트웨어 설계, 정보처리기사 스터디 등으로 개발 역량 향상에 기여했고, 상급자로부터 "꼭 필요한 인재, 성장하는 분위기를 만든다"는 평가를 받았습니다.

![Math Master - 랭킹 시스템 기사 자료](/images/mm_com.jpg)
