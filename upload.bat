@echo off
chcp 65001 >nul
echo ========================================================
echo     DANG TAI CODE LEN GITHUB: ditruyenhungvuong/checkin-V2
echo ========================================================
echo.

rem ===== Soat URL Apps Script truoc khi day =====
rem ID trien khai Apps Script CU da lo cong khai tren GitHub. Con trong script.js thi KHONG DAY.
rem Khong dung dau ngoac tron trong cac dong echo ben duoi: cmd hieu nham la het khoi if.
set "OLD_ID=AKfycbzSx6BZ3UfryYuNBOPZY7Jvz7rBx_x-lHRCHl1Pfl9i_C_bHc2BJdXDBeqKqcT4-m7PZg"
findstr /L /C:"%OLD_ID%" "%~dp0script.js" >nul 2>&1
if %errorlevel% equ 0 (
    echo ========================================================
    echo  [!] KHONG DAY. script.js van dung URL Apps Script CU - da lo cong khai.
    echo  Ban app moi phai gui vao ban trien khai MOI. Cach lay URL moi:
    echo  1. Mo Google Sheet, vao Extensions - Apps Script.
    echo  2. Deploy - New deployment - Web app,
    echo     Execute as: Me, Who has access: Anyone - Deploy.
    echo  3. Chep "Web app URL" dang https://script.google.com/macros/s/.../exec
    echo     dan vao giua hai dau nhay cua dong const GOOGLE_SCRIPT_URL trong script.js,
    echo     luu file roi chay lai upload.bat.
    echo  Chi tiet: dau file google_apps_script.js, BUOC 5.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/4] Khoi tao Git...
    git init
    git branch -M main
    git remote add origin https://github.com/ditruyenhungvuong/checkin-V2.git
) else (
    git remote set-url origin https://github.com/ditruyenhungvuong/checkin-V2.git
    git branch -M main
)

echo [2/4] Dang gom toan bo file...
git add .

echo [3/4] Dang tao ban commit...
git commit -m "Cap nhat trang check-in cam xuc me bau" >nul 2>&1

echo [4/4] Dang day code len GitHub (nhanh main)...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo  [!] THONG BAO VE QUYEN TRUY CAP:
    echo  May tinh dang luu dang nhap tai khoan: ThanhBC1234
    echo  nhung kho chua thuoc ve: ditruyenhungvuong
    echo.
    echo  CACH XU LY NHANH NHAT (chi mat 30 giay):
    echo  1. Mo: https://github.com/ditruyenhungvuong/checkin-V2/settings/access
    echo  2. Bam "Add people", nhap: ThanhBC1234 de moi vao repo
    echo  3. Sau do chay lai file upload.bat nay la xong ngay!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [V] HOAN THANH! Code da duoc day len GitHub thanh cong.
    echo  Link repo: https://github.com/ditruyenhungvuong/checkin-V2
    echo ========================================================
)
echo.
pause
