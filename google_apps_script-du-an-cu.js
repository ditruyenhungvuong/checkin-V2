/**
 * ************************************************************
 *  FILE NÀY CHỈ DÀNH CHO DỰ ÁN APPS SCRIPT CŨ (URL AKfycbzSx6…, Sheet cũ, tài khoản
 *  Google khác với bsngvanthong) – nơi app bản 9/2026 (ditruyenhungvuong.github.io/checkin/)
 *  vẫn gửi SĐT, không có Mã phiên. Bản này nhận được lượt của app cũ mà vẫn tắt doGet
 *  (đóng lỗ lộ dữ liệu) và chặn công thức.
 *  - Dự án cũ: làm BƯỚC 1–4 bên dưới (và BƯỚC 6 khi anh muốn tắt hẳn URL cũ).
 *    KHÔNG làm BƯỚC 5 (app mới đã có Sheet + URL riêng từ 30/10/2026).
 *  - Dự án MỚI (Sheet "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026", URL AKfycbzfN8…)
 *    dùng file google_apps_script.js (Mã số bệnh nhân), KHÔNG dán file này vào đó.
 *  Giữ nguyên bản 29/10/2026, không sửa thêm.
 * ************************************************************
 */
/**
 * ============================================================
 *  GOOGLE APPS SCRIPT – CHECK-IN CẢM XÚC MẸ BẦU (bản an toàn, 29/10/2026)
 *  (gốc: docs/style/apps-script-template.js của đội App Creator,
 *   kiểm dữ liệu theo apps/checkin-vao-ca/google_apps_script.js)
 * ============================================================
 *  Chức năng:
 *   1) doPost : nhận một lượt check-in từ web, ghi 1 dòng vào tab CheckIn:
 *               A Thời gian (giờ máy chủ, giờ Việt Nam) · B Số điện thoại
 *               C Phần 1: Mức cảm xúc · D Phần 2: Cảm xúc Capybara · E Mã phiên (ẩn)
 *               Cùng Mã phiên (và cùng SĐT) thì CẬP NHẬT dòng cũ, giữ nguyên giờ ở cột A
 *               → app gửi lại khi mạng chập chờn vẫn chỉ một dòng.
 *               App CŨ (bản đang chạy trên GitHub, không gửi Mã phiên) vẫn ghi được:
 *               mỗi lượt thêm một dòng, vẫn qua đủ các bước kiểm dữ liệu.
 *   2) doGet  : KHÔNG trả dữ liệu nữa. Mở URL chỉ thấy "public_read_disabled".
 *               Anh xem dữ liệu thẳng trên Google Sheet (anh là chủ file).
 *
 *  Vì sao phải thay bản cũ: bản cũ (a) cho BẤT KỲ AI có URL tải toàn bộ SĐT +
 *  cảm xúc của mọi mẹ bầu, (b) ghi thẳng chuỗi người lạ gửi vào Sheet, nên kẻ xấu
 *  chèn được công thức kiểu =IMPORTXML(...) để rút cả bảng khi anh mở file.
 *  URL cũ đã nằm công khai trên GitHub từ 9/2026.
 *
 *  ------------------------------------------------------------
 *  HƯỚNG DẪN CÀI ĐẶT (anh Thông tự làm, khoảng 10 phút, làm đúng thứ tự)
 *  ------------------------------------------------------------
 *  Làm theo đúng thứ tự: bước 3 (cập nhật bản triển khai CŨ) đóng lỗ lộ dữ liệu
 *  NGAY HÔM NAY mà app đang chạy vẫn ghi được. Bước 5–6 làm khi đưa bản app mới lên.
 *
 *  BƯỚC 1 – Chuẩn bị Sheet
 *    1.1 Mở Google Sheet đang nhận check-in của app.
 *    1.2 Tab đang có dữ liệu (thường tên "Trang tính1" hoặc "Sheet1"): nhấp đúp vào
 *        tên tab ở góc dưới, đổi thành  CheckIn  (viết liền, C và I hoa).
 *        Không đổi tên thì script tự tạo tab CheckIn mới, dữ liệu cũ vẫn nằm ở tab cũ.
 *    1.3 KIỂM TRA CÔNG THỨC BỊ CHÈN (bản cũ ghi thẳng chữ người lạ gửi vào cột A–D):
 *        - Bấm Ctrl+H (Tìm và thay thế). KHÔNG dùng Ctrl+F: ô bị chèn công thức chỉ
 *          hiện kết quả, không hiện dấu =, nên Ctrl+F không tìm ra.
 *        - Ô "Tìm": gõ  =   · "Tìm kiếm": Tất cả các trang tính
 *          · tick "Tìm kiếm trong cả công thức" (Also search within formulas) → bấm Tìm.
 *        - Xem mọi ô tìm thấy ở cột A, B, C, D. Ô có IMPORTXML, IMPORTDATA, IMPORTHTML,
 *          IMAGE, HYPERLINK, WEBSERVICE là dấu hiệu bị chèn: xóa ô đó (và báo đội).
 *
 *  BƯỚC 2 – Dán script
 *    2.1 Trên Sheet: menu Tiện ích mở rộng (Extensions) → Apps Script.
 *    2.2 Trong file Code.gs, xóa HẾT code cũ, dán TOÀN BỘ file này vào.
 *    2.3 Bấm biểu tượng đĩa mềm (Lưu) hoặc Ctrl+S.
 *    2.4 (Nên làm) Ô chọn hàm cạnh nút Chạy/Run chọn  test_  rồi bấm Chạy.
 *        Lần đầu Google hỏi quyền: Xem lại quyền → chọn tài khoản → Nâng cao
 *        (Advanced) → Đi tới … (không an toàn) → Cho phép. Đây là script của chính
 *        anh nên cảnh báo này là bình thường. Mở Nhật ký thực thi (Execution log):
 *        thấy các dòng "test_: ..." và cuối cùng "test_: XONG" là được (dòng thử tự xóa).
 *
 *  BƯỚC 3 – CẬP NHẬT LUÔN BẢN TRIỂN KHAI CŨ (làm ngay, đóng lỗ lộ dữ liệu)
 *    3.1 Nút Triển khai (Deploy) → Quản lý bản triển khai (Manage deployments).
 *    3.2 Chọn bản triển khai đang dùng (URL cũ, ID bắt đầu bằng AKfycbzSx6…)
 *        → biểu tượng bút chì (Edit) → Phiên bản (Version): Phiên bản mới (New version)
 *        → Triển khai (Deploy).
 *    3.3 Mở URL CŨ trên trình duyệt → phải thấy
 *            {"result":"error","error":"public_read_disabled"}
 *        Từ lúc này không ai tải được bảng qua URL cũ nữa. App đang chạy trên web
 *        (bản cũ) vẫn gửi check-in bình thường vì script nhận cả lượt không có Mã phiên.
 *
 *  BƯỚC 4 – Kiểm tra sau bước 3
 *    4.1 LẶP LẠI bước 1.3 (Ctrl+H tìm công thức) một lần nữa: trong vài phút từ lúc
 *        quét tới lúc xong bước 3, code cũ vẫn ghi thẳng chữ người lạ gửi. Từ giờ code
 *        mới đã chặn công thức, nên đây là lần quét cuối.
 *    4.2 Mở app đang chạy, check-in thử một lượt → tab CheckIn thêm 1 dòng, cột A là
 *        giờ Việt Nam, cột E (ẩn) để trống (lượt của app cũ).
 *        App cũ không kiểm số điện thoại kỹ: số gõ lệch chuẩn (thiếu số 0, thừa số,
 *        kèm tên…) vẫn được ghi, cột B chỉ giữ CHỮ SỐ (xem QUY TẮC SĐT APP CŨ bên dưới).
 *
 *  BƯỚC 5 – TẠO BẢN TRIỂN KHAI MỚI (URL mới) cho bản app mới
 *    URL cũ đã nằm công khai trên GitHub từ 9/2026; ai có nó vẫn GỬI rác vào được
 *    (dù không đọc được nữa). Vì vậy bản app mới nên dùng URL mới.
 *    5.1 Triển khai (Deploy) → Triển khai mới (New deployment).
 *    5.2 Bánh răng cạnh "Chọn loại" → Ứng dụng web (Web app).
 *        Mô tả: ví dụ "ban an toan 29-10-2026".
 *        Thực thi với tư cách (Execute as): Tôi (Me).
 *        Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone).
 *    5.3 Bấm Triển khai. Chép dòng  URL ứng dụng web  (dạng https://script.google.com/macros/s/.../exec).
 *    5.4 Mở file script.js của app, thay URL trong dòng
 *            const GOOGLE_SCRIPT_URL = '...';
 *        bằng URL mới vừa chép (giữ nguyên dấu nháy đơn và dấu chấm phẩy).
 *        (upload.sh và upload.bat sẽ KHÔNG cho đẩy nếu script.js còn URL cũ.)
 *    5.5 Mở URL MỚI trên trình duyệt → thấy "public_read_disabled" là đúng.
 *    5.6 Đưa bản app mới lên GitHub (./upload.sh trên Ubuntu hoặc upload.bat trên Surface),
 *        chờ vài phút, mở web check-in thử một lượt.
 *
 *    LƯU Ý giữa BƯỚC 5 và BƯỚC 6: lúc này có HAI bản triển khai cùng chạy (cũ và mới).
 *    Nếu sửa code Apps Script trong thời gian này thì phải cập nhật Phiên bản mới cho
 *    CẢ HAI (Quản lý bản triển khai → từng bản → bút chì → Phiên bản mới → Triển khai),
 *    không thì bản cũ vẫn chạy code cũ hơn.
 *
 *  BƯỚC 6 – Tắt URL cũ (CHỈ SAU khi bước 5.6 xong và web đã chạy bằng URL mới)
 *    6.1 Triển khai → Quản lý bản triển khai → chọn bản CŨ → Lưu trữ (Archive).
 *        Làm sớm hơn thì app trên web (còn URL cũ) sẽ gửi vào URL đã tắt và mất lượt.
 *
 *  LẦN SAU CHỈ SỬA CODE (không cần URL mới): dán code mới → Lưu → Triển khai →
 *    Quản lý bản triển khai → bút chì → Phiên bản: Phiên bản mới → Triển khai.
 *    (Nếu chưa làm BƯỚC 6 thì làm việc này cho CẢ HAI bản triển khai.)
 *
 *  QUY TẮC SĐT APP CŨ (chỉ lượt KHÔNG có Mã phiên, tức app bản 9/2026 còn chạy):
 *    - Đúng chuẩn Việt Nam (như app mới) → ghi dạng chuẩn, ví dụ 0912345678.
 *    - Sai chuẩn nhưng chuỗi ≤ 30 ký tự và có ≥ 9 chữ số → VẪN GHI để không mất lượt;
 *      cột B chỉ giữ chữ số: bỏ hết dấu cách, chấm, gạch, chữ, dấu +.
 *        • Bắt đầu bằng "+84" hoặc "0084" mà phần sau đúng chuẩn → đổi về 0xxxxxxxxx.
 *        • Bắt đầu bằng "+" (mã nước khác) → thay "+" bằng "00" (ví dụ +1 202… → 001202…).
 *      Ví dụ: "912345678" → 912345678 · "0912345678 chi Lan" → 0912345678 ·
 *             "0084912345678" → 0912345678 · "01234567890" → 01234567890.
 *      Số không bắt đầu bằng 0, hoặc không đủ 10–11 số, là số gõ lệch: anh lọc cột B để xem.
 *    - Ít hơn 9 chữ số (ví dụ "=1+1+1+1+1") → từ chối.
 *    Lượt CÓ Mã phiên (app mới) vẫn phải đúng chuẩn Việt Nam, vì app mới đã báo lỗi ngay trên ô.
 *
 *  Phía web gửi bằng:
 *    fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
 *    payload = { sessionId, ageMs, phone, level, part1, part2 }
 *    ageMs = số mili-giây từ lúc chị bấm tới lúc gửi (đo trên cùng đồng hồ điện thoại,
 *    nên đồng hồ máy chị chạy sai cũng không ảnh hưởng). Máy chủ ghi giờ = giờ nhận − ageMs.
 *    (app cũ gửi { created_at, phone, part1, part2 }: vẫn nhận, giờ lấy ở máy chủ)
 *  (Content-Type text/plain để tránh preflight CORS.)
 * ============================================================
 */

