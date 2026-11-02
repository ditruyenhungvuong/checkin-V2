/* =========================================================
   QA 02/11/2026 – ca biên cho 10 chấm mức + 9 thẻ cảm xúc (Check-in Cảm Xúc Mẹ Bầu).
   Bổ sung cho tests/e2e.js, KHÔNG thay. Chạy:  flock /tmp/claude-1000/e2e.lock node tests/qa-cham-muc.js
   An toàn giống e2e.js: static-server thay URL Apps Script bằng mock 127.0.0.1 lúc phục vụ (file trên đĩa
   không đổi, throw nếu còn script.google.com), Chrome chặn *script.google.com*, kiểm URL trong trang
   trước mỗi lần bấm Hoàn thành. Mock riêng trả được mã lỗi tùy chọn (emotion_invalid…).
   Cổng riêng 8966/8977 để không đụng e2e.js.
   Lượt 2 (02/11/2026): thẻ xáo thứ tự (đọc thứ tự từ DOM, ?qaseed=N cho phân bố tất định), emotion_invalid GIỮ
   lượt trong hàng chờ (máy chủ mới thì gửi được và xóa), thêm kịch bản shuffle.
   Lượt 3 (02/11/2026): tên mới theo ảnh (Đau khổ, Bình an, Cô đơn), 9 ảnh PNG; thêm kịch bản images, legacy (hàng chờ cũ "Buồn").
   Biến môi trường: QA_ONLY=change,badid,keys,a11y,server,reduced,widths,shuffle,images,legacy (chạy một phần), QA_DEBUG=1.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { launch, sleep } = require(path.join(__dirname, '..', '..', 'checkin-vao-ca', 'tests', 'lib', 'cdp.js'));
const { startStatic } = require('./lib/static-server');

const APP = path.resolve(__dirname, '..');
const OUT = path.join(os.tmpdir(), 'checkin-me-bau-qa-cham-muc');
fs.mkdirSync(OUT, { recursive: true });
const STATIC_PORT = 8966, MOCK_PORT = 8977;
const APP_URL = 'http://127.0.0.1:' + STATIC_PORT + '/index.html';
const LEVEL_ERROR = 'Chị chạm chọn một mức từ 1 đến 10 nhé.';
/* Lượt 3 (02/11/2026): anh chốt tên theo tên ảnh – Buồn→Đau khổ, Bình yên→Bình an, "Tủi thân, cô đơn"→Cô đơn */
const LABELS = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];
const ID_ERROR = 'Chị nhập mã số bệnh nhân (chỉ gồm chữ số, ví dụ 26012345) nhé.';

let pass = 0, fail = 0, scen = '';
const T = (name, ok, detail) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + '[' + scen + '] ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 300) : '')); };
const OBS = (name, detail) => console.log('QUAN SÁT [' + scen + '] ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 300) : ''));

/* Mock Apps Script: mode 'ok' | 'emotion_invalid' (Apps Script bản cũ) | 'reject' (patient_id_invalid) | 'down' (500) */
function startMock() {
  const st = { mode: 'ok', rows: [], posts: [] };
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', d => { body += d; });
    req.on('end', () => {
      const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
      if (req.method === 'OPTIONS') { res.writeHead(204, Object.assign({ 'Access-Control-Allow-Headers': '*' }, h)); return res.end(); }
      if (req.method === 'POST') st.posts.push(body);
      if (st.mode === 'down') { res.writeHead(500, h); return res.end('{"result":"error"}'); }
      if (st.mode === 'emotion_invalid') { res.writeHead(200, h); return res.end('{"result":"error","error":"emotion_invalid"}'); }
      if (st.mode === 'reject') { res.writeHead(200, h); return res.end('{"result":"error","error":"patient_id_invalid"}'); }
      let d = {}; try { d = JSON.parse(body); } catch (e) { /* rác */ }
      const i = st.rows.findIndex(r => r.sessionId === d.sessionId);
      if (i >= 0) st.rows[i] = d; else st.rows.push(d);
      res.writeHead(200, h); res.end('{"result":"success"}');
    });
  });
  return new Promise(r => srv.listen(MOCK_PORT, '127.0.0.1', () => r({ st, url: 'http://127.0.0.1:' + MOCK_PORT + '/exec', close: () => new Promise(c => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(() => c()); }) })));
}

const HOOK = `(() => { window.__qa = { errors: [], warns: [], alerts: [] };
  const oe = console.error.bind(console), ow = console.warn.bind(console);
  console.error = (...a) => { __qa.errors.push(a.map(String).join(' ')); oe(...a); };
  console.warn = (...a) => { __qa.warns.push(a.map(String).join(' ')); ow(...a); };
  window.addEventListener('error', e => __qa.errors.push('onerror: ' + e.message));
  window.alert = m => __qa.alerts.push(String(m));
  const of = window.fetch.bind(window);
  window.fetch = (u, i) => String(u).includes('script.google.com') ? Promise.reject(new Error('QA chặn')) : of(u, i);
  const seedM = /[?&]qaseed=(\\d+)/.exec(location.search);
  if (seedM && window.crypto) {
    let st = Number(seedM[1]) >>> 0;
    const next = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
    Object.defineProperty(window.crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; } });
  }
})();`;

