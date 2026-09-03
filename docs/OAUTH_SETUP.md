# Google 로그인(OAuth 클라이언트 ID) 설정 가이드

개인 Gmail 계정이 섞여 있어도 동작하도록 **Google Identity Services(GIS)** 로 로그인하고,
서버(Apps Script)에서 ID 토큰을 검증한 뒤 `Users` 시트의 이메일 화이트리스트와 대조한다.

소요 시간: 약 5분. 비용: 무료.

---

## 1. Google Cloud 프로젝트 준비

1. <https://console.cloud.google.com> 접속 (앱 소유자 구글 계정)
2. 상단 프로젝트 선택 → **새 프로젝트** → 이름 예: `manpyeong-checklist` → 만들기
3. 만든 프로젝트를 선택한 상태로 진행

> Apps Script 프로젝트에 이미 연결된 GCP 프로젝트를 써도 된다.
> (Apps Script 편집기 → 프로젝트 설정 → Google Cloud Platven(GCP) 프로젝트)

## 2. OAuth 동의 화면

1. 왼쪽 메뉴 → **API 및 서비스 → OAuth 동의 화면**
2. User Type: **외부** → 만들기
3. 앱 이름: `만평대리점 점검`, 사용자 지원 이메일: 본인 이메일
4. 개발자 연락처 이메일 입력 → 저장 후 계속
5. 범위(Scopes): 추가하지 않고 저장 후 계속
6. 테스트 사용자: 지금은 건너뛰어도 됨 (아래 3-2 참고)
7. **게시 상태**: "테스트" 상태면 테스트 사용자만 로그인 가능.
   전체 관리자에게 열려면 **앱 게시(프로덕션)** 버튼을 누른다.
   (민감 범위를 쓰지 않으므로 Google 검토 없이 바로 프로덕션 전환 가능)

## 3. OAuth 클라이언트 ID 발급

1. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. 이름: `manpyeong-web`
4. **승인된 자바스크립트 원본**에 다음을 추가:
   ```
   https://script.google.com
   ```
5. 승인된 리디렉션 URI: 비워둠 (GIS 는 필요 없음)
6. 만들기 → 나오는 **클라이언트 ID** 복사 (형식: `xxxxxxxx.apps.googleusercontent.com`)

## 4. Apps Script 에 클라이언트 ID 등록

Apps Script 편집기에서:

```js
setGoogleClientId("복사한_클라이언트ID.apps.googleusercontent.com")
```

함수를 선택해 실행한다. (`Setup.gs` 에 정의됨)

## 5. 사용자 이메일 등록

`만평대리점_체크리스트_DB` 스프레드시트 → `Users` 시트 → 각 행의 **이메일** 열에
해당 사용자의 실제 Google 로그인 이메일을 입력한다.

| 이름 | 역할 | 담당 | 이메일 |
|------|------|------|--------|
| 정구원 | 대표 | 전체 | ceo@example.com |
| 신동훈 | 총괄 | 전체 | ... |
| 정시영 | 그룹장 | 함께팀 | ... |
| 정수빈 | 그룹장 | 멀리팀 | ... |

- 활성여부 = `Y` 인 행만 로그인 통과
- 새 점검자가 생기면 이 시트에 행 추가

## 6. 동작 확인 후 개발 모드 끄기

1. 웹앱 URL 접속 → **Google 로그인** 버튼으로 로그인되는지 확인
2. 등록 안 된 이메일로 로그인 → "등록되지 않은 사용자입니다" 메시지 확인
3. 정상 확인되면 편집기에서 실행:
   ```js
   disableDevMode()
   ```
   → 이후 임시 로그인 버튼 사라짐

---

## 자주 나오는 문제

| 증상 | 원인 / 해결 |
|------|-------------|
| 로그인 버튼이 안 뜸 | `getAuthConfig` 가 `googleClientId` 를 못 받음 → `setGoogleClientId` 재실행 |
| `idpiframe_initialization_failed` / 버튼 렌더 실패 | 승인된 자바스크립트 원본에 `https://script.google.com` 누락 |
| `토큰 대상(aud)이 일치하지 않습니다` | 등록한 클라이언트 ID 와 실제 로그인에 쓰인 ID 불일치 |
| 로그인은 되는데 "등록되지 않은 사용자" | `Users` 시트 이메일 오타 / 활성여부 ≠ Y |
| 테스트 사용자만 로그인됨 | OAuth 동의 화면을 **프로덕션**으로 게시 |