/* ===== Cấu hình ===== */

// Tên tab ghi check-in. Đổi ở đây nếu anh đặt tên khác.
var SHEET_NAME = 'CheckIn';

// Cột trong tab. Khóa (key) trùng tên trường trong payload.
// 4 cột đầu giữ đúng như bản cũ để dữ liệu cũ và mới nằm chung bảng; cột E là cột kỹ thuật, tự ẩn.
var COLUMNS = [
  { key: 'created_at', header: 'Thời gian' },
  { key: 'phone',      header: 'Số điện thoại' },
  { key: 'part1',      header: 'Phần 1: Mức cảm xúc' },
  { key: 'part2',      header: 'Phần 2: Cảm xúc Capybara' },
  { key: 'sessionId',  header: 'Mã phiên' }
];
var SESSION_KEY = 'sessionId';
var SESSION_COL = 5;              // cột E, ẩn

// 10 nhãn mức, PHẢI trùng emotionLevels[n].text trong script.js. Index 0 bỏ trống.
// Server tự ghép "mức - nhãn" từ số mức, KHÔNG dùng chuỗi client gửi.
var LEVEL_TEXTS = ['', 'Tuyệt vọng', 'Rất tồi tệ', 'Tồi tệ', 'Kém', 'Bình thường (Ổn)',
                   'Tương đối tốt', 'Tốt', 'Rất tốt', 'Tuyệt vời', 'Rất tuyệt vời'];

