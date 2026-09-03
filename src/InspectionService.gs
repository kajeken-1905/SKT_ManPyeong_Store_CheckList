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
