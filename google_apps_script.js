/**
 * ============================================================
 *  GOOGLE APPS SCRIPT – CHECK-IN CẢM XÚC MẸ BẦU (bản Mã số bệnh nhân, 01/11/2026)
 *  (gốc: docs/style/apps-script-template.js của đội App Creator,
 *   kiểm dữ liệu theo apps/checkin-vao-ca/google_apps_script.js)
 * ============================================================
 *  File này dán vào DỰ ÁN MỚI: Sheet "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026"
 *  (tài khoản bsngvanthong), bản triển khai có URL bắt đầu bằng AKfycbzfN8…
 *  Dự án CŨ (URL AKfycbzSx6…, tài khoản khác) dùng file google_apps_script-du-an-cu.js.
 *
 *  Chức năng:
 *   1) doPost : nhận một lượt check-in từ web, ghi 1 dòng vào tab CheckIn:
 *               A Thời gian (giờ Việt Nam) · B Mã số bệnh nhân
 *               C Phần 1: Mức cảm xúc · D Phần 2: Cảm xúc Capybara · E Mã phiên (ẩn)
 *               Cùng Mã phiên (và cùng Mã số bệnh nhân) thì CẬP NHẬT dòng cũ, giữ nguyên
 *               giờ ở cột A → app gửi lại khi mạng chập chờn vẫn chỉ một dòng.
 *   2) doGet  : KHÔNG trả dữ liệu. Mở URL chỉ thấy "public_read_disabled".
 *               Anh xem dữ liệu thẳng trên Google Sheet (anh là chủ file).
 *
 *  Đổi ngày 01/11/2026 (anh Thông yêu cầu): ô "Số điện thoại" thành "Mã số bệnh nhân".
 *   - Chỉ nhận CHỮ SỐ: bỏ khoảng trắng, dấu chấm, dấu gạch chị gõ lẫn; sau khi bỏ phải
 *     còn 3–20 chữ số. Giữ nguyên số 0 ở đầu (ô ghi dạng văn bản).
 *     Ví dụ nhận: "26012345" · "0012345" (ghi 0012345) · "260 123 45" (ghi 26012345).
 *     Ví dụ từ chối: "12" · 21 chữ số · "HV123" · "=1+1" · để trống.
 *   - Tên trường gửi lên đổi từ phone thành patientId (web đổi cùng lúc).
 *   - Bỏ nhánh nhận app CŨ (không Mã phiên): dự án này chỉ nhận lượt từ app mới,
 *     nên lượt nào thiếu Mã phiên đều bị từ chối.
 *   - Tab đã có tiêu đề cũ "Số điện thoại" ở ô B1 thì tự đổi thành "Mã số bệnh nhân".
 *     Các dòng ghi trước 01/11 vẫn giữ SĐT ở cột B; anh nhìn giờ ở cột A để phân biệt.
 *
 *  ------------------------------------------------------------
 *  HƯỚNG DẪN CÀI ĐẶT (anh Thông tự làm, khoảng 5 phút, làm đúng thứ tự)
 *  ------------------------------------------------------------
 *  BƯỚC 1 – Mở đúng dự án
 *    1.1 Đăng nhập tài khoản bsngvanthong, mở Google Sheet
 *        "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026".
 *    1.2 Menu Tiện ích mở rộng (Extensions) → Apps Script.
 *
 *  BƯỚC 2 – Dán script và chạy thử
 *    2.1 Trong file Code.gs, xóa HẾT code cũ, dán TOÀN BỘ file này vào.
 *    2.2 Bấm biểu tượng đĩa mềm (Lưu) hoặc Ctrl+S.
 *    2.3 Apps Script GIẤU các hàm có tên kết thúc bằng dấu gạch dưới (như test_) khỏi ô
 *        chọn hàm, nên phải thêm một hàm tạm. Xuống CUỐI file, dán thêm đúng dòng:
 *            function chayThu() { test_(); }
 *        rồi Lưu.
 *    2.4 Ô chọn hàm cạnh nút Chạy (Run) chọn  chayThu  rồi bấm Chạy.
 *        Nếu Google hỏi quyền: Xem lại quyền → chọn tài khoản → Nâng cao (Advanced)
 *        → Đi tới … (không an toàn) → Cho phép. Đây là script của chính anh nên cảnh báo
 *        này là bình thường. Mở Nhật ký thực thi (Execution log): thấy các dòng
 *        "test_: ..." và cuối cùng "test_: XONG" là được (dòng thử tự xóa).
 *    2.5 XÓA dòng  function chayThu() { test_(); }  vừa thêm, rồi Lưu lại.
 *
 *  BƯỚC 3 – Cập nhật bản triển khai đang dùng (GIỮ NGUYÊN URL, không tạo triển khai mới)
 *    3.1 Nút Triển khai (Deploy) → Quản lý bản triển khai (Manage deployments).
 *    3.2 Chọn bản triển khai có URL bắt đầu bằng AKfycbzfN8…
 *        → biểu tượng bút chì (Edit) → Phiên bản (Version): Phiên bản mới (New version)
 *        → Triển khai (Deploy).
 *    3.3 Mở URL đó trên trình duyệt → phải thấy
 *            {"result":"error","error":"public_read_disabled"}
 *
 *  BƯỚC 4 – Đưa bản web mới lên NGAY sau bước 3
 *    Web và script đổi tên trường cùng lúc (phone → patientId). Từ lúc xong bước 3 tới lúc
 *    web mới chạy (vài phút), lượt gửi từ bản web cũ bị từ chối (patient_id_invalid).
 *    Nên làm bước 3–4 liền nhau, vào giờ ít người check-in.
 *    4.1 Đưa app lên GitHub (./upload.sh trên Ubuntu hoặc upload.bat trên Surface).
 *    4.2 Chờ vài phút, mở web, check-in thử một lượt với mã số có số 0 ở đầu
 *        (ví dụ 0012345) → tab CheckIn thêm 1 dòng, cột B đúng 0012345, ô B1 là
 *        "Mã số bệnh nhân". Xong thì xóa dòng thử đó.
 *
 *  LẦN SAU CHỈ SỬA CODE: dán code mới → Lưu → làm lại BƯỚC 3 (Phiên bản mới, giữ URL).
 *
 *  KHI CẦN URL MỚI (ví dụ URL bị lộ cho người lạ gửi rác): Triển khai → Triển khai mới
 *    → bánh răng → Ứng dụng web; Thực thi với tư cách: Tôi; Ai có quyền truy cập: Bất kỳ ai
 *    → Triển khai → chép URL, dán vào dòng  const GOOGLE_SCRIPT_URL = '...';  trong script.js,
 *    đưa web lên, rồi mới Lưu trữ (Archive) bản triển khai cũ.
 *
 *  Phía web gửi bằng:
 *    fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
 *    payload = { sessionId, ageMs, patientId, level, part1, part2 }
 *    ageMs = số mili-giây từ lúc chị bấm tới lúc gửi (đo trên cùng đồng hồ điện thoại,
 *    nên đồng hồ máy chị chạy sai cũng không ảnh hưởng). Máy chủ ghi giờ = giờ nhận − ageMs.
 *    part1 client gửi bị bỏ: máy chủ tự ghép "mức - nhãn" từ level.
 *  (Content-Type text/plain để tránh preflight CORS.)
 * ============================================================
 */

