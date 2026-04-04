# ETERNA — 아고라 시스템 코드 샘플

> 2025.11 – 2026.04 · 실시간 커뮤니티 플랫폼 · 아키텍처 설계 + 구현 전담  
> 전체 프로젝트가 아닌, **아고라 시스템 핵심 9개 파일**만 선별

## 아키텍처 — Service / Repository / State 3계층

DI/MVVM 등 여러 접근을 비교한 끝에, Unity 환경에서의 복잡도와 팀 러닝커브를 고려해 직접 설계한 구조입니다.

```
┌─────────────────────────────────────────────────────┐
│  UI / Presenter                                     │
│  (Observable 구독, Public API 호출)                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Service (AgoraService / TencentChatService)         │
│  - Repository 이벤트 → State 갱신                     │
│  - 비즈니스 로직, 알림 생성, 씬 전환                    │
│  - UI/Presenter가 호출하는 Public API 제공             │
└────────┬─────────────────────────────┬──────────────┘
         │                             │
┌────────▼────────┐          ┌─────────▼─────────────┐
│  Repository      │          │  State                 │
│  - 네트워크 I/O   │          │  - 순수 상태 보관       │
│  - ACK → Subject │          │  - ReactiveProperty    │
│  - SDK 격리       │          │  - 로직 없음           │
└──────────────────┘          └────────────────────────┘
```

**핵심 원칙:**
- `State`에는 로직이 없음 — ReactiveProperty로 UI 바인딩만 담당
- `Repository`에서 SDK 디테일이 끝남 — AgoraService는 Tencent IM SDK를 직접 참조하지 않음
- `Service`가 유일한 조율자 — Repository Observable 구독 → State 갱신 → UI 알림

## 포함된 파일

### Agora/ — 아고라(커뮤니티) 도메인

| 파일 | 줄 수 | 역할 |
|------|------|------|
| **`AgoraState.cs`** | 251 | 순수 상태 저장소. ReactiveProperty로 선택 아고라, 채널, 알림 보관. 로직 없음 |
| **`AgoraRepository.cs`** | 655 | FlatBuffers ACK 핸들러 등록 → Subject 발행. 서버 요청 메서드. SDK 격리 |
| **`AgoraService.cs`** | 1,384 | 비즈니스 로직 조율. Repository 이벤트 → State 갱신, 씬 전환, 알림, Tencent IM 연동 |
| **`AgoraDataModels.cs`** | 310 | 도메인 DTO. 아고라/채널/멤버/알림 데이터 모델 |

### TencentChat/ — Tencent IM SDK 격리 계층

| 파일 | 줄 수 | 역할 |
|------|------|------|
| **`TencentChatState.cs`** | 122 | IM 상태 저장소. 유저 ID, 그룹 목록, 채팅 로그. State 계층 패턴 재사용 증명 |
| **`TencentChatRepository.cs`** | 67 | 메시지 히스토리 조회. SDK 호출을 async/await로 래핑 |
| **`TencentChatService.cs`** | 706 | SDK 초기화/로그인, C2C 메시지 파싱(초대/가입 요청), 프로필 관리 |
| **`TencentGroupService.cs`** | 420 | 그룹 가입/탈퇴/초대, 멤버 조회, GroupTip 콜백 → Observable 발행 |
| **`TencentChatModels.cs`** | 160 | 채팅 메시지 DTO, 채널 타입 enum |

## 실무 복잡도

- **채널 삭제 NFY 중 씬 로딩** — `_pendingForceExit` 플래그로 로드 완료 후 안전 퇴장
- **채널 목록 폴링 최적화** — 레이아웃 동일 시 기존 객체 재사용, 변경 시 Dictionary O(n) 이관
- **비공개 가입 승인 흐름** — 서버 REQ → IM 그룹 초대 → 상대방 `kTIMGroupTip_Invite` → 자동 갱신
- **멤버 조회 비동기 큐** — `_pendingMemberListQueue`로 ACK-요청 매칭, 재호출 시 CTS 자동 취소

## 설계 의도 (향후 개선점)

- `AgoraService`(1,384줄)는 씬 전환/알림/멤버 관리를 별도 서비스로 분리 예정...
- 같은 3계층 패턴이 `TencentChat`에도 적용되어 있어 확장성 검증 완료
