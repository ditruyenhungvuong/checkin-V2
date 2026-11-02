/* =========================================================
   E2E – Check-in Cảm Xúc Mẹ Bầu (QA). Chrome headless thật qua DevTools Protocol.
   Dùng lại thư viện CDP của app checkin-vao-ca (tests/lib/cdp.js), server tĩnh và mock Sheet riêng ở tests/lib.

   Chạy:  node tests/e2e.js [--out=<thư mục kết quả>] [--only=main,patientid,...]
   Kịch bản: main | keyboard | level | shuffle | oldserver | patientid | xss | offline | down | hang | double | imgfail | layout | reduced | music | noadmin | sharedkeys

   02/11/2026: 10 chấm bấm thay thanh trượt (KHÔNG mức mặc định, radiogroup, phím mũi tên), 9 thẻ chỉ hình
   (bộ 9 ảnh PNG mới, tên theo ảnh: Đau khổ, Bình an, Cô đơn…), nút Hoàn thành chưa đủ thì aria-disabled nhưng chạm vào được để nhắc chỗ thiếu.
   Đợt sửa 2 (02/11/2026): 9 thẻ xáo thứ tự mỗi lượt mới. Thứ tự thẻ KHÔNG cố định nên test chọn thẻ theo tên;
   kịch bản shuffle mở trang kèm ?qaseed=N để crypto.getRandomValues ra dãy cố định (không chập chờn).

   Bản 28/10/2026: app đã sửa theo docs/qa/checkin-me-bau-tong-hop.md (bỏ admin, escape, bàn phím, Mã số bệnh nhân (01/11/2026, thay SĐT),
   hàng chờ gửi lại, nhạc mặc định tắt…). Test kiểm hành vi MỚI; những gì cố ý giữ chờ anh Thông quyết
   (nhãn 10 mức, ảnh "Lo lắng", nút "Thực hiện check-in khác", mã số bắt buộc) được kiểm là "giữ nguyên".

   AN TOÀN (bắt buộc, vì script.js vẫn giữ URL Apps Script THẬT của anh Thông cho tới khi anh dán URL mới):
   1. static-server thay đúng dòng `const GOOGLE_SCRIPT_URL = '...';` bằng URL mock trong bộ nhớ, và throw nếu
      chuỗi phục vụ còn chứa `script.google.com` (file trên đĩa không đổi).
   2. HOOK cài vào trang trước khi app chạy: window.fetch từ chối mọi URL chứa script.google.com.
   3. Fetch domain của Chrome chặn mọi request tới *script.google.com* (và giả lập Google Fonts để không ra mạng ngoài).
   4. Trước MỖI lần bấm "Hoàn thành": đọc lại GOOGLE_SCRIPT_URL trong trang qua Runtime.evaluate; có script.google.com → throw, không bấm.
   Kết thúc: tắt server, tắt đúng Chrome của test theo PID (child.kill), không đụng Chrome của anh.
   Mọi file kết quả ghi vào thư mục tạm (--out), không ghi vào thư mục app.
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launch, sleep } = require(path.join(__dirname, '..', '..', 'checkin-vao-ca', 'tests', 'lib', 'cdp.js'));
const { startStatic } = require('./lib/static-server');
const { startMock } = require('./lib/mock-sheet');

const APP = path.resolve(__dirname, '..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true]; }));
const OUT = path.resolve(argv.out || path.join(os.tmpdir(), 'checkin-me-bau-qa'));
fs.mkdirSync(OUT, { recursive: true });

const STATIC_PORT = 8866;
const MOCK_PORT = 8877;
const APP_URL = 'http://127.0.0.1:' + STATIC_PORT + '/index.html';

/* Chuỗi nguyên văn trong app (index.html / script.js) */
const TXT = {
  hintAll: '💡 Chị nhập mã số bệnh nhân, chạm chọn một mức và 1 bé Capybara là xong nhé.',
  hintLevel: '💡 Chị chạm chọn một mức cảm xúc ở Phần 1 nhé.',
  levelError: 'Chị chạm chọn một mức từ 1 đến 10 nhé.',
  picked: 'Chị chọn: ',
  hintId: '💡 Chị nhập mã số bệnh nhân ở trên giúp mình nhé.',
  hintIdBad: '💡 Mã số bệnh nhân chưa đúng, chị xem lại giúp mình nhé.',
  hintCard: '💡 Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.',
  hintDone: '✨ Xong rồi, chị chạm nút Hoàn thành nhé!',
  idError: 'Chị nhập mã số bệnh nhân (chỉ gồm chữ số, ví dụ 26012345) nhé.',
  toastCard: 'Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.',
  toastMusic: 'Chưa mở được nhạc, chị thử lại sau nhé.',
  btnIdle: 'Hoàn thành Check-in →',
  btnSaving: 'Đang lưu Check-in…',
  successTitle: 'Cảm ơn chị đã check-in cảm xúc của mình',
  restart: '🌸 Thực hiện check-in khác',
  logSaved: '[Check-in] Đã lưu lên Google Sheet:',
  warnRetry: '[Check-in] Chưa gửi được, sẽ thử lại sau:',
  warnReject: '[Check-in] Máy chủ từ chối lượt này, không gửi lại:'
};
/* Nhãn GIỮ NGUYÊN (chờ anh chọn phương án), màu chữ đã đổi cho đủ tương phản */
const LEVELS = [null, 'Tuyệt vọng', 'Rất tồi tệ', 'Tồi tệ', 'Kém', 'Bình thường (Ổn)', 'Tương đối tốt', 'Tốt', 'Rất tốt', 'Tuyệt vời', 'Rất tuyệt vời'];
const LEVEL_COLORS = [null, '#1a237e', '#4a148c', '#7d3a55', '#9c456b', '#a14d00', '#8a5a00', '#7a6400', '#5b6b00', '#2e7d32', '#1b5e20'];
const LEVEL_EMOJI = [null, '😞', '😔', '😟', '🙁', '😐', '🙂', '😊', '😄', '😁', '🥰'];
const CARDS = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];
/* 02/11/2026: bộ 9 ảnh mới của anh (PNG 480×480 nền trong suốt) */
const CARD_IMG = { 'Vui vẻ': 'vui_ve.png', 'Đau khổ': 'dau_kho.png', 'Lo lắng': 'lo_lang.png', 'Tức giận': 'tuc_gian.png', 'Hoảng hốt': 'hoang_hot.png', 'Khó chịu': 'kho_chiu.png', 'Mệt mỏi': 'met_moi.png', 'Bình an': 'binh_an.png', 'Cô đơn': 'co_don.png' };
const CARD_EMOJI = { 'Vui vẻ': '😊', 'Đau khổ': '😢', 'Lo lắng': '😟', 'Tức giận': '😠', 'Hoảng hốt': '😨', 'Khó chịu': '😣', 'Mệt mỏi': '😩', 'Bình an': '😌', 'Cô đơn': '🥺' };
const SID_RE = /^[0-9A-Za-z-]{8,40}$/;
const hex2rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';

/* ===== Ghi kết quả ===== */
const results = [];
let scenarioName = '';
let fails = 0;
let safeChecks = 0; // số lần xác nhận URL an toàn trước khi bấm
function T(name, ok, detail) {
  if (!ok) fails++;
  const line = (ok ? 'PASS ' : 'FAIL ') + '[' + scenarioName + '] ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 260) : '');
  results.push(line); console.log(line);
}
function FLAKY(name, ok, detail) {
  const line = (ok ? 'PASS ' : 'CHẬP CHỜN ') + '[' + scenarioName + '] ' + name + (detail !== undefined ? '  → ' + String(detail).replace(/\s+/g, ' ').slice(0, 260) : '');
  results.push(line); console.log(line);
}
function note(text) { results.push('NOTE [' + scenarioName + '] ' + text); console.log('NOTE ' + text); }

/* ===== Script cài vào trang TRƯỚC khi app chạy ===== */
const HOOK = `(() => {
  window.__qa = { logs: [], warns: [], errors: [], alerts: [], confirms: [], fetches: [], capySrc: [], vibrate: [], successShownAt: 0, clickAt: 0 };
  const ol = console.log.bind(console), ow = console.warn.bind(console), oe = console.error.bind(console);
  console.log = (...a) => { __qa.logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); ol(...a); };
  console.warn = (...a) => { __qa.warns.push(a.map(String).join(' ')); ow(...a); };
  console.error = (...a) => { __qa.errors.push(a.map(String).join(' ')); oe(...a); };
  window.addEventListener('error', e => __qa.errors.push('window.onerror: ' + e.message));
  window.addEventListener('unhandledrejection', e => __qa.errors.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
  window.alert = m => { __qa.alerts.push(String(m)); };
  window.confirm = m => { __qa.confirms.push(String(m)); return true; };
  const of = window.fetch.bind(window);
  window.fetch = (url, init) => {
    const u = String(url);
    if (u.includes('script.google.com')) { __qa.errors.push('AN TOÀN: app gọi fetch tới script.google.com – đã chặn'); return Promise.reject(new Error('QA chặn script.google.com')); }
    __qa.fetches.push({ t: performance.now(), url: u, method: init && init.method || 'GET', headers: init && init.headers || {}, body: init && init.body });
    return of(url, init);
  };
  /* ?qaseed=N: thay crypto.getRandomValues bằng dãy giả ngẫu nhiên cố định (mulberry32) để thứ tự thẻ tái lập được */
  const seedM = /[?&]qaseed=(\\d+)/.exec(location.search);
  __qa.rng = 0;
  if (seedM && window.crypto) {
    let st = Number(seedM[1]) >>> 0;
    const next = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
    Object.defineProperty(window.crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { __qa.rng++; for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; } });
  }
  try { Object.defineProperty(navigator, 'vibrate', { value: ms => { __qa.vibrate.push(ms); return true; }, configurable: true }); } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    const capy = document.getElementById('current-capy');
    if (capy) new MutationObserver(ms => ms.forEach(m => __qa.capySrc.push((m.target.getAttribute('src') || '').split('/').pop()))).observe(capy, { attributes: true, attributeFilter: ['src'] });
    const ps = document.getElementById('page-success');
    if (ps) new MutationObserver(() => { if (!__qa.successShownAt && getComputedStyle(ps).display !== 'none') __qa.successShownAt = performance.now(); }).observe(ps, { attributes: true, attributeFilter: ['style', 'class'] });
    const b = document.getElementById('btn-submit');
    if (b) b.addEventListener('click', () => { if (!__qa.clickAt) __qa.clickAt = performance.now(); }, true);
  });
})();`;

/* ===== Mở trang với mọi thứ giả lập ===== */
async function openApp(opts) {
  const o = opts || {};
  const ud = path.join(OUT, 'ud-' + scenarioName);
  const { page, kill, child } = await launch({ userDataDir: ud, width: o.width || 375, height: o.height || 667 });
  const browserLog = [];
  const consoleApi = [];
  const requests = [];
  page.on('Log.entryAdded', p => browserLog.push(p.entry.level + ': ' + p.entry.text + (p.entry.url ? ' @' + p.entry.url : '')));
  page.on('Runtime.consoleAPICalled', p => consoleApi.push(p.type + ': ' + p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ')));
  page.on('Network.requestWillBeSent', p => requests.push({ t: Date.now(), url: p.request.url, method: p.request.method, type: p.type, postData: p.request.postData }));
  /* Google Fonts giả lập (không ra mạng ngoài); script.google.com chặn cứng.
     o.failAssets: ảnh/nhạc trong thư mục app trả 404 (giả lập thiếu file, vì thư mục giờ đã có đủ ảnh/nhạc) */
  const patterns = [{ urlPattern: '*fonts.googleapis.com/*' }, { urlPattern: '*fonts.gstatic.com/*' }, { urlPattern: '*script.google.com/*' }];
  if (o.failAssets) patterns.push({ urlPattern: '*.jpg*' }, { urlPattern: '*.png*' }, { urlPattern: '*.mp3*' });
  await page.send('Fetch.enable', { patterns });
  page.on('Fetch.requestPaused', async p => {
    try {
      if (p.request.url.includes('script.google.com')) {
        await page.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
      } else if (o.failAssets && /\.(jpg|png|mp3)(\?|$)/.test(p.request.url)) {
        await page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 404, responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: Buffer.from('not found').toString('base64') });
      } else {
        await page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/css' }], body: Buffer.from('/* fonts giả lập */').toString('base64') });
      }
    } catch (e) { /* request đã bị hủy */ }
  });
  await page.send('Emulation.setDeviceMetricsOverride', { width: o.width || 375, height: o.height || 667, deviceScaleFactor: 2, mobile: true });
  if (o.reducedMotion) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  await page.navigate(APP_URL + (o.query || ''));
  if (!o.keepStorage) await page.evaluate("localStorage.clear(); true");
  return { page, kill, chromePid: child.pid, browserLog, consoleApi, requests };
}

