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
  "ui/checklist": read(path.join(UI, 'checklist.html')),
  "ui/dashboard": read(path.join(UI, 'dashboard.html')),
  "ui/stores": read(path.join(UI, 'stores.html')),
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

  function mkDashboard(vis, scopeLabel, filter) {
    filter = filter || {};
    var today = new Date();
    function day(off) { var x = new Date(today); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); }
    var seqs = [[94,91,96],[92,90,93],[96,95,98],[88,91,90],[97,96,95],[91,93,89],[83,86,79]];
    var allIns = [];
    vis.forEach(function (s, idx) {
      (seqs[idx % seqs.length]).forEach(function (total, k) {
        var grade = total >= 95 ? '우수' : total >= 90 ? '양호' : total >= 85 ? '관리 필요' : '개선 필요';
        allIns.push({
          inspection_id: 'INS_' + s.store_id + '_' + k,
          store_id: s.store_id, store: s.name, team: s.team,
          at: day(k * 7) + ' 14:30',
          inspector: '[개발]' + (s.team === '함께팀' ? '정시영' : '정수빈'), role: '그룹장',
          total: total, grade: grade, recheck: total < 90, round: 0, under90: total < 90, status: '제출'
        });
      });
    });
    allIns.sort(function (a, b) { return a.at < b.at ? 1 : -1; });

    var storeCards = vis.map(function (s) {
      var list = allIns.filter(function (i) { return i.store_id === s.store_id; });
      var last = list[0];
      var streak = 0;
      for (var k = 0; k < list.length; k++) { if (list[k].under90) streak++; else break; }
      var avg = list.length ? Math.round(list.reduce(function (t, x) { return t + x.total; }, 0) / list.length * 10) / 10 : null;
      return {
        store_id: s.store_id, name: s.name, team: s.team, count: list.length, avg: avg,
        lastAt: last ? last.at : '', lastTotal: last ? last.total : null, lastGrade: last ? last.grade : '',
        lastRecheck: last ? last.recheck : false, lastUnder90: last ? last.under90 : false, under90Streak: streak
      };
    });
    var warnings = {
      recheck: storeCards.filter(function (c) { return c.lastRecheck; }),
      under90: storeCards.filter(function (c) { return c.lastUnder90; }),
      streak2: storeCards.filter(function (c) { return c.under90Streak >= 2; })
    };
    var fSub = allIns.slice();
    if (filter.store_id) fSub = fSub.filter(function (i) { return i.store_id === filter.store_id; });
    if (filter.grade) fSub = fSub.filter(function (i) { return i.grade === filter.grade; });
    if (filter.status) fSub = fSub.filter(function (i) { return i.status === filter.status; });
    var stat = {
      submittedCount: fSub.length,
      avgScore: fSub.length ? Math.round(fSub.reduce(function (t, x) { return t + x.total; }, 0) / fSub.length * 10) / 10 : null,
      recheckCount: warnings.recheck.length, under90Count: warnings.under90.length, streak2Count: warnings.streak2.length
    };
    var itemWeakness = ITEMS.map(function (it, idx) {
      var avg = Math.round(Math.max(0, it.max - (idx % 3 === 0 ? 2.5 : idx % 3 === 1 ? 1 : 0.3)) * 10) / 10;
      return {
        item_id: it.item_id, no: it.no, name: it.name, max: it.max,
        avg: avg, ratio: Math.round(avg / it.max * 100),
        xCount: idx % 4 === 0 ? 2 : 0, belowCount: idx % 2, n: fSub.length
      };
    }).sort(function (a, b) { return a.ratio - b.ratio; });

    return {
      scope: scopeLabel, stores: vis, grades: ['우수', '양호', '관리 필요', '개선 필요'],
      stat: stat, warnings: warnings, storeCards: storeCards, itemWeakness: itemWeakness,
      recent: fSub.slice(0, 100)
    };
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
    getDashboard: function (token, filter) {
      var role = String(token).split('.')[1] || '그룹장';
      var u = userFor(role);
      var vis = u.canSeeAllStores ? STORES : STORES.filter(function (s) { return s.team === u.team; });
      return mkDashboard(vis, u.canSeeAllStores ? '전체 매장' : u.team, filter || {});
    },
    getInspectionDetail: function (token, id) {
      var parts = String(id).split('_');
      var storeId = parts[1], k = Number(parts[2]) || 0;
      var s = STORES.filter(function (x) { return x.store_id === storeId; })[0] || STORES[0];
      var totals = [94, 91, 96, 88, 92, 90];
      var total = totals[k % totals.length] || 88;
      var grade = total >= 95 ? '우수' : total >= 90 ? '양호' : total >= 85 ? '관리 필요' : '개선 필요';
      var scores = ITEMS.map(function (it, idx) {
        var sc = Math.max(0, it.max - (idx === 0 ? 4 : idx === 2 ? 2 : 0));
        return {
          item_id: it.item_id, no: it.no, name: it.name, max: it.max, score: sc,
          isX: idx === 2, reason: idx === 0 ? '개인물품 정리 미흡' : '', note: ''
        };
      });
      return {
        inspection: {
          inspection_id: id, store: s.name, store_id: storeId,
          at: new Date().toISOString().slice(0, 10) + ' 14:30', inspector: '[개발]점검자', role: '그룹장',
          total: total, grade: grade, recheck: total < 90, round: 0, under90: total < 90,
          status: '제출', createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
        },
        scores: scores, photos: [], under90Actions: total < 90 ? ACTIONS.slice() : []
      };
    },
    getStoreSummary: function (token, storeId, period) {
      var s = STORES.filter(function (x) { return x.store_id === storeId; })[0] || STORES[0];
      period = ['day', 'week', 'month', 'year'].indexOf(period) >= 0 ? period : 'month';
      var n = period === 'day' ? 20 : period === 'week' ? 16 : period === 'month' ? 12 : 3;
      var series = [];
      for (var i = 0; i < n; i++) {
        var avg = Math.max(72, Math.min(100, Math.round((92 + Math.sin(i / 2) * 4 - (i % 5 === 0 ? 6 : 0)) * 10) / 10));
        var min = Math.max(65, Math.round((avg - (2 + (i % 3) * 3)) * 10) / 10);
        var label = period === 'day' ? ('2026-09-' + String(i + 1).padStart(2, '0'))
          : period === 'week' ? ('2026-W' + String(20 + i))
          : period === 'month' ? ('2026-' + String(i + 1).padStart(2, '0'))
          : String(2024 + i);
        series.push({
          key: label, label: label, avg: avg, min: min, max: Math.min(100, avg + 3),
          count: 1 + (i % 2), recheckCount: avg < 90 ? 1 : 0, under90Count: avg < 90 ? 1 : 0
        });
      }
      var records = [];
      for (var k = 0; k < 12; k++) {
        var t = Math.max(72, Math.min(100, Math.round((90 + Math.sin(k) * 6) * 10) / 10));
        var g = t >= 95 ? '우수' : t >= 90 ? '양호' : t >= 85 ? '관리 필요' : '개선 필요';
        records.push({
          inspection_id: 'INS_' + s.store_id + '_' + k,
          at: '2026-' + String(9 - Math.floor(k / 4)).padStart(2, '0') + '-' + String(28 - (k % 4) * 7).padStart(2, '0') + ' 14:30',
          total: t, grade: g, recheck: t < 90, round: 0,
          inspector: '[개발]' + (s.team === '함께팀' ? '정시영' : '정수빈'), status: '제출'
        });
      }
      var allAvg = series.reduce(function (a, x) { return a + x.avg; }, 0) / series.length;
      return {
        store: { store_id: s.store_id, name: s.name, team: s.team, leader: s.team === '함께팀' ? '정시영' : '정수빈', head: '신동훈' },
        period: period, series: series,
        overall: {
          count: records.length, avg: Math.round(allAvg * 10) / 10,
          min: Math.min.apply(null, series.map(function (x) { return x.min; })),
          max: Math.max.apply(null, series.map(function (x) { return x.max; })),
          recheckCount: records.filter(function (r) { return r.recheck; }).length,
          under90Count: records.filter(function (r) { return r.total < 90; }).length,
          currentUnder90Streak: 1
        },
        penalty: [{
          quarter: '2026-Q2', reason: '2회 연속 90점 미만 → 해당 분기 VD 수수료 50% 재정산',
          inspections: [
            { inspection_id: 'INS_' + s.store_id + '_9', at: '2026-05-12 14:30', total: 88, grade: '관리 필요', round: 0 },
            { inspection_id: 'INS_' + s.store_id + '_10', at: '2026-05-19 14:30', total: 84, grade: '개선 필요', round: 1 }
          ]
        }],
        rechecks: records.filter(function (r) { return r.recheck; }).map(function (r) {
          return { inspection_id: r.inspection_id, at: r.at, total: r.total, grade: r.grade, round: r.round, recheck: true };
        }),
        records: records
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

html = html.replace(includes['ui/checklist'], MOCK + includes['ui/checklist']);

// 스크립트 태그 짝 검증 (include 파일에서 </script> 누락 시 조기 발견)
var openCount = (html.match(/<script\b/g) || []).length;
var closeCount = (html.match(/<\/script>/g) || []).length;
if (openCount !== closeCount) {
  throw new Error('<script> 태그 불균형: 열림 ' + openCount + ' / 닫힘 ' + closeCount +
    ' — src/ui/*.html 중 하나에 </script> 가 빠졌을 수 있음');
}

const out = path.join(__dirname, 'index.html');
fs.writeFileSync(out, html, 'utf8');
console.log('생성됨:', path.relative(ROOT, out), '(script 태그 ' + openCount + '쌍)');
