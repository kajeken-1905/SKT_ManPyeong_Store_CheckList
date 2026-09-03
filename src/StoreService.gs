/**
 * StoreService.gs
 * 매장 조회. 역할에 따라 볼 수 있는 매장 범위를 제한한다.
 *  - 총괄 / 대표 : 전체 매장
 *  - 그룹장       : 본인 담당 팀 매장
 */

/** 활성 매장 전체. */
function listAllStores_() {
  return query_(SHEETS.STORES, {})
    .filter(function (s) { return String(s['활성여부']).toUpperCase() === 'Y'; })
    .map(toStore_);
}

/**
 * 세션 사용자가 볼 수 있는 매장 목록.
 * @param {Object} user readSession_ payload
 */
function listStoresForUser_(user) {
  var all = listAllStores_();
  if (ALL_STORE_ROLES.indexOf(user.role) >= 0) return all;
  return all.filter(function (s) { return s.team === user.team; });
}

/** 특정 매장 접근 가능 여부. */
function assertStoreAccess_(user, storeId) {
  var ok = listStoresForUser_(user).some(function (s) { return s.store_id === storeId; });
  if (!ok) throw new Error('해당 매장에 접근 권한이 없습니다: ' + storeId);
}

function toStore_(row) {
  return {
    store_id: row.store_id,
    name: row['매장명'],
    team: row['팀'],
    leader: row['그룹장'],
    head: row['총괄']
  };
}
