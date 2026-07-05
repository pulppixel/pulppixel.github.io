## 배경

2023 K-메타버스 경진대회 출품을 위해 1인 개발한 프로젝트입니다. 멀티플레이어 네트워킹에 집중해 PC와 모바일 크로스플랫폼을 지원하는 아키텍처를 설계했고, Linux 기반 Dedicated Server 환경을 직접 구축해 연동했습니다.

![Nomads Planet - 1인칭 차량 시점. 리더보드, 미니맵, 코인 수집이 보이는 인게임 화면](/images/nomads_incar.jpg)

::youtube 5xdDs5nPkOY Nomads Planet - 시연 영상

## 아키텍처 - 3-Singleton 구조

`ApplicationController`가 실행 모드를 판별하고, `ClientSingleton` / `HostSingleton` / `ServerSingleton` 각각이 자기 GameManager를 소유하는 구조로 설계했습니다. `#if UNITY_SERVER` 전처리기로 Dedicated Server 빌드를 분리했고, 서버/클라이언트의 책임이 코드 레벨에서 명확히 나뉩니다.

## 네트워크 - 직접 구현한 것들

- `NetworkServer` - ConnectionApproval에서 UserData payload를 파싱하고, 인증 ID 매핑(`_clientIdToAuth`, `_authIdToUserData`)을 관리. 접속 후 3초 지연 스폰으로 씬 로딩 타이밍 보정
- `MatchplayMatchmaker` - Unity Matchmaker 티켓 생성 -> 폴링 -> 매칭 결과 처리. 취소/에러/타임아웃 케이스 전부 핸들링
- `MatchplayBackfiller` - Backfill 티켓으로 빈 자리를 자동 충원. 플레이어 추가/제거 시 티켓 업데이트, 풀방이면 Backfill 중단
- `MultiplayAllocationService` - Multiplay 서버 할당 구독 + SQP(Server Query Protocol) 핸들링. 서버 상태를 주기적으로 보고
- `ClientNetworkTransform` - Client-authoritative transform 오버라이드. `OnIsServerAuthoritative() -> false`

## 게임플레이 시스템

- **코인 풀링** - `Coin`(abstract) -> `RespawningCoin` / `BountyCoin` 상속 구조. `CoinSpawner`가 서버에서만 생성하고, 수집 시 위치만 리셋하여 오브젝트 수를 보존하는 풀링 패턴
- **NPC 교통 시스템** - `TrafficController` -> `TrafficFlow` -> `CarDetector` 계층 구조. 신호등 FSM(Red -> Green -> Yellow 사이클)에 따라 NPC 차량이 차선별로 대기/출발하고, DOTween의 `DOPath`로 Catmull-Rom 커브를 따라 좌회전/우회전
- **실시간 리더보드** - `NetworkList<LeaderboardEntityState>`로 동기화. `INetworkSerializable` 직접 구현. 코인 변경 시 자동 정렬, 본인 순위가 화면 밖이면 강제 표시
- **부스터 존** - `NetworkVariable<float>`로 부스터 잔량 동기화, 쿨다운 후 자동 충전. Tick Rate 기반 소비

![Nomads Planet - 1인칭 차량 시점. 타임라인 활용](/images/nomads_cutscene.jpg)

## Vivox 채팅

- 로비(Menu)와 인게임(Game) 채널을 분리하여 운영
- 텍스트 채팅 - 동적 말풍선 크기 조정(`ChatBubbleResizer`), 보낸 시각/발신자 표시, 자동 스크롤
- 참가자 로스터(`RosterUI`) - 채널별 참가자 목록 실시간 갱신
- 연결 상태 표시 - `ConnectionRecoveryState`에 따라 인디케이터 색상 변경

![Nomads Planet - 로비 채팅 시스템 (Vivox)](/images/nomads_chat.jpg)

## 기타

- Addressable System으로 모바일 초기 앱 사이즈 경량화
- Unity Localization으로 영어/한글 2개 국어 지원 (텍스트 + AI 음성)
- 캐릭터/차량 선택 영속화 (Easy Save 3) - 마지막 선택을 기억
- 플랫폼별 입력 분기 - PC는 키보드/마우스, 모바일은 가상 조이스틱(`FingersJoystickScript`)

![Nomads Planet - 발표용 연출 자료](/images/nomads_comm.jpg)

## 성과

2023 K-메타버스 경진대회 장려상(버넥트 대표상, 과학기술정보통신부)을 수상했습니다. macOS, Android, iOS, Linux(Dedicated Server) 환경에서 크로스플랫폼 시연을 마쳤습니다.

![2023 K-메타버스 경진대회 장려상 수상 - 버넥트 대표상, 과학기술정보통신부](/images/nomads_awards.jpg)
