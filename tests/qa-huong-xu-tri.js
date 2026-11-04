/* =========================================================
   QA 04/11/2026 – Hướng xử trí + cột "Gợi ý mở đầu" (kiểm ĐỘC LẬP với tests/test-gas.js của dev).
   - Chữ lấy THẲNG từ docs/specs/checkin-me-bau-huong-xu-tri.md (đọc file spec, không chép tay), so với
     GUIDE_ROWS / OPENER_TEXTS trong google_apps_script.js.
   - Bộ đánh giá công thức viết riêng (không dùng lại của dev). Chế độ vi_VN chạy NGHIÊM: dấu "," ngoài chuỗi
     là lỗi cú pháp, ";" là ngăn tham số; chế độ en ngược lại.
   - Độ dài công thức (Google giới hạn 50 000 ký tự/ô), Unicode NFC, nhãn cũ trong lịch sử git.
   - git diff so với HEAD (chỉ có nghĩa TRƯỚC khi commit bản 04/11): doPost, validateCheckin_, cột CheckIn,
     index.html / script.js / styles.css không đổi. Máy không có git thì BỎ QUA phần này.
   Không gọi mạng, không đụng Sheet thật. Chạy: node tests/qa-huong-xu-tri.js   (FAIL → exit 1)
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const APP = path.resolve(__dirname, '..');
const SPEC = path.resolve(APP, '..', '..', 'docs', 'specs', 'checkin-me-bau-huong-xu-tri.md');
const SRC = fs.readFileSync(path.join(APP, 'google_apps_script.js'), 'utf8');
let fails = 0, passes = 0;
const T = (name, ok, detail) => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 400) : '')); };

/* Nạp script vào sandbox (chỉ cần hằng số và hàm thuần, không gọi Google) */
const sb = { Logger: { log() {} }, console };
vm.createContext(sb);
vm.runInContext(SRC + '\n;this.__ = { GUIDE_ROWS, OPENER_TEXTS, CARD_GROUPS, EMOTION_LABELS, LEGACY_EMOTION_LABELS, LEVEL_TEXTS, ALERT_COLORS, GUIDE_WIDTHS, MENU_ITEM, GUIDE_SHEET };', sb);
const G = sb.__;

/* ===== 1. Tab Hướng xử trí: chữ khớp spec nguyên văn ===== */
const spec = fs.readFileSync(SPEC, 'utf8');
const tabPart = spec.split('## Tab "Hướng xử trí" – nội dung')[1].split('(⏎ = xuống dòng')[0];
const want = {};   // số hàng → 4 ô
const unbold = s => s.replace(/\*\*/g, '');
tabPart.split('\n').forEach(line => {
  let m;
  if ((m = /^A([1-4])(?: \(đậm\))?: (.*)$/.exec(line))) { want[+m[1]] = [unbold(m[2]).trim(), '', '', '']; return; }
  if ((m = /^Hàng (\d+)(?: tiêu đề:| –| \(chữ xám, nhỏ\):|:) (.*)$/.exec(line))) {
    const body = unbold(m[2]).replace(/ \(đậm\)$/, '').trim();
    const cells = body.split(' · ').map(c => c.replace(/⏎/g, '\n'));
    while (cells.length < 4) cells.push('');
    want[+m[1]] = cells;
  }
});
const wantRows = Object.keys(want).map(Number);
T('Spec: đọc được 4 dòng A1–A4 + hàng 6–10, 12–17, 19–23, 25 (21 hàng có chữ)', wantRows.length === 21 && [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25].every(n => want[n]), wantRows.join(','));
T('Code: GUIDE_ROWS đúng 25 hàng × 4 ô', G.GUIDE_ROWS.length === 25 && G.GUIDE_ROWS.every(r => r.length === 4));
const diffs = [];
for (let n = 1; n <= 25; n++) {
  const w = want[n] || ['', '', '', ''];
  const got = G.GUIDE_ROWS[n - 1] || [];
  for (let c = 0; c < 4; c++) if ((got[c] || '') !== w[c]) diffs.push('hàng ' + n + ' cột ' + 'ABCD'[c] + ': code=' + JSON.stringify(got[c]) + ' spec=' + JSON.stringify(w[c]));
}
T('Tab Hướng xử trí: 25 × 4 ô khớp spec NGUYÊN VĂN từng ký tự (kể cả xuống dòng ⏎, ngoặc kép, dấu …, ≥, ≤, –)', diffs.length === 0, diffs.slice(0, 3).join(' | '));
T('Tab Hướng xử trí: hàng 5, 11, 18, 24 trống (khoảng cách giữa các khối)', [5, 11, 18, 24].every(n => G.GUIDE_ROWS[n - 1].every(c => c === '')));
T('Tab Hướng xử trí: còn đủ 3 chỗ [cần xác nhận: …] (số gọi tầng 3, số trực, ai gọi lại) – chưa tự điền số',
  G.GUIDE_ROWS.flat().join('\n').match(/\[cần xác nhận: [^\]]+\]/g).length === 3);
