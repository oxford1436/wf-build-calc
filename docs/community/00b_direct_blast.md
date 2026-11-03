# 대기열 0 — 직격·폭발 이름이 다른 무기 묶기 (2026-11-03, v1.63)

메커니즘 수정 항목이라 커뮤니티 세팅 수집은 하지 않았습니다(무기 세팅은 해당 묶음 3 런처·5 활에서).

## 원인
`src/convert.py`는 같은 발의 직격·폭발을 이름(`core()`: Impact/Explosion 등을 지운 나머지)이 같을 때만 묶었습니다. 위키 공격 표에서 이름이 다른 경우(Grenade Impact ↔ Grenade Detonation, Charged Shot ↔ Initial Blast ↔ Bubble Collapse, Direct Hit ↔ Detonation, Slug Impact ↔ Glass Explosion, Grenade Impact ↔ Rocket Explosion)는 기본 공격이 직격만 계산됐습니다.

## 고친 방식
위키 무기 데이터(Module:Weapons/data)의 `AttackParentIndex`(이 폭발이 어느 공격에서 나왔는지)로 먼저 묶고, 없으면 기존 이름 규칙. 위키에 부모 표시가 없는 두 무기는 표(`PAIR_EXTRA`)로:
- 스터그: "Blobs then deal two ticks of damage in a 2 meter radius before exploding" (wiki Stug) → 덩어리 피해 2회 + 폭발(1.5초 뒤)
- 이븐송: 충전 화살 + Charged Radial Attack(같은 충전 1.2초)

한 발에 여러 번 맞는 부분(`PART_REPEAT`):
- 프로보시스 세르노스 촉수: "tick damage twice on all affected enemies before exploding", 폭발은 "after 1.7 seconds" (wiki Proboscis Cernos)
- 스터그 덩어리 2틱 (위)

렌즈 확인(wiki Lenz): 충전 화살 직격(충격 확정) → "Initial explosion has a guaranteed Cold proc in a 7.2 meter radius" → "1.3 seconds after the Cold effect, another explosion occurs in a 7.2 meter radius, dealing very high Blast damage". 세 부분 모두 한 발. 예외: 아군 명중 시 폭발 없음, 폭발은 시야 필요.

합치지 않은 것(`NO_PAIR`):
- 캐스타나스·생티 캐스타나스: 비행 중 기폭과 박힌 뒤 기폭은 둘 중 하나
- 폭스·자크티·자크티 프라임·뮤탈리스트 세르노스의 독 구름: 몇 초간 여러 번 피해, 틱 간격이 데이터에 없음 → 대기열 0b

새로 묶였지만 무기의 주 사격이 아닌 것은 고를 수만 있고 기본 공격은 그대로(`alt`): 퀀타·퀀타 반달·테넷 퀀타 큐브, 세도 글레이브, 쿨스타 집속탄, 스커지 프라임 창, 세풀크럼 조준 모드, 뮤탈리스트 콴타 구체, 레이텀·벡티스 인카논 폭발.

## 결과 (Lv150 그리니어/코퍼스/인페스티드 12명 전멸, 초)
| 무기 | 전 | 후 |
| --- | --- | --- |
| 렌즈 | 172.3 / 49.5 / 76.8 | 15.6 / 4.8 / 6.2 |
| 프리즈마 렌즈 | 80.4 / 21.9 / 34.1 | 8.7 / 3.4 / 4.2 |
| 펜타 | 135.6 / 69.9 / 95.9 | 54.5 / 18.5 / 28.9 |
| 세큐라 펜타 | 46.8 / 24.4 / 34.5 | 18.8 / 7.5 / 11.5 |
| 카민 펜타 | 51.4 / 26.6 / 36.2 | 24.6 / 9.1 / 13.6 |
| 아에그리트 | 233.2 / 112.0 / 156.1 | 9.8 / 3.4 / 5.0 |
| 아스틸라 | 23.7 / 12.7 / 17.7 | 19.7 / 8.5 / 11.9 |
| 아스틸라 프라임 | 15.2 / 8.3 / 11.5 | 13.2 / 5.5 / 8.0 |
| 아카리우스 | 38.3 / 20.1 / 26.9 | 17.5 / 6.7 / 10.2 |
| 아카리우스 프라임 | 30.6 / 15.9 / 21.3 | 10.4 / 3.3 / 5.2 |
| 테넷 엔보이 | 55.8 / 14.1 / 22.3 | 11.5 / 3.9 / 4.9 |
| 스터그 | 369.7 / 227.0 / 331.5 | 33.9 / 20.3 / 26.9 |
| 이븐송 | 29.1 / 9.0 / 13.3 | 16.7 / 9.0 / 10.2 |

남은 표시: 캐스타나스(비행 중 기폭만, 60초 초과 — 묶음 11에서 반경 피해로 계산되는지 확인), 폭스(60초 초과)·자크티·뮤탈리스트 세르노스(독 구름, 0b).

## 점검표 '계산기 1위보다 강함' (테넷 아르카 플라즈모어 자성 베일런스 101%)
묶음 1에서 이미 확인(자성 베일런스 ≈ 독 베일런스 ±2%). 2% 안 근소 차이는 고른 쪽을 위로 두는 규칙(v1.58 `robust`) 범위라 엔진 문제 아님.

## 출처
- https://wiki.warframe.com/w/Lenz
- https://wiki.warframe.com/w/Stug
- https://wiki.warframe.com/w/Proboscis_Cernos
- 위키 무기 데이터 `data/raw/wiki_primary.lua`·`wiki_secondary.lua` (AttackParentIndex, ExplosionDelay)
