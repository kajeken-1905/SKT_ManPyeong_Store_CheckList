/**
 * SheetDB.gs
 * Google Sheets 를 표 형태의 DB 로 다루는 범용 헬퍼.
 * - 첫 행을 헤더로 사용, 각 행을 {헤더: 값} 객체로 매핑.
 * - 쓰기 작업은 LockService 로 직렬화.
 */

/** 스프레드시트 핸들. */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP.SPREADSHEET_ID);
  if (!id) {
    throw new Error('스프레드시트가 아직 생성되지 않았습니다. 먼저 Setup.setupProject() 를 실행하세요.');
  }
  return SpreadsheetApp.openById(id);
}

/** 이름으로 시트 핸들 얻기(없으면 오류). */
function getSheet_(name) {
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sh;
}

/** 시트의 헤더 배열. */
function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

/**
 * 시트 전체를 객체 배열로 읽는다.
 * @param {string} name 시트 이름
 * @return {Object[]} 각 행 { header: value, _row: 실제행번호 }
 */
function readAll_(name) {
  var sh = getSheet_(name);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(String);
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    // 완전히 빈 행은 건너뛴다.
    if (row.join('') === '') continue;
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

/**
 * 조건(부분 일치, AND)에 맞는 행만 반환.
 * @param {string} name
 * @param {Object} where {field: value, ...}  (값 비교는 느슨한 == )
 */
function query_(name, where) {
  var rows = readAll_(name);
  if (!where) return rows;
  var keys = Object.keys(where);
  return rows.filter(function (row) {
    return keys.every(function (k) { return String(row[k]) === String(where[k]); });
  });
}

/** id 필드로 한 건 조회(없으면 null). */
function findById_(name, idField, idValue) {
  var hit = query_(name, (function () { var o = {}; o[idField] = idValue; return o; })());
  return hit.length ? hit[0] : null;
}

/**
 * 한 행 추가. obj 의 키 중 헤더에 있는 것만 기록.
 * @return {Object} 기록된 obj (그대로 반환)
 */
function insert_(name, obj) {
  return withLock_(function () {
    var sh = getSheet_(name);
    var headers = getHeaders_(sh);
    var row = headers.map(function (h) { return (h in obj) ? obj[h] : ''; });
    sh.appendRow(row);
    return obj;
  });
}

/**
 * 여러 행 일괄 추가.
 * @param {string} name
 * @param {Object[]} objs
 */
function insertMany_(name, objs) {
  if (!objs || !objs.length) return 0;
  return withLock_(function () {
    var sh = getSheet_(name);
    var headers = getHeaders_(sh);
    var rows = objs.map(function (obj) {
      return headers.map(function (h) { return (h in obj) ? obj[h] : ''; });
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    return rows.length;
  });
}

/**
 * id 로 행을 찾아 patch 의 필드만 갱신.
 * @return {boolean} 갱신 여부
 */
function update_(name, idField, idValue, patch) {
  return withLock_(function () {
    var sh = getSheet_(name);
    var headers = getHeaders_(sh);
    var idCol = headers.indexOf(idField);
    if (idCol < 0) throw new Error('id 컬럼 없음: ' + idField);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return false;
    var ids = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(idValue)) {
        var rowNum = i + 2;
        var current = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];
        headers.forEach(function (h, c) { if (h in patch) current[c] = patch[h]; });
        sh.getRange(rowNum, 1, 1, headers.length).setValues([current]);
        return true;
      }
    }
    return false;
  });
}

/**
 * id 로 행을 찾으면 갱신, 없으면 추가.
 * @param {Object} obj 반드시 idField 값을 포함
 */
function upsert_(name, idField, obj) {
  var existing = findById_(name, idField, obj[idField]);
  if (existing) { update_(name, idField, obj[idField], obj); return 'updated'; }
  insert_(name, obj); return 'inserted';
}

/** 스크립트 락으로 콜백을 직렬화 실행. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); }
  finally { lock.releaseLock(); }
}

/** 접두어 + 시간 + 난수로 id 생성. */
function newId_(prefix) {
  var t = new Date().getTime().toString(36);
  var r = Math.floor(Math.random() * 1e6).toString(36);
  return (prefix ? prefix + '_' : '') + t + r;
}

/** 한국시간 ISO 문자열(초 단위). */
function nowKst_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");
}

/** 시트 값이 Date 로 자동 변환됐어도 일관된 문자열로. */
function asStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return v == null ? '' : String(v);
}

/** 'yyyy-MM-dd' 부분만. */
function asDay_(v) {
  return asStr_(v).slice(0, 10);
}
