# 묶음 21 — 엑시무스·오버가드·강철의 길 적 (2026-11-11 10시 KST 실행)

메커니즘 묶음이라 무기 세팅 대신 오버가드 수치·규칙을 확인하고, 계산기 1위의 자성 칸(마그네틱 캐퍼시티)이 엑시무스 1명의 오버가드에 얼마나 기대는지 계산했습니다. 직접 읽은 세팅 0, 주장 시험 0(분석 스크립트로 오버가드 양만 바꿈).

## 읽은 출처 (본문을 연 것만)
- 공식 포럼 'Eximus Reborn: Dev Workshop' — devtrackers.gg 사본(https://devtrackers.gg/warframe/p/a711333c-eximus-reborn-dev-workshop), [DE]Marcus, 2022-04-20. 출시 전 설계 글, 수치 없음.
- Destructoid 'Warframe Overguard Explained'(https://www.destructoid.com/warframe-overguard-explained-what-is-it/), 2023-11-13. 수치 없음.
- 포럼 'Eximus are not the problem'(https://forums.warframe.com/topic/1312320-eximus-are-not-the-problem) — 플레이어 의견만, 날짜·수치 없음.
- devtrackers 2020 '+250% armor from steel path' 사본 — 강철의 길 체력·방어력·실드 배율 이야기(2020 테스트), 오버가드 언급 없음.
- GitHub daMarxrider/wfcalc README — 다른 계산기. 강철의 길은 "health and shields ×2.5 (armour unchanged)"(원문), 오버가드 공식 문장은 요약에서만 보여 근거로 쓰지 않음.

못 읽은 곳: 위키 Overguard·Enemy Level Scaling·Eximus(권한 시간 초과), 포럼 'Overguard Scaling'(1308893)·'Overguard investiagation'(1306617)(client_error), wfcalc docs/formulas.md(권한 시간 초과). arca.live·Reddit·YouTube는 열지 않음. 미러(breezewiki)는 쓰지 않음.

## 주장과 판정
| 주장 | 근거(원문) | 계산기 | 판정 |
|---|---|---|---|
| 오버가드 양은 엑시무스 종류와 관계없이 같고 레벨로만 커짐 | Dev Workshop "Overguard will scale by level but will be the same amount across all Eximus enemy types." Destructoid "they'll have the same Overguard points." | `overguardAt(level)` 하나 | ✅ |
| 오버가드는 체력·실드 배율과 따로 더해지는 값 | Dev Workshop "Overguard is an additive amount independent of Enemies Health/Shield scaling" | 체력·실드 공식과 별도 | ✅ |
| 방어력은 오버가드에 안 걸림 | Dev Workshop 댓글 답 "Nope"(요약에서만 읽힘) | `land()` 오버가드 단계에 방어력 없음 | △(원문 아님) |
| 보이드에 특히 약함 | Dev Workshop "Overguard is particularly susceptible to Void damage" | `p.ogM` | ✅ |
| 냉기는 4중첩까지 | Dev Workshop "susceptible to a maximum of 4 Cold Status Effects at one time" | `nk ≤ 4` (og > 0) | ✅ |
| 오버가드 중에는 방사능 상태이상 무효 | Dev Workshop "Overguarded enemies will be unaffected by Radiation Status Effects" | 방사능은 군중 제어라 계산 밖 | ✅(영향 없음) |
| 오버가드는 다시 차지 않음 | Dev Workshop "Once taken out, Overguard does not regenerate!" | 한 번 깎으면 끝 | ✅ |
| 기본 12 × (1 + 260 × (레벨−1)^0.9) (Lv150 약 28.2만, 250 약 44.7만, 400 약 68.4만) | 이번에도 위키 원문 못 읽음 | engine `overguardAt` | ❓ |
| 강철의 길이 오버가드도 2.5배 하는지 | 읽은 글에 없음(wfcalc README는 체력·실드만 ×2.5라고 적음 — 오버가드 언급 없음) | 계산기는 안 곱함 | ❓ |
| 자성이 오버가드에 추가 피해(실드처럼), 바이러스는 안 됨 | 이번에 읽은 글에는 없음 — 이전 실행의 위키 Overguard 확인(engine.js targetsAt 주석) | `magM` 오버가드에도 적용, `vm` 미적용 | ✅(이전 확인) |

## 자성 칸이 오버가드에 얼마나 기대나 (기본 조건: 강철의 길 150·250·400, 3팩션, 12명 + 엑시무스 1, 처치 중첩 무리마다 0부터)
분석 스크립트(오버가드 값만 곱함, 엔진 변경 없음):

| 무기 | 기본 1위 | 마그네틱 캐퍼시티 → 차선(같은 칸) | 엑시무스 없으면 | 오버가드 ×0.4 | 오버가드 ×2.5 |
|---|---|---|---|---|---|
| 소마 프라임 | 마그네틱 캐퍼시티 포함 | 95.7%(와일드파이어) | 1위에서 빠짐 — 기본 1위는 90.2%, 와일드파이어로 바꾸면 109% | 빠짐(기본 1위 94.9%) | 남음(바꾸면 80.8%) |
| 액셀트라 프라임 | 마그네틱 캐퍼시티 포함 | 90.2%(크리티컬 딜레이) | 빠짐 — 기본 1위 91.7%, 바꾸면 104.6% | 빠짐(기본 1위 97.9%) | 남음(바꾸면 71.8%) |

- 결론 △: 자성 칸 몫(4~10%)은 **전부** 엑시무스 1명의 오버가드에서 나옴(엑시무스를 빼면 오히려 5~9% 손해). 오버가드가 지금 모델의 40%면 자성 칸이 1위에서 빠지고 커뮤니티 세팅(크리티컬 딜레이·와일드파이어/멀리그난트 포스)과 같아짐. 반대로 강철의 길이 오버가드도 2.5배 하면 자성 칸 가치가 2배(10% → 28%).
- 그래서 커뮤니티가 자성을 거의 안 쓰는 이유(META '오버가드 대응은 자성')는 "엑시무스가 드물고 오버가드가 생각보다 빨리 깨진다"는 판단과 같은 방향 — 오버가드 공식(기본값·강철의 길 배율)이 1위를 정하는 가정이라 위키 원문 확인이 필요. 근거 없는 수치는 넣지 않아 엔진은 그대로(사용자 결정 '엑시무스 기본 포함'도 그대로).
- 대기열 21b로 남김: 위키 Overguard·Enemy Level Scaling 원문(기본값·Lv45~50 전환·강철의 길 배율·자성 배율)을 읽는 실행에서 `overguardAt`와 대조.

## 숫자 참고
- 오버가드(계산기) Lv150 281,865 · Lv250 447,451 · Lv400 683,971.
