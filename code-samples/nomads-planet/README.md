# Nomads Planet — 코드 샘플

> 2023 · Unity Netcode + Vivox 멀티플레이어 차량 메타버스 · 1인 개발 · K-메타버스 경진대회 장려상  
> 59개 스크립트 중 11개 선별

## 포함된 파일

### 네트워크 아키텍처
- **`ApplicationController.cs`** — 3-Singleton 구조의 진입점. 실행 모드(Client/Host/Server)를 판별하여 해당 Singleton을 생성.
- **`NetworkServer.cs`** — ConnectionApproval에서 UserData payload 파싱, 인증 ID 매핑(`_clientIdToAuth`, `_authIdToUserData`). 접속 후 3초 지연 스폰.
- **`ClientNetworkTransform.cs`** — Client-authoritative transform 오버라이드. `OnIsServerAuthoritative() → false`.

### 매치메이킹 · 서버 관리
- **`MatchplayMatchmaker.cs`** — Unity Matchmaker 티켓 생성 → 폴링 → 매칭 결과 처리. 취소/에러/타임아웃 전부 핸들링.
- **`MatchplayBackfiller.cs`** — Backfill 티켓으로 빈 자리 자동 충원. 플레이어 추가/제거 시 티켓 업데이트, 풀방이면 중단.
- **`MultiplayAllocationService.cs`** — Multiplay 서버 할당 구독 + SQP(Server Query Protocol) 핸들링.

### 게임플레이
- **`Coin.cs`** + **`CoinSpawner.cs`** — abstract `Coin` → `RespawningCoin`/`BountyCoin` 상속. 서버에서만 생성, 수집 시 위치 리셋으로 풀링.
- **`TrafficController.cs`** + **`TrafficFlow.cs`** — NPC 교통 시스템. 신호등 FSM(Red→Green→Yellow), 차선별 대기/출발, DOTween Catmull-Rom 경로.
- **`LeaderboardEntityState.cs`** — `INetworkSerializable` 구현. `NetworkList`로 실시간 동기화.
