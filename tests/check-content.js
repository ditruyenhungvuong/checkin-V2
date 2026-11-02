/* =========================================================
   Rà nội dung tĩnh app Check-in Cảm Xúc Mẹ Bầu (QA, Phần A).
   Đọc index.html / script.js / styles.css, liệt kê chuỗi hiển thị và đối chiếu
   style guide mục 2 (giọng "chị", không "bạn", không "hệ thống", không "Vui lòng", không alert),
   mục 3 (prefers-reduced-motion, ảnh lỗi thay emoji), mục 5b (dòng "không phải chẩn đoán").
   02/11/2026: 10 chấm bấm thay thanh trượt (không mức mặc định), 9 thẻ chỉ hình (3 thẻ mới chờ ảnh).
   01/11/2026: ô SĐT đổi thành Mã số bệnh nhân (chỉ chữ số, 3–20 số), bỏ câu giải thích dưới ô (anh Thông yêu cầu).
   Bản 28/10/2026: app đã sửa theo docs/qa/checkin-me-bau-tong-hop.md. Mục nào cố ý giữ nguyên vì
   CHỜ anh Thông quyết (mục 4 bản gộp) in dòng "CHỜ ANH", không tính là FAIL nhưng luôn hiện ra.
   Không sửa file app. Chạy: node tests/check-content.js   (FAIL → exit 1)
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const html = read('index.html');
const js = read('script.js');
const css = read('styles.css');

let fails = 0;
const out = [];
function T(name, ok, detail) {
  if (!ok) fails++;
  const line = (ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 300) : '');
  out.push(line); console.log(line);
}
let waits = 0;
/* Mục chờ anh quyết: đạt thì PASS, chưa đạt thì "CHỜ ANH" (không làm đỏ bộ test) */
function WAIT(name, ok, reason, detail) {
  if (ok) return T(name, true);
  waits++;
  const line = 'CHỜ ANH ' + name + '  → ' + reason + (detail !== undefined ? ' | ' + String(detail).replace(/\s+/g, ' ').slice(0, 200) : '');
  out.push(line); console.log(line);
}
function INFO(name, detail) { const line = 'INFO ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 400) : ''); out.push(line); console.log(line); }

/* ---- Trích chuỗi hiển thị ---- */
const htmlNoComment = html.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
/* Mã JS/CSS đã bỏ comment (giữ số dòng): kiểm "không dùng X" trên mã, không bắt chữ trong lời giải thích */
const stripCode = src => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/.*$/gm, '$1');
const jsCode = stripCode(js);
const cssCode = stripCode(css);
const lines = s => s.split('\n');
const findLines = (src, re) => lines(src).map((l, i) => ({ n: i + 1, l })).filter(x => re.test(x.l)).map(x => x.n + ': ' + x.l.trim());

