# 모닝 브리핑 ☀️

아침에 폰으로 한 번 열면 **날씨(서울·당진·김해) · 전날 증시 종가(코스피·코스닥·삼성전자·SK하이닉스·다우·나스닥·S&P 500·SOXL) · 환율 · 오늘의 AI 용어/영어/중국어/일본어 단어**를 한 화면에 보여주는 웹앱(PWA)입니다. 서버·API 키·비용 없이 동작합니다.

## 데이터 출처
| 카드 | 출처 | 갱신 |
|---|---|---|
| 날씨 | Open-Meteo (실패 시 wttr.in) | 열 때마다 |
| 환율 | open.er-api.com (실패 시 Frankfurter) | 열 때마다 (하루 1회 기준값) |
| 증시 종가 | Yahoo Finance → `data/market.json` | GitHub Actions가 매일 KST 06:30 |
| 단어 4종 | `data/*.json` (각 60개) | 날짜별로 자동 순환, 모두가 같은 날 같은 단어 |

단어를 늘리려면 `data/en.json` 등에 같은 형식으로 항목을 추가하면 됩니다.

## 내 컴퓨터에서 실행
```bash
python -m http.server 8765
```
→ http://localhost:8765 (특정 날짜 단어 미리보기: `?date=2026-12-25`)

시세 수동 갱신: `node scripts/fetch_market.mjs`

## 지인과 공유하기 (GitHub Pages, 무료)
1. GitHub에 새 저장소(공개)를 만들고 이 폴더를 올립니다.
2. 저장소 **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save.
3. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/` 주소가 생깁니다. 이 링크를 카톡으로 보내면 끝!
4. **Actions** 탭에서 "아침 시세 수집"이 켜져 있는지 확인 (처음 한 번 `Run workflow`로 실행해보기).

## 폰 홈 화면에 앱으로 추가
- **iPhone**: Safari로 링크 열기 → 공유 버튼 → *홈 화면에 추가*
- **Android**: Chrome으로 링크 열기 → 메뉴(⋮) → *앱 설치* 또는 *홈 화면에 추가*