/* ===== Cấu hình ===== */

// Tên tab ghi check-in. Đổi ở đây nếu anh đặt tên khác.
var SHEET_NAME = 'CheckIn';

// Cột trong tab. Khóa (key) trùng tên trường trong payload. Cột E là cột kỹ thuật, tự ẩn.
var COLUMNS = [
  { key: 'created_at', header: 'Thời gian' },
  { key: 'patientId',  header: 'Mã số bệnh nhân' },
  { key: 'part1',      header: 'Phần 1: Mức cảm xúc' },
  { key: 'part2',      header: 'Phần 2: Cảm xúc Capybara' },
  { key: 'sessionId',  header: 'Mã phiên' }
];
var SESSION_KEY = 'sessionId';
var ID_COL = 2;                   // cột B
var SESSION_COL = 5;              // cột E, ẩn
var OLD_ID_HEADER = 'Số điện thoại'; // tiêu đề B1 trước 01/11/2026, tự đổi sang tiêu đề mới

// 10 nhãn mức, PHẢI trùng emotionLevels[n].text trong script.js. Index 0 bỏ trống.
// Server tự ghép "mức - nhãn" từ số mức, KHÔNG dùng chuỗi client gửi.
var LEVEL_TEXTS = ['', 'Tuyệt vọng', 'Rất tồi tệ', 'Tồi tệ', 'Kém', 'Bình thường (Ổn)',
                   'Tương đối tốt', 'Tốt', 'Rất tốt', 'Tuyệt vời', 'Rất tuyệt vời'];