async function open(o) {
  o = o || {};
  const { page, kill } = await launch({ userDataDir: path.join(OUT, 'ud-' + scen), width: o.width || 375, height: o.height || 800 });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*fonts.googleapis.com/*' }, { urlPattern: '*fonts.gstatic.com/*' }, { urlPattern: '*script.google.com/*' }] });
  page.on('Fetch.requestPaused', async p => {
    try {
      if (p.request.url.includes('script.google.com')) await page.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
      else await page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/css' }], body: '' });
    } catch (e) { /* đã hủy */ }
  });
  await page.send('Emulation.setDeviceMetricsOverride', { width: o.width || 375, height: o.height || 800, deviceScaleFactor: 1, mobile: true });
  if (o.reduced) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  await page.navigate(APP_URL + (o.query || ''));
  await page.evaluate('localStorage.clear(); true');
  return { page, kill };
}
async function safeUrl(page) {
  const u = await page.evaluate('GOOGLE_SCRIPT_URL');
  if (u.includes('script.google.com') || !/^http:\/\/127\.0\.0\.1:/.test(u)) throw new Error('AN TOÀN: URL thật trong trang, dừng');
}
async function waitFor(page, expr, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 2000)) { const v = await page.evaluate(expr); if (v) return v; await sleep(25); } return null; }
/* Chạm bằng click() trong trang (không phụ thuộc vị trí cuộn), sự kiện đi qua bộ gom data-act như chạm thật */
const tap = (page, sel) => page.evaluate(`document.querySelector(${JSON.stringify(sel)}).click(); true`);
const dot = n => '.level-dot[data-level="' + n + '"]';
const card = n => '.capy-card[data-emotion="' + n + '"]';
async function typeId(page, v) { await page.evaluate("(() => { const i = document.getElementById('input-patient-id'); i.focus(); i.value = ''; return true; })()"); if (v) await page.send('Input.insertText', { text: v }); }
const state = page => page.evaluate(`(() => { const d = [...document.querySelectorAll('.level-dot')];
  return { checked: d.filter(x => x.getAttribute('aria-checked') === 'true').map(x => x.dataset.level).join(), sel: d.filter(x => x.classList.contains('selected')).map(x => x.dataset.level).join(),
    tab: d.filter(x => x.tabIndex === 0).map(x => x.dataset.level).join(), status: document.getElementById('current-status').textContent,
    src: (document.getElementById('current-capy').getAttribute('src') || ''), alt: document.getElementById('current-capy').alt,
    err: document.getElementById('level-error').textContent, need: document.getElementById('level-dots').classList.contains('need'),
    picked: document.getElementById('emotion-picked').textContent, cards: [...document.querySelectorAll('.capy-card')].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.dataset.emotion).join('|'),
    aria: document.getElementById('btn-submit').getAttribute('aria-disabled'), hint: document.getElementById('submit-hint').textContent,
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
    active: document.activeElement ? (document.activeElement.id || document.activeElement.dataset.level || document.activeElement.dataset.emotion || document.activeElement.tagName) : '',
    success: getComputedStyle(document.getElementById('page-success')).display !== 'none' }; })()`);

/* ---------- 1. Đổi mức, đổi thẻ, bấm lại thẻ đang chọn ---------- */
async function sChange(mock) {
  const { page, kill } = await open();
  try {
    await tap(page, dot(3)); await tap(page, dot(8)); await tap(page, dot(3)); await tap(page, dot(10));
    let s = await state(page);
    T('Chọn 3 → 8 → 3 → 10: chỉ chấm 10 aria-checked/.selected/tabindex 0, nhãn "10 - Rất tuyệt vời", ảnh capy-level-10', s.checked === '10' && s.sel === '10' && s.tab === '10' && s.status === '10 - Rất tuyệt vời' && s.src === 'capy-level-10.png' && /mức 10/.test(s.alt), JSON.stringify(s));
    await tap(page, dot(10));
    s = await state(page);
    T('Chạm lại chấm đang chọn: vẫn giữ mức 10 (radio, không bỏ chọn)', s.checked === '10', s.checked);
    await tap(page, card('Mệt mỏi')); await tap(page, card('Vui vẻ'));
    s = await state(page);
    T('Thẻ Mệt mỏi → Vui vẻ: chỉ 1 thẻ aria-pressed, "Chị chọn: Vui vẻ"', s.cards === 'Vui vẻ' && s.picked === 'Chị chọn: Vui vẻ', JSON.stringify(s));
    await tap(page, card('Vui vẻ'));
    s = await state(page);
    OBS('Chạm lại thẻ đang chọn (aria-pressed=true) → thẻ KHÔNG bỏ chọn được', 'cards=' + s.cards + ' picked=' + s.picked);
    /* Đổi mức ngay trước khi gửi: payload phải là mức cuối */
    await typeId(page, '0012345');
    await tap(page, dot(2)); await tap(page, dot(5));
    await safeUrl(page);
    await tap(page, '#btn-submit');
    await waitFor(page, 'getComputedStyle(document.getElementById("page-success")).display !== "none"');
    await waitFor(page, '!localStorage.getItem("checkin_me_bau_queue")');
    const r = mock.st.rows[mock.st.rows.length - 1] || {};
    T('Đổi mức 2 → 5 rồi gửi: payload level 5 "5 - Bình thường (Ổn)", mã "0012345" giữ số 0', r.level === 5 && r.part1 === '5 - Bình thường (Ổn)' && r.patientId === '0012345' && r.part2 === 'Vui vẻ', JSON.stringify(r));
    T('Không console.error / alert', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0);
  } finally { kill(); }
}

