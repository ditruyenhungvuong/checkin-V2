// ============================================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC (mọi thứ ở đây đều công khai với trình duyệt)
// ============================================================

// URL Apps Script nhận dữ liệu. Anh dán URL của bản triển khai MỚI vào đây (URL cũ đã lộ, xem google_apps_script.js).
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfN8ZHtoY_-if6-aPzziEuSQ8HRKxoH74F967-9Rxk0c5_UZPAIJDVdQjr51RRME9G/exec';

// Số hỗ trợ của cơ sở: ĐỂ TRỐNG cho tới khi anh Thông xác nhận số thật (không tự bịa).
// Ví dụ khi có: SUPPORT_NAME = 'Phòng khám thai'; SUPPORT_PHONE = '0xxx xxx xxx';
const SUPPORT_NAME = '';
const SUPPORT_PHONE = '';

// Gửi quá thời gian này (ms) thì bỏ, giữ lượt trong hàng chờ để gửi lại sau
let SEND_TIMEOUT_MS = 15000;

// LƯU Ý localStorage: mọi app ở ditruyenhungvuong.github.io/<repo>/ dùng CHUNG một localStorage
// (cùng origin). Khóa của app này luôn có tiền tố "checkin_me_bau_". KHÔNG đọc/ghi/xóa khóa
// của app khác: Nhật Ký Mẹ Bầu dùng 'musicMuted', 'myJourneys', 'user_<sđt>'.
// Hàng chờ gửi lại: chỉ giữ lượt CHƯA gửi được, gửi xong là xóa ngay.
// Từ 01/11/2026 app nhận Mã số bệnh nhân thay SĐT nên đổi sang khóa mới; khóa cũ
// 'checkin_me_bau_pending' (còn giữ SĐT, Apps Script mới cũng không nhận nữa) bị xóa khi mở app.
const QUEUE_KEY = 'checkin_me_bau_queue';
const OLD_QUEUE_KEY = 'checkin_me_bau_pending';
const QUEUE_MAX = 20;
const QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Dữ liệu lượt check-in hiện tại
let currentCheckin = {
    sessionId: '',
    part1_score: 5,
    part1_text: 'Bình thường (Ổn)',
    part2_capybara: ''
};
let isSending = false;

// Bảng biểu cảm chuột Capybara theo 10 mức điểm.
// Nhãn giữ nguyên chờ anh chọn phương án mới; màu chữ đã đổi cho đủ tương phản (≥ 4,5:1 trên nền trắng),
// không dùng đỏ (biến thể Hồng ấm). Nhãn PHẢI trùng LEVEL_TEXTS trong google_apps_script.js.
const emotionLevels = {
    1:  { text: "Tuyệt vọng",        color: "#1a237e", image: "capy-level-01.png", emoji: "😞" },
    2:  { text: "Rất tồi tệ",        color: "#4a148c", image: "capy-level-02.png", emoji: "😔" },
    3:  { text: "Tồi tệ",            color: "#7d3a55", image: "capy-level-03.png", emoji: "😟" },
    4:  { text: "Kém",               color: "#9c456b", image: "capy-level-04.png", emoji: "🙁" },
    5:  { text: "Bình thường (Ổn)",   color: "#a14d00", image: "capy-level-05.png", emoji: "😐" },
    6:  { text: "Tương đối tốt",      color: "#8a5a00", image: "capy-level-06.png", emoji: "🙂" },
    7:  { text: "Tốt",               color: "#7a6400", image: "capy-level-07.png", emoji: "😊" },
    8:  { text: "Rất tốt",           color: "#5b6b00", image: "capy-level-08.png", emoji: "😄" },
    9:  { text: "Tuyệt vời",         color: "#2e7d32", image: "capy-level-09.png", emoji: "😁" },
    10: { text: "Rất tuyệt vời",     color: "#1b5e20", image: "capy-level-10.png", emoji: "🥰" }
};

