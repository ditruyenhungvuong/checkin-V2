# Check-in Cảm Xúc Mẹ Bầu

App một trang (cỡ S, biến thể Hồng ấm) để thai phụ check-in cảm xúc:
nhập **Mã số bệnh nhân** → chạm 1 trong **10 chấm mức** (không có mức mặc định) → chọn 1 trong **9 bé Capybara**
(thẻ chỉ có hình) → bấm "Hoàn thành" → lượt được ghi vào Google Sheet → trang cảm ơn tick xanh → làm lượt khác.

## Bản 02/11/2026 (chưa đẩy)

- **10 chấm** thay thanh trượt: 2 hàng × 5 trên điện thoại, 1 hàng 10 trên màn ≥ 600 px; mỗi chấm ≥ 44×44 px, màu của mức.
  Chưa chọn mức thì nút Hoàn thành mờ (`aria-disabled`); chạm vào thì app nhắc "Chị chạm chọn một mức từ 1 đến 10 nhé."
  cạnh khu chấm và đưa focus tới chấm 1. Bàn phím: Tab vào nhóm, mũi tên/Home/End đổi mức, Space chọn.
  Gửi đi vẫn `level` số nguyên 1–10.
- **9 cảm xúc** (tên theo bộ ảnh mới anh gửi): Vui vẻ, Đau khổ, Lo lắng, Tức giận, Hoảng hốt, Khó chịu, Mệt mỏi, Bình an, Cô đơn.
  Thẻ chỉ hiện hình; tên đọc qua `aria-label`, ghi vào Sheet, và hiện dòng "Chị chọn: …" dưới lưới.
  Apps Script vẫn nhận nhãn cũ "Buồn" (web bản 01/11, hàng chờ cũ trên máy) và ghi nguyên chữ.
- **Xáo thứ tự 9 thẻ** mỗi lượt check-in mới (mở trang, "check-in khác") để chị không thiên về thẻ đứng đầu
  (Fisher–Yates + `crypto.getRandomValues`). 10 chấm giữ 1 → 10. Không lưu thứ tự, payload không đổi.
- Máy chủ trả `emotion_invalid` (Apps Script còn bản cũ) thì lượt **được giữ** trong hàng chờ để gửi lại.
- Apps Script: tab CheckIn hết hàng trống thì tự thêm 500 hàng rồi ghi (trước đây từ lượt thứ 1000 bị mất).
- **Ảnh thẻ**: `vui_ve.png`, `dau_kho.png`, `lo_lang.png`, `tuc_gian.png`, `hoang_hot.png`, `kho_chiu.png`, `met_moi.png`,
  `binh_an.png`, `co_don.png`: PNG 480×480 nền trong suốt, 47–59 KB/ảnh (nén từ ảnh gốc ~1,3–1,8 MB của anh:
  cắt sát hình, đệm vuông lề 6 %, bảng màu 256). Các file `.jpg` cũ (vui, buon, khoc, tuc, hoang_hot, kho_chiu) không còn dùng.
- **Google Sheet cho bác sĩ** (menu "Check-in" → "Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)", chạy một lần,
  chạy lại được): tô màu dòng theo mức (ĐỎ 1–3 · VÀNG 4–5 · XANH 6–10), tab **Tổng hợp** (mỗi mã số một dòng),
  tab **Tra cứu** (gõ mã ở ô B2, chỉ người có quyền sửa), cột **Gợi ý mở đầu** (Tổng hợp cột G, Tra cứu cột E: một câu
  gợi ý theo màu của mức và nhóm thẻ), tab **Hướng xử trí** ngay sau Tra cứu (bảng 3 màu + BÁO ĐỘNG, 9 thẻ chia 3 nhánh;
  **bản nháp dùng thử 03/11/2026**, chưa ban hành, chưa kiểm định; chữ cố định trong code, tab khóa).
  Khóa cứng cả bốn tab trừ ô B2. Bác sĩ quyền **Người xem** không gõ được ô B2: mở tab Tổng hợp, bấm **Ctrl+F** gõ mã số BN,
  đọc cột G. Cách chia sẻ cho bác sĩ ở đầu `google_apps_script.js` (BƯỚC 5).

### Thứ tự triển khai

1. **Apps Script trước**: dán `google_apps_script.js`, chạy thử, cập nhật bản triển khai AKfycbzfN8… lên Phiên bản mới
   (giữ URL) – BƯỚC 1–3 ở đầu file. Script mới vẫn nhận web cũ (6 cảm xúc).
2. Chạy menu "Cài bảng bác sĩ (màu, Tổng hợp, Tra cứu, Hướng xử trí)" (BƯỚC 4), chia sẻ cho bác sĩ (BƯỚC 5).
3. **Web sau**, khi đã có ảnh 3 cảm xúc mới: `./upload.sh` (BƯỚC 6). Đẩy web trước khi xong bước 1 thì lượt chọn
   3 cảm xúc mới bị Apps Script cũ từ chối và mất.

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
| `google_apps_script.js` | Apps Script cho **dự án mới** (Sheet "Check-in Cảm Xúc Mẹ Bầu – bản an toàn 30-10-2026", URL AKfycbzfN8…): doPost + menu bảng cho bác sĩ. Hướng dẫn cài ở đầu file. |
| `google_apps_script-du-an-cu.js` | Bản 29/10 cho **dự án cũ** (URL AKfycbzSx6…, hai bản triển khai đã lưu trữ 02/11/2026). Giữ để đối chiếu, không dán lại. |
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