/* ---------- 2. Mã sai + chưa chọn mức cùng lúc ---------- */
async function sBadIdNoLevel(mock) {
  const { page, kill } = await open();
  try {
    const before = mock.st.posts.length;
    await typeId(page, '12ab');
    await tap(page, card('Bình an'));
    await safeUrl(page);
    await tap(page, '#btn-submit');
    await sleep(300);
    let s = await state(page);
    T('Mã "12ab" + chưa mức, bấm Hoàn thành: không gửi, toast lỗi mã, focus ô mã', mock.st.posts.length === before && !s.success && s.toast === ID_ERROR && s.active === 'input-patient-id', JSON.stringify(s));
    OBS('… cùng lúc đó câu nhắc mức #level-error', s.err === '' ? 'KHÔNG hiện (chỉ nhắc mã trước; phải bấm lần 2 mới biết thiếu mức)' : 'có hiện: ' + s.err);
    OBS('… hint dưới nút', s.hint);
    await typeId(page, '26012345');
    await tap(page, '#btn-submit');
    await sleep(300);
    s = await state(page);
    T('Sửa mã đúng, bấm lại: không gửi, hiện "' + LEVEL_ERROR + '", viền .need, focus chấm 1', mock.st.posts.length === before && !s.success && s.err === LEVEL_ERROR && s.need && s.active === '1', JSON.stringify(s));
    /* Bấm Hoàn thành liên tục khi chưa mức */
    for (let i = 0; i < 5; i++) await tap(page, '#btn-submit');
    await sleep(200);
    T('Bấm Hoàn thành 5 lần liền khi thiếu mức: vẫn 0 POST, không trang cảm ơn', mock.st.posts.length === before && !(await state(page)).success);
    /* Xóa mã sau khi đã hiện lỗi mức: nút trở về aria-disabled, câu nhắc mức giữ (chưa chọn) */
    await tap(page, dot(1));
    s = await state(page);
    T('Chọn chấm 1 sau lỗi: câu nhắc tắt, .need tắt, aria-disabled=false (đủ cả 3)', s.err === '' && !s.need && s.aria === 'false', JSON.stringify(s));
    await typeId(page, '');
    await page.evaluate("document.getElementById('input-patient-id').dispatchEvent(new Event('input')); true");
    s = await state(page);
    T('Xóa mã sau khi đã đủ: aria-disabled quay về true', s.aria === 'true', s.aria);
    /* Mã quá dài (21 số) + có mức + thẻ */
    await typeId(page, '123456789012345678901');
    await tap(page, '#btn-submit'); await sleep(200);
    s = await state(page);
    T('Mã 21 chữ số: không gửi, toast lỗi mã', mock.st.posts.length === before && s.toast === ID_ERROR, JSON.stringify(s));
    T('Không console.error / alert', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0);
  } finally { kill(); }
}

/* ---------- 3. Bàn phím: vòng lại, Home/End, Shift+Tab về đúng chấm đang chọn ---------- */
async function sKeys() {
  const { page, kill } = await open();
  try {
    const key = async (k, vk) => { await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk }); };
    await page.evaluate("document.querySelector('.level-dot[data-level=\"1\"]').focus(); true");
    await key('ArrowLeft', 37);
    let s = await state(page);
    T('Chấm 1, ArrowLeft → vòng về 10 (focus + chọn)', s.checked === '10' && s.active === '10', JSON.stringify(s));
    await key('ArrowDown', 40);
    s = await state(page);
    T('Chấm 10, ArrowDown → vòng về 1', s.checked === '1' && s.active === '1');
    await key('End', 35); s = await state(page);
    T('End → 10', s.checked === '10' && s.active === '10');
    await key('Home', 36); s = await state(page);
    T('Home → 1', s.checked === '1' && s.active === '1');
    await key('ArrowUp', 38); await key('ArrowUp', 38); s = await state(page);
    T('ArrowUp ×2 từ 1 → 9', s.checked === '9');
    const y0 = await page.evaluate('scrollY');
    await key(' ', 32); s = await state(page);
    T('Space giữ mức 9, trang không cuộn', s.checked === '9' && (await page.evaluate('scrollY')) === y0);
    await page.key('Tab');
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    s = await state(page);
    T('Tab ra thẻ rồi Shift+Tab: quay về đúng chấm đang chọn (9), không phải chấm 1', s.active === '9', s.active);
  } finally { kill(); }
}

/* ---------- 4. Cây trợ năng (trình đọc màn hình đọc gì) ---------- */
async function sA11y() {
  const { page, kill } = await open();
  try {
    await page.send('Accessibility.enable');
    const tree = async () => (await page.send('Accessibility.getFullAXTree')).nodes.filter(n => !n.ignored);
    const val = (n, k) => { const p = (n.properties || []).find(x => x.name === k); return p ? p.value.value : undefined; };
    let nodes = await tree();
    const group = nodes.find(n => n.role && n.role.value === 'radiogroup');
    const radios = nodes.filter(n => n.role && n.role.value === 'radio');
    T('radiogroup có tên (từ tiêu đề Phần 1)', group && /Hôm nay chị cảm thấy thế nào/.test(group.name.value), group && group.name.value);
    OBS('Tên radiogroup đọc ra', JSON.stringify(group && group.name.value));
    T('10 radio, tên "Mức n, nhãn", chưa chọn cái nào', radios.length === 10 && radios.every((r, i) => r.name.value.startsWith('Mức ' + (i + 1) + ', ')) && radios.every(r => val(r, 'checked') === 'false'), radios.map(r => r.name.value + ':' + val(r, 'checked')).join(' | '));
    const cardsN = nodes.filter(n => n.role && /button/.test(n.role.value) && val(n, 'pressed') !== undefined && n.name && n.name.value !== 'Nhạc nền');
    const domOrder = await page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => c.getAttribute('aria-label')).join('|')");
    const axOrder = cardsN.map(n => n.name.value).join('|');
    T('9 thẻ: đủ 9 tên cảm xúc (không đọc tên file/emoji), thứ tự trình đọc = thứ tự DOM (đã xáo 02/11)', axOrder === domOrder && axOrder.split('|').sort().join('|') === LABELS.slice().sort().join('|'), axOrder);
    const sub = nodes.find(n => n.name && n.name.value === 'Hoàn thành Check-in →');
    T('Nút Hoàn thành: trình đọc báo "không khả dụng" (aria-disabled) nhưng vẫn focus được', sub && val(sub, 'disabled') === true && val(sub, 'focusable') === true, sub && JSON.stringify(sub.properties));
    await tap(page, dot(4)); await tap(page, card('Cô đơn'));
    nodes = await tree();
    const r4 = nodes.filter(n => n.role && n.role.value === 'radio').find(r => val(r, 'checked') === 'true');
    T('Chọn mức 4: radio "Mức 4, Kém" checked=true', r4 && r4.name.value === 'Mức 4, Kém', r4 && r4.name.value);
    const c = nodes.find(n => n.name && n.name.value === 'Cô đơn' && val(n, 'pressed') !== undefined);
    T('Thẻ "Cô đơn" pressed=true', c && val(c, 'pressed') === 'true', c && JSON.stringify(c.properties));
    const pk = nodes.find(n => n.name && /Chị chọn: Cô đơn/.test(n.name.value));
    T('Dòng "Chị chọn: Cô đơn" có trong cây trợ năng', !!pk);
    const img = await page.evaluate("({ alt: document.getElementById('current-capy').alt, hidden: document.getElementById('current-capy').hidden })");
    T('Ảnh capybara theo mức có alt "Bé Capybara mức 4: Kém"', img.alt === 'Bé Capybara mức 4: Kém', JSON.stringify(img));
  } finally { kill(); }
}

