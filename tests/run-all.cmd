@echo off
rem =========================================================
rem  Chạy toàn bộ test QA của app Check-in Cảm Xúc Mẹ Bầu (file của đội, không phải của app).
rem  Máy không có Node trong PATH thì đặt biến NODE, ví dụ:
rem    set NODE=C:\Users\SF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
rem    tests\run-all.cmd
rem  Cần Chrome tại C:\Program Files\Google\Chrome\Application\chrome.exe (hoặc đặt CHROME=...).
rem  Kết quả, screenshot, console log ghi vào %TEMP%\checkin-me-bau-qa\ (không ghi vào thư mục app trên Drive).
rem  script.js trên đĩa KHÔNG bị sửa; URL Apps Script thật được thay bằng mock ngay lúc phục vụ.
rem
rem  02/11/2026 thêm 2 file test của QA:
rem   - qa-gas-day-1000.js : tab CheckIn đầy 1000 hàng vẫn ghi được (lỗi B-01, anh duyệt sửa).
rem   - qa-cham-muc.js     : ca biên 10 chấm / 9 thẻ / xáo thẻ / hàng chờ emotion_invalid (QA lượt 2).
rem  Đợt 3 (02/11/2026): anh đổi tên cảm xúc theo bộ ảnh mới ("Buồn" -> "Đau khổ", "Bình yên" -> "Bình an",
rem  "Tủi thân, cô đơn" -> "Cô đơn") và thay ảnh .jpg bằng .png. QA lượt 3 đã cập nhật hai test QA theo tên/ảnh mới
rem  -> CHẶN như test khác (QA_GAS_1000_CHAN=1, QA_CHAM_MUC_CHAN=1).
rem  04/11/2026: thêm qa-huong-xu-tri.js (QA): tab Hướng xử trí + cột Gợi ý mở đầu khớp spec nguyên văn,
rem  công thức đúng cú pháp vi_VN, Unicode NFC. Không có git thì tự BỎ QUA phần so git.
rem =========================================================
setlocal
cd /d "%~dp0\.."
if "%NODE%"=="" set NODE=node
set FAIL=0
set QA_CHAM_MUC_CHAN=1
set QA_GAS_1000_CHAN=1

echo === 1/6 Ra noi dung tinh (giong viet, nhan, hint, style guide) ===
"%NODE%" tests\check-content.js || set FAIL=1

echo.
echo === 2/6 Apps Script gia lap (doGet tat, doPost kiem du lieu, menu bac si) ===
"%NODE%" tests\test-gas.js || set FAIL=1

echo.
echo === 3/6 Apps Script: tab CheckIn day 1000 hang (QA, B-01) ===
"%NODE%" tests\qa-gas-day-1000.js
if errorlevel 1 (
  if "%QA_GAS_1000_CHAN%"=="1" (set FAIL=1) else (echo CHO QA: qa-gas-day-1000 con gui nhan cu "Tui than, co don" - khong tinh la do)
)

echo.
echo === 4/6 E2E Chrome headless ===
"%NODE%" tests\e2e.js %* || set FAIL=1

echo.
echo === 5/6 QA ca bien 10 cham / 9 the ===
"%NODE%" tests\qa-cham-muc.js
if errorlevel 1 (
  if "%QA_CHAM_MUC_CHAN%"=="1" (set FAIL=1) else (echo CHO QA: qa-cham-muc con dung nhan/anh cu ^(Buon, Binh yen, Tui than co don, .jpg^) - khong tinh la do)
)

echo.
echo === 6/6 QA Huong xu tri + Goi y mo dau (doi chieu spec, cu phap vi_VN, NFC) ===
"%NODE%" tests\qa-huong-xu-tri.js || set FAIL=1

echo.
if "%FAIL%"=="1" (echo KET QUA: CO TEST DO & exit /b 1) else (echo KET QUA: TAT CA XANH & exit /b 0)
