/* =========================================================
   Rà nội dung tĩnh app Check-in Cảm Xúc Mẹ Bầu (QA, Phần A).
   Đọc index.html / script.js / styles.css, liệt kê chuỗi hiển thị và đối chiếu
   style guide mục 2 (giọng "chị", không "bạn", không "hệ thống", không "Vui lòng", không alert),
   mục 3 (prefers-reduced-motion, ảnh lỗi thay emoji), mục 5b (SĐT tùy chọn, dòng "không phải chẩn đoán").
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
h = all.filter(x => x.kind === 'text' && /[❤️💡✨🌸🔐🔄🎵📱🌱🐾]/.test(x.s) && /[.!?]\s*$/.test(x.s) && !/^[^\p{L}]*$/u.test(x.s) && !/^(💡|✨)/.test(x.s)).map(x => x.file + ':' + x.n + ' "' + x.s + '"');
INFO('Emoji trong câu văn (guide: emoji chỉ ở nút/tiêu đề)', h.join(' | ') || 'không có');

/* ---- Nhãn mức cảm xúc ---- */
const levels = {};
for (const m of js.matchAll(/^\s*(\d+):\s*\{\s*text:\s*"([^"]*)"/mg)) levels[m[1]] = m[2];
INFO('Bảng 10 mức (script.js)', Object.entries(levels).map(([k, v]) => k + '=' + v).join(', '));
const sliderLabels = [...htmlNoComment.matchAll(/<span>(\d+) \(([^)]*)\)<\/span>/g)].map(m => [m[1], m[2]]);
T('Nhãn hai đầu thanh trượt khớp mức 1 và 10 của bảng', sliderLabels.length === 2 && sliderLabels[0][1] === levels['1'] && sliderLabels[1][1] === levels['10'], JSON.stringify(sliderLabels));
const defaultStatus = (htmlNoComment.match(/id="current-status"[^>]*>([^<]*)</) || [])[1];
const defaultVal = (htmlNoComment.match(/id="emotion-range"/) && htmlNoComment.match(/value="(\d+)" id="emotion-range"/) || [])[1];
T('Chữ trạng thái mặc định khớp value mặc định của thanh trượt', defaultVal === '5' && defaultStatus === '5 - ' + levels['5'], defaultVal + ' / ' + defaultStatus + ' / ' + (js.match(/part1_text: '([^']*)'/) || [])[1]);
T('currentCheckin.part1_text mặc định khớp bảng mức 5', (js.match(/part1_text: '([^']*)'/) || [])[1] === levels['5']);
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
INFO('Tương phản 10 mức', levelColors.map(([k, c]) => k + ':' + ratio(c, '#ffffff').toFixed(1)).join(' '));
const cssColor = (sel, prop) => { const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*?' + prop + ':\\s*([^;]+);')); return m ? m[1].trim() : ''; };
const statusCss = cssColor('.emotion-status', 'color');
T('Tương phản: màu mặc định .emotion-status trong CSS khớp mức 5 và ≥ 4,5:1', /^#[0-9a-f]{6}$/i.test(statusCss) && ratio(statusCss, '#ffffff') >= 4.5, statusCss);
const ph = (css.match(/::placeholder\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i) || [])[1] || '';
T('Tương phản: placeholder ≥ 4,5:1 trên nền ô #fffafa', ph && ratio(ph, '#fffafa') >= 4.5, ph + ' ' + (ph ? ratio(ph, '#fffafa').toFixed(2) : ''));
T('Tương phản: hint tiến độ dùng --ink-soft (không còn #9c7b88)', !/#9c7b88/i.test(cssCode + jsCode), findLines(cssCode + jsCode, /#9c7b88/i).join(' | '));

/* ---- 6 thẻ cảm xúc ---- */
const cards = [...htmlNoComment.matchAll(/<(\w+) ([^>]*class="capy-card"[^>]*)>[\s\S]*?<img src="([^"]*)" alt="([^"]*)"[\s\S]*?<span class="capy-name">([^<]*)<\/span>/g)]
  .map(m => ({ tag: m[1], attrs: m[2], data: (m[2].match(/data-emotion="([^"]*)"/) || [])[1], img: m[3], alt: m[4], name: m[5] }));
INFO('6 thẻ', cards.map(c => c.name + '→' + c.img).join(', '));
T('Thẻ: data-emotion = tên hiển thị (6/6)', cards.length === 6 && cards.every(c => c.data === c.name), JSON.stringify(cards.map(c => c.data + '/' + c.name)));
T('Bàn phím: 6 thẻ là <button type="button"> có aria-pressed, data-act="pick" (không div onclick)', cards.length === 6 && cards.every(c => c.tag === 'button' && /type="button"/.test(c.attrs) && /aria-pressed="false"/.test(c.attrs) && /data-act="pick"/.test(c.attrs)), JSON.stringify(cards.map(c => c.tag)));
T('Thẻ: ảnh trang trí alt="" (tên đã có dưới ảnh, trình đọc không đọc lặp)', cards.every(c => c.alt === ''), cards.map(c => c.alt).join('|'));
T('Thẻ: lưới có role="group" gắn tiêu đề Phần 2', /class="emotion-grid" role="group" aria-labelledby="part2-title"/.test(htmlNoComment));
const EMO_JS = ((js.match(/const EMOTIONS = \[([^\]]*)\]/) || [])[1] || '').split(',').map(x => x.trim().replace(/^'|'$/g, ''));
T('Thẻ: 6 tên trùng danh sách EMOTIONS trong script.js', JSON.stringify(EMO_JS) === JSON.stringify(cards.map(c => c.name)), EMO_JS.join(','));
const fileMap = { 'Vui vẻ': 'vui.jpg', 'Buồn': 'buon.jpg', 'Lo lắng': 'lo_lang.jpg', 'Tức giận': 'tuc.jpg', 'Hoảng hốt': 'hoang_hot.jpg', 'Khó chịu': 'kho_chiu.jpg' };
const mism = cards.filter(c => fileMap[c.name] !== c.img).map(c => c.name + ' dùng ' + c.img);
WAIT('Thẻ: tên file ảnh gợi đúng cảm xúc của thẻ', mism.length === 0, 'mục 4.8: anh xem ảnh khoc.jpg có hợp thẻ "Lo lắng" không (không tải, không đổi ảnh)', mism.join(', '));

/* ---- Hint tiến độ ---- */
const hintHtml = (htmlNoComment.match(/id="submit-hint"[^>]*>\s*([^<]*?)\s*<\/p>/) || [])[1];
const hintBlock = (js.match(/const HINTS = \{([\s\S]*?)\};/) || [])[1] || '';
const hints = Object.fromEntries([...hintBlock.matchAll(/(\w+):\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
const hintsJs = Object.values(hints);
INFO('Hint các trạng thái (script.js HINTS)', hintsJs.join(' || '));
T('Hint ban đầu trong HTML trùng hint "thiếu cả hai" của JS', hintHtml === hints.both, hintHtml + ' <> ' + hints.both);
T('5 hint (cả hai, thiếu SĐT, SĐT sai, thiếu thẻ, đủ) phân biệt nhau', hintsJs.length === 5 && new Set(hintsJs).size === 5, hintsJs.length);
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
T('Trang cảm ơn: tóm tắt che SĐT (maskPhone), không hiện số đầy đủ (guide mục 6)', /maskPhone\(info\.phone\)/.test(js) && !/\$\{payload\.phone\}/.test(js), findLines(js, /Số điện thoại: /).join(' | '));
T('Trang cảm ơn: lời chúc không ép tích cực chung cho mọi mức (có nhánh cho mức thấp)', /level\s*<=?\s*3/.test(js) && /QUOTES\s*=\s*\{[\s\S]*low:/.test(js), 'script.js không rẽ nhánh theo mức cảm xúc');
const lowQuote = (js.match(/low:\s*"([^"]*)"/) || [])[1] || '';
T('Trang cảm ơn: câu cho mức thấp không chúc "niềm vui", không emoji trong câu', lowQuote && !/niềm vui|hạnh phúc|❤️/.test(lowQuote), lowQuote);

/* ---- Cỡ S bắt buộc (guide 5b) & mục 3 ---- */
WAIT('Cỡ S: SĐT tùy chọn / có "Bỏ qua" hoặc "ẩn danh"', /Bỏ qua|ẩn danh|không cần số/i.test(htmlNoComment), 'mục 4.3: SĐT vẫn bắt buộc như cũ, chờ anh quyết');
T('SĐT bắt buộc thì có dòng giải thích vì sao cần số và ai xem (id="phone-note", gắn aria-describedby)', /id="phone-note"[^>]*>[^<]*(bác sĩ|phòng khám)[^<]*</.test(htmlNoComment) && /aria-describedby="phone-note/.test(htmlNoComment));
T('SĐT: kiểm định dạng Việt Nam (di động 03/05/07/08/09 10 số, cố định 02x 11 số), không chỉ đếm độ dài', /0\[35789\]\\d\{8\}\|02\\d\{9\}/.test(js) && !/length >= 9|length < 9/.test(js));
T('SĐT: lỗi mềm có ví dụ (style guide mục 2)', js.includes('Số điện thoại chưa đúng định dạng Việt Nam (ví dụ 0912 345 678).'));
T('Cỡ S: có dòng "không phải chẩn đoán" / "tự đánh giá"', /chẩn đoán|tự đánh giá/i.test(htmlNoComment));
T('Mục 3: styles.css có @media (prefers-reduced-motion)', /prefers-reduced-motion/.test(css));
T('Mục 3: ảnh lỗi tự thay emoji (onerror/fallback)', /addEventListener\('error'/.test(js) && /fallback/.test(js) && /data-emoji="/.test(html) && /id="current-capy-emoji"/.test(html));
T('Mục 3: có nút/đường "Hỗ trợ"', /<summary[^>]*>[^<]*Hỗ trợ/.test(htmlNoComment));
T('Hỗ trợ: số cơ sở để trống trong config (không bịa), có 115', /const SUPPORT_PHONE = '';/.test(js) && /tel:115/.test(html));
T('Mục 3: favicon (không 404 favicon.ico)', /<link rel="icon" href="data:image\/svg\+xml/.test(html));
T('Mục 3: nhạc không tự phát, không tải trước (preload="none", không phát ở lần chạm đầu)', /<audio id="bg-music" loop preload="none">/.test(html) && !/once:\s*true/.test(js) && !/startBgMusic/.test(js) && !/autoplay/.test(html));
T('Nút nhạc: nhãn cố định "Nhạc nền", chỉ đổi aria-pressed (không đổi aria-label)', /id="music-toggle-btn"[^>]*aria-pressed="false"[^>]*aria-label="Nhạc nền"/.test(html) && /setAttribute\('aria-pressed'/.test(jsCode) && !/setAttribute\('aria-label'/.test(jsCode));
T('Chữ mức không aria-live (thanh trượt đã có aria-valuetext)', !/id="current-status"[^>]*aria-live/.test(html));
T('Dòng giải thích SĐT nói rõ máy giữ tạm khi mạng yếu (style guide mục 6)', /id="phone-note"[^>]*>[^<]*mạng yếu[^<]*giữ tạm/.test(htmlNoComment));
T('Thanh trượt: aria-labelledby + aria-valuetext cập nhật theo mức', /id="emotion-range"[\s\S]{0,120}aria-labelledby="part1-title"/.test(html) && /setAttribute\('aria-valuetext'/.test(js));
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