// 6 cảm xúc hợp lệ, PHẢI trùng EMOTION_LABELS trong google_apps_script.js
const EMOTIONS = ['Vui vẻ', 'Buồn', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu'];

// Lời nhắc tiến độ dưới nút Hoàn thành
const HINTS = {
    both:     "💡 Chị nhập mã số bệnh nhân và chạm chọn 1 bé Capybara là xong nhé.",
    id:       "💡 Chị nhập mã số bệnh nhân ở trên giúp mình nhé.",
    idBad:    "💡 Mã số bệnh nhân chưa đúng, chị xem lại giúp mình nhé.",
    card:     "💡 Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.",
    done:     "✨ Xong rồi, chị chạm nút Hoàn thành nhé!"
};
const ID_ERROR = "Chị nhập mã số bệnh nhân (chỉ gồm chữ số, ví dụ 26012345) nhé.";
const BTN_IDLE = "Hoàn thành Check-in →";
const BTN_SENDING = "Đang lưu Check-in…";

// Câu vỗ về ở trang cảm ơn theo nhóm mức (đội đề xuất, chờ anh duyệt chữ)
const QUOTES = {
    low:  "Hôm nay có vẻ là một ngày nặng lòng. Chị đã dừng lại lắng nghe mình, điều đó rất đáng quý. Nếu thấy quá sức, chị nói với người thân hoặc bác sĩ đang theo dõi chị nhé.",
    mid:  "Ngày nào cũng có lúc lên lúc xuống. Chị đã dừng lại lắng nghe mình, vậy là đủ cho hôm nay nhé.",
    high: "Mỗi cảm xúc đều đáng được lắng nghe và vỗ về. Chúc hai mẹ con một ngày thật an yên, nhiều niềm vui và hạnh phúc! ❤️"
};

const $ = id => document.getElementById(id);
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);


// ============================================================
// 2. TIỆN ÍCH: MÃ SỐ BỆNH NHÂN, TOAST, LƯU TRỮ AN TOÀN
// ============================================================

/**
 * Chuẩn hóa Mã số bệnh nhân: bỏ khoảng trắng, dấu chấm, dấu gạch chị gõ lẫn;
 * sau khi bỏ phải còn 3–20 CHỮ SỐ (giữ nguyên số 0 ở đầu). Sai → ''.
 * VIẾT GIỐNG HỆT normalizePatientId_() trong google_apps_script.js.
 */
function normalizePatientId(raw) {
    const s = String(raw == null ? '' : raw).replace(/[\s.\-]/g, '');
    return /^\d{3,20}$/.test(s) ? s : '';
}

// Che mã số khi hiện trên màn hình (máy có thể dùng chung): 26012345 → "26 ••• 345"
function maskPatientId(id) {
    const p = String(id || '');
    if (p.length >= 8) return p.slice(0, 2) + ' ••• ' + p.slice(-3);
    if (p.length >= 5) return '••• ' + p.slice(-2);
    return '•••';
}

function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function newSessionId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'ss-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Đọc/ghi localStorage luôn bọc try/catch: chế độ riêng tư hay bộ nhớ đầy không được chặn việc gửi
function readQueue() {
    try {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (!Array.isArray(q)) return [];
        const now = Date.now();
        return q.filter(x => x && x.payload && x.payload.sessionId && now - (x.queuedAt || 0) < QUEUE_MAX_AGE_MS);
    } catch (e) { return []; }
}
function writeQueue(q) {
    try {
        if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
        else localStorage.removeItem(QUEUE_KEY);
    } catch (e) { /* không lưu được thì thôi, lượt đang gửi vẫn đi */ }
}
function queueAdd(payload) {
    const q = readQueue().filter(x => x.payload.sessionId !== payload.sessionId);
    q.push({ payload, queuedAt: Date.now() });
    writeQueue(q);
}
function queueRemove(sessionId) {
    writeQueue(readQueue().filter(x => x.payload.sessionId !== sessionId));
}


// ============================================================
// 3. NHẠC NỀN THƯ GIÃN (mặc định TẮT, chỉ phát khi chị bấm nút)
// ============================================================
let bgMusic = null;
let isMusicOn = false;

function initBgMusic() {
    bgMusic = $('bg-music');
    if (bgMusic) {
        bgMusic.volume = 0.35;
        // Thiếu file / mạng lỗi: Chrome báo lỗi ở thẻ <source> và để play() treo mãi,
        // nên phải nghe sự kiện error ở cả <source> lẫn <audio>
        bgMusic.addEventListener('error', onMusicFail);
        bgMusic.querySelectorAll('source').forEach(src => src.addEventListener('error', onMusicFail));
    }
    // Nhạc không nhớ trạng thái nữa (mặc định tắt). KHÔNG xóa khóa 'musicMuted' của bản cũ:
    // khóa đó dùng chung với app Nhật Ký Mẹ Bầu (cùng origin), xóa là mất thiết lập nhạc của app kia.
    updateMusicBtnUI();
    // Gợi ý nhẹ một lần lúc mở trang rồi tự ẩn
    setTimeout(showMusicHint, 800);
}

