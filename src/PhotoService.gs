/**
 * PhotoService.gs
 * 개선 전/후 사진을 Google Drive 에 저장하고 메타데이터를 Photos 시트에 남긴다.
 * (실제 업로드 UI 연동은 Phase 2 에서 마무리)
 */

/** 사진 저장 폴더 핸들. */
function getPhotoFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP.DRIVE_FOLDER_ID);
  if (!id) throw new Error('DRIVE_FOLDER_ID 미설정. Setup.setupProject() 실행 필요.');
  return DriveApp.getFolderById(id);
}

/**
 * base64 데이터로 사진 1장 업로드.
 * @param {Object} p
 * @param {string} p.inspectionId
 * @param {string} p.kind        '전' | '후'
 * @param {string} p.dataBase64  data URL 또는 순수 base64
 * @param {string} p.mimeType    예: image/jpeg
 * @param {string} p.filename
 * @param {string} p.uploaderEmail
 * @return {Object} Photos 행
 */
function savePhoto_(p) {
  var base64 = String(p.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, p.mimeType || 'image/jpeg',
    p.filename || (p.inspectionId + '_' + p.kind + '_' + Date.now() + '.jpg'));

  var folder = getPhotoFolder_();
  var sub = getOrCreateSubFolder_(folder, p.inspectionId);
  var file = sub.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var row = {
    photo_id: newId_('P'),
    inspection_id: p.inspectionId,
    '구분': p.kind || '',
    drive_file_id: file.getId(),
    url: 'https://drive.google.com/uc?id=' + file.getId(),
    '업로더이메일': p.uploaderEmail || '',
    '업로드일시': nowKst_()
  };
  insert_(SHEETS.PHOTOS, row);
  return row;
}

/** 점검 건의 사진 목록. */
function listPhotos_(inspectionId) {
  return query_(SHEETS.PHOTOS, { inspection_id: inspectionId });
}

function getOrCreateSubFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
