# 묶음 19 — 처치·조건부 아케인 (2026-11-10 22시 KST 실행)

대상: 프라이머리/세컨더리 머시리스·데드헤드·덱스터리티, 프라이머리 디빌리테이트, 프라이머리 플레이티드 라운드, 캐스케디아 플레어. 무기 세팅 대신 커뮤니티의 메커니즘 설명 글을 모아 게임 데이터(`data/raw/Arcanes.json` 최대 랭크 문장)·계산기와 대조.

## 읽은 출처 (직접 읽음)
- ProGameTalk, Michael James, 2025-12-19 — https://progametalk.com/warframe/how-to-get-primary-debilitate/
- Ackbar 리뷰 블로그, 테넷 플링크스(2022-12-11, 작성 당시 버전 기준) — https://ackbarwarframe.blogspot.com/2022/12/review-tenet-plinx-u3224.html
- Dev Workshop "The Arsenal Divide" ([DE]Rebecca, 2021, devtrackers) — https://devtrackers.gg/warframe/p/a78f90f1-dev-workshop-the-arsenal-divide
- Shacknews 1999 아케인 목록(2024-12) — 대상 아케인 없음

못 읽음: 위키 Primary Debilitate·Primary Merciless(웹 읽기 권한 시간 초과), 위키 Primary Plated Round·ggwtb 아케인 가이드(client_error). arca.live·Reddit·YouTube는 이 환경에서 안 열어 근거로 쓰지 않음. 무기 세팅(kind read)은 0개, 주장 시험(claim) 0개(분석 스크립트로 아케인만 바꿔 계산).

## 주장과 판정

| # | 주장 (출처) | 판정 | 근거·숫자 |
|---|---|---|---|
| 1 | 디빌리테이트는 합성 상태이상 10중첩 이상인 적에게 발동 (ProGameTalk) | ✅ | 게임 데이터: "If an enemy has 10 stacks of a combined Status Effect, inflicting the same Status Effect again has a 100% chance to inflict one of the base Status Effects" |
| 2 | "only triggers once per damage instance" — 같은 합성 상태이상이 **다시 걸릴 때** 발동 (ProGameTalk + 게임 데이터) | ✅ → **v2.09 수정** | 계산기는 탄(명중)마다 발동시켰음. 합성 상태이상이 걸린 횟수(탄 수 상한)로 고침. 소마 프라임 바이러스 세팅(상태이상 낮음) 아케인 없음 대비 ×2.33 → ×1.53, 테넷 글랙시온 방사능 세팅 ×1.43 → ×1.40(상태이상이 높아 거의 그대로). 검사 추가 |
| 3 | 더해진 기본 상태이상은 별도 피해라 팩션 피해가 각 지속 피해에 다시 곱해짐 (ProGameTalk) | △ | 계산기가 v1.6x부터 이 가정으로 계산(engine `dShare`). 위키 원문은 못 읽음 — 게임 데이터 문장에는 없음 |
| 4 | 랭크 0 50% → 랭크 5 100% (ProGameTalk) | ✅ | 게임 데이터 최대 랭크 100% |
| 5 | 머시리스: 처치 시 +30% 4초, 12중첩, 재장전 +30% (Dev Workshop, 6초 → 4초 변경 포함) | ✅ | 게임 데이터 일치, 계산기 `stk 12`·재장전 상시(v1.58) |
| 6 | 데드헤드: 약점 처치 시 +120% 24초, 3중첩, 헤드샷 배율 +30% (Dev Workshop) | ✅ | 게임 데이터 일치(업데이트 44에서 '헤드샷' → '약점'), 계산기 헤드샷 조건에서 +360%·`hsMult 0.3` |
| 7 | 덱스터리티: 근접 처치 시 +60% 20초, 6중첩 (Dev Workshop) | ✅ | 게임 데이터 일치, v1.97 반영 |
| 8 | "세 아케인 모두 최대치는 같고 가는 길이 다르다" (Dev Workshop) | ✅ | 12×30 = 3×120 = 6×60 = +360% |
| 9 | 플링크스 기본 사격은 데드헤드가 맞다 — 훨씬 적은 처치로 최대 (Ackbar) | △ | 약점 처치 3번이면 최대(머시리스는 12번, 4초 안). 계산기 기본 조건은 헤드샷 제외라 데드헤드 효과 0 — 헤드샷 비율을 넣었을 때만 비교 의미 |
| 10 | 캐스케디아 플레어는 화염 상태이상이 느린 무기에서 잘 안 쌓임 (Ackbar) | ✅ | 게임 데이터 "On Heat Status Effect: +12% Damage for 10s. Stacks up to 480%" — 계산기는 화염 상태이상 빈도로 중첩(v1.56 한꺼번에 만료) |
| 11 | 캐스케디아 어큐러시/오버차지가 머시리스·플레어보다 DPS가 높다 (Ackbar, 갈바나이즈드 샷 플링크스) | △ | 구르기 후 약점 명중·오버실드 유지가 조건 — 계산기는 `manual`(직접 고를 때만) |

## 계산 (테넷 글랙시온, 방사능 베일런스, 기본 조건, 같은 8칸 — 아케인만 바꿈)
v2.09 뒤: 플레이티드 라운드 1.95 · 디빌리테이트 1.84 · 머시리스 1.78 · 아케인 없음 1.31(점수). 아케인마다 다시 검색한 1위(v2.08, beam 20)는 플레이티드 2.01 · 디빌리테이트 1.87 · 머시리스 1.82.

## 남은 것 (대기열 19b)
- 디빌리테이트 10중첩 유지 비율(`up`)이 표적이 오래 맞는다고 보는 근사 — v1.99 이레디에이트처럼 표적이 죽기 전 발 수로 바꿔야 함. 한두 발에 죽는 적에게는 과대.
- 플레이티드 라운드 공식은 위키 원문을 이번에도 못 읽음(코드 주석의 v1.96 인용 그대로).
