## 배경

보이저 합류 후 처음 맡은 프로젝트로, 일본 출시를 목표로 한 팀 서바이벌 게임입니다. 이전의 멀티플레이어·네트워크 경험을 인정받아 합류 직후부터 5단계 게임 루프 전반, 채팅, AI NPC 같은 핵심 시스템을 배정받았습니다.

전제 조건이 하나 있었습니다. IW라는 서비스가 이미 운영 중이었고, 우리가 만드는 것은 그 안에 들어갈 게임이었습니다. 그래서 게임을 별도 서브모듈로 개발하고 완성 단계에서 본 서비스에 병합하는 구조로 진행됐습니다.

![IW Zombie - 캠프파이어 논의 단계. 채팅 UI와 스티커, 음성 채팅이 통합된 화면](/images/iw_chat1.png)

## 5단계 게임 루프 - Server-side FSM

탐색 → 방어 → 식사 → 논의 → 생존 판정으로 이어지는 게임의 뼈대입니다. `BaseZombieState`를 베이스로 Exploration / Defense / HaveMeal / Discussion / SurvivalResult 5개 상태 + CutScene / GameEnd 2개 상태로 분기했습니다. Dedicated Server 환경에서 상태 전이를 서버가 일관되게 관리하고, 클라이언트는 상태 브로드캐스트를 받아 렌더링만 담당하는 구조로 분리했습니다. 각 단계의 전투 로직과 UI(인벤토리, 채팅, 논의 팝업)도 함께 구현했습니다.

![IW Zombie - 식사 단계. 플레이어가 성공적으로 식사하는 장면](/images/iw_scene.png)

## 채팅 - Tencent IM 첫 도입

SDK 선정은 사전 R&D로 정해져 있었습니다. 비교 검증에서 성능이 가장 좋았고, 일본 시장 대응에도 유리하다는 판단이었습니다. 다만 팀에 도입 사례가 없어 통신 환경 구축부터 구현까지 전부 맡았고, 스티커 같은 부가 기능은 SDK에 기대지 않고 직접 만들었습니다. 여기서 쌓은 경험이 이후 REIW와 ETERNA의 채팅 아키텍처로 이어졌습니다.

4개 클라이언트에서 World / Team / Attraction 채팅이 동시에 동작하는 모습입니다.

![IW Zombie - 4개 클라이언트에서 World, Team, Attraction 채팅이 동시에 동기화되는 화면](/images/iw_chat7.png)

## AI NPC - Behavior Tree

행동 튜닝을 코드 수정 없이 디자이너 손에서 끝내는 게 목표였습니다. Enemy 행동을 `EnemyFinding` / `EnemyPatrol` / `EnemySearchTarget` / `EnemyBeginAttack` Task로 쪼개고, Aggro 시스템은 `EnemyLowestHpAggroIncrease` Task로 분리(최저 HP 타겟 가중치 상승)해서, 디자이너가 트리 형태로 행동 조합을 바꿔가며 튜닝할 수 있게 했습니다.

## 풀링 - 스폰 빈도가 만든 문제

좀비 스폰/소멸 빈도가 높아 GC와 네트워크 오버헤드가 체감될 수 있는 환경이었습니다. Netcode 풀 핸들러(NetworkObjectPool)를 직접 만들어 오브젝트를 재사용했고, 같은 이유로 3D 사운드도 풀링 시스템을 설계해 재생 시마다 발생하는 생성 비용을 없앴습니다.

![IW Zombie - 3D 사운드 풀링. ZombieSfxItem이 풀링되어 AudioSource 범위가 시각적으로 표시된 에디터 화면](/images/iw_sfxpool.png)

## 범용 디버그 치트 시스템

5단계 루프를 반복 검증해야 하는 팀을 위해 치트 시스템을 범용으로 설계했습니다. 모든 치트 명령을 `e_ZombieShortCutCommand` enum 하나로 모아 IDE 자동완성과 타입 안전성을 확보하고, 문자열 prefix로 적용 범위를 분리(`/t`는 팀, `/a`는 모두, 기본은 본인)했습니다. `hp++5`, `weapon--3` 같은 parameterized 명령은 일반 명령보다 먼저 파싱하고, 실제 실행은 ServerRpc로 돌려서 치팅을 구조적으로 막았습니다.

## 본 서비스 병합

개발 막바지에는 서브모듈로 개발해 온 게임을 운영 중인 IW 본 서비스에 통합하는 작업이 남았습니다. 약 1개월에 걸친 병합 작업을 팀과 함께 완료했습니다.

## 결과

게임은 목표대로 일본에 출시됐습니다. 팀 최초의 Tencent IM 도입 경험과 Dedicated Server 기반 게임 루프 설계는 이후 프로젝트(REIW, ETERNA)에서 그대로 기반이 되었습니다.
