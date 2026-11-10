# 묶음 20 — 상태이상 메커니즘 (2026-11-11 04시 KST 실행)

메커니즘 묶음이라 무기 세팅 대신 커뮤니티의 상태이상 설명 글을 모아 계산기(engine.js)와 대조했습니다. 계산기 대상 무기 전체에 공통(같은 로직).

## 읽은 출처
| 출처 | 날짜 | 읽음 | 비고 |
|---|---|---|---|
| [cw-warframe-guides "Damage Types & Status Effects"](https://cw-warframe-guides.github.io/guides/mod-damage/) | "Last updated April 2026" | ✅ | 상태이상 표(중첩·지속·갱신)와 팁 |
| [ProGameGuides "All Warframe Damage Types, Explained"](https://progameguides.com/warframe/all-warframe-damage-types-explained/) | 날짜 없음 | ✅ | 업데이트 36 이전 체계(폭발 = 명중률 감소 등) |
| [Sportskeeda 업데이트 36.0 패치 노트](https://www.sportskeeda.com/mmo/warframe-update-36-0-patch-notes-jade-shadows-quest-new-gear-status-damage-mods) | 36.0(2024-06) | ✅ (본문 약 80%까지) | 상태이상 재작업 원문 옮김 |
| [공식 핫픽스 36.0.5](https://www.warframe.com/en/patch-notes/pc/36-0-5) | 2024-07 | ✅ | 수치 변경 없음(버그 수정만) |
| 위키 Puncture·Corrosive·Blast·Electricity Damage, Status Effect | — | ❌ 권한 요청 시간 초과(PROVENANCE_REQUIRED), 우회 안 함 | |

arca.live·Reddit·YouTube는 열지 않았습니다. 직접 읽은 세팅 0, 주장 시험 0(코드 대조).

## 주장 판정 (계산기 engine.js와 대조)
| 주장 | 출처 | 계산기 | 판정 |
|---|---|---|---|
| 바이러스: 체력 피해 +100% → 중첩마다 +25%, 10중첩 +325%(×4.25), 6초 | cw, ProGameGuides | `vm` 2 + 0.25(n−1), 6초 중첩마다 만료(v1.83) | ✅ |
| 바이러스가 출혈 같은 지속 피해에도 붙음 | ProGameGuides | `land()`에서 독·출혈·화염 모두 × `vm` | ✅ |
| 부식: 방어력 26% → 80%(10중첩), 8초 | cw, ProGameGuides, Sportskeeda("reducing the Armor by 80%") | 0.2 + 0.06n, 8초 | ✅ |
| 관통: 표적 치명타 확률 +5~25%(5중첩), 10초, 적 피해 감소 | cw | +5%/중첩 최대 +25%, 10초, 범위 피해 미적용. 적 피해 감소는 생존이라 계산 밖 | ✅ |
| 관통 10중첩·피해 감소 75%, 냉기 = 이동·연사 감소만, 폭발 = 명중률 감소 | ProGameGuides | — | ❌ 업데이트 36 이전 체계(Sportskeeda 36.0: "Removed the previous Status Effect of inaccuracy", 냉기 10중첩 상한·빙결). 글에 날짜가 없어 옛 설명이 그대로 남은 것 |
| 냉기: 치명타 피해 +0.05 → +0.45, 10중첩 빙결 3초(+1배) | cw | 첫 중첩 +0.1, 이후 +0.05(9중첩 +0.5), 빙결 +1.0 — META.md의 위키 원문("10% on the first stack, with an additional 5% per stack") | △ 빙결은 맞고, 첫 중첩 값은 위키와 0.05 다름(cw가 중첩마다 0.05로 셈). engine.js 머리 주석의 '+0.45'도 같은 오기라 고침(계산 코드는 원래 0.5) |
| 빙결된 적은 치명타 피해 2배, 실드 회복 안 함 | Sportskeeda 36.0 | 빙결 +1.0(위키 "doubles when frozen") | ✅ |
| 화염: 방어력 최대 50% 제거, 지속 피해, 갱신, 상한 없음 | cw, Sportskeeda | 0.5초마다 15/30/40/50%, 새 화염이 모든 중첩 갱신(v1.67) | ✅ |
| 전기: 3m 안 적에게 지속 피해 | cw, ProGameGuides | `n3`(반경 3m 적 수) | ✅ |
| 가스: 3m 구름, 중첩마다 커져 6m | cw, ProGameGuides | 3 + 0.3(n−1), 최대 6m | ✅ |
| 자성: 실드·오버가드 피해 +100~325%, 실드·오버가드가 깨지면 확정 전기 | cw, Sportskeeda | `magM`, 실드 깨질 때 중첩당 3%(최대 30%) 전기 | ✅ (실드 회복 감소는 처치 시간에 거의 무관해 미반영) |
| 폭발: 10중첩이면 5m 큰 폭발, 1.5초 지연 | cw, Sportskeeda | 0.3 × 기본 피해/중첩 1.5초 뒤 + 10중첩 범위 폭발(v1.71) | ✅ |
| 원소 지속 피해는 그 원소 모드만큼 커짐(화염 90% → 화염 상태이상 +90%) | cw | `bonus[T]` = 그 원소가 단독으로 남은 칸 값 | ✅ |
| 2차 원소 지속 피해는 구성 원소 모드로 안 커짐(가스는 가스 모드로) | cw | 가스는 `gasm`(리벤 접합 가스)만 | ✅ |
| 출혈은 베기 모드로 안 커짐 | cw | 출혈 `bonus.slash` 0 | ✅ |
| 상태이상 피해(엘리멘탈리스트 +90%)가 출혈·화염·전기·독·폭발·가스 지속 피해를 키움 | Sportskeeda 36.0 | `sd` 0.9, 지속 피해·폭발에 곱함 | ✅ |
| 폭발은 폭발 모드로 커짐 | cw | 폭발 상태이상에 `blastm`(리벤 접합 폭발) 미적용 | ❓ 위키 미확인 — 가스와 같은 규칙이면 폭발 접합 리벤만 영향(일반 모드에는 단독 폭발 모드 없음), 근거 없어 넣지 않음 |
| 상태이상 지속이 폭발 지연을 늘림 | Sportskeeda 36.0 "Status Duration will increase the delay before the Status Effect applies and depletes" | 폭발 지연 1.5초 고정 | ❓ 공식 수치·공식 없음. 상태이상 지속 −리벤(쿠바 자르 −84.5%)이면 폭발이 빨라질 수 있음 — 위키 확인 전 미반영 |
| 팩션 약점: 그리니어 충격·부식, 코퍼스 관통·자성, 인페스티드 베기·화염, 오로킨 관통·바이러스 | cw, Sportskeeda | FACTIONS 표와 같음 | ✅ |
| 방어력 상한 2700(피해 감소 90%) | Sportskeeda 36.0 | `ARMOR_CAP` 2700, 0.9√(A/2700) | ✅ |

판정: 맞음 15 · 조건부 1 · 틀림 1(옛 체계 글) · 미확인 2. 엔진 계산 변경 없음(주석 오기 1줄만).

## 메타와 다른 이유
무기 세팅 묶음이 아니라 해당 없음. 이번 대조로 계산기의 상태이상 수치가 커뮤니티 최신 설명과 같다는 것을 확인 — 이전 묶음들에서 본 메타와의 차이(자성 칸, 관통 모드 등)는 상태이상 수치 때문이 아님. 자성 칸의 엑시무스 오버가드 몫은 묶음 21에서.
