/**
 * Setup.gs
 * 최초 1회(또는 설정 변경 시) 실행하는 초기화 스크립트.
 * Apps Script 편집기에서 setupProject 를 선택해 실행한다.
 */

/**
 * 프로젝트 초기화:
 *  1) 스프레드시트 생성(없으면) + 6개 시트/헤더 구성
 *  2) 사진 저장용 Drive 폴더 생성(없으면)
 *  3) 세션 서명 비밀키 생성(없으면)
 *  4) DEV_MODE 기본값 설정
 *  5) Items / Stores / Users 시드 데이터 upsert
 * 재실행해도 안전(멱등).
 */
function setupProject() {
  var props = PropertiesService.getScriptProperties();

  // 1) 스프레드시트
  var ssId = props.getProperty(PROP.SPREADSHEET_ID);
  var ss;
  if (ssId) {
    ss = SpreadsheetApp.openById(ssId);
  } else {
    ss = SpreadsheetApp.create('만평대리점_체크리스트_DB');
    props.setProperty(PROP.SPREADSHEET_ID, ss.getId());
  }

  // 기본 시트('시트1') 제거 대비: 먼저 필요한 시트를 만든 뒤 정리
  Object.keys(SHEETS).forEach(function (key) {
    ensureSheet_(ss, SHEETS[key], HEADERS[SHEETS[key]]);
  });
  removeDefaultSheet_(ss);

  // 2) Drive 폴더
  if (!props.getProperty(PROP.DRIVE_FOLDER_ID)) {
    var folder = DriveApp.createFolder('만평대리점_체크리스트_사진');
    props.setProperty(PROP.DRIVE_FOLDER_ID, folder.getId());
  }

  // 3) 세션 비밀키
  if (!props.getProperty(PROP.SESSION_SECRET)) {
    props.setProperty(PROP.SESSION_SECRET, Utilities.getUuid() + Utilities.getUuid());
  }

  // 4) DEV_MODE 기본값
  if (props.getProperty(PROP.DEV_MODE) === null) {
    props.setProperty(PROP.DEV_MODE, 'true');
  }

  // 5) 시드
  seedItems_();
  seedStores_();
  seedUsers_();

  var result = {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    driveFolderId: props.getProperty(PROP.DRIVE_FOLDER_ID),
    devMode: isDevMode_(),
    googleClientIdSet: !!props.getProperty(PROP.GOOGLE_CLIENT_ID)
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** 시트가 없으면 만들고, 헤더가 비었으면 헤더를 채운다. */
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].join('');
  if (current === '') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

/** create() 시 자동 생성되는 '시트1'/'Sheet1' 이 비어 있으면 삭제. */
function removeDefaultSheet_(ss) {
  ['시트1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

/** 점검 항목 시드. */
function seedItems_() {
  CHECKLIST_ITEMS.forEach(function (it) {
    upsert_(SHEETS.ITEMS, 'item_id', {
      item_id: it.id,
      '순번': it.no,
      '항목명': it.name,
      '설명': it.desc,
      '배점': it.max,
      '중요항목': it.critical ? 'Y' : 'N'
    });
  });
}

/** 매장 시드. */
function seedStores_() {
  STORE_SEED.forEach(function (r) {
    upsert_(SHEETS.STORES, 'store_id', {
      store_id: r[0], '매장명': r[1], '팀': r[2],
      '그룹장': r[3], '총괄': r[4], '활성여부': r[5]
    });
  });
}

/** 사용자 시드(이메일이 이미 채워진 행은 이메일을 덮어쓰지 않음). */
function seedUsers_() {
  USER_SEED.forEach(function (r) {
    var name = r[0];
    var existing = query_(SHEETS.USERS, { '이름': name })[0];
    if (existing) {
      update_(SHEETS.USERS, 'user_id', existing.user_id, {
        '역할': r[1], '담당': r[2], '활성여부': r[4]
        // 이메일은 수동 입력값 유지
      });
    } else {
      insert_(SHEETS.USERS, {
        user_id: newId_('U'),
        '이름': name, '역할': r[1], '담당': r[2],
        '이메일': r[3], '활성여부': r[4]
      });
    }
  });
}

/**
 * (선택) 운영 배포 준비: DEV_MODE 끄기.
 * Google 로그인/화이트리스트가 준비된 뒤 실행한다.
 */
function disableDevMode() {
  PropertiesService.getScriptProperties().setProperty(PROP.DEV_MODE, 'false');
  return 'DEV_MODE = false';
}

/** (선택) OAuth 클라이언트 ID 저장. */
function setGoogleClientId(clientId) {
  if (!clientId) throw new Error('clientId 를 넣어주세요.');
  PropertiesService.getScriptProperties().setProperty(PROP.GOOGLE_CLIENT_ID, String(clientId).trim());
  return '저장됨';
}
