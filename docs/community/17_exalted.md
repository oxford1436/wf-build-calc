# 묶음 17 익절티드 무기 (2026-11-10 10시)

대표 무기: **익절티드 엄브라 블레이드**(+일반 익절티드 블레이드 — 검색 상위 익절티드 세팅 글이 가장 많음: HighGround·Nerd Stash·Gfinity·Overframe 4개), **레귤레이터 프라임**(메사 프라임 피스메이커 — Overframe 레귤레이터 항목 세팅 글 6개). 대기열 후보였던 뉴트럴라이저는 읽을 세팅 글을 찾지 못해 메커니즘만(계산기 `mult` 1.25 × 위력, 변경 없음).

## 읽은 출처
| 출처 | 날짜 | 읽은 것 |
|---|---|---|
| [HighGround Gaming 엄브라](https://www.highgroundgaming.com/warframe-best-excalibur-umbra-build/) (Justin Moniquette) | 2024-11, 2025-02 수정 | 익절티드 블레이드 **모드 8개 글자** → `builds/exalted_umbra_blade.json` read |
| [The Nerd Stash 엄브라](https://thenerdstash.com/?p=523133) (Sid Natividad) | 2024-01 | **모드 8개 글자** → read |
| [Gfinity 엑스칼리버](https://www.gfinityesports.com/warframe/warframe-excalibur-build-guide-how-to-obtain-craft-and-best-builds/) | 표기 없음 | 일반 익절티드 블레이드 모드 8개 글자(그중 'Voltaic Blade'는 없는 모드 이름) → `builds/exalted_blade.json` read, 인식 못 함 표시 |
| [Overframe 467279](https://overframe.gg/build/467279/) | 표기 없음 | 부식+화염 / 방사능+독(아콘 컨티뉴이티 부식) 설명 — 모드 칸 그림 → 설명만 |
| Overframe 944701·724825 | 2025-12 / 2024-09 | 수치 블록만, 모드 글자 없음 → 미사용 |
| [Gamertweak 메사 프라임](https://gamertweak.com/warframe-mesa-prime-guide-best-peacemaker-build) (Raj) | 2020-07 | 레귤레이터 **모드 8개 글자** → `builds/regulators_prime.json` read |
| Overframe 177993·940647·331371·27826 | 2020~2025-12 | 레귤레이터 설명만(모드 칸 글자 없음) |
| keengamer 20405 | 표기 없음 | 모드가 그림 → 미사용 |
| [Dev Workshop: Exalted Weapon Changes](https://devtrackers.gg/warframe/p/9c5141d3-dev-workshop-exalted-weapon-changes-ash-retouch) (DE_Saske) | 2025-03 | 익절티드 아케인 칸·익실러스·연속기/텐노카이 모드·검기로 텐노카이 발동 |
| [Ackbar U38.5](https://ackbarwarframe.blogspot.com/2025/03/u385-exalted-weapon-arcanes-titania-and.html) · [공식 포럼 1228814](https://forums.warframe.com/topic/1228814-do-arcanes-work-with-exalted-weapons) | 2025-03 / 표기 없음 | 아케인 칸 같은 내용 |

못 읽은 곳: 위키 Exalted Blade·Exalted Umbra Blade(권한 시간 초과), Chromatic Blade(client_error) — 우회 안 함. 검기 수치는 저장소 `docs/mechanics/gaps_melee.json`(위키 Exalted Blade 원문 인용, 이전 전수 조사)로 확인. arca.live·Reddit·YouTube 안 열음.

## 계산기 수정 v2.07 — 검기(에너지 웨이브)
위키 Exalted Blade(저장소 인용): "Normal, slide, and aerial attacks will emit a 3 meter-wide energy wave … Energy waves have the same base damage as the attacks that release them", "The energy waves and Exalted Blade itself are considered separate entities and will both deal damage separately", 관통, "lose 20% of their damage each time they hit an enemy", "falls off linearly with distance from 100% to 0% between 0 and 70m".
- 일반 공격 = 휘두르기 + 검기 두 부분(convert.py `EX_WAVE`). 검기는 표적을 2m 거리 감쇠(97%)로 한 번 더 치고, 표적 뒤 폭 3m(+몸 폭) 줄 안의 적(무리 밀도 × 폭 × 평균 깊이 8R/3π, v1.91 관통과 같은 기하) — 12명 무리에서 평균 약 1.0명 — 을 k번째마다 0.8^k, 평균 깊이 감쇠로 맞힘(engine `waveAoe`).
- "40%/s 감소"는 같은 거리 감쇠를 시간으로 쓴 것으로 봄(30 m/s → 70m에서 93%) — 따로 곱하지 않음(가정, 주석).
- 텐노카이 세팅에서도 검기 부분 유지(전에는 텐노카이가 있으면 부분이 [휘두르기, 텐노카이]로 바뀌었음).
- 결과: 엄브라 HighGround 세팅 ×1.95, Nerd Stash ×1.97. 계산기 1위 구성은 그대로(마스터즈 엣지·갈바나이즈드 스틸·프라임드 프레셔 포인트·프라임드 피버 스트라이크·블러드 러쉬·버서커 퓨리·쇼킹 터치·오르건 섀터·퀴크닝 + 밀리 듀플리케이트).
- 남은 것: 강공 십자 검기(폭 10m, 맞혀도 안 줄어듦, 연속기 배율 미적용) 미구현, 엄브라·프라임 위키의 "40m까지 관통"과 일반 70m 차이(표적 뒤 평균 깊이 약 9.5m라 영향 없음).
- 회귀 검사 1개(검기 부분 + 엄브라 세팅 1.5배 초과). 고치기 전 빌드에는 검기 부분이 없어 실패.

## 주장 판정 (기본 조건: 강철의 길 150·250·400, 3팩션, 12명, 처치 중첩 0부터, 위력 100%·프레임 미선택)
| 주장 | 출처 | 판정 |
|---|---|---|
| 익절티드 무기에 아케인 칸 | Dev Workshop·Ackbar·포럼 | ✅ 계산기 1위 밀리 듀플리케이트 — 2025-03 이전 세팅에 아케인이 없는 이유 |
| 검기로도 연속기·텐노카이 | Dev Workshop | ✅ 1위의 마스터즈 엣지(빼고 컨디션 오버로드면 19%) |
| 크로매틱 블레이드가 가장 중요한 모드(에너지 색 원소) | HighGround | ❓ 계산기는 상태이상 +300%×위력만, 원소 변환 미구현 — 위키 못 읽음 |
| 컨디션 오버로드가 피해를 크게 올림 | HighGround | △ 1위(텐노카이)에는 안 들어감, 오르건 섀터 대신 넣으면 93% |
| 부식이 새 메타 | Nerd Stash | △ 1위도 부식(쇼킹 터치 + 프라임드 피버 스트라이크) ✅, Nerd Stash 세팅은 글 순서대로면 독이 냉기(노스 윈드)보다 먼저라 바이러스+전기로 계산됨(글의 칸 순서가 실제 칸 순서인지 모름) |
| 엄브라가 아니면 상태이상 우선 | Gfinity | ❓ 일반·엄브라 블레이드 데이터가 같음(치명타 15%·2배, 상태이상 15%) — 차이는 엄브라 패시브·새크리피셜 세트 |
| 레귤레이터 치명타 25%·3배 → 치명타 모드 | Overframe 177993 | ✅ 데이터 치명타 25%(배율은 터네이셔스 본드 포함 여부에 따라), 1위에 프라임드 타겟 크래커 |
| 갈바나이즈드 샷이 메사에게는 별로(호넷 스트라이크와 비슷) | Overframe 27826 (2020) | △ 위키: 피스메이커 +150%는 호넷 스트라이크와 합연산 — 호넷과 갈바나이즈드 샷 둘 다 같은 칸에서 희석. 무리: 1위에서 호넷으로 바꾸면 85%(아케인 없음 74%), Gamertweak 세팅에서 호넷 → 갈바나이즈드 샷 ×1.25. 보스(처치 없음): 호넷 ×1.47 |
| 호넷 같은 고정 피해는 갈바나이즈드 샷이 대신하니 피함 | Overframe 940647 (2025-12) | ✅ 무리(위와 같음) |
| 아케인은 세컨더리 아웃버스트가 최고 | Overframe 940647 | ❓ 계산기 아케인 목록 확인 안 함(1위는 세컨더리 에너베이트) |

## 메타와 다른 이유 (P7)
- 엄브라 커뮤니티 세팅 2개는 2024-01·2025-02로 업데이트 38.5(2025-03, 익절티드 아케인·텐노카이) 이전 형식. 같은 아케인 없음 조건 1위의 10.3%(HighGround)·13.6%(Nerd Stash) — 대부분 마스터즈 엣지 텐노카이(빼면 19%)와 블러드 러쉬(빼면 66%). 새크리피셜 스틸·프레셔를 갈바나이즈드 스틸·프라임드 프레셔 포인트 대신 넣으면 82%·90%(세트 효과 포함 계산).
- 레귤레이터 Gamertweak(2020)는 아케인 없음 1위의 73% — 갈바나이즈드 계열 이전 형식(호넷 → 갈바나이즈드 샷 ×1.25). 1위 아케인 세컨더리 에너베이트.
- 계산 밖: 크로매틱 블레이드 원소 변환, 검기 강공, 레귤레이터 20점사 램프(피해 +7.5% → +150%, 연사 0.25 → 1.0배 — 위키 gaps, 일반 레귤레이터는 "multiplicative to final damage", 프라임 문장에는 없음). 램프는 모든 세팅에 같이 곱해져 순위 영향이 작다고 보고 이번에 넣지 않음.

엔진 수정 v2.07 1건. 질문 0.