T('Tab Hướng xử trí: không ô nào bắt đầu bằng = + - @ (Sheets hiểu nhầm thành công thức)', G.GUIDE_ROWS.flat().every(c => !/^[=+\-@]/.test(c)));
T('Tab Hướng xử trí: độ rộng A 110 · B 170 · C 470 · D 260', JSON.stringify(G.GUIDE_WIDTHS) === '[110,170,470,260]');
T('Tab Hướng xử trí: mỗi ô < 50 000 ký tự (dài nhất ' + Math.max(...G.GUIDE_ROWS.flat().map(c => c.length)) + ')', G.GUIDE_ROWS.flat().every(c => c.length < 50000));
const README = fs.readFileSync(path.join(APP, 'README.md'), 'utf8');
T('README: ghi tên menu mới, không còn tên cũ, có nhắc tab Hướng xử trí (bản nháp) và cột Gợi ý mở đầu (G / E)',
  README.includes('"' + G.MENU_ITEM + '"') && !README.includes('Cài tô màu + Tổng hợp + Tra cứu') && /tab \*\*Hướng xử trí\*\*/.test(README) && /bản nháp dùng thử 03\/11\/2026/.test(README) && /Gợi ý mở đầu\*\* \(Tổng hợp cột G, Tra cứu cột E/.test(README));
T('Tên menu đúng spec', G.MENU_ITEM === 'Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)' && G.GUIDE_SHEET === 'Hướng xử trí');

/* ===== 2. Bảng quyết định: lấy từ spec ===== */
const tbl = spec.split('## Cột "Gợi ý mở đầu" – bảng quyết định')[1].split('## Tab')[0];
const tRows = tbl.split('\n').filter(l => /^\| (1–3|4–5|6–10|khác) \|/.test(l)).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
T('Spec: bảng quyết định có 11 dòng', tRows.length === 11, tRows.length);
const specTexts = tRows.map(r => r[2]).filter(t => t !== '(trống)');
const codeTexts = [].concat(...['red', 'yellow', 'green'].map(k => Object.values(G.OPENER_TEXTS[k])));
T('OPENER_TEXTS: đúng 10 câu, từng câu trùng NGUYÊN VĂN một dòng của bảng spec', codeTexts.length === 10 && specTexts.length === 10 && JSON.stringify(codeTexts.slice().sort()) === JSON.stringify(specTexts.slice().sort()),
  codeTexts.filter(t => !specTexts.includes(t)).concat(specTexts.filter(t => !codeTexts.includes(t))).join(' | '));
/* Nhóm thẻ lấy từ spec (dòng "- **Dễ chịu:** Vui vẻ, Bình an") */
const grpSpec = {};
spec.split('\n').forEach(l => {
  const m = /^- \*\*(Dễ chịu|Làm dịu trước|Đau khổ|Kết nối, nâng đỡ):\*\* (.*)$/.exec(l);
  if (m) grpSpec[m[1]] = m[2].replace(/\(.*?\)/g, '').split(',').map(s => s.trim()).filter(Boolean);
});
const groupOf = {};
Object.keys(grpSpec).forEach(g => grpSpec[g].forEach(c => { groupOf[c] = g; }));
T('Spec: 4 nhóm, 10 nhãn (9 + "Buồn")', Object.keys(groupOf).length === 10 && groupOf['Buồn'] === 'Kết nối, nâng đỡ', JSON.stringify(grpSpec));
const codeGroupName = { deChiu: 'Dễ chịu', lamDiu: 'Làm dịu trước', dauKho: 'Đau khổ', ketNoi: 'Kết nối, nâng đỡ' };
T('CARD_GROUPS khớp nhóm của spec (từng nhãn, đúng nhóm)', G.CARD_GROUPS.every(g => g.cards.every(c => groupOf[c] === codeGroupName[g.key])) && G.CARD_GROUPS.reduce((n, g) => n + g.cards.length, 0) === 10,
  JSON.stringify(G.CARD_GROUPS));
/* Hàm "đáp án" dựng từ BẢNG SPEC (chữ ở cột 3), không từ code */
const pick = (band, pred) => { const r = tRows.find(x => x[0] === band && pred(x[1])); return r ? r[2] : null; };
function expected(levelCell, card) {
  const m = /^\d+/.exec(String(levelCell)); const n = m ? Number(m[0]) : NaN;
  const g = groupOf[String(card).trim().replace(/ {2,}/g, ' ')] || 'khác';
  if (n >= 1 && n <= 3) return pick('1–3', t => t === g || (g === 'khác' && t === 'khác'));
  if (n >= 4 && n <= 5) return pick('4–5', t => (g === 'Làm dịu trước' && t === 'Làm dịu trước') || ((g === 'Đau khổ' || g === 'Kết nối, nâng đỡ') && t === 'Đau khổ hoặc Kết nối, nâng đỡ') || ((g === 'Dễ chịu' || g === 'khác') && t === 'Dễ chịu hoặc khác'));
  if (n >= 6 && n <= 10) return pick('6–10', t => ((g === 'Dễ chịu' || g === 'khác') ? t === 'Dễ chịu hoặc khác' : t === 'còn lại'));
  return '';
}

/* ===== 3. Bộ đánh giá công thức riêng (một dòng), chế độ en hoặc vi nghiêm ===== */
function evalF(formula, cells, mode) {
  const SEP = mode === 'vi' ? ';' : ',';
  const s = String(formula).replace(/^=/, '');
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const fail = msg => { throw new Error('cú pháp (' + mode + ') ở ' + i + ': ' + msg + ' «' + s.slice(i, i + 25) + '»'); };
  /* Tách ký hiệu */
  const toks = [];
  while (i < s.length) {
    ws(); if (i >= s.length) break;
    const ch = s[i];
    if (ch === '"') { let j = i + 1, v = ''; for (;;) { if (j >= s.length) fail('chuỗi không đóng'); if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += s[j++]; } toks.push(['str', v]); i = j + 1; continue; }
    let m;
    if ((m = /^\d+/.exec(s.slice(i)))) { toks.push(['num', +m[0]]); i += m[0].length; if (s[i] === '.' || (mode === 'vi' && s[i] === ',' && /\d/.test(s[i + 1]))) fail('số thập phân không có trong công thức này'); continue; }
    if ((m = /^[A-Za-z_][A-Za-z0-9_]*(:[A-Z]+)?/.exec(s.slice(i)))) { toks.push(['id', m[0]]); i += m[0].length; continue; }
    if ((m = /^(>=|<=|<>|[()=<>+\-*\/&,;{}\\])/.exec(s.slice(i)))) { toks.push(['op', m[0]]); i += m[0].length; continue; }
    fail('ký tự lạ');
  }
  toks.forEach(t => { if (t[0] === 'op' && (t[1] === '{' || t[1] === '}' || t[1] === '\\')) throw new Error('công thức Gợi ý không nên có mảng {}'); });
  toks.forEach(t => { if (t[0] === 'op' && (t[1] === ',' || t[1] === ';') && t[1] !== SEP) throw new Error('cú pháp (' + mode + '): dấu "' + t[1] + '" ngoài chuỗi'); });
  let k = 0;
  const pk = () => toks[k], nx = () => toks[k++];
  const need = v => { const t = nx(); if (!t || t[1] !== v) throw new Error('cần ' + v); };
  const P = {};
  const lvl = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/']];
  const parse = d => {
    if (d === lvl.length) return P.atom();
    let l = parse(d + 1);
    while (pk() && pk()[0] === 'op' && lvl[d].includes(pk()[1])) { const o = nx()[1]; l = { o, l, r: parse(d + 1) }; }
    return l;
  };
  P.atom = () => {
    const t = nx(); if (!t) throw new Error('hết công thức');
    if (t[0] === 'str' || t[0] === 'num') return { v: t[1] };
    if (t[1] === '(') { const e = parse(0); need(')'); return e; }
    if (t[0] === 'id') {
      if (pk() && pk()[1] === '(') { nx(); const a = []; if (pk()[1] !== ')') { a.push(parse(0)); while (pk() && pk()[1] === SEP) { nx(); a.push(parse(0)); } } need(')'); return { f: t[1], a }; }
      return { ref: t[1] };
    }
    throw new Error('ký hiệu lạ ' + t[1]);
  };
  const tree = parse(0);
  if (k !== toks.length) throw new Error('thừa ký hiệu');
  const E = { e: 1 };
  const N = v => { if (v === E) throw E; if (v === true) return 1; if (v === false || v === '') return 0; if (typeof v === 'number') return v; throw E; };
  const S = v => { if (v === E) throw E; return v === true ? 'TRUE' : v === false ? 'FALSE' : String(v); };
  const B = v => { if (typeof v === 'string' && v !== '') throw E; return N(v) !== 0; };
  const used = new Set();
  const ev = (n, env) => {
    if ('v' in n) return n.v;
    if (n.ref) { if (n.ref in env) return env[n.ref]; if (n.ref in cells) return cells[n.ref]; throw new Error('tham chiếu lạ ' + n.ref); }
    if (n.o) {
      const a = ev(n.l, env), b = ev(n.r, env);
      if (n.o === '&') return S(a) + S(b);
      if ('+-*/'.includes(n.o)) { const x = N(a), y = N(b); return n.o === '+' ? x + y : n.o === '-' ? x - y : n.o === '*' ? x * y : x / y; }
      const c = typeof a === 'number' && typeof b === 'number' ? a - b : S(a).localeCompare(S(b));
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[n.o];
    }
    used.add(n.f);
    const A = n.a, x = j => ev(A[j], env);
    switch (n.f) {
      case 'LET': {
        const e2 = Object.assign({}, env);
        for (let j = 0; j < A.length - 1; j += 2) {
          if (!A[j].ref || /^[A-Z]{1,3}\d+$/i.test(A[j].ref) || /^R\d*C\d*$/i.test(A[j].ref)) throw new Error('tên LET giống địa chỉ ô: ' + A[j].ref);
          try { e2[A[j].ref] = ev(A[j + 1], e2); } catch (z) { if (z === E) e2[A[j].ref] = E; else throw z; }
        }
        return ev(A[A.length - 1], e2);
      }
      case 'ARRAYFORMULA': return x(0);
      case 'IFERROR': { try { const v = x(0); if (v === E) throw E; return v; } catch (z) { if (z === E) return x(1); throw z; } }
      case 'IF': return B(x(0)) ? x(1) : (A.length > 2 ? x(2) : false);
      case 'VALUE': { const v = x(0); if (typeof v === 'number') return v; if (/^\s*\d+\s*$/.test(S(v))) return Number(S(v)); throw E; }
      case 'TO_TEXT': return S(x(0));
      case 'TRIM': return S(x(0)).replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');   // Sheets TRIM: chỉ dấu cách thường
      case 'REGEXEXTRACT': { const m = new RegExp(S(x(1)), 'u').exec(S(x(0))); if (!m) throw E; return m[0]; }
      case 'REGEXMATCH': return new RegExp(S(x(1)), 'u').test(S(x(0)));
      default: throw new Error('hàm chưa hỗ trợ ' + n.f);
    }
  };
  const out = ev(tree, {});
  return { out, used: [...used] };
}

const fOpen = (lv, cv, sep) => sb.fx_(sb.openerFormula_(lv, cv), sep);
const fSumEn = fOpen('C2:C', 'D2:D', ','), fSumVi = fOpen('C2:C', 'D2:D', ';');
const fLkEn = fOpen('B6:B', 'C6:C', ','), fLkVi = fOpen('B6:B', 'C6:C', ';');
const run = (f, mode, lvRef, cRef, lv, card) => { try { return evalF(f, { [lvRef]: lv, [cRef]: card }, mode).out; } catch (e) { return 'LỖI ' + (e.message || 'giá trị'); } };

/* Mẫu: 10 mức doPost ghi + 6 nhãn cũ + 9 nhãn mới + dòng lạ */
const levelCells = G.LEVEL_TEXTS.slice(1).map((t, j) => (j + 1) + ' - ' + t);
const levels = levelCells.concat(['', 'Tốt', '0 - x', '11 - x', '7', 7, 3, '  ', 'abc', '-2 - x', '10', '100 - x', '05 - Bình thường (Ổn)']);
const cards = G.EMOTION_LABELS.concat(['Buồn', '', ' ', 'Bình yên', 'Tủi thân, cô đơn', 'Hạnh phúc', '  Lo lắng ', 'Cô  đơn', 'LO LẮNG', 'vui vẻ', 'Lo lắng.', 'Lo lắngx', 'xLo lắng', 'Vui vẻ|Bình an', 7]);
const grid = [];
levels.forEach(lv => cards.forEach(c => grid.push([lv, c])));
const checkGrid = (f, mode, lr, cr) => grid.filter(([lv, c]) => run(f, mode, lr, cr, lv, c) !== expected(lv, c));
[['Tổng hợp G2 (en)', fSumEn, 'en', 'C2:C', 'D2:D'], ['Tổng hợp G2 (vi_VN)', fSumVi, 'vi', 'C2:C', 'D2:D'], ['Tra cứu E6 (en)', fLkEn, 'en', 'B6:B', 'C6:C'], ['Tra cứu E6 (vi_VN)', fLkVi, 'vi', 'B6:B', 'C6:C']].forEach(([name, f, mode, lr, cr]) => {
  const bad = checkGrid(f, mode, lr, cr);
  T(name + ': quét ' + grid.length + ' cặp mức × thẻ (bộ đánh giá QA, đáp án từ bảng spec) – khớp hết, không ô lỗi', bad.length === 0, bad.slice(0, 4).map(([lv, c]) => JSON.stringify([lv, c]) + '→' + run(f, mode, lr, cr, lv, c) + ' cần ' + expected(lv, c)).join(' | '));
});
/* 11 dòng spec, mỗi dòng ít nhất một mẫu */
const sample11 = [['2 - Rất tồi tệ', 'Bình an'], ['1 - Tuyệt vọng', 'Đau khổ'], ['3 - Tồi tệ', 'Khó chịu'], ['1 - Tuyệt vọng', 'Buồn'], ['3 - Tồi tệ', 'Tủi thân, cô đơn'],
  ['5 - Bình thường (Ổn)', 'Tức giận'], ['4 - Kém', 'Đau khổ'], ['4 - Kém', 'Vui vẻ'], ['6 - Khá', ''], ['9 - Tuyệt vời', 'Hoảng hốt'], ['abc', 'Lo lắng']];
const got11 = sample11.map(([lv, c]) => run(fSumVi, 'vi', 'C2:C', 'D2:D', lv, c));
T('11 dòng bảng quyết định: mỗi dòng một mẫu cho ra đúng 11 kết quả khác nhau theo spec (vi_VN)', JSON.stringify(got11) === JSON.stringify(tRows.map(r => r[2] === '(trống)' ? '' : r[2])), got11.join(' | '));
T('Thẻ có hoa/thường khác ("LO LẮNG", "vui vẻ") coi như thẻ khác (so khớp phân biệt hoa thường như spec "nguyên chuỗi")',
  run(fSumVi, 'vi', 'C2:C', 'D2:D', '2 - Rất tồi tệ', 'LO LẮNG') === expected('2 - Rất tồi tệ', 'Hạnh phúc') && run(fSumVi, 'vi', 'C2:C', 'D2:D', '2 - Rất tồi tệ', 'vui vẻ') === expected('2 - Rất tồi tệ', 'x'));
T('Chữ đầu ô khớp màu tô (cùng ngưỡng ALERT_BANDS): 10 mức × mọi thẻ', levelCells.every((lv, j) => cards.every(c => run(fSumVi, 'vi', 'C2:C', 'D2:D', lv, c).startsWith(j < 3 ? 'ĐỎ · ' : j < 5 ? 'VÀNG · ' : 'XANH · '))));

/* ===== 4. Cú pháp vi_VN, độ dài, hàm dùng ===== */
const outside = f => f.replace(/"(?:[^"]|"")*"/g, '').replace(/'(?:[^']|'')*'/g, '');
T('vi_VN: G2/E6 không còn "," ngoài chuỗi, không "{ } \\" ngoài chuỗi, ngoặc cân', [fSumVi, fLkVi].every(f => !/[,{}\\]/.test(outside(f)) && outside(f).split('(').length === outside(f).split(')').length));
T('vi_VN: mọi ";" nằm trong ngoặc (là ngăn tham số, không phải ngăn hàng mảng)', [fSumVi, fLkVi].every(f => { let d = 0; for (const ch of outside(f)) { if (ch === '(') d++; else if (ch === ')') d--; else if (ch === ';' && d < 1) return false; if (d < 0) return false; } return d === 0; }));
T('en: G2/E6 không có ";" ngoài chuỗi', [fSumEn, fLkEn].every(f => !/;/.test(outside(f))));
T('fx_ giữ nguyên MỌI chuỗi "…" (16 chuỗi: 10 câu + 4 regex nhóm + regex số + "")',
  JSON.stringify(fSumVi.match(/"(?:[^"]|"")*"/g)) === JSON.stringify(fSumEn.match(/"(?:[^"]|"")*"/g)) && fSumEn.match(/"(?:[^"]|"")*"/g).length === 16);
