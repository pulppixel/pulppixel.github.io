# SPODY — 코드 샘플

> 2020–2021 · XR 유아 교육 콘텐츠 · 초기 1인 → 5인 팀 리드  
> 432개 스크립트 중 2개 선별 (센서 파이프라인 핵심)

## 포함된 파일

### 센서 파이프라인
- **`KinectTouchManager.cs`** — 프로젝트의 핵심. 깊이 센서 입력을 Unity UI 터치로 변환하는 전체 파이프라인.
  - Kinect V2 `DepthFrameReader`로 매 프레임 깊이 데이터 수집
  - Body Tracking으로 양손 좌표 추출 → `CoordinateMapper`로 깊이→컬러 좌표 변환
  - OpenCV `PerspectiveTransform`으로 센서 좌표 → 스크린 좌표 매핑
  - `EventSystem.RaycastAll`로 Unity UI 이벤트 시뮬레이션
  - 커스텀 인터페이스 `IKinectTouchClick`으로 터치 이벤트 전달
  - 에디터에서는 마우스 클릭으로 폴백

### 자동 캘리브레이션
- **`AutoKinectPanel.cs`** — 비개발자가 현장에서 직접 센서 세팅을 할 수 있도록 만든 자동 캘리브레이션.
  - OpenCV `FindChessboardCorners`로 체스보드 패턴 자동 인식
  - 4개 꼭짓점을 `PerspectiveTransform`으로 매핑
  - 성공/실패 피드백 UI
  - `ModelManager`에 결과 영속 저장
