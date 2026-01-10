# Smart Notification System

## Описание

Система умных уведомлений с условной логикой, приоритетами, группировкой и rate limiting. Определяет, когда и кому отправлять уведомления на основе правил, предпочтений пользователя и контекста.

## Архитектура

- **NotificationEvent** (Event) - событие, требующее уведомления
- **CheckUserPreferences** (Function) - проверка настроек пользователя
- **DeterminePriority** (PureFunction) - определение приоритета
- **CheckRateLimit** (Function) - проверка rate limiting
- **GroupNotifications** (PureFunction) - группировка уведомлений
- **SelectChannel** (Function) - выбор канала доставки (email, push, SMS)
- **SendNotification** (Function) - отправка уведомления

## Особенности

- Условная логика на основе предпочтений
- Приоритеты и группировка
- Rate limiting для предотвращения спама
- Множественные каналы доставки
