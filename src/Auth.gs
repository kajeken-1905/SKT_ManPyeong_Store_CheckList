/**
 * Auth.gs
 * 로그인 · 세션 관리 · 역할 기반 접근 제어.
 *
 * 흐름:
 *  - 운영: 클라이언트가 Google Identity Services 로 로그인 → ID 토큰(JWT) 을
 *    login(idToken) 으로 전달 → 서버가 tokeninfo 로 검증 → 이메일 추출 →
 *    Users 시트 화이트리스트 대조 → 세션 토큰 발급.
 *  - 개발(DEV_MODE): devLogin(role) 로 임시 세션 발급(이메일 없이 화면 확인용).
 *
 * 세션 토큰 = base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))
 */

var TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

/**
 * Google ID 토큰으로 로그인.
 * @param {string} idToken GIS credential
 * @return {{token:string, user:Object}}
 */
function login(idToken) {
  if (!idToken) throw new Error('idToken 이 없습니다.');

  var clientId = PropertiesService.getScriptProperties().getProperty(PROP.GOOGLE_CLIENT_ID);
  if (!clientId) throw new Error('서버에 GOOGLE_CLIENT_ID 가 설정되지 않았습니다. (Setup.setGoogleClientId 실행 필요)');

  var resp = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('유효하지 않은 토큰입니다.');
  var info = JSON.parse(resp.getContentText());

  if (info.aud !== clientId) throw new Error('토큰 대상(aud)이 일치하지 않습니다.');
  if (info.exp && (Number(info.exp) * 1000) < Date.now()) throw new Error('만료된 토큰입니다.');
  if (String(info.email_verified) !== 'true') throw new Error('이메일이 확인되지 않은 계정입니다.');

  var email = String(info.email || '').toLowerCase();
  var user = lookupUserByEmail_(email);
  if (!user) {
    throw new Error('등록되지 않은 사용자입니다: ' + email + '\nUsers 시트에 이메일을 등록한 뒤 다시 시도하세요.');
  }

  return { token: makeSession_(user), user: publicUser_(user) };
}

/**
 * 개발용 임시 로그인. DEV_MODE 에서만 동작.
 * @param {string} role ROLES 값 중 하나
 */
function devLogin(role) {
  if (!isDevMode_()) throw new Error('DEV_MODE 가 꺼져 있어 임시 로그인을 쓸 수 없습니다.');
  if (INSPECTOR_ROLES.indexOf(role) < 0) throw new Error('알 수 없는 역할: ' + role);
  var team = role === ROLES.GROUP_LEADER ? '함께팀' : '전체';
  var user = {
    user_id: 'DEV_' + role,
    '이름': '[개발]' + role,
    '역할': role,
    '담당': team,
    '이메일': 'dev+' + role + '@example.com',
    '활성여부': 'Y'
  };
  return { token: makeSession_(user), user: publicUser_(user) };
}

/** 세션 토큰 검증 → 사용자 객체(없으면 오류). */
function requireSession_(token) {
  var user = readSession_(token);
  if (!user) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  return user;
}

/**
 * 세션 + 역할 확인 후 콜백 실행.
 * @param {string} token
 * @param {string[]|null} roles 허용 역할(널이면 로그인만 확인)
 * @param {function(Object):*} fn user 를 받는 콜백
 */
function withAuth_(token, roles, fn) {
  var user = requireSession_(token);
  if (roles && roles.indexOf(user.role) < 0) throw new Error('권한이 없습니다. (필요 역할: ' + roles.join(', ') + ')');
  return fn(user);
}

// ── 내부 유틸 ───────────────────────────────────────────────

function lookupUserByEmail_(email) {
  if (!email) return null;
  var rows = query_(SHEETS.USERS, {});
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r['활성여부']).toUpperCase() !== 'Y') continue;
    if (String(r['이메일'] || '').toLowerCase().trim() === email) return r;
  }
  return null;
}

/** 세션에 담을 최소 정보. */
function sessionPayload_(userRow) {
  return {
    uid: userRow.user_id,
    name: userRow['이름'],
    role: userRow['역할'],
    team: userRow['담당'],
    email: String(userRow['이메일'] || '').toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC
  };
}

/** 클라이언트로 내려줄 사용자 정보. */
function publicUser_(userRow) {
  return {
    uid: userRow.user_id,
    name: userRow['이름'],
    role: userRow['역할'],
    team: userRow['담당'],
    email: String(userRow['이메일'] || '').toLowerCase(),
    canSeeAllStores: ALL_STORE_ROLES.indexOf(userRow['역할']) >= 0
  };
}

function secret_() {
  var s = PropertiesService.getScriptProperties().getProperty(PROP.SESSION_SECRET);
  if (!s) throw new Error('SESSION_SECRET 미설정. Setup.setupProject() 실행 필요.');
  return s;
}

function b64u_(bytesOrStr) {
  var bytes = typeof bytesOrStr === 'string' ? Utilities.newBlob(bytesOrStr).getBytes() : bytesOrStr;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function hmac_(payloadB64) {
  var sig = Utilities.computeHmacSha256Signature(payloadB64, secret_());
  return b64u_(sig);
}

function makeSession_(userRow) {
  var payloadB64 = b64u_(JSON.stringify(sessionPayload_(userRow)));
  return payloadB64 + '.' + hmac_(payloadB64);
}

/** 토큰 검증. 유효하면 payload 객체, 아니면 null. */
function readSession_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  var parts = token.split('.');
  var payloadB64 = parts[0], sig = parts[1];
  if (hmac_(payloadB64) !== sig) return null;
  try {
    var json = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString();
    var p = JSON.parse(json);
    if (!p.exp || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch (e) {
    return null;
  }
}
