/**
 * ============================================================
 *  GOOGLE APPS SCRIPT – CHECK-IN CẢM XÚC MẸ BẦU (bản 04/11/2026: 9 cảm xúc + bảng cho bác sĩ + Hướng xử trí)
 *  (gốc: docs/style/apps-script-template.js của đội App Creator,
 *   kiểm dữ liệu theo apps/checkin-vao-ca/google_apps_script.js)
 * ============================================================
 *  File này dán vào DỰ ÁN MỚI: Sheet "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026"
 *  (tài khoản bsngvanthong), bản triển khai có URL bắt đầu bằng AKfycbzfN8…
 *  Dự án CŨ (URL AKfycbzSx6…, đã lưu trữ 02/11/2026) KHÔNG dùng file này.
 *
 *  Chức năng:
 *   1) doPost : nhận một lượt check-in từ web, ghi 1 dòng vào tab CheckIn:
 *               A Thời gian (giờ Việt Nam) · B Mã số bệnh nhân
 *               C Phần 1: Mức cảm xúc · D Phần 2: Cảm xúc Capybara · E Mã phiên (ẩn)
 *               Cùng Mã phiên (và cùng Mã số bệnh nhân) thì CẬP NHẬT dòng cũ, giữ nguyên
 *               giờ ở cột A → app gửi lại khi mạng chập chờn vẫn chỉ một dòng.
 *   2) doGet  : KHÔNG trả dữ liệu. Mở URL chỉ thấy "public_read_disabled".
 *   3) Menu "Check-in" → "Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)"
 *      (anh chạy MỘT lần, chạy lại cũng được):
 *               - tab CheckIn: tô cả dòng A–D theo mức ở cột C (chỉ theo mức, cảm xúc không đổi màu):
 *                   ĐỎ nhạt mức 1–3 · VÀNG nhạt mức 4–5 · XANH lá nhạt mức 6–10
 *               - tab "Tổng hợp": mỗi mã số bệnh nhân một dòng (lượt gần nhất, mức, cảm xúc,
 *                 số lượt, số lượt ĐỎ trong 14 ngày), mới nhất trên cùng, tự cập nhật bằng công thức
 *               - tab "Tra cứu": gõ mã số vào ô B2 → hiện mọi lượt của mã đó, mới nhất trên cùng
 *               - cột "Gợi ý mở đầu" (Tổng hợp cột G, Tra cứu cột E): một câu gợi ý theo màu của mức
 *                 và nhóm thẻ capybara (04/11/2026)
 *               - tab "Hướng xử trí" (ngay sau Tra cứu): bảng 3 màu + BÁO ĐỘNG, 9 thẻ chia 3 nhánh, câu nên
 *                 nói/tránh. Bản nháp dùng thử 0.3 · 04/11/2026, chưa ban hành, chưa kiểm định.
 *               - khóa (bảo vệ) cả bốn tab, chỉ chủ file sửa được; riêng ô B2 của tab Tra cứu để mở
 *             doPost KHÔNG chạy phần này (mỗi lượt check-in chỉ ghi một dòng).
 *
 *  Đổi ngày 04/11/2026 (anh Thông yêu cầu: bác sĩ thấy hướng xử trí ngay trên Sheet):
 *   - Thêm tab "Hướng xử trí" và cột "Gợi ý mở đầu" (mục 3 ở trên); đổi tên mục menu.
 *   - CHỈ đổi phần menu. doPost, kiểm dữ liệu, cột tab CheckIn và web giữ nguyên.
 *   - Cách cài lần này: dán code → Lưu → BƯỚC 3 (Phiên bản mới, giữ URL) → BƯỚC 4 (chạy lại menu tên mới).
 *  Đổi ngày 02/11/2026 (anh Thông duyệt):
 *   - 9 cảm xúc theo bộ ảnh mới của anh: Vui vẻ, Đau khổ, Lo lắng, Tức giận, Hoảng hốt, Khó chịu,
 *     Mệt mỏi, Bình an, Cô đơn. Chuỗi khác vẫn bị từ chối.
 *     Web bản cũ (6 cảm xúc, có "Buồn") gửi lên script này vẫn được nhận: "Buồn" ghi nguyên chữ.
 *   - Thêm menu tô màu + tab Tổng hợp + tab Tra cứu cho bác sĩ (mục 3 ở trên).
 *   - Sửa lỗi "đầy 1000 hàng": tab CheckIn hết hàng trống thì doPost tự thêm 500 hàng rồi mới ghi
 *     (trước đây từ lượt thứ 1000 trở đi bị báo bận và mất). Anh duyệt 02/11/2026.
 *  Đổi ngày 01/11/2026: ô "Số điện thoại" thành "Mã số bệnh nhân" (trường patientId, 3–20 chữ số,
 *   giữ số 0 đầu). Các dòng ghi 30–31/10 vẫn là SĐT ở cột B; anh nhìn giờ ở cột A để phân biệt.
 *   Tab Tổng hợp/Tra cứu coi các SĐT đó như một mã số (không báo lỗi).
 *
 *  ------------------------------------------------------------
 *  THỨ TỰ TRIỂN KHAI LẦN NÀY (Apps Script TRƯỚC, web SAU)
 *  ------------------------------------------------------------
 *   Web mới gửi được 3 cảm xúc mới; script cũ sẽ từ chối 3 cảm xúc đó (emotion_invalid, lượt bị bỏ).
 *   Script mới vẫn nhận web cũ. Nên: làm BƯỚC 1–4 dưới đây xong, kiểm tra được, RỒI mới đưa web
 *   mới lên GitHub (BƯỚC 6). Web mới còn chờ ảnh 3 cảm xúc mới nên chưa đẩy.
 *
 *  ------------------------------------------------------------
 *  HƯỚNG DẪN CÀI ĐẶT (anh Thông tự làm, khoảng 10 phút, làm đúng thứ tự)
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
 *        "test_: ..." (có dòng "Cô đơn" → success, "Buồn" → success) và cuối cùng "test_: XONG"
 *        là được (dòng thử tự xóa).
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
 *  BƯỚC 4 – Chạy menu cài bảng bác sĩ (MỘT lần)
 *    4.1 Quay lại tab Google Sheet, bấm tải lại trang (F5). Trên thanh menu hiện thêm "Check-in"
 *        (đợi vài giây sau khi tải).
 *    4.2 Check-in → Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí). Lần đầu Google hỏi quyền:
 *        cho phép như 2.4, rồi bấm lại menu một lần nữa. (Menu cũ tên "Cài tô màu + Tổng hợp + Tra cứu":
 *        tải lại trang F5 là thấy tên mới.)
 *    4.3 Thấy hộp "Đã cài xong" là được. Kiểm tra nhanh:
 *        - tab CheckIn: các dòng có màu đỏ nhạt / vàng nhạt / xanh lá nhạt theo mức;
 *        - tab "Tổng hợp": mỗi mã số một dòng, mới nhất trên cùng;
 *        - tab "Tra cứu": gõ một mã số đang có vào ô B2, Enter → hiện các lượt của mã đó;
 *        - cột "Gợi ý mở đầu" (Tổng hợp cột G, Tra cứu cột E) có chữ, bắt đầu bằng ĐỎ / VÀNG / XANH
 *          đúng màu của dòng; dòng không có mức hợp lệ thì để trống;
 *        - tab "Hướng xử trí" đứng ngay sau tab Tra cứu, ô A2 ghi "Bản nháp dùng thử…".
 *        Menu nới tab CheckIn và Tổng hợp lên 20 000 hàng để vùng tô màu phủ đủ. Khi tab CheckIn
 *        vượt 20 000 lượt (script tự thêm hàng), chạy lại menu để các dòng mới cũng có màu.
 *        Công thức tự ghi theo ngôn ngữ của file: file tiếng Việt dùng dấu chấm phẩy ";" (ví dụ
 *        =LET(x;1;y;2;x+y)), file tiếng Anh dùng dấu phẩy. Menu tự thử bằng một tab tạm (tạo rồi xóa ngay).
 *        Nếu ô Tổng hợp!A2 hay Tra cứu!A6 hiện #ERROR! (bản 02/11 trước 21 giờ ghi dấu phẩy), dán bản
 *        script này rồi chạy lại menu: menu ghi lại hai ô đó và thay 3 quy tắc màu cũ (không nhân đôi).
 *    4.4 Chạy lại menu lúc nào cũng được (ví dụ lỡ xóa tab Tổng hợp): menu dựng lại tab Tổng hợp,
 *        Tra cứu, Hướng xử trí và quy tắc tô màu của chúng; KHÔNG đụng dữ liệu ở tab CheckIn, không xóa
 *        quy tắc tô màu anh tự đặt. Nếu đã có tab tên "Tổng hợp", "Tra cứu" hay "Hướng xử trí" do anh tự
 *        tạo (không phải menu tạo), menu KHÔNG ghi đè: anh đổi tên tab đó rồi chạy lại.
 *        Muốn sửa chữ trong tab Hướng xử trí: sửa GUIDE_ROWS / OPENER_TEXTS trong code rồi chạy lại menu
 *        (tab bị khóa, sửa tay sẽ mất khi chạy lại menu). Ở GUIDE_ROWS chỉ sửa chữ trong ô, KHÔNG thêm/bớt
 *        hàng (ô gộp và màu gắn theo số hàng).
 *
 *  BƯỚC 5 – Chia sẻ Sheet cho bác sĩ (chọn MỘT trong hai cách)
 *    Giữ nguyên "Quyền truy cập chung: Hạn chế" (Restricted) – KHÔNG chọn "Bất kỳ ai có đường liên kết".
 *    Nút Chia sẻ (Share) góc phải trên → nhập Gmail từng bác sĩ → chọn quyền → có thể bỏ chọn
 *    "Thông báo cho mọi người" (Notify people) nếu không muốn Google gửi thư → Gửi / Chia sẻ.
 *
 *    Cách 1 (nên dùng) – quyền "Người xem" (Viewer):
 *      - Bác sĩ xem tab "Tổng hợp" (mỗi mã số một dòng, có màu, có Gợi ý mở đầu), tab "Hướng xử trí"
 *        và tab CheckIn.
 *      - Người xem KHÔNG gõ được vào ô, nên ô tra cứu B2 không dùng được. Để tìm một mã:
 *        Ctrl+F, hoặc Dữ liệu (Data) → Chế độ xem bộ lọc (Filter views) → Tạo chế độ xem bộ lọc
 *        tạm thời (Create temporary filter view) rồi lọc cột B – không ảnh hưởng người khác.
 *      - Tải về máy: Tệp (File) → Tải xuống (Download) → Microsoft Excel (.xlsx). Màu giữ nguyên;
 *        file Excel là bản chụp lúc tải, không tự cập nhật.
 *    Cách 2 – quyền "Người chỉnh sửa" (Editor), để gõ được ô tra cứu B2:
 *      - Tab CheckIn, Tổng hợp, Hướng xử trí và tab Tra cứu (trừ ô B2) đã khóa, chỉ anh sửa được.
 *      - Trong hộp Chia sẻ bấm bánh răng (Cài đặt) → BỎ chọn "Người chỉnh sửa có thể thay đổi quyền
 *        và chia sẻ" (Editors can change permissions and share).
 *      - Lưu ý 1: nhiều bác sĩ dùng chung MỘT ô B2; ai gõ sau thì mọi người cùng thấy kết quả của
 *        mã đó. Muốn tra riêng thì dùng cách 1 (chế độ xem bộ lọc tạm thời).
 *      - Lưu ý 2: Người chỉnh sửa của Sheet cũng mở được Tiện ích mở rộng → Apps Script (xem và sửa
 *        code này). Chỉ cấp cách 2 cho người anh thật sự tin; nếu ngại thì dùng cách 1.
 *
 *  BƯỚC 6 – Đưa web mới lên (chỉ SAU khi xong BƯỚC 3, và khi đã có ảnh 3 cảm xúc mới)
 *    6.1 Đưa app lên GitHub (./upload.sh trên Ubuntu hoặc upload.bat trên Surface).
 *    6.2 Chờ vài phút, mở web, check-in thử một lượt chọn bé "Cô đơn" → tab CheckIn thêm
 *        1 dòng, cột D đúng "Cô đơn", dòng có màu theo mức. Xong thì xóa dòng thử đó.
 *
 *  LẦN SAU CHỈ SỬA CODE: dán code mới → Lưu → làm lại BƯỚC 3 (Phiên bản mới, giữ URL).
 *    Chỉ chạy lại menu (BƯỚC 4) khi bản sửa có đổi phần tô màu / Tổng hợp / Tra cứu / Hướng xử trí.
 *
 *  KHI CẦN URL MỚI (ví dụ URL bị lộ cho người lạ gửi rác): Triển khai → Triển khai mới
 *    → bánh răng → Ứng dụng web; Thực thi với tư cách: Tôi; Ai có quyền truy cập: Bất kỳ ai
 *    → Triển khai → chép URL, dán vào dòng  const GOOGLE_SCRIPT_URL = '...';  trong script.js,
 *    đưa web lên, rồi mới Lưu trữ (Archive) bản triển khai cũ.
 *    (Bản triển khai "Thực thi với tư cách: Tôi" nên vẫn ghi được vào tab CheckIn đã khóa.)
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

// 9 nhãn thẻ Capybara, PHẢI trùng EMOTIONS trong script.js (02/11/2026 anh chốt theo bộ ảnh mới).
var EMOTION_LABELS = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu',
                      'Mệt mỏi', 'Bình an', 'Cô đơn'];
// Nhãn cũ VẪN NHẬN để không mất lượt: web bản 01/11 đang chạy (và hàng chờ trên máy chị) còn gửi "Buồn".
// Ghi NGUYÊN chữ "Buồn" vào Sheet, không tự đổi thành "Đau khổ". Bỏ khi chắc không còn máy nào gửi.
var LEGACY_EMOTION_LABELS = ['Buồn'];

var MAX_BODY_LENGTH   = 2000;     // payload thật chỉ ~150 ký tự; dài hơn là rác
var ID_RAW_MAX_LENGTH = 40;       // trước khi bỏ khoảng trắng/chấm/gạch (ô nhập trên web tối đa 30)
// Mã phiên: 8–40 ký tự chữ/số/gạch nối, KHÔNG bắt đầu bằng gạch (tránh bị safeText_ thêm dấu nháy)
var SESSION_RE        = /^[0-9A-Za-z][0-9A-Za-z-]{7,39}$/;

// Độ trễ từ lúc chị bấm tới lúc gửi (ageMs, mili-giây): lượt gửi lại sau khi mất mạng
// vẫn ghi đúng giờ check-in. Chỉ nhận số nguyên 0 … 8 ngày (hàng chờ trên máy giữ 7 ngày).
var AGE_MAX_MS = 8 * 24 * 60 * 60 * 1000;

// Tab CheckIn hết hàng trống thì doPost thêm từng lần ROWS_GROW hàng.
// Menu cài đặt nới tab CheckIn / Tổng hợp lên ít nhất MIN_ROWS hàng rồi mới đặt vùng tô màu
// (quy tắc tô màu phủ tới hàng cuối lúc chạy menu; quá MIN_ROWS lượt thì chạy lại menu).
var ROWS_GROW = 500;
var MIN_ROWS  = 20000;

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
  if (EMOTION_LABELS.indexOf(emo) < 0 && LEGACY_EMOTION_LABELS.indexOf(emo) < 0) return 'emotion_invalid';

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
    // Tab hết hàng trống (Google tạo tab 1000 hàng) thì thêm hàng trước khi ghi: getRange ngoài số hàng
    // sẽ báo lỗi và lượt bị mất (02/11/2026, anh duyệt). Không dùng appendRow vì appendRow ghi
    // trước rồi mới đặt được định dạng @ → mất số 0 đầu của mã số.
    var next = sheet.getLastRow() + 1;
    if (next > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), ROWS_GROW);
    // Văn bản thuần cho dòng này: giữ số 0 đầu của Mã số bệnh nhân, giờ không bị đổi thành
    // ngày kiểu Mỹ. Chỉ đặt cho dòng đang ghi, không đụng dòng cũ.
    var range = sheet.getRange(next, 1, 1, COLUMNS.length);
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

/* ===== Bảng cho bác sĩ: tô màu + Tổng hợp + Tra cứu + Hướng xử trí =====
 * Anh chạy MỘT lần từ menu "Check-in" (xem BƯỚC 4 ở đầu file). KHÔNG chạy trong doPost.
 * Mọi công thức dưới đây là chuỗi CỐ ĐỊNH trong code (chỉ ghép tên tab SHEET_NAME), KHÔNG ghép
 * bất kỳ chuỗi nào người dùng gửi lên. Dữ liệu trong tab CheckIn đều đã qua whitelist ở doPost.
 * Không thêm cột vào tab CheckIn (cột "Mức cảnh báo" để ở tab Tra cứu): giữ nguyên cột A–E
 * mà doPost, ensureHeader_ và findSessionRow_ đang dùng.
 */

