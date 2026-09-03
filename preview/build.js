/**
 * preview/build.js
 * src/ui 의 실제 화면 파일들을 그대로 이어붙여, 백엔드 없이 브라우저에서
 * 바로 열어볼 수 있는 목업 미리보기(preview/index.html)를 생성한다.
 *
 *   node preview/build.js
 *
 * 목업 데이터는 src/Config.gs 와 동일하게 맞춰 둔다(변경 시 아래 MOCK 수정).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'src', 'ui');
const read = (p) => fs.readFileSync(p, 'utf8');

let html = read(path.join(UI, 'index.html'));

const includes = {
  "ui/styles": read(path.join(UI, 'styles.html')),
  "ui/page-checklist": read(path.join(UI, 'page-checklist.html')),
  "ui/page-dashboard": read(path.join(UI, 'page-dashboard.html')),
  "ui/page-stores": read(path.join(UI, 'page-stores.html')),
  "ui/pages": read(path.join(UI, 'pages.html')),
  "ui/checklist": read(path.join(UI, 'checklist.html')),
  "ui/app": read(path.join(UI, 'app.html')),
};

// <?!= include('ui/xxx'); ?> 치환
html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (m, name) => {
  if (!(name in includes)) throw new Error('알 수 없는 include: ' + name);
  return includes[name];
});

// window.__BUILD__ 주입값 치환
html = html.replace(
  /window\.__BUILD__ = <\?!=[^;]+;?\s*\?>;/,
  "window.__BUILD__ = { appName: '만평대리점 매장 점검 체크리스트', devMode: true, googleClientId: '' };"
);

// 목업 google.script.run 셔임 + 미리보기 배너 주입 (pages/app 스크립트보다 먼저)
const MOCK = `
<style>
  body { padding-top: 26px; }
  #mpPreviewBanner {
    position: fixed; left: 0; right: 0; top: 0; z-index: 9999;
    background: #d99a00; color: #23271f;
    font: 600 12px/1.6 -apple-system, sans-serif; text-align: center; padding: 4px 8px;
  }
</style>
<div id="mpPreviewBanner">미리보기 (목업 데이터) · 실제 배포본 아님 · Google 로그인/저장 불가</div>
<script>
(function () {
  var STORES = [
    ['D333040044','대구만평대리점 성서점','함께팀','정시영'],
    ['D333040047','대구만평대리점 태전점','멀리팀','정수빈'],
    ['D333040050','대구만평대리점 동천점','함께팀','정시영'],
    ['D333040054','대구만평대리점 본점','멀리팀','정수빈'],
    ['D333040058','대구만평대리점 화원점','함께팀','정시영'],
    ['D333040062','대구만평대리점 사월점','멀리팀','정수빈'],
    ['D333040066','대구만평대리점 용지점','멀리팀','정수빈'],
    ['D333040067','대구만평대리점 지산점','멀리팀','정수빈'],
    ['D333040069','대구만평대리점 신월성점','함께팀','정시영'],
    ['D333040071','대구만평대리점 경산점','함께팀','정시영'],
    ['D333040072','대구만평대리점 이시아점','함께팀','정시영'],
    ['D333040073','대구만평대리점 수성점','멀리팀','정수빈'],
    ['D333040075','대구만평대리점 구암점','멀리팀','정수빈'],
    ['D333040076','대구만평대리점 장기점','함께팀','정시영']
  ].map(function (r) { return { store_id: r[0], name: r[1], team: r[2], leader: r[3], head: '신동훈' }; });

  var ITEMS = [
    ['Q1',1,20,true,'고객 상담석의 청결 및 정리정돈 상태','오염정도, 개인물품 등의 정리 상태, 업무용 기기 및 책자·팜플렛 정리 상태 등'],
    ['Q2',2,10,true,'매장 외부 기초 청소 상태 점검',''],
    ['Q3',3,10,true,'매장 내부 기초 청소 상태 점검',''],
    ['Q4',4,10,true,'출입문 및 유리창의 관리상태',''],
    ['Q5',5,10,true,'VMD, 손글씨, 현수막 상태 점검','너덜너덜한 VMD 상태 및 포스터 찢어짐, 오염 등'],
    ['Q6',6,10,true,'고객 대기 공간의 청결 상태','대기 공간 전체의 청결 및 정리정돈 상태'],
    ['Q7',7,10,true,'매장 내부 가구 상태 점검','악세사리장, 쓰레기통, 수납장 등'],
    ['Q8',8,5,true,'근무자 모두의 복장 및 용모','유니폼, 신발 등'],
    ['Q9',9,10,true,'단말기 시연 매대 관리','청결, 시연폰 관리'],
    ['Q10',10,5,true,'정수기, 공기청정기 및 냉난방기 등 편의 시설의 관리','']
  ].map(function (r) { return { item_id: r[0], no: r[1], max: r[2], critical: r[3], name: r[4], desc: r[5] }; });

  var GRADE_RULES = [
    { min: 95, grade: '우수', recheck: false },
    { min: 90, grade: '양호', recheck: false },
    { min: 85, grade: '관리 필요', recheck: true },
    { min: 0,  grade: '개선 필요', recheck: true }
  ];
  var ACTIONS = [
    '24시간 내 밴드 댓글로 개선 사진 제출 [전/후 사진 제출]',
    '다음주 즉시 재점검',
    '2회 연속 90점 미만 매장은 해당 분기 VD 수수료 50% 재정산'
  ];

  function userFor(role) {
    var team = role === '그룹장' ? '함께팀' : '전체';
    var all = (role === '총괄' || role === '대표');
    return { uid: 'DEV_' + role, name: '[개발]' + role, role: role, team: team,
      email: 'dev+' + role + '@example.com', canSeeAllStores: all };
  }

  var API = {
    getAuthConfig: function () { return { devMode: true, googleClientId: '', ready: true }; },
    devLogin: function (role) {
      if (['그룹장','총괄','대표'].indexOf(role) < 0) throw new Error('알 수 없는 역할: ' + role);
      return { token: 'mock.' + role, user: userFor(role) };
    },
    login: function () { throw new Error('미리보기에서는 Google 로그인을 쓸 수 없습니다.'); },
    getBootstrap: function (token) {
      var role = String(token).split('.')[1] || '그룹장';
      var u = userFor(role);
      var stores = u.canSeeAllStores ? STORES : STORES.filter(function (s) { return s.team === u.team; });
      return {
        user: u, stores: stores, items: ITEMS, gradeRules: GRADE_RULES,
        under90Actions: ACTIONS, maxTotal: 100, criticalXThreshold: 2,
        serverTime: new Date().toISOString().slice(0, 19)
      };
    },
    saveInspection: function (token, payload) {
      var ev = API.previewEvaluation(token, (payload && payload.entries) || []);
      return {
        inspection_id: 'INS_mock_' + Date.now(),
        status: payload && payload.status === '제출' ? '제출' : '임시저장',
        total: ev.total, grade: ev.grade, needRecheck: ev.needRecheck,
        under90: ev.under90, criticalXCount: ev.criticalXCount, actions: ev.actions,
        photos: ((payload && payload.photos) || []).map(function (p) {
          return { ok: true, kind: p.kind, url: '#mock' };
        })
      };
    },
    previewEvaluation: function (token, entries) {
      var map = {}; ITEMS.forEach(function (i) { map[i.item_id] = i; });
      var total = 0, cx = 0, breakdown = [];
      (entries || []).forEach(function (e) {
        var it = map[e.item_id]; if (!it) return;
        var s = Math.max(0, Math.min(Number(e.score) || 0, it.max));
        total += s;
        var isX = e.isX === true;
        if (isX && it.critical) cx++;
        breakdown.push({ item_id: it.id, no: it.no, name: it.name, max: it.max, score: s, isX: isX, critical: it.critical });
      });
      total = Math.round(total * 10) / 10;
      var rule = GRADE_RULES.filter(function (r) { return total >= r.min; })[0];
      return {
        total: total, grade: rule.grade,
        needRecheck: rule.recheck || cx >= 2, under90: total < 90,
        criticalXCount: cx, actions: total < 90 ? ACTIONS.slice() : [], breakdown: breakdown
      };
    }
  };

  function makeRunner() {
    var ok = null, fail = null;
    var runner = {
      withSuccessHandler: function (fn) { ok = fn; return runner; },
      withFailureHandler: function (fn) { fail = fn; return runner; }
    };
    Object.keys(API).forEach(function (name) {
      runner[name] = function () {
        var args = arguments;
        setTimeout(function () {
          try { var r = API[name].apply(null, args); ok && ok(r); }
          catch (e) { fail && fail(e); }
        }, 100);
      };
    });
    return runner;
  }

  window.google = window.google || {};
  window.google.script = {};
  Object.defineProperty(window.google.script, 'run', { get: makeRunner });
})();
</script>
`;

html = html.replace(includes['ui/pages'], MOCK + includes['ui/pages']);

const out = path.join(__dirname, 'index.html');
fs.writeFileSync(out, html, 'utf8');
console.log('생성됨:', path.relative(ROOT, out));
