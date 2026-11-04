# 묶음 4 저격총 — 줌·저격 콤보 (2026-11-04 16시)

대표 무기: **페리게일 프라임**(Overframe 2026년 5~7월 세팅 글이 가장 많고 최신 — 업데이트 43 표기), **루비코 프라임**(아카라이브 대화 세션 글 173011037). 페리게일(일반)·저격 콤보·줌은 같은 계산 로직이라 함께 반영.

## 읽은 출처

| 출처 | 읽은 것 | 쓴 곳 |
|---|---|---|
| [Overframe 1014482 'Acuity Blast Crowd Eraser'](https://overframe.gg/build/1014482/perigale-prime/perigale-prime-acuity-blast-crowd-eraser-v100/) (Ntrophy, 2026-05~08) | 작성자 설명 'Why do we use?' 줄마다 모드 8개 + 데드헤드 | `kind: read` |
| [Overframe 1032843 'AOE Perigale Prime'](https://overframe.gg/build/1032843/perigale-prime/aoe-perigale-prime/) (2026-07) | 1~8칸 + 익실러스 + 아케인을 글로 적음(3번 칸 리벤 → 글이 제시한 해머 샷) | `kind: read` |
| [Overframe 1014601 'Headhunting Gale'](https://overframe.gg/build/1014601/perigale-prime/perigale-prime-headhunting-gale/) | 글에 갈바나이즈드 스코프만 — 세팅 기록 안 함 | — |
| [Ackbar 페리게일 리뷰](https://ackbarwarframe.blogspot.com/2023/01/review-perigale-u3228.html) (2023-01) | 모드 화면은 그림 — 주장만 | 주장 |
| [ProGameTalk 페리게일](https://progametalk.com/warframe/perigale/)·[페리게일 프라임](https://progametalk.com/warframe/how-to-get-perigale-prime-builds/)·[루비코 프라임](https://progametalk.com/warframe/weapon-builds/rubico-prime/) (2026-03~04 갱신) | 모드 칸이 그림, 글에는 일부만 — 세팅 기록 안 함 | — |
| Overframe 루비코 프라임 637685·723186·47061 | 모드 칸 글자 없음 | — |
| Overframe 4814 루비코 프라임 | 8칸을 글로 적었지만 2019년(업데이트 25.7) — 최신 패치 아님, 기록 안 함 | — |
| 위키 [Rubico Prime](https://wiki.warframe.com/w/Rubico_Prime)·[Perigale](https://wiki.warframe.com/w/Perigale)·[Sniper(Shot Combo)](https://wiki.warframe.com/w/Sniper)·[Fire rate](https://wiki.warframe.com/w/Fire_rate) | 메커니즘 원문 | 판정 |

아카라이브·레딧 본문은 예약 실행에서 열리지 않아 쓰지 않음(아카라이브는 `arca_2026-11-03.md`에 대화 세션에서 직접 읽은 요약만). Overframe 원본 페이지는 Cloudflare 확인이 걸려 우회하지 않음.

## 계산기에서 고친 것 (v1.69)

1. **점사 무기 연사** ✅ — 위키 Fire rate: "Fire Rate: Number of bursts per second if Burst Delay is 0 seconds … This is the 'Fire Rate' value listed in the arsenal", "Burst Count: Number of shots per burst", "Burst Delay: Delay between shots fired in a single burst". 계산기는 아스날 값(초당 점사 수)을 초당 발 수로 써서 페리게일을 초당 2발로 계산(실제 6.06발). 초당 발 수 = 발 수 ÷ (1/연사 + 발 수 × 간격) — 이 식은 게임 데이터(DE export fireRate)와 점사 무기 전부에서 정확히 일치(페리게일 6.06, 힌드 6.25, 버스턴 7.83, 시카루스 7.39, 쿼타크 6.33). 위키 본문 식은 (발 수 − 1) × 간격이라 최대 20% 높게 나와 게임 값과 맞는 쪽을 씀. 양수 연사는 선형, 음수 연사는 "Burst Delay is not affected by net negative Fire Rate bonuses"대로. 56개 공격. 페리게일 프라임 그리니어 Lv150 12명 전멸 17.4 → 8.3초.
2. **페리게일 프라임 = 저격총** ✅ — 위키 Class "Sniper Rifle", CompatibilityTags SNIPER_AMMO. 게임 데이터 분류(Rifle) 때문에 저격총 전용 모드(프라임드 체임버·샤프슈터·하코나 스코프)가 빠지고 돌격소총 전용 모드(테인티드 매그·스프링-로디드 체임버)가 들어갈 수 있었음.

## 메커니즘 확인 (계산기 대조)

| 내용 | 판정 |
|---|---|
| 저격 콤보: 맞힌 횟수마다 증가, 멀티샷 탄마다·관통·도탄 각각 1회, 범위·지속 피해는 안 셈, 조준 중에만 쌓이고 적용, 2초 동안 못 맞히면 1씩 감소, 첫 단계 1.5배 후 횟수가 3배 될 때마다 +0.5배, 전체 피해에 곱함 (위키 Sniper) | ✅ 엔진 `sniperM`(조준일 때만, 초당 발 수 × 멀티샷, 20초 평균)과 같음. 관통 명중은 안 셈(조금 과소) |
| 줌 치명타 피해: 루비코 프라임 1단 +35%·2단 +50%, 페리게일 2배 +20%·4배 +40%(바이탈 센스와 합연산) | ✅ 데이터 `zoom.cd` 0.5·0.4(최고 단계) |
| 루비코 프라임 수치(연사 3.67, 탄창 5, 치명타 38%·3배, 상태이상 16%, 피해 187) | ✅ 데이터와 같음 |
| 페리게일 고유 관통 1m (Ackbar "innate 1m Punch Through") | ✅ 위키 데이터 PunchThrough 1, 계산기 pt 1.0 |
| 페리게일 '갈 포스': "Landing 4 headshots in a burst or a headshot kill grants the 'Gale Force' buff, granting Infinite Ammo. The buff lasts 4 seconds and can be refreshed on subsequent chained headshots." | ❓→ 미반영(대기열 4b). 위키 노트(프라임드 체임버가 갈 포스 중 첫 발에만)로 보아 탄창도 줄지 않음 → 재장전 없음. 헤드샷 조건에서만 영향 |

## 주장 판정

계산 조건: 강철의 길 150·250·400, 3팩션 평균, 12명 무리(엑시무스 포함), 처치 중첩은 무리마다 0부터, 리벤 없음. '조준' = 줌·저격 콤보 적용, '헤드샷 100%' = 조준 + 모든 명중이 약점.

| 주장 (출처) | 계산 | 판정 |
|---|---|---|
| 루비코: 캐노네이드면 포인트 스트라이크 대신 크리티컬 딜레이 (아카라이브 173011037) | 기본 86%(점검표), 조준 95% (크리티컬 딜레이 세팅 = 100) | ✅ 캐노네이드가 연사 감소까지 고정(위키) |
| 루비코: 마지막 칸은 원소보다 세미-라이플 캐노네이드 (173011037) | 캐노네이드 → 해머 샷 61%(점검표)·서레이션 70% | ✅ 기본(조준 없음) · △ 조준이면 1위가 캐노네이드 대신 바일 액셀러레이션 + 프라임드 슈레드(연사·명중 수로 저격 콤보를 빨리 쌓음), 캐노네이드 세팅 93% |
| 페리게일: 프라이머리 어큐이티가 기본 칸 (Ntrophy) | 기본(헤드샷 없음)에서는 멀티샷을 1로 고정해 손해(갈바나이즈드 체임버 대신이면 26%). 헤드샷 50%·100%에서는 계산기 1위에 어큐이티·갈바나이즈드 스코프·데드헤드가 들어감 | △ 헤드샷 전제에서만 맞음 |
| 페리게일: 바일 액셀러레이션이 고유 관통 때문에 슈레드보다 낫다 (Ntrophy) | 헤드샷 100%: 바일 67.9% vs 프라임드 슈레드 68.2% | △ 같음(0.5% 이내). 갈 포스(재장전 없음) 반영 후 다시 볼 것 |
| 라이플 엘리멘탈리스트 관통 +0.6m (Ntrophy) | 계산기 데이터 sd 0.9·pt 0.6 | ✅ |
| 폭발(크라이오+써마이트) / 가스(멀리그난트+써마이트)로 무리 정리 (두 글) | 헤드샷 100%: 써마이트 → 라디에이티드 리로드 84%(+23%), 가스 세팅 52% | ❌ 계산상 냉기+방사능(+재장전)이 강함 — 단 갈 포스 미반영이라 재장전 몫이 과대일 수 있음 ❓ |
| 갈바나이즈드 스코프 헤드샷 처치마다 치명타 확률 +320% (1032843) | 계산기 데이터 cc 3.2(조준+헤드샷 처치) | ✅ |
| 엘리멘탈리스트 상태이상 피해 +64% (1032843) | 위키·계산기 최대 랭크 +90% | ❌ 글 수치 오기(낮은 랭크로 보임) |
| 저격 콤보가 점사의 발마다 쌓인다 (Ackbar) | 위키 "each successful hit … counts" | ✅ 엔진도 초당 발 수 × 멀티샷 |
| 연사는 갈 포스가 유지되면 순수 이득 (Ackbar) | 갈 포스 미반영 | ❓ 대기열 4b |

## 메타와 다른 이유 (P7)

- 계산기 기본 조건은 사용자 결정대로 **조준·헤드샷 제외**. 페리게일 프라임 커뮤니티 세팅 2개는 모두 헤드샷 전제(어큐이티·스코프·데드헤드)라 기본 조건에서 0.4~1% — 메커니즘 누락이 아니라 조건 차이(P8). 헤드샷 100% 조건에서는 계산기 1위가 커뮤니티 핵심 6칸(어큐이티·스코프·바이탈 센스·앱티튜드·크라이오·데드헤드)과 같고, 커뮤니티 세팅은 68%·52%.
- 남는 차이(라디에이티드 리로드·마그네틱 캐퍼시티 vs 바일·엘리멘탈리스트·써마이트)는 대부분 재장전·탄창 몫 — 갈 포스(헤드샷 중 탄약·탄창 무소모)를 넣으면 줄어들 것으로 보임(대기열 4b에서 확인).
- 루비코 프라임: 기본 조건에서 계산기 1위(캐노네이드·크리티컬 딜레이·크라이오·라디에이티드 리로드)가 아카라이브 주장 두 개와 맞음. 조준 조건에서는 1위가 연사 쪽으로 바뀜(저격 콤보).
- 저격총은 조준해야 저격 콤보·줌이 적용되는데 기본 조건은 조준 제외 → 저격총만 조준을 기본으로 할지 QUESTIONS.md에 질문 1개(루비코 프라임 그리니어 Lv150 전멸 8.4초 → 조준 3.9초).

## 인기 프레임 (대기열 F)

이번 실행에서 직접 읽은 글 중 프레임 조합을 적은 것은 Ntrophy("전역·범위 방어구 제거와 같이")와 위키 노트(보루나: 페리게일 최대 탄약 +24)뿐 — 보루나 탄약 보너스가 `src/buffs.js`에 있는지는 다음 실행(4b)에서 확인.