/* ---------- 5. Máy chủ trả emotion_invalid; mất mạng – hàng chờ với cảm xúc mới ---------- */
async function sServer(mock) {
  const { page, kill } = await open();
  try {
    /* Lượt 2 (02/11): máy chủ còn bản cũ trả emotion_invalid → GIỮ lượt trong hàng chờ; máy chủ mới → gửi được thì xóa */
    const Q = "JSON.parse(localStorage.getItem('checkin_me_bau_queue') || '[]')";
    mock.st.mode = 'emotion_invalid';
    const before = mock.st.posts.length;
    await typeId(page, '26012345'); await tap(page, dot(2)); await tap(page, card('Cô đơn'));
    await safeUrl(page);
    await tap(page, '#btn-submit');
    await waitFor(page, 'getComputedStyle(document.getElementById("page-success")).display !== "none"');
    await waitFor(page, '__qa.warns.length > 0', 3000);
    const w = await page.evaluate('__qa.warns.join(" | ")');
    let q = await page.evaluate(Q);
    T('emotion_invalid: 1 POST, hàng chờ GIỮ 1 lượt "Cô đơn" (gửi lại sau), chỉ console.warn "sẽ thử lại", không console.error',
      mock.st.posts.length === before + 1 && q.length === 1 && q[0].payload.part2 === 'Cô đơn' && /thử lại/.test(w) && !/không gửi lại/.test(w) && (await page.evaluate('__qa.errors.length')) === 0, w + ' / ' + JSON.stringify(q));
    const sidInv = q[0] && q[0].payload.sessionId;
    /* Máy chủ vẫn bản cũ: thử lại 3 lần (online) → mỗi lần đúng 1 POST, hàng chờ vẫn 1 lượt, không lặp vô hạn */
    for (let i = 0; i < 3; i++) {
      const n0 = mock.st.posts.length;
      await page.evaluate("window.dispatchEvent(new Event('online')); true");
      await waitFor(page, 'false', 400);
      if (mock.st.posts.length !== n0 + 1) { T('emotion_invalid: mỗi lần thử lại đúng 1 POST', false, 'lần ' + (i + 1) + ': ' + (mock.st.posts.length - n0) + ' POST'); break; }
    }
    await sleep(500);
    const n1 = mock.st.posts.length;
    await sleep(1500);
    q = await page.evaluate(Q);
    T('Máy chủ vẫn bản cũ: thử lại 3 lần → mỗi lần 1 POST, hàng chờ vẫn đúng 1 lượt cùng Mã phiên, không tự gửi lặp khi không có sự kiện',
      n1 === before + 4 && mock.st.posts.length === n1 && q.length === 1 && q[0].payload.sessionId === sidInv, (n1 - before) + ' POST, sau 1,5 s thêm ' + (mock.st.posts.length - n1) + '; hàng chờ ' + q.length);
    /* Tải lại trang khi máy chủ vẫn cũ: vẫn giữ */
    await page.navigate(APP_URL);
    await sleep(600);
    q = await page.evaluate(Q);
    T('Tải lại trang (máy chủ vẫn cũ): app thử gửi lúc mở, lượt vẫn nằm trong hàng chờ', q.length === 1 && q[0].payload.sessionId === sidInv && mock.st.posts.length === n1 + 1, mock.st.posts.length - n1 + ' POST');
    /* Anh cập nhật Apps Script (máy chủ mới nhận 9 cảm xúc) → có sự kiện online / mở lại trang → gửi được thì xóa */
    mock.st.mode = 'ok';
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    const rowsInv = mock.st.rows.filter(r => r.sessionId === sidInv);
    T('Máy chủ mới: lượt giữ lại được gửi, Sheet có ĐÚNG 1 dòng "Cô đơn" mức 2, hàng chờ trống (không kẹt vĩnh viễn)',
      rowsInv.length === 1 && rowsInv[0].part2 === 'Cô đơn' && rowsInv[0].level === 2 && (await page.evaluate("localStorage.getItem('checkin_me_bau_queue')")) === null, JSON.stringify(rowsInv));
    T('ageMs lượt gửi lại > 0 (máy chủ suy ra giờ bấm ban đầu)', rowsInv[0] && rowsInv[0].ageMs > 0, rowsInv[0] && rowsInv[0].ageMs);
    /* Lỗi từ chối KHÁC (patient_id_invalid) vẫn bỏ lượt, không gửi lại vô ích */
    mock.st.mode = 'reject';
    await typeId(page, '26012345'); await tap(page, dot(6)); await tap(page, card('Đau khổ'));
    await safeUrl(page);
    const nR = mock.st.posts.length;
    await tap(page, '#btn-submit');
    await waitFor(page, "__qa.warns.some(x => x.includes('không gửi lại'))", 3000);
    T('Từ chối khác (patient_id_invalid): bỏ lượt khỏi hàng chờ, console.warn "không gửi lại"', mock.st.posts.length === nR + 1 && (await page.evaluate("localStorage.getItem('checkin_me_bau_queue')")) === null && (await page.evaluate("__qa.warns.some(x => x.includes('không gửi lại'))")));
    T('Không console.error / alert (sau chuỗi emotion_invalid)', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0, await page.evaluate('JSON.stringify(__qa.errors)'));
    mock.st.mode = 'ok';
    /* Mất mạng (500) với cảm xúc mới → vào hàng chờ, có mạng lại → gửi đủ chuỗi có dấu phẩy */
    await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2000);
    await page.evaluate("document.querySelector('[data-act=restart]').click(); true");
    await sleep(200);
    mock.st.mode = 'down';
    await typeId(page, '0912345'); await tap(page, dot(1)); await tap(page, card('Mệt mỏi'));
    await safeUrl(page);
    await tap(page, '#btn-submit');
    const w500 = await page.evaluate('__qa.warns.length');
    /* Chờ trang cảm ơn hiện thật (400 ms) và có warn MỚI của lượt này, rồi mới bấm "check-in khác" như người dùng */
    await waitFor(page, "JSON.parse(localStorage.getItem('checkin_me_bau_queue') || '[]').length === 1 && __qa.warns.length > " + w500 + " && getComputedStyle(document.getElementById('page-success')).display !== 'none'", 3000);
    const qq = JSON.parse(await page.evaluate("localStorage.getItem('checkin_me_bau_queue') || '[]'"));
    T('Máy chủ 500: hàng chờ giữ 1 lượt "Mệt mỏi", mức 1, mã "0912345"', qq.length === 1 && qq[0].payload.part2 === 'Mệt mỏi' && qq[0].payload.level === 1 && qq[0].payload.patientId === '0912345', JSON.stringify(qq));
    const sup = await page.evaluate("document.getElementById('support-box').open");
    T('Mức 1: khung Hỗ trợ tự mở ở trang cảm ơn', sup === true);
    /* Lượt thứ hai cũng rơi vào hàng chờ, rồi có mạng */
    await page.evaluate("document.querySelector('[data-act=restart]').click(); true");
    await sleep(200);
    await typeId(page, '26012345'); await tap(page, dot(7)); await tap(page, card('Cô đơn'));
    const w2 = await page.evaluate('__qa.warns.length');
    const p2 = mock.st.posts.length;
    await tap(page, '#btn-submit');
    /* Chờ lần gửi NGAY của lượt 2 bị 500 xong (có POST mới + warn mới) rồi mới đổi mock sang ok,
       nếu không lượt 2 có thể lọt vào Sheet giả trước khi đếm rowsBefore (code-reviewer lượt 2) */
    const w2ok = await waitFor(page, "JSON.parse(localStorage.getItem('checkin_me_bau_queue') || '[]').length === 2 && __qa.warns.length > " + w2 + " && getComputedStyle(document.getElementById('page-success')).display !== 'none'", 5000);
    T('Lượt 2 gửi ngay bị 500: có POST, có warn "sẽ thử lại", hàng chờ 2 lượt', !!w2ok && mock.st.posts.length === p2 + 1, (mock.st.posts.length - p2) + ' POST');
    mock.st.mode = 'ok';
    const rowsBefore = mock.st.rows.length;
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    const added = mock.st.rows.slice(rowsBefore).map(r => r.part2 + '/' + r.level);
    if (process.env.QA_DEBUG) console.log('DEBUG queue=', await page.evaluate("localStorage.getItem('checkin_me_bau_queue')"), 'rows=', JSON.stringify(mock.st.rows.map(r => r.part2 + '/' + r.level)), 'warns=', await page.evaluate('JSON.stringify(__qa.warns)'));
    T('Có mạng lại: gửi đủ 2 lượt theo thứ tự, chuỗi "Cô đơn" nguyên vẹn, hàng chờ trống', added.join(',') === 'Mệt mỏi/1,Cô đơn/7' && (await page.evaluate("localStorage.getItem('checkin_me_bau_queue')")) === null, added.join(','));
    T('Không console.error / alert', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0);
  } finally { mock.st.mode = 'ok'; kill(); }
}

