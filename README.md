# Check-in Cảm Xúc Mẹ Bầu

App một trang (cỡ S, biến thể Hồng ấm) để thai phụ check-in cảm xúc:
nhập **Mã số bệnh nhân** → kéo thanh trượt 10 mức → chọn 1 trong 6 bé Capybara → bấm "Hoàn thành" →
lượt được ghi vào Google Sheet → trang cảm ơn tick xanh → làm lượt khác.

Web: https://ditruyenhungvuong.github.io/checkin-V2/

## Mã số bệnh nhân (từ 01/11/2026, thay cho số điện thoại)

- Chỉ chữ số. App bỏ khoảng trắng, dấu chấm, dấu gạch chị gõ lẫn; sau khi bỏ phải còn **3–20 chữ số**.
- Giữ nguyên số 0 ở đầu: `0012345` ghi đúng `0012345` (ô trong Sheet đặt dạng văn bản).
- Ví dụ nhận: `26012345`, `0012345`, `260 123 45`. Ví dụ báo lỗi: `12`, 21 chữ số, `HV123`, `=1+1`, để trống.
- Ô nhập `inputmode="numeric"` (bàn phím số), `autocomplete="off"`. Trang cảm ơn che bớt mã (`26 ••• 345`).
- Trường gửi lên Apps Script: `{ sessionId, ageMs, patientId, level, part1, part2 }`.

## File

| File | Việc |
|---|---|
| `index.html`, `styles.css`, `script.js` | Giao diện và logic. `script.js` dòng 6 là `GOOGLE_SCRIPT_URL` (URL thật). |
| `google_apps_script.js` | Apps Script cho **dự án mới** (Sheet "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026", URL AKfycbzfN8…). Hướng dẫn cài ở đầu file. |
| `google_apps_script-du-an-cu.js` | Bản 29/10 cho **dự án cũ** (URL AKfycbzSx6…), nơi app bản 9/2026 vẫn gửi SĐT. Chỉ dùng để tắt doGet ở dự án cũ. |
| `upload.sh` / `upload.bat` | Đẩy lên GitHub (Ubuntu / Windows). Chặn đẩy nếu `script.js` còn URL cũ. |
| `tests/` | Rà nội dung, giả lập Apps Script, e2e Chrome headless. |

## Lưu trên máy (localStorage)

Mọi app ở `ditruyenhungvuong.github.io` dùng chung localStorage. App này chỉ dùng khóa có tiền tố `checkin_me_bau_`:
`checkin_me_bau_queue` giữ tạm lượt chưa gửi được (gửi xong là xóa). Khi mở app, xóa khóa cũ `checkin_me_bau_pending`
(hàng chờ bản 30/10 còn giữ SĐT) và `myCheckins` (bản 9/2026). Không đụng khóa của Nhật Ký Mẹ Bầu.

## Chạy thử và test

```bash
python3 -m http.server 8768 --bind 127.0.0.1 --directory apps/checkin-me-bau   # chạy tay: ĐỪNG bấm Hoàn thành (URL thật)
cd apps/checkin-me-bau
node tests/check-content.js && node tests/test-gas.js && node tests/e2e.js     # hoặc --only=main,patientid
```

Bộ test thay URL bằng mock lúc phục vụ file và chặn `script.google.com`; không gửi gì tới Sheet thật.
Windows/Surface: `tests\run-all.cmd`.