var SUMMARY_SHEET = 'Tổng hợp';
var LOOKUP_SHEET  = 'Tra cứu';
var LOOKUP_INPUT  = 'B2';                    // ô gõ mã số ở tab Tra cứu (ô duy nhất không khóa)
var LOOKUP_FIRST_ROW = 6;                    // hàng đầu kết quả tra cứu (hàng 5 là tiêu đề)
var TAB_META_KEY  = 'checkin_me_bau_tab';    // dấu ẩn đánh dấu tab do menu tạo → được phép ghi đè
var PROTECT_DESC  = 'Check-in Mẹ Bầu: chỉ chủ file sửa (menu Check-in tạo)';
var GUIDE_SHEET   = 'Hướng xử trí';             // tab tĩnh, đứng ngay sau tab Tra cứu (04/11/2026)
var MENU_NAME     = 'Check-in';
var MENU_ITEM     = 'Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)';

// Màu nhạt dễ đọc (bảng màu nhạt của Google Sheets), chữ giữ màu mặc định
var ALERT_COLORS = { red: '#F4CCCC', yellow: '#FFF2CC', green: '#D9EAD3' };
// Quy tắc anh chọn 02/11/2026: CHỈ theo mức. ĐỎ 1–3 · VÀNG 4–5 · XANH 6–10
var ALERT_BANDS = [
  { from: 1, to: 3,  label: 'ĐỎ',   color: ALERT_COLORS.red },
  { from: 4, to: 5,  label: 'VÀNG', color: ALERT_COLORS.yellow },
  { from: 6, to: 10, label: 'XANH', color: ALERT_COLORS.green }
];
var INPUT_BG = '#FFF59D';                    // nền vàng nhạt cho ô gõ mã số
var ALARM_BG = '#EA9999';                    // nền hàng BÁO ĐỘNG ở tab Hướng xử trí (đậm hơn đỏ nhạt)

