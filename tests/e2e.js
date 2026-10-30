/* =========================================================
   E2E – Check-in Cảm Xúc Mẹ Bầu (QA). Chrome headless thật qua DevTools Protocol.
   Dùng lại thư viện CDP của app checkin-vao-ca (tests/lib/cdp.js), server tĩnh và mock Sheet riêng ở tests/lib.

   Chạy:  node tests/e2e.js [--out=<thư mục kết quả>] [--only=main,phone,...]
   Kịch bản: main | keyboard | phone | xss | offline | down | hang | double | imgfail | layout | reduced | music | noadmin | sharedkeys

   Bản 28/10/2026: app đã sửa theo docs/qa/checkin-me-bau-tong-hop.md (bỏ admin, escape, bàn phím, SĐT Việt Nam,
   hàng chờ gửi lại, nhạc mặc định tắt…). Test kiểm hành vi MỚI; những gì cố ý giữ chờ anh Thông quyết
   (nhãn 10 mức, ảnh "Lo lắng", nút "Thực hiện check-in khác", SĐT bắt buộc) được kiểm là "giữ nguyên".

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
  hintBoth: '💡 Chị nhập số điện thoại và chạm chọn 1 bé Capybara là xong nhé.',
  hintPhone: '💡 Chị nhập số điện thoại ở trên giúp mình nhé.',
  hintPhoneBad: '💡 Số điện thoại chưa đúng, chị xem lại giúp mình nhé.',
  hintCard: '💡 Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.',
  hintDone: '✨ Xong rồi, chị chạm nút Hoàn thành nhé!',
  phoneError: 'Số điện thoại chưa đúng định dạng Việt Nam (ví dụ 0912 345 678).',
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
const CARDS = ['Vui vẻ', 'Buồn', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu'];
const CARD_IMG = { 'Vui vẻ': 'vui.jpg', 'Buồn': 'buon.jpg', 'Lo lắng': 'khoc.jpg', 'Tức giận': 'tuc.jpg', 'Hoảng hốt': 'hoang_hot.jpg', 'Khó chịu': 'kho_chiu.jpg' };
const CARD_EMOJI = { 'Vui vẻ': '😊', 'Buồn': '😢', 'Lo lắng': '😟', 'Tức giận': '😠', 'Hoảng hốt': '😨', 'Khó chịu': '😣' };
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
  await page.navigate(APP_URL);
  if (!o.keepStorage) await page.evaluate("localStorage.clear(); true");
  return { page, kill, chromePid: child.pid, browserLog, consoleApi, requests };
}

/* ===== Tiện ích đọc trang ===== */
const text = (page, sel) => page.evaluate(`((document.querySelector(${JSON.stringify(sel)}) || { textContent: '' }).textContent || '').trim()`);
const qa = page => page.evaluate('JSON.parse(JSON.stringify(window.__qa))');
const hint = page => text(page, '#submit-hint');
const btn = page => page.evaluate("(() => { const b = document.getElementById('btn-submit'); const cs = getComputedStyle(b); return { disabled: b.disabled, ready: b.classList.contains('ready'), text: b.innerText.trim(), opacity: cs.opacity, transform: cs.transform, anim: cs.animationName, pe: cs.pointerEvents }; })()");
const cards = page => page.evaluate("[...document.querySelectorAll('.capy-card')].map(c => ({ tag: c.tagName, type: c.getAttribute('type'), name: c.querySelector('.capy-name').textContent, data: c.dataset.emotion, selected: c.classList.contains('selected'), pressed: c.getAttribute('aria-pressed'), badge: getComputedStyle(c.querySelector('.check-mark-badge')).display, src: (c.querySelector('img').getAttribute('src') || ''), alt: c.querySelector('img').alt, natural: c.querySelector('img').naturalWidth, fallback: c.querySelector('.capy-img-box').classList.contains('fallback'), after: getComputedStyle(c.querySelector('.capy-img-box'), '::after').content }))");
const level = page => page.evaluate("(() => { const r = document.getElementById('emotion-range'); const img = document.getElementById('current-capy'); const st = document.getElementById('current-status'); const em = document.getElementById('current-capy-emoji'); return { value: r.value, min: r.min, max: r.max, valuetext: r.getAttribute('aria-valuetext'), status: st.textContent, color: getComputedStyle(st).color, inlineColor: st.style.color, src: (img.getAttribute('src') || '').split('/').pop(), alt: img.alt, natural: img.naturalWidth, imgHidden: img.hidden, emojiHidden: em.hidden, emoji: em.textContent, w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, ew: em.offsetWidth, eh: em.offsetHeight }; })()");
const successVisible = page => page.evaluate("getComputedStyle(document.getElementById('page-success')).display !== 'none'");
const checkinVisible = page => page.evaluate("getComputedStyle(document.getElementById('page-checkin')).display !== 'none'");
/* Hàng chờ gửi lại (chỉ giữ lượt CHƯA gửi được) */
const queue = page => page.evaluate("JSON.parse(localStorage.getItem('checkin_me_bau_pending') || '[]')");
const toastText = page => page.evaluate("(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; })()");
const uniq = arr => [...new Set(arr)];
const phoneVal = page => page.evaluate("document.getElementById('input-phone').value");
async function waitFor(page, expr, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 3000)) {
    const v = await page.evaluate(expr);
    if (v) return v;
    await sleep(25);
  }
  return null;
}
async function typePhone(page, value) {
  await page.evaluate("(() => { const i = document.getElementById('input-phone'); i.focus(); i.select(); return true; })()");
  if (value === '') { await page.key('Backspace'); return; }
  await page.send('Input.insertText', { text: value });
}
/* Kéo thanh trượt bằng cách đặt value và phát sự kiện input (như kéo tay) */
const setSlider = (page, v) => page.evaluate(`(() => { const r = document.getElementById('emotion-range'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); return r.value; })()`);
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
const READY_EXPR = "(() => { const b = document.getElementById('btn-submit'); return b.classList.contains('ready') && !b.disabled; })()";
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
    T('Tải: hint ban đầu "thiếu cả hai", nút disabled, chưa .ready', (await hint(page)) === TXT.hintBoth && (await btn(page)).disabled && !(await btn(page)).ready, await hint(page));
    await sleep(350);
    let b = await btn(page);
    T('Tải: nút chưa thức dậy – mờ 0.45, co 0.96, pointer-events none', b.opacity === '0.45' && b.transform === 'matrix(0.96, 0, 0, 0.96, 0, 0)' && b.pe === 'none', JSON.stringify(b));
    T('Tải: chữ nút "Hoàn thành Check-in →"', b.text === TXT.btnIdle, b.text);
    let lv = await level(page);
    T('Tải: thanh trượt 5 (min 1, max 10), "5 - Bình thường (Ổn)", ảnh capy-level-05.png', lv.value === '5' && lv.min === '1' && lv.max === '10' && lv.status === '5 - ' + LEVELS[5] && lv.src === 'capy-level-05.png', JSON.stringify(lv));
    T('Tải: màu chữ trạng thái mức 5 = #a14d00 (đủ tương phản)', lv.color === hex2rgb(LEVEL_COLORS[5]), lv.color);
    T('Tải: alt ảnh mức và aria-valuetext theo mức 5', lv.alt === 'Bé Capybara mức 5: Bình thường (Ổn)' && lv.valuetext === '5 - Bình thường (Ổn)', JSON.stringify({ alt: lv.alt, vt: lv.valuetext }));
    const c0 = await cards(page);
    T('Tải: 6 thẻ là <button type=button>, chưa chọn, aria-pressed=false, tên = data-emotion', c0.length === 6 && c0.every(c => c.tag === 'BUTTON' && c.type === 'button' && !c.selected && c.pressed === 'false' && c.badge === 'none' && c.name === c.data), JSON.stringify(c0.map(c => c.tag + ':' + c.pressed)));
    T('Tải: focus không tự nhảy vào ô SĐT', await page.evaluate('document.activeElement === document.body'));
    T('Tải: nút nhạc 🔇 (mặc định TẮT), aria-pressed=false, nhãn cố định "Nhạc nền", audio không phát', (await text(page, '#music-toggle-btn')) === '🔇' && (await page.evaluate("document.getElementById('music-toggle-btn').getAttribute('aria-pressed') === 'false' && document.getElementById('music-toggle-btn').getAttribute('aria-label') === 'Nhạc nền' && document.getElementById('bg-music').paused")));
    T('Tải: chữ mức không aria-live (thanh trượt đã có aria-valuetext, không đọc hai lần)', !(await page.evaluate("document.getElementById('current-status').hasAttribute('aria-live')")));
    T('Tải: dòng giải thích SĐT nói rõ máy giữ tạm khi mạng yếu', /mạng yếu, máy này giữ tạm/.test(await text(page, '#phone-note')));
    T('Tải: dòng giải thích vì sao cần SĐT hiện trên ô', /bác sĩ/.test(await text(page, '#phone-note')), await text(page, '#phone-note'));
    T('Tải: dòng "Tự đánh giá, không phải thang chẩn đoán." hiện', (await page.evaluate("[...document.querySelectorAll('.footer-note')].some(n => n.offsetParent !== null && n.textContent.includes('không phải thang chẩn đoán'))")));
    await page.click('.main-title');
    await sleep(300);
    T('Nhạc: chạm vào trang KHÔNG tự phát nhạc, không tải mp3', (await page.evaluate("document.getElementById('bg-music').paused")) && requests.filter(r => /background-music\.mp3/.test(r.url)).length === 0);
    await page.screenshot(path.join(OUT, 'shot-main-01-load.png'), true);

    /* --- Nhập SĐT → hint "thiếu thẻ" --- */
    await typePhone(page, '0912345678');
    T('Hint: có SĐT, chưa thẻ → "thiếu thẻ"', (await hint(page)) === TXT.hintCard && (await btn(page)).disabled, await hint(page));

    /* --- Thanh trượt 1–10 --- */
    const sweep = [];
    for (let v = 1; v <= 10; v++) {
      await setSlider(page, v);
      lv = await level(page);
      /* màu đọc từ style inline (computed đang transition 0.2s) */
      const ok = lv.value === String(v) && lv.status === v + ' - ' + LEVELS[v] && lv.src === 'capy-level-' + String(v).padStart(2, '0') + '.png' && lv.inlineColor === hex2rgb(LEVEL_COLORS[v]) && lv.alt === 'Bé Capybara mức ' + v + ': ' + LEVELS[v] && lv.valuetext === v + ' - ' + LEVELS[v] && lv.emoji === LEVEL_EMOJI[v];
      sweep.push(ok ? v : v + '✗(' + lv.status + '/' + lv.src + '/' + lv.inlineColor + '/' + lv.alt + ')');
    }
    T('Thanh trượt: 10 mức đổi đúng chữ, ảnh, màu, alt, aria-valuetext, emoji dự phòng', sweep.every(x => typeof x === 'number'), sweep.join(' '));
    let s = await qa(page);
    T('Thanh trượt: src ảnh đổi đúng thứ tự 01→10', s.capySrc.join(',') === [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => 'capy-level-' + String(v).padStart(2, '0') + '.png').join(','), s.capySrc.join(','));
    T('Thanh trượt: rung 5 ms mỗi lần đổi (navigator.vibrate)', s.vibrate.filter(v => v === 5).length >= 10, JSON.stringify(s.vibrate.slice(0, 12)));
    await page.evaluate("document.getElementById('emotion-range').focus(); true");
    await page.key('Home');
    lv = await level(page);
    T('Thanh trượt: phím Home → 1 - Tuyệt vọng, capy-level-01', lv.value === '1' && lv.status === '1 - Tuyệt vọng' && lv.src === 'capy-level-01.png', JSON.stringify(lv));
    await page.key('ArrowLeft');
    T('Thanh trượt: ArrowLeft ở 1 vẫn 1', (await level(page)).value === '1');
    await page.key('End');
    lv = await level(page);
    T('Thanh trượt: phím End → 10 - Rất tuyệt vời', lv.value === '10' && lv.status === '10 - Rất tuyệt vời', lv.status);
    T('Thanh trượt: nhãn hai đầu "1 (Tuyệt vọng)" / "10 (Rất tuyệt vời)" (giữ nguyên chờ anh)', (await page.evaluate("[...document.querySelectorAll('.slider-labels span')].map(s => s.textContent).join('|')")) === '1 (Tuyệt vọng)|10 (Rất tuyệt vời)');
    const sliderBox = await page.evaluate("(() => { const b = document.getElementById('emotion-range').getBoundingClientRect(); return Math.round(b.height); })()");
    T('Thanh trượt: vùng chạm cao ≥ 44 px', sliderBox >= 44, sliderBox + ' px');
    await setSlider(page, 3);
    T('Hint: đổi thanh trượt không làm nút bật khi chưa chọn thẻ', (await btn(page)).disabled && (await hint(page)) === TXT.hintCard);

    /* --- 6 thẻ, chỉ một được chọn --- */
    const pickLog = [];
    for (const name of CARDS) {
      const ok = await pickCard(page, name);
      const cs = await cards(page);
      const only = cs.filter(c => c.selected).map(c => c.name);
      const pressed = cs.filter(c => c.pressed === 'true').map(c => c.name);
      pickLog.push(name + ':' + (ok && only.length === 1 && only[0] === name && pressed.join() === name && cs.find(c => c.name === name).badge === 'flex' ? 'ok' : 'LỖI ' + only.join('/') + ' pressed=' + pressed.join('/')));
    }
    T('Thẻ: chọn lần lượt 6 thẻ, mỗi lúc đúng 1 thẻ .selected + aria-pressed=true + badge ✓', pickLog.every(x => x.endsWith(':ok')), pickLog.join(' '));
    T('Thẻ: tên file ảnh giữ nguyên (Lo lắng → khoc.jpg, chờ anh xem ảnh)', (await cards(page)).map(c => c.name + '→' + c.src).join(',') === CARDS.map(n => n + '→' + CARD_IMG[n]).join(','), (await cards(page)).map(c => c.name + '→' + c.src).join(','));
    s = await qa(page);
    T('Thẻ: rung 25 ms khi chạm', s.vibrate.filter(v => v === 25).length >= 6);
    await pickCard(page, 'Lo lắng');
    T('Hint: đủ SĐT + thẻ → "✨ đủ", class .done nền xanh nhạt, nút .ready không disabled', (await hint(page)) === TXT.hintDone && (await waitReady(page)) && (await page.evaluate("document.getElementById('submit-hint').classList.contains('done') && getComputedStyle(document.getElementById('submit-hint')).backgroundColor")) === 'rgb(232, 245, 233)', await hint(page));
    await sleep(400);
    b = await btn(page);
    T('Nút thức dậy: opacity 1, scale 1, animation gentlePulse, pointer-events auto', b.opacity === '1' && b.transform === 'matrix(1, 0, 0, 1, 0, 0)' && b.anim === 'gentlePulse' && b.pe === 'auto', JSON.stringify(b));

    /* --- Hint "thiếu SĐT" (xóa SĐT khi đã có thẻ) --- */
    await typePhone(page, '');
    T('Hint: có thẻ, xóa SĐT → "thiếu SĐT" (không còn chữ "hệ thống"), nút tắt', (await hint(page)) === TXT.hintPhone && (await btn(page)).disabled, await hint(page));
    await typePhone(page, '09123456');
    T('Hint: SĐT đang gõ dở 8 số → vẫn "thiếu SĐT", chưa báo lỗi', (await hint(page)) === TXT.hintPhone && (await btn(page)).disabled && (await text(page, '#phone-error')) === '');
    await typePhone(page, '0912345678');
    T('Hint: SĐT 10 số trở lại → "✨ đủ"', (await hint(page)) === TXT.hintDone && !!(await waitReady(page)));
    await page.evaluate("document.getElementById('submit-section').scrollIntoView({block:'center'}); true");
    await page.screenshot(path.join(OUT, 'shot-main-02-ready.png'), true);

    /* --- Bấm Hoàn thành ở mức 3 --- */
    await setSlider(page, 3);
    const sent = await submit(page);
    T('Gửi: sang trang cảm ơn sau khi bấm', sent);
    s = await qa(page);
    FLAKY('Gửi: trang cảm ơn hiện ~400 ms sau bấm (setTimeout 400)', s.successShownAt - s.clickAt >= 380 && s.successShownAt - s.clickAt < 900, (s.successShownAt - s.clickAt).toFixed(0) + ' ms');
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    T('Gửi: 1 POST tới mock', e.mock.posts().length === 1, e.mock.posts().length);
    const req = e.mock.posts()[0] || {};
    T('Gửi: Content-Type text/plain;charset=utf-8 (không preflight)', /^text\/plain;charset=utf-8$/i.test(req.contentType), req.contentType);
    const body = e.mock.state.rows[0] || {};
    T('Gửi: body đúng 6 trường ageMs, level, part1, part2, phone, sessionId (độ trễ, không giờ tuyệt đối, không created_at)', Object.keys(body).sort().join(',') === 'ageMs,level,part1,part2,phone,sessionId' && Number.isInteger(body.ageMs) && body.ageMs >= 0 && body.ageMs < 5000, JSON.stringify(body));
    T('Gửi: phone "0912345678", level 3, part1 "3 - Tồi tệ", part2 "Lo lắng", sessionId hợp lệ', body.phone === '0912345678' && body.level === 3 && body.part1 === '3 - Tồi tệ' && body.part2 === 'Lo lắng' && SID_RE.test(body.sessionId), JSON.stringify(body));
    T('Gửi: không alert', s.alerts.length === 0, JSON.stringify(s.alerts));
    s = await qa(page);
    T('Gửi: console.log "[Check-in] Đã lưu lên Google Sheet:" chỉ khi {result:success}', s.logs.some(l => l.startsWith(TXT.logSaved) && /success/.test(l)), JSON.stringify(s.logs));
    T('Gửi: gửi xong thì hàng chờ trống, không còn "myCheckins" giữ SĐT', (await queue(page)).length === 0 && (await page.evaluate("localStorage.getItem('myCheckins')")) === null, JSON.stringify(await queue(page)));
    /* --- Trang cảm ơn --- */
    T('Cảm ơn: trang check-in ẩn, trang cảm ơn hiện', !(await checkinVisible(page)) && (await successVisible(page)));
    T('Cảm ơn: tick xanh SVG hiện, vòng tròn stroke animation', (await page.evaluate("(() => { const c = document.querySelector('.checkmark-circle'); const r = c.getBoundingClientRect(); return r.width > 40 && getComputedStyle(c).animationName === 'stroke'; })()")));
    T('Cảm ơn: tiêu đề gọi "chị"', (await text(page, '.success-title')) === TXT.successTitle, await text(page, '.success-title'));
    T('Cảm ơn: focus chuyển lên tiêu đề (trình đọc màn hình biết đã đổi trang)', !!(await waitFor(page, "document.activeElement && document.activeElement.id === 'success-title'", 1000)), await page.evaluate('document.activeElement.id || document.activeElement.tagName'));
    const sum = await page.evaluate("document.getElementById('success-summary').innerText");
    T('Cảm ơn: tóm tắt che SĐT "0912 ••• 678", có "3 - Tồi tệ", "Lo lắng"', /Số điện thoại: 0912 ••• 678/.test(sum) && !/0912345678/.test(sum) && /Mức cảm xúc: 3 - Tồi tệ/.test(sum) && /Bé Capybara: Lo lắng/.test(sum), sum);
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
    T('Reset: SĐT trống, thanh trượt 5, "5 - Bình thường (Ổn)", ảnh 05', (await phoneVal(page)) === '' && lv.value === '5' && lv.status === '5 - ' + LEVELS[5] && lv.src === 'capy-level-05.png', JSON.stringify(lv));
    T('Reset: không thẻ nào chọn (aria-pressed=false), nút disabled, chữ "Hoàn thành Check-in →", hint "thiếu cả hai"', (await cards(page)).every(c => !c.selected && c.pressed === 'false') && b.disabled && !b.ready && b.text === TXT.btnIdle && (await hint(page)) === TXT.hintBoth, JSON.stringify({ b, hint: await hint(page) }));
    T('Reset: trang cảm ơn ẩn, tóm tắt đã dọn, khung Hỗ trợ đóng', (await checkinVisible(page)) && !(await successVisible(page)) && (await page.evaluate("document.getElementById('success-summary').textContent === '' && !document.getElementById('support-box').open")));

    /* --- Lượt 2: SĐT có dấu cách, mức 10 --- */
    await typePhone(page, '0988 777 666');
    await pickCard(page, 'Vui vẻ');
    await setSlider(page, 10);
    const sent2 = await submit(page);
    await waitFor(page, "__qa.logs.filter(l => l.includes('Đã lưu')).length >= 2", 2000);
    const r2 = e.mock.state.rows[1] || {};
    T('Lượt 2: gửi được, mock 2 dòng, SĐT chuẩn hóa "0988777666", level 10, sessionId mới', sent2 && e.mock.state.rows.length === 2 && r2.phone === '0988777666' && r2.level === 10 && r2.part1 === '10 - Rất tuyệt vời' && r2.sessionId !== body.sessionId, JSON.stringify(r2));
    const quote10 = await text(page, '#success-quote');
    T('Lượt 2: mức 10 → giữ câu chúc gốc của anh, khung Hỗ trợ không tự mở', /nhiều niềm vui và hạnh phúc/.test(quote10) && !(await page.evaluate("document.getElementById('support-box').open")), quote10);

    s = await qa(page);
    T('Console: không console.error / lỗi JS / promise rơi', s.errors.length === 0, JSON.stringify(s.errors));
    T('Console: không console.warn ở luồng bình thường', s.warns.length === 0, JSON.stringify(s.warns));
    const other = nonAssetLog(browserLog).filter(l => /error/i.test(l) && !/kaspersky/.test(l));
    T('Console trình duyệt: không lỗi nào ngoài 404 ảnh/nhạc', other.length === 0, other.join(' | '));
    T('Có favicon (không 404 favicon.ico mỗi lần tải)', !browserLog.some(l => /favicon\.ico/.test(l)) && !requests.some(r => /favicon\.ico/.test(r.url)), browserLog.filter(l => /favicon/.test(l)).join(' | '));
    note('Log trình duyệt: ' + browserLog.filter(l => /\.(jpg|png)\b/.test(l)).length + ' dòng 404 ảnh (thư mục chưa có ảnh, biết trước).');
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
    const active = () => page.evaluate("(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; return a.id ? '#' + a.id : (a.dataset.emotion ? 'card:' + a.dataset.emotion : a.className || a.tagName); })()");
    /* Thứ tự Tab từ đầu trang (chưa có gì được focus) */
    const order = [];
    for (let i = 0; i < 10; i++) { await page.key('Tab'); order.push(await active()); }
    const expect = ['#music-toggle-btn', '#input-phone', '#emotion-range'].concat(CARDS.map(n => 'card:' + n), ['support-summary']);
    T('Tab: thứ tự nhạc → SĐT → thanh trượt → 6 thẻ → Hỗ trợ (nút Hoàn thành tắt nên bỏ qua)', order.join(',') === expect.join(','), order.join(','));
    /* Làm một lượt (Chrome giữ điểm bắt đầu Tab sau blur, nên đặt focus vào nút nhạc rồi Tab tiếp) */
    await page.evaluate("document.getElementById('music-toggle-btn').focus(); true");
    await page.key('Tab');
    T('Từ nút nhạc, Tab → ô SĐT', (await active()) === '#input-phone');
    await page.type('0912345678');
    await page.key('Tab');
    await page.key('ArrowRight');
    T('Tab → thanh trượt, ArrowRight → mức 6', (await active()) === '#emotion-range' && (await level(page)).value === '6');
    await page.key('Tab');
    T('Tab → thẻ đầu "Vui vẻ" có viền focus-visible 3px', (await active()) === 'card:Vui vẻ' && (await page.evaluate("(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.matches(':focus-visible') && cs.outlineStyle === 'solid' && cs.outlineWidth === '3px'; })()")));
    await page.key('Enter');
    T('Enter trên thẻ "Vui vẻ" → chọn, aria-pressed=true', (await cards(page)).filter(c => c.selected && c.pressed === 'true').map(c => c.name).join() === 'Vui vẻ');
    await page.key('Tab');
    await page.key('Space');
    T('Tab → "Buồn", Space → chọn "Buồn", bỏ chọn "Vui vẻ"', (await active()) === 'card:Buồn' && (await cards(page)).filter(c => c.selected && c.pressed === 'true').map(c => c.name).join() === 'Buồn', JSON.stringify((await cards(page)).map(c => c.name + ':' + c.pressed)));
    for (let i = 0; i < 4; i++) await page.key('Tab');
    await page.key('Tab');
    T('Tab tiếp → nút Hoàn thành (đã bật)', (await active()) === '#btn-submit', await active());
    await assertSafeUrl(page);
    await page.key('Enter');
    const shown = await waitFor(page, "getComputedStyle(document.getElementById('page-success')).display !== 'none'", 2500);
    await waitFor(page, "__qa.logs.some(l => l.includes('Đã lưu'))", 2000);
    const row = e.mock.state.rows[0] || {};
    T('Enter trên nút Hoàn thành → trang cảm ơn, POST level 6 "Buồn"', !!shown && e.mock.state.rows.length === 1 && row.level === 6 && row.part2 === 'Buồn', JSON.stringify(row));
    T('Sau khi gửi: focus ở tiêu đề trang cảm ơn', !!(await waitFor(page, "document.activeElement.id === 'success-title'", 1000)));
    await page.key('Tab');
    T('Tab từ tiêu đề → nút "Thực hiện check-in khác"', (await page.evaluate("document.activeElement.classList.contains('btn-restart')")));
    await page.key('Enter');
    T('Enter → về trang check-in, form sạch', !!(await waitFor(page, "getComputedStyle(document.getElementById('page-checkin')).display !== 'none'", 1500)) && (await phoneVal(page)) === '');
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('keyboard', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= phone: kiểm định dạng SĐT Việt Nam ================= */
async function scenarioPhone() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    const tryPhone = async (v) => { await typePhone(page, v); await sleep(30); const b = await btn(page); return { v, enabled: !b.disabled && b.ready, hint: await hint(page), err: await text(page, '#phone-error'), value: await phoneVal(page) }; };
    await pickCard(page, 'Buồn');
    const cases = [
      ['09123456', false], ['abcdefghi', false], ['=1+1+1+1+1', false], ['0123456789', false], ['09123456789', false],
      ['+84 912 345 678', true], ['0912 345 678', true], ['0912.345.678', true], ['84912345678', true], ['024 3825 1234', true], ['   0912345678   ', true]
    ];
    const got = [];
    for (const [v, want] of cases) { const r = await tryPhone(v); got.push((r.enabled === want ? 'ok ' : 'LỖI ') + JSON.stringify(v) + '→' + (r.enabled ? 'bật' : 'tắt')); }
    T('SĐT: 5 mẫu sai bị chặn (8 số, chữ, "=1+1…", đầu 01, 11 số di động), 6 mẫu đúng được nhận (+84, dấu cách, dấu chấm, 84…, cố định 02x, khoảng trắng hai đầu)', got.every(x => x.startsWith('ok')), got.join(' | '));
    let r = await tryPhone('abcdefghi');
    T('SĐT có chữ → lỗi mềm ngay dưới ô, aria-invalid, hint "SĐT chưa đúng"', r.err === TXT.phoneError && r.hint === TXT.hintPhoneBad && (await page.evaluate("document.getElementById('input-phone').getAttribute('aria-invalid')")) === 'true', JSON.stringify(r));
    r = await tryPhone('0912');
    T('SĐT đang gõ dở "0912" → chưa báo lỗi, hint "thiếu SĐT"', r.err === '' && r.hint === TXT.hintPhone, JSON.stringify(r));
    await page.evaluate("document.getElementById('input-phone').blur(); true");
    T('Rời ô khi SĐT còn dở → hiện lỗi mềm có ví dụ', (await text(page, '#phone-error')) === TXT.phoneError && (await hint(page)) === TXT.hintPhoneBad);
    r = await tryPhone('0912345678');
    T('Sửa lại đúng → lỗi tắt, aria-invalid bỏ, nút bật', r.err === '' && r.enabled && (await page.evaluate("document.getElementById('input-phone').hasAttribute('aria-invalid')")) === false, JSON.stringify(r));
    r = await tryPhone('0912345678091234567890123');
    T('Ô SĐT: maxlength 20 (không nhận chuỗi dài vô hạn)', r.value.length <= 20 && !r.enabled, r.value.length + ' ký tự');
    T('Ô SĐT: type=tel, autocomplete=tel, aria-describedby gồm phone-note và phone-error', (await page.evaluate("(() => { const i = document.getElementById('input-phone'); return i.type + '|' + i.autocomplete + '|' + i.getAttribute('aria-describedby'); })()")) === 'tel|tel|phone-note phone-error');

    /* Gửi với +84 → server nhận số đã chuẩn hóa */
    await typePhone(page, '+84 912 345 678');
    T('Gửi "+84 912 345 678": POST phone "0912345678"', (await submit(page)) && !!(await waitFor(page, '__qa.fetches.length >= 1', 1500)) && e.mock.state.rows.length === 1 && e.mock.state.rows[0].phone === '0912345678', JSON.stringify(e.mock.state.rows[0]));
    await restart(page);

    /* Gọi submitCheckin() trực tiếp khi chưa đủ điều kiện: toast, không alert, không POST */
    await typePhone(page, '=1+1+1+1+1');
    await pickCard(page, 'Vui vẻ');
    await page.evaluate('submitCheckin(); true');
    let s = await qa(page);
    T('submitCheckin() với SĐT "=1+1…" → toast lỗi mềm, focus ô SĐT, không alert, không POST', (await toastText(page)) === TXT.phoneError && (await page.evaluate("document.activeElement.id")) === 'input-phone' && s.alerts.length === 0 && e.mock.state.rows.length === 1, JSON.stringify({ toast: await toastText(page), alerts: s.alerts, rows: e.mock.state.rows.length }));
    /* Đang ở trang check-in (nút "check-in khác" ẩn) → làm sạch form bằng resetCheckin(); ẩn toast cũ */
    await page.evaluate("resetCheckin(); document.getElementById('toast').classList.remove('show'); true");
    await typePhone(page, '0912345678');
    await page.evaluate('submitCheckin(); true');
    s = await qa(page);
    T('submitCheckin() có SĐT, chưa thẻ → toast "' + TXT.toastCard + '", không POST', (await toastText(page)) === TXT.toastCard && s.alerts.length === 0 && e.mock.state.rows.length === 1, await toastText(page));
    T('Toast có role="status" (trình đọc màn hình đọc được)', (await page.evaluate("document.getElementById('toast').getAttribute('role')")) === 'status');
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('phone', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ================= xss: chuỗi HTML không bao giờ thành phần tử (Chặn #4) ================= */
async function scenarioXss() {
  let e;
  try {
    e = await setup({});
    const { page } = e;
    await pickCard(page, 'Buồn');
    await typePhone(page, '<img src=x onerror="window.__xssSummary=1">');
    await sleep(100);
    T('SĐT chứa HTML → nút KHÔNG bật', (await btn(page)).disabled);
    await page.evaluate('submitCheckin(); true');
    await sleep(500);
    T('submitCheckin() trực tiếp với SĐT chứa HTML → không POST, không trang cảm ơn', e.mock.state.rows.length === 0 && !(await successVisible(page)));
    /* Gọi thẳng hàm dựng tóm tắt với cả ba trường độc */
    await page.evaluate(`renderSummary({ phone: '<img src=x onerror="window.__xss1=1">', part1: '<img src=x onerror="window.__xss2=1">', part2: '<b id="xssb">đậm</b><script>window.__xss3=1<\\/script>' }); true`);
    await sleep(400);
    const x = await page.evaluate("({ ran: !!(window.__xssSummary || window.__xss1 || window.__xss2 || window.__xss3), imgs: document.querySelectorAll('#success-summary img, #success-summary script, #xssb').length, text: document.getElementById('success-summary').textContent })");
    T('renderSummary: chuỗi HTML hiện dạng chữ, 0 phần tử <img>/<script>/<b> được tạo, onerror không chạy', !x.ran && x.imgs === 0 && x.text.includes('<img src=x onerror="window.__xss2=1">') && x.text.includes('<b id="xssb">'), JSON.stringify(x));
    T('renderSummary: SĐT lạ cũng bị che (không hiện nguyên chuỗi)', !x.text.includes('window.__xss1'), x.text.slice(0, 120));
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
    await typePhone(page, '0912345678');
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
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_pending')", 3000);
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
    await typePhone(page, '0912345678');
    await pickCard(page, 'Buồn');
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await submit(page);
    await waitFor(page, "JSON.parse(localStorage.getItem('checkin_me_bau_pending') || '[]').length === 1 && __qa.warns.length > 0", 3000);
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_pending')", 3000);
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
    await typePhone(page, '0912345678');
    await pickCard(page, 'Tức giận');
    T('500+JSON: trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 0', 3000);
    let s = await qa(page);
    T('500+JSON: KHÔNG log "Đã lưu" (kiểm response.ok), warn "Chưa gửi được"', !s.logs.some(l => l.startsWith(TXT.logSaved)) && s.warns.some(w => w.startsWith(TXT.warnRetry) && /HTTP 500/.test(w)), JSON.stringify({ logs: s.logs, warns: s.warns }));
    T('500+JSON: lượt nằm trong hàng chờ', (await queue(page)).length === 1);
    await restart(page);
    e.mock.state.mode = '500text';
    await typePhone(page, '0912345678');
    await pickCard(page, 'Khó chịu');
    T('500+HTML: trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 1', 3000);
    s = await qa(page);
    T('500+HTML: warn "Chưa gửi được", hàng chờ 2 lượt', s.warns.filter(w => w.startsWith(TXT.warnRetry)).length === 2 && (await queue(page)).length === 2, JSON.stringify(s.warns));
    await restart(page);
    e.mock.state.mode = 'reject';
    await typePhone(page, '0912345678');
    await pickCard(page, 'Vui vẻ');
    T('Máy chủ từ chối (200 + result:error): trang cảm ơn vẫn hiện', await submit(page));
    await waitFor(page, '__qa.warns.length > 2', 3000);
    s = await qa(page);
    T('Máy chủ từ chối: warn "Máy chủ từ chối…", KHÔNG giữ lại để gửi lại (hàng chờ vẫn 2)', s.warns.some(w => w.startsWith(TXT.warnReject)) && (await queue(page)).length === 2 && !s.logs.some(l => l.startsWith(TXT.logSaved)), JSON.stringify(s.warns));
    /* Máy chủ khỏe lại → online → gửi lại 2 lượt */
    e.mock.state.mode = 'ok';
    e.mock.state.rows.length = 0;
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_pending')", 3000);
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
    await typePhone(page, '0912345678');
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
    await typePhone(page, '0912345678');
    await pickCard(page, 'Buồn');
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
    await typePhone(page, '0912345678');
    await pickCard(page, 'Buồn');
    await assertSafeUrl(page);
    await page.evaluate('submitCheckin(); submitCheckin(); true');
    await sleep(700);
    T('Gọi submitCheckin() 2 lần liên tiếp → chỉ thêm 1 POST (cờ isSending)', e.mock.posts().length === 2, e.mock.posts().length + ' POST');
    await restart(page);
    await typePhone(page, '0912345678');
    await pickCard(page, 'Buồn');
    await page.evaluate("document.getElementById('input-phone').focus(); true");
    await page.key('Enter');
    await sleep(300);
    T('Enter trong ô SĐT không gửi (không có <form>)', e.mock.posts().length === 2 && (await checkinVisible(page)));
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
    await waitFor(page, "document.getElementById('current-capy').hidden && document.querySelectorAll('.capy-img-box.fallback').length === 6", 3000);
    let lv = await level(page);
    T('Ảnh mức 404: ẩn <img>, hiện emoji 😐 trong khung 130×130', lv.natural === 0 && lv.imgHidden && !lv.emojiHidden && lv.emoji === '😐' && Math.round(lv.ew) === 130 && Math.round(lv.eh) === 130, JSON.stringify(lv));
    await setSlider(page, 1);
    await sleep(300);
    lv = await level(page);
    T('Ảnh mức 404 khi kéo sang mức 1: emoji đổi thành 😞, alt vẫn đổi theo mức', lv.imgHidden && lv.emoji === '😞' && lv.alt === 'Bé Capybara mức 1: Tuyệt vọng', JSON.stringify(lv));
    const cs = await cards(page);
    T('Ảnh thẻ 404: 6 khung chuyển .fallback, hiện đúng emoji theo cảm xúc', cs.every(c => c.fallback && c.after === '"' + CARD_EMOJI[c.name] + '"'), JSON.stringify(cs.map(c => c.name + ':' + c.after)));
    const boxes = await page.evaluate("[...document.querySelectorAll('.capy-img-box')].map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)).join(',')");
    T('Ảnh thẻ 404: khung 82×82 giữ nguyên', boxes === Array(6).fill('82x82').join(','), boxes);
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
      const taps = ['#input-phone', '#emotion-range', '.capy-card', '#btn-submit', '#music-toggle-btn', '.btn-restart', '.support-summary'].map(s => { const b = document.querySelector(s).getBoundingClientRect(); return b.width > 0 ? s + ':' + Math.round(b.width) + 'x' + Math.round(b.height) : null; }).filter(Boolean);
      const btn = r('#btn-submit');
      document.getElementById('music-hint').classList.add('show');
      const mh = r('#music-hint');
      document.getElementById('music-hint').classList.remove('show');
      return { w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, over, cols, taps,
        musicPos: getComputedStyle(document.getElementById('music-toggle-btn')).position,
        musicOverBadge: inter(music, r('.badge-tag')), musicOverH1: inter(music, r('.main-title')), hintOverBadge: inter(mh, r('.badge-tag')), hintOverH1: inter(mh, r('.main-title')), musicRect: music,
        hintLeft: mh.l, hintRight: mh.r, btnTop: btn.t, btnBottom: btn.b };
    })()`);
    let m = await measure();
    T('375×667: không tràn ngang, 2 cột thẻ', m.scrollW <= 375 && m.over.length === 0 && m.cols === 2, JSON.stringify({ scrollW: m.scrollW, over: m.over, cols: m.cols }));
    T('375: vùng chạm chính ≥ 44 px (kể cả thanh trượt và "Hỗ trợ")', m.taps.every(t => { const [w, h] = t.split(':')[1].split('x').map(Number); return w >= 44 && h >= 44; }), m.taps.join(','));
    T('Nút nhạc nằm trong card (không position:fixed) → không đè nội dung khi cuộn', m.musicPos !== 'fixed', m.musicPos);
    T('375: nút nhạc và gợi ý nhạc không đè lên eyebrow/h1', m.musicOverBadge === 0 && m.musicOverH1 === 0 && m.hintOverBadge === 0 && m.hintOverH1 === 0, JSON.stringify({ badge: m.musicOverBadge, h1: m.musicOverH1, hb: m.hintOverBadge, hh: m.hintOverH1 }));
    T('375×667: nút Hoàn thành nằm dưới màn đầu (phải cuộn ~' + Math.round(m.btnTop - 667) + ' px), trang cao ' + m.scrollH + ' px', m.btnTop > 667, 'btnTop=' + Math.round(m.btnTop));
    await page.screenshot(path.join(OUT, 'shot-layout-375-top.png'), false);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    m = await measure();
    T('320×568: không tràn ngang, 2 cột thẻ', m.scrollW <= 320 && m.over.length === 0 && m.cols === 2, JSON.stringify({ scrollW: m.scrollW, over: m.over, cols: m.cols }));
    T('320: nút nhạc và gợi ý nhạc không đè lên eyebrow/h1', m.musicOverBadge === 0 && m.musicOverH1 === 0 && m.hintOverBadge === 0 && m.hintOverH1 === 0, JSON.stringify({ badge: m.musicOverBadge, h1: m.musicOverH1, hb: m.hintOverBadge, hh: m.hintOverH1, music: m.musicRect }));
    T('320: gợi ý nhạc không lọt ra ngoài trái màn', m.hintLeft >= 0, 'hintLeft=' + Math.round(m.hintLeft) + ' hintRight=' + Math.round(m.hintRight));
    T('320: vùng chạm chính ≥ 44 px', m.taps.every(t => { const [w, h] = t.split(':')[1].split('x').map(Number); return w >= 44 && h >= 44; }), m.taps.join(','));
    note('320: nút Hoàn thành ở y=' + Math.round(m.btnTop) + ', trang cao ' + m.scrollH + ' px.');
    await page.screenshot(path.join(OUT, 'shot-layout-320-top.png'), false);
    await page.screenshot(path.join(OUT, 'shot-layout-320-full.png'), true);
    /* Trang cảm ơn ở 320 */
    await typePhone(page, '0912345678');
    await pickCard(page, 'Vui vẻ');
    await submit(page);
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
    await typePhone(page, '0912345678');
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
    await typePhone(page, '0967791552');
    await sleep(200);
    await pickCard(page, 'Vui vẻ');
    T('Gõ 0967791552: là một SĐT bình thường, không mở gì, ô không bị xóa, nút bật', (await phoneVal(page)) === '0967791552' && !!(await waitReady(page)) && (await page.evaluate("document.querySelectorAll('table, [role=dialog]').length")) === 0);
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
    await page.evaluate(`(() => { const s = ${JSON.stringify(SEED)}; Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); localStorage.setItem('myCheckins', '[{"phone":"0911111111"}]'); return true; })()`);
    await page.navigate(APP_URL);
    await sleep(1200);
    const snap = () => page.evaluate(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })()`);
    let st = await snap();
    T('Mở Check-in: 3 khóa của Nhật Ký (musicMuted, myJourneys, user_0912345678) còn nguyên giá trị', Object.keys(SEED).every(k => st[k] === SEED[k]), JSON.stringify(st));
    T('Mở Check-in: chỉ dọn "myCheckins" (khóa riêng của Check-in bản cũ)', !('myCheckins' in st));
    /* Dùng hết các chức năng: bật nhạc (lỗi 404), gửi offline để có hàng chờ, gửi lại, làm lại */
    await page.click('#music-toggle-btn');
    await sleep(800);
    await typePhone(page, '0912345678');
    await pickCard(page, 'Buồn');
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await submit(page);
    await waitFor(page, '__qa.warns.length > 0', 3000);
    st = await snap();
    const ownKeys = Object.keys(st).filter(k => !(k in SEED));
    T('Khóa app tự ghi đều có tiền tố "checkin_me_bau_"', ownKeys.length >= 1 && ownKeys.every(k => k.startsWith('checkin_me_bau_')), ownKeys.join(','));
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.evaluate("window.dispatchEvent(new Event('online')); true");
    await waitFor(page, "!localStorage.getItem('checkin_me_bau_pending')", 3000);
    await restart(page);
    st = await snap();
    T('Sau bật nhạc, gửi offline, gửi lại, làm lại: 3 khóa của Nhật Ký vẫn nguyên, không còn khóa lạ', Object.keys(SEED).every(k => st[k] === SEED[k]) && Object.keys(st).filter(k => !(k in SEED)).every(k => k.startsWith('checkin_me_bau_')), JSON.stringify(st));
    const s = await qa(page);
    T('Console: không console.error', s.errors.length === 0, JSON.stringify(s.errors));
    saveConsole('sharedkeys', e.consoleApi, e.browserLog, s);
  } finally { await teardown(e); }
}