const fns = evalF(fSumVi, { 'C2:C': '2 - Rất tồi tệ', 'D2:D': 'Vui vẻ' }, 'vi').used;
const fnsAll = [...new Set(outside(fSumEn).match(/[A-Z_]+(?=\()/g))];
T('Chỉ dùng hàm có trong Google Sheets: ' + fnsAll.join(', '), fnsAll.every(f => ['LET', 'ARRAYFORMULA', 'IFERROR', 'VALUE', 'REGEXEXTRACT', 'TO_TEXT', 'TRIM', 'IF', 'REGEXMATCH'].includes(f)) && fns.length > 0);
const lens = { G2en: fSumEn.length, G2vi: fSumVi.length, E6en: fLkEn.length, E6vi: fLkVi.length, A2: sb.summaryFormula_().length, A6: sb.lookupFormula_().length };
T('Độ dài công thức < 50 000 ký tự (Google): ' + JSON.stringify(lens), Object.values(lens).every(n => n < 50000));
T('Độ dài tính theo byte UTF-8 cũng < 50 000 (phòng Google đếm byte): G2 ' + Buffer.byteLength(fSumVi) + ' B', [fSumVi, fLkVi].every(f => Buffer.byteLength(f, 'utf8') < 50000));

/* ===== 5. Unicode: cùng một dạng (NFC) giữa nhãn doPost ghi, nhãn web gửi, regex trong công thức ===== */
const allStr = [].concat(G.GUIDE_ROWS.flat(), codeTexts, ...G.CARD_GROUPS.map(g => g.cards), G.EMOTION_LABELS, G.LEGACY_EMOTION_LABELS);
T('Mọi chữ của tab, câu gợi ý, nhãn thẻ đều là NFC (Unicode dựng sẵn)', allStr.every(s => s === s.normalize('NFC')), allStr.filter(s => s !== s.normalize('NFC')).join(' | '));
const webEmos = JSON.parse((/const EMOTIONS = (\[[^\]]+\])/.exec(fs.readFileSync(path.join(APP, 'script.js'), 'utf8'))[1]).replace(/'/g, '"'));
T('Nhãn web gửi (script.js EMOTIONS) trùng byte với EMOTION_LABELS doPost nhận', JSON.stringify(webEmos) === JSON.stringify(G.EMOTION_LABELS));
const rx = fSumVi.match(/"\^\((?:[^"])*\)\$"/g) || [];
T('4 regex nhóm trong công thức chứa đúng byte NFC của 10 nhãn', rx.length === 4 && G.CARD_GROUPS.every((g, j) => rx[j] === '"^(' + g.cards.join('|') + ')$"'), rx.join(' '));
T('Nhãn tổ hợp (NFD) KHÔNG có đường vào Sheet: doPost so khớp nguyên chuỗi với whitelist NFC', /EMOTION_LABELS\.indexOf\(emo\) < 0 && LEGACY_EMOTION_LABELS\.indexOf\(emo\) < 0\) return 'emotion_invalid'/.test(SRC) && !G.EMOTION_LABELS.includes('Lo lắng'.normalize('NFD')));
/* Mọi nhãn từng được Apps Script dự án mới nhận (lịch sử git) đều có nhóm */
let hist = [];
try {
  const commits = cp.execFileSync('git', ['log', '--format=%h', '--', 'google_apps_script.js'], { cwd: APP, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  commits.forEach(c => { const s = cp.execFileSync('git', ['show', c + ':google_apps_script.js'], { cwd: APP, encoding: 'utf8' }); const m = s.match(/var (?:LEGACY_)?EMOTION_LABELS = (\[[^\]]+\])/g) || []; m.forEach(x => { hist = hist.concat(JSON.parse(x.replace(/^.*?= /, '').replace(/'/g, '"').replace(/\s+/g, ' '))); }); });
} catch (e) { hist = null; }
hist = hist && [...new Set(hist)];
if (!hist) console.log('BỎ QUA kiểm nhãn lịch sử (không đọc được git)'); else T('Mọi nhãn Apps Script dự án mới từng nhận (git: ' + (hist ? hist.join(', ') : '?') + ') đều nằm trong một nhóm', !!hist && hist.length >= 10 && hist.every(h => G.CARD_GROUPS.some(g => g.cards.includes(h))));

/* ===== 6. git diff: chỉ đổi phần menu ===== */
const git = args => cp.execFileSync('git', args, { cwd: APP, encoding: 'utf8' });
let HEAD = null;
try { HEAD = git(["show", "HEAD:google_apps_script.js"]); } catch (e) { console.log("BỎ QUA phần git (máy không có git hoặc thư mục không phải repo)"); }
if (HEAD !== null) {
const fnBody = (src, name) => (new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src) || [''])[0];
['doPost', 'validateCheckin_', 'normalizePatientId_', 'ensureHeader_', 'findSessionRow_', 'sheet_', 'doGet', 'json_', 'summaryFormula_', 'lookupFormula_', 'letSource_', 'fx_', 'detectFormulaSep_', 'lockSheet_', 'ownTab_', 'applyAlertColors_', 'isOurRule_'].forEach(n => {
  T('git: hàm ' + n + ' không đổi so với HEAD', fnBody(HEAD, n) !== '' && fnBody(HEAD, n) === fnBody(SRC, n));
});
const pre = s => s.split('/* ===== Bảng cho bác sĩ')[0].replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
T('git: toàn bộ phần trước menu (hằng số, doPost, validate, cột CheckIn) không đổi một ký tự (trừ chú thích đầu file)', pre(HEAD) === pre(SRC));
const names = git(['diff', '--name-only', 'HEAD']).trim().split('\n').filter(Boolean);
T('git: chỉ google_apps_script.js, README.md và tests/ đổi; index.html, script.js, styles.css, ảnh không đổi', names.every(n => n === 'google_apps_script.js' || n === 'README.md' || /^tests\//.test(n)) && !names.some(n => /^(index\.html|script\.js|styles\.css)$|\.(png|jpg|mp3)$/.test(n)), names.join(', '));
const untracked = git(['ls-files', '--others', '--exclude-standard']).trim().split('\n').filter(Boolean);
T('git: không có file mới ngoài tests/', untracked.every(n => /^tests\//.test(n)), untracked.join(', '));

}
console.log('\n' + passes + ' PASS, ' + fails + ' FAIL (QA Hướng xử trí)');
process.exit(fails ? 1 : 0);
