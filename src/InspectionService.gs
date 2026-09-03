/**
 * InspectionService.gs
 * 점검 점수 계산 · 판정 로직.  (저장/조회 API 는 Phase 2~4 에서 확장)
 */

/**
 * 항목별 입력으로 총점 · 평가결과 · 재점검 여부를 계산한다.
 * @param {Array<{item_id:string, score:number, isX:boolean}>} entries
 * @return {{total:number, grade:string, needRecheck:boolean, under90:boolean,
 *           criticalXCount:number, actions:string[], breakdown:Object[]}}
 */
function evaluateInspection_(entries) {
  var itemMap = {};
  CHECKLIST_ITEMS.forEach(function (it) { itemMap[it.id] = it; });

  var total = 0;
  var criticalXCount = 0;
  var breakdown = [];

  (entries || []).forEach(function (e) {
    var it = itemMap[e.item_id];
    if (!it) return;
    var raw = Number(e.score);
    if (isNaN(raw) || raw < 0) raw = 0;
    if (raw > it.max) raw = it.max;
    total += raw;
    var isX = e.isX === true || String(e.isX).toUpperCase() === 'Y';
    if (isX && it.critical) criticalXCount++;
    breakdown.push({
      item_id: it.id, no: it.no, name: it.name, max: it.max,
      score: raw, isX: isX, critical: it.critical,
      reason: e.reason || '', note: e.note || ''
    });
  });

  total = Math.round(total * 10) / 10;

  var ruleHit = GRADE_RULES.filter(function (r) { return total >= r.min; })[0] || GRADE_RULES[GRADE_RULES.length - 1];
  var needRecheck = ruleHit.recheck || (criticalXCount >= CRITICAL_X_THRESHOLD);
  var under90 = total < 90;

  return {
    total: total,
    grade: ruleHit.grade,
    needRecheck: needRecheck,
    under90: under90,
    criticalXCount: criticalXCount,
    actions: under90 ? UNDER_90_ACTIONS.slice() : [],
    breakdown: breakdown
  };
}

/** 판정 규칙 표(작성 페이지 안내용). */
function getGradeRules_() {
  return GRADE_RULES.map(function (r) {
    return { min: r.min, grade: r.grade, recheck: r.recheck };
  });
}

/**
 * 신규 점검 저장. Inspections 1행 + Scores N행 + (선택)Photos 를 기록한다.
 * @param {Object} user 세션 payload (uid, name, role, team, email)
 * @param {Object} payload
 *   {string}  store_id
 *   {string}  inspectedAt   'yyyy-MM-ddTHH:mm' (없으면 현재)
 *   {number}  recheckRound  0=최초, 1/2=재점검 회차
 *   {string}  status        '임시저장' | '제출'
 *   {Array}   entries       [{item_id, score, isX, reason, note}]
 *   {Array}   photos        [{kind:'전'|'후', dataBase64, mimeType, filename}]
 * @return {Object}
 */
function createInspection_(user, payload) {
  if (!payload || !payload.store_id) throw new Error('매장을 선택하세요.');

  assertStoreAccess_(user, payload.store_id);
  var store = findById_(SHEETS.STORES, 'store_id', payload.store_id);
  if (!store) throw new Error('존재하지 않는 매장입니다: ' + payload.store_id);

  var entries = payload.entries || [];
  var ev = evaluateInspection_(entries);

  var status = payload.status === '제출' ? '제출' : '임시저장';
  var round = Number(payload.recheckRound) || 0;
  var now = nowKst_();
  var when = payload.inspectedAt
    ? String(payload.inspectedAt).replace('T', ' ').slice(0, 16)
    : now;

  var insId = newId_('INS');

  insert_(SHEETS.INSPECTIONS, {
    inspection_id: insId,
    store_id: payload.store_id,
    '매장명': store['매장명'],
    '점검일시': when,
    '점검자이름': user.name,
    '점검자이메일': user.email || '',
    '점검자역할': user.role,
    '총점': ev.total,
    '평가결과': ev.grade,
    '재점검필요': ev.needRecheck ? 'Y' : 'N',
    '재점검회차': round,
    '90점미만': ev.under90 ? 'Y' : 'N',
    '상태': status,
    '생성일시': now,
    '수정일시': now
  });

  var scoreRows = ev.breakdown.map(function (b) {
    return {
      score_id: newId_('SC'),
      inspection_id: insId,
      item_id: b.item_id,
      '순번': b.no,
      '항목명': b.name,
      '배점': b.max,
      '점수': b.score,
      '사유': b.reason || '',
      '기타특이점': b.note || '',
      'X표시': b.isX ? 'Y' : 'N'
    };
  });
  insertMany_(SHEETS.SCORES, scoreRows);

  var photoResults = [];
  (payload.photos || []).forEach(function (p) {
    try {
      var row = savePhoto_({
        inspectionId: insId,
        kind: p.kind,
        dataBase64: p.dataBase64,
        mimeType: p.mimeType || 'image/jpeg',
        filename: p.filename,
        uploaderEmail: user.email || ''
      });
      photoResults.push({ ok: true, kind: row['구분'], url: row.url });
    } catch (e) {
      photoResults.push({ ok: false, error: e.message });
    }
  });

  return {
    inspection_id: insId,
    status: status,
    total: ev.total,
    grade: ev.grade,
    needRecheck: ev.needRecheck,
    under90: ev.under90,
    criticalXCount: ev.criticalXCount,
    actions: ev.actions,
    photos: photoResults
  };
}

