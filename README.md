# SKT 만평대리점 매장 점검 체크리스트

SK텔레콤 대구만평대리점 관리자(그룹장·총괄·대표)가 소속 매장을 방문해 **매장 청결 및 정리 상태**를 점검하고, 그 결과를 매장별 일/주/월/연 단위로 누적 관리하는 웹앱.

- **프런트+백엔드**: Google Apps Script 웹앱
- **DB**: Google Sheets
- **사진 저장**: Google Drive
- **로그인**: Google 계정(GIS) + Users 시트 이메일 화이트리스트 (개발 중에는 임시 로그인)

---

## 화면 구성

| 경로 | 화면 | 상태 |
|------|------|------|
| `#/checklist` | 체크리스트 작성 | Phase 2 |
| `#/dashboard` | 결과 대시보드 | Phase 3 |
| `#/stores` | 매장별 종합 관리(일/주/월/연) | Phase 4 |

## 진행 단계

- **Phase 0** 설계 확정 ✅
- **Phase 1** 기반 구축 — 프로젝트 골격 / 시트 스키마·시드 / 로그인·권한 뼈대 ✅ (현재)
- **Phase 2** 체크리스트 작성 페이지
- **Phase 3** 결과 대시보드
- **Phase 4** 매장별 종합 관리
- **Phase 5** 마감(운영 배포·백업·가이드)

---

## 폴더 구조

```
src/
├─ appsscript.json          매니페스트 (시간대, 웹앱 설정, 권한 스코프)
├─ Config.gs                상수 · 점검항목 10개 · 배점/판정 규칙 · 시드(매장14/사용자4)
├─ Setup.gs                 setupProject() : 시트 생성 + 시드 (최초 1회)
├─ SheetDB.gs               시트를 표 DB 로 다루는 범용 CRUD 헬퍼
├─ Auth.gs                  Google 로그인 검증 · 세션(HMAC 토큰) · 역할 접근제어
├─ StoreService.gs          역할별 매장 조회
├─ InspectionService.gs     총점·판정 계산 로직
├─ PhotoService.gs          Drive 사진 업로드
├─ Code.gs                  doGet + 클라이언트 API (getBootstrap 등)
└─ ui/
   ├─ index.html            앱 셸(HTML 템플릿)
   ├─ styles.html           공통 CSS (반응형)
   ├─ app.html              클라이언트 로직(로그인/라우팅/부트스트랩)
   ├─ pages.html            페이지별 초기화 훅
   ├─ page-checklist.html   작성 페이지 (자리표시자)
   ├─ page-dashboard.html   대시보드 (자리표시자)
   └─ page-stores.html      매장별 관리 (자리표시자)
```

---

## 설치 · 배포

> 두 가지 방법 중 하나. **A(clasp)** 를 권장.

### A. clasp CLI 사용

```bash
# 0) 사전: Node 18+ 설치됨
cd "만평대리점_체크리스트"
npm install                       # @google/clasp 설치

# 1) 구글 로그인 (브라우저 열림)
npx clasp login

# 2) 새 Apps Script 웹앱 프로젝트 생성 (.clasp.json 자동 생성)
npx clasp create --type webapp --title "만평대리점_체크리스트" --rootDir ./src

# 3) 코드 업로드
npx clasp push

# 4) 편집기 열기
npx clasp open
```

이후 편집기(또는 CLI)에서:

1. 함수 목록에서 **`setupProject`** 실행 → 권한 승인
   - `만평대리점_체크리스트_DB` 스프레드시트, `만평대리점_체크리스트_사진` Drive 폴더 자동 생성
   - 6개 시트 + 헤더 + 시드(매장 14 / 사용자 4 / 항목 10) 입력
   - 실행 로그(보기 → 로그)에 스프레드시트 URL 출력됨
2. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
   - 배포하면 나오는 웹앱 URL 이 실제 사용 주소
