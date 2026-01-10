# CI/CD Pipeline Workflow

## Описание

Workflow для CI/CD пайплайна с этапами сборки, тестирования, деплоя и отката. Поддерживает условное выполнение этапов, параллельные задачи и обработку ошибок с автоматическим откатом.

## Архитектура

- **CodePushed** (Event) - событие push кода
- **BuildProject** (Function) - сборка проекта
- **RunTests** (Function) - запуск тестов
- **LintCode** (Function) - проверка кода линтером
- **DeployToStaging** (Function) - деплой на staging
- **RunIntegrationTests** (Function) - интеграционные тесты
- **DeployToProduction** (Function) - деплой в production
- **RollbackDeployment** (Function) - откат деплоя

## Особенности

- Условное выполнение этапов
- Параллельные задачи (тесты и линтинг)
- Обработка ошибок с откатом
- Разные окружения (staging, production)
