# 대기열 M — META.md 팩트체크 (2026-11-03 04시 실행)

META.md의 ❓/확인 필요 항목 중 계산기에 영향이 큰 12개를 위키 원문으로 확인하고 계산기와 대조했습니다. 무기 세팅 수집이 아니라 메커니즘 확인이라 커뮤니티 세팅은 새로 넣지 않았습니다.

| # | 주장 | 판정 | 근거 | 계산기 |
|---|---|---|---|---|
| ① | 베일런스·고유 원소는 모드 다음에 조합, 독 베일런스+냉기+화염 = 폭발+독 | ✅ | 위키 Elemental Damage(META 2절) | 결과 일치. 검사 3개 추가(쿠바 자르, 테넷 플링크스 반자동 → 가스, 쿠바 뉴코어 방사능 + 가스) |
| ② | 어트리션 진화는 비치명타에서만 | ✅ + 보스 미적용 | [Laetum](https://wiki.warframe.com/w/Laetum): "50% chance to deal +2000% damage on non-critical hits", "Bosses ignore this perk." | **틀린 곳 발견 → v1.61 수정**: 보스에도 적용해 보스 점수 12.4배. 고친 뒤 1.000배, 무리 4.25배 그대로 |
| ③ | 갈바나이즈드 샷은 폭발에 안 붙음 | ✅ | [Galvanized Shot](https://wiki.warframe.com/w/Galvanized_Shot): "+40% Direct Damage per Status Type", 패치 30.9 "never worked on AoE" | 이미 반영(`gco`, radial 0) |
| ④ | 업데이트 44 약점 적중(밴시 소나) | ✅ | 공식 패치 노트(이전 조사) | `ext.weakFrac`·`wpcc` 있음 |
| ⑤ | 냉기 치명타 배율 | ✅(수치 정정) | [Cold Damage](https://wiki.warframe.com/w/Cold_Damage): 첫 중첩 +10%, 이후 +5%씩, 빙결 시 두 배(+1.0), AoE 미적용, 보스·오버가드 4중첩 | 같은 공식. META의 "중첩당 +0.1"은 ❌(첫 중첩만) |
| ⑥ | 밀리 인플루언스 한 방 처치 미발동 | ✅ / 계산기 △ | [Melee Influence](https://wiki.warframe.com/w/Melee_Influence): "Hits that one-hit-kill enemies cannot trigger nor benefit" | 예외 처리 없음. 다만 니카나 프라임·프라이도스 근접 세팅의 한 방 레벨 28~32 → 기본 조건(150·250·400)에서 영향 없음. 엔진 수정 안 함 |
| ⑦ | 밀리 듀플리케이트 최적 치명타 (3M−4)/(2M−2) | ✅ | [Melee Duplicate](https://wiki.warframe.com/w/Melee_Duplicate): 기본(노란) 치명타에서만, 두 번째 타격은 치명타·상태이상 다시 굴림 | `dupf = 1 + P(노란 치명타)` → (1+c(M−1))(3−c)의 최대점이 위키 공식과 같음 |
| ⑧ | 세미-샷건 캐노네이드 연사 고정 | ✅ | [Semi-Shotgun Cannonade](https://wiki.warframe.com/w/Semi-Shotgun_Cannonade): "Fire Rate cannot be modified", "ignoring other bonuses, even negative effects" | `lock`이 반자동 연사 고정(음수 포함) |
| ⑨ | 엘레멘탈 바이스 | ✅ | [Elemental Vice](https://wiki.warframe.com/w/Elemental_Vice): 쿠바·테넷·코다, 랭크 40 + 포르마 5개, 7종(충격·화염·냉기·전기·독·자성·방사능) 선택, 영구 | 베일런스 '자동'이 같은 7종 비교. % 유지 여부 ❓ |
| ⑩ | 리벤 접합 복합 원소의 조합 순서 | △ | 복합 원소는 더 조합되지 않음(Elemental Damage) | 같은 복합 원소에 더함. 순서를 직접 적은 위키 문장 없음 |
| ⑪ | 핫픽스 44.1.3 리벤 성향·애시드 쉘즈 | ✅ | 이전 조사(패치 노트) | 코드 확인: 리벤 1.2 기준, 애시드 쉘즈 10m·연쇄 없음 |
| ⑫ | 데이모스 인페스티드 바이러스 면역 | ✅(삭숨) | [Deimos Saxum](https://wiki.warframe.com/w/Deimos_Saxum): "Has immunity to Viral status", 바이러스 저항, 가스·폭발 약점 | 계산기 인페스티드(차저·에인션트)엔 영향 없음 |

기타: 베일런스 수치 25~60% 무작위(업데이트 42)는 [Valence Fusion](https://wiki.warframe.com/w/Valence_Fusion)에 하한이 없어 ❓ 유지(상한 60%, 58% 이상 60%로 올림, 융합 min(1.1×큰 값, 60)).

## 메타와 다른 이유
이번 항목은 무기 세팅이 아니라 해당 없음. 점검표 표시 1건(테넷 아르카 플라즈모어 자성 베일런스 101%)은 지난 실행에서 '베일런스 차이(사용자 결정 독 60%)'로 설명됨. 엘레멘탈 바이스로 원소를 바꿀 수 있다는 것도 확인됐지만 차이 1%라(2% 이내 근소) 질문으로 올리지 않음.

## 참고로 발견한 것
- 테넷 플링크스의 기본(첫) 공격 항목이 '보조 사격 + 범위'(충격·방사능)라 반자동(관통+화염)이 아님 — 묶음 8(권총) 때 공격 순서 확인.

## P4 (이전 추천 재확인)
수정은 보스 상황 + 어트리션 진화(레이텀·펠락스)에만 영향. 조사된 커뮤니티 세팅(아르카 플라즈모어·코린트 프라임)에는 해당 없음 — 점검표 재계산 결과 변화 없음.
