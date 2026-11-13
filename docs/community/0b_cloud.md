# 대기열 0b — 장판(구름) 지속 피해 (2026-11-13 10시 KST 실행)

메커니즘 항목이라 무기 세팅은 모으지 않았습니다. 엔진·데이터 수정 없음.

## 읽은 출처
- 공식 포럼 696706 "What makes the Pox such an effective status weapon" 1·2쪽 — 글 날짜는 추출본에 없음, 사용자 분석(개발자 글 아님)
- warframe.fandom.com/wiki/Pox — 옛 위키(공식 위키 이전 뒤 갱신이 멈춘 사본일 수 있음), 수정 날짜 안 보임
- 저장소의 위키 무기 데이터(`data/raw/wiki_secondary.lua`·`wiki_primary.lua`)와 게임 데이터(`Secondary.json`)
- 못 읽음(우회 안 함): 공식 위키 Pox·Zakti Prime·Mutalist Cernos·Overguard·Enemy Level Scaling(권한 시간 초과), fandom Zakti·Zakti Prime·Mutalist Cernos(같은 사유). arca.live·Reddit·YouTube 안 열음.

## 주장과 판정
| 주장 | 출처 | 판정 |
|---|---|---|
| 폭스 구름은 탄 하나당 1초에 한 번 피해 | 포럼 696706 (사용자) | ❓ 공식 위키 문장 없음. 위키 데이터의 구름 공격 `FireRate = 1`(폭스·코다 폭스·세르노스·토리드)과는 맞지만, 이 값이 틱 간격이라는 설명이 데이터에 없음 |
| 구름은 겹친다 — 두 발이면 초당 상태이상 두 배 | 포럼 696706, fandom 팁 "stacked gas clouds" | △ 두 출처가 같은 말, 공식 위키 미확인 |
| 구름 상태이상은 무기 원소 조합(부식·화염 등)으로 걸림 | 포럼 696706 (처음 반대한 작성자도 나중에 인정) | △ 공식 위키 미확인 |
| 폭스 구름 3.6m, 4초 | fandom Pox | ❌ 지금 위키 데이터는 2.5m, `EffectDuration = 5` — fandom이 옛 수치 |
| 직격과 구름은 상태이상을 따로 굴림 | fandom Pox | ✅ 계산기도 따로 계산(구름은 아직 안 넣음) |

## 새로 본 것 — 자크티 '가스 구름'은 지속 피해가 아닐 수 있음
위키 데이터에서 지속 구름(폭스 20 독·5초, 코다 폭스 35 독·5초, 뮤탈리스트 세르노스 5 독·10초, 토리드 40 독·10초)은 모두 `EffectDuration`이 있고 `FireRate = 1`입니다. 자크티(가스 80, 3.5m)·자크티 프라임(가스 100, 3.8m)의 'Gas Cloud'는 `EffectDuration`이 없고 `FireRate`가 본 사격과 같은 5입니다 — 다른 무기의 직격 + 폭발 짝과 같은 모양이라, 한 번 터지는 폭발일 가능성이 큽니다(게임 설명: "darts that anchor themselves in their target before erupting in a plume of toxic gas").

지금 계산기는 자크티를 다트 직격(30)만으로 계산합니다(`NO_PAIR` 'cloud'). 가스 폭발이 한 번 터지는 것이면 한 발 피해의 약 77%(프라임 100/130)가 빠진 것이고, 전체 점검의 '자크티·자크티 프라임 전멸 60초 초과' 표시의 원인일 가능성이 큽니다. 공식 위키 Zakti 문서의 문장으로 확인되면 `NO_PAIR`에서 자크티 둘을 빼서 직격 + 폭발로 묶기만 하면 됩니다(엔진 수정 불필요). 이번에는 문서를 못 읽어 바꾸지 않았습니다(P1).

## 남은 것
- 폭스·코다 폭스·세르노스·토리드: 공식 위키에서 틱 간격 문장(또는 패치 노트) 확인 → 몇 초에 걸친 지속 피해 모델 필요(즉시 반복 `PART_REPEAT`는 맞지 않음).
- ~~자크티 둘~~ → 2026-11-13 16시 v2.14 반영(아래).

## 같은 실행에서 고친 것 (계산기 밖)
- 야간 점검(`community-check.yml`)이 v2.13 푸시 때 `git pull --rebase` 전에 빌드가 바꾼 파일 때문에 실패("cannot pull with rebase: You have unstaged changes", 실행 99) → 보고서 커밋 뒤 작업 트리를 정리하고 받도록 수정. 주간 점검(`sweep.yml`)도 같은 줄이라 같이 수정.

## 2026-11-13 16시 — 자크티 반영 (v2.14)
읽은 출처: Overframe 131876(UltimoFive, 30.5, 2021-02 작성·2021-07 수정), 119668(StripeyStripe, 30.8, 2021), 20081(Quaaktasche, 27.1, 2020 — 일반 자크티), 874945(39.0, 2025-07 — 글 없음). 네 글 모두 모드 칸이 글자로 안 보여 세팅은 기록하지 않음(kind read 0). 공식 위키 Zakti·Zakti Prime·Set Mods·Riven Mods는 이번에도 권한 시간 초과(PROVENANCE_REQUIRED) — 우회 안 함. arca.live·Reddit·YouTube 안 열음.

