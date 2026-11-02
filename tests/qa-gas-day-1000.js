/* =========================================================
   QA 02/11/2026 – tab CheckIn đã ĐẦY số hàng (mặc định Google tạo 1000 hàng).
   GIẢ ĐỊNH theo hành vi Google Sheets thật (chưa thử trên Google): sheet.getRange(hàng > getMaxRows())
   ném "The coordinates of the range are outside the dimensions of the sheet." (appendRow thì tự thêm hàng,
   getRange thì không). Mock dưới đây mô phỏng đúng điều đó.
   Kỳ vọng: lượt check-in thứ 1000 (hàng 1001) vẫn ghi được.
   Lượt 3: thêm kiểm 9 nhãn mới, "Buồn" cũ vẫn nhận, nhãn bỏ (Bình yên, Tủi thân, cô đơn) bị từ chối. Chạy: node tests/qa-gas-day-1000.js
   Không gọi mạng, không đụng Sheet thật.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'google_apps_script.js'), 'utf8');

function makeSheet(maxRows) {
  const s = { rows: [], maxRows };
  s.getLastRow = () => s.rows.length;
  s.getMaxRows = () => s.maxRows;
  s.appendRow = r => { s.rows.push(r.slice()); if (s.rows.length > s.maxRows) s.maxRows = s.rows.length; };
  s.insertRowsAfter = (after, n) => { s.maxRows += n; return s; };
  s.insertRowAfter = after => { s.maxRows += 1; return s; };
  s.setFrozenRows = () => {}; s.hideColumns = () => {};
  s.getRange = (r, c, nr, nc) => {
    nr = nr || 1; nc = nc || 1;
    if (r < 1 || r + nr - 1 > s.maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
    return {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((s.rows[r - 1 + i] || [])[c - 1 + j]) ?? '')),
      getValue: () => ((s.rows[r - 1] || [])[c - 1]) ?? '',
      setValues(v) { v.forEach((row, i) => { const t = s.rows[r - 1 + i] || (s.rows[r - 1 + i] = []); row.forEach((x, j) => { t[c - 1 + j] = x; }); }); return this; },
      setValue(x) { const t = s.rows[r - 1] || (s.rows[r - 1] = []); t[c - 1] = x; return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
    };
  };
  return s;
}

const sheet = makeSheet(1000);
sheet.rows.push(['Thời gian', 'Mã số bệnh nhân', 'Phần 1: Mức cảm xúc', 'Phần 2: Cảm xúc Capybara', 'Mã phiên']);
for (let i = 1; i <= 999; i++) sheet.rows.push(['08:00:00 01/11/2026', '26012345', '7 - Tốt', 'Vui vẻ', 'old-sess-' + String(i).padStart(4, '0')]);

const sb = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => (n === 'CheckIn' ? sheet : null), insertSheet: () => sheet }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType() { return this; }, getContent: () => t }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: () => '09:00:00 02/11/2026' },
  Logger: { log() {} }
};
vm.createContext(sb);
vm.runInContext(SRC, sb);

const res = JSON.parse(sb.doPost({ postData: { contents: JSON.stringify({ sessionId: 'qa-full-sheet-0001', patientId: '0012345', level: 2, part2: 'Cô đơn', ageMs: 0 }) } }).getContent());
const ok = res.result === 'success' && sheet.rows.length === 1001 && sheet.rows[1000][1] === '0012345';
console.log((ok ? 'PASS' : 'FAIL') + ' Tab CheckIn đủ 1000 hàng (1 tiêu đề + 999 lượt): lượt mới vẫn ghi vào hàng 1001  → ' + JSON.stringify(res) + ', số hàng = ' + sheet.rows.length);
if (!ok) console.log('     (app nhận retry → giữ trong hàng chờ 7 ngày rồi bỏ; chị vẫn thấy trang cảm ơn → mất lượt im lặng)');

/* Lượt 3 (02/11/2026): tên cảm xúc theo ảnh. 9 nhãn mới nhận; "Buồn" (web cũ / hàng chờ cũ) vẫn nhận, ghi nguyên chữ;
   "Bình yên", "Tủi thân, cô đơn" (chưa từng lên web) bị từ chối. Ghi tiếp sau hàng 1001 (tab đã tự nới). */
let fails = ok ? 0 : 1;
const post = (sid, part2) => JSON.parse(sb.doPost({ postData: { contents: JSON.stringify({ sessionId: sid, patientId: '26012345', level: 5, part2, ageMs: 0 }) } }).getContent());
const NEW = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];
const got = NEW.map((e, i) => { const r = post('qa-new-label-' + String(i).padStart(4, '0'), e); return r.result === 'success' && sheet.rows[sheet.rows.length - 1][3] === e; });
const okNew = got.every(Boolean);
if (!okNew) fails++;
console.log((okNew ? 'PASS' : 'FAIL') + ' 9 nhãn mới đều ghi được, cột D đúng nguyên chữ  → ' + NEW.map((e, i) => e + ':' + (got[i] ? 'ok' : 'LỖI')).join(', '));
const rb = post('qa-legacy-buon-0001', 'Buồn');
const okB = rb.result === 'success' && sheet.rows[sheet.rows.length - 1][3] === 'Buồn';
if (!okB) fails++;
console.log((okB ? 'PASS' : 'FAIL') + ' "Buồn" (web cũ / hàng chờ cũ) vẫn nhận, ghi nguyên chữ "Buồn"  → ' + JSON.stringify(rb));
const rej = ['Bình yên', 'Tủi thân, cô đơn', 'Tủi thân', 'buồn', ' Đau khổ x'].map(e => [e, post('qa-reject-' + e.length + '-' + 'x'.repeat(8), e).error]);
const okR = rej.every(([, e]) => e === 'emotion_invalid');
if (!okR) fails++;
console.log((okR ? 'PASS' : 'FAIL') + ' Nhãn không có trong danh sách bị từ chối emotion_invalid  → ' + JSON.stringify(rej));
process.exit(fails ? 1 : 0);
