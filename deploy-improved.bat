@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ================================
echo   Ball Race → GitHub → Render
echo ================================
echo.

:: Проверка текущей директории
if not exist "server\app.js" (
    echo ❌ Запустите скрипт из папки с проектом Ball Race!
    echo    Текущая папка: %CD%
    echo    Нужная папка: c:\Users\ilapr\Desktop\Balls
    pause
    exit /b
)

echo ✅ Найден проект Ball Race
echo.

:: Способ 1: GitHub CLI (рекомендуется)
echo 🚀 Способ 1: Автоматический деплой через GitHub CLI
echo.
echo Этот способ:
echo ✅ Автоматически войдёт в GitHub
echo ✅ Создаст репозиторий
echo ✅ Загрузит код
echo ✅ Откроет Render.com для деплоя
echo.

set /p use_cli="Использовать GitHub CLI? [Y/n]: "
if /i "%use_cli%"=="n" goto manual_way

:: Проверка GitHub CLI
gh --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo 📥 GitHub CLI не установлен. Устанавливаю...
    winget install GitHub.cli
    if errorlevel 1 (
        echo ❌ Не удалось установить GitHub CLI
        echo    Установите вручную: https://cli.github.com/
        goto manual_way
    )
    echo ✅ GitHub CLI установлен! Перезапустите скрипт.
    pause
    exit /b
)

echo ✅ GitHub CLI найден
echo.

:: Проверка авторизации
gh auth status >nul 2>&1
if errorlevel 1 (
    echo 🔑 Требуется вход в GitHub...
    gh auth login
    if errorlevel 1 (
        echo ❌ Не удалось войти в GitHub
        goto manual_way
    )
)

echo ✅ Авторизация в GitHub успешна
echo.

:: Запрос названия репозитория
set /p repo_name="📁 Название репозитория [ball-race]: "
if "%repo_name%"=="" set repo_name=ball-race

echo.
echo 🚀 Создаю репозиторий и загружаю код...

:: Инициализация Git в правильной папке
if not exist ".git" (
    git init
)

:: Добавление файлов
git add .
git commit -m "Deploy to Render.com: Ball Race Telegram Mini App" 2>nul

:: Создание репозитория и загрузка
gh repo create %repo_name% --public --push --source .

if errorlevel 1 (
    echo ❌ Ошибка создания репозитория
    echo    Возможно, репозиторий уже существует
    echo.
    set /p repo_exists="Репозиторий уже существует? Загрузить в него код? [y/N]: "
    if /i "!repo_exists!"=="y" (
        git remote add origin https://github.com/$(gh api user --jq .login)/%repo_name%.git 2>nul
        git push -u origin main
    )
) else (
    echo ✅ Репозиторий создан и код загружен!
)

goto render_deploy

:manual_way
echo.
echo 🛠️ Способ 2: Ручная настройка
echo.
echo 1. Создайте репозиторий на github.com/Shooteriam/ball-race
echo 2. Выберите "Public"
echo 3. НЕ добавляйте README, .gitignore, license
echo.
echo 4. После создания выполните команды:

echo.
echo git init
echo git add .
echo git commit -m "Initial commit"
echo git remote add origin https://github.com/Shooteriam/ball-race.git
echo git push -u origin main
echo.

echo 5. При запросе логина используйте:
echo    Username: Shooteriam
echo    Password: [Personal Access Token]
echo.
echo 📋 Как получить Personal Access Token:
echo    github.com → Settings → Developer settings → Personal access tokens
echo    → Generate new token → Выберите 'repo' → Generate
echo.

set /p manual_done="Выполнили команды выше? [y/N]: "
if /i not "%manual_done%"=="y" (
    echo Запустите скрипт снова после выполнения команд
    pause
    exit /b
)

:render_deploy
echo.
echo 🌐 Теперь деплойте на Render.com:
echo.
echo 1. Откройте: https://render.com
echo 2. Войдите через GitHub
echo 3. New + → Web Service
echo 4. Выберите репозиторий: ball-race
echo 5. Настройки:
echo    • Name: ball-race
echo    • Region: Frankfurt (EU Central)
echo    • Build Command: cd server ^&^& npm install
echo    • Start Command: cd server ^&^& npm start
echo 6. Create Web Service
echo.

set /p open_render="🚀 Открыть Render.com? [Y/n]: "
if /i not "%open_render%"=="n" (
    start https://render.com/
)

echo.
echo 🎉 После деплоя:
echo    1. Скопируйте URL вида: https://ball-race-xxxx.onrender.com
echo    2. Откройте @BotFather в Telegram
echo    3. /myapps → выберите приложение → Edit App
echo    4. Обновите URL
echo.
echo ✅ Готово! Ваш Telegram Mini App будет работать по статическому URL
pause