/* ===== Tiện ích đọc trang ===== */
const text = (page, sel) => page.evaluate(`((document.querySelector(${JSON.stringify(sel)}) || { textContent: '' }).textContent || '').trim()`);
const qa = page => page.evaluate('JSON.parse(JSON.stringify(window.__qa))');
const hint = page => text(page, '#submit-hint');
/* disabled = chưa đủ điều kiện (aria-disabled) HOẶC đang gửi (disabled thật) */
const btn = page => page.evaluate("(() => { const b = document.getElementById('btn-submit'); const cs = getComputedStyle(b); return { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true', ariaDisabled: b.getAttribute('aria-disabled'), realDisabled: b.disabled, ready: b.classList.contains('ready'), text: b.innerText.trim(), opacity: cs.opacity, transform: cs.transform, anim: cs.animationName, pe: cs.pointerEvents }; })()");
const cards = page => page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => { const img = c.querySelector('img'); return { tag: c.tagName, type: c.getAttribute('type'), name: c.getAttribute('aria-label'), text: c.innerText.replace(/[\\s✓]/g, ''), data: c.dataset.emotion, selected: c.classList.contains('selected'), pressed: c.getAttribute('aria-pressed'), badge: getComputedStyle(c.querySelector('.check-mark-badge')).display, src: img ? (img.getAttribute('src') || '') : '', alt: img ? img.alt : '', natural: img ? img.naturalWidth : 0, fallback: c.querySelector('.capy-img-box').classList.contains('fallback'), after: getComputedStyle(c.querySelector('.capy-img-box'), '::after').content, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height }; })");
/* Trạng thái 10 chấm + ảnh + nhãn: value = mức đang aria-checked ('' khi chưa chọn) */
const level = page => page.evaluate("(() => { const dots = [...document.querySelectorAll('.level-dot')]; const on = dots.filter(d => d.getAttribute('aria-checked') === 'true'); const img = document.getElementById('current-capy'); const st = document.getElementById('current-status'); const em = document.getElementById('current-capy-emoji'); return { count: dots.length, value: on.length === 1 ? on[0].dataset.level : (on.length ? 'nhiều' : ''), selectedCls: dots.filter(d => d.classList.contains('selected')).map(d => d.dataset.level).join(), tabbable: dots.filter(d => d.tabIndex === 0).map(d => d.dataset.level).join(), status: st.textContent, color: getComputedStyle(st).color, inlineColor: st.style.color, src: (img.getAttribute('src') || '').split('/').pop(), alt: img.alt, natural: img.naturalWidth, imgHidden: img.hidden, emojiHidden: em.hidden, emoji: em.textContent, w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, ew: em.offsetWidth, eh: em.offsetHeight, error: document.getElementById('level-error').textContent, need: document.getElementById('level-dots').classList.contains('need') }; })()");
const activeDot = page => page.evaluate("(document.activeElement && document.activeElement.classList.contains('level-dot')) ? document.activeElement.dataset.level : ''");
/* Phím mũi tên lên/xuống (cdp.js dùng chung không có) – bấm phím thật qua CDP */
async function keyRaw(page, key, vk) {
  const base = { key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await page.send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
  await page.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}
const successVisible = page => page.evaluate("getComputedStyle(document.getElementById('page-success')).display !== 'none'");
const checkinVisible = page => page.evaluate("getComputedStyle(document.getElementById('page-checkin')).display !== 'none'");
/* Hàng chờ gửi lại (chỉ giữ lượt CHƯA gửi được) */
const QKEY = 'checkin_me_bau_queue';
const queue = page => page.evaluate("JSON.parse(localStorage.getItem('checkin_me_bau_queue') || '[]')");
const toastText = page => page.evaluate("(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; })()");
const uniq = arr => [...new Set(arr)];
const idVal = page => page.evaluate("document.getElementById('input-patient-id').value");
async function waitFor(page, expr, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 3000)) {
    const v = await page.evaluate(expr);
    if (v) return v;
    await sleep(25);
  }
  return null;
}
async function typeId(page, value) {
  await page.evaluate("(() => { const i = document.getElementById('input-patient-id'); i.focus(); i.select(); return true; })()");
  if (value === '') { await page.key('Backspace'); return; }
  await page.send('Input.insertText', { text: value });
}
/* Chạm chấm mức bằng chuột thật (CDP), thử lại nếu trang đang trôi */
async function pickLevel(page, v) {
  const sel = '.level-dot[data-level="' + v + '"]';
  for (let i = 0; i < 3; i++) {
    await settleScroll(page);
    await page.click(sel);
    if (await waitFor(page, `document.querySelector(${JSON.stringify(sel)}).getAttribute('aria-checked') === 'true'`, 400)) return true;
  }
  return false;
}
async function pickCard(page, name) {
  const sel = '.capy-card[data-emotion="' + name + '"]';
  for (let i = 0; i < 3; i++) {
    await settleScroll(page);
    await page.click(sel);
    if (await waitFor(page, `document.querySelector(${JSON.stringify(sel)}).classList.contains('selected')`, 400)) return true;
  }
  return false;
}
/* App gọi scrollTo({behavior:'smooth'}) sau khi gửi/reset; chờ trang ngừng trôi rồi mới click, nếu không click trượt vị trí */
async function settleScroll(page) {
  /* Một scrollTo instant hủy cuộn mượt đang dở (headless chỉ tiến frame khi có sự kiện nên chờ không đủ) */
  await page.evaluate("window.scrollTo({ top: window.scrollY, left: 0, behavior: 'instant' }); true");
  const t0 = Date.now();
  let prev = await page.evaluate('scrollY');
  while (Date.now() - t0 < 1500) {
    await sleep(60);
    const cur = await page.evaluate('scrollY');
    if (cur === prev) return;
    prev = cur;
  }
}
const READY_EXPR = "(() => { const b = document.getElementById('btn-submit'); return b.classList.contains('ready') && !b.disabled && b.getAttribute('aria-disabled') === 'false'; })()";
const waitReady = page => waitFor(page, READY_EXPR, 3000);

/* AN TOÀN: đọc lại URL trong trang ngay trước khi bấm. Có script.google.com → throw, không bấm. */
async function assertSafeUrl(page) {
  const u = await page.evaluate("typeof GOOGLE_SCRIPT_URL === 'string' ? GOOGLE_SCRIPT_URL : '__KHONG_DOC_DUOC__'");
  if (u === '__KHONG_DOC_DUOC__' || u.includes('script.google.com') || !/^http:\/\/127\.0\.0\.1:\d+\//.test(u)) {
    throw new Error('AN TOÀN: GOOGLE_SCRIPT_URL trong trang = "' + u + '" – KHÔNG bấm Hoàn thành, dừng test');
  }
  safeChecks++;
  return u;
}
/* Chờ nút sẵn sàng → kiểm URL → bấm → chờ trang cảm ơn. */
async function submit(page) {
  if (!(await waitReady(page))) return false;
  await assertSafeUrl(page);
  await settleScroll(page);
  const before = await page.evaluate('__qa.fetches.length');
  await page.click('#btn-submit');
  if (await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2000)) return true;
  /* Cú chạm trượt (headless: trang đang trôi/animation chưa chạy frame). Ghi chẩn đoán, bấm lại 1 lần nếu chưa có POST nào. */
  const diag = await page.evaluate("(() => { const b = document.getElementById('btn-submit').getBoundingClientRect(); return { btn: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], scrollY: Math.round(scrollY), innerH: innerHeight, ready: document.getElementById('btn-submit').classList.contains('ready'), disabled: document.getElementById('btn-submit').disabled, fetches: __qa.fetches.length }; })()");
  note('submit: cú chạm đầu không ăn, chẩn đoán ' + JSON.stringify(diag));
  if (diag.fetches !== before || diag.disabled) return false;
  await settleScroll(page);
  await page.click('#btn-submit');
  return !!(await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2500));
}
async function restart(page) {
  await settleScroll(page);
  await page.click('.btn-restart');
  await waitFor(page, "getComputedStyle(document.getElementById('page-checkin')).display !== 'none'", 2000);
  await settleScroll(page);
}
const externalReqs = reqs => reqs.filter(r => !/^http:\/\/127\.0\.0\.1:/.test(r.url) && !/^data:|^about:/.test(r.url));
const saveConsole = (name, consoleApi, browserLog, s) => fs.writeFileSync(path.join(OUT, 'console-' + name + '.txt'), ['--- Runtime.consoleAPICalled ---'].concat(consoleApi, ['--- Log.entryAdded ---'], browserLog, ['--- __qa.logs ---'], s.logs, ['--- __qa.warns ---'], s.warns, ['--- __qa.errors ---'], s.errors, ['--- __qa.alerts ---'], s.alerts).join('\n'));
const nonAssetLog = browserLog => browserLog.filter(l => !/\.(jpg|png|mp3)\b/.test(l));

/* Dựng môi trường chung cho một kịch bản */
async function setup(openOpts) {
  const mock = await startMock(MOCK_PORT);
  const srv = await startStatic({ port: STATIC_PORT, appDir: APP, mockUrl: mock.url });
  const env = await openApp(openOpts);
  return Object.assign({ mock, srv }, env);
}
async function teardown(e) {
  if (!e) return;
  if (e.kill) e.kill();
  if (e.srv) await e.srv.close();
  if (e.mock) await e.mock.close();
}


