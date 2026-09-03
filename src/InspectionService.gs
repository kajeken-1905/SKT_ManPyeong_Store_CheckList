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