| 주장 | 출처 | 판정 |
|---|---|---|
| "Darts explode in a 3.8 meter radius after 1 second on impact with a surface or an enemy" | Overframe 131876 | ✅ 위키 데이터(자크티 프라임 Range 3.8, 다트의 자식 공격, 지속 시간 없음)와 일치 → 한 번 터지는 폭발 |
| "The 1 second delayed explosion from the darts" | Overframe 119668 | ✅ 같은 내용. 1초 지연은 계산하지 않음(투사체 비행 시간과 같은 취급, 무리 처치 시간에 약간 낮게) |
| "~70% of the damage is in the gas explosion" | Overframe 20081 (일반 자크티) | ✅ 위키 데이터 80/110 = 73% |
| "Explosions cause Self-Stagger" / 펄미네이션을 빼는 이유가 자해 경직 | Overframe 131876·119668 | △ 생존·조작 문제 — 계산 밖(처치 속도만). 계산기 1위에 프라임드 펄미네이션이 들어가므로 가까운 거리에서 경직을 피하려면 갈바나이즈드 샷 등으로 바꿀 것을 참고로 |
| "Gas: 97.9% chance/tick" | Overframe 119668 | ❓ 'tick'이라는 말뿐, 틱 수·지속 없음 — 가스 상태이상 구름(일반 가스 상태이상)과 섞어 쓴 표현으로 봄 |
| 가스 + 바이러스 + 화염이 인페스티드에 부식·단일 가스보다 낫다 | Overframe 131876 | ❓ 이번에 계산 안 함(세팅 모드 목록을 못 읽음) |

결정: 위키 데이터 구조(지속 구름은 모두 `EffectDuration`·연사 1, 자크티는 둘 다 없음) + 두 글의 "1초 뒤 폭발" 문장으로 한 번 터지는 폭발로 확정, `NO_PAIR`에서 빼서 직격 + 폭발로 묶음(convert.py, 근거 주석). 검사 `v2.14` 추가(고치기 전 빌드에서 FAIL 확인).

결과(전체 점검과 같은 조건, Lv150 12명 전멸 그/코/인): 자크티 프라임 77.3/29.7/45.5 → 19.4/11.3/14.5초, 자크티 117.5/47.9/73.3 → 41.1/22.6/26.6초. 두 무기 모두 '장판 피해 미반영'·'전멸 60초 초과' 표시가 사라짐(다음 주간 점검에서 반영). 1위: 세미-피스톨 캐노네이드·갈바나이즈드 디퓨젼·스코치·프라임드 펄미네이션·피스톨 엘리멘탈리스트·호넷 스트라이크·슈어 샷·프라임드 타겟 크래커 + 세컨더리 에너베이트(자크티 프라임).

남은 것: 폭스·코다 폭스·뮤탈리스트 세르노스·토리드 지속 구름(틱 간격) — 대기열 0b에 그대로.

## 2026-11-14 00시 (KST) — 토리드 독 구름 (v2.15)

읽은 출처: 일본 위키 [Torid](https://wiki3.jp/warframe/name/Torid) (본문 앞 40% 원문 + 나머지 요약, 갱신일 표시 없음 — 패치 이력 최신 핫픽스 27.4.3). 공식 위키 Pox·Mutalist Cernos·Torid와 일본 위키 Pox·MutalistCernos는 권한 시간 초과로 못 읽음. arca.live·Reddit·YouTube 안 열음. 직접 읽은 세팅 0(메커니즘 항목).

| 주장 (출처) | 판정 | 근거 |
| --- | --- | --- |
| 독 구름은 10초 동안 3m 반경에 지속 피해 ("dealing damage over time for 10 seconds over a 3-meter radius") | ✅ | 위키 데이터 EffectDuration 10, Range 3 |
| 구름 총 피해 400 (표 '合計ダメージ 400'), 업데이트 14.2 "Now has 40 DPS in Gas Cloud" | ✅ | 위키 데이터 독 40 · FireRate 1 → 1초마다 40 × 10 = 400 |
| "Damage dealt by clouds diminishes with distance" | ✅ | 위키 데이터 Falloff 0→3m, 감소 100% (엔진 감쇠 그대로) |
| "Clouds do not instantly do damage" (빠른 적은 피해 없이 지나감) | △ | 계산 밖 — 10틱을 한 발에 합쳐 높게 나옴 |
| 구름 여러 개가 쌓여 큰 피해 ("stacks multiple gas clouds") | △ | 문장은 팁 수준, 겹침 규칙 원문 없음. 장기 평균으로는 한 발 = 400이 같음 |
| 파이어스톰이 구름 크기를 키움 (핫픽스 14.5.2) | ❓ | 구름 반경에 파이어스톰 적용 여부는 엔진 기존 처리 그대로, 이번에 확인 안 함 |

계산기 수정 v2.15: 구름 연사 1(=틱 간격)이 유탄 연사 1.5와 달라 묶이지 않던 것을 묶고 10틱으로(convert.py PART_REPEAT·fr_ok). 기본 공격 '유탄 한 발 전체 피해' = 직격 100 + 구름 40 × 10. 커뮤니티 세팅(인카논 형태)에는 영향 없음 — 점검표 토리드 표시 0건. 회귀 112개 통과(새 검사는 고치기 전 빌드에서 '구름 틱 0'으로 실패 확인).

남은 것: 폭스(EffectDuration 5)·뮤탈리스트 세르노스(Duration 10) 틱 간격 — 토리드처럼 위키 데이터 FireRate 1이 틱 간격일 가능성이 높지만, 그 무기 문서 원문으로 확인 전에는 넣지 않음(P1).