/* ---------- 6. Giảm chuyển động: nhắc thiếu mức cuộn tức thì ---------- */
async function sReduced() {
  const { page, kill } = await open({ reduced: true, height: 640 });
  try {
    await typeId(page, '26012345'); await tap(page, card('Đau khổ'));
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight); true');
    await tap(page, '#btn-submit');
    await sleep(30);
    const vis = await page.evaluate("(() => { const b = document.getElementById('level-dots').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; })()");
    T('reduce: thiếu mức → 10 chấm vào màn hình ngay (cuộn không mượt), focus chấm 1', vis && (await state(page)).active === '1');
    const tr = await page.evaluate("getComputedStyle(document.querySelector('.level-dot')).transitionDuration");
    T('reduce: chấm không có chuyển động (transition ≈ 0)', /^(0s|1e-05s|0\.00001s)$/.test(tr), tr);
  } finally { kill(); }
}

/* ---------- 7. Quét bề ngang 300–800 px: không cuộn ngang, 2×5 / 1×10, chấm ≥ 44 px, chấm không lấn ra khỏi card ---------- */
async function sWidths() {
  const { page, kill } = await open();
  try {
    const bad = [], info = [], edge = [], padOver = [];
    for (const w of [300, 320, 340, 360, 375, 390, 412, 440, 480, 540, 599, 600, 610, 620, 640, 700, 768, 800]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 600 });
      await tap(page, dot(10)); /* chấm phóng 1.14 khi chọn */
      await sleep(80);
      const m = await page.evaluate(`(() => { const ds = [...document.querySelectorAll('.level-dot')]; const g = document.getElementById('level-dots').getBoundingClientRect();
        const card = document.querySelector('.checkin-card').getBoundingClientRect(); const cs = getComputedStyle(document.querySelector('.checkin-card'));
        const inner = { l: card.left + parseFloat(cs.paddingLeft), r: card.right - parseFloat(cs.paddingRight) };
        const L = Math.min(...ds.map(d => d.getBoundingClientRect().left)), R = Math.max(...ds.map(d => d.getBoundingClientRect().right));
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, rows: new Set(ds.map(d => d.offsetTop)).size, minW: Math.min(...ds.map(d => d.offsetWidth)), minH: Math.min(...ds.map(d => d.offsetHeight)),
          outCard: Math.max(0, Math.round(inner.l - L), Math.round(R - inner.r)), outGroup: Math.max(0, Math.round(g.left - L), Math.round(R - g.right)),
          outEdge: Math.max(0, Math.round(card.left - L), Math.round(R - card.right)), pad: parseFloat(cs.paddingLeft) }; })()`);
      const wantRows = w <= 599 ? 2 : 1;
      info.push(w + ':' + m.rows + 'h,sw' + m.sw + ',lấn khung nhóm ' + m.outGroup + '/vào đệm card ' + m.outCard + '/qua mép card ' + m.outEdge + ' (đệm ' + m.pad + ')');
      if (m.sw > m.iw || m.rows !== wantRows || m.minW < 44 || m.minH < 44) bad.push(w + ' ' + JSON.stringify(m));
      if (w >= 320 && m.outEdge > 0) edge.push(w + ':' + m.outEdge);
      if (w >= 340 && m.outCard > 0) padOver.push(w + ':' + m.outCard);
    }
    T('300–800 px: không cuộn ngang, ≤599 → 2 hàng, ≥600 → 1 hàng, chấm ≥ 44×44', bad.length === 0, bad.join(' ; ') || info.join(' '));
    OBS('Chấm (đang chọn, phóng 1,14) lấn ra ngoài khung nhóm / vào đệm card / qua mép card (px)', info.join(' '));
    T('≥320 px: chấm đang chọn (phóng 1,14) không vượt MÉP card', edge.length === 0, edge.join(' '));
    T('≥340 px: chấm nằm trọn trong vùng nội dung card (không lấn vào đệm)', padOver.length === 0, padOver.join(' '));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 600, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.evaluate("document.getElementById('part-1').scrollIntoView(); true");
    await page.screenshot(path.join(OUT, 'shot-600.png'), false);
  } finally { kill(); }
}


