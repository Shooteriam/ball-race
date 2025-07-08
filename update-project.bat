@echo off
chcp 65001 > nul
echo ===============================================
echo   🚀 Ball Race - Обновление проекта
echo ===============================================
echo.

echo [1/5] 🧹 Удаление лишних файлов...

REM Удаляем дублирующий файл стилей
if exist "client\css\styles_new.css" (
    del "client\css\styles_new.css"
    echo ✅ Удалён styles_new.css
)

REM Удаляем старый bat-файл деплоя
if exist "deploy-improved.bat" (
    del "deploy-improved.bat"
    echo ✅ Удалён deploy-improved.bat
)

REM Удаляем файл с конфигурацией админа (содержит чувствительные данные)
if exist "admin-config.txt" (
    del "admin-config.txt"
    echo ✅ Удалён admin-config.txt
)

REM Удаляем файл с GitHub токенами (содержит чувствительные данные)
if exist "GITHUB_AUTH.md" (
    del "GITHUB_AUTH.md"
    echo ✅ Удалён GITHUB_AUTH.md
)

echo.
echo [2/5] 📋 Проверка статуса git...
git status --porcelain

echo.
echo [3/5] ➕ Добавление всех изменений...
git add .

echo.
echo [4/5] 💾 Создание коммита...
set /p commit_message="Введите сообщение коммита (или нажмите Enter для 'Update project'): "
if "%commit_message%"=="" set commit_message=Update project

git commit -m "%commit_message%"

echo.
echo [5/5] 🚀 Отправка на сервер...
git push origin main

echo.
echo ===============================================
echo   ✅ Проект успешно обновлён!
echo   🌐 Автоматический деплой на Render.com начался
echo   📱 Через 2-3 минуты изменения будут доступны в Telegram Mini App
echo ===============================================
echo.
echo 📊 Полезные команды:
echo   npm start (в папке server) - запуск локально
echo   git status - проверка статуса
echo   git log --oneline -5 - последние коммиты
echo.
pause
