# CLAUDE.md — Саксофон (аппликатуры)

Отдельный проект, к RoZGaR отношения не имеет. Приложение для саксофонистов: таблица аппликатур
A3–D8, тюнер, метроном, гаммы, мелодии, трели, ансамбль, игры, дневник, задания учителя, «Мой класс».

- Сайт: https://mukhammadamir-akbarov.github.io/saxophone/
- Репозиторий: MukhammadAmir-Akbarov/saxophone. В `main` лежит исходник, в `gh-pages` — собранный сайт.
- `original/` (не в git) — исходный APK 2.1 и старый Android-проект, с которых всё начиналось.

## Команды
```bash
npm install
npx vite --port 5174           # разработка
npm run build                  # сборка в dist/ (scripts/precache.mjs пишет список для service worker)
./mobile/build.sh both         # Android APK + AAB; версия в mobile/VERSION
```
Выкладка сайта: `npm run build` → скопировать `dist/` в клон ветки gh-pages (например `/tmp/sax-pages`) →
commit → `git -c http.postBuffer=524288000 push https://github.com/MukhammadAmir-Akbarov/saxophone.git HEAD:gh-pages`.
Готовность проверяется через `gh api repos/MukhammadAmir-Akbarov/saxophone/pages/builds/latest`.

## Устройство
- React 19 + TS + Vite 7 + Tailwind 3. Всё в `src/pages/Home.tsx` (режимы, панель, меню «⋯»).
- Цвета — CSS-переменные `var(--c-xxxxxx)`, светлая тема в `html.light` (index.css). Для canvas —
  `col(hex)` из `src/lib/theme.ts`. В SVG цвета задаются через style, а не атрибутами.
- Языки: ru, uz, uzc, en. `uzc` получается из `uz` транслитерацией (`src/lib/translit.ts`).
  Словари фич — `src/lib/i18n/*.ts` в виде {ru,uz,en}, читаются через `pick(dict, lang)`.
- Звук: синтезатор на Web Audio (`src/lib/sound.ts`), строй A4 (`sax.a4`). Транспозиция:
  сопрано −2, альт −9, тенор −14, баритон −21. Мелодии записаны для альта.
- Состояние хранится в localStorage с префиксом `sax.` (`usePersisted`). Ссылки на задание,
  мелодию и отчёт — base64 JSON, при чтении строго проверяются.
- Аппликатуры сверены с WFG (www.wfg.woodwind.org/sax/, открывать по http). Схема клапанов —
  `src/components/FingeringDiagram.tsx`, данные — `src/data/notes.ts`.
- Android: Capacitor 8 в `mobile/`, appId `uz.saxophone.fingerings`. Нужна Java 21 из brew
  (`openjdk@21`): Java 25 из Android Studio Gradle не понимает. Ключ подписи
  `mobile/android/release.keystore` + `keystore.properties` — не в git, держать копию вне компьютера.

## Что дальше
- `store/proverka-i-uchenikam.md` — 12 пунктов проверки на телефоне и сообщение ученикам.
- `store/google-play.md` — всё для публикации в Google Play.
- Микрофонные функции, звук ансамбля и ритм-игра на реальном телефоне ещё не проверены.
