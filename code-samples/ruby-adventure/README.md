# 루비의 모험 — 코드 샘플

> 2019 · 1인 개발 3D 액션 RPG · 홍익대학교 졸업전시 우수상  
> 71개 스크립트 중 12개 선별

## 포함된 파일

### 플레이어 시스템
- **`PlayerController.cs`** — 5-state FSM (`state`/`nextState` 이중 변수). 마우스 클릭 하나로 이동/공격/스킬 통합. NavMesh를 끄고 수동 물리로 점프하는 Skill 1이 특히 복잡합니다.
- **`CharacterCombat.cs`** — 공격 쿨다운 + 애니메이션 종료 체크(`waitAnimating`). Attack 0~4 콤보.
- **`CharacterStats.cs`** — HP/데미지/방어력 베이스. HP 자동 재생 Coroutine. `EnemyStats`가 이것을 상속.
- **`Stat.cs`** — `baseValue` + `List<int>` modifier 패턴. 장비/버프 효과를 유연하게 적용.

### 몬스터 AI
- **`EnemyController.cs`** — NavMesh 추적형. `lookRadius`/`attackRadius` 이중 감지 범위.
- **`Enemy.cs`** — `Interactable`을 상속하여 적도 "상호작용 오브젝트"로 통합.
- **`MageController.cs`** — 원거리 마법사. Coroutine으로 주기적 투사체 생성.
- **`BulletController.cs`** — 유도탄. 1.5초마다 플레이어 방향으로 방향 갱신.

### 상호작용 · 인벤토리
- **`Interactable.cs`** — 반경 감지 + UnityEvent 콜백. 태그별 분기 (Enemy/Quest/Chest/Door). Door는 Key 아이템 보유 체크.
- **`Item.cs`** — ScriptableObject 기반 아이템 데이터.
- **`Inventory.cs`** — Singleton + delegate(`OnItemChanged`)로 UI 자동 갱신.

### UI
- **`DialogueManager.cs`** — Queue 기반 대화. 한 글자씩 타이핑하는 Coroutine.
