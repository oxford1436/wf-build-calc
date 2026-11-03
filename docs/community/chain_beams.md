# 연쇄·도탄 공격 — 위키 수치 (2026-11-04 위키 API로 직접 읽음)

v1.71에서 반영: 인카논 형태 11종 (convert.py `CHAIN`). 아래는 아직 미반영(인카논 아님). "PT" = 관통.

| 무기·공격 | 추가 대상 | 거리 | 넘어갈 때 피해 | 관통 규칙 | 위키 문장 |
|---|---|---|---|---|---|
| 앰프렉스 | 최대 3 | 서로 10m | 50% → 25% → 12.5% | 관통으로 맞은 적마다 새 3연쇄 | "100% for the main target, 50% for the first in the chain, 25% for the 2nd, and 12.5% for the 3rd" |
| 아토모스 | 3 | 처음 대상 7m | 75% → 56.25% → 42.19% | 관통 대상마다 따로 연쇄 | "Punch Through will cause the main beam to chain independently from each additional target hit" |
| 쿠바 누코르 | 2 | 주 대상 9m | 각 50% (고정) | 같음 | "Each chain beam does 50% of the main beam's damage" |
| 테넷 사이크론 | 2 | 7m | 각 60% (고정) | 고유 관통 1m, 관통 대상마다 2연쇄 | "Each chain beam does 60% of the main beam's damage" |
| 테넷 글랙시온 | 3 | 서로 8m | 이전의 50% | 관통 대상마다 새 3연쇄 | "50% of the previous chain's damage" |
| 게이즈 (보조) | 최대 2 | 5m | 0.2^n | 고유 관통 1m | "A chain will do 0.2^n times the main beams damage" |
| 라크스퍼(프라임) 일반 | 3 | 6m (대기권) | 80% → 64% → 51.2% | 관통이 따로 연쇄 | "100% … 80% … 64% … 51.2%" |
| 바스무 보조 사격 | 빔마다 최대 5 | 7m | 0.5^n | 미기재 | "0.5^n times the main beam's damage" |
| 베르미스플라이서 | 3 | 6m | 각 70% (고정) | 연쇄는 관통 영향 없음, 1명에서만 | "Each tendril does 70% of the main tendril's damage" |
| 그리모어 보조(구체) | 2 | 6m | 처음과 같음 | — | "Each chain hit does the same amount of damage as the initial electric bolt." 멀티샷 33.3%마다 연쇄 +1 |

공통: "Headshotting the original target does not affect the chain damage." / "Enemy corpses will still allow the beam to connect to nearby enemies."
충돌: Continuous Weapon 문서는 "Punch Through will cause the beam to rapidly recalculate which enemies are chained to, spreading out on the damage, but not increasing it", "Mods like Firestorm will increase the range at which a beam can link" — 무기 문서와 반대. 넣을 때는 무기 문서 기준 + 열린 문제로.