// 6 nhãn thẻ Capybara, PHẢI trùng EMOTIONS trong script.js. Chỉ nhận đúng một trong 6 chuỗi này.
var EMOTION_LABELS = ['Vui vẻ', 'Buồn', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu'];

var MAX_BODY_LENGTH  = 2000;      // payload thật chỉ ~150 ký tự; dài hơn là rác
var PHONE_MAX_LENGTH = 20;        // trước khi chuẩn hóa (app mới)
var LEGACY_PHONE_MAX_LENGTH = 30; // app cũ không giới hạn ô nhập; quá 30 ký tự là rác
var LEGACY_PHONE_MIN_DIGITS = 9;  // app cũ đòi ≥ 9 ký tự; ít hơn 9 chữ số thì không phải SĐT
// Mã phiên: 8–40 ký tự chữ/số/gạch nối, KHÔNG bắt đầu bằng gạch (tránh bị safeText_ thêm dấu nháy)
var SESSION_RE       = /^[0-9A-Za-z][0-9A-Za-z-]{7,39}$/;

// Độ trễ từ lúc chị bấm tới lúc gửi (ageMs, mili-giây): lượt gửi lại sau khi mất mạng
// vẫn ghi đúng giờ check-in. Chỉ nhận số nguyên 0 … 8 ngày (hàng chờ trên máy giữ 7 ngày).
var AGE_MAX_MS = 8 * 24 * 60 * 60 * 1000;

// Múi giờ ghi cột Thời gian (máy chủ Google không chạy giờ Việt Nam)
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

/* ===== Tiện ích chung ===== */

/**
 * Chuẩn hóa SĐT Việt Nam: bỏ khoảng trắng, chấm, gạch, ngoặc; +84 / 84 đầu → 0.
 * Hợp lệ: di động 10 số 03/05/07/08/09, hoặc cố định 11 số 02x. Sai → ''.
 * VIẾT GIỐNG HỆT normalizePhone() trong script.js.
 */
function normalizePhone_(raw) {
  var s = String(raw == null ? '' : raw).trim().replace(/[\s.\-()]/g, '');
  if (/^\+84/.test(s)) s = '0' + s.slice(3);
  else if (/^84\d{9,10}$/.test(s)) s = '0' + s.slice(2);
  return /^(0[35789]\d{8}|02\d{9})$/.test(s) ? s : '';
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

/** Trả JSON. Không còn JSONP: web chỉ gửi POST, không đọc gì qua GET. */
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

/**
 * Tab trống: tạo tiêu đề tô hồng, đóng băng hàng 1, ẩn cột E.
 * Tab đã có dữ liệu từ bản cũ (4 cột): bổ sung tiêu đề E "Mã phiên" và ẩn, không đụng A–D.
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
  var eHeader = COLUMNS[SESSION_COL - 1].header;
  if (sheet.getRange(1, SESSION_COL).getValue() !== eHeader) {
    sheet.getRange(1, SESSION_COL).setValue(eHeader)
         .setFontWeight('bold').setBackground('#F8BBD0').setFontColor('#880E4F');
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
 * SĐT của lượt app CŨ (không Mã phiên) khi không đúng chuẩn Việt Nam: vẫn nhận để không mất lượt.
 * Trả chuỗi CHỈ GỒM CHỮ SỐ, hoặc '' nếu là rác. Quy tắc ghi ở đầu file (QUY TẮC SĐT APP CŨ).
 */
function legacyPhone_(raw) {
  var t = String(raw).trim();
  if (t.length > LEGACY_PHONE_MAX_LENGTH) return '';
  var digits = t.replace(/\D/g, '');
  if (digits.length < LEGACY_PHONE_MIN_DIGITS) return '';
  // 0084… → thử chuẩn Việt Nam
  if (/^0084/.test(digits)) {
    var vn = normalizePhone_('0' + digits.slice(4));
    if (vn) return vn;
  }
  // "+" đầu (mã nước) → "00" để vẫn chỉ là chữ số mà không mất thông tin
  if (t.charAt(0) === '+') digits = '00' + digits;
  return digits;
}

/**
 * Kiểm payload. Trả mã lỗi ngắn
 *   session_invalid | phone_invalid | level_invalid | emotion_required | emotion_invalid
 * hoặc '' nếu hợp lệ, kèm out = { created_at, phone, part1, part2, sessionId } đã làm sạch.
 * - Thiếu Mã phiên = lượt của app cũ: vẫn kiểm đủ, out.sessionId = '' (doPost luôn thêm dòng mới).
 * - Có Mã phiên thì phải đúng SESSION_RE.
 * - SĐT: app mới phải đúng chuẩn Việt Nam; app cũ sai chuẩn thì qua legacyPhone_ (chỉ chữ số).
 * - created_at client gửi (app cũ) bị bỏ: giờ = giờ máy chủ − ageMs hợp lệ, hoặc giờ máy chủ.
 * Mọi ô ghi vào Sheet đều đến từ whitelist hoặc regex, nên không chuỗi nào bắt đầu
 * bằng = + - @ lọt được; safeText_ ở doPost là lớp phòng thủ thứ hai.
 */
function validateCheckin_(data, out) {
  var sid = '';
  if (present_(data[SESSION_KEY])) {
    if (typeof data[SESSION_KEY] !== 'string') return 'session_invalid';
    sid = data[SESSION_KEY].trim();
    if (!SESSION_RE.test(sid)) return 'session_invalid';
  }

  if (typeof data.phone !== 'string' && typeof data.phone !== 'number') return 'phone_invalid';
  var rawPhone = String(data.phone);
  var phone;
  if (sid) {
    // App mới: chuẩn Việt Nam chặt
    if (rawPhone.length > PHONE_MAX_LENGTH) return 'phone_invalid';
    phone = normalizePhone_(rawPhone);
  } else {
    // App cũ: chuẩn thì ghi chuẩn, lệch chuẩn mà đủ chữ số thì ghi chữ số (không mất lượt)
    phone = (rawPhone.length <= PHONE_MAX_LENGTH && normalizePhone_(rawPhone)) || legacyPhone_(rawPhone);
  }
  if (!phone) return 'phone_invalid';

  // Mức: bản mới gửi level; app cũ chỉ gửi part1 "7 - Tốt" → đọc số đầu
  var lv;
  if (present_(data.level)) {
    lv = parseLevel_(data.level);
  } else {
    var m = /^(\d{1,2}) - /.exec(typeof data.part1 === 'string' ? data.part1 : '');
    lv = m ? parseLevel_(m[1]) : 0;
  }
  if (!lv) return 'level_invalid';

  if (!present_(data.part2)) return 'emotion_required';
  var emo = typeof data.part2 === 'string' ? data.part2.trim() : '';
  if (EMOTION_LABELS.indexOf(emo) < 0) return 'emotion_invalid';

  out.created_at = createdAt_(data.ageMs);
  out.phone = phone;
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

    var clean = {};
    var invalid = validateCheckin_(data, clean);
    if (invalid) return json_({ result: 'error', error: invalid });

    lock.waitLock(5000);   // tránh hai lượt ghi đè nhau
    locked = true;

    var sheet = sheet_();
    ensureHeader_(sheet);
    var row = COLUMNS.map(function (c) { return safeText_(clean[c.key]); });

    // Không có Mã phiên (app cũ) → luôn thêm dòng mới, không tìm để cập nhật
    var existing = clean.sessionId ? findSessionRow_(sheet, clean.sessionId) : -1;
    if (existing > 0) {
      // Cùng Mã phiên mà khác SĐT: không cho ghi đè dòng của người khác
      var oldPhone = String(sheet.getRange(existing, 2).getValue()).replace(/^'/, '');
      if (oldPhone !== clean.phone) return json_({ result: 'error', error: 'session_conflict' });
      // Cập nhật B–E, GIỮ cột A (giờ check-in lần đầu)
      var upd = sheet.getRange(existing, 2, 1, COLUMNS.length - 1);
      upd.setNumberFormat('@');
      upd.setValues([row.slice(1)]);
      return json_({ result: 'success', action: 'updated' });
    }
    // Văn bản thuần cho dòng này: giữ số 0 đầu của SĐT, giờ không bị đổi thành ngày kiểu Mỹ.
    // Chỉ đặt cho dòng đang ghi, không đụng dòng cũ.
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

/** ĐỌC DỮ LIỆU QUA URL: ĐÃ TẮT. Không có cách nào tải SĐT/cảm xúc qua đường link. */
function doGet() {
  return json_({ result: 'error', error: 'public_read_disabled' });
}

/* ===== Chạy thử trong editor ===== */

/**
 * Chọn hàm test_ trong editor rồi bấm Chạy. Xem Nhật ký thực thi.
 * Ghi 1 dòng thử, ghi lại cùng Mã phiên (phải "updated"), thử vài payload sai, rồi xóa dòng thử.
 */
function test_() {
  var sid = 'test-' + new Date().getTime();
  var ok = { sessionId: sid, phone: '0912 345 678', level: 5, part1: '5 - Bình thường (Ổn)', part2: 'Vui vẻ' };
  var post = function (o) { return JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).getContent()); };

  Logger.log('test_: POST lần 1 → ' + JSON.stringify(post(ok)));
  var r2 = post(ok);
  Logger.log('test_: POST lần 2 cùng Mã phiên → ' + JSON.stringify(r2) + (r2.action === 'updated' ? ' (đúng: không thêm dòng)' : ' (SAI)'));
  var legacy = post({ created_at: '08:00:00 01/10/2026', phone: '0912345678', part1: '5 - Bình thường (Ổn)', part2: 'Vui vẻ' });
  Logger.log('test_: lượt kiểu app cũ (không Mã phiên) → ' + JSON.stringify(legacy) + (legacy.action === 'inserted' ? ' (đúng)' : ' (SAI)'));
  Logger.log('test_: phone "=1+1" → ' + JSON.stringify(post({ sessionId: sid, phone: '=1+1', level: 5, part2: 'Vui vẻ' })));
  Logger.log('test_: level 11 → ' + JSON.stringify(post({ sessionId: sid, phone: '0912345678', level: 11, part2: 'Vui vẻ' })));
  Logger.log('test_: cảm xúc lạ → ' + JSON.stringify(post({ sessionId: sid, phone: '0912345678', level: 5, part2: '=IMPORTXML("x";"//a")' })));
  Logger.log('test_: GET → ' + doGet({ parameter: {} }).getContent());

  var sheet = sheet_();
  var rowNo = findSessionRow_(sheet, sid);
  if (rowNo > 0) { sheet.deleteRow(rowNo); Logger.log('test_: đã xóa dòng thử số ' + rowNo); }
  // Dòng thử kiểu app cũ (cột E trống) là dòng cuối nếu ghi thành công
  if (legacy.result === 'success') {
    var last = sheet.getLastRow();
    var r = sheet.getRange(last, 1, 1, COLUMNS.length).getValues()[0];
    if (String(r[1]) === '0912345678' && String(r[4]) === '' && String(r[3]) === 'Vui vẻ') {
      sheet.deleteRow(last); Logger.log('test_: đã xóa dòng thử kiểu app cũ số ' + last);
    }
  }
  Logger.log('test_: XONG');
}