/** Thêm menu "Check-in" mỗi khi mở Sheet (trigger đơn giản của Google, không cần cài). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu(MENU_NAME)
    .addItem(MENU_ITEM, 'caiDatBangBacSi')
    .addToUi();
}

/**
 * Công thức lấy số mức ở đầu ô ("7 - Tốt" → 7, "10 - Rất tuyệt vời" → 10; ô trống, dòng lạ → 0).
 * Chỉ dùng hàm Excel cũng có (IFERROR, VALUE, LEFT, FIND) để tải .xlsx màu vẫn giữ.
 */
function levelNumF_(cell) {
  return 'IFERROR(VALUE(LEFT(' + cell + '&" ",FIND(" ",' + cell + '&" ")-1)),0)';
}

/** Ba công thức tô màu (đỏ, vàng, xanh) theo ô mức, ví dụ "$C2". */
function alertFormulas_(levelCell) {
  var n = levelNumF_(levelCell);
  return ALERT_BANDS.map(function (b) { return '=AND(' + n + '>=' + b.from + ',' + n + '<=' + b.to + ')'; });
}

/* ===== Cú pháp công thức theo ngôn ngữ (locale) của file Sheet =====
 * Google Sheets nhận công thức (setFormula VÀ quy tắc tô màu) theo locale của file:
 *   - file tiếng Anh (en_US…): ngăn tham số ",", trong mảng {…}: ngăn cột ",", ngăn hàng ";", số thập phân "."
 *   - file tiếng Việt (vi_VN) và nhiều nước khác: ngăn tham số ";", trong {…}: ngăn cột "\\", ngăn hàng ";",
 *     số thập phân ",". Ghi bản dấu phẩy vào file tiếng Việt thì ô báo #ERROR! (đã gặp 02/11/2026).
 * Code viết công thức gốc kiểu tiếng Anh; fx_ đổi sang cú pháp của file trước khi ghi.
 */
var FORMULA_SEP = ',';   // menu đặt lại theo kết quả thử (detectFormulaSep_) mỗi lần chạy

/**
 * Đổi công thức kiểu tiếng Anh sang cú pháp có ngăn tham số sep (',' giữ nguyên; ';' đổi).
 * Không đụng chữ bên trong "chuỗi" (kể cả "" thoát) và 'tên tab'. Bên ngoài chuỗi:
 *   "," ở mức tham số (trong ngoặc tròn) → ";"   ·   "," ngay trong {…} → "\\"   ·   ";" giữ (ngăn hàng)
 *   "." giữa hai chữ số (số thập phân) → ","
 */
function fx_(formula, sep) {
  var f = String(formula);
  if (sep !== ';') return f;
  var out = '', stack = [], i = 0, ch, q;
  while (i < f.length) {
    ch = f.charAt(i);
    if (ch === '"' || ch === "'") {          // chuỗi "…" hoặc 'tên tab': chép nguyên, "" / '' là ký tự thoát
      q = ch; out += ch; i++;
      while (i < f.length) {
        out += f.charAt(i);
        if (f.charAt(i) === q) {
          if (f.charAt(i + 1) === q) { out += q; i += 2; continue; }
          i++; break;
        }
        i++;
      }
      continue;
    }
    if (ch === '(' || ch === '{') stack.push(ch);
    else if (ch === ')' || ch === '}') stack.pop();
    if (ch === ',') out += (stack.length && stack[stack.length - 1] === '{') ? '\\' : ';';
    else if (ch === '.' && /[0-9]/.test(f.charAt(i - 1)) && /[0-9]/.test(f.charAt(i + 1))) out += ',';
    else out += ch;
    i++;
  }
  return out;
}

/**
 * Thử cú pháp của file: tab tạm, ghi =SUM(1,2). File dấu phẩy ra 3; file dấu chấm phẩy hiểu "1,2" là
 * số 1,2 (hoặc báo lỗi) nên không ra 3. Luôn xóa tab tạm. Thử không được thì đoán theo locale.
 */