function toggleMusic() {
    if (!bgMusic) return;
    if (isMusicOn) {
        bgMusic.pause();
        isMusicOn = false;
        updateMusicBtnUI();
        return;
    }
    isMusicOn = true;
    updateMusicBtnUI();
    // Lần trước không tìm được file → nạp lại từ đầu trước khi phát
    if (bgMusic.networkState === 3) bgMusic.load();
    const p = bgMusic.play();
    if (p && typeof p.catch === 'function') p.catch(onMusicFail);
}

// Không mở được nhạc (mạng yếu, thiếu file): trả nút về TẮT, báo nhẹ
function onMusicFail() {
    if (!isMusicOn) return;
    isMusicOn = false;
    try { bgMusic.pause(); } catch (e) { /* bỏ qua */ }
    updateMusicBtnUI();
    toast('Chưa mở được nhạc, chị thử lại sau nhé.');
}

function updateMusicBtnUI() {
    const btn = $('music-toggle-btn');
    if (!btn) return;
    btn.textContent = isMusicOn ? '🎵' : '🔇';
    btn.classList.toggle('muted', !isMusicOn);
    // Nhãn cố định "Nhạc nền", chỉ đổi aria-pressed (đổi cả hai thì trình đọc màn hình đọc ngược nghĩa)
    btn.setAttribute('aria-pressed', isMusicOn ? 'true' : 'false');
}

function showMusicHint() {
    const hint = $('music-hint');
    if (!hint || isMusicOn) return;
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 4500);
}


// ============================================================
// 4. HIỆU ỨNG PHÁO HOA PASTEL
// ============================================================
const canvas = $('fireworks-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let isAnimating = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1.2;
        this.velocity = {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        };
        this.alpha = 1;
        this.friction = 0.95;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
    }
}

function launchFireworks() {
    if (reduceMotion()) return;
    const softHues = [340, 350, 20, 35, 320, 5, 140, 160];
    for (let i = 0; i < 9; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.6);
        const hue = softHues[Math.floor(Math.random() * softHues.length)];
        const color = `hsl(${hue}, 75%, 75%)`;
        for (let j = 0; j < 35; j++) {
            particles.push(new Particle(x, y, color));
        }
    }
    // Chỉ một vòng requestAnimationFrame tại một thời điểm (tránh hạt bay nhanh gấp đôi)
    if (!isAnimating) { isAnimating = true; animateFireworks(); }
}

function animateFireworks() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Lọc hạt đã tắt trước rồi mới vẽ (splice trong forEach bỏ sót phần tử)
    particles = particles.filter(p => p.alpha > 0);
    if (particles.length === 0) { isAnimating = false; return; }
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateFireworks);
}


// ============================================================
// 5. PHẦN 1: THANG ĐO CẢM XÚC (1 - 10)
// ============================================================

function updateEmotionDisplay() {
    const slider = $('emotion-range');
    if (!slider) return;

    const val = parseInt(slider.value, 10);
    const data = emotionLevels[val] || emotionLevels[5];
    const label = `${val} - ${data.text}`;

    currentCheckin.part1_score = val;
    currentCheckin.part1_text = data.text;

    // Ảnh bé Capybara + alt đổi theo mức; emoji dự phòng luôn đúng mức
    const capyImg = $('current-capy');
    if (capyImg) {
        if (!capyImg.src.endsWith(data.image)) capyImg.src = data.image;
        capyImg.alt = `Bé Capybara mức ${val}: ${data.text}`;
    }
    const capyEmoji = $('current-capy-emoji');
    if (capyEmoji) capyEmoji.textContent = data.emoji;

    const statusEl = $('current-status');
    if (statusEl) {
        statusEl.textContent = label;
        statusEl.style.color = data.color;
    }
    slider.setAttribute('aria-valuetext', label);

    if (navigator.vibrate) navigator.vibrate(5);
    checkFormCompletion();
}

