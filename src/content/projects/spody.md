## 배경

빔프로젝터로 바닥에 콘텐츠를 투사하고, 깊이 센서로 아이들의 발과 손 터치를 인식하는 시스템입니다. 1인 개발로 시작해 총 432개 스크립트(약 6만 줄) 규모까지 키워낸 프로젝트로, 양산 체계를 구축한 뒤에는 매달 2~3개씩 총 25개 이상의 교육 모듈을 납품했습니다.

![SPODY 현장 - 벽면에 투사된 콘텐츠와 상호작용하는 사용자들](/images/spody_field.png)

::youtube XSo_ycmWtjQ SPODY - 콘텐츠 시연 영상

## 센서 파이프라인

프로젝트의 핵심인 `KinectTouchManager`는 깊이 센서의 입력을 Unity UI 터치로 변환하는 파이프라인입니다.

- Kinect V2 `DepthFrameReader`로 매 프레임 깊이 데이터를 읽음
- Body Tracking으로 양손 좌표를 추출하고, `CoordinateMapper`로 깊이->컬러 좌표 변환
- OpenCV `PerspectiveTransform`으로 센서 좌표 -> 스크린 좌표로 최종 매핑
- `EventSystem.RaycastAll`로 Unity UI 이벤트를 시뮬레이션
- 커스텀 인터페이스 `IKinectTouchClick`으로 터치 이벤트 전달

## 캘리브레이션 - 비개발자용 자동 세팅

- **자동 캘리브레이션** - OpenCV `FindChessboardCorners`로 체스보드 패턴을 자동 인식, 4점 좌표를 `PerspectiveTransform`으로 매핑
- **수동 캘리브레이션** - 폴백용. 화면 4개 꼭짓점을 직접 터치해서 보정
- 캘리브레이션 결과를 `ModelManager`에 영속 저장, 재시작 시 자동 로드

![SPODY 콘텐츠 - 다트 게임. 캐릭터가 다트판을 향해 던지는 교육 콘텐츠](/images/spody_dart.png)

## 양산 체계

- 각 콘텐츠 모듈이 자기 네임스페이스로 격리 - 모듈 간 충돌 방지
- Manager / Controller / Data 폴더 구조를 공유 - 새 콘텐츠 시작 시 템플릿 복사
- 이 구조 덕분에 이후 합류한 개발자들이 빠르게 콘텐츠 제작에 투입 가능

::youtube hiCKpCWk27U SPODY - 펜타곤(아이돌) 체험 영상

## 성과

- 누리 교육 과정 콘텐츠를 성남, 수원 유치원 다수에 납품
- 광주 광산구청, 광명 하안도서관 등 공공기관 납품
- 인도네시아 수출 버전 출시
- 영업에 동행해 유아와 교사가 실제로 사용하는 모습을 관찰하고, 그 피드백을 개발에 반영

![SPODY - VR 광산구청 시연식](/images/spody_vr.jpg)