function detectFormulaSep_(ss) {
  var tmp = null;
  try {
    tmp = ss.insertSheet('__thu_cu_phap_' + new Date().getTime());
    tmp.getRange('A1').setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    return tmp.getRange('A1').getValue() === 3 ? ',' : ';';
  } catch (e) {
    var loc = '';
    try { loc = String(ss.getSpreadsheetLocale()); } catch (ignored) {}
    return /^(en|zh|ja|ko|th|he|iw|hi|ms|fil|tl)(_|$)/i.test(loc) ? ',' : ';';
  } finally {
    if (tmp) { try { ss.deleteSheet(tmp); } catch (ignored2) {} }
  }
}

/** Ba quy tắc định dạng có điều kiện tô CẢ DÒNG trong vùng a1 theo ô mức (công thức theo cú pháp của file). */
function alertRules_(sheet, a1, levelCell) {
  var range = sheet.getRange(a1);
  var f = alertFormulas_(levelCell).map(function (x) { return fx_(x, FORMULA_SEP); });
  return ALERT_BANDS.map(function (b, i) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(f[i])
      .setBackground(b.color)
      .setRanges([range])
      .build();
  });
}

/**
 * Chuẩn hóa công thức để so: bỏ khoảng trắng, đổi ";" và "\\" (cú pháp file tiếng Việt) thành ",", chữ hoa.
 * Nhờ vậy nhận ra cả quy tắc màu bản dấu phẩy cũ lẫn bản dấu chấm phẩy mới.
 */
function normFormula_(f) {
  return String(f == null ? '' : f).replace(/\s+/g, '').replace(/[;\\]/g, ',').toUpperCase();
}

/**
 * Quy tắc này có phải do menu tạo không. Không so đúng nguyên chuỗi (Google có thể trả công thức đã đổi
 * dấu phân cách theo ngôn ngữ, thêm/bớt khoảng trắng), mà so phần lõi đã chuẩn hóa: công thức có chứa
 * đoạn lấy số mức của đúng ô levelCell. Quy tắc anh tự đặt (không có đoạn này) thì giữ.
 */
function isOurRule_(rule, levelCell) {
  var c = rule.getBooleanCondition && rule.getBooleanCondition();
  if (!c) return false;
  var v = c.getCriteriaValues();
  if (!v || !v.length) return false;
  return normFormula_(v[0]).indexOf(normFormula_(levelNumF_(levelCell))) >= 0;
}

/** Nới tab lên ít nhất n hàng (chỉ thêm hàng trống ở cuối, không đụng dữ liệu). */
function ensureRows_(sheet, n) {
  var max = sheet.getMaxRows();
  if (max < n) sheet.insertRowsAfter(max, n - max);
}

/** Thay quy tắc tô màu của menu trên tab (bỏ bản cũ của menu, giữ quy tắc khác), trả số quy tắc thêm. */
function applyAlertColors_(sheet, a1, levelCell) {
  var keep = sheet.getConditionalFormatRules().filter(function (r) { return !isOurRule_(r, levelCell); });
  var add = alertRules_(sheet, a1, levelCell);
  sheet.setConditionalFormatRules(keep.concat(add));
  return add.length;
}

/** Tab có dấu "do menu tạo" với loại kind không. */
function isOurTab_(sheet, kind) {
  return sheet.getDeveloperMetadata().some(function (m) { return m.getKey() === TAB_META_KEY && m.getValue() === kind; });
}

/**
 * Lấy tab của menu để dựng lại: chưa có thì tạo (gắn dấu ẩn); có và do menu tạo thì bỏ khóa cũ,
 * xóa nội dung, định dạng, quy tắc màu; có mà KHÔNG do menu tạo (anh tự tạo) → null, không ghi đè.
 */
function ownTab_(ss, name, kind) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.addDeveloperMetadata(TAB_META_KEY, kind);
    return sh;
  }
  if (!isOurTab_(sh, kind)) return null;
  removeOurProtections_(sh);
  sh.clear();
  sh.setConditionalFormatRules([]);
  return sh;
}

/** Bỏ khóa do menu tạo trên tab (nhận ra bằng mô tả PROTECT_DESC). */
function removeOurProtections_(sheet) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    if (p.getDescription() === PROTECT_DESC) p.remove();
  });
}

/**
 * Khóa CỨNG cả tab (không phải "chỉ cảnh báo"): chỉ chủ file sửa được. openRanges: các ô vẫn cho gõ.
 * Tab đã có khóa anh tự đặt thì giữ nguyên khóa đó, trả false.
 * Web app "Thực thi với tư cách: Tôi" chạy bằng tài khoản chủ file nên doPost vẫn ghi được.
 */
function lockSheet_(sheet, openRanges) {
  removeOurProtections_(sheet);
  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) return false;
  var p = sheet.protect().setDescription(PROTECT_DESC);
  p.setWarningOnly(false);
  var me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors());
  if (p.canDomainEdit()) p.setDomainEdit(false);
  if (openRanges && openRanges.length) p.setUnprotectedRanges(openRanges);
  return true;
}

/** Hàng tiêu đề cho tab của menu: chữ đậm, nền hồng như tab CheckIn. */
function headerRow_(sheet, row, labels) {
  sheet.getRange(row, 1, 1, labels.length).setValues([labels])
       .setFontWeight('bold').setBackground('#F8BBD0').setFontColor('#880E4F');
}

/* --- Công thức dùng chung (chuỗi cố định). Dòng lạ (giờ khác dạng, mức không có số) không làm lỗi cả bảng. --- */

function srcRef_(col) { return "'" + SHEET_NAME + "'!" + col + '2:' + col; }

/** Cột Thời gian (chuỗi "HH:mm:ss dd/MM/yyyy") → ngày giờ để sắp xếp; ô đã là ngày giờ thì giữ; dòng lạ → 0. */
function timeArrayF_(tx) {
  return 'ARRAYFORMULA(IFERROR(IF(ISNUMBER(' + tx + '),' + tx + ',' +
    'DATE(VALUE(MID(' + tx + ',16,4)),VALUE(MID(' + tx + ',13,2)),VALUE(MID(' + tx + ',10,2)))+' +
    'TIME(VALUE(LEFT(' + tx + ',2)),VALUE(MID(' + tx + ',4,2)),VALUE(MID(' + tx + ',7,2)))),0))';
}

/** Cột mức "7 - Tốt" → số 7; dòng lạ → 0. */
function levelArrayF_(lv) {
  return 'ARRAYFORMULA(IFERROR(VALUE(REGEXEXTRACT(TO_TEXT(' + lv + '),"^\\d+")),0))';
}

/** Phần LET đầu: đọc 4 cột của tab CheckIn. Mã số đổi sang CHUỖI (giữ số 0 đầu, so khớp đúng từng chữ số). */
function letSource_() {
  return 'thoiGian,' + srcRef_('A') + ',' +
         'maSo,ARRAYFORMULA(TO_TEXT(' + srcRef_('B') + ')),' +
         'mucTxt,' + srcRef_('C') + ',' +
         'camXuc,' + srcRef_('D') + ',' +
         'tg,' + timeArrayF_('thoiGian') + ',' +
         'mucSo,' + levelArrayF_('mucTxt') + ',';
}

/**
 * Tab Tổng hợp, ô A2: mỗi mã số một dòng, lượt mới nhất trên cùng.
 * SORTN(…, 2, 1, TRUE) sau khi xếp giờ giảm dần = giữ lượt MỚI NHẤT của mỗi mã số.
 * Đếm bằng QUERY group by + VLOOKUP khớp đúng chuỗi (không dùng COUNTIF vì COUNTIF coi
 * "0012345" và "012345" là cùng số 12345).
 */
