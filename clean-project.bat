@echo off
chcp 65001 > nul
echo ===============================================
echo   🧹 Ball Race - Очистка проекта
echo ===============================================
echo.

echo Удаление временных и лишних файлов...
echo.

REM Удаляем временные файлы
if exist "*.tmp" del "*.tmp"
if exist "*.log" del "*.log"
if exist "*.bak" del "*.bak"

REM Удаляем дублирующие файлы стилей
if exist "client\css\styles_new.css" (
    del "client\css\styles_new.css"
    echo ✅ Удалён styles_new.css
)

if exist "client\css\styles_old.css" (
    del "client\css\styles_old.css"
    echo ✅ Удалён styles_old.css
)

if exist "client\css\backup_styles.css" (
    del "client\css\backup_styles.css"
    echo ✅ Удалён backup_styles.css
)

REM Удаляем старые bat-файлы
if exist "deploy-improved.bat" (
    del "deploy-improved.bat"
    echo ✅ Удалён deploy-improved.bat
)

if exist "start-server.bat" (
    del "start-server.bat"
    echo ✅ Удалён start-server.bat
)

if exist "build.bat" (
    del "build.bat"
    echo ✅ Удалён build.bat
)

REM Удаляем файлы с чувствительными данными
if exist "admin-config.txt" (
    del "admin-config.txt"
    echo ✅ Удалён admin-config.txt
)

if exist "GITHUB_AUTH.md" (
    del "GITHUB_AUTH.md"
    echo ✅ Удалён GITHUB_AUTH.md
)

if exist ".env" (
    del ".env"
    echo ✅ Удалён .env
)

REM Удаляем временные папки (если есть)
if exist "temp\" (
    rmdir /s /q "temp\"
    echo ✅ Удалена папка temp\
)

if exist "backup\" (
    rmdir /s /q "backup\"
    echo ✅ Удалена папка backup\
)

REM Удаляем файлы редактора
if exist "*.swp" del "*.swp"
if exist "*~" del "*~"
if exist ".DS_Store" del ".DS_Store"
if exist "Thumbs.db" del "Thumbs.db"

echo.
echo ===============================================
echo   ✅ Очистка завершена!
echo   📁 Проект готов к коммиту
echo ===============================================
echo.

REM Показываем оставшиеся файлы
echo 📂 Структура проекта после очистки:
tree /f /a

echo.
pause
