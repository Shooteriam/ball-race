# 🚀 Пошаговый деплой Ball Race на Render.com

## 📋 Что вам понадобится:

- Аккаунт на GitHub.com (регистрация бесплатная)
- Аккаунт на Render.com (регистрация бесплатная)

## 🔧 Шаг 1: Установка Git (если не установлен)

1. Скачайте Git: https://git-scm.com/download/win
2. Установите с настройками по умолчанию
3. Перезапустите PowerShell/CMD

## 📁 Шаг 2: Создание GitHub репозитория

1. Зайдите на https://github.com
2. Нажмите кнопку "New repository" (зелёная кнопка)
3. Название: `ball-race`
4. Выберите "Public"
5. НЕ ставьте галочки на README, .gitignore, license
6. Нажмите "Create repository"

## 💻 Шаг 3: Загрузка кода на GitHub

Выполните команды в папке проекта:

```bash
# Инициализация Git
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: Ball Race Telegram Mini App"

# Добавление удалённого репозитория (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ball-race.git

# Отправка кода
git push -u origin main
```

## 🌐 Шаг 4: Деплой на Render.com

1. Зайдите на https://render.com
2. Нажмите "Get Started for Free"
3. Войдите через GitHub аккаунт
4. Нажмите "New +" → "Web Service"
5. Найдите репозиторий `ball-race` и нажмите "Connect"

### Настройки деплоя:

- **Name**: `ball-race` (или любое имя)
- **Region**: `Frankfurt (EU Central)`
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`

6. Нажмите "Create Web Service"

## ⏱️ Шаг 5: Ожидание деплоя

- Процесс займёт 3-5 минут
- Следите за логами сборки
- После успешного деплоя получите URL вида: `https://ball-race-xxxx.onrender.com`

## 🔗 Шаг 6: Настройка Telegram Mini App

1. Скопируйте полученный URL
2. Откройте @BotFather в Telegram
3. Используйте команду `/myapps`
4. Выберите ваше приложение
5. Нажмите "Edit App"
6. Обновите URL на полученный от Render

## ✅ Готово!

Ваше приложение теперь доступно по статическому URL, который никогда не изменится!

## 🔄 Обновления

Для обновления приложения:

1. Внесите изменения в код
2. Выполните:
   ```bash
   git add .
   git commit -m "Update: описание изменений"
   git push
   ```
3. Render автоматически пересоберёт приложение

## 🆘 Проблемы?

- Проверьте логи на Render.com в разделе "Logs"
- Убедитесь, что все зависимости указаны в server/package.json
- Проверьте, что сервер слушает на правильном порту (process.env.PORT)

Нужна помощь с каким-то шагом? Спрашивайте!
