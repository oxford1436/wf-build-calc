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
- 자크티 둘: 위키 Zakti 문서로 한 번 터지는지 확인 → `NO_PAIR`에서 빼기.

## 같은 실행에서 고친 것 (계산기 밖)
- 야간 점검(`community-check.yml`)이 v2.13 푸시 때 `git pull --rebase` 전에 빌드가 바꾼 파일 때문에 실패("cannot pull with rebase: You have unstaged changes", 실행 99) → 보고서 커밋 뒤 작업 트리를 정리하고 받도록 수정. 주간 점검(`sweep.yml`)도 같은 줄이라 같이 수정.
