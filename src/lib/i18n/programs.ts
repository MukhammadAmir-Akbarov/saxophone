// Строки экрана «Программы занятий». Названия и описания самих программ живут в data/programs.ts.
// Числа подставляются через {1}: буквенный плейсхолдер испортила бы транслитерация в кириллицу.

const ru = {
  title: 'Программы занятий',
  replaceTask: 'Сейчас открыто задание учителя, и оно не выполнено. Заменить его неделей программы?',
  intro: 'Готовый план на несколько недель. Каждая неделя — задание с отметками, как от учителя.',
  weeks: '{1} нед.',
  week: 'Неделя {1}',
  levelBeginner: 'Начинающим',
  levelIntermediate: 'Продолжающим',
  levelAll: 'Любой уровень',
  start: 'Начать неделю {1}',
  next: 'Следующая неделя',
  current: 'Сейчас',
  back: 'Ко всем программам',
}

const uz: typeof ru = {
  title: 'Mashg‘ulot dasturlari',
  replaceTask: 'Hozir o‘qituvchining topshirig‘i ochiq va bajarilmagan. Uni dastur haftasi bilan almashtiraymi?',
  intro: 'Bir necha haftaga tayyor reja. Har bir hafta — o‘qituvchinikidek belgilanadigan topshiriq.',
  weeks: '{1} hafta',
  week: '{1}-hafta',
  levelBeginner: 'Boshlovchilarga',
  levelIntermediate: 'Davom ettiruvchilarga',
  levelAll: 'Har qanday daraja',
  start: '{1}-haftani boshlash',
  next: 'Keyingi hafta',
  current: 'Hozir',
  back: 'Barcha dasturlarga',
}

const en: typeof ru = {
  title: 'Practice programs',
  replaceTask: 'A teacher’s assignment is open and not finished. Replace it with this program week?',
  intro: 'A ready plan for several weeks. Each week is an assignment with checkmarks, like one from a teacher.',
  weeks: '{1} wk',
  week: 'Week {1}',
  levelBeginner: 'Beginner',
  levelIntermediate: 'Intermediate',
  levelAll: 'Any level',
  start: 'Start week {1}',
  next: 'Next week',
  current: 'Now',
  back: 'All programs',
}

export const PROGRAMS_I18N = { ru, uz, en }
