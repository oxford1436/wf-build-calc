# 묶음 7 — 주무기 특수 공격 (보조 사격·충전 사격) · 2026-11-07 16시

대표 무기: **트럼나 프라임**(보조 사격 유탄 — 기본 사격 처치로 충전), **액셀트라 프라임**(로켓 최소 폭발 거리 — 보조 사격은 없지만 같은 '특수 발사체 조건' 메커니즘). 고른 근거: 두 무기 모두 최근 1년 안에 갱신된 영문 세팅 글이 있음(Overframe 760918 2026-02 갱신, Overframe 932215 2026-10 갱신 '44.0', Item Level 2026-07). 에피타프(충전 사격, 전체 점검 '전멸 60초 초과')는 이번에 읽은 세팅이 없어 다음으로 미룸.

계산 조건(P2): 강철의 길 150·250·400, 3팩션 평균, 12명 무리(엑시무스 포함), 처치 중첩 0부터, 2~20m, 리벤 없음, 동반자 본드 기본 켬(v1.93), 헤드샷·조준 제외. v1.94 기준.

## 읽은 출처

| 출처 | 날짜 | 읽음 | 세팅 |
|---|---|---|---|
| [Sportskeeda Trumna Prime](https://sportskeeda.com/mmo/warframe-trumna-prime-build-guide) | 표시 없음 | 본문 | read 1 (부식+폭발) |
| [Destructoid Trumna Prime](https://www.destructoid.com/the-best-trumna-prime-build-in-warframe/) | 2024-11-15 | 본문 | read 1 (바이러스+방사능) |
| [Overframe 760918 'Skadoosh Prime' 유탄](https://overframe.gg/build/760918/trumna-prime/skadoosh-prime-10-million-grenade-dps/) | 2026-02 갱신 | 본문(모드 목록은 그림) | 기록 안 함 — 글의 비교 문장만 |
| [Item Level Acceltra Prime 컴프레션](https://itemlevel.net/warframe-acceltra-prime-compression-build-guide-2026/) | 2026-07-18 | 본문 | read 1 |
| [The Nerd Stash Acceltra Prime](https://thenerdstash.com/best-warframe-acceltra-prime-build-guide) | 2024-01-18 | 본문 | read 1 (칸마다 대안 → 첫 모드) |
| [Ackbar Acceltra Prime (U35.0.11)](https://ackbarwarframe.blogspot.com/2024/02/review-acceltra-prime-u35011.html) | 2024-02-03 | 본문(세팅은 그림) | 기록 안 함 — 설명만 |
| [Overframe 932215 액셀트라 프라임](https://overframe.gg/build/932215/acceltra-prime/acceltra-prime-trash-mob-killer-steel-path/) | 2026-10-20 갱신 | 본문(모드 목록 없음) | 기록 안 함 — 설명만 |
| 위키 Trumna Prime·Acceltra Prime | — | **못 읽음**(웹 읽기 권한 시간 초과, 우회 안 함) | 저장소의 위키 노트 데이터(`docs/mechanics/gaps_primary.json`, 위키 원문 문장)로 대조 |
| arca.live·Reddit | — | 이번 실행에서 열지 않음 | — |

## 계산기에서 고친 것 (v1.94)

1. **트럼나·트럼나 프라임 기본 사격 폭발**: 위키 노트 "Explosion is unaffected by multishot.", 트럼나 "Explosion range cannot be increased with Firestorm (Primed Firestorm)." — 엔진은 1.6m 폭발에 멀티샷과 파이어스톰을 곱하고 있었음. Destructoid도 "Primed Firestorm … will only work with the Trumna's alternate fire". `NO_MS_RADIAL`·`FS_LOCK`. 1위가 바뀜.
2. **최소 폭발 거리**: 액셀트라·액셀트라 프라임 7m("will not explode if they make contact with objects or enemies within that range"), 통코르 7.5m. 무리(2~20m 면적 가중)에서 표적의 11.4%(통코르 13.2%)가 그 안 → 폭발 부분만 그만큼 뺌, 직격은 그대로. 액셀트라 프라임 1위 점수 −10%. `ARM_DIST`, 엔진 `armFrac`.

회귀 검사 2개(고치기 전 빌드에서 둘 다 실패 확인).

## 트럼나 프라임

계산기 1위(v1.94): 인펙티드 클립, 프라임드 크라이오 라운즈, 갈바나이즈드 체임버, 갈바나이즈드 앱티튜드, 마그네틱 캐퍼시티, 크리티컬 딜레이, 바이탈 센스, 프라임드 슈레드 + 프라이머리 머시리스. 인펙티드 클립 ↔ 멀리그난트 포스는 100%(같은 독 90%).

| 주장 | 출처 | 판정 |
|---|---|---|
| 광역 무기라 부식+폭발이 가장 좋다 | Sportskeeda | △ 그리니어에서만 그 모드의 최선 순서(100%), 코퍼스 65%·인페스티드 79%(같은 모드를 바이러스+방사능 순서로 놓은 것 대비). 3팩션 평균 61% vs 64% |
| 프라임드 슈레드(연사 필요) | Sportskeeda | △ 슈레드 → 바일 액셀러레이션 62%(슈레드 쪽 +3%). 관통 자체는 무리에서 약 0.17명(v1.91) |
| 코퍼스엔 블라이트로 폭발+독 | Sportskeeda | ❌ 기본 무리 조건 코퍼스에서 블라이트가 머시리스의 66% |
| 반동 때문에 스태빌라이저 | Destructoid·Sportskeeda | 계산 밖(엑실러스, 사용감) |
| 프라임드 파이어스톰은 보조 사격에만 | Destructoid | ✅ 위키 트럼나 노트 → v1.94. 자유 칸에 넣으면 69% |
| 원소가 많아 갈바나이즈드 앱티튜드가 잘 맞음 | Destructoid | ✅ 1위에도 있음 |
| 해머 샷은 믿을 만한 자유 칸 | Destructoid | △ 레디에이티드 리로드 대신 81%(85% → 81%) |
| 헬파이어가 써마이트보다 피해 5% 앞섬 | Overframe 760918 | ❓ 그 글의 세팅(그림)을 못 읽어 같은 조건 비교 불가 |
| 5처치마다 유탄으로 방 정리 | 3곳 | ❓ 계산기는 유탄을 섞지 않음(아래) |

**메타와 다른 이유**: ① 마그네틱 캐퍼시티 — 몫 대부분이 무리 속 엑시무스 오버가드(멀리그난트 포스로 바꾸면 82%), 묶음 1·2·6과 같은 패턴 △. ② 레디에이티드 리로드·바일 액셀러레이션이 빠지고 동반자 리인포스드 본드(연사 +60%, v1.93 기본)가 연사를 채움. ③ 유탄 미반영 — 커뮤니티가 유탄을 방 정리에 쓰는 만큼 화염·파이어스톰 가치가 계산보다 클 수 있음.

**유탄 (남은 것)**: 위키 노트 "Requires 5 primary fire kills to charge a gauge", "Does not use ammo", 트럼나 프라임 1115 화염 6m, "explodes … upon impact with a surface or enemy and bounces up to 7 times". 튕길 때마다 터지는지가 문장으로 확정되지 않고, 기본 공격에 섞는 것은 운용 문제라 QUESTIONS.md로.

## 액셀트라 프라임

계산기 1위(v1.94): 갈바나이즈드 체임버, 프라임드 크라이오 라운즈, 멀리그난트 포스, 크리티컬 딜레이, 바이탈 센스, 마그네틱 캐퍼시티, 와일드파이어, 프라임드 파이어스톰 + 프라이머리 플레이티드 라운드.

| 주장 | 출처 | 판정 |
|---|---|---|
| 아케인 칸을 컴프레션에, 무리는 비조준·우선 표적은 조준 | Item Level | ❌ 무리 기준: 비조준이면 컴프레션 효과 0(머시리스로 바꾸면 32% → 58%), 조준한 무리에서도 머시리스의 62%. 단일 우선 표적은 기본 조건 밖 △ |
| 프라임드 파이어스톰: 무리 반경 | Item Level | ✅ 계산기 1위에도 있음 |
| 리인포스드 본드면 바일 액셀러레이션 대신 다른 모드 | Item Level | ✅ 본드 기본 켬 1위에 바일 없음(와일드파이어 자리 98%) |
| 바이러스가 가장 범용 | Item Level·Ackbar | ✅ 1위도 바이러스 중심(+화염·자성) |
| 헌터 뮤니션즈로 강철의 길 베기 | Nerd Stash·Ackbar | △ 1위 와일드파이어 자리 80% — 폭발이 관통 80%·베기 20%라 치명타 출혈 몫이 작음 |
| 연사가 빨라 탄약을 많이 먹음(애모 뮤테이션·비질란티 서플라이 안 씀) | Nerd Stash·Overframe 932215·Ackbar | ✅ 탄창 48·예비 96(데이터), 긴 전투 탄약 계산(v1.64)에 들어감 |
| 7m 무장 거리라 자해 경직 없음 | Nerd Stash·Ackbar | ✅ 위키 → v1.94에서 7m 안 폭발 없음 반영 |
| 머시리스 재장전 +30%는 꼭 필요 | Overframe 932215 | △ 1위는 플레이티드 라운드, 머시리스는 85% |

**메타와 다른 이유**: 마그네틱 캐퍼시티(빼고 바일 액셀러레이션 89%, 엑시무스 오버가드 △), 와일드파이어(화염 + 탄창), 아케인 플레이티드 라운드(탄창 48 → 재장전마다 33.5%·√48 ≈ +232%가 짧은 재장전 1.6초와 맞물림, 묶음 2와 같은 패턴 △).