/* ---------- 8. Xáo 9 thẻ (lượt 2, 02/11): DOM = thứ tự nhìn thấy, chọn đúng nhãn, phân bố đều, không lưu thứ tự ---------- */
const IMG = { 'Vui vẻ': 'vui_ve.png', 'Đau khổ': 'dau_kho.png', 'Lo lắng': 'lo_lang.png', 'Tức giận': 'tuc_gian.png', 'Hoảng hốt': 'hoang_hot.png', 'Khó chịu': 'kho_chiu.png', 'Mệt mỏi': 'met_moi.png', 'Bình an': 'binh_an.png', 'Cô đơn': 'co_don.png' };
const EMO = { 'Vui vẻ': '😊', 'Đau khổ': '😢', 'Lo lắng': '😟', 'Tức giận': '😠', 'Hoảng hốt': '😨', 'Khó chịu': '😣', 'Mệt mỏi': '😩', 'Bình an': '😌', 'Cô đơn': '🥺' };
const ORDER = "[...document.querySelectorAll('.capy-card')].map(c => c.dataset.emotion)";
const VISUAL = "[...document.querySelectorAll('.capy-card')].map(c => ({ e: c.dataset.emotion, t: Math.round(c.getBoundingClientRect().top), l: Math.round(c.getBoundingClientRect().left) })).sort((a, b) => a.t - b.t || a.l - b.l).map(x => x.e)";
/* Ma trận nhãn × vị trí sau N lần shuffleCards() ngay trong trang */
const MATRIX = n => `(() => { const L = ${JSON.stringify(LABELS)}; const m = L.map(() => Array(9).fill(0)); const perms = new Set();
  for (let k = 0; k < ${n}; k++) { shuffleCards(); const o = [...document.querySelectorAll('.capy-card')].map(c => c.dataset.emotion); o.forEach((e, p) => m[L.indexOf(e)][p]++); if (k < 2000) perms.add(o.join('|')); }
  const exp = ${n} / 9; let min = Infinity, max = 0, chi = 0; m.forEach(r => r.forEach(v => { min = Math.min(min, v); max = Math.max(max, v); chi += (v - exp) * (v - exp) / exp; }));
  return { min, max, exp, chi: Math.round(chi), distinct2000: perms.size, count: document.querySelectorAll('.capy-card').length }; })()`;
