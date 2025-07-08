# 🔑 Быстрая настройка аутентификации GitHub

## Способ 1: GitHub CLI (Рекомендуется)

```bash
# 1. Установка GitHub CLI
winget install GitHub.cli

# 2. Вход в аккаунт
gh auth login

# 3. Автоматический деплой
.\deploy-to-render.bat
```

## Способ 2: Personal Access Token

### Создание токена:

1. Зайдите на github.com → Settings → Developer settings
2. Personal access tokens → Tokens (classic) → Generate new token
3. Выберите права: `repo` (полный доступ к репозиториям)
4. Скопируйте токен (сохраните, больше не увидите!)

### Использование:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Shooteriam/ball-race.git
git push -u origin main

# При запросе:
# Username: Shooteriam
# Password: [вставьте ваш Personal Access Token]
```

## Способ 3: SSH ключи

```bash
# 1. Создание SSH ключа
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. Добавление в GitHub
# Скопируйте содержимое ~/.ssh/id_ed25519.pub
# GitHub → Settings → SSH and GPG keys → New SSH key

# 3. Использование SSH URL
git remote add origin git@github.com:Shooteriam/ball-race.git
```

---

**Самый простой способ:** Используйте GitHub CLI! 🚀
