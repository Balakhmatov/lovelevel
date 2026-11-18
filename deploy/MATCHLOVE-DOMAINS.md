# MatchLove: новый адрес и переадресации

Подготовленная конфигурация: `deploy/matchlove-domains.conf`. Это серверная настройка, а не автоматическое изменение доменов при очередном Git-деплое. Файл не активируется приложением.

## Адреса

| Адрес | После переключения |
| --- | --- |
| `https://matchlove.cityai.site` | MatchLove, существующий сервис на `127.0.0.1:3118` и существующая база |
| `https://lovelevel.cityai.site/*` | Временная переадресация 302 на новый домен, путь и параметры сохранены |
| `https://cityai.site/*` | Временная переадресация 302 на главную нового домена; включает `/app` и старые страницы Quorum |
| `https://stage.cityai.site` | Существующая игра, без изменений |
| `https://pulse.cityai.site` | Отдельный «Бизнес Пульс», без изменений |

Постоянные переадресации и wildcard-домены не используются во время теста. Другие хосты сначала проверяются по действующей конфигурации VPS.

## Порядок переключения на VPS

1. Получить реальный список Nginx vhost и DNS. Сохранить резервные копии активных конфигураций и `/etc/lovelevel/app.env` в root-only каталоге. Не печатать содержимое env-файлов, в них могут быть секреты. Не отключать общий vhost-файл, если в нём также находится `stage.cityai.site` или другой сервис.
2. Создать DNS-запись `matchlove.cityai.site` на тот же VPS, что обслуживает `lovelevel.cityai.site`. При наличии AAAA проверить и IPv6. Дождаться DNS; не выпускать сертификат до этого.
3. Обеспечить доступность HTTP для нового имени через отдельный временный vhost. Выпустить бесплатный сертификат Let’s Encrypt, покрывающий три точных имени: `matchlove.cityai.site`, `lovelevel.cityai.site`, `cityai.site`. На сервере с установленным Certbot Nginx plugin используется:

   ```sh
   certbot certonly --nginx --cert-name matchlove.cityai.site \
     -d matchlove.cityai.site -d lovelevel.cityai.site -d cityai.site
   ```

   Сертификат нужен и на старых HTTPS-адресах: редирект выполняется после TLS-соединения. Убедиться, что Certbot renewal timer активен. Если используется webroot-обновление сертификатов, все HTTP challenge-пути в шаблоне обслуживаются из `/var/www/lovelevel-acme`.
4. Установить подготовленные server blocks вместо старых blocks только для этих трёх имён. Не оставлять дубликаты `server_name`; не удалять файлы stage и Pulse. Не менять upstream игры и её deploy timer. До применения выполнить `nginx -t`.
5. Заменить только `PUBLIC_ORIGIN` в `/etc/lovelevel/app.env` на `https://matchlove.cityai.site`, сохранив остальные переменные. Это необходимо для проверки Origin при входе, регистрации и загрузке фотографий. Перезапустить только `lovelevel`, затем выполнить `systemctl reload nginx`. Код и SQLite переносить не нужно.
6. Проверить `/health` на новом домене, вход, регистрацию, загрузку фото и поиск. Проверить `Location` для `cityai.site`, `cityai.site/app` и `lovelevel.cityai.site`, а также работоспособность stage и Pulse. Сессии старого домена не переносятся через redirect: потребуется повторный вход, но аккаунты и фото сохраняются.
7. Если используется Telegram, обновить домен Login Widget в BotFather, URL Mini App и webhook на новый origin. Скрипты настройки Telegram читают текущий `PUBLIC_ORIGIN`, не хранят токен в Git.

При ошибке вернуть резервные копии конфигураций Nginx и app.env, проверить `nginx -t`, перезапустить только `lovelevel` и сделать graceful reload Nginx. Базы данных и release приложения переключение домена не затрагивает.
