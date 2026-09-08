# MiniPhone - Telegram SIP Telephony App

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install knex pg @types/pg bcryptjs @types/bcryptjs jsonwebtoken @types/jsonwebtoken
```

### 2. Настройка базы данных

1. **Создайте PostgreSQL базу данных:**
```sql
CREATE DATABASE miniphone_dev;
CREATE USER miniphone_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE miniphone_dev TO miniphone_user;
```

2. **Скопируйте переменные окружения:**
```bash
cp env.example .env.local
```

3. **Отредактируйте `.env.local`:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=miniphone_dev
DB_USER=miniphone_user
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_jwt_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
# Необязательно: базовый URL Telegram Bot API.
# Задать, если api.telegram.org недоступен напрямую — указываем релей tgproxy.
# По умолчанию https://api.telegram.org
# TELEGRAM_API_BASE=http://10.0.0.5:8080
```

### 3. Запуск миграций

```bash
# Применить миграции
npm run db:migrate

# Откатить последнюю миграцию
npm run db:migrate:rollback

# Сбросить все миграции и применить заново
npm run db:reset
```

### 4. Запуск приложения

```bash
npm run dev
```

## 🏗️ Архитектура

**Next.js Full-Stack приложение:**
- Фронтенд: React + TypeScript + Tailwind CSS
- Бекенд: Next.js API Routes (встроенный сервер)
- База данных: PostgreSQL + Knex.js
- Аутентификация: JWT + Telegram Web Apps
- Деплой: Один домен для фронтенда и API

## 📁 Структура проекта

```
src/
├── database/
│   └── migrations/          # Миграции базы данных
├── lib/
│   ├── auth.ts            # Утилиты аутентификации
│   ├── database.ts        # Подключение к БД и сервисы
│   └── api.ts             # API клиент
├── pages/
│   └── api/
│       ├── auth/          # API аутентификации
│       └── sip/           # API SIP аккаунтов
├── hooks/
│   └── useAuth.ts         # React хук для аутентификации
└── pages/
    └── miniphone.tsx      # Telegram Web App
```

## 🔐 API Endpoints

**Примечание:** API роуты находятся на том же домене что и фронтенд, поэтому CORS не требуется.

### Аутентификация

- `POST /api/auth/telegram` - Аутентификация через Telegram (только для существующих пользователей)
- `GET /api/auth/verify` - Проверка токена
- `POST /api/auth/logout` - Выход из системы
- `POST /api/auth/check-user` - Проверка существования пользователя

### SIP Аккаунты

- `GET /api/sip/accounts` - Получить SIP аккаунты пользователя
- `POST /api/sip/accounts` - Создать новый SIP аккаунт

### Администрирование

- `GET /api/admin/users` - Получить список всех пользователей
- `POST /api/admin/users` - Добавить нового пользователя

## 🗄️ База данных

### Таблицы

1. **users** - Пользователи Telegram
2. **sessions** - Сессии пользователей
3. **sip_accounts** - SIP аккаунты пользователей

### Миграции

- `001_create_users_table.js` - Создание таблицы пользователей
- `002_create_sessions_table.js` - Создание таблицы сессий
- `003_create_sip_accounts_table.js` - Создание таблицы SIP аккаунтов

## 🔧 Использование

### Аутентификация в miniphone.tsx

Страница `/miniphone` автоматически проверяет аутентификацию:
- ✅ **Доступ разрешен** - если пользователь есть в базе данных
- ❌ **Доступ запрещен** - если пользователь не найден
- 🔄 **Загрузка** - во время проверки аутентификации

### Админка для управления пользователями

Доступна по адресу `/admin`:
- Просмотр всех пользователей
- Добавление новых пользователей
- Управление доступом

### В React компонентах

```typescript
import { useAuth } from '@/shared/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, loginWithTelegram, logout } = useAuth();

  const handleTelegramAuth = async () => {
    if (window.Telegram?.WebApp) {
      const initData = window.Telegram.WebApp.initData;
      const result = await loginWithTelegram(initData);
      
      if (result.success) {
        console.log('Успешная аутентификация!', result.user);
      }
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Привет, {user?.first_name}!</p>
          <button onClick={logout}>Выйти</button>
        </div>
      ) : (
        <button onClick={handleTelegramAuth}>Войти через Telegram</button>
      )}
    </div>
  );
}
```

### API клиент

```typescript
import { apiClient } from '@/lib/api';

// Получить SIP аккаунты
const accounts = await apiClient.getSipAccounts();

// Создать SIP аккаунт
const newAccount = await apiClient.createSipAccount({
  sip_username: 'user123',
  sip_password: 'password123',
  sip_server: 'sip.example.com'
});
```

## 🚀 Деплой

### Переменные окружения для продакшена

```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_NAME=miniphone_prod
JWT_SECRET=your_production_jwt_secret
TELEGRAM_BOT_TOKEN=your_production_bot_token
# Релей для Telegram Bot API (обход блокировки api.telegram.org)
TELEGRAM_API_BASE=http://10.0.0.5:8080
```

### Команды для деплоя

```bash
# Сборка приложения
npm run build

# Применение миграций на продакшене
NODE_ENV=production npm run db:migrate

# Запуск приложения
npm start
```

## 🔒 Безопасность

- JWT токены с истечением через 7 дней
- Валидация подписи Telegram данных
- Проверка времени жизни Telegram данных (24 часа)
- Сессии в базе данных с возможностью отзыва
- HTTPS обязательно для продакшена

## 📱 Telegram Web App

Приложение автоматически интегрируется с Telegram Web Apps API:
- Получение данных пользователя
- Haptic feedback
- Уведомления
- Главная кнопка Telegram
