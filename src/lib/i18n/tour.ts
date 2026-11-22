// Строки обучающего тура при первом запуске. ru — источник, uz — латиница
// (кириллицу pick() выводит сам). Тексты короткие (≤ 140 знаков): новичок
// читает подсказку за пару секунд и сразу видит, на что она указывает.
export const TOUR = {
  ru: {
    next: 'Далее',
    back: 'Назад',
    done: 'Готово',
    skip: 'Пропустить',
    replayTour: 'Показать подсказки снова',
    modesTitle: 'Режимы',
    modesText: 'Таблица, Тренажёр, Гаммы, Мелодии и Трели — переключайтесь здесь между способами занятий.',
    instrumentTitle: 'Ваш саксофон',
    instrumentText: 'Выберите свой инструмент: сопрано, альт, тенор или баритон — от этого зависит звучание нот.',
    diagramTitle: 'Схема аппликатуры',
    diagramText: 'Золотые клапаны — нажаты. Нажмите ♪, чтобы послушать, как звучит нота.',
    tunerTitle: 'Тюнер',
    tunerText: 'Тюнер, длинный тон и «Играй за мной» — проверяйте строй и точность прямо с микрофона.',
    metronomeTitle: 'Метроном',
    metronomeText: 'Метроном с тренажёрами темпа: начните медленно и ускоряйтесь постепенно.',
    diaryTitle: 'Дневник',
    diaryText: 'Дневник занятий считает время, а отчёт можно отправить учителю.',
    settingsTitle: 'Настройки',
    settingsText: 'Язык, тема и настройка ля первой октавы (A4) — всё здесь.',
  },
  uz: {
    next: 'Keyingisi',
    back: 'Orqaga',
    done: 'Tayyor',
    skip: 'O‘tkazib yuborish',
    replayTour: 'Maslahatlarni qayta ko‘rsatish',
    modesTitle: 'Rejimlar',
    modesText: 'Jadval, Trenajyor, Gammalar, Kuylar va Trellar — mashg‘ulot usullari o‘rtasida shu yerda almashing.',
    instrumentTitle: 'Saksofoningiz',
    instrumentText: 'O‘z cholg‘ungizni tanlang: soprano, alt, tenor yoki bariton — notalar ovozi shunga bog‘liq.',
    diagramTitle: 'Applikatura sxemasi',
    diagramText: 'Oltin rangli klapanlar bosilgan. Nota ovozini eshitish uchun ♪ ni bosing.',
    tunerTitle: 'Tyuner',
    tunerText: 'Tyuner, uzun ton va «Mendan keyin chal» — sozlik va aniqlikni mikrofon orqali tekshiring.',
    metronomeTitle: 'Metronom',
    metronomeText: 'Temp trenajyorlari bilan metronom: sekin boshlang va asta-sekin tezlashtiring.',
    diaryTitle: 'Kundalik',
    diaryText: 'Mashg‘ulotlar kundaligi vaqtni hisoblaydi, hisobotni esa ustozga yuborish mumkin.',
    settingsTitle: 'Sozlamalar',
    settingsText: 'Til, mavzu va birinchi oktava lya (A4) sozlamasi — hammasi shu yerda.',
  },
  en: {
    next: 'Next',
    back: 'Back',
    done: 'Done',
    skip: 'Skip',
    replayTour: 'Show tips again',
    modesTitle: 'Modes',
    modesText: 'Chart, Quiz, Scales, Melodies and Trills — switch between ways to practise here.',
    instrumentTitle: 'Your saxophone',
    instrumentText: 'Pick your instrument: soprano, alto, tenor or baritone — it changes how the notes sound.',
    diagramTitle: 'Fingering diagram',
    diagramText: 'Golden keys are pressed. Tap ♪ to hear the note.',
    tunerTitle: 'Tuner',
    tunerText: 'Tuner, long tone and follow-me — check your pitch and accuracy with the microphone.',
    metronomeTitle: 'Metronome',
    metronomeText: 'Metronome with tempo trainers: start slow and speed up step by step.',
    diaryTitle: 'Diary',
    diaryText: 'The practice diary tracks your time, and you can send a report to your teacher.',
    settingsTitle: 'Settings',
    settingsText: 'Language, theme and A4 tuning — all in here.',
  },
}

// Порядок шагов по умолчанию. Ключ = значение data-tour на элементе и префикс
// строк в словаре: так лид добавляет шаг одной строкой, без новой разметки.
export const TOUR_KEYS = ['modes', 'instrument', 'diagram', 'tuner', 'metronome', 'diary', 'settings'] as const
export type TourKey = (typeof TOUR_KEYS)[number]

type TourDict = (typeof TOUR)['ru']

/** Шаги для <Tour steps>: селектор [data-tour="key"] + заголовок и текст на языке словаря. */
export function tourSteps(d: TourDict, keys: readonly TourKey[] = TOUR_KEYS) {
  return keys.map((k) => ({
    target: `[data-tour="${k}"]`,
    title: d[`${k}Title`],
    text: d[`${k}Text`],
  }))
}
