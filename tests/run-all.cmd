@echo off
rem =========================================================
rem  Chạy toàn bộ test QA của app Check-in Cảm Xúc Mẹ Bầu (file của đội, không phải của app).
rem  Máy không có Node trong PATH thì đặt biến NODE, ví dụ:
rem    set NODE=C:\Users\SF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
rem    tests\run-all.cmd
rem  Cần Chrome tại C:\Program Files\Google\Chrome\Application\chrome.exe (hoặc đặt CHROME=...).
rem  Kết quả, screenshot, console log ghi vào %TEMP%\checkin-me-bau-qa\ (không ghi vào thư mục app trên Drive).
rem  script.js trên đĩa KHÔNG bị sửa; URL Apps Script thật được thay bằng mock ngay lúc phục vụ.
rem =========================================================
setlocal
cd /d "%~dp0\.."
if "%NODE%"=="" set NODE=node
set FAIL=0

echo === 1/3 Ra noi dung tinh (giong viet, nhan, hint, style guide) ===
"%NODE%" tests\check-content.js || set FAIL=1

echo.
echo === 2/3 Apps Script gia lap (doGet tat, doPost kiem du lieu) ===
"%NODE%" tests\test-gas.js || set FAIL=1

echo.
echo === 3/3 E2E Chrome headless ===
"%NODE%" tests\e2e.js %* || set FAIL=1

echo.
if "%FAIL%"=="1" (echo KET QUA: CO TEST DO & exit /b 1) else (echo KET QUA: TAT CA XANH & exit /b 0)
