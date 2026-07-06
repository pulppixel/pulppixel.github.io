## 배경

IW Zombie에서 팀 최초로 도입했던 Tencent IM 채팅을, 약 40명이 붙은 메타버스 프로젝트 REIW로 가져와야 했습니다. 그대로 옮겨 쓸 수는 없었습니다. World/Whisper/Current/Guild/Party/System으로 채널 구조가 훨씬 복잡해졌고, 음성 메시지 송수신과 좋아요 표기 동기화처럼 이전에는 없던 기능이 요구됐으며, 첫 도입 당시 일정에 맞춰 붙였던 구조의 부채도 남아 있었습니다. 이식이 아니라 재설계가 필요하다고 판단했습니다.

## 채팅 재설계

Tencent IM 기반 채팅을 채널 분리부터 구조적으로 다시 세웠습니다. 다수 유저가 동시에 접속하는 환경을 전제로 부하 테스트까지 진행해 재설계의 유효성을 확인했습니다.

![REIW 채팅 시스템 - 채널별 분리, 음성 메시지, 3D 월드와 통합된 UI](/images/re_chat1.png)

::youtube -YoK5RMqHQ4 REIW - 시스템 채팅 동작

::youtube 692BVO18U6I REIW - 다수 유저 접속 + 채팅 부하 테스트

::youtube qwujR5SPmfA REIW - 음성파일 송수신

## 하우징 프로토타입 - 6면 스냅

MMO/메타버스 하우징은 "배치는 직관적이어야 하고, 충돌은 유연해야 한다"는 상반된 요구가 있습니다. 이 둘을 함께 만족시키기 위해 다음과 같이 설계했습니다.

- 각 오브젝트에 AABB 6면(면 중심) 스냅 포인트를 자동 생성. `Bounds`의 min/max를 계산해 각 면 중앙에 트리거 콜라이더 배치
- Opposites 매핑(오른쪽↔왼쪽, 위↔아래, 앞↔뒤)으로 인접 오브젝트와 대응하는 면끼리 붙도록 처리. Wall과 Floor가 만나는 특수 케이스는 동일 면끼리 페어링하는 분기를 별도로 분리
- 스냅 후보 탐색은 `Physics.OverlapSphereNonAlloc`으로 GC 할당 없이 수행. Layer 마스크로 스냅 콜라이더만 필터링
- `SnapDetector`가 `OnTriggerEnter/Exit`에서 `activeCollisions` 딕셔너리에 접촉 면 집합을 누적 관리. 여러 면이 동시에 겹치는 상황에서도 중복 스냅 방지
- 편집 중 상태는 `Stack<ObjectData>` 두 개(`_undoStack` / `_redoStack`)로 Undo / Redo 관리. Ctrl+Z / Ctrl+Y 입력
- `HousingEditor`, `HousingObject` 모두 `partial class`로 기능별 분리(Snapper / Adjustment / Property). 한 파일이 비대해지는 걸 구조로 차단

프로토타입 검증을 마치고 폴리싱된 2.0 기획에 맞춰 본제작으로 이어질 예정이었지만, 이후 회사가 문을 닫으면서 거기서 멈췄습니다.

![REIW 하우징 - 건축 블록 배치, 회전, 수직 이동 UI](/images/re_housing1.png)

## DataTable 통합 에디터 툴

수십 개로 흩어져 있던 ScriptableObject 기반 DataTable들을 공통 인스펙터로 통합했습니다. 기획자와 디자이너가 데이터를 추가할 때마다 "어떤 에셋을 수정해야 하지" 하고 헤매던 문제를 구조 차원에서 없애는 게 목표였습니다.

- 제네릭 베이스 에디터(`JsonImporterSOEditor<TAsset>`) + 최소 override 구조. 각 SO마다 JSON 경로, 배열 키, DTO 타입만 지정하면 인스펙터에 UPDATE / DISCARD / RESET 툴바와 요소 검색창이 자동으로 붙음
- Reflection으로 `List<T>` 필드와 요소 타입을 자동 해석. 새 테이블 타입을 추가할 때 베이스 에디터 코드를 건드릴 필요 없음
- 추가 후처리(예: 문자열 ContentID를 정규화된 ContentIDValue로 변환)가 필요한 테이블은 `PostProcessImportedAsset`을 override해서 SO 단위로만 책임지도록 분리

30개 이상의 테이블 타입이 같은 인터페이스로 통합됐고, 새 테이블 추가가 몇 줄의 override로 끝나면서 작업 시간이 눈에 띄게 줄었습니다. 이후 다른 팀원들도 이 베이스로 테이블을 추가하는 것이 팀 표준으로 자리 잡았습니다.

## 배운 것 - DI + MVVM의 한계 관찰

이 프로젝트에서 VContainer 기반 DI + MVVM을 실제로 적용해 봤는데, 동작 자체는 깔끔했지만 DI 컨테이너의 학습 비용이 팀 전체로 번지고 MVVM과 섞이면서 의존 그래프를 읽기 어려워지는 구간을 관찰했습니다. 여기서 얻은 관점이 이후 ETERNA의 3계층 설계로 이어졌습니다. NPC 퀘스트 시스템 구현과 서버팀에 대한 FlatBuffers 프로토콜 정리·요청도 병행했고, REIW와 ETERNA가 병행되던 시기에 저는 ETERNA로 배치를 옮겼습니다.
