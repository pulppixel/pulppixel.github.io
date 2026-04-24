# Prop & Landmark Guide

## 원칙

1. **덩어리가 실루엣이다**  
   자잘한 디테일을 쌓는 대신, 덩어리로 인식되는 실루엣을 우선.  
   크리퍼는 얼굴 4픽셀이면 충분하다.

2. **그리드 정렬**  
   모든 블록은 `scale` 그리드 (기본 0.5 world unit)에 정확히 스냅.  
   회전은 `0 / 90 / 180 / 270` 도만. 비스듬한 블록은 금지.

3. **난잡함 금지**
    - 한 존에 major landmark 3개 이하
    - 한 존에 medium decoration 5개 이하
    - 자연 filler(나무/꽃/바위)는 랜드마크 주변 밀도 줄임

4. **색은 팔레트에서만**  
   `core/palette.ts`의 `ZONE_PALETTE`에 정의된 색만 사용.  
   새 색이 필요하면 팔레트에 먼저 추가.

---

## 스케일 기준

비유: 캐릭터 키를 "사람 한 명"(1.5~2 unit)으로 잡으면,

| 분류 | 크기 (world unit) | 예시 |
|------|------|------|
| 소형 prop | 0.5 ~ 1.5 | 꽃, 버섯, 작은 돌 |
| 중형 랜드마크 | 2 ~ 3 | 우물, 보물상자 |
| **대형 랜드마크** | **4 ~ 8** | **오두막, 네더 포털** (각 존 주인공) |
| 초대형 | 10+ | 용암 폭포, 엔드 기둥, 비콘 빔 |

**`buildVoxel`의 `scale` 옵션**: 기본 `0.5`. 큰 랜드마크는 `0.6~0.8`로 올려도 됨 (블록이 커 보여 마크 느낌이 강해짐). 작은 디테일 prop은 `0.3~0.4`.

---

## `buildVoxel` 사용법

`core/helpers.ts`에서 제공. 2D 문자 패턴을 voxel 그룹으로 변환.

### 기본 형식

```typescript
const pattern: string[][] = [
  // y=0 (바닥 레이어)
  [
    "WWW",   // z=0 행, x=0..2
    "WDW",   // z=1 행 (가운데 문)
    "WWW",   // z=2 행
  ],
  // y=1 (위 레이어)
  [
    "WWW",
    "W.W",   // '.' = 빈 공간
    "WWW",
  ],
];

const colorMap = {
  'W': 0xc8a878,   // 나무
  'D': { color: 0x4a3318, roughness: 0.6 },  // 문
};

const house = buildVoxel(pattern, colorMap, { scale: 0.6 });
house.position.set(5, 4.0, -18);   // 존 플랫폼 위
scene.add(house);
```

### y/z/x 축 대응

```
y축 = 위쪽 (배열 인덱스 0 = 바닥, 오름차순으로 쌓임)
z축 = 깊이 (레이어 안의 행, 인덱스 0 = 전방)
x축 = 너비 (행 안의 문자 인덱스, 0 = 왼쪽)
```

**패턴 읽는 법**: "바닥부터 한 층씩 쌓는다"로 생각하면 직관적.

### emissive / 반투명

```typescript
const colorMap = {
  'O': 0x1a0f2e,                               // 흑요석 (불투명)
  'P': {                                        // 네더 포털
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.7,
  },
};
```

### 옵션

| 옵션 | 기본값 | 설명 |
|------|------|------|
| `scale` | `0.5` | 블록 한 변 world unit |
| `center` | `true` | XZ 중앙 정렬. `false`면 (0,0,0)에서 +x/+z로 |
| `castShadow` | `true` | 그림자 생성 |
| `receiveShadow` | `true` | 그림자 받음 |

---

## 성능 메모

같은 색 voxel은 `mergeGeometries`로 한 mesh로 병합됨.  
랜드마크 하나에 50-80 voxel을 써도 **draw call은 색 종류 수만큼**만 생김.  
예: 오두막이 나무+지붕+문+창문 = 4색이면 draw call 4개.

단, 그룹 위치/회전은 움직여도 개별 voxel은 움직일 수 없음.  
만약 **흔들리는 문**이나 **회전하는 크리스털** 처럼 부품 단위 애니메이션이 필요하면:
- 움직이는 부분은 별도 `buildVoxel` 호출로 만들고 별도 그룹으로 추가
- 예: `body = buildVoxel(..)`, `lid = buildVoxel(..)`; `chest.add(body); chest.add(lid);`  
  그 다음 `lid.rotation.x`를 애니메이션.

---

## 추가 시 체크리스트

- [ ] 색은 `ZONE_PALETTE`의 해당 존 키에서만 가져왔는가
- [ ] 그리드에 스냅되는가 (회전 0/90/180/270만)
- [ ] 캐릭터 키 기준 크기가 적절한가 (major = 4+ unit)
- [ ] 존당 major landmark 3개 제한을 지켰는가
- [ ] 주변 자연 filler 밀도는 조정했는가