function summaryFormula_() {
  return '=LET(' + letSource_() +
    'soDo,ARRAYFORMULA(IF((mucSo>=1)*(mucSo<=3)*(tg>=NOW()-14),1,0)),' +
    'coMa,ARRAYFORMULA(LEN(maSo)>0),' +
    'ganNhat,SORT(SORTN(SORT(FILTER({maSo,thoiGian,mucTxt,camXuc,tg},coMa),5,FALSE),9^9,2,1,TRUE),5,FALSE),' +
    'dem,QUERY(FILTER({maSo,soDo},coMa),"select Col1, count(Col1), sum(Col2) group by Col1 label count(Col1) \'\', sum(Col2) \'\'",0),' +
    'ids,INDEX(ganNhat,0,1),' +
    'IFERROR({ids,INDEX(ganNhat,0,2),INDEX(ganNhat,0,3),INDEX(ganNhat,0,4),' +
    'ARRAYFORMULA(IFERROR(VLOOKUP(ids,dem,2,FALSE),0)),ARRAYFORMULA(IFERROR(VLOOKUP(ids,dem,3,FALSE),0))},' +
    '"Chưa có lượt check-in nào."))';
}

/**
 * Tab Tra cứu, ô A6: mọi lượt của mã số gõ ở B2, mới nhất trên cùng.
 * Bỏ khoảng trắng/chấm/gạch người tra gõ lẫn; so khớp đúng chuỗi chữ số (giữ số 0 đầu).
 */
function lookupFormula_() {
  return '=LET(ma,REGEXREPLACE(TO_TEXT(' + LOOKUP_INPUT + '),"[\\s.\\-]",""),' + letSource_() +
    'canhBao,ARRAYFORMULA(IF(mucSo<1,"",IF(mucSo<=3,"ĐỎ",IF(mucSo<=5,"VÀNG",IF(mucSo<=10,"XANH",""))))),' +
    'IF(ma="","Gõ mã số bệnh nhân vào ô B2 rồi bấm Enter.",' +
    'IF(NOT(REGEXMATCH(ma,"^\\d{3,20}$")),"Mã số chỉ gồm chữ số (3–20 số), ví dụ 26012345.",' +
    'IFERROR(SORT(FILTER({thoiGian,mucTxt,camXuc,canhBao},maSo=ma),FILTER(tg,maSo=ma),FALSE),' +
    '"Chưa có lượt check-in nào với mã số này."))))';
}

/* ===== Cột "Gợi ý mở đầu" (04/11/2026, anh duyệt theo docs/specs/checkin-me-bau-huong-xu-tri.md) =====
 * Màu theo MỨC quyết định dành bao nhiêu thời gian; nhóm THẺ quyết định nói câu gì.
 * Chữ lấy nguyên văn bảng quyết định trong spec (tờ quy trình bản nháp 0.3 · 04/11/2026), KHÔNG tự thêm ý.
 * Thẻ so khớp NGUYÊN CHUỖI sau TRIM (phân biệt hoa thường); thẻ khác hoặc trống coi như không có thẻ.
 */
var CARD_GROUPS = [
  { key: 'deChiu', cards: ['Vui vẻ', 'Bình an'] },                              // 1. dễ chịu
  { key: 'lamDiu', cards: ['Hoảng hốt', 'Tức giận', 'Lo lắng', 'Khó chịu'] },   // 2. cần làm dịu trước
  { key: 'dauKho', cards: ['Đau khổ'] },                                         // 3. đau khổ (riêng)
  { key: 'ketNoi', cards: ['Cô đơn', 'Mệt mỏi', 'Buồn'] }                       // 4. kết nối, nâng đỡ ("Buồn": nhãn trước 02/11)
];
// Chữ trong ô theo (dải mức, nhóm thẻ). khac = thẻ khác/trống. Dòng mức lạ (không số, 0, > 10) → ô trống.
var OPENER_TEXTS = {
  red: {
    deChiu: 'ĐỎ · Chỗ lệch: chấm thấp mà chọn bé dễ chịu, hỏi nhẹ chỗ chưa khớp. Hỏi câu an toàn, cho làm EPDS.',
    dauKho: 'ĐỎ · Đồng hành với đau buồn, không dùng kỹ thuật làm dịu lo âu. Hỏi câu an toàn, cho làm EPDS.',
    lamDiu: 'ĐỎ · Làm dịu trước (nói chậm, cho thở) rồi mới hỏi. Hỏi câu an toàn, cho làm EPDS.',
    ketNoi: 'ĐỎ · Kết nối, nâng đỡ: nhóm im lặng, dễ bị bỏ sót. Hỏi câu an toàn, cho làm EPDS.',
    khac:   'ĐỎ · Hỏi cảm xúc trước khi tư vấn. Hỏi câu an toàn, cho làm EPDS.'
  },
  yellow: {
    lamDiu:        'VÀNG · 2–3 phút đầu: làm dịu trước (nói chậm, cho thở) rồi hỏi về bé chị chọn.',
    dauKhoKetNoi:  'VÀNG · 2–3 phút đầu: kết nối, nâng đỡ; nhóm này dễ bị bỏ sót vì im lặng.',
    deChiuKhac:    'VÀNG · 2–3 phút đầu: hỏi cảm xúc trước khi đưa thông tin chuyên môn.'
  },
  green: {
    deChiuKhac: 'XANH · Tư vấn như thường lệ.',
    conLai:     'XANH · Hỏi đúng một câu về bé chị chọn rồi đi tiếp.'
  }
};

