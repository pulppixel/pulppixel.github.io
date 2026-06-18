## 배경

홍익대학교 게임소프트웨어전공 졸업작품으로 기획부터 구현까지 1인 개발한 3D 액션 RPG입니다. 2019 졸업전시 우수상을 수상했고, 졸업생 대표 4인 중 1인으로 재학생 대상 발표를 진행했습니다. 71개 스크립트, 약 3,600줄.

![루비의 모험 - 보스 전투. 마법진 위의 대형 보스와 플레이어 캐릭터](/images/ruby_boss.png)

::youtube UvK9WCjA23g 루비의 모험 - 플레이 영상

## 플레이어 FSM

`PlayerController`에 직접 설계한 상태 머신을 구현했습니다. 5가지 핵심 상태를 이중 변수(state/nextState) 기반의 커스텀 상태 머신(FSM)으로 설계하여, 매 프레임 명확한 조건 검사와 상태 전이가 이루어지도록 로직을 구조화했습니다.

- 마우스 우클릭 하나로 이동과 공격을 통합 - Raycast로 바닥/적/인터랙트 오브젝트를 판별하고, 거리에 따라 이동 또는 즉시 공격으로 분기
- 스킬 입력은 어떤 상태에서든 쿨다운 + 마나 조건만 충족하면 즉시 전이

![루비의 모험 - 일반 전투, 플레이어 FSM이 스킬셋으로 구성되어 있다.](/images/ruby_fight.jpg)

## 전투, 스킬 시스템

- **콤보 공격** - `CharacterCombat`에서 `waitAnimating()`으로 현재 공격 애니메이션(Attack 0~4) 종료를 체크한 뒤 다음 공격 트리거. 쿨다운 기반 연타 방지
- **점프 공격 (Skill 1)** - NavMesh를 끄고 수동 물리로 점프. 마우스 커서 방향으로 착지점 결정(Ray), 벽/적/바닥 케이스별 분기. 착지 시 BoxCollider로 범위 넉백
- **연속기 (Skill 2)** - 4단 콤보 애니메이션을 Coroutine으로 제어. 애니메이션 상태 이름(`"Skill2_4"`)을 감지해 자동 종료
- **질주 (Skill 3)** - 시간제한 속도 증가 + 파티클 이펙트 + 효과음. Coroutine 타이머로 지속시간 관리

## 스탯, 데미지 시스템

`CharacterStats`를 베이스로 `EnemyStats`가 상속합니다. `Stat` 클래스는 modifier 패턴 - `baseValue`에 `List<int>` 수정치를 누적해서 장비/버프 효과를 유연하게 적용할 수 있는 구조입니다.

![루비의 모험 - 거대 간수로부터 도망가는 씬](/images/ruby_chasing.jpg)

## 몬스터 AI

- **일반 몬스터** - `lookRadius`에 진입하면 NavMesh 추적, `attackRadius`에 진입하면 멈추고 공격
- **원거리 마법사** - 플레이어를 바라보며 일정 간격으로 투사체 생성. `BulletController`가 유도탄처럼 주기적으로 방향 갱신
- **웨이브 스포너** - 복수 스폰 포인트에서 주기적 생성, 타이머 기반 생존 판정

## 상호작용, 인벤토리, 대화

- `Interactable` 베이스 클래스에 반경 감지 + `UnityEvent` 콜백. 태그 기반으로 Enemy/Quest/Chest/Door 분기
- `Item`을 `ScriptableObject`로 정의. `Inventory` Singleton + delegate로 UI 자동 갱신
- `Queue<string>` 기반 대화 시스템. 한 글자씩 타이핑하는 Coroutine

## 성과

2019 홍익대학교 게임학부 졸업작품전시 우수상 수상. 졸업생 대표 4인 중 1인으로 선정되어 재학생 대상 발표를 진행했습니다.

![루비의 모험 - 상장](/images/ruby_award.jpg)

![루비의 모험 - 당시 발표자 명단](/images/ruby_good.jpg)