/* Ảnh lỗi (thiếu file, mạng yếu) → thay bằng emoji, theo style guide mục 3 */
function setupImageFallbacks() {
    const capyImg = $('current-capy');
    const capyEmoji = $('current-capy-emoji');
    if (capyImg && capyEmoji) {
        const fail = () => { capyImg.hidden = true; capyEmoji.hidden = false; };
        const ok = () => { capyImg.hidden = false; capyEmoji.hidden = true; };
        capyImg.addEventListener('error', fail);
        capyImg.addEventListener('load', ok);
        // Ảnh có thể đã lỗi trước khi script chạy
        if (capyImg.complete && capyImg.naturalWidth === 0) fail();
    }
    document.querySelectorAll('.capy-img-box img').forEach(img => {
        const box = img.parentElement;
        const fail = () => box.classList.add('fallback');
        img.addEventListener('error', fail);
        img.addEventListener('load', () => box.classList.remove('fallback'));
        if (img.complete && img.naturalWidth === 0) fail();
    });
}


// ============================================================
// 6. PHẦN 2: CHỌN 1 THẺ CAPYBARA
// ============================================================

function selectCapybara(emotionName, cardEl) {
    if (EMOTIONS.indexOf(emotionName) < 0) return;
    if (navigator.vibrate) navigator.vibrate(25);

    document.querySelectorAll('.capy-card').forEach(card => {
        const on = card === cardEl;
        card.classList.toggle('selected', on);
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    currentCheckin.part2_capybara = emotionName;
    checkFormCompletion();
}


// ============================================================
// 7. KIỂM TRA ĐIỀU KIỆN & HIỂN THỊ NÚT HOÀN THÀNH
// ============================================================

function idState() {
    const input = $('input-patient-id');
    const raw = input ? input.value.trim() : '';
    const id = normalizePatientId(raw);
    const digits = raw.replace(/\D/g, '').length;
    return { raw, id, digits };
}

// Hiện lỗi mềm dưới ô mã số: khi chị rời ô, gõ ký tự không phải số, hoặc quá 20 số
// (không mắng khi đang gõ dở)
function showIdError(force) {
    const { raw, id, digits } = idState();
    const errEl = $('patient-id-error');
    const input = $('input-patient-id');
    const bad = raw !== '' && !id && (force || digits > 20 || /[^\d\s.\-]/.test(raw));
    if (errEl) errEl.textContent = bad ? ID_ERROR : '';
    if (input) {
        if (bad) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
    }
    return bad;
}

function onInputChange() {
    showIdError(false);
    checkFormCompletion();
}

function checkFormCompletion() {
    const { id } = idState();
    const hasId = !!id;
    // Chỉ nói "chưa đúng" khi lỗi mềm dưới ô đang hiện (không nhắc khi chị đang gõ dở)
    const input = $('input-patient-id');
    const idBad = !!(input && input.getAttribute('aria-invalid') === 'true');
    const hasPart2 = Boolean(currentCheckin.part2_capybara);

    const btnSubmit = $('btn-submit');
    const hintEl = $('submit-hint');
    if (!btnSubmit || isSending) return;

    const ready = hasId && hasPart2;
    btnSubmit.classList.toggle('ready', ready);
    btnSubmit.disabled = !ready;
    if (!hintEl) return;
    hintEl.classList.toggle('done', ready);
    if (ready) hintEl.textContent = HINTS.done;
    else if (!hasId && idBad) hintEl.textContent = HINTS.idBad;
    else if (!hasId && !hasPart2) hintEl.textContent = HINTS.both;
    else if (!hasId) hintEl.textContent = HINTS.id;
    else hintEl.textContent = HINTS.card;
}


// ============================================================
// 8. GỬI DỮ LIỆU & CHUYỂN SANG TRANG CẢM ƠN
// ============================================================

/**
 * Gửi một lượt lên Apps Script. Trả Promise<boolean>: true khi máy chủ báo success.
 * - Lỗi mạng, hết giờ, HTTP lỗi, máy chủ báo retry → giữ trong hàng chờ, gửi lại sau.
 * - Máy chủ từ chối dữ liệu (sai định dạng) → bỏ khỏi hàng chờ (gửi lại cũng vô ích).
 * Lỗi chỉ log, không làm phiền chị (style guide mục 2).
 */
function sendCheckin(payload) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS) : null;
    // Gửi độ trễ ageMs (bây giờ − lúc bấm, cùng một đồng hồ máy) thay cho giờ tuyệt đối:
    // máy chủ ghi giờ = giờ nhận − ageMs, nên đồng hồ điện thoại chạy sai cũng không lệch ngày.
    const body = {
        sessionId: payload.sessionId,
        patientId: payload.patientId,
        level: payload.level,
        part1: payload.part1,
        part2: payload.part2
    };
    if (typeof payload.tappedAt === 'number') body.ageMs = Math.round(Date.now() - payload.tappedAt);
    return fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
    })
    .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    })
    .then(data => {
        if (data && data.result === 'success') {
            queueRemove(payload.sessionId);
            console.log('[Check-in] Đã lưu lên Google Sheet:', data);
            return true;
        }
        if (data && data.retry) throw new Error('máy chủ bận: ' + (data.error || ''));
        queueRemove(payload.sessionId);
        console.warn('[Check-in] Máy chủ từ chối lượt này, không gửi lại:', data);
        return false;
    })
    .catch(error => {
        console.warn('[Check-in] Chưa gửi được, sẽ thử lại sau:', error && error.message || error);
        return false;
    })
    .finally(() => { if (timer) clearTimeout(timer); });
}

