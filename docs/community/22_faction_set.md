# 묶음 22 — 팩션 모드·세트 모드 (2026-11-11 16시 KST 실행)

메커니즘 묶음이라 무기 세팅 대신 팩션 피해(베인·클렌즈·익스펠·스마이트, 프라임드)와 세트 모드(글래디에이터·비질란테)의 규칙을 위키·커뮤니티 글로 확인하고, 계산기에서 실제 가치를 쟀습니다. 계산 대표 무기: 소마 프라임(소총, 팩션 모드·비질란테), 니카나 프라임(근접, 스마이트·글래디에이터) — 이전 묶음에서 커뮤니티 세팅을 이미 모은 무기.

## 읽은 출처 (본문을 연 것만)
- 위키 [Faction Damage Bonus](https://wiki.warframe.com/w/Faction_Damage_Bonus) — 날짜 표기 없음(패치 기록 29.10까지).
- Sportskeeda [What is double-dipping in Warframe?](https://sportskeeda.com/mmo/what-double-dipping-warframe) — 날짜 없음(레일잭 모드 언급).
- 위키 [Gladiator Set](https://wiki.warframe.com/w/Gladiator_Set) — 짧은 문서(세트 효과·블러드 러쉬 노트).
- 공식 포럼 [heavy attacks x2 crit … bloodrush and gladiator](https://forums.warframe.com/topic/1329400-clearly-broken-heavy-attacks-x2-crit-interaction-with-bloodrush-and-gladiator-mod-set-is-broken/) — 2022-10-30~11-05, 보관됨, DE 답 없음.
- ProGameTalk [Vigilante Mods](https://progametalk.com/warframe/vigilante-mods-guide/) — 2022-01-06 작성, 2026-02-26 갱신 표기.
- 공식 포럼 [Primed Bane of the Grineer … worth it](https://forums.warframe.com/topic/598786-anyone-did-the-math-on-primed-bane-of-the-grineer-when-is-it-worth-it-if-ever) — 2016-01-23.
- 공식 포럼 [why bane of corrupted](https://forums.warframe.com/topic/1388173-why-bane-of-corrupted) — 3월 22~23일(연도 표기 없음, 머머 모드 이후).
- 공식 포럼 [auto switch bane mod …](https://forums.warframe.com/topic/1387891-qol-suggestion-auto-switch-bane-mod-or-maybe-deprecate-it-with-an-umbra-mod) — 3월 18일(연도 없음).

못 읽은 곳: 위키 Bane Mods·Critical Hit·Blood Rush/Crit Calculation(client_error), breezewiki Set Mods(접근 거부), arca.live·Reddit·YouTube(예약 실행에서 안 엶). 직접 읽은 무기 세팅 0(메커니즘 묶음).

## 주장과 판정
| 주장 | 근거(원문) | 계산기 | 판정 |
|---|---|---|---|
| 팩션 모드 최대 ×1.30, 프라임드 ×1.55 | 위키 "up to x1.30 for regular mods and x1.55 for Primed ones" | Mods.json "x1.3/x1.55 Damage to …" → `bane` 0.30/0.55, 베인·클렌즈·익스펠·스마이트 × 그리니어·코퍼스·인페스티드·오로킨·머머 전부 | ✅ |
| 로어 등 팩션 피해는 서로 더하고, 기본 피해 모드와는 곱함 | 위키 Roar "additive with other sources of Faction Damage, and multiplicative with other types of bonus of damage", 예시 100 × (1 + 1.65) × (1 + 0.5 + 0.3) = 477 | `fac = facAll + bane` 합연산, 피해 계열과 곱 | ✅ |
| 상태이상 지속 피해에는 팩션 피해가 두 번 | 위키 "applied a second time to Damage over Time (DoT) from status effects", Roar 팁 "slash, heat, toxin, and gas clouds -- all get affected twice" | 출혈·화염·독·가스(+전기) 틱에 두 번, 폭발 상태이상도 두 번(v1.80 위키 Blast) | ✅ (전기는 Sportskeeda만 — △) |
| 그리니어·코퍼스·인페스티드 모드는 커럽티드·나르메르에 무효, 인페스티드 모드는 테크롯에 무효 | 위키 "have no effect on their Corrupted or Narmer counterparts", "Infested Faction Mods have no effect on Techrot" | 팩션 키가 따로(커럽티드는 오로킨 모드만) | ✅ |
| 머머용 팩션 모드가 있음(최근 추가) | 포럼 1387891 "only recently expanded them to Murmur", 위키 팩션 목록 "The Murmur" | 베인·클렌즈·익스펠 오브 더 머머 있음 | ✅ |
| 글래디에이터 세트: 연속기 배율마다 치명타 +10%~+60%, 블러드 러쉬와 더해 최대 +100% | 위키 "+10%/+20%/+30%/+40%/+50%/+60% Melee critical chance per Combo Multiplier", "stacks with Blood Rush, for a total of +100%" | `a.glad` = 0.1 × 세트 수(최대 6), 블러드 러쉬와 같은 칸 × (연속기 배율 − 1) | ✅ |
| 블러드 러쉬·글래디에이터는 강공 치명타 2배를 받지 않음 | 포럼 1329400 답글 "never had the x2 bonus crit chance for heavy attacks. That's only on mods that actually say that"(플레이어 주장, DE 답 없음) | 강공 2배는 모드 치명타(`a.cc`)에만, 블러드 러쉬·글래디에이터 칸은 안 곱함 | △ |
| 비질란테 세트: 1개당 5%(최대 6개 30%) 확률로 치명타 한 단계 상승 | ProGameTalk "a certain chance to enhance your critical hits, causing them to increase by 1 tier", 표 5~30% | `a.vigil` = 0.05 × 세트 수(최대 0.3), 치명타가 난 발만 한 단계 | ✅ (주무기에만 적용인지는 ❓) |
| 세트 구성: 비질란테 무기 4 + 프레임 2, 글래디에이터 무기 3 + 프레임 3 | ProGameTalk 표(아마먼트·퍼버·오펜스·서플라이즈 + 퍼슈트·비거) | `SETS` + 앱 프레임 조각 입력(글래디 0~3, 비질 0~2) | ✅ (글래디에이터 구성은 이번에 못 읽음, 이전 기록 그대로) |
| 프라임드 베인은 두 번째 90% 원소 모드보다 낫다 | 포럼 598786(2016) OniGanon 계산 "+5.18% vs 2nd element" | 아래 표: 소마 프라임 그리니어 1위에 프라임드 베인이 들어감(빼면 99.7%), 니카나 프라임 인페스티드 1위에 프라임드 스마이트(빼면 85.5%) | ✅ (무기에 따라 크게 다름) |
| 팩션 모드는 지나친 피해(오버킬), 내구전이 아니면 필요 없음 | 포럼 1388173 "massive overkill unless your goal is endurance runs" | 강철의 길 150~400 처치 속도 기준으로는 출혈 위주 근접에서 +17%, 치명타 소총에서 +0.3% | △ (낮은 레벨이면 맞음, 강철의 길에서는 상태이상 위주 무기에서 틀림 — 지속 피해 두 번 적용 때문) |
| 커럽티드 모드가 인기인 이유: 강철의 길 서킷의 70%가 커럽티드, 적 종류가 다양 | 포럼 1388173 | 계산 밖(콘텐츠 구성) | ❓ |
| 29.10 "Fixed the Bane Mods applying the increased Damage twice" | 위키 패치 기록 | 위키 본문은 지금도 지속 피해 두 번 — 수정 범위가 직격 쪽인 것으로 읽음 | ❓ (본문 기준 유지) |

판정: 맞음 9 · 조건부 3 · 틀림 0 · 미확인 2(커럽티드 인기 이유, 29.10 수정 범위). 주장 시험(kind claim) 0 — 분석 스크립트로 칸만 바꿈.

## 계산 (기본 조건: 강철의 길 150·250·400, 12명 + 엑시무스, 처치 중첩 무리마다 0부터, 빔 60, 앱과 같은 `candidateMods`·`optimize`·`evalBuild` 경로)
| 무기·조건 | 계산기 1위 | 측정 |
|---|---|---|
| 소마 프라임, 그리니어만 | 프라임드 크라이오 라운즈·멀리그난트 포스·갈바나이즈드 앱티튜드·갈바나이즈드 체임버·와일드파이어·하타-사트야·바이탈 센스·**프라임드 베인 오브 그리니어** · 프라이머리 플레이티드 라운드 | 프라임드 베인을 빼면 최선 대체(프라임드 슈레드) 99.7%, 일반 베인으로 바꾸면 83.1% |
| 니카나 프라임, 인페스티드만 | 드리머즈 라스·갈바나이즈드 스틸·프라임드 프레셔 포인트·몰튼 임팩트·버서커 퓨리·**프라임드 스마이트 인페스티드**·노스 윈드·글래디에이터 바이스·위핑 운즈 · 밀리 듀플리케이트 | 프라임드 스마이트를 빼면 최선 대체(컨디션 오버로드) 85.5%, 일반 스마이트 79.2% |
| 소마 프라임, 3팩션 | 갈바나이즈드 체임버·갈바나이즈드 앱티튜드·프라임드 크라이오 라운즈·인펙티드 클립·하타-사트야·바이탈 센스·마그네틱 캐퍼시티·프라임드 슈레드 | 비질란테 아마먼트를 넣으면 최선 85.4%, 비질란테 퍼버 81.0%; 프레임 비질란테 2개를 더하면 +2.2% |
| 니카나 프라임, 3팩션 | 드리머즈 라스·갈바나이즈드 스틸·프라임드 프레셔 포인트·프라임드 피버 스트라이크·버서커 퓨리·쇼킹 터치·글래디에이터 바이스·퀴크닝·오르건 섀터 | 글래디에이터 마이트를 넣으면 최선 96.2%; 프레임 글래디에이터 3개를 더하면 **94.2%** (아래) |

- 팩션 모드는 팩션 하나를 고를 때만 후보(3팩션 평균에서는 빠짐) — 커뮤니티 "팩션마다 바꿔 낀다"(포럼 1387891 여러 답)와 같은 운용.
- 일반 베인/스마이트가 프라임드보다 16~21% 낮음: 계산기는 둘을 같은 계열로 동시 장착 불가 처리(`E.clash`).
- **글래디에이터 프레임 조각을 더하면 니카나 1위가 느려지는 이유(오류 아님)**: 1위 아케인이 밀리 듀플리케이트라 기본(노란) 치명타에서만 두 번째 타격 — 치명타 확률이 86.9% → 171%로 오르면 노란 치명타 비율이 줄어 듀플리케이트 효과가 줄어듦. 아케인 없이/인플루언스·애니모시티로는 2.73 → 3.82로 단조 증가, 듀플리케이트만 4.07 → 3.84. META ⑦(최적 치명타 (3M−4)/(2M−2), 위키 Melee Duplicate "On Base Critical Hits")과 같은 현상. 앱에서 프레임 조각을 입력하면 검색이 다른 아케인·모드를 고름.

## 메타와 다른 점 (P7)
- 이번 묶음은 메커니즘 확인이라 계산기와 커뮤니티 세팅을 나란히 비교하지 않음. 계산기 규칙이 위키와 모두 맞아 엔진 수정 없음.

## 남은 것 (22b)
- 비질란테 세트가 주무기에만 적용되는지(계산기는 주무기만), 새크리피셜 세트 효과 배율(계산기 `setMul`)을 위키 Set Mods·Sacrificial 문서로 확인. 전기 상태이상이 팩션 두 번 적용 대상인지(위키 목록에 없음, Sportskeeda는 포함).