/* HTML: text node, title, alt, placeholder, title attr */
const htmlStrings = [];
lines(htmlNoComment).forEach((l, i) => {
  const n = i + 1;
  const text = l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text) htmlStrings.push({ n, s: text, kind: 'text' });
  for (const m of l.matchAll(/\b(alt|placeholder|title)="([^"]*)"/g)) htmlStrings.push({ n, s: m[2], kind: m[1] });
});
/* JS: mọi chuỗi có khoảng trắng và chữ trên dòng không phải comment (hint, toast, nhãn, câu vỗ về…) */
const jsStrings = [];
lines(js).forEach((l, i) => {
  const n = i + 1;
  const code = l.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, '');
  if (/innerHTML|innerText|textContent|alert\(|confirm\(|toast\(|console\.(log|warn|error)|text:|^\s*\w+:\s*["'`]|^const [A-Z_]+ = ["'`]/.test(code)) {
    for (const m of code.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
      const s = m[1] || m[2] || m[3];
      if (s && /[A-Za-zÀ-ỹ]/.test(s)) jsStrings.push({ n, s, kind: 'js' });
    }
  }
});
const all = htmlStrings.map(x => Object.assign({ file: 'index.html' }, x)).concat(jsStrings.map(x => Object.assign({ file: 'script.js' }, x)));
INFO('Số chuỗi hiển thị trích được', htmlStrings.length + ' (index.html) + ' + jsStrings.length + ' (script.js)');

/* ---- Luật giọng viết (style guide mục 2, 5) ---- */
const hit = re => all.filter(x => re.test(x.s)).map(x => x.file + ':' + x.n + ' "' + x.s + '"');
let h;
h = hit(/\bbạn\b/i);
T('Giọng: không dùng "bạn" trong app gọi "chị"', h.length === 0, h.join(' | '));
h = hit(/hệ thống/i);
T('Giọng: không "hệ thống" (giọng máy)', h.length === 0, h.join(' | '));
h = hit(/vui lòng/i);
T('Giọng: không "Vui lòng" (giọng hành chính/lệnh)', h.length === 0, h.join(' | '));
h = hit(/người dùng/i);
T('Giọng: không "người dùng"', h.length === 0, h.join(' | '));
h = hit(/Thực hiện|Thông tin ghi nhận|hợp lệ|phản ánh|điền đủ thông tin/).filter(x => !/Thực hiện check-in khác/.test(x));
T('Giọng: không từ hành chính ("Thực hiện", "Thông tin ghi nhận", "hợp lệ", "phản ánh", "điền đủ thông tin")', h.length === 0, h.join(' | '));
WAIT('Giọng: nút "🌸 Thực hiện check-in khác" đổi chữ', !/Thực hiện check-in khác/.test(htmlNoComment), 'mục 4.10: chờ anh cho biết máy dùng chung hay điện thoại riêng');
h = hit(/\.\.\./);
T('Chính tả: dùng dấu "…" thay ba chấm "..."', h.length === 0, h.join(' | '));
h = findLines(js, /\balert\(|\bconfirm\(/);
T('Không dùng alert()/confirm() (style guide: toast thay alert)', h.length === 0, h.join(' | '));
h = all.filter(x => x.kind === 'text' && /[❤️💡✨🌸🔐🔄🎵🆔🌱🐾]/.test(x.s) && /[.!?]\s*$/.test(x.s) && !/^[^\p{L}]*$/u.test(x.s) && !/^(💡|✨)/.test(x.s)).map(x => x.file + ':' + x.n + ' "' + x.s + '"');
INFO('Emoji trong câu văn (guide: emoji chỉ ở nút/tiêu đề)', h.join(' | ') || 'không có');

/* ---- Nhãn mức cảm xúc ---- */
const levels = {};
for (const m of js.matchAll(/^\s*(\d+):\s*\{\s*text:\s*"([^"]*)"/mg)) levels[m[1]] = m[2];
INFO('Bảng 10 mức (script.js)', Object.entries(levels).map(([k, v]) => k + '=' + v).join(', '));
const legend = [...htmlNoComment.matchAll(/<span>(\d+) \(([^)]*)\)<\/span>/g)].map(m => [m[1], m[2]]);
T('Chú thích hai đầu dãy chấm khớp mức 1 và 10 của bảng', legend.length === 2 && legend[0][1] === levels['1'] && legend[1][1] === levels['10'], JSON.stringify(legend));
/* 10 chấm bấm (02/11/2026) */
const dots = [...htmlNoComment.matchAll(/<button ([^>]*class="level-dot"[^>]*)>(\d+)<\/button>/g)].map(m => ({ a: m[1], txt: m[2], n: (m[1].match(/data-level="(\d+)"/) || [])[1], label: (m[1].match(/aria-label="([^"]*)"/) || [])[1] }));
T('Mức: không còn thanh trượt (input range)', !/type="range"|emotion-range|styled-range/.test(htmlNoComment + cssCode + jsCode), findLines(htmlNoComment + cssCode + jsCode, /type="range"|emotion-range|styled-range/).join(' | '));
T('Mức: 10 chấm 1–10 là <button type="button" role="radio" aria-checked="false" data-act="level">, chữ = số mức', dots.length === 10 && dots.every((d, i) => d.n === String(i + 1) && d.txt === d.n && /type="button"/.test(d.a) && /role="radio"/.test(d.a) && /aria-checked="false"/.test(d.a) && /data-act="level"/.test(d.a)), JSON.stringify(dots.map(d => d.n)));
T('Mức: nhãn đọc được "Mức 7, Tốt" khớp bảng 10 mức', dots.length === 10 && dots.every(d => d.label === 'Mức ' + d.n + ', ' + levels[d.n]), dots.map(d => d.label).join(' | '));
T('Mức: nhóm role="radiogroup" gắn tiêu đề Phần 1, mô tả bằng câu nhắc #level-error', /id="level-dots" class="level-dots" role="radiogroup" aria-labelledby="part1-title" aria-describedby="level-error"/.test(htmlNoComment));
T('Mức: roving tabindex – lúc mở chỉ chấm 1 nhận Tab (tabindex 0), 9 chấm còn lại -1', dots.length === 10 && dots.filter(d => /tabindex="0"/.test(d.a)).map(d => d.n).join() === '1' && dots.filter(d => /tabindex="-1"/.test(d.a)).length === 9);
T('Mức: KHÔNG có giá trị mặc định – part1_score 0, part1_text rỗng, chữ trạng thái trống, không chấm nào aria-checked="true"', /part1_score: 0,/.test(js) && /part1_text: '',/.test(js) && /<div id="current-status" class="emotion-status"><\/div>/.test(htmlNoComment) && !/aria-checked="true"/.test(htmlNoComment) && !/<img id="current-capy"[^>]*src=/.test(htmlNoComment));
T('Mức: phím mũi tên/Home/End/Space đổi lựa chọn (keydown trên nhóm, preventDefault)', /addEventListener\('keydown', onLevelKey\)/.test(jsCode) && /ArrowRight/.test(jsCode) && /ArrowLeft/.test(jsCode) && /ArrowUp/.test(jsCode) && /ArrowDown/.test(jsCode) && /e\.preventDefault\(\)/.test(jsCode));
const dotCss = Object.fromEntries([...css.matchAll(/\.level-dot\[data-level="(\d+)"\]\s*\{\s*background:\s*(#[0-9a-f]{6});/gi)].map(m => [m[1], m[2].toLowerCase()]));
const dotMism = Object.entries(levels).filter(([k]) => { const c = ((js.match(new RegExp('^\\s*' + k + ':\\s*\\{[^}]*color:\\s*"(#[0-9a-f]{6})"', 'im')) || [])[1] || '').toLowerCase(); return dotCss[k] !== c; });
T('Mức: màu nền 10 chấm trong CSS trùng màu mức trong script.js', Object.keys(dotCss).length === 10 && dotMism.length === 0, dotMism.map(x => x[0]).join(','));
const lvErr = (js.match(/const LEVEL_ERROR = "([^"]*)";/) || [])[1] || '';
T('Mức: câu nhắc khi chưa chọn mức giọng "chị", kết "nhé", ngắn', /^Chị /.test(lvErr) && /nhé\.$/.test(lvErr) && lvErr.length <= 60, lvErr);
WAIT('Mức: chữ mới (hint Phần 1, câu nhắc chưa chọn mức, hint "all"/"level", dòng "Chị chọn: …") đã qua giọng anh', false, 'đội viết 02/11/2026, chờ anh duyệt', [lvErr, (htmlNoComment.match(/<p class="section-hint">(Chạm vào một chấm[^<]*)<\/p>/) || [])[1]].join(' | '));
const heavy = Object.entries(levels).filter(([k, v]) => /tuyệt vọng|tồi tệ|kém/i.test(v));
WAIT('Nhãn mức 1–4 không nặng nề/chấm điểm ("Tuyệt vọng", "Tồi tệ", "Kém")', heavy.length === 0, 'mục 4.4: giữ nguyên chữ, chờ anh chọn phương án QA hay UX', heavy.map(x => x.join('=')).join(', '));
const levelColors = [...js.matchAll(/^\s*(\d+):\s*\{[^}]*color:\s*"(#[0-9a-f]{6})"/gim)].map(m => [m[1], m[2]]);
const redColors = levelColors.map(x => x[1]).filter(c => /^#(b71c1c|e53935|d32f2f|c62828|f44336)$/i.test(c));
T('Biến thể Hồng ấm: không dùng đỏ cho chữ trạng thái', levelColors.length === 10 && redColors.length === 0, redColors.join(','));
/* Tương phản WCAG: chữ trạng thái 20px đậm, đòi 4,5:1 để chắc (nền card gần trắng, đo cả nền hồng nhạt nhất #fff5f8) */
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const lowC = levelColors.map(([k, c]) => [k, c, Math.min(ratio(c, '#ffffff'), ratio(c, '#fff5f8'))]).filter(x => x[2] < 4.5);
T('Tương phản: 10 màu chữ mức đều ≥ 4,5:1 trên nền trắng và #fff5f8', levelColors.length === 10 && lowC.length === 0, lowC.map(x => x[0] + '=' + x[1] + ' ' + x[2].toFixed(2)).join(', '));
const dotText = (css.match(/\.level-dot\s*\{[^}]*?\bcolor:\s*(#[0-9a-f]{6})/i) || [])[1] || '';
const lowDot = levelColors.filter(([, c]) => !dotText || ratio(dotText, c) < 4.5);
T('Tương phản: chữ số trên 10 chấm (' + dotText + ') ≥ 4,5:1 trên nền màu mức', dotText && lowDot.length === 0, lowDot.map(x => x[0] + ' ' + ratio(dotText || '#000000', x[1]).toFixed(2)).join(', '));
INFO('Tương phản 10 mức', levelColors.map(([k, c]) => k + ':' + ratio(c, '#ffffff').toFixed(1)).join(' '));
const cssColor = (sel, prop) => { const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*?' + prop + ':\\s*([^;]+);')); return m ? m[1].trim() : ''; };
const statusCss = cssColor('.emotion-status', 'color');
T('Tương phản: màu mặc định .emotion-status trong CSS khớp mức 5 và ≥ 4,5:1', /^#[0-9a-f]{6}$/i.test(statusCss) && ratio(statusCss, '#ffffff') >= 4.5, statusCss);
const ph = (css.match(/::placeholder\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i) || [])[1] || '';
T('Tương phản: placeholder ≥ 4,5:1 trên nền ô #fffafa', ph && ratio(ph, '#fffafa') >= 4.5, ph + ' ' + (ph ? ratio(ph, '#fffafa').toFixed(2) : ''));
T('Tương phản: hint tiến độ dùng --ink-soft (không còn #9c7b88)', !/#9c7b88/i.test(cssCode + jsCode), findLines(cssCode + jsCode, /#9c7b88/i).join(' | '));

/* ---- 9 thẻ cảm xúc (02/11/2026: chỉ hình, chữ ở aria-label) ---- */
const cardBlocks = [...htmlNoComment.matchAll(/<(\w+) ([^>]*class="capy-card"[^>]*)>([\s\S]*?)<\/button>/g)];
const cards = cardBlocks.map(m => ({ tag: m[1], attrs: m[2], body: m[3], data: (m[2].match(/data-emotion="([^"]*)"/) || [])[1], label: (m[2].match(/aria-label="([^"]*)"/) || [])[1], img: (m[3].match(/<img src="([^"]*)"/) || [])[1] || '', alt: (m[3].match(/<img [^>]*alt="([^"]*)"/) || [])[1], pending: /pending-img/.test(m[3]), emoji: (m[3].match(/data-emoji="([^"]*)"/) || [])[1] }));
INFO('9 thẻ', cards.map(c => c.data + '→' + (c.img || 'CHỜ ẢNH ' + c.emoji)).join(', '));
const NINE = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];
T('Thẻ: đúng 9 thẻ theo thứ tự anh duyệt, aria-label = data-emotion', cards.length === 9 && JSON.stringify(cards.map(c => c.data)) === JSON.stringify(NINE) && cards.every(c => c.label === c.data), JSON.stringify(cards.map(c => c.data + '/' + c.label)));
T('Thẻ: chỉ hình – không còn chữ tên trên thẻ (.capy-name), không text node trong thẻ ngoài dấu ✓', !/capy-name/.test(htmlNoComment + cssCode + jsCode) && cards.every(c => c.body.replace(/<[^>]+>/g, '').replace(/[\s✓]/g, '') === ''), cards.filter(c => c.body.replace(/<[^>]+>/g, '').replace(/[\s✓]/g, '')).map(c => c.data).join(','));
T('Bàn phím: 9 thẻ là <button type="button"> có aria-pressed, data-act="pick" (không div onclick)', cards.length === 9 && cards.every(c => c.tag === 'button' && /type="button"/.test(c.attrs) && /aria-pressed="false"/.test(c.attrs) && /data-act="pick"/.test(c.attrs)), JSON.stringify(cards.map(c => c.tag)));
T('Thẻ: ảnh trang trí alt="" (tên đọc từ aria-label, không đọc lặp)', cards.filter(c => c.img).every(c => c.alt === ''), cards.map(c => c.alt).join('|'));
T('Thẻ: lưới có role="group" gắn tiêu đề Phần 2', /class="emotion-grid" role="group" aria-labelledby="part2-title"/.test(htmlNoComment));
T('Thẻ: lưới 3 cột cả trên điện thoại (3×3)', /\.emotion-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/.test(cssCode) && !/@media \(max-width: 440px\)\s*\{\s*\.emotion-grid\s*\{[^}]*grid-template-columns/.test(cssCode));
T('Thẻ: chọn thẻ thì hiện dòng chữ nhỏ dưới lưới "Chị chọn: <cảm xúc>" (textContent)', /<p id="emotion-picked" class="emotion-picked"><\/p>/.test(htmlNoComment) && /const PICKED_PREFIX = "Chị chọn: ";/.test(js) && /el\.textContent = currentCheckin\.part2_capybara \? PICKED_PREFIX \+ currentCheckin\.part2_capybara/.test(js));
const EMO_JS = [...((js.match(/const EMOTIONS = \[([^\]]*)\]/) || [])[1] || '').matchAll(/'([^']*)'/g)].map(m => m[1]);
T('Thẻ: 9 tên trùng danh sách EMOTIONS trong script.js', JSON.stringify(EMO_JS) === JSON.stringify(cards.map(c => c.data)), EMO_JS.join(' | '));
/* 02/11/2026: bộ 9 ảnh mới của anh (PNG 480×480 nền trong suốt, tên file không dấu) cho CẢ 9 thẻ */
const IMG = { 'Vui vẻ': 'vui_ve.png', 'Đau khổ': 'dau_kho.png', 'Lo lắng': 'lo_lang.png', 'Tức giận': 'tuc_gian.png', 'Hoảng hốt': 'hoang_hot.png', 'Khó chịu': 'kho_chiu.png', 'Mệt mỏi': 'met_moi.png', 'Bình an': 'binh_an.png', 'Cô đơn': 'co_don.png' };
const imgMism = cards.filter(c => IMG[c.data] !== c.img).map(c => c.data + ' dùng "' + c.img + '"');
T('Thẻ: cả 9 thẻ dùng ảnh mới đúng tên (vui_ve.png … co_don.png), không còn emoji giữ chỗ / ảnh .jpg cũ', cards.length === 9 && imgMism.length === 0 && !cards.some(c => c.pending) && !/pending-img|CHỜ ẢNH|\.jpg"/.test(htmlNoComment.replace(/capy-level-\d\d\.png/g, '')), imgMism.join(', '));
const sizes = Object.values(IMG).map(f => [f, fs.existsSync(path.join(APP, f)) ? fs.statSync(path.join(APP, f)).size : -1]);
INFO('Dung lượng 9 ảnh thẻ', sizes.map(([f, n]) => f + ' ' + (n / 1024).toFixed(1) + ' KB').join(', '));
T('Ảnh thẻ: đủ 9 file trong thư mục app, mỗi file ≤ 150 KB', sizes.every(([, n]) => n > 0 && n <= 150 * 1024), sizes.filter(([, n]) => n <= 0 || n > 150 * 1024).map(x => x.join(' ')).join(', '));
const pngDim = f => { const b = fs.readFileSync(path.join(APP, f)); return b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20), b[25]] : null; };
const dims = Object.values(IMG).map(f => [f, fs.existsSync(path.join(APP, f)) ? pngDim(f) : null]);
T('Ảnh thẻ: PNG vuông 480×480, có kênh trong suốt (bảng màu có tRNS hoặc RGBA)', dims.every(([f, d]) => d && d[0] === 480 && d[1] === 480 && (d[2] === 6 || (d[2] === 3 && fs.readFileSync(path.join(APP, f)).includes('tRNS')))), JSON.stringify(dims));
T('Ảnh thẻ: <img> có width/height 480 (không nhảy bố cục khi ảnh tải), alt="" (tên đọc từ aria-label)', cards.every(c => /width="480" height="480"/.test(c.body) && c.alt === ''));

/* ---- Đợt sửa 2 (02/11/2026) ---- */
T('Xáo 9 thẻ mỗi lượt mới: Fisher–Yates + crypto.getRandomValues (dự phòng Math.random), gọi lúc mở trang và lúc làm lại', /function shuffleCards\(\)/.test(jsCode) && /for \(let i = cards\.length - 1; i > 0; i--\)/.test(jsCode) && /crypto\.getRandomValues\(buf\)/.test(jsCode) && /Math\.random\(\)/.test(jsCode) && (jsCode.match(/shuffleCards\(\);/g) || []).length === 2);
T('Xáo thẻ: dời chính các nút trong DOM (appendChild) – thứ tự Tab = thứ tự nhìn; không dùng CSS order', /cards\.forEach\(card => grid\.appendChild\(card\)\)/.test(jsCode) && !/\border\s*:/.test(cssCode) && !/style\.order/.test(jsCode));
T('Xáo thẻ: KHÔNG lưu thứ tự vào máy, KHÔNG xáo 10 chấm', !/setItem\([^)]*(order|thuTu|shuffle)/i.test(jsCode) && !/querySelectorAll\('\.level-dot'\)[\s\S]{0,80}appendChild/.test(jsCode));
T('Máy chủ trả emotion_invalid (Apps Script còn bản cũ) → GIỮ lượt trong hàng chờ (ném lỗi để gửi lại)', /if \(data && data\.error === 'emotion_invalid'\) throw new Error/.test(jsCode));
T('B-03: mã sai + chưa chọn mức → nhắc cả câu cạnh 10 chấm, focus vẫn ô mã số', /toast\(ID_ERROR\);\s*\/\/[^\n]*\n\s*if \(!emotionLevels\[currentCheckin\.part1_score\]\) showLevelError\(true\);\s*if \(idInput\) idInput\.focus\(\);/.test(js));
T('G-01: hai số bước của Phần 1, Phần 2 có aria-hidden (tên nhóm không đọc thành "1 Hôm nay…")', /<span class="step-num" aria-hidden="true">1<\/span>/.test(htmlNoComment) && /<span class="step-num" aria-hidden="true">2<\/span>/.test(htmlNoComment) && !/<span class="step-num">\d/.test(htmlNoComment));
T('G-05: nút Hoàn thành sẵn sàng có cursor: pointer', /\.btn-submit\.ready\s*\{[^}]*cursor:\s*pointer/.test(cssCode));

/* ---- Hint tiến độ ---- */
const hintHtml = (htmlNoComment.match(/id="submit-hint"[^>]*>\s*([^<]*?)\s*<\/p>/) || [])[1];
const hintBlock = (js.match(/const HINTS = \{([\s\S]*?)\};/) || [])[1] || '';
const hints = Object.fromEntries([...hintBlock.matchAll(/(\w+):\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
const hintsJs = Object.values(hints);
INFO('Hint các trạng thái (script.js HINTS)', hintsJs.join(' || '));
T('Hint ban đầu trong HTML trùng hint "chưa có gì" (all) của JS', hintHtml === hints.all, hintHtml + ' <> ' + hints.all);
T('6 hint (chưa có gì, thiếu mã số, mã số sai, thiếu mức, thiếu thẻ, đủ) phân biệt nhau', hintsJs.length === 6 && new Set(hintsJs).size === 6 && ['all', 'id', 'idBad', 'level', 'card', 'done'].every(k => k in hints), Object.keys(hints).join(','));
T('Nút Hoàn thành: chưa đủ thì aria-disabled (vẫn chạm được để được nhắc), không dùng disabled lúc mở trang', /id="btn-submit"[^>]*aria-disabled="true"/.test(htmlNoComment) && !/id="btn-submit"[^>]*\sdisabled[\s>]/.test(htmlNoComment) && /setAttribute\('aria-disabled', ready \? 'false' : 'true'\)/.test(jsCode) && !/\.btn-submit\s*\{[^}]*pointer-events:\s*none/.test(cssCode));
T('Hint đều có xưng "chị"', hintsJs.every(s => /chị/i.test(s)), hintsJs.filter(s => !/chị/i.test(s)).join(' | '));
T('Hint đặt bằng textContent, trạng thái "đủ" bằng class (không inline style)', /hintEl\.textContent = HINTS\./.test(js) && !/hintEl\.(innerHTML|style)/.test(js));

/* ---- Nút & chữ nút ---- */
const btnTexts = [...js.matchAll(/const BTN_\w+ = "([^"]*)"/g)].map(m => m[1]).concat([(htmlNoComment.match(/id="btn-submit"[^>]*>\s*([^<]*?)\s*<\/button>/) || [])[1]]);
INFO('Chữ nút hoàn thành', btnTexts.join(' | '));
T('Viết hoa "Check-in" nhất quán trên nút', new Set(btnTexts.map(s => (s.match(/check-in/i) || [''])[0])).size <= 1, btnTexts.join(' | '));
WAIT('Tiêu đề h1 không viết hoa mọi chữ (Title Case) – guide chỉ viết hoa cụm cốt lõi', !/<h1 class="main-title">([A-ZÀ-Ỹ][^\s<]*\s){3,}/.test(htmlNoComment), 'mục 4.9: giữ "Check-in Cảm Xúc Hôm Nay" (nét riêng của anh) cho tới khi anh quyết', (htmlNoComment.match(/<h1 class="main-title">([^<]*)/) || [])[1]);

/* ---- Trang cảm ơn ---- */
const successTitle = (htmlNoComment.match(/class="success-title"[^>]*>([^<]*)</) || [])[1];
T('Trang cảm ơn: tiêu đề gọi "chị", không "bạn"', /chị/.test(successTitle) && !/bạn/.test(successTitle), successTitle);
T('Trang cảm ơn: tóm tắt che mã số (maskPatientId), không hiện mã đầy đủ (guide mục 6)', /maskPatientId\(info\.patientId\)/.test(js) && !/\$\{payload\.patientId\}/.test(js), findLines(js, /Mã số bệnh nhân: /).join(' | '));
T('Trang cảm ơn: lời chúc không ép tích cực chung cho mọi mức (có nhánh cho mức thấp)', /level\s*<=?\s*3/.test(js) && /QUOTES\s*=\s*\{[\s\S]*low:/.test(js), 'script.js không rẽ nhánh theo mức cảm xúc');
const lowQuote = (js.match(/low:\s*"([^"]*)"/) || [])[1] || '';
T('Trang cảm ơn: câu cho mức thấp không chúc "niềm vui", không emoji trong câu', lowQuote && !/niềm vui|hạnh phúc|❤️/.test(lowQuote), lowQuote);

/* ---- Cỡ S bắt buộc (guide 5b) & mục 3 ---- */
WAIT('Cỡ S: mã số bệnh nhân tùy chọn / có "Bỏ qua" hoặc "ẩn danh"', /Bỏ qua|ẩn danh|không cần mã/i.test(htmlNoComment), 'mục 4.3: 01/11 anh đổi SĐT thành Mã số bệnh nhân, vẫn bắt buộc; còn chờ anh nói có cho bỏ qua không');
T('Ô nhập: nhãn "Mã số bệnh nhân của chị", không còn chữ "Số điện thoại", không icon 📱', /<label for="input-patient-id"[^>]*>[\s\S]*?Mã số bệnh nhân của chị\s*<\/label>/.test(htmlNoComment) && !/[Ss]ố điện thoại|📱/.test(htmlNoComment + '\n' + jsStrings.map(x => x.s).join('\n')), findLines(htmlNoComment + '\n' + js, /điện thoại|📱/).join(' | '));
T('Ô nhập: đã bỏ hẳn câu giải thích dưới ô (phone-note, "giúp bác sĩ nhận ra", "giữ tạm")', !/phone-note|giúp bác sĩ nhận ra|giữ tạm tới khi gửi được/.test(html + js + css));
T('Ô nhập: type=text, inputmode="numeric", autocomplete="off", placeholder "Ví dụ: 26012345", aria-describedby lỗi', /<input type="text" id="input-patient-id"[^>]*inputmode="numeric"[^>]*placeholder="Ví dụ: 26012345"[^>]*autocomplete="off"[^>]*aria-describedby="patient-id-error"/.test(htmlNoComment), (htmlNoComment.match(/<input[^>]*id="input-patient-id"[^>]*>/) || [])[0]);
T('Mã số: chỉ chữ số 3–20 sau khi bỏ khoảng trắng/chấm/gạch (không còn chuẩn SĐT Việt Nam)', js.includes(".replace(/[\\s.\\-]/g, '')") && js.includes('/^\\d{3,20}$/') && !/0\[35789\]|normalizePhone|maskPhone/.test(js));
T('Mã số: lỗi mềm giọng "chị", có ví dụ, kết "nhé" (style guide mục 2)', js.includes('const ID_ERROR = "Chị nhập mã số bệnh nhân (chỉ gồm chữ số, ví dụ 26012345) nhé.";'));
T('Cỡ S: có dòng "không phải chẩn đoán" / "tự đánh giá"', /chẩn đoán|tự đánh giá/i.test(htmlNoComment));
T('Mục 3: styles.css có @media (prefers-reduced-motion)', /prefers-reduced-motion/.test(css));
T('Mục 3: ảnh lỗi tự thay emoji (onerror/fallback)', /addEventListener\('error'/.test(js) && /fallback/.test(js) && /data-emoji="/.test(html) && /id="current-capy-emoji"/.test(html));
T('Mục 3: có nút/đường "Hỗ trợ"', /<summary[^>]*>[^<]*Hỗ trợ/.test(htmlNoComment));
T('Hỗ trợ: số cơ sở để trống trong config (không bịa), có 115', /const SUPPORT_PHONE = '';/.test(js) && /tel:115/.test(html));
T('Mục 3: favicon (không 404 favicon.ico)', /<link rel="icon" href="data:image\/svg\+xml/.test(html));
T('Mục 3: nhạc không tự phát, không tải trước (preload="none", không phát ở lần chạm đầu)', /<audio id="bg-music" loop preload="none">/.test(html) && !/once:\s*true/.test(js) && !/startBgMusic/.test(js) && !/autoplay/.test(html));
T('Nút nhạc: nhãn cố định "Nhạc nền", chỉ đổi aria-pressed (không đổi aria-label)', /id="music-toggle-btn"[^>]*aria-pressed="false"[^>]*aria-label="Nhạc nền"/.test(html) && /setAttribute\('aria-pressed'/.test(jsCode) && !/setAttribute\('aria-label'/.test(jsCode));
T('Chữ mức không aria-live (chấm đang chọn đã có nhãn "Mức 7, Tốt")', !/id="current-status"[^>]*aria-live/.test(html));
T('Chấm: aria-checked cập nhật theo mức, câu nhắc #level-error có aria-live', /setAttribute\('aria-checked'/.test(jsCode) && /<p id="level-error" class="level-error" aria-live="polite"><\/p>/.test(htmlNoComment));
T('Mục 3: có :focus-visible trong CSS', /:focus-visible/.test(css));
T('Mục 3: viewport cho phép phóng to (không user-scalable=no)', !/user-scalable=no|maximum-scale=1/.test(htmlNoComment), (html.match(/name="viewport" content="([^"]*)"/) || [])[1]);
T('Mục 2: placeholder là ví dụ cụ thể (có chữ số)', /placeholder="[^"]*\d/.test(html), (html.match(/placeholder="([^"]*)"/) || [])[1]);
T('alt ảnh mức cảm xúc đổi theo mức (không alt tĩnh)', /capyImg\.alt\s*=/.test(js), (html.match(/id="current-capy"[^>]*alt="([^"]*)"/) || [])[1]);

/* ---- XSS: không đưa chuỗi vào innerHTML ---- */
h = findLines(jsCode, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
T('XSS: script.js không dùng innerHTML/outerHTML/insertAdjacentHTML/document.write (chỉ textContent + createElement)', h.length === 0, h.join(' | '));
h = findLines(htmlNoComment, /\son[a-z]+="/);
T('Không còn sự kiện inline (onclick/oninput/onchange) trong index.html', h.length === 0, h.join(' | '));

/* ---- Console strings ---- */
h = findLines(js, /console\.(log|warn)\(/);
INFO('Chuỗi console', h.join(' | '));
T('Console: chỉ log "Đã lưu" sau khi kiểm data.result === "success"', /if \(data && data\.result === 'success'\) \{\s*queueRemove\(payload\.sessionId\);\s*console\.log\('\[Check-in\] Đã lưu/.test(js));
T('Gửi: kiểm response.ok, có timeout (AbortController), có hàng chờ gửi lại', /if \(!response\.ok\)/.test(js) && /AbortController/.test(js) && /addEventListener\('online', flushQueue\)/.test(js));
T('Gửi: giờ gửi dạng độ trễ ageMs (bây giờ − lúc bấm), không gửi giờ tuyệt đối hay chuỗi created_at', !/created_at|clientTs/.test(jsCode) && !/getHours\(\)/.test(jsCode) && /tappedAt: Date\.now\(\)/.test(jsCode) && /body\.ageMs = Math\.round\(Date\.now\(\) - payload\.tappedAt\)/.test(jsCode));
const OLD_DEPLOY_IDS_BAT = ['AKfycbzSx6BZ3UfryYuNBOPZY7Jvz7rBx_x-lHRCHl1Pfl9i_C_bHc2BJdXDBeqKqcT4-m7PZg'];
const batSrc = fs.existsSync(path.join(APP, 'upload.bat')) ? read('upload.bat') : '';
T('upload.bat chặn đẩy khi script.js còn ID triển khai cũ (findstr ID đầy đủ, thông báo không dấu, exit /b 1)', OLD_DEPLOY_IDS_BAT.every(id => batSrc.includes('set "OLD_ID=' + id + '"')) && /findstr \/L \/C:"%OLD_ID%"/.test(batSrc) && /exit \/b 1/.test(batSrc) && !/[^\x00-\x7F]/.test(batSrc));
/* Cùng origin ditruyenhungvuong.github.io: khóa app này phải có tiền tố riêng, không đụng khóa của Nhật Ký Mẹ Bầu */
const storageKeys = [...jsCode.matchAll(/(?:local|session)Storage\.(?:getItem|setItem|removeItem)\(\s*(?:'([^']*)'|"([^"]*)"|([A-Z_]+))/g)].map(m => m[1] || m[2] || ((jsCode.match(new RegExp('const ' + m[3] + " = '([^']*)'")) || [])[1]) || m[3]);
INFO('Khóa localStorage script.js dùng', storageKeys.join(', '));
T('Lưu trữ: mọi khóa có tiền tố "checkin_me_bau_" (trừ việc xóa "myCheckins" cũ của chính Check-in)', storageKeys.length > 0 && storageKeys.every(k => k.startsWith('checkin_me_bau_') || k === 'myCheckins'), storageKeys.join(', '));
T('Lưu trữ: không đọc/ghi/xóa khóa của Nhật Ký Mẹ Bầu (musicMuted, myJourneys, user_…), không dùng sessionStorage/clear()', !/musicMuted|myJourneys|['"]user_/.test(jsCode) && !/sessionStorage|localStorage\.clear/.test(jsCode));
T('Lưu trữ: localStorage bọc try/catch, không còn "myCheckins" lưu SĐT lâu dài', !/setItem\('myCheckins'/.test(js) && /try \{\s*const q = JSON\.parse\(localStorage\.getItem\(QUEUE_KEY\)/.test(js));
T('Lưu trữ: hàng chờ dùng khóa mới checkin_me_bau_queue; khóa cũ checkin_me_bau_pending (giữ SĐT) bị xóa khi mở app', /const QUEUE_KEY = 'checkin_me_bau_queue';/.test(js) && /const OLD_QUEUE_KEY = 'checkin_me_bau_pending';/.test(js) && /localStorage\.removeItem\(OLD_QUEUE_KEY\)/.test(jsCode) && !/setItem\(OLD_QUEUE_KEY/.test(jsCode));

/* ---- Admin (đã bỏ theo mục 4.1) ---- */
h = findLines(htmlNoComment + '\n' + jsCode + '\n' + cssCode, /0967791552|admin|QUẢN TRỊ|fetchHistory|deleteCheckin/i);
T('Admin: số 0967791552 không còn ở bất kỳ đâu trong app (kể cả comment)', !/0967791552/.test(html + js + css));
T('Admin: đã bỏ hẳn lối "quản trị" bằng SĐT (không còn số 0967791552, modal, fetchHistory)', h.length === 0, h.join(' | '));
T('Nút nhạc không còn nổi position:fixed đè chữ', !/(#music-toggle-btn|\.music-btn)\s*\{[^}]*position:\s*fixed/.test(cssCode));

/* ---- URL Apps Script: bản triển khai cũ đã lộ (nhắc mỗi lần chạy cho tới khi anh dán URL mới) ---- */
const OLD_DEPLOY_IDS = ['AKfycbzSx6BZ3UfryYuNBOPZY7Jvz7rBx_x-lHRCHl1Pfl9i_C_bHc2BJdXDBeqKqcT4-m7PZg'];
const urlNow = (js.match(/^const GOOGLE_SCRIPT_URL = '([^']*)';/m) || [])[1] || '';
WAIT('URL Apps Script đã đổi sang bản triển khai MỚI', !OLD_DEPLOY_IDS.some(id => urlNow.includes(id)), 'script.js dòng 6 vẫn là URL cũ đã lộ; anh tạo Triển khai mới rồi dán URL mới (google_apps_script.js BƯỚC 5). upload.sh sẽ không cho đẩy tới khi đổi', urlNow.replace(/(\/s\/.{10}).*(\/exec)/, '$1…$2'));
const upSh = fs.existsSync(path.join(APP, 'upload.sh')) ? read('upload.sh') : '';
T('upload.sh chặn đẩy khi script.js còn ID triển khai cũ (OLD_IDS khớp đầy đủ)', OLD_DEPLOY_IDS.every(id => upSh.includes('OLD_IDS="' + id)) && /grep -qF "\$OLD_ID"/.test(upSh) && /KHÔNG ĐẨY\. \$CONFIG vẫn dùng URL Apps Script CŨ/.test(upSh));

const summary = '\n' + (out.filter(l => l.startsWith('PASS')).length) + ' PASS, ' + fails + ' FAIL, ' + waits + ' CHỜ ANH (rà nội dung tĩnh)';
console.log(summary);
const outDir = process.env.QA_OUT || path.join(require('os').tmpdir(), 'checkin-me-bau-qa');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'check-content.txt'), out.join('\n') + summary + '\n');
process.exit(fails ? 1 : 0);