/* ===== Chạy ===== */
const SCENARIOS = { main: scenarioMain, keyboard: scenarioKeyboard, phone: scenarioPhone, xss: scenarioXss, offline: scenarioOffline, down: scenarioDown, hang: scenarioHang, double: scenarioDouble, imgfail: scenarioImgFail, layout: scenarioLayout, reduced: scenarioReduced, music: scenarioMusic, noadmin: scenarioNoAdmin, sharedkeys: scenarioSharedKeys };
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
  T('Vệ sinh: không file lạ trong thư mục app (ngoài tests/)', fs.readdirSync(APP).filter(f => !['.gitignore', 'NGUON.md', 'google_apps_script.js', 'index.html', 'script.js', 'styles.css', 'upload.bat', 'upload.sh', 'tests', 'background-music.mp3'].includes(f) && !/^(capy-level-\d\d\.png|(vui|buon|khoc|tuc|hoang_hot|kho_chiu)\.jpg)$/.test(f)).length === 0, fs.readdirSync(APP).join(','));
  const pass = results.filter(r => r.startsWith('PASS')).length;
  const flaky = results.filter(r => r.startsWith('CHẬP CHỜN')).length;
  const total = results.filter(r => /^(PASS|FAIL|CRASH|CHẬP)/.test(r)).length;
  const summary = '\n' + pass + '/' + total + ' PASS, ' + fails + ' FAIL, ' + flaky + ' CHẬP CHỜN' + (results.some(r => r.startsWith('CRASH')) ? ' (có CRASH)' : '');
  console.log(summary);
  fs.writeFileSync(path.join(OUT, 'e2e-results.txt'), results.join('\n') + '\n' + summary + '\n');
  console.log('Kết quả: ' + path.join(OUT, 'e2e-results.txt'));
  process.exit(fails ? 1 : 0);
})();
