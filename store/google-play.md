# Google Play — всё для публикации

Файлы:
- `../Saxophone-1.2.0.aab`: загружается в «Рабочую версию» (Production) или сначала в «Внутреннее тестирование».
- `../public/img/icon-512.png`: значок 512×512.
- `feature-graphic.png`: главная картинка 1024×500.
- `screenshots/*.png`: 8 скриншотов телефона 1080×2400, сняты на Android-эмуляторе.
- Политика конфиденциальности: https://mukhammadamir-akbarov.github.io/saxophone/privacy.html

## Шаги (делаете вы)

1. **Создайте аккаунт разработчика** на https://play.google.com/console. Взнос разовый, $25. Для личного аккаунта Google попросит подтвердить личность.
2. **Создайте приложение.** Тип «Приложение», бесплатное. Язык по умолчанию — русский.
3. **Новым личным аккаунтам Google требует закрытый тест.** Не меньше 12 тестировщиков в течение 14 дней. Удобно позвать в тест учеников: их адреса Gmail вносятся в список тестировщиков.
4. **Включите «Подписание приложений Google Play»** (предлагается при первой загрузке). Тогда наш ключ станет ключом загрузки, и если его потерять, его можно сбросить через поддержку.
5. **Заполните разделы ниже**, загрузите AAB и отправьте на проверку.

## Описание (ru)

**Название (до 30 символов):** Саксофон — аппликатуры

**Краткое описание (до 80):** Аппликатуры, тюнер, метроном, гаммы, мелодии и игры для саксофонистов

**Полное описание:**

Интерактивная таблица аппликатур саксофона и всё для ежедневных занятий в одном приложении. Работает без интернета, без рекламы и регистрации.

• 54 ноты от A3 до D8: схема клапанов, нотный стан и звук, основные и альтернативные аппликатуры (сверены с Woodwind Fingering Guide)
• Сопрано, альт, тенор, баритон: «пишется / звучит» для каждого строя
• Тюнер, «Длинный тон» с графиком высоты, «Сыграй за мной»
• Метроном: размеры, ударения, дробление, разгон темпа, пропуск тактов, таймер
• Гаммы и арпеджио, терции, кварты, группы, бурдон
• 11 мелодий с аккомпанементом; микрофон проверяет каждую ноту
• Трели и быстрые переходы
• Ансамбль на три голоса: каждый играет свою партию на своём саксофоне
• Тренажёр аппликатур, «какая нота» и «на слух»; повтор ошибок
• Игры для детей: ноты на скорость, повтори ритм, найди клапан
• Дневник занятий, программы на несколько недель, задания учителя по ссылке, «Мой класс» для учителя
• Запись себя с графиком высоты, запись своих нот
• Русский, узбекский (латиница и кириллица), английский; светлая и тёмная тема; печать таблицы в PDF

## Tavsif (uz)

**Nomi:** Saksofon — applikaturalar

**Qisqa tavsif:** Saksofonchilar uchun applikaturalar, tyuner, metronom, gammalar, kuylar va o‘yinlar

**To‘liq tavsif:** Saksofon applikaturalarining interaktiv jadvali va kundalik mashg‘ulotlar uchun hamma narsa bitta ilovada. Internetsiz, reklamasiz va ro‘yxatdan o‘tmasdan ishlaydi. 54 nota (A3–D8): klapanlar sxemasi, nota yozuvi va ovoz; soprano, alt, tenor, bariton; tyuner va uzun ton grafigi; metronom; gammalar va burdon; akkompanementli 11 kuy (mikrofon har bir notani tekshiradi); trellar; uch ovozli ansambl; bolalar uchun o‘yinlar; mashg‘ulot kundaligi, dasturlar, o‘qituvchi topshiriqlari va «Mening sinfim». Rus, o‘zbek (lotin va kirill) va ingliz tillarida.

## Description (en)

**Title:** Saxophone — Fingerings

**Short description:** Fingering chart, tuner, metronome, scales, melodies and games for saxophonists

**Full description:** An interactive saxophone fingering chart plus everything for daily practice in one app. Works offline, with no ads and no sign-up. 54 notes (A3–D8) with key diagram, staff and sound; soprano, alto, tenor and baritone transposition; tuner with long-tone pitch graph and follow-me; full-featured metronome; scales, patterns and drone; 11 melodies with accompaniment and microphone note checking; trills; 3-part ensemble; kids games; practice diary, multi-week programs, teacher assignments by link and “My class”. Russian, Uzbek (Latin and Cyrillic) and English.

## Ответы в анкетах Play Console

- **Категория:** Образование (или Музыка и аудио). Теги: музыка, обучение.
- **Целевая аудитория:** 13+ (или «все возраста», если хотите для детей. Тогда Google проверяет строже, а реклама и сбор данных недопустимы, но их у нас и нет).
- **Реклама:** нет.
- **Безопасность данных (Data safety):**
  - Собирает ли приложение данные — **нет**.
  - Передаёт ли третьим лицам — **нет**.
  - Микрофон: звук обрабатывается только на устройстве и не собирается. Такое обращение к микрофону собранными данными не считается.
- **Доступ к приложению:** все функции доступны без входа.
- **Возрастной рейтинг (IARC):** без насилия и без пользовательского общения, ожидаемо «3+ / Для всех».
- **Разрешения:** RECORD_AUDIO нужен для тюнера и записи. Объяснение для анкеты: «Тюнер и проверка нот слушают инструмент; звук не сохраняется и не передаётся».

## Обновления

1. Поднимите версию в `mobile/VERSION`, например 1.2.1.
2. Соберите: `./mobile/build.sh both`.
3. Загрузите новый `Saxophone-<версия>.aab` в Play Console.
