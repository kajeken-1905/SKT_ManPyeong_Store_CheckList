/**
 * Code.gs
 * 웹앱 진입점(doGet) + 클라이언트에서 google.script.run 으로 호출하는 API.
 *
 * 화면(3):  #/checklist  체크리스트 작성
 *          #/dashboard  결과 대시보드
 *          #/stores     매장별 종합 관리(일/주/월/연)
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('ui/index');
  t.build = {
    appName: '만평대리점 매장 점검 체크리스트',
    devMode: isDevMode_(),
    googleClientId: PropertiesService.getScriptProperties().getProperty(PROP.GOOGLE_CLIENT_ID) || ''
  };
  return t.evaluate()
    .setTitle('만평대리점 매장 점검 체크리스트')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico');
}

/** HTML 파셜 인클루드 (index.html 에서 <?!= include('ui/xxx') ?> 로 사용) */
function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

/* ────────────────────────────────────────────────────────────
 *  인증 API
 * ──────────────────────────────────────────────────────────── */

/** 서버 설정 상태(로그인 화면에서 사용). */
function getAuthConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    devMode: isDevMode_(),
    googleClientId: props.getProperty(PROP.GOOGLE_CLIENT_ID) || '',
    ready: !!props.getProperty(PROP.SPREADSHEET_ID)
  };
}

// login(idToken) / devLogin(role) 은 Auth.gs 에 정의됨 (client 에서 직접 호출)

/* ────────────────────────────────────────────────────────────
 *  공통 부트스트랩
 * ──────────────────────────────────────────────────────────── */

/**
 * 로그인 후 앱 초기 데이터.
 * @param {string} token 세션 토큰
 */
function getBootstrap(token) {
  return withAuth_(token, null, function (user) {
    return {
      user: {
        uid: user.uid, name: user.name, role: user.role,
        team: user.team, email: user.email,
        canSeeAllStores: ALL_STORE_ROLES.indexOf(user.role) >= 0
      },
      stores: listStoresForUser_(user),
      items: CHECKLIST_ITEMS.map(function (it) {
        return { item_id: it.id, no: it.no, name: it.name, desc: it.desc, max: it.max, critical: it.critical };
      }),
      gradeRules: getGradeRules_(),
      under90Actions: UNDER_90_ACTIONS.slice(),
      maxTotal: MAX_TOTAL,
      criticalXThreshold: CRITICAL_X_THRESHOLD,
      serverTime: nowKst_()
    };
  });
}

/**
 * 작성 중 실시간 총점/판정 미리보기.
 * @param {string} token
 * @param {Array} entries [{item_id, score, isX, reason, note}]
 */
function previewEvaluation(token, entries) {
  return withAuth_(token, INSPECTOR_ROLES, function () {
    return evaluateInspection_(entries);
  });
}

/**
 * [Phase 2] 점검 저장 (신규 작성).
 * @param {string} token 세션 토큰
 * @param {Object} payload {store_id, inspectedAt, recheckRound, status, entries[], photos[]}
 * @return {Object} {inspection_id, status, total, grade, needRecheck, under90, actions, photos[]}
 */
function saveInspection(token, payload) {
  return withAuth_(token, INSPECTOR_ROLES, function (user) {
    return createInspection_(user, payload);
  });
}

/* ────────────────────────────────────────────────────────────
 *  Phase 3~4 에서 구현 예정 (자리표시자)
 * ──────────────────────────────────────────────────────────── */

/** [Phase 3] 대시보드 데이터 */
function getDashboard(token, filter) {
  throw new Error('아직 구현되지 않았습니다. (Phase 3)');
}

/** [Phase 4] 매장별 일/주/월/연 집계 */
function getStoreSummary(token, storeId, period) {
  throw new Error('아직 구현되지 않았습니다. (Phase 4)');
}

/* ────────────────────────────────────────────────────────────
 *  개발용 헬퍼
 * ──────────────────────────────────────────────────────────── */

/** 편집기에서 실행해 초기화 상태를 점검. */
function healthCheck() {
  var props = PropertiesService.getScriptProperties();
  var out = {
    spreadsheet: !!props.getProperty(PROP.SPREADSHEET_ID),
    driveFolder: !!props.getProperty(PROP.DRIVE_FOLDER_ID),
    sessionSecret: !!props.getProperty(PROP.SESSION_SECRET),
    googleClientId: !!props.getProperty(PROP.GOOGLE_CLIENT_ID),
    devMode: isDevMode_()
  };
  try {
    out.stores = query_(SHEETS.STORES, {}).length;
    out.items = query_(SHEETS.ITEMS, {}).length;
    out.users = query_(SHEETS.USERS, {}).length;
  } catch (e) {
    out.error = e.message;
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
