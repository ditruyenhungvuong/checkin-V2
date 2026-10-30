# Nguồn mã app Check-in Cảm Xúc Mẹ Bầu (anh Thông gọi "STOP-4P Pregnant")

- App đang chạy: https://ditruyenhungvuong.github.io/checkin/
- Repo gốc: https://github.com/ditruyenhungvuong/checkin (nhánh `main`)
- Commit mới nhất lúc tải: `f76adc9` — "Update upload.bat script" — 13/09/2026 14:47 UTC
- Thời điểm tải về: 28/10/2026 14:40 (giờ máy anh Thông)
- Cách tải: `https://raw.githubusercontent.com/ditruyenhungvuong/checkin/main/<file>`

## File đã tải (nguyên bản lúc tải)

| File | Cỡ |
|---|---|
| `index.html` | 10.620 byte |
| `styles.css` | 16.835 byte |
| `script.js` | 16.522 byte |
| `google_apps_script.js` | 5.050 byte |
| `upload.bat` | 1.655 byte |
| `.gitignore` | 38 byte |

## File KHÔNG tải (dùng lại từ repo gốc khi đẩy lên)

- Ảnh 6 thẻ cảm xúc: `vui.jpg`, `buon.jpg`, `khoc.jpg`, `tuc.jpg`, `hoang_hot.jpg`, `kho_chiu.jpg`
- Ảnh 10 mức: `capy-level-01.png` … `capy-level-10.png` (mỗi ảnh 1–1,7 MB)
- Nhạc nền: `background-music.mp3` (~19 MB)

Khi chạy thử tại máy, ảnh và nhạc sẽ báo 404; đây là điều biết trước, không phải lỗi app.
Khi đẩy bản sửa lên repo gốc, các file trên vẫn còn ở repo nên không cần tải lại.

## Trạng thái 29/10/2026: ĐÃ SỬA (3 lượt), không còn nguyên bản

`index.html`, `styles.css`, `script.js`, `google_apps_script.js` đã được đội sửa trên máy Ubuntu theo
`docs/qa/checkin-me-bau-tong-hop.md` mục 7, 8, 9 (bỏ admin, Apps Script an toàn, escape, bàn phím, tương phản,
SĐT Việt Nam, hàng chờ gửi lại, nhạc mặc định tắt…). Cỡ byte ở bảng trên là của bản gốc.
`.gitignore` chưa đổi. `upload.sh` (OLD_IDS) và `upload.bat` (findstr, thêm một khối ở đầu, phần còn lại giữ nguyên) có chốt chặn URL cũ. Bản gốc xem lại ở commit `f76adc9` trên GitHub.
**Chưa đẩy lên GitHub.** URL ở `script.js` dòng 6 vẫn là URL cũ: anh tạo bản triển khai mới rồi dán URL mới.

## Lưu ý an toàn

`script.js` dòng 6 đang giữ URL Apps Script THẬT của anh (URL cũ, đã lộ). Mọi lần chạy thử/test phải thay URL này
bằng mock hoặc rỗng ngay lúc phục vụ file (không sửa file trên đĩa), theo cách
`apps/checkin-vao-ca/tests/lib/static-server.js` làm. Không bao giờ bấm "Hoàn thành" khi URL còn là URL thật.
