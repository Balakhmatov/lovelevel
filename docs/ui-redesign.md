# LoveLevel UI

The production UI is rendered by `public/app.js`, styled in `public/style.css`
and embedded by `scripts/build.mjs`. This change keeps the existing Node API,
profile visibility, progression, authenticated media and Telegram flows.

## Direction

Warm off-white (#f7f5f2), warm near-black (#292329), muted aubergine (#59415d). Locally
hosted Inter Variable includes Cyrillic; its OFL license is in assets/fonts.
A charcoal-purple (#302632) level card gives progression visual weight without game ornaments.

Desktop: 220px navigation, compact page heading, flexible content and 264px
status rail. Mobile: five fixed navigation destinations, admin action in the
header, compact status card before content, safe-area spacing and readable form
fields. Main touch actions are at least 44px high. Video upload and voice recording/upload are available at every level; viewing
uses the access threshold chosen by the author.

## Screen copy

| Screen | Heading | Empty state |
| --- | --- | --- |
| Discovery | Знакомства | Нет подходящих анкет |
| Matches | Взаимные симпатии | Пока нет взаимных симпатий |
| Chats | Сообщения | Нет сообщений |
| Progress | Мой уровень | Повысить уровень (task section) |
| Profile | Мой профиль | Моя галерея (media section) |

Primary actions: Изменить фильтры, Смотреть анкеты, Сохранить изменения,
Управлять прогрессом. Demo profiles remain explicitly marked and separate from
real participants. No synthetic activity, verification marks or match counts.

## Verification

`npm run build`; Node 22 server test suite; existing native registration,
Telegram widget and cookie-blocked Mini App browser checks. Provider SDKs are
mocked only in local browser fixtures. `scripts/design-browser-qa.mjs` checks six
screens and demo cards at 320, 390, 768 and 1440px without horizontal overflow;
screenshots are local development artifacts in ignored outputs/.