async function sShuffle(mock) {
  let { page, kill } = await open({ query: '?qaseed=7', height: 900 });
  try {
    const o1 = await page.evaluate(ORDER);
    T('Mở trang: đủ 9 thẻ, mỗi nhãn đúng 1 lần, thứ tự đã khác thứ tự gốc trong HTML (seed 7)', o1.length === 9 && o1.slice().sort().join('|') === LABELS.slice().sort().join('|') && o1.join('|') !== LABELS.join('|'), o1.join(' | '));
    T('Thứ tự DOM = thứ tự nhìn thấy (trên→dưới, trái→phải) → Tab/trình đọc đi đúng thứ tự mắt thấy', JSON.stringify(await page.evaluate(VISUAL)) === JSON.stringify(o1), (await page.evaluate(VISUAL)).join(' | '));
    const css = await page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => getComputedStyle(c).order + '/' + c.tabIndex + '/' + (c.style.order || '')).join(',') + ' flow=' + getComputedStyle(document.querySelector('.emotion-grid')).gridAutoFlow");
    T('Không dùng CSS order / tabindex dương (thứ tự chỉ do DOM)', /^(0\/0\/,){8}0\/0\/ flow=row$/.test(css), css);
    const integ = await page.evaluate(`[...document.querySelectorAll('.capy-card')].map(c => { const img = c.querySelector('img'); const box = c.querySelector('.capy-img-box'); return [c.dataset.emotion, c.getAttribute('aria-label'), img ? img.getAttribute('src') : '', box.dataset.emoji]; })`);
    const badInteg = integ.filter(([e, a, src, em]) => e !== a || src !== IMG[e] || em !== EMO[e]);
    T('Mỗi thẻ sau khi xáo: aria-label = data-emotion = đúng ảnh/emoji của nhãn đó (cả nút được dời nguyên khối)', badInteg.length === 0, JSON.stringify(badInteg));
    /* Chạm từng vị trí nhìn thấy → đúng nhãn của thẻ ở vị trí đó */
    const wrong = [];
    for (let p = 0; p < 9; p++) {
      await page.evaluate(`document.querySelectorAll('.capy-card')[${p}].click(); true`);
      const st = await state(page);
      if (st.cards !== o1[p] || st.picked !== 'Chị chọn: ' + o1[p]) wrong.push(p + ':' + st.cards + '/' + st.picked);
    }
    T('Chạm thẻ ở từng vị trí 1–9: đúng nhãn được chọn, "Chị chọn: …" đúng, chỉ 1 thẻ aria-pressed', wrong.length === 0, wrong.join(' ; '));
    /* Gửi thẻ ở vị trí 5 (giữa lưới) → payload đúng nhãn */
    await typeId(page, '26012345'); await tap(page, dot(3));
    await page.evaluate("document.querySelectorAll('.capy-card')[4].click(); true");
    await safeUrl(page);
    await tap(page, '#btn-submit');
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue') && getComputedStyle(document.getElementById('page-success')).display !== 'none'", 3000);
    const row = mock.st.rows[mock.st.rows.length - 1] || {};
    T('Gửi thẻ ở vị trí 5 → part2 = "' + o1[4] + '" (nhãn của thẻ đó), level 3', row.part2 === o1[4] && row.level === 3, JSON.stringify(row));
    /* Làm lại: xáo lại, bỏ chọn hết */
    await page.evaluate("document.querySelector('[data-act=restart]').click(); true");
    await sleep(150);
    const o2 = await page.evaluate(ORDER);
    const st2 = await state(page);
    T('"Check-in khác": thẻ xáo lại (thứ tự khác lần trước), không thẻ nào còn chọn, DOM = nhìn thấy', o2.join('|') !== o1.join('|') && o2.slice().sort().join('|') === LABELS.slice().sort().join('|') && st2.cards === '' && st2.picked === '' && JSON.stringify(await page.evaluate(VISUAL)) === JSON.stringify(o2), o2.join(' | '));
    /* Không lưu thứ tự */
    const store = await page.evaluate("({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage), ck: document.cookie, dump: JSON.stringify(Object.assign({}, localStorage, sessionStorage)) })");
    T('Không lưu thứ tự thẻ: localStorage/sessionStorage trống (hàng chờ đã gửi), không cookie', store.ls.length === 0 && store.ss.length === 0 && store.ck === '' && !LABELS.some(l => store.dump.includes(l)), JSON.stringify(store));
    /* Phân bố (tất định, seed 7): 18 000 lần xáo, mỗi ô nhãn × vị trí kỳ vọng 2 000 */
    const mx = await page.evaluate(MATRIX(18000));
    T('Phân bố seed 7, 18 000 lần: mọi ô nhãn×vị trí trong 2 000 ± 10 %, χ² (64 bậc tự do) < 110, đủ đa dạng hoán vị', mx.min >= 1800 && mx.max <= 2200 && mx.chi < 110 && mx.distinct2000 > 1500 && mx.count === 9, JSON.stringify(mx));
    /* 10 chấm không xáo */
    const dots = await page.evaluate("[...document.querySelectorAll('.level-dot')].map(d => d.dataset.level).join(',')");
    T('10 chấm KHÔNG xáo (1…10 đúng thứ tự)', dots === '1,2,3,4,5,6,7,8,9,10', dots);
    kill();
    /* crypto thật (không seed): ±15 % ở 18 000 lần ≈ 7 độ lệch chuẩn → coi như không thể chập chờn */
    ({ page, kill } = await open({ height: 900 }));
    const mr = await page.evaluate(MATRIX(18000));
    T('Phân bố crypto.getRandomValues thật, 18 000 lần: mọi ô trong 2 000 ± 15 %', mr.min >= 1700 && mr.max <= 2300 && mr.count === 9, JSON.stringify(mr));
    OBS('χ² crypto thật (kỳ vọng ≈ 64)', mr.chi);
    T('Không console.error / alert', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0);
  } finally { kill(); }
}