/* ────────────────────────────────────────────────────────────
 *  Phase 3 — 대시보드 집계
 * ──────────────────────────────────────────────────────────── */

/** Inspections 한 행 → 대시보드용 객체. */
function toInsView_(r, storeMap) {
  return {
    inspection_id: r.inspection_id,
    store_id: r.store_id,
    store: r['매장명'],
    team: (storeMap[r.store_id] || {}).team || '',
    at: asStr_(r['점검일시']),
    inspector: r['점검자이름'],
    role: r['점검자역할'],
    total: Number(r['총점']) || 0,
    grade: r['평가결과'],
    recheck: String(r['재점검필요']).toUpperCase() === 'Y',
    round: Number(r['재점검회차']) || 0,
    under90: String(r['90점미만']).toUpperCase() === 'Y',
    status: r['상태']
  };
}

function byAtDesc_(a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; }

/**
 * 대시보드 데이터.
 *  - 매장별 현재 상태 / 경고 : 역할 범위 내 "전체 제출" 기준 (기간 필터 무시)
 *  - 최근 목록 / 통계 / 항목 취약점 : 필터 적용, 통계·취약점은 제출 건만
 * @param {Object} user 세션 payload
 * @param {Object} filter {from, to, store_id, grade, status}
 */
function buildDashboard_(user, filter) {
  filter = filter || {};
  var stores = listStoresForUser_(user);
  var storeMap = {};
  stores.forEach(function (s) { storeMap[s.store_id] = s; });

  var allIns = readAll_(SHEETS.INSPECTIONS)
    .filter(function (r) { return storeMap[r.store_id]; })
    .map(function (r) { return toInsView_(r, storeMap); });

  var submitted = allIns.filter(function (i) { return i.status === '제출'; });

  // ── 매장별 현재 상태 ──
  var byStore = {};
  submitted.forEach(function (i) { (byStore[i.store_id] = byStore[i.store_id] || []).push(i); });

  var storeCards = stores.map(function (s) {
    var list = (byStore[s.store_id] || []).slice().sort(byAtDesc_);
    var last = list[0] || null;
    var streak = 0;
    for (var k = 0; k < list.length; k++) { if (list[k].under90) streak++; else break; }
    var avg = list.length
      ? Math.round((list.reduce(function (t, x) { return t + x.total; }, 0) / list.length) * 10) / 10
      : null;
    return {
      store_id: s.store_id, name: s.name, team: s.team,
      count: list.length, avg: avg,
      lastAt: last ? last.at : '',
      lastTotal: last ? last.total : null,
      lastGrade: last ? last.grade : '',
      lastRecheck: last ? last.recheck : false,
      lastUnder90: last ? last.under90 : false,
      under90Streak: streak
    };
  });

  var warnings = {
    recheck: storeCards.filter(function (c) { return c.lastRecheck; }),
    under90: storeCards.filter(function (c) { return c.lastUnder90; }),
    streak2: storeCards.filter(function (c) { return c.under90Streak >= 2; })
  };

  // ── 필터 ──
  function pass(i) {
    if (filter.store_id && i.store_id !== filter.store_id) return false;
    if (filter.grade && i.grade !== filter.grade) return false;
    if (filter.status && i.status !== filter.status) return false;
    var day = i.at.slice(0, 10);
    if (filter.from && day && day < filter.from) return false;
    if (filter.to && day && day > filter.to) return false;
    return true;
  }
  var filtered = allIns.filter(pass).sort(byAtDesc_);
  var recent = filtered.slice(0, 100);
  var fSub = filtered.filter(function (i) { return i.status === '제출'; });

  var stat = {
    submittedCount: fSub.length,
    avgScore: fSub.length
      ? Math.round((fSub.reduce(function (t, x) { return t + x.total; }, 0) / fSub.length) * 10) / 10
      : null,
    recheckCount: warnings.recheck.length,
    under90Count: warnings.under90.length,
    streak2Count: warnings.streak2.length
  };

  // ── 항목별 취약점 ──
  var subIds = {};
  fSub.forEach(function (i) { subIds[i.inspection_id] = true; });
  var agg = {};
  CHECKLIST_ITEMS.forEach(function (it) {
    agg[it.id] = { item_id: it.id, no: it.no, name: it.name, max: it.max, sum: 0, n: 0, x: 0, below: 0 };
  });
  if (fSub.length) {
    readAll_(SHEETS.SCORES).forEach(function (sc) {
      if (!subIds[sc.inspection_id]) return;
      var a = agg[sc.item_id];
      if (!a) return;
      var v = Number(sc['점수']) || 0;
      a.sum += v; a.n++;
      if (String(sc['X표시']).toUpperCase() === 'Y') a.x++;
      if (v < a.max) a.below++;
    });
  }
  var itemWeakness = Object.keys(agg).map(function (k) {
    var a = agg[k];
    var avg = a.n ? Math.round((a.sum / a.n) * 10) / 10 : null;
    return {
      item_id: a.item_id, no: a.no, name: a.name, max: a.max,
      avg: avg,
      ratio: (avg != null && a.max) ? Math.round((avg / a.max) * 100) : null,
      xCount: a.x, belowCount: a.below, n: a.n
    };
  }).sort(function (p, q) {
    return (p.ratio == null ? 999 : p.ratio) - (q.ratio == null ? 999 : q.ratio);
  });

  return {
    scope: ALL_STORE_ROLES.indexOf(user.role) >= 0 ? '전체 매장' : user.team,
    stores: stores,
    grades: GRADE_RULES.map(function (r) { return r.grade; }),
    stat: stat,
    warnings: warnings,
    storeCards: storeCards,
    itemWeakness: itemWeakness,
    recent: recent
  };
}

