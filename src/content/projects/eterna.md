## 배경

ETERNA는 유료 구독(하이퍼 이더) 전용 실시간 커뮤니티 플랫폼입니다. "아고라"는 디스코드의 서버와 유사한 개념으로, 다수의 채널을 묶는 그룹 단위입니다. 각 채널에는 실제 필드(씬)가 존재하며 최대 16명(인간 8 + AI Mirror 8)이 참여할 수 있습니다.

![ETERNA 인게임 - 아고라 채널 내부 필드에서 다수 캐릭터가 활동하는 모습](/images/et_scene1.png)

## 설계 - Service / Repository / State 3계층

REIW에서 VContainer 기반 DI + MVVM을 실제로 적용해봤지만, Unity 환경에서의 DI 컨테이너 학습 비용과 의존 그래프의 가독성 문제를 경험했습니다. 같은 문제를 더 얇은 레이어로 풀기 위해 3계층으로 재설계했습니다.

- **Repository** - Tencent IM SDK 같은 외부 의존성을 이 계층에서만 참조. 콜백 기반 SDK 호출을 `UniTask`와 `R3.Subject<T>`로 래핑해서, 바깥에서는 async / Observable로만 다룸. ACK 핸들러 등록/해제도 Repository 라이프사이클에 묶음
- **Service** - 비즈니스 로직 + Repository 이벤트 → State 반영을 조율. UI는 이쪽의 Observable만 구독, Repository는 직접 참조하지 않음
- **State** - 로직 없는 순수 저장소. ReactiveProperty, 리스트, 플래그만 들고 있고 Service만 조작. 외부에는 `ReadOnlyReactiveProperty`로 읽기 전용 프록시 노출
- **ServiceProvider** - static lazy singleton. 인스턴스 생성, 초기화, Dispose 관리

SDK를 Repository에 가둔 덕분에, 이후 SDK 버전 업데이트나 다른 IM 솔루션으로 교체하는 시나리오가 와도 수정 범위가 Repository 한 곳으로 제한됩니다.

![아고라 채널 기록 UI - 다수 아고라 가입, 채널 히스토리 조회 화면](/images/et_agora2.png)

## 구현

- 아고라 생성, 가입, 초대, 채널 관리, 실시간 알림, 검색, 권한 관리 전체 구현
- 크로스플랫폼 STT 직접 구현 - Windows: Whisper, 모바일: 네이티브(Java/ObjC). 음성 스트리밍, 녹음도 별도 라이브러리 없이 제작
- 한글 조합 문자(Composition) 입력 시 발생하는 런타임 이슈를 분석하고, 이를 해결한 커스텀 InputField를 개발하여 사용자 경험(UX)을 개선
- UaaL(Unity as a Library) 양방향 통신 적용 가능성 검증

![NPC 대화 시스템 - STT 입력과 토픽 선택 UI](/images/et_dialog3.png)

아래는 채널 접속/삭제 시 실시간 대응하는 영상입니다.

::youtube NqkNEjDdxw0 ETERNA - 채널 접속 및 삭제 대응

## 모바일 이동 로직 개선

마비노기 모바일 방식을 레퍼런스로 모바일 입력 구조를 전면 재설계했습니다. Enhanced Input System 기반으로 FloatingOnScreenStick(OnScreenControl 상속)을 직접 구현하여 이동(하단 40%)·회전(상단 60%)·줌(양손 핀치)·이동 중 강제 회전 등 복합 터치 입력을 단일 파이프라인으로 처리합니다.

::youtube CYy0mqAkOOM ETERNA - 모바일 이동 로직 개선

## 알림 관리

아고라 가입 신청이 들어오면 실시간 알림이 표시되고, 관리자가 승인/거절할 수 있는 UI를 구현했습니다.

![알림 관리 - 아고라 가입 신청 승인/거절 UI](/images/et_agora3.png)

## UaaL 양방향 통신 검증

Android Kotlin + Jetpack Compose 호스트 앱을 만들어 `AndroidView`로 Unity Player를 임베드, 호스트 앱과 Unity 사이를 실제 메시지가 오가도록 연결했습니다. 전체 앱을 Unity로 개발하는 방식이 비효율적이라고 판단해, 네이티브 앱에 Unity를 라이브러리로 삽입하는 UaaL 구조의 적용 가능성을 POC로 확인했습니다.

- **Compose → Unity** - `UnityPlayer.UnitySendMessage(gameObject, method, message)`로 캐릭터 애니메이션 트리거 등 호출
- **Unity → Compose** - `AndroidJavaClass("com.eterna.kee.UnityBridge").CallStatic("receiveFromUnity", ...)`로 Kotlin 쪽 `@JvmStatic` 메서드 직접 호출 → Compose 쪽 람다로 전달
- **하이브리드 구조** - Unity는 3D 캐릭터/아바타 렌더링만 담당, 채팅 UI / Tencent IM / 미디어 선택은 네이티브(Compose + Kotlin)에서 직접 구현
- **라이프사이클/메모리** - `UnityPlayerForActivityOrService` + `IUnityPlayerLifecycleEvents`로 resume / pause / destroy 관리, View는 `WeakReference`로 캐싱

::youtube DW-QP3Gskfw UaaL(Unity as a Library) 양방향 통신 POC

## 문서화

InputField 사용법, 아고라 작업 가이드 등 후속 작업자용 문서를 작성하여 바로 투입될 수 있도록 정리했습니다.
