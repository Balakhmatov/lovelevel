# LoveLevel: GitHub → VPS по таймеру

Репозиторий: https://github.com/Balakhmatov/lovelevel, production-ветка main.

## Первичная установка

Выполнить **на VPS** от root, в консоли с приглашением root@5651865-sn52307:

```sh
mkdir -p /opt/lovelevel
git clone https://github.com/Balakhmatov/lovelevel.git /opt/lovelevel/repository
bash /opt/lovelevel/repository/deploy/install-poller.sh
```

Если repository уже существует, не удалять: проверить origin и изменения, затем использовать `git pull --ff-only` и повторить установку poller. Не использовать архив и scp.

Скрипт ставит отдельные `lovelevel-deploy.service` и `lovelevel-deploy.timer`. Каждые 15 секунд таймер проверяет SHA main. Если изменений нет, приложение не перезапускается. При недоступном GitHub работающий сервис не затрагивается. Неудачный commit не повторяется по кругу; новая попытка произойдёт после нового commit.

При новом SHA исходники извлекаются в отдельный release, собираются и тестируются под пользователем `lovelevel-build`, который не имеет доступа к production SQLite/секретам. npm-пакеты для runtime и тестов не нужны. После успешных проверок отдельный root-owned installer сохраняет резервную копию SQLite, переключает только LoveLevel и проверяет `/health`; при ошибке возвращает предыдущую версию и БД. Данные сохраняются в `/var/lib/lovelevel`, маркеры и резервные копии деплоя — в root-owned `/var/lib/lovelevel-deploy`.

Обычные commits не заменяют root-owned poll/release/install scripts и service template. Их обновление требует явного повторного запуска `install-poller.sh` оператором. Nginx и DNS не меняются таймером.

## Проверка

```sh
systemctl status lovelevel-deploy.timer --no-pager -l
systemctl is-active lovelevel
curl --fail --silent http://127.0.0.1:3118/health
journalctl -u lovelevel-deploy.service -n 40 --no-pager
```

Первая установка оставляет регистрацию закрытой. После переноса анкеты/фото и проверки входа владельца включить ALLOW_REGISTRATION в `/etc/lovelevel/app.env`, подключить отдельный Nginx virtual host и HTTPS, затем переключить только lovelevel.cityai.site. Подробнее — корневой README.

Остановить только автодеплой: `systemctl disable --now lovelevel-deploy.timer`. Работающий lovelevel и остальные проекты продолжат работу.

Если нужно явно повторить исправленный установщик на том же SHA, оператор повторно запускает `install-poller.sh`; сам таймер не сбрасывает маркер неудачи. Если остался неактивный каталог release после неудачного health check, его нужно сначала осмотреть: автоматическое удаление существующего release запрещено.
