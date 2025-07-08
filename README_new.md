# 🎮 Ball Race - Telegram Mini App

Многопользовательская гонка шариков для Telegram Mini Apps с современным soft UI дизайном.

## 🚀 Быстрый деплой на Render.com

1. **Запустите скрипт деплоя:**

   ```bash
   .\deploy-to-render.bat
   ```

2. **Следуйте инструкциям** в файле `RENDER_DEPLOY_GUIDE.md`

3. **Получите статический URL** вида `https://ball-race-xxxx.onrender.com`

## 📁 Структура проекта

```
├── server/          # Бэкенд (Express + Socket.IO)
├── client/          # Фронтенд (HTML + CSS + JS)
├── render.yaml      # Конфигурация Render.com
└── admin-config.txt # ID администраторов
```

## 🎯 Возможности

- ⚡ Современный soft UI дизайн
- 🏁 Многопользовательские гонки
- 🎱 Покупка шариков (Telegram Stars)
- 👑 Админ-панель для управления
- 📱 Адаптивный интерфейс
- 🌐 Статический URL на Render.com

## 🔧 Локальный запуск

```bash
cd server
npm install
npm start
```

Откройте http://localhost:3000

---

**Автор:** ilapr  
**Лицензия:** MIT