// 6 nhãn thẻ Capybara, PHẢI trùng EMOTIONS trong script.js. Chỉ nhận đúng một trong 6 chuỗi này.
var EMOTION_LABELS = ['Vui vẻ', 'Buồn', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu'];

var MAX_BODY_LENGTH   = 2000;     // payload thật chỉ ~150 ký tự; dài hơn là rác
var ID_RAW_MAX_LENGTH = 40;       // trước khi bỏ khoảng trắng/chấm/gạch (ô nhập trên web tối đa 30)
// Mã phiên: 8–40 ký tự chữ/số/gạch nối, KHÔNG bắt đầu bằng gạch (tránh bị safeText_ thêm dấu nháy)
var SESSION_RE        = /^[0-9A-Za-z][0-9A-Za-z-]{7,39}$/;

// Độ trễ từ lúc chị bấm tới lúc gửi (ageMs, mili-giây): lượt gửi lại sau khi mất mạng
// vẫn ghi đúng giờ check-in. Chỉ nhận số nguyên 0 … 8 ngày (hàng chờ trên máy giữ 7 ngày).
var AGE_MAX_MS = 8 * 24 * 60 * 60 * 1000;

// Múi giờ ghi cột Thời gian (máy chủ Google không chạy giờ Việt Nam)
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

/* ===== Tiện ích chung ===== */

/**
 * Chuẩn hóa Mã số bệnh nhân: bỏ khoảng trắng, dấu chấm, dấu gạch;
 * sau khi bỏ phải còn 3–20 CHỮ SỐ (giữ nguyên số 0 ở đầu). Sai → ''.
 * VIẾT GIỐNG HỆT normalizePatientId() trong script.js.
 */
function normalizePatientId_(raw) {
  var s = String(raw == null ? '' : raw).replace(/[\s.\-]/g, '');
  return /^\d{3,20}$/.test(s) ? s : '';
}

/** Giờ dạng HH:mm:ss dd/MM/yyyy theo giờ Việt Nam (cùng định dạng dữ liệu cũ). */
function formatDate_(d) {
  if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.formatDate === 'function') {
    return Utilities.formatDate(d, TIME_ZONE, 'HH:mm:ss dd/MM/yyyy');
  }
  // Dự phòng khi chạy test bằng Node (không có Utilities): giờ máy
  function p(n) { return ('0' + n).slice(-2); }
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' ' +
         p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

/**
 * Phòng thủ lớp hai chống formula injection: Sheets coi ô bắt đầu bằng = + - @
 * (và tab, CR) là công thức. Thêm dấu nháy đơn ' phía trước → Sheets hiểu là văn bản.
 * Áp cho MỌI chuỗi trước khi ghi, dù đã whitelist/regex ở lớp một.
 */
function safeText_(s) {
  var t = String(s == null ? '' : s);
  if (!t) return t;
  var c = t.charAt(0);
  if (c === '=' || c === '+' || c === '-' || c === '@' || c === '\t' || c === '\r') return "'" + t;
  return t;
}

/** Trả JSON. Không có JSONP: web chỉ gửi POST, không đọc gì qua GET. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===== Tab CheckIn ===== */

/** Lấy tab theo TÊN (không dùng getActiveSheet: tab "đang mở" có thể là tab khác). Chưa có thì tạo. */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

/** Đặt tiêu đề một ô ở hàng 1, tô hồng như hàng tiêu đề. */
function setHeaderCell_(sheet, col) {
  sheet.getRange(1, col).setValue(COLUMNS[col - 1].header)
       .setFontWeight('bold').setBackground('#F8BBD0').setFontColor('#880E4F');
}

/**
 * Tab trống: tạo tiêu đề tô hồng, đóng băng hàng 1, ẩn cột E.
 * Tab đã có dữ liệu: B1 còn "Số điện thoại" (hoặc trống) thì đổi thành "Mã số bệnh nhân";
 * thiếu tiêu đề E "Mã phiên" thì bổ sung và ẩn. Không đụng các dòng dữ liệu.
 */
function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c.header; }));
    sheet.getRange(1, 1, 1, COLUMNS.length)
         .setFontWeight('bold').setBackground('#F8BBD0').setFontColor('#880E4F');
    sheet.setFrozenRows(1);
    sheet.hideColumns(SESSION_COL);
    return;
  }
  var b1 = String(sheet.getRange(1, ID_COL).getValue());
  if (b1 === OLD_ID_HEADER || b1 === '') setHeaderCell_(sheet, ID_COL);
  if (sheet.getRange(1, SESSION_COL).getValue() !== COLUMNS[SESSION_COL - 1].header) {
    setHeaderCell_(sheet, SESSION_COL);
    sheet.hideColumns(SESSION_COL);
  }
}

