// Подписи интерфейса на русском и узбекском (латиница — её читают в школах).
// Данные нот в notes.ts остаются на русском; на узбекский их переводят функции ниже.

import type { KeyId, SaxNote } from '../data/notes'

export type Lang = 'ru' | 'uz'

const RU = {
  title: 'Саксофон — аппликатуры',
  subtitle: '54 ноты · схема клапанов · звук',
  modeTable: 'Таблица',
  modeQuiz: 'Тренажёр',
  tuner: 'Тюнер',
  instrument: 'Строй',
  soprano: 'Сопрано (B♭)',
  alto: 'Альт (E♭)',
  tenor: 'Тенор (B♭)',
  baritone: 'Баритон (E♭)',
  sharpToggle: 'Переключить диезы и бемоли',
  help: 'Как читать схему',
  langToggle: 'Сменить язык',
  longTone: 'Длинный тон',
  listen: 'Послушать ноту',
  written: 'пишется',
  sounds: 'звучит',
  synth: 'звук синтезирован',
  variants: 'Варианты аппликатуры',
  main: 'Основная',
  pressed: 'Нажато',
  allOpen: 'Все клапаны открыты',
  variant: 'вариант',
  prev: 'Предыдущая нота',
  next: 'Следующая нота',
  note: 'Нота',
  onStaff: 'на нотном стане',
  low: 'Малая октава',
  second: 'Вторая октава',
  altissimo: 'Альтиссимо',
  quizPrompt: 'Какая аппликатура у ноты?',
  quizTap: 'Нажимайте клапаны на схеме',
  check: 'Проверить',
  reveal: 'Показать ответ',
  nextQ: 'Дальше',
  clear: 'Сбросить',
  correct: 'Верно!',
  wrong: 'Не совсем',
  missing: 'не хватает',
  extra: 'лишние',
  revealed: 'Правильная аппликатура',
  score: 'Счёт',
  streak: 'Серия',
  best: 'Рекорд',
  withAltissimo: 'С альтиссимо',
  tunerHint: 'Сыграйте ноту — тюнер слушает микрофон',
  micDenied: 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
  target: 'Цель',
  inTune: 'Точно',
  flat: 'ниже',
  sharp: 'выше',
  cents: 'центов',
  semis: 'полутон.',
  close: 'Закрыть',
  silence: 'Тишина…',
  install: 'Установить',
  legendTitle: 'Как читать схему',
  legendText:
    'Закрашенные клапаны на схеме — нажатые. L1–L3 и R1–R3 — пальцы левой и правой руки, «8ва» — октавный клапан под большим пальцем левой руки.',
  legendKeys: 'Клавиши: ← → — соседняя нота, пробел — звук.',
  bis: 'Бис',
}

type Dict = typeof RU