/**
 * 점검 1건 상세 (보고서).
 * @param {Object} user 세션 payload
 * @param {string} inspectionId
 */
function getInspectionDetail_(user, inspectionId) {
  var ins = findById_(SHEETS.INSPECTIONS, 'inspection_id', inspectionId);
  if (!ins) throw new Error('점검 기록을 찾을 수 없습니다.');
  assertStoreAccess_(user, ins.store_id);

  var scores = query_(SHEETS.SCORES, { inspection_id: inspectionId })
    .sort(function (a, b) { return (Number(a['순번']) || 0) - (Number(b['순번']) || 0); })
    .map(function (s) {
      return {
        item_id: s.item_id, no: Number(s['순번']) || 0, name: s['항목명'],
        max: Number(s['배점']) || 0, score: Number(s['점수']) || 0,
        isX: String(s['X표시']).toUpperCase() === 'Y',
        reason: s['사유'] || '', note: s['기타특이점'] || ''
      };
    });

  var photos = query_(SHEETS.PHOTOS, { inspection_id: inspectionId }).map(function (p) {
    return { kind: p['구분'], url: p.url, at: asStr_(p['업로드일시']) };
  });

  return {
    inspection: {
      inspection_id: ins.inspection_id,
      store: ins['매장명'], store_id: ins.store_id,
      at: asStr_(ins['점검일시']),
      inspector: ins['점검자이름'], role: ins['점검자역할'],
      total: Number(ins['총점']) || 0, grade: ins['평가결과'],
      recheck: String(ins['재점검필요']).toUpperCase() === 'Y',
      round: Number(ins['재점검회차']) || 0,
      under90: String(ins['90점미만']).toUpperCase() === 'Y',
      status: ins['상태'],
      createdAt: asStr_(ins['생성일시'])
    },
    scores: scores,
    photos: photos,
    under90Actions: (Number(ins['총점']) || 0) < 90 ? UNDER_90_ACTIONS.slice() : []
  };
}
