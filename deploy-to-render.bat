@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ================================
echo   Ball Race → Render.com Deploy
echo ================================
echo.

:: Проверка Git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git не установлен!
    echo.
    echo 📥 Скачайте Git: https://git-scm.com/download/win
    echo    Установите и перезапустите командную строку
    echo.
    pause
    exit /b
)

echo ✅ Git установлен
echo.

:: Запрос данных GitHub
set /p github_username="🐙 Введите ваш GitHub username: "
if "%github_username%"=="" (
    echo ❌ GitHub username обязателен!
    pause
    exit /b
)

set /p repo_name="📁 Название репозитория [ball-race]: "
if "%repo_name%"=="" set repo_name=ball-race

echo.
echo 📋 Сводка:
echo    GitHub: https://github.com/%github_username%/%repo_name%
echo    Render: будет создан автоматически
echo.

set /p confirm="✅ Продолжить? [y/N]: "
if /i not "%confirm%"=="y" (
    echo Отменено пользователем
    pause
    exit /b
)

echo.
echo 🚀 Начинаю деплой...
echo.

:: Инициализация Git
echo [1/4] Инициализация Git...
if exist .git (
    echo    Git уже инициализирован
) else (
    git init
    if errorlevel 1 (
        echo ❌ Ошибка инициализации Git
        pause
        exit /b
    )
)

:: Добавление файлов
echo [2/4] Добавление файлов...
git add .
git commit -m "Deploy to Render.com: Ball Race Telegram Mini App"

:: Добавление remote
echo [3/4] Настройка удалённого репозитория...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/%github_username%/%repo_name%.git

:: Отправка на GitHub
echo [4/4] Отправка кода на GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ Ошибка отправки на GitHub!
    echo.
    echo 🔧 Что делать:
    echo    1. Создайте репозиторий на github.com/%github_username%/%repo_name%
    echo    2. Убедитесь, что репозиторий публичный (Public)
    echo    3. Попробуйте ещё раз
    echo.
    pause
    exit /b
)

echo.
echo ✅ Код успешно загружен на GitHub!
echo.
echo 🌐 Репозиторий: https://github.com/%github_username%/%repo_name%
echo.
echo 🚀 Теперь деплойте на Render.com:
echo    1. Зайдите на https://render.com
echo    2. Войдите через GitHub
echo    3. New + → Web Service
echo    4. Выберите репозиторий: %repo_name%
echo    5. Настройки:
echo       • Build Command: cd server ^&^& npm install
echo       • Start Command: cd server ^&^& npm start
echo    6. Create Web Service
echo.
echo 📱 После деплоя обновите URL в @BotFather
echo.

:: Открытие браузера
set /p open_browser="🌐 Открыть Render.com в браузере? [y/N]: "
if /i "%open_browser%"=="y" (
    start https://render.com
)

echo.
echo 🎉 Готово! Следуйте инструкциям выше.
pause