// Gửi lại các lượt còn trong hàng chờ (lúc mở trang và khi có mạng trở lại)
let isFlushing = false;
function flushQueue() {
    if (isFlushing) return Promise.resolve();
    const q = readQueue();
    writeQueue(q); // dọn lượt quá hạn
    if (!q.length) return Promise.resolve();
    isFlushing = true;
    return q.reduce((p, item) => p.then(() => sendCheckin(item.payload)), Promise.resolve())
        .finally(() => { isFlushing = false; });
}

function submitCheckin() {
    if (isSending) return;
    const idInput = $('input-patient-id');
    const { id } = idState();

    if (!id) {
        showIdError(true);
        toast(ID_ERROR);
        if (idInput) idInput.focus();
        return;
    }
    if (!currentCheckin.part2_capybara) {
        toast('Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.');
        return;
    }
    isSending = true;

    // tappedAt: lúc chị bấm (chỉ giữ trong hàng chờ trên máy). Khi gửi, sendCheckin đổi thành
    // độ trễ ageMs để lượt gửi lại sau khi mất mạng vẫn ghi đúng giờ check-in
    if (!currentCheckin.sessionId) currentCheckin.sessionId = newSessionId();
    const level = currentCheckin.part1_score;
    const payload = {
        sessionId: currentCheckin.sessionId,
        tappedAt: Date.now(),
        patientId: id,
        level: level,
        part1: `${level} - ${currentCheckin.part1_text}`,
        part2: currentCheckin.part2_capybara
    };

    const btnSubmit = $('btn-submit');
    if (btnSubmit) {
        btnSubmit.textContent = BTN_SENDING;
        btnSubmit.disabled = true;
        btnSubmit.classList.add('sending');
    }

    // Vào hàng chờ trước, gửi ngay; gửi xong (success) là tự xóa khỏi máy
    queueAdd(payload);
    sendCheckin(payload);

    // Bắn pháo hoa ăn mừng (tự tắt khi máy bật giảm chuyển động)
    launchFireworks();

    renderSummary({ patientId: payload.patientId, part1: payload.part1, part2: payload.part2 });
    renderQuote(level);

    // Chuyển sang màn hình cảm ơn với dấu tick xanh lá
    setTimeout(() => {
        $('page-checkin').classList.remove('active');
        $('page-checkin').style.display = 'none';

        const pageSuccess = $('page-success');
        pageSuccess.style.display = 'block';
        pageSuccess.classList.add('active');

        window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
        // Đưa focus lên tiêu đề để trình đọc màn hình biết đã sang trang mới
        const title = $('success-title');
        if (title) title.focus({ preventScroll: true });
    }, 400);
}

/* Tóm tắt trang cảm ơn: dựng bằng textContent (không innerHTML) → chuỗi lạ không thành HTML; mã số luôn che */
function renderSummary(info) {
    const summaryEl = $('success-summary');
    if (!summaryEl) return;
    summaryEl.textContent = '';
    const head = document.createElement('strong');
    head.textContent = 'Mình đã ghi lại:';
    summaryEl.appendChild(head);
    [
        ['🆔 Mã số bệnh nhân: ', maskPatientId(info.patientId)],
        ['🌱 Mức cảm xúc: ', info.part1],
        ['🐾 Bé Capybara: ', info.part2]
    ].forEach(([label, value]) => {
        const line = document.createElement('div');
        line.appendChild(document.createTextNode(label));
        const b = document.createElement('b');
        b.textContent = String(value == null ? '' : value);
        line.appendChild(b);
        summaryEl.appendChild(line);
    });
}