/* ================= main: luồng chính ================= */
async function scenarioMain() {
  let e;
  try {
    e = await setup({});
    const { page, requests, browserLog, consoleApi, srv, mock } = e;
    T('AN TOÀN: script.js trên đĩa còn URL thật, bản phục vụ KHÔNG chứa script.google.com', srv.originalHadRealUrl && !srv.servedScript.includes('script.google.com') && srv.servedScript.includes(mock.url));
    T('AN TOÀN: GOOGLE_SCRIPT_URL trong trang là URL mock', (await page.evaluate('GOOGLE_SCRIPT_URL')) === mock.url, await page.evaluate('GOOGLE_SCRIPT_URL'));

    /* --- Tải trang --- */
    T('Tải: title "Check-in Cảm Xúc Mẹ Bầu", lang=vi', (await page.evaluate('document.title')) === 'Check-in Cảm Xúc Mẹ Bầu' && (await page.evaluate('document.documentElement.lang')) === 'vi');
    /* Kaspersky trên máy test tự chèn script gc.kis.v2.scr.kaspersky-labs.com vào mọi trang http – của môi trường, không phải app */
    T('Tải: không request nào ra ngoài 127.0.0.1 (ngoài Google Fonts đã giả lập, bỏ qua Kaspersky của máy)', externalReqs(requests).every(r => /fonts\.g(oogleapis|static)\.com|kaspersky-labs\.com/.test(r.url)), externalReqs(requests).map(r => r.url).join(' '));
    if (requests.some(r => /kaspersky-labs\.com/.test(r.url))) note('Máy test có Kaspersky chèn script vào trang (gc.kis.v2.scr.kaspersky-labs.com) – bỏ qua, không phải của app.');
    T('AN TOÀN: 0 request tới script.google.com', !requests.some(r => r.url.includes('script.google.com')));
    T('Tải: nhạc preload="none" → 0 request tới background-music.mp3 lúc mở trang', requests.filter(r => /background-music\.mp3/.test(r.url)).length === 0, requests.filter(r => /mp3/.test(r.url)).map(r => r.url).join(' '));
    T('Tải: hint ban đầu "chưa có gì", nút aria-disabled (chưa .ready), không disabled thật', (await hint(page)) === TXT.hintAll && (await btn(page)).ariaDisabled === 'true' && !(await btn(page)).realDisabled && !(await btn(page)).ready, await hint(page));
    await sleep(350);
    let b = await btn(page);
    T('Tải: nút chưa thức dậy – mờ 0.45, co 0.96, không đập nhịp (vẫn chạm được để được nhắc)', b.opacity === '0.45' && b.transform === 'matrix(0.96, 0, 0, 0.96, 0, 0)' && b.anim === 'none' && b.pe === 'auto', JSON.stringify(b));
    T('Tải: chữ nút "Hoàn thành Check-in →"', b.text === TXT.btnIdle, b.text);
    let lv = await level(page);
    T('Tải: 10 chấm, KHÔNG chấm nào được chọn (không mặc định 5), chữ mức trống', lv.count === 10 && lv.value === '' && lv.selectedCls === '' && lv.status === '', JSON.stringify(lv));
    T('Tải: chưa có ảnh mức (img ẩn, không src), khung hiện hoa 🌸', lv.imgHidden && lv.src === '' && !lv.emojiHidden && lv.emoji === '🌸', JSON.stringify({ src: lv.src, hidden: lv.imgHidden, emoji: lv.emoji }));
    T('Tải: roving tabindex – chỉ chấm 1 nhận Tab', lv.tabbable === '1', lv.tabbable);
    T('Tải: nhóm chấm role=radiogroup, 10 role=radio, nhãn "Mức 7, Tốt"…', (await page.evaluate("(() => { const g = document.getElementById('level-dots'); const d = [...g.querySelectorAll('[role=radio]')]; return g.getAttribute('role') === 'radiogroup' && g.getAttribute('aria-labelledby') === 'part1-title' && d.length === 10 && d.every((x, i) => x.getAttribute('aria-label') === 'Mức ' + (i + 1) + ', ' + " + JSON.stringify(LEVELS.slice(1)) + "[i] && x.getAttribute('aria-checked') === 'false'); })()")));
    const c0 = await cards(page);
    T('Tải: 9 thẻ là <button type=button>, chưa chọn, aria-pressed=false, aria-label = data-emotion, KHÔNG có chữ trên thẻ', c0.length === 9 && c0.every(c => c.tag === 'BUTTON' && c.type === 'button' && !c.selected && c.pressed === 'false' && c.badge === 'none' && c.name === c.data && c.text === '') && JSON.stringify(c0.map(c => c.data).sort()) === JSON.stringify(CARDS.slice().sort()), JSON.stringify(c0.map(c => c.name + ':' + c.text)));
    T('Tải: dòng "Chị chọn: …" dưới lưới còn trống', (await text(page, '#emotion-picked')) === '');
    T('Tải: focus không tự nhảy vào ô mã số', await page.evaluate('document.activeElement === document.body'));
    T('Tải: nút nhạc 🔇 (mặc định TẮT), aria-pressed=false, nhãn cố định "Nhạc nền", audio không phát', (await text(page, '#music-toggle-btn')) === '🔇' && (await page.evaluate("document.getElementById('music-toggle-btn').getAttribute('aria-pressed') === 'false' && document.getElementById('music-toggle-btn').getAttribute('aria-label') === 'Nhạc nền' && document.getElementById('bg-music').paused")));
    T('Tải: chữ mức không aria-live (chấm đã có nhãn, không đọc hai lần)', !(await page.evaluate("document.getElementById('current-status').hasAttribute('aria-live')")));
    T('Tải: nhãn ô "Mã số bệnh nhân của chị" (icon 🆔), đã bỏ câu giải thích dưới ô', /Mã số bệnh nhân của chị/.test(await text(page, 'label[for="input-patient-id"]')) && (await page.evaluate("!document.getElementById('phone-note') && !document.getElementById('input-phone') && !/điện thoại|giữ tạm/.test(document.querySelector('.patient-id-section').innerText)")), await text(page, '.patient-id-section'));
    T('Tải: ô mã số type=text, inputmode=numeric, autocomplete=off, placeholder "Ví dụ: 26012345", maxlength 30', (await page.evaluate("(() => { const i = document.getElementById('input-patient-id'); return [i.type, i.inputMode, i.autocomplete, i.placeholder, i.maxLength, i.getAttribute('aria-describedby')].join('|'); })()")) === 'text|numeric|off|Ví dụ: 26012345|30|patient-id-error');
    T('Tải: dòng "Tự đánh giá, không phải thang chẩn đoán." hiện', (await page.evaluate("[...document.querySelectorAll('.footer-note')].some(n => n.offsetParent !== null && n.textContent.includes('không phải thang chẩn đoán'))")));
    await page.click('.main-title');
    await sleep(300);
    T('Nhạc: chạm vào trang KHÔNG tự phát nhạc, không tải mp3', (await page.evaluate("document.getElementById('bg-music').paused")) && requests.filter(r => /background-music\.mp3/.test(r.url)).length === 0);
    await page.screenshot(path.join(OUT, 'shot-main-01-load.png'), true);

    /* --- Nhập mã số → hint "thiếu thẻ" --- */
    await typeId(page, '26012345');
    T('Hint: có mã số, chưa mức, chưa thẻ → "thiếu mức"', (await hint(page)) === TXT.hintLevel && (await btn(page)).disabled, await hint(page));

    /* --- 10 chấm: chạm bằng chuột lần lượt 1 → 10 --- */
    const sweep = [];
    for (let v = 1; v <= 10; v++) {
      const ok0 = await pickLevel(page, v);
      await sleep(30);
      lv = await level(page);
      /* màu đọc từ style inline (computed đang transition 0.2s) */
      const ok = ok0 && lv.value === String(v) && lv.selectedCls === String(v) && lv.tabbable === String(v) && lv.status === v + ' - ' + LEVELS[v] && lv.src === 'capy-level-' + String(v).padStart(2, '0') + '.png' && lv.inlineColor === hex2rgb(LEVEL_COLORS[v]) && lv.alt === 'Bé Capybara mức ' + v + ': ' + LEVELS[v] && lv.emoji === LEVEL_EMOJI[v];
      sweep.push(ok ? v : v + '✗(' + JSON.stringify(lv) + ')');
    }
    T('Chuột: chạm 10 chấm, mỗi lúc đúng 1 chấm aria-checked + .selected, chữ "7 - Tốt", ảnh, màu, alt, emoji dự phòng đúng mức', sweep.every(x => typeof x === 'number'), sweep.join(' '));
    let s = await qa(page);
    T('Chuột: src ảnh đổi đúng thứ tự 01→10', s.capySrc.filter(Boolean).join(',') === [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => 'capy-level-' + String(v).padStart(2, '0') + '.png').join(','), s.capySrc.join(','));
    T('Chuột: rung 15 ms mỗi lần chọn mức (navigator.vibrate)', s.vibrate.filter(v => v === 15).length >= 10, JSON.stringify(s.vibrate.slice(0, 12)));
    await sleep(300); // chờ hiệu ứng phóng (transition 0.18s) chạy xong
    const dotLook = await page.evaluate("(() => { const d = document.querySelector('.level-dot.selected'); const o = document.querySelector('.level-dot:not(.selected)'); return { sel: getComputedStyle(d).transform, selShadow: getComputedStyle(d).boxShadow, other: getComputedStyle(o).transform, color: getComputedStyle(d).color, bg: getComputedStyle(d).backgroundColor }; })()");
    T('Chấm đang chọn nổi rõ: phóng 1.14 + viền (box-shadow 2 vòng), chấm khác không phóng', /matrix\(1\.14, 0, 0, 1\.14/.test(dotLook.sel) && (dotLook.selShadow.match(/rgb/g) || []).length >= 2 && (dotLook.other === 'none' || dotLook.other === 'matrix(1, 0, 0, 1, 0, 0)'), JSON.stringify(dotLook));
    T('Chấm: nền đúng màu mức 10, chữ trắng', dotLook.bg === hex2rgb(LEVEL_COLORS[10]) && dotLook.color === 'rgb(255, 255, 255)', JSON.stringify(dotLook));
    /* --- Phím: Home / End / mũi tên (vòng lại ở hai đầu), focus đi theo chấm --- */
    await page.evaluate("document.querySelector('.level-dot[tabindex=\"0\"]').focus(); true");
    await page.key('Home');
    lv = await level(page);
    T('Phím Home → 1 - Tuyệt vọng, capy-level-01, focus ở chấm 1', lv.value === '1' && lv.status === '1 - Tuyệt vọng' && lv.src === 'capy-level-01.png' && (await activeDot(page)) === '1', JSON.stringify(lv));
    await page.key('ArrowLeft');
    T('ArrowLeft ở 1 → vòng sang 10 (đúng mẫu radiogroup)', (await level(page)).value === '10' && (await activeDot(page)) === '10');
    await page.key('ArrowRight');
    T('ArrowRight ở 10 → vòng về 1', (await level(page)).value === '1' && (await activeDot(page)) === '1');
    await keyRaw(page, 'ArrowDown', 40);
    T('ArrowDown → 2', (await level(page)).value === '2' && (await activeDot(page)) === '2');
    await page.key('ArrowRight');
    T('ArrowRight → 3, chữ "3 - Tồi tệ"', (await level(page)).value === '3' && (await level(page)).status === '3 - Tồi tệ');
    await keyRaw(page, 'ArrowUp', 38);
    T('ArrowUp → 2', (await level(page)).value === '2' && (await activeDot(page)) === '2');
    await page.key('End');
    lv = await level(page);
    T('Phím End → 10 - Rất tuyệt vời', lv.value === '10' && lv.status === '10 - Rất tuyệt vời', lv.status);
    T('Phím mũi tên không cuộn trang (preventDefault)', (await page.evaluate('scrollX')) === 0);
    T('Chú thích hai đầu "1 (Tuyệt vọng)" / "10 (Rất tuyệt vời)" (giữ nguyên chờ anh)', (await page.evaluate("[...document.querySelectorAll('.level-legend span')].map(s => s.textContent).join('|')")) === '1 (Tuyệt vọng)|10 (Rất tuyệt vời)');
    const dotBoxes = await page.evaluate("[...document.querySelectorAll('.level-dot')].map(d => { const b = d.getBoundingClientRect(); return Math.round(d.offsetWidth) + 'x' + Math.round(d.offsetHeight); })");
    T('Chấm: vùng chạm ≥ 44×44 px (cả 10 chấm)', dotBoxes.every(x => x.split('x').every(n => Number(n) >= 44)), dotBoxes.join(','));
    await pickLevel(page, 3);
    T('Hint: có mã số + mức, chưa thẻ → nút chưa bật, hint "thiếu thẻ"', (await btn(page)).disabled && (await hint(page)) === TXT.hintCard);

    /* --- 9 thẻ, chỉ một được chọn --- */
    const pickLog = [];
    for (const name of CARDS) {
      const ok = await pickCard(page, name);
      const cs = await cards(page);
      const only = cs.filter(c => c.selected).map(c => c.name);
      const pressed = cs.filter(c => c.pressed === 'true').map(c => c.name);
      const cap = await text(page, '#emotion-picked');
      pickLog.push(name + ':' + (ok && only.length === 1 && only[0] === name && pressed.join() === name && cs.find(c => c.name === name).badge === 'flex' && cap === TXT.picked + name ? 'ok' : 'LỖI ' + only.join('/') + ' pressed=' + pressed.join('/') + ' cap=' + cap));
    }
    T('Thẻ: chọn lần lượt 9 thẻ, mỗi lúc đúng 1 thẻ .selected + aria-pressed=true + badge ✓ + dòng "Chị chọn: …" đúng tên', pickLog.every(x => x.endsWith(':ok')), pickLog.join(' '));
    const cAll = await cards(page);
    T('Thẻ: cả 9 thẻ dùng ảnh mới đúng tên (vui_ve.png … co_don.png), ảnh tải được (naturalWidth 480), không còn emoji giữ chỗ', cAll.length === 9 && cAll.every(c => c.src === CARD_IMG[c.name] && c.natural === 480 && !c.fallback), cAll.map(c => c.name + '→' + c.src + ':' + c.natural + (c.fallback ? ' fallback' : '')).join(', '));
    /* offsetWidth = cỡ bố cục (thẻ đang chọn phóng 1.02 nên không đo bằng getBoundingClientRect) */
    const boxSz = await page.evaluate("[...document.querySelectorAll('.capy-img-box')].map(b => b.offsetWidth + 'x' + b.offsetHeight)");
    T('Thẻ: 9 khung ảnh vuông, cùng cỡ', new Set(boxSz).size === 1 && boxSz.every(x => { const [w, h] = x.split('x').map(Number); return w === h && w >= 60; }), boxSz.join(','));
    s = await qa(page);
    T('Thẻ: rung 25 ms khi chạm', s.vibrate.filter(v => v === 25).length >= 9);
    await pickCard(page, 'Lo lắng');
    T('Hint: đủ mã số + thẻ → "✨ đủ", class .done nền xanh nhạt, nút .ready không disabled', (await hint(page)) === TXT.hintDone && (await waitReady(page)) && (await page.evaluate("document.getElementById('submit-hint').classList.contains('done') && getComputedStyle(document.getElementById('submit-hint')).backgroundColor")) === 'rgb(232, 245, 233)', await hint(page));
    await sleep(400);
    b = await btn(page);
    T('Nút thức dậy: opacity 1, scale 1, animation gentlePulse, pointer-events auto', b.opacity === '1' && b.transform === 'matrix(1, 0, 0, 1, 0, 0)' && b.anim === 'gentlePulse' && b.pe === 'auto', JSON.stringify(b));

    /* --- Hint "thiếu mã số" (xóa mã số khi đã có thẻ) --- */
    await typeId(page, '');
    T('Hint: có thẻ, xóa mã số → "thiếu mã số", nút tắt', (await hint(page)) === TXT.hintId && (await btn(page)).disabled, await hint(page));
    await typeId(page, '26');
    T('Hint: mã số đang gõ dở 2 số → vẫn "thiếu mã số", chưa báo lỗi', (await hint(page)) === TXT.hintId && (await btn(page)).disabled && (await text(page, '#patient-id-error')) === '');
    await typeId(page, '26012345');
    T('Hint: mã số 8 số trở lại → "✨ đủ"', (await hint(page)) === TXT.hintDone && !!(await waitReady(page)));
    await page.evaluate("document.getElementById('submit-section').scrollIntoView({block:'center'}); true");
    await page.screenshot(path.join(OUT, 'shot-main-02-ready.png'), true);

    /* --- Bấm Hoàn thành ở mức 3 --- */
    await pickLevel(page, 3);
    const sent = await submit(page);
    T('Gửi: sang trang cảm ơn sau khi bấm', sent);
    s = await qa(page);
    FLAKY('Gửi: trang cảm ơn hiện ~400 ms sau bấm (setTimeout 400)', s.successShownAt - s.clickAt >= 380 && s.successShownAt - s.clickAt < 900, (s.successShownAt - s.clickAt).toFixed(0) + ' ms');
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    T('Gửi: 1 POST tới mock', e.mock.posts().length === 1, e.mock.posts().length);
    const req = e.mock.posts()[0] || {};
    T('Gửi: Content-Type text/plain;charset=utf-8 (không preflight)', /^text\/plain;charset=utf-8$/i.test(req.contentType), req.contentType);
    const body = e.mock.state.rows[0] || {};
    T('Gửi: body đúng 6 trường ageMs, level, part1, part2, patientId, sessionId (không còn phone, không giờ tuyệt đối, không created_at)', Object.keys(body).sort().join(',') === 'ageMs,level,part1,part2,patientId,sessionId' && Number.isInteger(body.ageMs) && body.ageMs >= 0 && body.ageMs < 5000, JSON.stringify(body));
    T('Gửi: patientId "26012345", level 3, part1 "3 - Tồi tệ", part2 "Lo lắng", sessionId hợp lệ', body.patientId === '26012345' && body.level === 3 && body.part1 === '3 - Tồi tệ' && body.part2 === 'Lo lắng' && SID_RE.test(body.sessionId), JSON.stringify(body));
    T('Gửi: không alert', s.alerts.length === 0, JSON.stringify(s.alerts));
    s = await qa(page);
    T('Gửi: console.log "[Check-in] Đã lưu lên Google Sheet:" chỉ khi {result:success}', s.logs.some(l => l.startsWith(TXT.logSaved) && /success/.test(l)), JSON.stringify(s.logs));
    T('Gửi: gửi xong thì hàng chờ trống, không còn "myCheckins" / "checkin_me_bau_pending" giữ SĐT', (await queue(page)).length === 0 && (await page.evaluate("localStorage.getItem('myCheckins') === null && localStorage.getItem('checkin_me_bau_pending') === null")), JSON.stringify(await queue(page)));
    /* --- Trang cảm ơn --- */
    T('Cảm ơn: trang check-in ẩn, trang cảm ơn hiện', !(await checkinVisible(page)) && (await successVisible(page)));
    T('Cảm ơn: tick xanh SVG hiện, vòng tròn stroke animation', (await page.evaluate("(() => { const c = document.querySelector('.checkmark-circle'); const r = c.getBoundingClientRect(); return r.width > 40 && getComputedStyle(c).animationName === 'stroke'; })()")));
    T('Cảm ơn: tiêu đề gọi "chị"', (await text(page, '.success-title')) === TXT.successTitle, await text(page, '.success-title'));
    T('Cảm ơn: focus chuyển lên tiêu đề (trình đọc màn hình biết đã đổi trang)', !!(await waitFor(page, "document.activeElement && document.activeElement.id === 'success-title'", 1000)), await page.evaluate('document.activeElement.id || document.activeElement.tagName'));
    const sum = await page.evaluate("document.getElementById('success-summary').innerText");
    T('Cảm ơn: tóm tắt che mã số "26 ••• 345", có "3 - Tồi tệ", "Lo lắng"', /Mã số bệnh nhân: 26 ••• 345/.test(sum) && !/26012345/.test(sum) && !/điện thoại/.test(sum) && /Mức cảm xúc: 3 - Tồi tệ/.test(sum) && /Bé Capybara: Lo lắng/.test(sum), sum);
    const quote3 = await text(page, '#success-quote');
    T('Cảm ơn: mức 3 → câu vỗ về nhẹ, KHÔNG chúc "nhiều niềm vui và hạnh phúc"', /nặng lòng/.test(quote3) && !/niềm vui|hạnh phúc/.test(quote3), quote3);
    T('Cảm ơn: mức 3 → khung "Hỗ trợ" tự mở, có 115, không có số cơ sở bịa', (await page.evaluate("(() => { const d = document.getElementById('support-box'); return d.open && d.innerText.includes('115') && document.getElementById('support-facility').hidden; })()")));
    T('Cảm ơn: pháo hoa vẫn bắn (giữ nguyên theo anh)', (await page.evaluate("typeof particles !== 'undefined'")) && s.successShownAt > 0);
    T('Cảm ơn: nút "🌸 Thực hiện check-in khác" (giữ nguyên chờ anh)', (await text(page, '.btn-restart')) === TXT.restart, await text(page, '.btn-restart'));
    FLAKY('Cảm ơn: cuộn lên đầu trang (scrollTo smooth, chờ ≤ 1,5 s; headless không đảm bảo frame)', !!(await waitFor(page, 'scrollY < 5', 1500)), await page.evaluate('scrollY'));
    await sleep(1200); // đợi tick vẽ xong
    await page.screenshot(path.join(OUT, 'shot-main-03-success.png'), true);

    /* --- Thực hiện check-in khác → form sạch --- */
    await restart(page);
    lv = await level(page);
    b = await btn(page);
    T('Reset: ô mã số trống, KHÔNG chấm nào chọn, chữ mức trống, ảnh mức bỏ (hoa 🌸), chấm 1 nhận Tab', (await idVal(page)) === '' && lv.value === '' && lv.selectedCls === '' && lv.status === '' && lv.imgHidden && lv.src === '' && lv.emoji === '🌸' && lv.tabbable === '1', JSON.stringify(lv));
    T('Reset: không thẻ nào chọn (aria-pressed=false), dòng "Chị chọn" trống, nút chưa bật, chữ "Hoàn thành Check-in →", hint "chưa có gì"', (await cards(page)).every(c => !c.selected && c.pressed === 'false') && (await text(page, '#emotion-picked')) === '' && b.disabled && !b.realDisabled && !b.ready && b.text === TXT.btnIdle && (await hint(page)) === TXT.hintAll, JSON.stringify({ b, hint: await hint(page) }));
    T('Reset: trang cảm ơn ẩn, tóm tắt đã dọn, khung Hỗ trợ đóng', (await checkinVisible(page)) && !(await successVisible(page)) && (await page.evaluate("document.getElementById('success-summary').textContent === '' && !document.getElementById('support-box').open")));

    /* --- Lượt 2: mã số có dấu cách, số 0 ở đầu, mức 10 --- */
    await typeId(page, '0012 345');
    await pickCard(page, 'Vui vẻ');
    await pickLevel(page, 10);
    const sent2 = await submit(page);
    await waitFor(page, "__qa.logs.filter(l => l.includes('Đã lưu')).length >= 2", 2000);
    const r2 = e.mock.state.rows[1] || {};
    T('Lượt 2: gửi được, mock 2 dòng, mã số "0012 345" gửi thành chuỗi "0012345" (giữ số 0), level 10, sessionId mới', sent2 && e.mock.state.rows.length === 2 && r2.patientId === '0012345' && r2.level === 10 && r2.part1 === '10 - Rất tuyệt vời' && r2.sessionId !== body.sessionId, JSON.stringify(r2));
    const quote10 = await text(page, '#success-quote');
    T('Lượt 2: mức 10 → giữ câu chúc gốc của anh, khung Hỗ trợ không tự mở', /nhiều niềm vui và hạnh phúc/.test(quote10) && !(await page.evaluate("document.getElementById('support-box').open")), quote10);

    s = await qa(page);
    T('Console: không console.error / lỗi JS / promise rơi', s.errors.length === 0, JSON.stringify(s.errors));
    T('Console: không console.warn ở luồng bình thường', s.warns.length === 0, JSON.stringify(s.warns));
    const other = nonAssetLog(browserLog).filter(l => /error/i.test(l) && !/kaspersky/.test(l));
    T('Console trình duyệt: không lỗi nào ngoài 404 ảnh/nhạc', other.length === 0, other.join(' | '));
    T('Có favicon (không 404 favicon.ico mỗi lần tải)', !browserLog.some(l => /favicon\.ico/.test(l)) && !requests.some(r => /favicon\.ico/.test(r.url)), browserLog.filter(l => /favicon/.test(l)).join(' | '));
    T('Không có 404 ảnh nào (đủ 9 ảnh thẻ + 10 ảnh mức)', browserLog.filter(l => /\.(jpg|png)\b/.test(l)).length === 0, browserLog.filter(l => /\.(jpg|png)\b/.test(l)).join(' | '));
    T('AN TOÀN: suốt kịch bản 0 request tới script.google.com', !requests.some(r => r.url.includes('script.google.com')));
    saveConsole('main', consoleApi, browserLog, s);
  } finally { await teardown(e); }
}

/* ================= keyboard: làm trọn một lượt chỉ bằng bàn phím (Chặn #6) ================= */
async function scenarioKeyboard() {
  let e;
  try {
    e = await setup({ height: 900 });
    const { page } = e;
    const active = () => page.evaluate("(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; return a.id ? '#' + a.id : (a.dataset.emotion ? 'card:' + a.dataset.emotion : (a.dataset.level ? 'dot:' + a.dataset.level : a.className || a.tagName)); })()");
    /* Thứ tự Tab từ đầu trang (chưa có gì được focus) */
    const order = [];
    for (let i = 0; i < 14; i++) { await page.key('Tab'); order.push(await active()); }
    /* Thẻ đã xáo: thứ tự Tab phải theo đúng thứ tự thẻ trong trang (DOM = nhìn thấy) */
    const domCards = await page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => c.dataset.emotion)");
    const expect = ['#music-toggle-btn', '#input-patient-id', 'dot:1'].concat(domCards.map(n => 'card:' + n), ['#btn-submit', 'support-summary']);
    T('Tab: thứ tự nhạc → mã số → nhóm 10 chấm (1 điểm dừng, chấm 1) → 9 thẻ → nút Hoàn thành (aria-disabled, vẫn focus được) → Hỗ trợ', order.join(',') === expect.join(','), order.join(','));
    /* Làm một lượt (Chrome giữ điểm bắt đầu Tab sau blur, nên đặt focus vào nút nhạc rồi Tab tiếp) */
    await page.evaluate("document.getElementById('music-toggle-btn').focus(); true");
    await page.key('Tab');
    T('Từ nút nhạc, Tab → ô mã số', (await active()) === '#input-patient-id');
    await page.type('26012345');
    await page.key('Tab');
    T('Tab → chấm 1 (chưa chọn gì)', (await active()) === 'dot:1' && (await level(page)).value === '');
    for (let i = 0; i < 5; i++) await page.key('ArrowRight');
    T('ArrowRight 5 lần → mức 6, focus ở chấm 6, chỉ chấm 6 nhận Tab', (await active()) === 'dot:6' && (await level(page)).value === '6' && (await level(page)).tabbable === '6');
    await page.key('Tab');
    T('Tab → thẻ đầu (' + domCards[0] + ') có viền focus-visible 3px', (await active()) === 'card:' + domCards[0] && (await page.evaluate("(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.matches(':focus-visible') && cs.outlineStyle === 'solid' && cs.outlineWidth === '3px'; })()")));
    await page.key('Enter');
    T('Enter trên thẻ đầu → chọn, aria-pressed=true', (await cards(page)).filter(c => c.selected && c.pressed === 'true').map(c => c.name).join() === domCards[0]);
    await page.key('Tab');
    await page.key('Space');
    T('Tab → thẻ thứ hai, Space → chọn thẻ đó, bỏ chọn thẻ đầu', (await active()) === 'card:' + domCards[1] && (await cards(page)).filter(c => c.selected && c.pressed === 'true').map(c => c.name).join() === domCards[1], JSON.stringify((await cards(page)).map(c => c.name + ':' + c.pressed)));
    for (let i = 0; i < 7; i++) await page.key('Tab');
    await page.key('Tab');
    T('Tab tiếp qua 7 thẻ còn lại → nút Hoàn thành (đã bật)', (await active()) === '#btn-submit' && !(await btn(page)).disabled, await active());
    await assertSafeUrl(page);
    await page.key('Enter');
    const shown = await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2500);
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    const row = e.mock.state.rows[0] || {};
    T('Enter trên nút Hoàn thành → trang cảm ơn, POST level 6 + đúng nhãn thẻ thứ hai (' + domCards[1] + ')', !!shown && e.mock.state.rows.length === 1 && row.level === 6 && row.part2 === domCards[1], JSON.stringify(row));
    T('Sau khi gửi: focus ở tiêu đề trang cảm ơn', !!(await waitFor(page, "document.activeElement.id === 'success-title'", 1000)));
    await page.key('Tab');
    T('Tab từ tiêu đề → nút "Thực hiện check-in khác"', (await page.evaluate("document.activeElement.classList.contains('btn-restart')")));
    await page.key('Enter');
    T('Enter → về trang check-in, form sạch', !!(await waitFor(page, "getComputedStyle(document.getElementById('page-checkin')).display !== 'none'", 1500)) && (await idVal(page)) === '');
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('keyboard', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= level: chưa chọn mức thì không gửi; chọn bằng phím/chuột; 3 cảm xúc mới (02/11/2026) ================= */
async function scenarioLevel() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    await typeId(page, '26012345');
    T('Chọn thẻ mới "Cô đơn" bằng chuột → .selected, aria-pressed', await pickCard(page, 'Cô đơn'));
    T('Dòng dưới lưới: "Chị chọn: Cô đơn"', (await text(page, '#emotion-picked')) === TXT.picked + 'Cô đơn', await text(page, '#emotion-picked'));
    T('Có mã số + thẻ, chưa mức → hint "thiếu mức", nút chưa bật', (await hint(page)) === TXT.hintLevel && (await btn(page)).disabled && !(await btn(page)).ready, await hint(page));
    /* Bấm Hoàn thành thật (chuột) khi chưa chọn mức */
    await assertSafeUrl(page);
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight); true');
    await settleScroll(page);
    await page.click('#btn-submit');
    await sleep(700);
    let lv = await level(page);
    T('Chưa chọn mức, bấm Hoàn thành → KHÔNG gửi (0 POST), vẫn ở trang check-in', e.mock.posts().length === 0 && (await checkinVisible(page)) && !(await successVisible(page)), e.mock.posts().length + ' POST');
    T('… hiện câu nhắc cạnh 10 chấm "' + TXT.levelError + '", nhóm chấm viền hồng (.need)', lv.error === TXT.levelError && lv.need, JSON.stringify({ error: lv.error, need: lv.need }));
    T('… focus đưa tới chấm 1 (chấm nhận Tab), câu nhắc có aria-live', (await activeDot(page)) === '1' && (await page.evaluate("document.getElementById('level-error').getAttribute('aria-live')")) === 'polite');
    await settleScroll(page);
    const vis = await page.evaluate("(() => { const b = document.getElementById('level-dots').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; })()");
    T('… cuộn tới khu 10 chấm (nằm trong màn hình)', vis);
    T('… không alert, không đổi chữ nút', (await qa(page)).alerts.length === 0 && (await btn(page)).text === TXT.btnIdle);
    /* Chọn bằng phím: Space chọn chấm đang focus, mũi tên đổi mức */
    await page.key('Space');
    lv = await level(page);
    T('Phím Space trên chấm 1 → chọn mức 1, câu nhắc tắt, bỏ viền .need', lv.value === '1' && lv.error === '' && !lv.need, JSON.stringify(lv));
    for (let i = 0; i < 6; i++) await page.key('ArrowRight');
    lv = await level(page);
    T('ArrowRight 6 lần → mức 7 "7 - Tốt", focus ở chấm 7, ảnh capy-level-07', lv.value === '7' && lv.status === '7 - Tốt' && (await activeDot(page)) === '7' && lv.src === 'capy-level-07.png', JSON.stringify(lv));
    T('Đủ mã số + mức + thẻ → hint "✨ đủ", nút bật', (await hint(page)) === TXT.hintDone && !!(await waitReady(page)));
    T('Gửi (mức 7 chọn bằng phím) → trang cảm ơn', await submit(page));
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    let row = e.mock.state.rows[0] || {};
    T('Payload: level 7 (số nguyên), part1 "7 - Tốt", part2 "Cô đơn"', e.mock.state.rows.length === 1 && row.level === 7 && Number.isInteger(row.level) && row.part1 === '7 - Tốt' && row.part2 === 'Cô đơn', JSON.stringify(row));
    const sum = await page.evaluate("document.getElementById('success-summary').innerText");
    T('Cảm ơn: tóm tắt "Mức cảm xúc: 7 - Tốt", "Bé Capybara: Cô đơn"', /Mức cảm xúc: 7 - Tốt/.test(sum) && /Bé Capybara: Cô đơn/.test(sum), sum);
    await restart(page);
    lv = await level(page);
    T('Làm lượt khác: không còn mức nào được chọn', lv.value === '' && lv.status === '' && (await text(page, '#emotion-picked')) === '');

    /* Lượt 2: chọn bằng chuột, cảm xúc mới "Bình an", mức 9 */
    await typeId(page, '26012345');
    await pickCard(page, 'Mệt mỏi');
    T('Thẻ "Mệt mỏi" → "Chị chọn: Mệt mỏi"', (await text(page, '#emotion-picked')) === TXT.picked + 'Mệt mỏi');
    await pickCard(page, 'Bình an');
    T('Đổi sang "Bình an": chỉ 1 thẻ chọn, dòng chữ đổi theo', (await cards(page)).filter(c => c.selected).map(c => c.name).join() === 'Bình an' && (await text(page, '#emotion-picked')) === TXT.picked + 'Bình an');
    T('Chuột: chạm chấm 9 → chọn mức 9', await pickLevel(page, 9));
    T('Gửi (mức 9 chọn bằng chuột)', await submit(page));
    await waitFor(page, "__qa.logs.filter(l => l.includes('Đã lưu')).length >= 2", 2000);
    row = e.mock.state.rows[1] || {};
    T('Payload lượt 2: level 9, part1 "9 - Tuyệt vời", part2 "Bình an", đủ 6 trường', row.level === 9 && row.part1 === '9 - Tuyệt vời' && row.part2 === 'Bình an' && Object.keys(row).sort().join(',') === 'ageMs,level,part1,part2,patientId,sessionId', JSON.stringify(row));
    await restart(page);

    /* Thiếu mã số mà bấm nút → nhắc ở ô mã số (như cũ), không nhắc mức trước */
    await pickLevel(page, 4);
    await pickCard(page, 'Vui vẻ');
    await assertSafeUrl(page);
    await page.click('#btn-submit');
    await sleep(500);
    T('Thiếu mã số, bấm nút → không gửi, toast lỗi mềm mã số (như cũ), focus ô mã số', e.mock.posts().length === 2 && (await toastText(page)) === TXT.idError && (await page.evaluate('document.activeElement.id')) === 'input-patient-id', await toastText(page));
    /* B-03: mã sai + chưa chọn mức → lần bấm ĐẦU nhắc cả hai, focus chỗ lỗi đầu tiên (ô mã số) */
    await page.evaluate("resetCheckin(); document.getElementById('toast').classList.remove('show'); true");
    await typeId(page, '12ab');
    await pickCard(page, 'Bình an');
    await assertSafeUrl(page);
    await page.click('#btn-submit');
    await sleep(500);
    lv = await level(page);
    T('B-03: mã "12ab" + chưa mức, bấm 1 lần → không gửi; nhắc mã (toast + lỗi dưới ô) VÀ nhắc mức cạnh 10 chấm; focus ô mã số', e.mock.posts().length === 2 && (await toastText(page)) === TXT.idError && (await text(page, '#patient-id-error')) === TXT.idError && lv.error === TXT.levelError && lv.need && (await page.evaluate('document.activeElement.id')) === 'input-patient-id', JSON.stringify({ toast: await toastText(page), err: lv.error, need: lv.need, active: await page.evaluate('document.activeElement.id') }));
    await typeId(page, '26012345');
    await page.click('#btn-submit');
    await sleep(400);
    T('B-03: sửa mã đúng, bấm lại → vẫn không gửi, focus sang chấm 1', e.mock.posts().length === 2 && (await activeDot(page)) === '1' && (await level(page)).error === TXT.levelError);
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('level', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= shuffle: xáo 9 thẻ mỗi lượt mới (anh Thông yêu cầu 02/11/2026) ================= */
async function scenarioShuffle() {
  let e;
  try {
    e = await setup({ query: '?qaseed=7', height: 900 });
    const { page } = e;
    const order = () => page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => c.dataset.emotion)");
    /* Thứ tự nhìn thấy (trên → dưới, trái → phải) */
    const visual = () => page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => ({ n: c.dataset.emotion, r: c.getBoundingClientRect() })).sort((a, b) => (Math.round(a.r.top) - Math.round(b.r.top)) || (a.r.left - b.r.left)).map(x => x.n)");
    const o1 = await order();
    T('Mở trang (seed 7): đủ 9 thẻ, mỗi nhãn đúng 1 lần, đã dùng crypto.getRandomValues', o1.length === 9 && JSON.stringify(o1.slice().sort()) === JSON.stringify(CARDS.slice().sort()) && (await page.evaluate('__qa.rng')) >= 8, o1.join(' | '));
    T('Thứ tự đã xáo (khác thứ tự gốc trong HTML)', JSON.stringify(o1) !== JSON.stringify(CARDS), o1.join(' | '));
    T('Thứ tự DOM = thứ tự nhìn thấy (Tab và trình đọc màn hình đi đúng thứ tự hiển thị)', JSON.stringify(await visual()) === JSON.stringify(o1), (await visual()).join(' | '));
    T('10 chấm KHÔNG xáo: vẫn 1 → 10', (await page.evaluate("[...document.querySelectorAll('.level-dot')].map(d => d.dataset.level).join()")) === '1,2,3,4,5,6,7,8,9,10');
    /* Chọn vẫn đúng nhãn, payload không đổi */
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    T('Chọn "Cô đơn" ở vị trí đã xáo → đúng thẻ được chọn, dòng "Chị chọn" đúng', (await pickCard(page, 'Cô đơn')) && (await text(page, '#emotion-picked')) === TXT.picked + 'Cô đơn');
    T('Gửi được', await submit(page));
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    const row = e.mock.state.rows[0] || {};
    T('Payload không đổi: đúng 6 trường, part2 "Cô đơn", level 2 (không có trường thứ tự thẻ)', Object.keys(row).sort().join(',') === 'ageMs,level,part1,part2,patientId,sessionId' && row.part2 === 'Cô đơn' && row.level === 2, JSON.stringify(row));
    /* "Check-in khác" → xáo lại */
    await restart(page);
    const o2 = await order();
    T('Bấm "Thực hiện check-in khác" → thứ tự mới (khác lượt trước), vẫn đủ 9 nhãn', JSON.stringify(o2) !== JSON.stringify(o1) && JSON.stringify(o2.slice().sort()) === JSON.stringify(CARDS.slice().sort()), o2.join(' | '));
    T('… DOM = nhìn thấy sau khi xáo lại', JSON.stringify(await visual()) === JSON.stringify(o2));
    T('Không lưu thứ tự vào máy (localStorage không có khóa nào của app sau khi gửi xong)', (await page.evaluate('localStorage.length')) === 0, await page.evaluate('JSON.stringify(Object.keys(localStorage))'));
    /* Nạp lại cùng seed → đúng thứ tự lần đầu (xáo bằng getRandomValues, tái lập được); seed khác → thứ tự khác */
    await page.navigate('about:blank');
    await page.navigate(APP_URL + '?qaseed=7');
    T('Nạp lại cùng seed 7 → cùng thứ tự lần mở đầu', JSON.stringify(await order()) === JSON.stringify(o1), (await order()).join(' | '));
    await page.navigate(APP_URL + '?qaseed=12345');
    const o3 = await order();
    T('Seed khác (12345) → thứ tự khác', JSON.stringify(o3) !== JSON.stringify(o1), o3.join(' | '));
    /* Fisher–Yates đều: 9000 lần xáo (dãy cố định) → mỗi nhãn đứng đầu / đứng cuối ~1000 lần */
    const dist = await page.evaluate(`(() => { const first = {}, last = {}; for (let i = 0; i < 9000; i++) { shuffleCards(); const c = [...document.querySelectorAll('.capy-card')]; first[c[0].dataset.emotion] = (first[c[0].dataset.emotion] || 0) + 1; last[c[8].dataset.emotion] = (last[c[8].dataset.emotion] || 0) + 1; } return { first, last }; })()`);
    const vals = Object.values(dist.first).concat(Object.values(dist.last));
    T('Xáo đều: 9000 lần, mỗi nhãn đứng đầu và đứng cuối 850–1150 lần (kỳ vọng 1000)', Object.keys(dist.first).length === 9 && Object.keys(dist.last).length === 9 && vals.every(v => v >= 850 && v <= 1150), JSON.stringify(dist.first));
    /* Máy không có crypto.getRandomValues → dùng Math.random, vẫn xáo đủ 9 thẻ */
    const fb = await page.evaluate(`(() => { Object.defineProperty(window.crypto, 'getRandomValues', { configurable: true, value: undefined }); let n = 0; const mr = Math.random; Math.random = () => { n++; return mr(); }; const seen = new Set(); for (let i = 0; i < 50; i++) { shuffleCards(); seen.add([...document.querySelectorAll('.capy-card')].map(c => c.dataset.emotion).join('|')); } Math.random = mr; return { calls: n, distinct: seen.size, count: document.querySelectorAll('.capy-card').length }; })()`);
    T('Dự phòng không có crypto.getRandomValues: dùng Math.random, vẫn 9 thẻ, ra nhiều thứ tự khác nhau', fb.calls >= 8 * 50 && fb.count === 9 && fb.distinct > 40, JSON.stringify(fb));
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('shuffle', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= oldserver: Apps Script còn bản cũ trả emotion_invalid → giữ lượt, gửi lại khi máy chủ mới (NÊN SỬA 2) ================= */
async function scenarioOldServer() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    e.mock.state.mode = 'emotion_invalid';
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Mệt mỏi');
    T('Gửi "Mệt mỏi" khi máy chủ còn bản cũ: trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 0', 3000);
    let s = await qa(page);
    let q = await queue(page);
    T('emotion_invalid → GIỮ lượt trong hàng chờ (1 lượt "Mệt mỏi"), warn "Chưa gửi được … emotion_invalid", không "từ chối"', e.mock.posts().length === 1 && q.length === 1 && q[0].payload.part2 === 'Mệt mỏi' && s.warns.some(w => w.startsWith(TXT.warnRetry) && /emotion_invalid/.test(w)) && !s.warns.some(w => w.startsWith(TXT.warnReject)), JSON.stringify({ warns: s.warns, q: q.length }));
    T('Không console.error, không alert, không log "Đã lưu"', s.errors.length === 0 && s.alerts.length === 0 && !s.logs.some(l => l.startsWith(TXT.logSaved)));
    /* Lỗi dữ liệu khác (patient_id_invalid) vẫn bỏ như cũ */
    await restart(page);
    e.mock.state.mode = 'reject';
    await typeId(page, '26012345');
    await pickLevel(page, 5);
    await pickCard(page, 'Vui vẻ');
    await submit(page);
    await waitFor(page, '__qa.warns.length > 1', 3000);
    s = await qa(page);
    T('patient_id_invalid vẫn bỏ khỏi hàng chờ (gửi lại vô ích) – hàng chờ vẫn chỉ lượt "Mệt mỏi"', s.warns.some(w => w.startsWith(TXT.warnReject)) && (await queue(page)).length === 1, JSON.stringify(await queue(page)));
    /* Anh cập nhật Apps Script → tải lại trang: lượt "Mệt mỏi" tự gửi, đúng 1 dòng */
    e.mock.state.mode = 'ok';
    const before = e.mock.state.rows.length;
    await page.navigate(APP_URL);
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    const added = e.mock.state.rows.slice(before);
    T('Máy chủ đã cập nhật, mở lại trang → gửi lại lượt "Mệt mỏi" (level 2), đúng 1 dòng, hàng chờ trống', added.length === 1 && added[0].part2 === 'Mệt mỏi' && added[0].level === 2 && (await queue(page)).length === 0, JSON.stringify(added));
    /* Hàng chờ trên máy từ web bản 01/11 (6 cảm xúc) còn lượt "Buồn": bản mới vẫn gửi nguyên chữ (Apps Script mới nhận nhãn cũ) */
    const tap0 = Date.now() - 3600e3;
    await page.evaluate(`localStorage.setItem('checkin_me_bau_queue', JSON.stringify([{ payload: { sessionId: 'sess-legacy-buon-0001', tappedAt: ${tap0}, patientId: '26012345', level: 3, part1: '3 - Tồi tệ', part2: 'Buồn' }, queuedAt: ${tap0} }])); true`);
    const before2 = e.mock.state.rows.length;
    await page.navigate(APP_URL);
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    const legacy = e.mock.state.rows.slice(before2);
    T('Hàng chờ cũ có lượt "Buồn" (web bản 01/11): mở bản mới → gửi đi NGUYÊN "Buồn", level 3, đúng Mã phiên, hàng chờ trống', legacy.length === 1 && legacy[0].part2 === 'Buồn' && legacy[0].level === 3 && legacy[0].sessionId === 'sess-legacy-buon-0001' && (await queue(page)).length === 0, JSON.stringify(legacy));
    s = await qa(page);
    saveConsole('oldserver', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= patientid: Mã số bệnh nhân (01/11/2026) – chỉ chữ số, 3–20 số ================= */
async function scenarioPatientId() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    const tryId = async (v) => { await typeId(page, v); await sleep(30); const b = await btn(page); return { v, enabled: !b.disabled && b.ready, hint: await hint(page), err: await text(page, '#patient-id-error'), value: await idVal(page) }; };
    await pickLevel(page, 5);
    await pickCard(page, 'Đau khổ');
    const cases = [
      ['12', false], ['1'.repeat(21), false], ['HV123', false], ['=1+1', false], ['abcdefghi', false], ['26012345abc', false], ['(026) 012345', false],
      ['26012345', true], ['0012345', true], ['260 123 45', true], ['260.123.45', true], ['260-123-45', true], ['   26012345   ', true], ['123', true], ['1'.repeat(20), true]
    ];
    const got = [];
    for (const [v, want] of cases) { const r = await tryId(v); got.push((r.enabled === want ? 'ok ' : 'LỖI ') + JSON.stringify(v) + '→' + (r.enabled ? 'bật' : 'tắt')); }
    T('Mã số: 7 mẫu sai bị chặn ("12", 21 chữ số, "HV123", "=1+1", chữ, chữ lẫn số, ngoặc), 8 mẫu đúng được nhận (26012345, "0012345", dấu cách, chấm, gạch, khoảng trắng hai đầu, 3 số, 20 số)', got.every(x => x.startsWith('ok')), got.join(' | '));
    let r = await tryId('HV123');
    T('Mã số có chữ → lỗi mềm ngay dưới ô (giọng "chị", "nhé"), aria-invalid, hint "mã số chưa đúng"', r.err === TXT.idError && r.hint === TXT.hintIdBad && (await page.evaluate("document.getElementById('input-patient-id').getAttribute('aria-invalid')")) === 'true', JSON.stringify(r));
    r = await tryId('1'.repeat(21));
    T('Mã số 21 chữ số → báo lỗi ngay khi gõ (không chờ rời ô)', r.err === TXT.idError && !r.enabled, JSON.stringify(r));
    r = await tryId('12');
    T('Mã số đang gõ dở "12" → chưa báo lỗi, hint "thiếu mã số"', r.err === '' && r.hint === TXT.hintId, JSON.stringify(r));
    await page.evaluate("document.getElementById('input-patient-id').blur(); true");
    T('Rời ô khi mã số còn dở "12" → hiện lỗi mềm có ví dụ', (await text(page, '#patient-id-error')) === TXT.idError && (await hint(page)) === TXT.hintIdBad);
    r = await tryId('26012345');
    T('Sửa lại đúng → lỗi tắt, aria-invalid bỏ, nút bật', r.err === '' && r.enabled && (await page.evaluate("document.getElementById('input-patient-id').hasAttribute('aria-invalid')")) === false, JSON.stringify(r));
    r = await tryId('1234567890123456789012345678901234567890');
    T('Ô mã số: maxlength 30 (không nhận chuỗi dài vô hạn)', r.value.length <= 30 && !r.enabled, r.value.length + ' ký tự');

    /* Gửi "0012 345" → server nhận chuỗi chữ số, giữ số 0 đầu */
    await typeId(page, '0012 345');
    T('Gửi "0012 345": POST patientId là CHUỖI "0012345", không có trường phone', (await submit(page)) && !!(await waitFor(page, '__qa.fetches.length >= 1', 1500)) && e.mock.state.rows.length === 1 && e.mock.state.rows[0].patientId === '0012345' && !('phone' in e.mock.state.rows[0]), JSON.stringify(e.mock.state.rows[0]));
    const sum = await page.evaluate("document.getElementById('success-summary').innerText");
    T('Cảm ơn: mã 7 số "0012345" che thành "••• 45"', /Mã số bệnh nhân: ••• 45/.test(sum) && !/0012345/.test(sum), sum);
    await restart(page);

    /* Gọi submitCheckin() trực tiếp khi chưa đủ điều kiện: toast, không alert, không POST */
    await typeId(page, '=1+1');
    await pickLevel(page, 5);
    await pickCard(page, 'Vui vẻ');
    await page.evaluate('submitCheckin(); true');
    let s = await qa(page);
    T('submitCheckin() với mã số "=1+1" → toast lỗi mềm, focus ô mã số, không alert, không POST', (await toastText(page)) === TXT.idError && (await page.evaluate("document.activeElement.id")) === 'input-patient-id' && s.alerts.length === 0 && e.mock.state.rows.length === 1, JSON.stringify({ toast: await toastText(page), alerts: s.alerts, rows: e.mock.state.rows.length }));
    /* Đang ở trang check-in (nút "check-in khác" ẩn) → làm sạch form bằng resetCheckin(); ẩn toast cũ */
    await page.evaluate("resetCheckin(); document.getElementById('toast').classList.remove('show'); true");
    await typeId(page, '26012345');
    await pickLevel(page, 4);
    await page.evaluate('submitCheckin(); true');
    s = await qa(page);
    T('submitCheckin() có mã số + mức, chưa thẻ → toast "' + TXT.toastCard + '", không POST', (await toastText(page)) === TXT.toastCard && s.alerts.length === 0 && e.mock.state.rows.length === 1, await toastText(page));
    T('Toast có role="status" (trình đọc màn hình đọc được)', (await page.evaluate("document.getElementById('toast').getAttribute('role')")) === 'status');
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('patientid', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= xss: chuỗi HTML không bao giờ thành phần tử (Chặn #4) ================= */
async function scenarioXss() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    await pickCard(page, 'Đau khổ');
    await typeId(page, '<img src=x onerror="window.__xssSummary=1">');
    await sleep(100);
    T('Mã số chứa HTML → nút KHÔNG bật', (await btn(page)).disabled);
    await page.evaluate('submitCheckin(); true');
    await sleep(500);
    T('submitCheckin() trực tiếp với mã số chứa HTML → không POST, không trang cảm ơn', e.mock.state.rows.length === 0 && !(await successVisible(page)));
    /* Gọi thẳng hàm dựng tóm tắt với cả ba trường độc */
    await page.evaluate(`renderSummary({ patientId: '<img src=x onerror="window.__xss1=1">', part1: '<img src=x onerror="window.__xss2=1">', part2: '<b id="xssb">đậm</b><script>window.__xss3=1<\\/script>' }); true`);
    await sleep(400);
    const x = await page.evaluate("({ ran: !!(window.__xssSummary || window.__xss1 || window.__xss2 || window.__xss3), imgs: document.querySelectorAll('#success-summary img, #success-summary script, #xssb').length, text: document.getElementById('success-summary').textContent })");
    T('renderSummary: chuỗi HTML hiện dạng chữ, 0 phần tử <img>/<script>/<b> được tạo, onerror không chạy', !x.ran && x.imgs === 0 && x.text.includes('<img src=x onerror="window.__xss2=1">') && x.text.includes('<b id="xssb">'), JSON.stringify(x));
    T('renderSummary: mã số lạ cũng bị che (không hiện nguyên chuỗi)', !x.text.includes('window.__xss1'), x.text.slice(0, 120));
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('xss', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= offline: mất mạng thật → hàng chờ → gửi lại ================= */
async function scenarioOffline() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Hoảng hốt');
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    T('Offline: navigator.onLine = false', !(await page.evaluate('navigator.onLine')));
    const sent = await submit(page);
    T('Offline: trang cảm ơn VẪN hiện (gửi lạc quan)', sent);
    await waitFor(page, '__qa.warns.length > 0', 3000);
    let s = await qa(page);
    T('Offline: console.warn "' + TXT.warnRetry + '"', s.warns.some(w => w.startsWith(TXT.warnRetry)), JSON.stringify(s.warns));
    T('Offline: không console.error, không alert, không log "Đã lưu"', s.errors.length === 0 && s.alerts.length === 0 && !s.logs.some(l => l.includes('Đã lưu')), JSON.stringify(s.errors));
    T('Offline: mock không nhận dòng nào', e.mock.state.rows.length === 0);
    let q = await queue(page);
    T('Offline: hàng chờ giữ đúng 1 lượt (có sessionId, "Hoảng hốt")', q.length === 1 && SID_RE.test(q[0].payload.sessionId) && q[0].payload.part2 === 'Hoảng hốt', JSON.stringify(q));
    const sid1 = q[0] && q[0].payload.sessionId;
    const pageText = await page.evaluate("document.getElementById('page-success').innerText");
    T('Offline: trang cảm ơn không làm phiền chị bằng thông báo lỗi mạng (style guide: im lặng, chỉ log)', !/mạng|offline|chưa gửi|thử lại/i.test(pageText), pageText.slice(0, 120));
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    /* Tải lại trang có mạng: app tự gửi lại lượt còn trong hàng chờ */
    await page.navigate(APP_URL);
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    /* Có thể có 2 POST cùng sessionId (trang cũ nhận sự kiện online, trang mới gửi lúc tải); mock gộp theo Mã phiên như Apps Script thật */
    const rows1 = e.mock.state.rows.map(r => r.sessionId);
    T('Có mạng, tải lại: app tự gửi lại lượt offline → Sheet có ĐÚNG 1 dòng, cùng sessionId, hàng chờ trống', rows1.length === 1 && rows1[0] === sid1 && (await queue(page)).length === 0, JSON.stringify(e.mock.state.rows.map(r => r.sessionId + ':' + r.part2)) + ' / ' + e.mock.posts().length + ' POST');
    /* Hàng chờ giữ tappedAt; lần gửi lại báo ageMs = lúc gửi − lúc bấm → máy chủ ghi đúng giờ bấm */
    const tap1 = q[0] && q[0].payload.tappedAt;
    const okPosts = e.mock.state.requests.filter(r => r.method === 'POST' && /"ageMs"/.test(r.body)).map(r => ({ t: r.t, age: JSON.parse(r.body).ageMs }));
    const lastPost = okPosts[okPosts.length - 1] || {};
    T('Gửi lại: ageMs = lúc gửi lại − lúc bấm (máy chủ suy ra đúng giờ bấm, lệch < 2 s)', typeof tap1 === 'number' && lastPost.age > 0 && Math.abs((lastPost.t - lastPost.age) - tap1) < 2000, JSON.stringify({ tap1, lastPost }));
    T('Hàng chờ chỉ lưu tappedAt trên máy, body gửi đi không có tappedAt/clientTs', !e.mock.state.requests.some(r => /tappedAt|clientTs/.test(r.body)));
    if (e.mock.posts().length > 1) note('Gửi lại tạo ' + e.mock.posts().length + ' POST cùng sessionId; mock (như Apps Script) cập nhật cùng dòng.');

    /* Lượt 2 offline, rồi có mạng lại mà KHÔNG tải lại trang → sự kiện online gửi lại */
    await typeId(page, '26012345');
    await pickLevel(page, 6);
    await pickCard(page, 'Đau khổ');
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await submit(page);
    await waitFor(page, "JSON.parse(localStorage.getItem('checkin_me_bau_queue') || '[]').length === 1 && __qa.warns.length > 0", 3000);
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    T('Có mạng lại (sự kiện online): gửi lại lượt 2, hàng chờ trống, Sheet đúng 2 dòng (2 sessionId)', e.mock.state.rows.length === 2 && uniq(e.mock.state.rows.map(r => r.sessionId)).length === 2 && (await queue(page)).length === 0, JSON.stringify(e.mock.state.rows.map(r => r.sessionId + ':' + r.part2)));
    s = await qa(page);
    saveConsole('offline', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= down: máy chủ lỗi / từ chối ================= */
async function scenarioDown() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    e.mock.state.mode = '500json';
    await typeId(page, '26012345');
    await pickLevel(page, 4);
    await pickCard(page, 'Tức giận');
    T('500+JSON: trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 0', 3000);
    let s = await qa(page);
    T('500+JSON: KHÔNG log "Đã lưu" (kiểm response.ok), warn "Chưa gửi được"', !s.logs.some(l => l.startsWith(TXT.logSaved)) && s.warns.some(w => w.startsWith(TXT.warnRetry) && /HTTP 500/.test(w)), JSON.stringify({ logs: s.logs, warns: s.warns }));
    T('500+JSON: lượt nằm trong hàng chờ', (await queue(page)).length === 1);
    await restart(page);
    e.mock.state.mode = '500text';
    await typeId(page, '26012345');
    await pickLevel(page, 4);
    await pickCard(page, 'Khó chịu');
    T('500+HTML: trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 1', 3000);
    s = await qa(page);
    T('500+HTML: warn "Chưa gửi được", hàng chờ 2 lượt', s.warns.filter(w => w.startsWith(TXT.warnRetry)).length === 2 && (await queue(page)).length === 2, JSON.stringify(s.warns));
    await restart(page);
    e.mock.state.mode = 'reject';
    await typeId(page, '26012345');
    await pickLevel(page, 8);
    await pickCard(page, 'Vui vẻ');
    T('Máy chủ từ chối (200 + result:error): trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 2', 3000);
    s = await qa(page);
    T('Máy chủ từ chối: warn "Máy chủ từ chối…", KHÔNG giữ lại để gửi lại (hàng chờ vẫn 2)', s.warns.some(w => w.startsWith(TXT.warnReject)) && (await queue(page)).length === 2 && !s.logs.some(l => l.startsWith(TXT.logSaved)), JSON.stringify(s.warns));
    /* Máy chủ khỏe lại → online → gửi lại 2 lượt */
    e.mock.state.mode = 'ok';
    e.mock.state.rows.length = 0;
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    s = await qa(page);
    T('Máy chủ khỏe lại: gửi lại đúng 2 lượt còn treo, 2 log "Đã lưu", hàng chờ trống', e.mock.state.rows.length === 2 && uniq(e.mock.state.rows.map(r => r.part2)).sort().join(',') === 'Khó chịu,Tức giận' && s.logs.filter(l => l.startsWith(TXT.logSaved)).length === 2 && (await queue(page)).length === 0, JSON.stringify(e.mock.state.rows.map(r => r.part2)));
    T('Lỗi máy chủ: không console.error, không alert', s.errors.length === 0 && s.alerts.length === 0, JSON.stringify(s.errors));
    saveConsole('down', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= hang: máy chủ treo → hết giờ, giữ trong hàng chờ ================= */
async function scenarioHang() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    e.mock.state.mode = 'hang';
    /* Rút ngắn thời gian chờ để test nhanh (mặc định 15 s) */
    await page.evaluate('SEND_TIMEOUT_MS = 800; true');
    await typeId(page, '26012345');
    await pickLevel(page, 8);
    await pickCard(page, 'Vui vẻ');
    const t0 = Date.now();
    const sent = await submit(page);
    const dt = Date.now() - t0;
    T('Treo: trang cảm ơn vẫn hiện, không chờ máy chủ', sent);
    FLAKY('Treo: sang cảm ơn < 1,5 s', dt < 1500, dt + ' ms');
    T('Treo: mock đã nhận 1 POST (đang giữ)', e.mock.posts().length === 1);
    await waitFor(page, '__qa.warns.length > 0', 3000);
    const s = await qa(page);
    T('Treo: hết giờ (AbortController) → warn "Chưa gửi được", không alert', s.warns.some(w => w.startsWith(TXT.warnRetry)) && s.alerts.length === 0, JSON.stringify(s.warns));
    T('Treo: lượt vẫn nằm trong hàng chờ để gửi lại', (await queue(page)).length === 1);
    saveConsole('hang', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= double: bấm hai lần nhanh ================= */
async function scenarioDouble() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Đau khổ');
    await waitReady(page);
    await assertSafeUrl(page);
    const { x, y } = await page.center('#btn-submit');
    for (let i = 0; i < 2; i++) {
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(40);
    }
    await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2500);
    await sleep(300);
    T('Double tap: chỉ 1 POST', e.mock.posts().length === 1, e.mock.posts().length);
    T('Double tap: chữ nút "Đang lưu Check-in…" + class .sending (thôi đập nhịp)', (await btn(page)).text === TXT.btnSaving && (await page.evaluate("document.getElementById('btn-submit').classList.contains('sending')")), (await btn(page)).text);
    await restart(page);
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Đau khổ');
    await assertSafeUrl(page);
    await page.evaluate('submitCheckin(); submitCheckin(); true');
    await sleep(700);
    T('Gọi submitCheckin() 2 lần liên tiếp → chỉ thêm 1 POST (cờ isSending)', e.mock.posts().length === 2, e.mock.posts().length + ' POST');
    await restart(page);
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Đau khổ');
    await page.evaluate("document.getElementById('input-patient-id').focus(); true");
    await page.key('Enter');
    await sleep(300);
    T('Enter trong ô mã số không gửi (không có <form>)', e.mock.posts().length === 2 && (await checkinVisible(page)));
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('double', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= imgfail: ảnh 404 (giả lập thiếu file) → emoji ================= */
async function scenarioImgFail() {
  let e;
  try {
    e = await setup({ height: 1400, failAssets: true });
    const { page } = e;
    await waitFor(page, "document.getElementById('current-capy').hidden && document.querySelectorAll('.capy-img-box.fallback').length === 9", 3000);
    let lv = await level(page);
    T('Chưa chọn mức: khung 130×130 hiện hoa 🌸, không tải ảnh mức', lv.imgHidden && !lv.emojiHidden && lv.emoji === '🌸' && lv.src === '' && Math.round(lv.ew) === 130 && Math.round(lv.eh) === 130, JSON.stringify(lv));
    await pickLevel(page, 5);
    await waitFor(page, "document.getElementById('current-capy').hidden && document.getElementById('current-capy-emoji').textContent === '😐'", 2000);
    lv = await level(page);
    T('Ảnh mức 404 (chọn mức 5): ẩn <img>, hiện emoji 😐 trong khung 130×130', lv.natural === 0 && lv.imgHidden && !lv.emojiHidden && lv.emoji === '😐' && Math.round(lv.ew) === 130 && Math.round(lv.eh) === 130, JSON.stringify(lv));
    await pickLevel(page, 1);
    await sleep(300);
    lv = await level(page);
    T('Ảnh mức 404 khi kéo sang mức 1: emoji đổi thành 😞, alt vẫn đổi theo mức', lv.imgHidden && lv.emoji === '😞' && lv.alt === 'Bé Capybara mức 1: Tuyệt vọng', JSON.stringify(lv));
    const cs = await cards(page);
    T('Ảnh thẻ 404: 9 khung .fallback (9 ảnh thẻ lỗi), hiện đúng emoji theo cảm xúc', cs.length === 9 && cs.every(c => c.fallback && c.after === '"' + CARD_EMOJI[c.name] + '"'), JSON.stringify(cs.map(c => c.name + ':' + c.after)));
    const boxes = await page.evaluate("[...document.querySelectorAll('.capy-img-box')].map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))");
    T('Ảnh thẻ 404: 9 khung vuông bằng nhau, ≥ 60 px', boxes.length === 9 && new Set(boxes).size === 1 && boxes.every(x => { const [w, h] = x.split('x').map(Number); return w === h && w >= 60; }), boxes.join(','));
    T('Ảnh 404: không tràn ngang', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await page.evaluate("document.getElementById('emotion-display-area').scrollIntoView({block:'start'}); true");
    await page.screenshot(path.join(OUT, 'shot-imgfail-375.png'), true);
    const s = await qa(page);
    T('Ảnh 404: app không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    note('Trình duyệt ghi ' + e.browserLog.filter(l => /\.(jpg|png)\b/.test(l)).length + ' dòng 404 ảnh – biết trước (ảnh chỉ có trên repo gốc).');
    saveConsole('imgfail', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= layout: 375×667 và 320×568 ================= */
async function scenarioLayout() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    const measure = () => page.evaluate(`(() => {
      const r = s => { const el = document.querySelector(s); const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      const music = r('#music-toggle-btn');
      const over = [...document.querySelectorAll('body *')].filter(el => !el.matches('#fireworks-canvas, #music-hint, #toast, audio, source')).filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 0.5 || b.left < -0.5); }).map(el => el.tagName + '.' + el.className).slice(0, 6);
      const cols = getComputedStyle(document.querySelector('.emotion-grid')).gridTemplateColumns.split(' ').length;
      /* chỉ đo phần tử đang hiện (.btn-restart ở trang cảm ơn đang ẩn → bỏ) */
      const taps = ['#input-patient-id', '#btn-submit', '#music-toggle-btn', '.btn-restart', '.support-summary'].map(s => { const b = document.querySelector(s).getBoundingClientRect(); return b.width > 0 ? s + ':' + Math.round(b.width) + 'x' + Math.round(b.height) : null; }).filter(Boolean)
        .concat([...document.querySelectorAll('.level-dot, .capy-card')].map(el => (el.dataset.level ? 'dot' + el.dataset.level : 'card') + ':' + Math.round(el.offsetWidth) + 'x' + Math.round(el.offsetHeight)));
      /* 10 chấm xếp mấy hàng (đếm các mức top khác nhau) */
      const dotRows = new Set([...document.querySelectorAll('.level-dot')].map(d => Math.round(d.offsetTop))).size;
      const cardRows = new Set([...document.querySelectorAll('.capy-card')].map(d => Math.round(d.getBoundingClientRect().top))).size;
      const btn = r('#btn-submit');
      document.getElementById('music-hint').classList.add('show');
      const mh = r('#music-hint');
      document.getElementById('music-hint').classList.remove('show');
      return { w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, over, cols, taps, dotRows, cardRows,
        musicPos: getComputedStyle(document.getElementById('music-toggle-btn')).position,
        musicOverBadge: inter(music, r('.badge-tag')), musicOverH1: inter(music, r('.main-title')), hintOverBadge: inter(mh, r('.badge-tag')), hintOverH1: inter(mh, r('.main-title')), musicRect: music,
        hintLeft: mh.l, hintRight: mh.r, btnTop: btn.t, btnBottom: btn.b };
    })()`);
    let m = await measure();
    T('375×667: không tràn ngang, thẻ 3×3, chấm 2 hàng × 5', m.scrollW <= 375 && m.over.length === 0 && m.cols === 3 && m.cardRows === 3 && m.dotRows === 2, JSON.stringify({ scrollW: m.scrollW, over: m.over, cols: m.cols, cardRows: m.cardRows, dotRows: m.dotRows }));
    T('375: vùng chạm chính ≥ 44 px (10 chấm, 9 thẻ, nút, "Hỗ trợ")', m.taps.every(t => { const [w, h] = t.split(':')[1].split('x').map(Number); return w >= 44 && h >= 44; }), m.taps.join(','));
    T('Nút nhạc nằm trong card (không position:fixed) → không đè nội dung khi cuộn', m.musicPos !== 'fixed', m.musicPos);
    T('375: nút nhạc và gợi ý nhạc không đè lên eyebrow/h1', m.musicOverBadge === 0 && m.musicOverH1 === 0 && m.hintOverBadge === 0 && m.hintOverH1 === 0, JSON.stringify({ badge: m.musicOverBadge, h1: m.musicOverH1, hb: m.hintOverBadge, hh: m.hintOverH1 }));
    T('375×667: nút Hoàn thành nằm dưới màn đầu (phải cuộn ~' + Math.round(m.btnTop - 667) + ' px), trang cao ' + m.scrollH + ' px', m.btnTop > 667, 'btnTop=' + Math.round(m.btnTop));
    await page.screenshot(path.join(OUT, 'shot-layout-375-top.png'), false);
    /* 360 px (điện thoại Android phổ biến): 2 hàng × 5 chấm, thẻ 3×3, chọn chấm 10 (phóng to) vẫn không tràn */
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    await pickLevel(page, 10);
    await pickLevel(page, 5);
    m = await measure();
    T('360×640: chấm 2 hàng × 5, thẻ 3×3, không tràn ngang (kể cả khi chấm đang phóng)', m.scrollW <= 360 && m.over.length === 0 && m.dotRows === 2 && m.cols === 3 && m.cardRows === 3, JSON.stringify({ scrollW: m.scrollW, over: m.over, dotRows: m.dotRows, cols: m.cols }));
    T('360: mọi chấm, thẻ, nút ≥ 44×44 px', m.taps.every(t => { const [w, h] = t.split(':')[1].split('x').map(Number); return w >= 44 && h >= 44; }), m.taps.join(','));
    await page.evaluate("document.getElementById('part-1').scrollIntoView({block:'start'}); true");
    await page.screenshot(path.join(OUT, 'shot-layout-360-dots.png'), false);
    /* Màn rộng: 1 hàng 10 chấm */
    await page.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    m = await measure();
    T('768 px: 10 chấm một hàng, không tràn ngang', m.dotRows === 1 && m.scrollW <= 768 && m.over.length === 0, JSON.stringify({ dotRows: m.dotRows, scrollW: m.scrollW }));
    /* Gợi ý 5 review: 600–700 px lưới 10 chấm từng tràn ~2 px khỏi khung nhóm */
    const fit = [];
    for (const w of [600, 620, 640, 660, 700]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(120);
      fit.push(await page.evaluate(`(() => { const g = document.getElementById('level-dots'); const ds = [...g.querySelectorAll('.level-dot')]; const gb = g.getBoundingClientRect(); const cs = getComputedStyle(g);
        const innerL = gb.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), innerR = gb.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
        const L = Math.min(...ds.map(d => d.offsetLeft + gb.left)), R = Math.max(...ds.map(d => d.offsetLeft + d.offsetWidth + gb.left));
        return { w: ${w}, sw: g.scrollWidth, cw: g.clientWidth, rows: new Set(ds.map(d => d.offsetTop)).size, ok: g.scrollWidth <= g.clientWidth && new Set(ds.map(d => d.offsetTop)).size === 1 }; })()`));
    }
    T('600–700 px: 10 chấm một hàng, không tràn khung nhóm (scrollWidth ≤ clientWidth)', fit.every(f => f.ok), JSON.stringify(fit));
    await page.screenshot(path.join(OUT, 'shot-layout-768.png'), true);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    m = await measure();
    T('320×568: không tràn ngang, thẻ 3×3, chấm 2 hàng', m.scrollW <= 320 && m.over.length === 0 && m.cols === 3 && m.dotRows === 2, JSON.stringify({ scrollW: m.scrollW, over: m.over, cols: m.cols, dotRows: m.dotRows }));
    T('320: nút nhạc và gợi ý nhạc không đè lên eyebrow/h1', m.musicOverBadge === 0 && m.musicOverH1 === 0 && m.hintOverBadge === 0 && m.hintOverH1 === 0, JSON.stringify({ badge: m.musicOverBadge, h1: m.musicOverH1, hb: m.hintOverBadge, hh: m.hintOverH1, music: m.musicRect }));
    T('320: gợi ý nhạc không lọt ra ngoài trái màn', m.hintLeft >= 0, 'hintLeft=' + Math.round(m.hintLeft) + ' hintRight=' + Math.round(m.hintRight));
    T('320: vùng chạm chính ≥ 44 px', m.taps.every(t => { const [w, h] = t.split(':')[1].split('x').map(Number); return w >= 44 && h >= 44; }), m.taps.join(','));
    note('320: nút Hoàn thành ở y=' + Math.round(m.btnTop) + ', trang cao ' + m.scrollH + ' px.');
    await page.screenshot(path.join(OUT, 'shot-layout-320-top.png'), false);
    await page.screenshot(path.join(OUT, 'shot-layout-320-full.png'), true);
    /* Trang cảm ơn ở 320 */
    await typeId(page, '26012345');
    await pickLevel(page, 8);
    await pickCard(page, 'Vui vẻ');
    T('320: gửi được', await submit(page));
    await sleep(1200);
    const sw = await page.evaluate('document.documentElement.scrollWidth');
    T('320: trang cảm ơn không tràn ngang', sw <= 320, sw);
    await page.screenshot(path.join(OUT, 'shot-layout-320-success.png'), true);
    const vp = await page.evaluate("document.querySelector('meta[name=viewport]').content");
    T('Viewport cho phép phóng to (không user-scalable=no, không maximum-scale=1)', !/user-scalable=no|maximum-scale=1/.test(vp), vp);
  } finally { await teardown(e); }
}

/* ================= reduced: prefers-reduced-motion ================= */
async function scenarioReduced() {
  let e;
  try {
    e = await setup({ reducedMotion: true });
    const { page } = e;
    T('reduce: matchMedia = true', await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"));
    const animLoad = await page.evaluate("({ page: getComputedStyle(document.getElementById('page-checkin')).animationName, capy: getComputedStyle(document.getElementById('current-capy')).animationName })");
    T('reduce: tắt fadeIn của trang và gentlePop của ảnh mức', animLoad.page === 'none' && animLoad.capy === 'none', JSON.stringify(animLoad));
    await typeId(page, '26012345');
    await pickLevel(page, 8);
    await pickCard(page, 'Vui vẻ');
    await waitReady(page);
    const b = await btn(page);
    T('reduce: nút .ready KHÔNG đập nhịp (animation none)', b.anim === 'none', JSON.stringify(b));
    T('reduce: badge ✓ không pop', (await page.evaluate("getComputedStyle(document.querySelector('.capy-card.selected .check-mark-badge')).animationName")) === 'none');
    await submit(page);
    const parts = await page.evaluate('particles.length');
    T('reduce: pháo hoa TẮT (particles = 0 sau khi bấm)', parts === 0, parts);
    const tick = await page.evaluate("({ svg: getComputedStyle(document.querySelector('.success-checkmark')).animationName, circle: getComputedStyle(document.querySelector('.checkmark-circle')).animationName, off: getComputedStyle(document.querySelector('.checkmark-check')).strokeDashoffset })");
    T('reduce: tick xanh hiện tĩnh (không vẽ dần)', tick.circle === 'none' && tick.svg === 'none' && /^0(px)?$/.test(tick.off), JSON.stringify(tick));
    await sleep(300);
    await page.screenshot(path.join(OUT, 'shot-reduced-success.png'), true);
    const s = await qa(page);
    T('reduce: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
  } finally { await teardown(e); }
}

/* ================= music: mặc định tắt, chị tự bật ================= */
async function scenarioMusic() {
  let e;
  try {
    e = await setup({ failAssets: true });
    const { page, requests } = e;
    T('Nhạc: gợi ý "Muốn có nhạc nhẹ?" hiện một lúc sau khi mở trang', !!(await waitFor(page, "document.getElementById('music-hint').classList.contains('show')", 2000)));
    T('Nhạc: trước khi bấm, 0 request mp3', requests.filter(r => /background-music\.mp3/.test(r.url)).length === 0);
    await page.click('#music-toggle-btn');
    await waitFor(page, "document.getElementById('toast').classList.contains('show')", 3000);
    T('Nhạc: bấm nút → trình duyệt mới tải mp3', requests.filter(r => /background-music\.mp3/.test(r.url)).length >= 1, requests.filter(r => /mp3/.test(r.url)).length);
    T('Nhạc: thiếu file (404) → toast nhẹ, nút trở về TẮT 🔇 aria-pressed=false, nhãn vẫn "Nhạc nền"', (await toastText(page)) === TXT.toastMusic && (await text(page, '#music-toggle-btn')) === '🔇' && (await page.evaluate("document.getElementById('music-toggle-btn').getAttribute('aria-pressed') === 'false' && document.getElementById('music-toggle-btn').getAttribute('aria-label') === 'Nhạc nền'")), await toastText(page));
    note('Kịch bản này giả lập thiếu mp3 (404) để thử nhánh lỗi; nhánh phát thành công chỉ đổi nút sang 🎵 / aria-pressed=true.');
    T('Nhạc: app không ghi khóa "musicMuted" (khóa dùng chung với Nhật Ký Mẹ Bầu)', (await page.evaluate("localStorage.getItem('musicMuted')")) === null);
    const s = await qa(page);
    T('Nhạc: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('music', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= noadmin: lối "quản trị" bằng SĐT đã bỏ (Chặn #3) ================= */
async function scenarioNoAdmin() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    /* Máy đã dùng bản cũ: localStorage còn lịch sử SĐT của nhiều người, có cả chuỗi XSS */
    await page.evaluate("localStorage.setItem('myCheckins', JSON.stringify([{ created_at: '08:00:00 28/10/2026', phone: '0911111111', part1: '5 - Bình thường (Ổn)', part2: 'Vui vẻ' }, { created_at: '10:00:00 28/10/2026', phone: '<img src=x onerror=\"window.__xssAdmin=1\">', part1: '7 - Tốt', part2: 'Lo lắng' }])); localStorage.setItem('musicMuted', 'false'); true");
    await page.navigate(APP_URL);
    await sleep(300);
    T('Mở bản mới: lịch sử cũ "myCheckins" (SĐT thô) bị dọn khỏi máy', (await page.evaluate("localStorage.getItem('myCheckins')")) === null);
    T('Không còn modal / hàm quản trị (admin-modal, openAdminPanel, fetchHistory, deleteCheckin)', (await page.evaluate("!document.getElementById('admin-modal') && typeof openAdminPanel === 'undefined' && typeof fetchHistory === 'undefined' && typeof deleteCheckin === 'undefined'")));
    await typeId(page, '0967791552');
    await sleep(200);
    await pickLevel(page, 5);
    await pickCard(page, 'Vui vẻ');
    T('Gõ 0967791552 (số admin cũ): chỉ là một mã số bình thường, không mở gì, ô không bị xóa, nút bật', (await idVal(page)) === '0967791552' && !!(await waitReady(page)) && (await page.evaluate("document.querySelectorAll('table, [role=dialog]').length")) === 0);
    T('Không XSS từ dữ liệu cũ', (await page.evaluate('window.__xssAdmin')) === undefined || (await page.evaluate('window.__xssAdmin')) === null);
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('noadmin', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= sharedkeys: không đụng localStorage của app khác cùng origin ================= */
async function scenarioSharedKeys() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    /* ditruyenhungvuong.github.io/<repo>/ dùng chung localStorage: đặt sẵn khóa của Nhật Ký Mẹ Bầu + khóa cũ của Check-in */
    const SEED = { musicMuted: 'true', myJourneys: JSON.stringify([{ id: 'j1', note: 'giả lập Nhật Ký' }]), user_0912345678: JSON.stringify({ name: 'Chị Lan', phone: '0912345678' }) };
    await page.evaluate(`(() => { const s = ${JSON.stringify(SEED)}; Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); localStorage.setItem('myCheckins', '[{"phone":"0911111111"}]'); localStorage.setItem('checkin_me_bau_pending', JSON.stringify([{ payload: { sessionId: 'sess-old-0001', phone: '0911111111', level: 5, part1: '5 - Bình thường (Ổn)', part2: 'Vui vẻ' }, queuedAt: Date.now() }])); return true; })()`);
    await page.navigate(APP_URL);
    await sleep(1200);
    const snap = () => page.evaluate(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })()`);
    let st = await snap();
    T('Mở Check-in: 3 khóa của Nhật Ký (musicMuted, myJourneys, user_0912345678) còn nguyên giá trị', Object.keys(SEED).every(k => st[k] === SEED[k]), JSON.stringify(st));
    T('Mở Check-in: chỉ dọn "myCheckins" và hàng chờ cũ "checkin_me_bau_pending" (còn giữ SĐT) của chính Check-in', !('myCheckins' in st) && !('checkin_me_bau_pending' in st));
    T('Hàng chờ cũ (có SĐT) bị bỏ, KHÔNG gửi lên máy chủ', e.mock.posts().length === 0 && !e.mock.posts().some(p => /0911111111/.test(p.body)), e.mock.posts().length + ' POST');
    /* Dùng hết các chức năng: bật nhạc (lỗi 404), gửi offline để có hàng chờ, gửi lại, làm lại */
    await page.click('#music-toggle-btn');
    await sleep(800);
    await typeId(page, '26012345');
    await pickLevel(page, 2);
    await pickCard(page, 'Đau khổ');
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await submit(page);
    await waitFor(page, '__qa.warns.length > 0', 3000);
    st = await snap();
    const ownKeys = Object.keys(st).filter(k => !(k in SEED));
    T('Khóa app tự ghi đều có tiền tố "checkin_me_bau_"', ownKeys.length >= 1 && ownKeys.every(k => k.startsWith('checkin_me_bau_')), ownKeys.join(','));
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_queue')", 3000);
    await restart(page);
    st = await snap();
    T('Sau bật nhạc, gửi offline, gửi lại, làm lại: 3 khóa của Nhật Ký vẫn nguyên, không còn khóa lạ', Object.keys(SEED).every(k => st[k] === SEED[k]) && Object.keys(st).filter(k => !(k in SEED)).every(k => k.startsWith('checkin_me_bau_')), JSON.stringify(st));
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('sharedkeys', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ===== Chạy ===== */
const SCENARIOS = { main: scenarioMain, keyboard: scenarioKeyboard, level: scenarioLevel, shuffle: scenarioShuffle, oldserver: scenarioOldServer, patientid: scenarioPatientId, xss: scenarioXss, offline: scenarioOffline, down: scenarioDown, hang: scenarioHang, double: scenarioDouble, imgfail: scenarioImgFail, layout: scenarioLayout, reduced: scenarioReduced, music: scenarioMusic, noadmin: scenarioNoAdmin, sharedkeys: scenarioSharedKeys };
(async () => {
  const names = argv.only ? String(argv.only).split(',') : Object.keys(SCENARIOS);
  const before = fs.readFileSync(path.join(APP, 'script.js'), 'utf8');
  for (const n of names) {
    scenarioName = n;
    console.log('\n=== Kịch bản ' + n + ' ===');
    /* Mỗi kịch bản tối đa 150 s; quá giờ → CRASH, kịch bản sau vẫn chạy (Chrome của kịch bản kẹt được dọn ở cuối theo PID) */
    let timer;
    try { await Promise.race([SCENARIOS[n](), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('quá 150 s – kịch bản bị kẹt')), 150000); })]); }
    catch (err) { fails++; results.push('CRASH [' + n + '] ' + (err && err.stack || err)); console.log('CRASH', err); }
    finally { clearTimeout(timer); }
  }
  scenarioName = 'dọn';
  T('Vệ sinh: test không ghi vào script.js (so byte trước/sau lần chạy)', fs.readFileSync(path.join(APP, 'script.js'), 'utf8') === before);
  T('AN TOÀN: đã xác nhận URL mock trước mỗi lần bấm Hoàn thành (' + safeChecks + ' lần)', safeChecks > 0);
  T('Vệ sinh: không file lạ trong thư mục app (ngoài tests/)', fs.readdirSync(APP).filter(f => !['.git', '.gitignore', 'NGUON.md', 'README.md', 'google_apps_script.js', 'google_apps_script-du-an-cu.js', 'index.html', 'script.js', 'styles.css', 'upload.bat', 'upload.sh', 'tests', 'background-music.mp3'].includes(f) && !/^(capy-level-\d\d\.png|(vui|buon|khoc|tuc|hoang_hot|kho_chiu)\.jpg|(vui_ve|dau_kho|lo_lang|tuc_gian|hoang_hot|kho_chiu|met_moi|binh_an|co_don)\.png)$/.test(f)).length === 0, fs.readdirSync(APP).join(','));
  const pass = results.filter(r => r.startsWith('PASS')).length;
  const flaky = results.filter(r => r.startsWith('CHẬP CHỜN')).length;
  const total = results.filter(r => /^(PASS|FAIL|CRASH|CHẬP)/.test(r)).length;
  const summary = '\n' + pass + '/' + total + ' PASS, ' + fails + ' FAIL, ' + flaky + ' CHẬP CHỜN' + (results.some(r => r.startsWith('CRASH')) ? ' (có CRASH)' : '');
  console.log(summary);
  fs.writeFileSync(path.join(OUT, 'e2e-results.txt'), results.join('\n') + '\n' + summary + '\n');
  console.log('Kết quả: ' + path.join(OUT, 'e2e-results.txt'));
  process.exit(fails ? 1 : 0);
})();
