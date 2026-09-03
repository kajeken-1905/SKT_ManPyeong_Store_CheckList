/**
 * Config.gs
 * 앱 전역 상수 · 점검 항목 · 배점/판정 규칙 · 초기 시드 데이터.
 * 값을 바꾸면 Setup.setupProject() 를 다시 실행해 시트에 반영한다.
 */

// ── 시트 이름 ────────────────────────────────────────────────
var SHEETS = {
  STORES: 'Stores',
  ITEMS: 'Items',
  USERS: 'Users',
  INSPECTIONS: 'Inspections',
  SCORES: 'Scores',
  PHOTOS: 'Photos'
};

// ── 시트별 헤더(컬럼 순서) ───────────────────────────────────
var HEADERS = {
  Stores: ['store_id', '매장명', '팀', '그룹장', '총괄', '활성여부'],
  Items: ['item_id', '순번', '항목명', '설명', '배점', '중요항목'],
  Users: ['user_id', '이름', '역할', '담당', '이메일', '활성여부'],
  Inspections: [
    'inspection_id', 'store_id', '매장명', '점검일시',
    '점검자이름', '점검자이메일', '점검자역할',
    '총점', '평가결과', '재점검필요', '재점검회차', '90점미만',
    '상태', '생성일시', '수정일시'
  ],
  Scores: [
    'score_id', 'inspection_id', 'item_id', '순번', '항목명',
    '배점', '점수', '사유', '기타특이점', 'X표시'
  ],
  Photos: [
    'photo_id', 'inspection_id', '구분', 'drive_file_id', 'url',
    '업로더이메일', '업로드일시'
  ]
};

// ── 역할 ─────────────────────────────────────────────────────
var ROLES = { GROUP_LEADER: '그룹장', HEAD: '총괄', CEO: '대표' };
// 점검을 수행할 수 있는 역할
var INSPECTOR_ROLES = [ROLES.GROUP_LEADER, ROLES.HEAD, ROLES.CEO];
// 전체 매장을 볼 수 있는 역할(그 외 역할은 담당 팀 매장만)
var ALL_STORE_ROLES = [ROLES.HEAD, ROLES.CEO];

// ── 점검 항목 (만점 100점) ──────────────────────────────────
// critical: '중요항목' 여부. 10개 항목 모두 동등하게 중요항목(사용자 확인, 2026-09-03).
// → 항목 중 X 표시가 CRITICAL_X_THRESHOLD(2) 개 이상이면 재점검 필요.
var CHECKLIST_ITEMS = [
  { id: 'Q1',  no: 1,  max: 20, critical: true,
    name: '고객 상담석의 청결 및 정리정돈 상태',
    desc: '오염정도, 개인물품 등의 정리 상태, 업무용 기기 및 책자·팜플렛 정리 상태 등 전반적인 상태 점검' },
  { id: 'Q2',  no: 2,  max: 10, critical: true,
    name: '매장 외부 기초 청소 상태 점검', desc: '' },
  { id: 'Q3',  no: 3,  max: 10, critical: true,
    name: '매장 내부 기초 청소 상태 점검', desc: '' },
  { id: 'Q4',  no: 4,  max: 10, critical: true,
    name: '출입문 및 유리창의 관리상태', desc: '' },
  { id: 'Q5',  no: 5,  max: 10, critical: true,
    name: 'VMD, 손글씨, 현수막 상태 점검',
    desc: '너덜너덜한 VMD 상태 및 포스터 찢어짐, 오염 등' },
  { id: 'Q6',  no: 6,  max: 10, critical: true,
    name: '고객 대기 공간의 청결 상태', desc: '대기 공간 전체의 청결 및 정리정돈 상태' },
  { id: 'Q7',  no: 7,  max: 10, critical: true,
    name: '매장 내부 가구 상태 점검', desc: '악세사리장, 쓰레기통, 수납장 등' },
  { id: 'Q8',  no: 8,  max: 5,  critical: true,
    name: '근무자 모두의 복장 및 용모', desc: '유니폼, 신발, 고객에게 거부감을 줄만한 모든 부분 등' },
  { id: 'Q9',  no: 9,  max: 10, critical: true,
    name: '단말기 시연 매대 관리', desc: '청결, 시연폰 관리' },
  { id: 'Q10', no: 10, max: 5,  critical: true,
    name: '정수기, 공기청정기 및 냉난방기 등 편의 시설의 관리', desc: '' }
];

var MAX_TOTAL = 100;               // 항목 배점 합계
var CRITICAL_X_THRESHOLD = 2;      // X 표시 2개 이상 → 재점검

// ── 판정 규칙 ────────────────────────────────────────────────
// total 점수로 평가결과 / 재점검 필요 여부 결정.
var GRADE_RULES = [
  { min: 95, grade: '우수',      recheck: false },
  { min: 90, grade: '양호',      recheck: false },
  { min: 85, grade: '관리 필요', recheck: true  },
  { min: 0,  grade: '개선 필요', recheck: true  }
];

// 90점 미만 매장 후속 조치 안내(작성 페이지에서 노출).
var UNDER_90_ACTIONS = [
  '24시간 내 밴드 댓글로 개선 사진 제출 [전/후 사진 제출]',
  '다음주 즉시 재점검',
  '2회 연속 90점 미만 매장은 해당 분기 VD 수수료 50% 재정산'
];

// ── 초기 매장 목록 (14개) ──────────────────────────────────
var STORE_SEED = [
  ['D333040044', '대구만평대리점 성서점',   '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040047', '대구만평대리점 태전점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040050', '대구만평대리점 동천점',   '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040054', '대구만평대리점 본점',     '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040058', '대구만평대리점 화원점',   '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040062', '대구만평대리점 사월점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040066', '대구만평대리점 용지점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040067', '대구만평대리점 지산점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040069', '대구만평대리점 신월성점', '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040071', '대구만평대리점 경산점',   '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040072', '대구만평대리점 이시아점', '함께팀', '정시영', '신동훈', 'Y'],
  ['D333040073', '대구만평대리점 수성점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040075', '대구만평대리점 구암점',   '멀리팀', '정수빈', '신동훈', 'Y'],
  ['D333040076', '대구만평대리점 장기점',   '함께팀', '정시영', '신동훈', 'Y']
];

// ── 초기 사용자 목록 ───────────────────────────────────────
// 이메일은 추후 채운다. 비어 있으면 Google 로그인으로는 통과 못 하고,
// 개발 중에는 DEV_MODE 임시 로그인으로 화면을 확인한다.
var USER_SEED = [
  ['정구원', ROLES.CEO,          '전체',   '', 'Y'],
  ['신동훈', ROLES.HEAD,         '전체',   '', 'Y'],
  ['정시영', ROLES.GROUP_LEADER, '함께팀', '', 'Y'],
  ['정수빈', ROLES.GROUP_LEADER, '멀리팀', '', 'Y']
];

// ── Script Properties 키 ───────────────────────────────────
var PROP = {
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  DRIVE_FOLDER_ID: 'DRIVE_FOLDER_ID',
  SESSION_SECRET: 'SESSION_SECRET',
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  DEV_MODE: 'DEV_MODE'
};

var SESSION_TTL_SEC = 60 * 60 * 12;  // 세션 12시간

/** DEV_MODE 여부 (임시 로그인 허용). 기본 true, 운영 배포 시 'false' 로 변경. */
function isDevMode_() {
  var v = PropertiesService.getScriptProperties().getProperty(PROP.DEV_MODE);
  return v === null || String(v).toLowerCase() === 'true';
}