/** Chuỗi trong công thức: bọc "…", nháy kép bên trong thành "" (chữ cố định, không có dữ liệu người dùng). */
function q_(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

/**
 * Công thức mảng cột "Gợi ý mở đầu" theo cột mức lv (ví dụ "C2:C") và cột thẻ cv (ví dụ "D2:D").
 * Cùng kiểu LET + ARRAYFORMULA như lookupFormula_ (đã chạy đúng trên Sheet thật 02/11/2026).
 *   mucG  : số mức (REGEXEXTRACT "^\d+", dòng lạ → 0)
 *   theG  : thẻ đã TRIM
 *   nhomG : 1 dễ chịu · 2 làm dịu · 3 đau khổ · 4 kết nối · 0 khác/trống
 */
function openerFormula_(lv, cv) {
  var g = function (i) { return 'REGEXMATCH(theG,' + q_('^(' + CARD_GROUPS[i].cards.join('|') + ')$') + ')'; };
  var R = OPENER_TEXTS.red, Y = OPENER_TEXTS.yellow, G = OPENER_TEXTS.green;
  return '=LET(mucG,' + levelArrayF_(lv) + ',' +
    'theG,ARRAYFORMULA(TRIM(TO_TEXT(' + cv + '))),' +
    'nhomG,ARRAYFORMULA(IF(' + g(0) + ',1,IF(' + g(1) + ',2,IF(' + g(2) + ',3,IF(' + g(3) + ',4,0))))),' +
    'ARRAYFORMULA(' +
      'IF((mucG>=1)*(mucG<=3),' +
        'IF(nhomG=1,' + q_(R.deChiu) + ',IF(nhomG=3,' + q_(R.dauKho) + ',IF(nhomG=2,' + q_(R.lamDiu) + ',IF(nhomG=4,' + q_(R.ketNoi) + ',' + q_(R.khac) + ')))),' +
      'IF((mucG>=4)*(mucG<=5),' +
        'IF(nhomG=2,' + q_(Y.lamDiu) + ',IF(nhomG>=3,' + q_(Y.dauKhoKetNoi) + ',' + q_(Y.deChiuKhac) + ')),' +
      'IF((mucG>=6)*(mucG<=10),' +
        'IF(nhomG>=2,' + q_(G.conLai) + ',' + q_(G.deChiuKhac) + '),' +
      '"")))))';
}

/* ===== Tab "Hướng xử trí": nội dung TĨNH, chữ nguyên văn spec 04/11/2026 (bản nháp dùng thử 0.3 · 04/11/2026; 3 ô chờ điền theo anh 04/11) =====
 * Không công thức, không dữ liệu bệnh nhân. Khóa cứng cả tab, không ô nào mở.
 * Mỗi hàng 4 ô A–D ("·" trong spec = sang cột). "\n" = xuống dòng trong ô.
 * Chỉ sửa chữ trong ô, KHÔNG thêm/bớt hàng (ô gộp và màu gắn theo số hàng: buildGuide_ gộp A1–A4, A12,
 * A25, B20–B23 và tô nền hàng 7–10 theo số hàng cố định).
 */
var GUIDE_ROWS = [
  /* 1 */ ['HƯỚNG XỬ TRÍ PHIẾU CHECK-IN CẢM XÚC MẸ BẦU THEO 3 MÀU', '', '', ''],
  /* 2 */ ['Bản nháp dùng thử 0.3, cập nhật 04/11/2026 – chưa ban hành, chưa kiểm định. Phiếu là tự đánh giá, không phải công cụ chẩn đoán, không thay EPDS.', '', '', ''],
  /* 3 */ ['Cách dùng: ngay trước khi gọi thai phụ vào, mở tab Tổng hợp, bấm Ctrl+F gõ mã số BN; cột G là gợi ý mở đầu. Người có quyền sửa có thể gõ mã ở tab Tra cứu để xem mọi lượt. Màu theo mức quyết định dành bao nhiêu thời gian; thẻ capybara quyết định nói câu gì. Thẻ không tham gia xếp màu.', '', '', ''],
  /* 4 */ ['Lượt trước 02/11/2026: app cũ để sẵn mức 5, nên mức 5 của lượt cũ có thể là mặc định, hỏi lại bằng lời. Từ 02/11 thai phụ phải tự chạm chọn mức. Thẻ "Buồn" (trước 02/11) nay là "Đau khổ".', '', '', ''],
  /* 5 */ ['', '', '', ''],
  /* 6 */ ['Màu', 'Khi nào', 'Bác sĩ tư vấn làm gì', 'Bước tiếp theo'],
  /* 7 */ ['XANH – Ổn định',
           'Mức 6–10, bất kể thẻ.',
           'Tư vấn như thường lệ. Mở đầu: "Cảm ơn chị đã check-in, hôm nay chị thấy khá ổn phải không?"\n' +
           'Nếu thẻ là cảm xúc khó chịu (Lo lắng, Đau khổ, Mệt mỏi, Cô đơn…): hỏi đúng một câu về cảm xúc đó rồi đi tiếp: "Chị chọn bé đang lo lắng, chị kể thêm cho bác sĩ được không?"\n' +
           'Cuối buổi: tờ thông tin sức khỏe tinh thần khi mang thai (dấu hiệu cần tìm giúp đỡ, số liên hệ).',
           'Tầng 1. Check-in lại ở lần đến sau.'],
  /* 8 */ ['VÀNG – Hỏi trước khi tư vấn',
           'Mức 4–5 (Kém, Bình thường), bất kể thẻ.',
           'Dành 2–3 phút đầu để hỏi trước khi đưa thông tin chuyên môn. Phản chiếu thẻ bằng chữ của thai phụ: "Chị chọn bé đang …, chị chia sẻ thêm cho bác sĩ được không?" (không nói "bác sĩ thấy chị đang …").\n' +
           'Cần làm dịu trước (Hoảng hốt, Tức giận, Lo lắng, Khó chịu): nói chậm, cho thở, rồi mới hỏi.\n' +
           'Cần kết nối và nâng đỡ (Đau khổ, Cô đơn, Mệt mỏi): không cần làm dịu; nhóm này dễ bị bỏ sót vì im lặng.\n' +
           'Lo theo tình huống (kết quả, thủ thuật, thai): giải thích chậm, kiểm tra hiểu, hẹn ngày có kết quả; mời làm STOP-4P (10 phút) khi chờ chọc ối.\n' +
           'Lo/buồn kéo dài ≥ 2 tuần, mất ngủ, chán ăn, mất hứng thú: cho làm EPDS (đủ 10 câu).',
           'EPDS < 12 và câu 10 = 0: tầng 1, check-in lại lần sau, tài liệu tự chăm sóc.\n' +
           'EPDS ≥ 12: xử trí như ĐỎ.\n' +
           'Câu 10 > 0: BÁO ĐỘNG.'],
  /* 9 */ ['ĐỎ – Đánh giá trong buổi',
           'Mức 1–3 (Tồi tệ, Rất tồi tệ, Tuyệt vọng), bất kể thẻ; hoặc EPDS ≥ 12 từ nhánh vàng.',
           'Hỏi về cảm xúc trước, trong buổi tư vấn, trước khi thai phụ rời khoa.\n' +
           'Nếu thẻ là Vui vẻ hoặc Bình an: đây là chỗ lệch, hỏi nhẹ: "Chị chấm 2 mà lại chọn bé vui vẻ, chị kể thêm giúp bác sĩ được không?"\n' +
           'Thẻ Đau khổ sau khi nhận kết quả xấu: đồng hành với đau buồn, không dùng kỹ thuật làm dịu lo âu.\n' +
           'Cho làm EPDS và hỏi trực tiếp câu hỏi an toàn: "Hai tuần qua, có lúc nào chị nghĩ đến việc làm hại bản thân không?"\n' +
           'Hỏi yếu tố nguy cơ: tiền sử trầm cảm, mất thai, thai bất thường, bạo lực gia đình, thiếu người hỗ trợ.',
           'Nhẹ: tư vấn nâng đỡ tại khoa (tầng 2).\n' +
           'Vừa–nặng: chuyển chuyên viên tâm lý (tầng 3), hẹn ≤ 7 ngày.\n' +
           'Không đến hẹn: gọi lại, ghi sổ.\n' +
           'Câu hỏi an toàn dương tính: BÁO ĐỘNG.'],
  /* 10 */ ['⚠ BÁO ĐỘNG – Mọi màu',
           'Ý nghĩ tự hại hoặc hại con; bạo lực đang diễn ra; lời nói, hành vi bất thường.',
           'Người phát hiện, ngay. Không để thai phụ một mình, không để tự đi liên hệ.\n' +
           'Hỏi rõ ý định, kế hoạch, phương tiện; xếp mức nguy cơ theo Quy trình an toàn chung (chưa ghi nhận / thấp / trung bình / cao hoặc cận kề).',
           'Giờ hành chính: gọi BS Thông để chuyển tầng 3.\n' +
           'Ngoài giờ: gọi BS Thông, báo trực lãnh đạo.\n' +
           'Mức cao: cấp cứu tâm thần (tầng 4).'],
  /* 11 */ ['', '', '', ''],
  /* 12 */ ['9 thẻ capybara chia 3 nhánh', '', '', ''],
  /* 13 */ ['Nhánh', 'Thẻ', 'Làm gì', ''],
  /* 14 */ ['1. Thẻ dễ chịu', 'Vui vẻ, Bình an', 'Ở xanh: đi tiếp bình thường. Ở đỏ: đây là chỗ lệch, hỏi nhẹ.', ''],
  /* 15 */ ['2. Cần làm dịu trước', 'Hoảng hốt, Tức giận, Lo lắng, Khó chịu', 'Nói chậm, cho thở, rồi mới hỏi.', ''],
  /* 16 */ ['3. Cần kết nối và nâng đỡ', 'Đau khổ, Cô đơn, Mệt mỏi', 'Không cần làm dịu. Nhóm dễ bị bỏ sót nhất vì im lặng. Thẻ Đau khổ: dùng tài nguyên đau buồn, không dùng kỹ thuật làm dịu lo âu.', ''],
  /* 17 */ ['Lưu ý', 'Thẻ chỉ có hình, xáo thứ tự mỗi lượt', 'Thẻ là cách thai phụ hiểu hình, không phải nhãn cảm xúc chuẩn. Không so vị trí thẻ giữa các lượt.', ''],
  /* 18 */ ['', '', '', ''],
  /* 19 */ ['Nên nói', '"Cảm ơn chị đã chia sẻ."', '"Nhiều mẹ bầu cũng có cảm giác này, mình cùng tìm cách hỗ trợ chị."', '"Chị có muốn người nhà cùng nghe không?"'],
  /* 20 */ ['Tránh', '"Chị đừng lo", "Ai mang thai cũng vậy", "Bác sĩ thấy chị đang …", hứa giữ bí mật khi có nguy cơ tự hại.', '', ''],
  /* 21 */ ['Câu tự tạo khoảng cách', '"Nếu chị khuyên những người đang lo lắng giống chị thì chị sẽ nói gì?" Dùng cho XANH và VÀNG khi thẻ thuộc nhánh cần làm dịu (Lo lắng, Hoảng hốt…); không dùng với thẻ Đau khổ sau kết quả xấu (dễ bị nghe như gạt nỗi đau sang một bên). Với ĐỎ: chỉ hỏi sau khi thai phụ đã nói xong và đã hỏi câu an toàn. Đây là cách làm theo kinh nghiệm, chưa có nghiên cứu ở thai phụ.', '', ''],
  /* 22 */ ['Ghi chép', 'Ghi vào hồ sơ tư vấn: màu, câu hỏi an toàn đã hỏi, điểm EPDS (nếu có), hướng xử trí. Không chụp, không chuyển bảng có mã số ra ngoài. Chỉ tiêu: 100% ca ĐỎ và BÁO ĐỘNG có ghi câu hỏi an toàn và hướng xử trí trong hồ sơ.', '', ''],
  /* 23 */ ['Phiếu gửi ngoài giờ, từ nhà', 'Bác sĩ đọc khi thai phụ đến buổi tư vấn. Ca ĐỎ chưa có lịch hẹn gần: BS Thông gọi lại.', '', ''],
  /* 24 */ ['', '', '', ''],
  /* 25 */ ['Căn cứ: luồng sàng lọc chung, ngưỡng EPDS ≥ 12 và Quy trình an toàn chung trong tham luận "Chăm sóc sức khỏe tâm thần phân tầng tại Bệnh viện Hùng Vương" (11/2026); nghiên cứu STOP-4P tại khoa (n = 84, số liệu nội bộ chưa công bố); thang siêu ngắn loại trừ tốt hơn xác định, không dùng riêng để chẩn đoán (Steel & Carr 2022). Ngưỡng 3 màu là đề xuất của nhóm, chưa thẩm định.', '', '', '']
];
var GUIDE_WIDTHS = [110, 170, 470, 260];      // A màu · B khi nào · C bác sĩ làm gì · D bước tiếp theo

/** Dựng tab Tổng hợp (tab rỗng do ownTab_ trả về). */
function buildSummary_(sh) {
  headerRow_(sh, 1, ['Mã số BN', 'Lượt gần nhất (giờ)', 'Mức gần nhất', 'Cảm xúc gần nhất', 'Số lượt', 'Số lượt ĐỎ trong 14 ngày', 'Gợi ý mở đầu']);
  sh.setFrozenRows(1);
  sh.getRange('A2').setFormula(fx_(summaryFormula_(), FORMULA_SEP));
  // G2: gợi ý mở đầu theo mức (C) + cảm xúc (D) của chính dòng đó (04/11/2026)
  sh.getRange('G2').setFormula(fx_(openerFormula_('C2:C', 'D2:D'), FORMULA_SEP));
  [120, 160, 170, 170, 80, 190, 420].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  ensureRows_(sh, MIN_ROWS);   // mỗi mã số một dòng: đủ chỗ và đủ vùng tô màu cho tới 20 000 mã
  sh.getRange('G1:G' + sh.getMaxRows()).setWrap(true).setVerticalAlignment('top');
  applyAlertColors_(sh, 'A2:G' + sh.getMaxRows(), '$C2');
}

/** Dựng tab Tra cứu (tab rỗng do ownTab_ trả về). */
function buildLookup_(sh) {
  sh.getRange('A1').setValue('Tra cứu check-in theo mã số bệnh nhân').setFontWeight('bold').setFontColor('#880E4F');
  sh.getRange('A2').setValue('Nhập mã số BN').setFontWeight('bold');
  // Ô gõ mã: dạng văn bản (@) để giữ số 0 đầu, nền vàng nhạt, viền đậm cho dễ thấy
  sh.getRange(LOOKUP_INPUT).setNumberFormat('@').setBackground(INPUT_BG).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, '#F9A825', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange('C2').setValue('← gõ mã số rồi bấm Enter (người xem không gõ được ô này)').setFontColor('#7a636c');
  sh.getRange('A3').setValue('Màu theo mức: ĐỎ 1–3 · VÀNG 4–5 · XANH 6–10. Tự đánh giá, không phải thang chẩn đoán. ' +
    'Xem tab Hướng xử trí trước khi gọi thai phụ vào.').setFontColor('#7a636c');
  headerRow_(sh, LOOKUP_FIRST_ROW - 1, ['Thời gian', 'Mức', 'Cảm xúc', 'Cảnh báo', 'Gợi ý mở đầu']);
  sh.setFrozenRows(LOOKUP_FIRST_ROW - 1);
  sh.getRange('A' + LOOKUP_FIRST_ROW).setFormula(fx_(lookupFormula_(), FORMULA_SEP));
  // E6: gợi ý mở đầu theo Mức (B) + Cảm xúc (C) của từng lượt tra được (04/11/2026)
  sh.getRange('E' + LOOKUP_FIRST_ROW).setFormula(fx_(openerFormula_('B' + LOOKUP_FIRST_ROW + ':B', 'C' + LOOKUP_FIRST_ROW + ':C'), FORMULA_SEP));
  [170, 190, 170, 90, 420].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange('E' + (LOOKUP_FIRST_ROW - 1) + ':E' + sh.getMaxRows()).setWrap(true).setVerticalAlignment('top');
  applyAlertColors_(sh, 'A' + LOOKUP_FIRST_ROW + ':E' + sh.getMaxRows(), '$B' + LOOKUP_FIRST_ROW);
}

/**
 * Dựng tab Hướng xử trí (tab rỗng do ownTab_ trả về): chữ tĩnh GUIDE_ROWS, không công thức.
 * Mọi ô dạng văn bản (@) để Sheets không hiểu nhầm chữ (ví dụ "1. Thẻ dễ chịu") thành số/ngày.
 */
function buildGuide_(sh) {
  var n = GUIDE_ROWS.length, all = sh.getRange(1, 1, n, 4);
  all.breakApart();                                  // chạy lại menu: bỏ ô gộp cũ rồi gộp lại như dưới
  all.setNumberFormat('@');
  all.setValues(GUIDE_ROWS);
  all.setVerticalAlignment('top').setWrap(true);
  GUIDE_WIDTHS.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  // Tiêu đề, trạng thái bản nháp, cách dùng, lưu ý lượt cũ: gộp A–D cho dễ đọc
  ['A1:D1', 'A2:D2', 'A3:D3', 'A4:D4', 'A12:D12', 'A25:D25'].forEach(function (a1) { sh.getRange(a1).merge(); });
  sh.getRange('A1').setFontWeight('bold').setFontSize(13).setFontColor('#880E4F');
  sh.getRange('A2').setFontWeight('bold');
  sh.getRange('A12').setFontWeight('bold');
  headerRow_(sh, 6, GUIDE_ROWS[5]);
  headerRow_(sh, 13, GUIDE_ROWS[12].slice(0, 3));
  // Ba hàng màu dùng đúng màu tô ở các tab khác; hàng BÁO ĐỘNG nền đậm hơn, chữ đậm
  sh.getRange('A7:D7').setBackground(ALERT_COLORS.green);
  sh.getRange('A8:D8').setBackground(ALERT_COLORS.yellow);
  sh.getRange('A9:D9').setBackground(ALERT_COLORS.red);
  sh.getRange('A10:D10').setBackground(ALARM_BG).setFontWeight('bold');
  sh.getRange('A7:A9').setFontWeight('bold');
  sh.getRange('A19:A23').setFontWeight('bold');
  // Hàng 20–23 chỉ có một ý: gộp B–D (cột B hẹp)
  ['B20:D20', 'B21:D21', 'B22:D22', 'B23:D23'].forEach(function (a1) { sh.getRange(a1).merge(); });
  sh.getRange('A25').setFontColor('#7a636c').setFontSize(9);
}

/**
 * Đặt tab sh ngay sau tab after (vị trí đếm từ 1). Đúng chỗ rồi thì không làm gì.
 * moveActiveSheet(pos) đưa tab đang chọn về đúng vị trí pos, nên tab sh sẽ đang được chọn sau khi dời.
 */
function placeAfter_(ss, sh, after) {
  if (!after || sh.getIndex() === after.getIndex() + 1) return;
  var pos = sh.getIndex() < after.getIndex() ? after.getIndex() : after.getIndex() + 1;
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(pos);
}

/** Báo cho anh: có giao diện Sheet thì hiện hộp thoại, chạy từ editor thì ghi Nhật ký. */
function say_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/**
 * MENU "Check-in" → "Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)".
 * Chạy lại nhiều lần vẫn ra cùng kết quả. Không ghi, không xóa dòng dữ liệu nào ở tab CheckIn.
 */
function caiDatBangBacSi() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);   // không chen ngang lúc doPost đang ghi
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var src = sheet_();
    ensureHeader_(src);
    var notes = [];
    var res = { checkinRules: 0, summary: false, lookup: false, guide: false, locks: [], sep: '' };

    // Cú pháp công thức theo ngôn ngữ của file (file tiếng Việt dùng ";"), thử trên tab tạm
    FORMULA_SEP = detectFormulaSep_(ss);
    res.sep = FORMULA_SEP;
    var sepText = FORMULA_SEP === ';' ? 'dấu chấm phẩy ";" (file tiếng Việt)' : 'dấu phẩy "," (file tiếng Anh)';
    Logger.log('caiDatBangBacSi: cú pháp công thức = ' + sepText);

    // a) Tab CheckIn: nới lên ≥ 20 000 hàng rồi tô cả dòng A–D theo mức ở cột C
    //    (vùng tô màu phủ tới hàng cuối lúc chạy menu; doPost thêm hàng khi hết)
    ensureRows_(src, MIN_ROWS);
    res.checkinRules = applyAlertColors_(src, 'A2:D' + src.getMaxRows(), '$C2');

    // b) Tab Tổng hợp
    var sum = ownTab_(ss, SUMMARY_SHEET, 'tong_hop');
    if (sum) { buildSummary_(sum); res.summary = true; }
    else notes.push('Tab "' + SUMMARY_SHEET + '" có sẵn do anh tự tạo nên mình không ghi đè. Anh đổi tên tab đó rồi chạy lại menu.');

    // c) Tab Tra cứu
    var look = ownTab_(ss, LOOKUP_SHEET, 'tra_cuu');
    if (look) { buildLookup_(look); res.lookup = true; }
    else notes.push('Tab "' + LOOKUP_SHEET + '" có sẵn do anh tự tạo nên mình không ghi đè. Anh đổi tên tab đó rồi chạy lại menu.');

    // d) Tab Hướng xử trí (chữ tĩnh), đứng ngay sau tab Tra cứu
    var guide = ownTab_(ss, GUIDE_SHEET, 'huong_xu_tri');
    if (guide) {
      buildGuide_(guide);
      placeAfter_(ss, guide, ss.getSheetByName(LOOKUP_SHEET));
      res.guide = true;
    } else notes.push('Tab "' + GUIDE_SHEET + '" có sẵn do anh tự tạo nên mình không ghi đè. Anh đổi tên tab đó rồi chạy lại menu.');

    // Khóa cứng: CheckIn, Tổng hợp, Tra cứu (trừ ô gõ mã), Hướng xử trí (không ô nào mở)
    if (lockSheet_(src)) res.locks.push(SHEET_NAME);
    else notes.push('Tab ' + SHEET_NAME + ' đã có khóa anh tự đặt, mình giữ nguyên khóa đó.');
    if (sum && lockSheet_(sum)) res.locks.push(SUMMARY_SHEET);
    if (look && lockSheet_(look, [look.getRange(LOOKUP_INPUT)])) res.locks.push(LOOKUP_SHEET);
    if (guide && lockSheet_(guide)) res.locks.push(GUIDE_SHEET);

    say_('Đã cài xong: tô màu tab ' + SHEET_NAME +
         (res.summary ? ', tab "' + SUMMARY_SHEET + '" (có cột Gợi ý mở đầu)' : '') +
         (res.lookup ? ', tab "' + LOOKUP_SHEET + '" (gõ mã ở ô ' + LOOKUP_INPUT + ', có cột Gợi ý mở đầu)' : '') +
         (res.guide ? ', tab "' + GUIDE_SHEET + '" (bản nháp dùng thử 0.3 · 04/11/2026, đọc trước khi tư vấn)' : '') +
         '. Đã khóa: ' + (res.locks.join(', ') || 'không tab nào') + '.' +
         '\nCông thức ghi theo ' + sepText + '.' +
         (notes.length ? '\n\n' + notes.join('\n') : ''));
    return res;
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
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
  var r3 = post({ sessionId: sid, patientId: '0012 345', level: 2, part2: 'Cô đơn' });
  Logger.log('test_: cảm xúc mới "Cô đơn" → ' + JSON.stringify(r3) + (r3.result === 'success' ? ' (đúng: nhận 9 cảm xúc)' : ' (SAI)'));
  var r4 = post({ sessionId: sid, patientId: '0012 345', level: 2, part2: 'Buồn' });
  Logger.log('test_: nhãn cũ "Buồn" (web bản cũ) → ' + JSON.stringify(r4) + (r4.result === 'success' ? ' (đúng: vẫn nhận)' : ' (SAI)'));
  Logger.log('test_: cảm xúc "Bình yên" (tên nháp, chưa từng lên mạng) → ' + JSON.stringify(post({ sessionId: sid, patientId: '0012 345', level: 2, part2: 'Bình yên' })));
  Logger.log('test_: GET → ' + doGet({ parameter: {} }).getContent());

  rowNo = findSessionRow_(sheet, sid);
  if (rowNo > 0) { sheet.deleteRow(rowNo); Logger.log('test_: đã xóa dòng thử số ' + rowNo); }
  Logger.log('test_: XONG');
}