const UZ: Dict = {
  title: 'Saksofon — applikaturalar',
  subtitle: '54 nota · klapanlar sxemasi · ovoz',
  modeTable: 'Jadval',
  modeQuiz: 'Mashq',
  tuner: 'Tyuner',
  instrument: 'Sozlanishi',
  soprano: 'Soprano (B♭)',
  alto: 'Alt (E♭)',
  tenor: 'Tenor (B♭)',
  baritone: 'Bariton (E♭)',
  sharpToggle: 'Diyez va bemollarni almashtirish',
  help: 'Sxemani qanday o‘qish kerak',
  langToggle: 'Tilni almashtirish',
  longTone: 'Uzun ton',
  listen: 'Notani tinglash',
  written: 'yoziladi',
  sounds: 'eshitiladi',
  synth: 'ovoz sintez qilingan',
  variants: 'Applikatura variantlari',
  main: 'Asosiy',
  pressed: 'Bosilgan',
  allOpen: 'Barcha klapanlar ochiq',
  variant: 'variant',
  prev: 'Oldingi nota',
  next: 'Keyingi nota',
  note: 'Nota',
  onStaff: 'nota chizig‘ida',
  low: 'Kichik oktava',
  second: 'Ikkinchi oktava',
  altissimo: 'Altissimo',
  quizPrompt: 'Bu notaning applikaturasi qanday?',
  quizTap: 'Sxemadagi klapanlarni bosing',
  check: 'Tekshirish',
  reveal: 'Javobni ko‘rsatish',
  nextQ: 'Keyingisi',
  clear: 'Tozalash',
  correct: 'To‘g‘ri!',
  wrong: 'Unchalik emas',
  missing: 'yetishmaydi',
  extra: 'ortiqcha',
  revealed: 'To‘g‘ri applikatura',
  score: 'Hisob',
  streak: 'Ketma-ket',
  best: 'Rekord',
  withAltissimo: 'Altissimo bilan',
  tunerHint: 'Notani chaling — tyuner mikrofonni tinglaydi',
  micDenied: 'Mikrofonga ruxsat yo‘q. Brauzer sozlamalarida ruxsat bering.',
  target: 'Maqsad',
  inTune: 'Aniq',
  flat: 'past',
  sharp: 'baland',
  cents: 'sent',
  semis: 'yarim ton',
  close: 'Yopish',
  silence: 'Sukunat…',
  install: 'O‘rnatish',
  legendTitle: 'Sxemani qanday o‘qish kerak',
  legendText:
    'Sxemada bo‘yalgan klapanlar — bosilganlari. L1–L3 va R1–R3 — chap va o‘ng qo‘l barmoqlari, «8va» — chap qo‘l bosh barmog‘i ostidagi oktava klapani.',
  legendKeys: 'Tugmalar: ← → — qo‘shni nota, probel — ovoz.',
  bis: 'Bis',
}

export const STRINGS: Record<Lang, Dict> = { ru: RU, uz: UZ }

const KEY_UZ: Record<KeyId, string> = {
  oct: '8va',
  pD: 'kaft D',
  pEb: 'kaft E♭',
  pF: 'kaft F',
  front: 'old F',
  bis: 'bis',
  l1: 'L1',
  l2: 'L2',
  l3: 'L3',
  r1: 'R1',
  r2: 'R2',
  r3: 'R3',
  gsh: 'G♯ (jimjiloq)',
  csh: 'C♯ (jimjiloq)',
  lowB: 'pastki B',
  lowBb: 'pastki B♭',
  lowA: 'pastki A',
  fsh: 'F♯ klapani',
  sE: 'yon E',
  sC: 'yon C',
  sBb: 'yon B♭',
  eb: 'E♭ (jimjiloq)',
  lowC: 'pastki C',
}

export function keyLabel(k: KeyId, lang: Lang, ru: Record<KeyId, string>): string {
  return lang === 'uz' ? KEY_UZ[k] : ru[k]
}

// Названия вариантов — это сочетания клапанов («пальм. D + L3»), поэтому их
// переводим заменой слов, а не отдельным словарём на 50 строк.
const WORDS_UZ: Array<[string, string]> = [
  ['с клапаном F♯', 'F♯ klapani bilan'],
  ['клапан F♯', 'F♯ klapani'],
  ['«один и один»', '«bir va bir»'],
  ['все основные', 'barcha asosiy'],
  ['все R', 'barcha R'],
  ['передний', 'old'],
  ['пальм.', 'kaft'],
  ['бок.', 'yon'],
  ['боковое', 'yon'],
  ['мизинец', 'jimjiloq'],
  ['только', 'faqat'],
  ['бис', 'bis'],
  ['8ва', '8va'],
]

const HINTS_UZ: Record<string, string> = {
  'боковое B♭': 'yon B♭',
  'вилочная аппликатура': 'vilkasimon applikatura',
  'все клапаны открыты': 'barcha klapanlar ochiq',
  'поддуть губами от C8': 'C8 dan lab bilan ko‘taring',
  'только октавный клапан': 'faqat oktava klapani',
}

export function altName(name: string, lang: Lang): string {
  if (lang === 'ru') return name
  return WORDS_UZ.reduce((s, [ru, uz]) => s.replaceAll(ru, uz), name)
}

export function hintText(note: SaxNote, lang: Lang): string | undefined {
  if (!note.hint || lang === 'ru') return note.hint
  return HINTS_UZ[note.hint] ?? note.hint
}