3. 지금은 `DEV_MODE=true` 라 웹앱 접속 시 **개발용 임시 로그인(그룹장/총괄/대표)** 버튼으로 화면 확인 가능

### B. 수동 (clasp 없이)

1. <https://script.google.com> → 새 프로젝트
2. `src/` 안의 각 `.gs` 파일 내용을 같은 이름의 스크립트 파일로 복사
3. `ui/*.html` 은 파일 이름을 **`ui/index`, `ui/styles`, `ui/app`, `ui/pages`, `ui/page-checklist`, `ui/page-dashboard`, `ui/page-stores`** 로 만들어 붙여넣기 (HTML 파일)
4. 프로젝트 설정 → `appsscript.json` 내용 반영(매니페스트 표시 옵션 켜기)
5. 이후는 A 의 1~3 과 동일

---

## Google 로그인(운영) 활성화

개인 Gmail 계정이 섞여 있으므로 **Google Identity Services + OAuth 클라이언트 ID** 방식을 쓴다.
자세한 절차는 [`docs/OAUTH_SETUP.md`](docs/OAUTH_SETUP.md).

요약:

1. Google Cloud Console 에서 **OAuth 클라이언트 ID(웹 애플리케이션)** 발급
   - 승인된 자바스크립트 원본: `https://script.google.com`
2. Apps Script 편집기에서 `setGoogleClientId("<클라이언트ID>")` 실행
3. `Users` 시트의 각 사용자 행에 **실제 Google 이메일** 입력
4. 동작 확인 후 `disableDevMode()` 실행 → 임시 로그인 차단

---

## 데이터 모델 (시트)

| 시트 | 컬럼 |
|------|------|
| `Stores` | store_id, 매장명, 팀, 그룹장, 총괄, 활성여부 |
| `Items` | item_id, 순번, 항목명, 설명, 배점, 중요항목 |
| `Users` | user_id, 이름, 역할, 담당, 이메일, 활성여부 |
| `Inspections` | inspection_id, store_id, 매장명, 점검일시, 점검자이름/이메일/역할, 총점, 평가결과, 재점검필요, 재점검회차, 90점미만, 상태, 생성일시, 수정일시 |
| `Scores` | score_id, inspection_id, item_id, 순번, 항목명, 배점, 점수, 사유, 기타특이점, X표시 |
| `Photos` | photo_id, inspection_id, 구분(전/후), drive_file_id, url, 업로더이메일, 업로드일시 |

## 판정 규칙 (`Config.gs`)

| 총점 | 평가결과 | 재점검 |
|------|----------|--------|
| 95점 이상 | 우수 | - |
| 90점 이상 | 양호 | - |
| 85점 이상 | 관리 필요 | 필요 |
| 85점 미만 | 개선 필요 | 필요 |

- **중요항목** 중 X 표시가 2개 이상 → 재점검 필요
- **90점 미만** → ① 24h 내 밴드 댓글로 개선 전/후 사진 ② 다음주 즉시 재점검 ③ 2회 연속 시 해당 분기 VD 수수료 50% 재정산

> ⚠️ **확인 필요**: 10개 항목 중 실제 "중요항목"이 무엇인지 미확정. 현재 `Config.gs` 에서 1번·5번을 임시 지정 → 확정되면 `critical` 값 수정 후 `setupProject()` 재실행.

---

## Phase 1 확인 방법

1. 위 설치 A 완료
2. `setupProject()` 실행 → 스프레드시트에 6개 시트 + 시드 데이터 확인
3. `healthCheck()` 실행 → 로그에 각 항목 개수 출력 확인
4. 웹앱 URL 접속 → 임시 로그인(예: 그룹장) → 상단 탭 3개 이동
   - "체크리스트 작성" 탭 하단에 로그인 사용자/매장 수 등 연결 확인 정보 표시
   - "매장별 관리" 탭에 접근 가능 매장 목록 표시 (그룹장은 팀 매장만, 총괄/대표는 14개 전체)