/** Tìm dòng có cùng Mã phiên. Trả về số dòng hoặc -1. */
function findSessionRow_(sheet, sessionId) {
  if (!sessionId) return -1;
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var values = sheet.getRange(2, SESSION_COL, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(sessionId)) return i + 2;
  }
  return -1;
}

/** Có trường này không (thiếu, null, chuỗi rỗng/khoảng trắng đều coi là không có). */
function present_(v) {
  return !(v == null || (typeof v === 'string' && v.trim() === ''));
}

/** Mức: chỉ nhận số nguyên 1..10 kiểu number, hoặc chuỗi đúng 1–2 chữ số ("7"). Sai → 0. */
function parseLevel_(v) {
  var n = 0;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,2}$/.test(v)) n = Number(v);
  else return 0;
  return (isFinite(n) && n === Math.floor(n) && n >= 1 && n <= 10) ? n : 0;
}

/** Giờ ghi cột A = giờ máy chủ lúc nhận − ageMs (nếu ageMs là số nguyên 0 … 8 ngày), ngược lại giờ máy chủ. */
function createdAt_(ageMs) {
  var now = new Date().getTime();
  if (typeof ageMs === 'number' && isFinite(ageMs) && ageMs === Math.floor(ageMs) &&
      ageMs >= 0 && ageMs <= AGE_MAX_MS) {
    return formatDate_(new Date(now - ageMs));
  }
  return formatDate_(new Date(now));
}

/**
 * Kiểm payload. Trả mã lỗi ngắn
 *   session_invalid | patient_id_invalid | level_invalid | emotion_required | emotion_invalid
 * hoặc '' nếu hợp lệ, kèm out = { created_at, patientId, part1, part2, sessionId } đã làm sạch.
 * - Mã phiên BẮT BUỘC, đúng SESSION_RE (dự án này chỉ nhận lượt từ app mới).
 * - Mã số bệnh nhân: chuỗi, ≤ 40 ký tự, sau khi bỏ khoảng trắng/chấm/gạch còn 3–20 chữ số.
 * - Mức: trường level bắt buộc (không đọc số từ part1 nữa).
 * - created_at client gửi (nếu có) bị bỏ: giờ = giờ máy chủ − ageMs hợp lệ, hoặc giờ máy chủ.
 * Mọi ô ghi vào Sheet đều đến từ whitelist hoặc regex, nên không chuỗi nào bắt đầu
 * bằng = + - @ lọt được; safeText_ ở doPost là lớp phòng thủ thứ hai.
 */
function validateCheckin_(data, out) {
  var rawSid = data[SESSION_KEY];
  if (typeof rawSid !== 'string') return 'session_invalid';
  var sid = rawSid.trim();
  if (!SESSION_RE.test(sid)) return 'session_invalid';

  if (typeof data.patientId !== 'string' || data.patientId.length > ID_RAW_MAX_LENGTH) return 'patient_id_invalid';
  var pid = normalizePatientId_(data.patientId);
  if (!pid) return 'patient_id_invalid';

  var lv = parseLevel_(data.level);
  if (!lv) return 'level_invalid';

  if (!present_(data.part2)) return 'emotion_required';
  var emo = typeof data.part2 === 'string' ? data.part2.trim() : '';
  if (EMOTION_LABELS.indexOf(emo) < 0) return 'emotion_invalid';

  out.created_at = createdAt_(data.ageMs);
  out.patientId = pid;
  out.part1 = lv + ' - ' + LEVEL_TEXTS[lv];       // ghép lại từ bảng, không dùng chữ client gửi
  out.part2 = emo;
  out.sessionId = sid;
  return '';
}

