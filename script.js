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
// 02/11/2026: KHÔNG có mức mặc định (anh Thông yêu cầu), part1_score = 0 nghĩa là chưa chọn
let currentCheckin = {
    sessionId: '',
    part1_score: 0,
    part1_text: '',
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

// 9 cảm xúc hợp lệ, PHẢI trùng EMOTION_LABELS trong google_apps_script.js. Đây cũng là chuỗi ghi vào Sheet.
// 02/11/2026 anh Thông chốt tên theo bộ ảnh mới: "Buồn" → "Đau khổ"; thêm "Mệt mỏi", "Bình an", "Cô đơn".
const EMOTIONS = ['Vui vẻ', 'Đau khổ', 'Lo lắng', 'Tức giận', 'Hoảng hốt', 'Khó chịu', 'Mệt mỏi', 'Bình an', 'Cô đơn'];

// Lời nhắc tiến độ dưới nút Hoàn thành
// (all, level, LEVEL_ERROR, PICKED_PREFIX: đội viết 02/11/2026, chờ anh duyệt chữ)
const HINTS = {
    all:      "💡 Chị nhập mã số bệnh nhân, chạm chọn một mức và 1 bé Capybara là xong nhé.",
    id:       "💡 Chị nhập mã số bệnh nhân ở trên giúp mình nhé.",
    idBad:    "💡 Mã số bệnh nhân chưa đúng, chị xem lại giúp mình nhé.",
    level:    "💡 Chị chạm chọn một mức cảm xúc ở Phần 1 nhé.",
    card:     "💡 Chị chạm chọn 1 bé Capybara ở Phần 2 nhé.",
    done:     "✨ Xong rồi, chị chạm nút Hoàn thành nhé!"
};
const ID_ERROR = "Chị nhập mã số bệnh nhân (chỉ gồm chữ số, ví dụ 26012345) nhé.";
// Câu nhắc cạnh 10 chấm khi chị bấm Hoàn thành mà chưa chọn mức
const LEVEL_ERROR = "Chị chạm chọn một mức từ 1 đến 10 nhé.";
// Dòng chữ nhỏ dưới lưới thẻ (thẻ chỉ có hình): "Chị chọn: Mệt mỏi"
const PICKED_PREFIX = "Chị chọn: ";
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
// 5. PHẦN 1: 10 CHẤM MỨC CẢM XÚC (1 - 10), radiogroup, không có mức mặc định
// ============================================================

const levelDots = () => Array.prototype.slice.call(document.querySelectorAll('.level-dot'));

/** Vẽ lại ảnh, nhãn "7 - Tốt", trạng thái 10 chấm theo currentCheckin.part1_score (0 = chưa chọn). */
function renderLevel() {
    const val = currentCheckin.part1_score;
    const data = emotionLevels[val];

    const capyImg = $('current-capy');
    const capyEmoji = $('current-capy-emoji');
    if (data) {
        // Ảnh bé Capybara + alt đổi theo mức; emoji dự phòng luôn đúng mức (hiện khi ảnh lỗi)
        if (capyImg) {
            if ((capyImg.getAttribute('src') || '') !== data.image) capyImg.src = data.image;
            capyImg.alt = `Bé Capybara mức ${val}: ${data.text}`;
        }
        if (capyEmoji) capyEmoji.textContent = data.emoji;
    } else {
        // Chưa chọn mức: bỏ ảnh, khung hiện hoa
        if (capyImg) { capyImg.removeAttribute('src'); capyImg.alt = ''; capyImg.hidden = true; }
        if (capyEmoji) { capyEmoji.textContent = '🌸'; capyEmoji.hidden = false; }
    }

    const statusEl = $('current-status');
    if (statusEl) {
        statusEl.textContent = data ? `${val} - ${data.text}` : '';
        statusEl.style.color = data ? data.color : '';
    }

    // Roving tabindex: chấm đang chọn nhận Tab; chưa chọn thì chấm 1 nhận Tab
    levelDots().forEach(dot => {
        const n = parseInt(dot.dataset.level, 10);
        const on = n === val;
        dot.classList.toggle('selected', on);
        dot.setAttribute('aria-checked', on ? 'true' : 'false');
        dot.tabIndex = (on || (!data && n === 1)) ? 0 : -1;
    });
}

/** Chọn mức n (1..10). focus = true khi chọn bằng phím (đưa focus theo chấm mới). */
function selectLevel(n, focus) {
    const val = parseInt(n, 10);
    if (!emotionLevels[val]) return;
    currentCheckin.part1_score = val;
    currentCheckin.part1_text = emotionLevels[val].text;
    renderLevel();
    showLevelError(false);
    if (focus) {
        const dot = document.querySelector('.level-dot[data-level="' + val + '"]');
        if (dot) dot.focus();
    }
    if (navigator.vibrate) navigator.vibrate(15);
    checkFormCompletion();
}

/** Phím trong nhóm 10 chấm: mũi tên phải/xuống = mức kế, trái/lên = mức trước (vòng lại), Home/End = 1/10, Space = chọn chấm đang focus. */
function onLevelKey(e) {
    const dot = e.target.closest ? e.target.closest('.level-dot') : null;
    if (!dot) return;
    const cur = parseInt(dot.dataset.level, 10);
    let next = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = cur >= 10 ? 1 : cur + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = cur <= 1 ? 10 : cur - 1;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 10;
    else if (e.key === ' ' || e.key === 'Spacebar') next = cur;
    else return;
    e.preventDefault(); // không cuộn trang
    selectLevel(next, true);
}

/** Câu nhắc cạnh 10 chấm (bấm Hoàn thành khi chưa chọn mức). */
function showLevelError(on) {
    const el = $('level-error');
    if (el) el.textContent = on ? LEVEL_ERROR : '';
    const group = $('level-dots');
    if (group) group.classList.toggle('need', !!on);
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
    renderPicked();
    checkFormCompletion();
}

/**
 * Số ngẫu nhiên nguyên 0 … n−1. Dùng crypto.getRandomValues (bỏ phần dư để không lệch),
 * máy không có thì dùng Math.random.
 */
function randomInt(n) {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const buf = new Uint32Array(1);
        const limit = Math.floor(0x100000000 / n) * n;
        let x;
        do { window.crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
        return x % n;
    }
    return Math.floor(Math.random() * n);
}

/**
 * Xáo thứ tự 9 thẻ mỗi lượt check-in mới (mở trang, "check-in khác") để chị không bị
 * thiên về thẻ đứng đầu (anh Thông yêu cầu 02/11/2026). Fisher–Yates; dời chính các nút
 * trong DOM nên thứ tự Tab / trình đọc màn hình trùng thứ tự nhìn thấy.
 * KHÔNG xáo 10 chấm mức, KHÔNG lưu thứ tự vào máy, payload không đổi.
 */
function shuffleCards() {
    const grid = document.querySelector('.emotion-grid');
    if (!grid) return;
    const cards = Array.prototype.slice.call(grid.querySelectorAll('.capy-card'));
    for (let i = cards.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
    }
    cards.forEach(card => grid.appendChild(card));
}

/* Thẻ chỉ có hình nên ghi một dòng chữ nhỏ dưới lưới để chị biết mình đã chọn gì */
function renderPicked() {
    const el = $('emotion-picked');
    if (el) el.textContent = currentCheckin.part2_capybara ? PICKED_PREFIX + currentCheckin.part2_capybara : '';
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
    const hasLevel = Boolean(emotionLevels[currentCheckin.part1_score]);
    const hasPart2 = Boolean(currentCheckin.part2_capybara);

    const btnSubmit = $('btn-submit');
    const hintEl = $('submit-hint');
    if (!btnSubmit || isSending) return;

    // Chưa đủ: nút mờ + aria-disabled nhưng VẪN chạm được, để submitCheckin nhắc đúng chỗ còn thiếu
    const ready = hasId && hasLevel && hasPart2;
    btnSubmit.classList.toggle('ready', ready);
    btnSubmit.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (!hintEl) return;
    hintEl.classList.toggle('done', ready);
    if (ready) hintEl.textContent = HINTS.done;
    else if (!hasId && idBad) hintEl.textContent = HINTS.idBad;
    else if (!hasId && !hasLevel && !hasPart2) hintEl.textContent = HINTS.all;
    else if (!hasId) hintEl.textContent = HINTS.id;
    else if (!hasLevel) hintEl.textContent = HINTS.level;
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
        // App chỉ gửi nhãn trong EMOTIONS, nên emotion_invalid nghĩa là Apps Script còn bản cũ
        // (chưa nhận 3 cảm xúc mới): GIỮ lượt trong hàng chờ, gửi lại khi máy chủ được cập nhật.
        if (data && data.error === 'emotion_invalid') throw new Error('máy chủ còn bản cũ: emotion_invalid');
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
        // Thiếu cả mức thì nhắc luôn cạnh 10 chấm (B-03), focus vẫn về chỗ lỗi đầu tiên là ô mã số
        if (!emotionLevels[currentCheckin.part1_score]) showLevelError(true);
        if (idInput) idInput.focus();
        return;
    }
    if (!emotionLevels[currentCheckin.part1_score]) {
        // Chưa chọn mức: không gửi, nhắc ngay cạnh 10 chấm và đưa chị tới đó
        showLevelError(true);
        const group = $('level-dots');
        if (group) group.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
        const first = document.querySelector('.level-dot[tabindex="0"]');
        if (first) first.focus({ preventScroll: true });
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

    // Không có mức mặc định: lượt mới bắt đầu chưa chọn chấm nào
    currentCheckin.part1_score = 0;
    currentCheckin.part1_text = '';
    showLevelError(false);

    document.querySelectorAll('.capy-card').forEach(card => {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    });

    currentCheckin.sessionId = '';
    currentCheckin.part2_capybara = '';
    renderPicked();
    shuffleCards(); // lượt mới: thứ tự thẻ mới
    isSending = false;

    const btnSubmit = $('btn-submit');
    if (btnSubmit) {
        btnSubmit.textContent = BTN_IDLE;
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('sending');
    }
    renderLevel();
    checkFormCompletion();

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
    shuffleCards();
    setupImageFallbacks();
    renderLevel();
    checkFormCompletion();

    const idInput = $('input-patient-id');
    if (idInput) {
        idInput.addEventListener('input', onInputChange);
        idInput.addEventListener('blur', () => { showIdError(true); checkFormCompletion(); });
    }
    const dots = $('level-dots');
    if (dots) dots.addEventListener('keydown', onLevelKey);

    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act;
        if (act === 'pick') selectCapybara(el.dataset.emotion, el);
        else if (act === 'level') selectLevel(el.dataset.level, false);
        else if (act === 'submit') submitCheckin();
        else if (act === 'restart') resetCheckin();
        else if (act === 'music') toggleMusic();
    });

    // Gửi lại lượt còn treo từ lần trước, và mỗi khi có mạng trở lại
    window.addEventListener('online', flushQueue);
    flushQueue();
});