/* ---------- 9. Lượt 3 (02/11): 9 ảnh PNG mới tải được, đúng thẻ, lưới không vỡ 320–768 ---------- */
async function sImages() {
  const { page, kill } = await open({ height: 1400 });
  try {
    await waitFor(page, "[...document.querySelectorAll('.capy-card img')].every(i => i.complete)", 5000);
    const imgs = await page.evaluate(`[...document.querySelectorAll('.capy-card')].map(c => { const i = c.querySelector('img'); return { e: c.dataset.emotion, name: c.getAttribute('aria-label'), src: i ? i.getAttribute('src') : '', nw: i ? i.naturalWidth : 0, nh: i ? i.naturalHeight : 0, alt: i ? i.alt : null, fb: c.querySelector('.capy-img-box').classList.contains('fallback'), em: c.querySelector('.capy-img-box').dataset.emoji }; })`);
    const bad = imgs.filter(x => x.src !== IMG[x.e] || x.nw !== 480 || x.nh !== 480 || x.fb || x.alt !== '' || x.name !== x.e || x.em !== EMO[x.e]);
    T('9 ảnh PNG mới tải được 480×480, không rơi về emoji, đúng file theo nhãn (dau_kho.png ↔ Đau khổ…), img alt="" (tên đọc ở aria-label), emoji dự phòng đúng', imgs.length === 9 && bad.length === 0, JSON.stringify(bad.length ? bad : imgs.map(x => x.e + '=' + x.src)));
    T('Tên thẻ (aria-label) đúng 9 tên mới, không còn Buồn / Bình yên / Tủi thân', imgs.map(x => x.name).slice().sort().join('|') === LABELS.slice().sort().join('|') && !imgs.some(x => /Buồn|Bình yên|Tủi thân/.test(x.name)));
    const jpg = await page.evaluate("[...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => /\\.jpg/i.test(s))");
    T('Trang không còn dùng ảnh .jpg cũ', jpg.length === 0, jpg.join(','));
    const fails = await page.evaluate("performance.getEntriesByType('resource').filter(r => /\\.png/.test(r.name) && r.responseStatus && r.responseStatus !== 200).map(r => r.name + ':' + r.responseStatus)");
    T('Không có ảnh PNG nào trả mã lỗi', fails.length === 0, fails.join(','));
    /* Ảnh khớp thẻ sau nhiều lần xáo (3 lần "check-in khác") */
    const mism = [];
    for (let k = 0; k < 3; k++) {
      await page.evaluate("resetCheckin(); true");
      const pairs = await page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => [c.getAttribute('aria-label'), c.querySelector('img').getAttribute('src'), c.querySelector('img').naturalWidth])");
      pairs.forEach(([n, src, w]) => { if (IMG[n] !== src || w !== 480) mism.push(k + ':' + n + '=' + src); });
    }
    T('Sau 3 lần xáo lại: mọi thẻ vẫn giữ đúng ảnh của nhãn, ảnh vẫn hiển thị', mism.length === 0, mism.join(','));
    /* Lưới 320–768: 3 cột × 3 hàng, không cuộn ngang, thẻ ≥ 44 px, ảnh vuông nằm trọn trong thẻ */
    const badW = [], info = [];
    for (const w of [320, 360, 375, 412, 440, 600, 768]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 1400, deviceScaleFactor: 1, mobile: w < 600 });
      await page.evaluate("document.querySelectorAll('.capy-card')[4].click(); true");
      await sleep(120);
      const m = await page.evaluate(`(() => { const cs = [...document.querySelectorAll('.capy-card')];
        /* offsetTop/Left: không tính transform của thẻ đang chọn (phóng 1,02) */ const rows = new Set(cs.map(c => c.offsetTop)).size, cols = new Set(cs.map(c => c.offsetLeft)).size;
        const out = cs.filter(c => { const a = c.getBoundingClientRect(), b = c.querySelector('.capy-img-box').getBoundingClientRect(); return b.left < a.left - 0.5 || b.right > a.right + 0.5 || b.top < a.top - 0.5 || b.bottom > a.bottom + 0.5 || Math.abs(b.width - b.height) > 1; }).map(c => c.dataset.emotion);
        const grid = document.querySelector('.emotion-grid').getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, rows, cols, minW: Math.min(...cs.map(c => c.offsetWidth)), minH: Math.min(...cs.map(c => c.offsetHeight)), out, gridOver: grid.right > innerWidth + 0.5 || grid.left < -0.5, imgW: Math.round(cs[0].querySelector('.capy-img-box').getBoundingClientRect().width) }; })()`);
      info.push(w + ':' + m.rows + 'x' + m.cols + ',thẻ≥' + m.minW + 'x' + m.minH + ',ảnh' + m.imgW);
      if (m.sw > m.iw || m.rows !== 3 || m.cols !== 3 || m.minW < 44 || m.minH < 44 || m.out.length || m.gridOver) badW.push(w + ' ' + JSON.stringify(m));
    }
    T('Lưới 9 thẻ 320–768 px: 3×3, không cuộn ngang, thẻ ≥ 44 px, ảnh vuông nằm trọn trong thẻ (kể cả thẻ đang chọn phóng)', badW.length === 0, badW.join(' ; ') || info.join(' '));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 2, mobile: true });
    await page.evaluate("document.getElementById('part-2').scrollIntoView(); true");
    await sleep(150);
    await page.screenshot(path.join(OUT, 'shot-luoi-320.png'), false);
    T('Không console.error / alert', (await page.evaluate('__qa.errors.length + __qa.alerts.length')) === 0, await page.evaluate('JSON.stringify(__qa.errors)'));
  } finally { kill(); }
}

/* ---------- 10. Hàng chờ CŨ (web 01/11 lưu "Buồn") vẫn gửi được bằng web mới ---------- */
async function sLegacyQueue(mock) {
  const { page, kill } = await open();
  try {
    const sid = 'legacy-buon-0001';
    const entry = { payload: { sessionId: sid, tappedAt: Date.now() - 3600e3, patientId: '0012345', level: 4, part1: '4 - Kém', part2: 'Buồn' }, queuedAt: Date.now() - 3600e3 };
    await page.evaluate(`localStorage.setItem('checkin_me_bau_queue', ${JSON.stringify(JSON.stringify([entry]))}); true`);
    await safeUrl(page);
    await page.navigate(APP_URL);
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 4000);
    const rows = mock.st.rows.filter(r => r.sessionId === sid);
    T('Hàng chờ cũ có lượt "Buồn": mở web mới → gửi lại nguyên chữ "Buồn" (không đổi thành "Đau khổ"), hàng chờ trống', rows.length === 1 && rows[0].part2 === 'Buồn' && rows[0].level === 4 && rows[0].patientId === '0012345' && (await page.evaluate("localStorage.getItem('checkin_me_bau_queue')")) === null, JSON.stringify(rows));
    T('ageMs ≈ 1 giờ (máy chủ suy ra giờ bấm cũ)', rows[0] && rows[0].ageMs >= 3600e3 && rows[0].ageMs < 3600e3 + 60e3, rows[0] && rows[0].ageMs);
    T('Không console.error', (await page.evaluate('__qa.errors.length')) === 0);
  } finally { kill(); }
}

(async () => {
  const mock = await startMock();
  const srv = await startStatic({ port: STATIC_PORT, appDir: APP, mockUrl: mock.url });
  const before = fs.readFileSync(path.join(APP, 'script.js'), 'utf8');
  const list0 = [['change', sChange], ['badid', sBadIdNoLevel], ['keys', sKeys], ['a11y', sA11y], ['server', sServer], ['reduced', sReduced], ['widths', sWidths], ['shuffle', sShuffle], ['images', sImages], ['legacy', sLegacyQueue]];
  const list = process.env.QA_ONLY ? list0.filter(x => process.env.QA_ONLY.split(',').includes(x[0])) : list0;
  for (const [n, f] of list) {
    scen = n;
    try { await f(mock); } catch (e) { fail++; console.log('CRASH [' + n + '] ' + (e && e.stack || e)); }
  }
  scen = 'dọn';
  T('script.js trên đĩa không đổi', fs.readFileSync(path.join(APP, 'script.js'), 'utf8') === before);
  await srv.close(); await mock.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL (ảnh: ' + OUT + ')');
  process.exit(fail ? 1 : 0);
})();