/* Câu vỗ về theo mức; mức thấp mở sẵn khung Hỗ trợ */
function renderQuote(level) {
    const quoteEl = $('success-quote');
    const group = level <= 3 ? 'low' : (level <= 6 ? 'mid' : 'high');
    if (quoteEl) quoteEl.textContent = QUOTES[group];
    const support = $('support-box');
    if (support && group === 'low') support.open = true;
}

// Cho phép thực hiện lượt check-in mới
function resetCheckin() {
    const pageSuccess = $('page-success');
    pageSuccess.classList.remove('active');
    pageSuccess.style.display = 'none';

    const pageCheckin = $('page-checkin');
    pageCheckin.style.display = 'block';
    pageCheckin.classList.add('active');

    // Dọn tóm tắt để người sau (máy dùng chung) không thấy
    const summaryEl = $('success-summary');
    if (summaryEl) summaryEl.textContent = '';
    const support = $('support-box');
    if (support) support.open = false;

    const idInput = $('input-patient-id');
    if (idInput) idInput.value = '';
    showIdError(false);

    const slider = $('emotion-range');
    if (slider) slider.value = 5;

    document.querySelectorAll('.capy-card').forEach(card => {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    });

    currentCheckin.sessionId = '';
    currentCheckin.part2_capybara = '';
    isSending = false;

    const btnSubmit = $('btn-submit');
    if (btnSubmit) {
        btnSubmit.textContent = BTN_IDLE;
        btnSubmit.classList.remove('sending');
    }
    updateEmotionDisplay();

    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
}


// ============================================================
// 9. HỖ TRỢ: hiện số cơ sở khi anh đã điền SUPPORT_PHONE
// ============================================================
function initSupport() {
    const el = $('support-facility');
    if (!el || !SUPPORT_PHONE) return;
    el.textContent = (SUPPORT_NAME || 'Cơ sở đang theo dõi chị') + ': ';
    const a = document.createElement('a');
    a.href = 'tel:' + SUPPORT_PHONE.replace(/[^\d+]/g, '');
    a.className = 'support-tel';
    a.textContent = SUPPORT_PHONE;
    el.appendChild(a);
    el.hidden = false;
}


// ============================================================
// 10. KHỞI TẠO KHI TẢI TRANG (sự kiện gom qua data-act, không onclick inline)
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    // Bản cũ lưu SĐT thô của mọi người vào 'myCheckins' và có lối "quản trị" bằng SĐT.
    // Lối đó đã bỏ; xóa luôn bản lưu cũ trên máy để SĐT không nằm lại (dữ liệu thật ở Google Sheet).
    // 'myCheckins' chỉ do app Check-in bản cũ (f76adc9) tạo; app khác cùng origin không dùng khóa này.
    try { localStorage.removeItem('myCheckins'); } catch (e) { /* bỏ qua */ }
    // Hàng chờ bản 30/10/2026 giữ SĐT: xóa luôn (app không còn hỏi SĐT, Apps Script mới không nhận)
    try { localStorage.removeItem(OLD_QUEUE_KEY); } catch (e) { /* bỏ qua */ }

    initBgMusic();
    initSupport();
    setupImageFallbacks();
    updateEmotionDisplay();

    const idInput = $('input-patient-id');
    if (idInput) {
        idInput.addEventListener('input', onInputChange);
        idInput.addEventListener('blur', () => { showIdError(true); checkFormCompletion(); });
    }
    const slider = $('emotion-range');
    if (slider) slider.addEventListener('input', updateEmotionDisplay);

    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act;
        if (act === 'pick') selectCapybara(el.dataset.emotion, el);
        else if (act === 'submit') submitCheckin();
        else if (act === 'restart') resetCheckin();
        else if (act === 'music') toggleMusic();
    });

    // Gửi lại lượt còn treo từ lần trước, và mỗi khi có mạng trở lại
    window.addEventListener('online', flushQueue);
    flushQueue();
});