/** NHẬN DỮ LIỆU TỪ WEB – ghi hoặc cập nhật một dòng */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' || !e.postData.contents) {
      return json_({ result: 'error', error: 'no_data' });
    }
    var body = e.postData.contents;
    if (body.length > MAX_BODY_LENGTH) return json_({ result: 'error', error: 'too_large' });

    var data;
    try { data = JSON.parse(body); }
    catch (parseErr) { return json_({ result: 'error', error: 'bad_json' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json_({ result: 'error', error: 'bad_json' });

    // Kiểm trước rồi mới khóa: payload xấu không chiếm khóa ghi
    var clean = {};
    var invalid = validateCheckin_(data, clean);
    if (invalid) return json_({ result: 'error', error: invalid });

    lock.waitLock(5000);   // tránh hai lượt ghi đè nhau
    locked = true;

    var sheet = sheet_();
    ensureHeader_(sheet);
    var row = COLUMNS.map(function (c) { return safeText_(clean[c.key]); });

    var existing = findSessionRow_(sheet, clean.sessionId);
    if (existing > 0) {
      // Cùng Mã phiên mà khác Mã số bệnh nhân: không cho ghi đè dòng của người khác
      var oldId = String(sheet.getRange(existing, ID_COL).getValue()).replace(/^'/, '');
      if (oldId !== clean.patientId) return json_({ result: 'error', error: 'session_conflict' });
      // Cập nhật B–E, GIỮ cột A (giờ check-in lần đầu)
      var upd = sheet.getRange(existing, 2, 1, COLUMNS.length - 1);
      upd.setNumberFormat('@');
      upd.setValues([row.slice(1)]);
      return json_({ result: 'success', action: 'updated' });
    }
    // Văn bản thuần cho dòng này: giữ số 0 đầu của Mã số bệnh nhân, giờ không bị đổi thành
    // ngày kiểu Mỹ. Chỉ đặt cho dòng đang ghi, không đụng dòng cũ.
    var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, COLUMNS.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    // Không trả số dòng (lộ tổng số lượt check-in) hay chi tiết lỗi nội bộ
    return json_({ result: 'success', action: 'inserted' });
  } catch (err) {
    // Lỗi tạm (khóa bận, Sheet chậm): báo app gửi lại sau
    return json_({ result: 'error', error: 'server_busy', retry: true });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (ignored) {} }
  }
}

/** ĐỌC DỮ LIỆU QUA URL: ĐÃ TẮT. Không có cách nào tải mã số/cảm xúc qua đường link. */
function doGet() {
  return json_({ result: 'error', error: 'public_read_disabled' });
}

/* ===== Chạy thử trong editor ===== */

/**
 * Chạy qua hàm tạm chayThu (xem BƯỚC 2.3–2.5 ở đầu file), rồi xem Nhật ký thực thi.
 * Ghi 1 dòng thử (mã số có số 0 đầu), ghi lại cùng Mã phiên (phải "updated"), thử vài payload
 * sai, rồi xóa dòng thử.
 */
function test_() {
  var sid = 'test-' + new Date().getTime();
  var ok = { sessionId: sid, patientId: '0012 345', level: 5, part1: '5 - Bình thường (Ổn)', part2: 'Vui vẻ' };
  var post = function (o) { return JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).getContent()); };

  Logger.log('test_: POST lần 1 → ' + JSON.stringify(post(ok)));
  var r2 = post(ok);
  Logger.log('test_: POST lần 2 cùng Mã phiên → ' + JSON.stringify(r2) + (r2.action === 'updated' ? ' (đúng: không thêm dòng)' : ' (SAI)'));
  var sheet = sheet_();
  var rowNo = findSessionRow_(sheet, sid);
  var b = rowNo > 0 ? String(sheet.getRange(rowNo, ID_COL).getValue()) : '';
  Logger.log('test_: cột B của dòng thử = "' + b + '"' + (b === '0012345' ? ' (đúng: giữ số 0 đầu)' : ' (SAI)'));
  Logger.log('test_: ô B1 = "' + sheet.getRange(1, ID_COL).getValue() + '"');
  Logger.log('test_: mã "12" → ' + JSON.stringify(post({ sessionId: sid, patientId: '12', level: 5, part2: 'Vui vẻ' })));
  Logger.log('test_: mã "HV123" → ' + JSON.stringify(post({ sessionId: sid, patientId: 'HV123', level: 5, part2: 'Vui vẻ' })));
  Logger.log('test_: mã "=1+1" → ' + JSON.stringify(post({ sessionId: sid, patientId: '=1+1', level: 5, part2: 'Vui vẻ' })));
  Logger.log('test_: thiếu Mã phiên (kiểu app cũ) → ' + JSON.stringify(post({ patientId: '26012345', level: 5, part2: 'Vui vẻ' })));
  Logger.log('test_: level 11 → ' + JSON.stringify(post({ sessionId: sid, patientId: '26012345', level: 11, part2: 'Vui vẻ' })));
  Logger.log('test_: cảm xúc lạ → ' + JSON.stringify(post({ sessionId: sid, patientId: '26012345', level: 5, part2: '=IMPORTXML("x";"//a")' })));
  Logger.log('test_: GET → ' + doGet({ parameter: {} }).getContent());

  rowNo = findSessionRow_(sheet, sid);
  if (rowNo > 0) { sheet.deleteRow(rowNo); Logger.log('test_: đã xóa dòng thử số ' + rowNo); }
  Logger.log('test_: XONG');
}
