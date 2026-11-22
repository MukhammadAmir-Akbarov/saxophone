// Готовые программы занятий: несколько недель, каждая неделя — обычное «задание» (Task).
// Так неделя открывается той же карточкой TaskPanel и тем же разбором, что и задание по ссылке:
// второго формата заданий в приложении не появляется.
// Ноты — письменные (как в таблице аппликатур), поэтому программы одинаковы для альта и тенора.

import { MELODIES } from './melodies'
import { NOTES } from './notes'
import { TRILLS } from './trills'
import type { Lang } from '../lib/i18n'
import { PATTERNS, SCALE_TYPES } from '../lib/scales'
import { decodeTask, encodeTask, MAX_ITEMS, type Task, type TaskItem } from '../lib/task'
import { toCyrillic } from '../lib/translit'

/** текст на трёх языках; кириллицу узбекского выводим из латиницы, как в pick() */
export type L3 = { ru: string; uz: string; en: string }

export interface ProgramWeek {
  title: L3
  items: TaskItem[]
}

export interface Program {
  id: string
  /** ключ уровня в словаре экрана (levelBeginner / levelIntermediate / levelAll) */
  level: 'beginner' | 'intermediate' | 'all'
  title: L3
  desc: L3
  weeks: ProgramWeek[]
}

export const loc = (l: L3, lang: Lang) => (lang === 'uzc' ? toCyrillic(l.uz) : l[lang])

// тоники гамм — номер ступени от C (как в scales.ts): C=0, D=2, F=5, G=7, B♭=10
const C = 0, D = 2, F = 5, G = 7, BB = 10

const long = (note: string, min: number): TaskItem => ({ k: 'long', note, min })
const scale = (tonic: number, bpm: number, min: number, pattern?: string): TaskItem =>
  pattern ? { k: 'scale', tonic, type: 'major', octaves: 1, pattern, bpm, min } : { k: 'scale', tonic, type: 'major', octaves: 1, bpm, min }
const melody = (id: string): TaskItem => ({ k: 'melody', id })
const trill = (id: string): TaskItem => ({ k: 'trill', id })
const metro = (bpm: number, min: number): TaskItem => ({ k: 'metro', bpm, beats: 4, min })
const quiz = (kind: 'fingering' | 'name' | 'ear', count: number): TaskItem => ({ k: 'quiz', kind, count })

export const PROGRAMS: Program[] = [
  {
    id: 'firstMonth',
    level: 'beginner',
    title: { ru: 'Первый месяц', uz: 'Birinchi oy', en: 'First month' },
    desc: {
      ru: 'Ровный звук на G, A, B, гамма до мажор и четыре первые мелодии. Темп растёт с 60 до 80.',
      uz: 'G, A, B notalarida tekis tovush, do major gammasi va dastlabki to‘rtta kuy. Temp 60 dan 80 gacha oshadi.',
      en: 'A steady tone on G, A, B, the C major scale and the first four tunes. Tempo grows from 60 to 80.',
    },
    weeks: [
      {
        // первая неделя — только три ноты левой руки: на них проще всего поставить амбушюр
        title: { ru: 'Звук: G, A, B', uz: 'Tovush: G, A, B', en: 'Tone: G, A, B' },
        items: [long('g_4', 3), long('a_4', 3), long('b_4', 3), melody('hotCrossBuns'), quiz('fingering', 10), metro(60, 5)],
      },
      {
        title: { ru: 'Гамма до мажор медленно', uz: 'Do major gammasi sekin', en: 'C major scale, slowly' },
        items: [long('g_4', 3), long('a_4', 3), long('b_4', 3), scale(C, 60, 5), melody('maryLamb'), quiz('fingering', 15), metro(66, 5)],
      },
      {
        title: { ru: 'Правая рука: Twinkle', uz: 'O‘ng qo‘l: Twinkle', en: 'Right hand: Twinkle' },
        items: [long('g_4', 2), long('d_4', 3), scale(C, 70, 5), melody('twinkle'), quiz('name', 15), metro(72, 5)],
      },
      {
        // итог месяца: «Ода к радости» собирает всё пройденное, темп — рабочие 80
        title: { ru: 'Итог: «Ода к радости»', uz: 'Yakun: «Shodlik qasidasi»', en: 'Wrap-up: Ode to Joy' },
        items: [long('g_4', 2), long('c_5', 3), scale(C, 80, 5), melody('twinkle'), melody('odeToJoy'), quiz('fingering', 20), metro(80, 5)],
      },
    ],
  },
  {
    id: 'scalesTech',
    level: 'intermediate',
    title: { ru: 'Гаммы и техника', uz: 'Gammalar va texnika', en: 'Scales and technique' },
    desc: {
      ru: 'По кварто-квинтовому кругу: C, G, F, D, B♭. Терции, группы по три и трели, темп каждую неделю выше.',
      uz: 'Kvarta-kvinta doirasi bo‘yicha: C, G, F, D, B♭. Tersiyalar, uchtadan guruhlar va trellar, temp har hafta oshadi.',
      en: 'Around the circle: C, G, F, D, B♭. Thirds, groups of three and trills, a faster tempo every week.',
    },
    weeks: [
      // новая тональность сначала ровно, потом с упражнением на прошлой — пальцы уже её знают
      {
        title: { ru: 'До и соль мажор', uz: 'Do va sol major', en: 'C and G major' },
        items: [long('g_4', 3), scale(C, 80, 4), scale(G, 80, 4), scale(C, 66, 4, 'thirds'), trill('b4-c5'), metro(80, 3)],
      },
      {
        title: { ru: 'Фа мажор, терции', uz: 'Fa major, tersiyalar', en: 'F major, thirds' },
        items: [long('f_4', 3), scale(F, 88, 4), scale(G, 72, 4, 'thirds'), scale(C, 72, 4, 'groups3'), trill('a4-bb4'), metro(88, 3)],
      },
      {
        title: { ru: 'Ре мажор, группы по три', uz: 'Re major, uchtadan guruhlar', en: 'D major, groups of three' },
        items: [long('d_5', 3), scale(D, 92, 4), scale(F, 80, 4, 'thirds'), scale(G, 80, 4, 'groups3'), trill('g4-ab4'), trill('f4-gb4'), metro(92, 3)],
      },
      {
        title: { ru: 'Си-бемоль мажор, весь круг', uz: 'Si-bemol major, butun doira', en: 'B♭ major, the whole circle' },
        items: [
          long('b_4', 3),
          scale(BB, 100, 4),
          scale(D, 88, 4, 'thirds'),
          scale(F, 88, 4, 'groups3'),
          scale(C, 112, 3),
          scale(G, 112, 3),
          trill('bb4-b4'),
          trill('c5-db5'),
          metro(100, 3),
        ],
      },
    ],
  },
  {
    id: 'earPitch',
    level: 'all',
    title: { ru: 'Слух и строй', uz: 'Eshitish va sozlik', en: 'Ear and intonation' },
    desc: {
      ru: 'Длинные тоны под тюнер, гаммы под бурдон и тренажёр «на слух». Три недели, чтобы попадать в ноту.',
      uz: 'Tyuner ostida uzun tovushlar, burdon ostida gammalar va «eshitib» trenajyori. Notaga tushish uchun uch hafta.',
      en: 'Long tones with the tuner, scales over a drone and the ear quiz. Three weeks to play in tune.',
    },
    weeks: [
      // отдельного пункта «бурдон» в заданиях нет — подсказываем его в названии недели
      {
        title: { ru: 'Тюнер: G, A, D', uz: 'Tyuner: G, A, D', en: 'Tuner: G, A, D' },
        items: [long('g_4', 4), long('a_4', 4), long('d_5', 4), scale(C, 60, 5), quiz('ear', 10)],
      },
      {
        title: { ru: 'Гаммы под бурдон', uz: 'Burdon ostida gammalar', en: 'Scales over a drone' },
        items: [long('f_4', 4), long('c_5', 4), scale(G, 66, 5), scale(F, 66, 5), quiz('ear', 15)],
      },
      {
        // крайние ноты регистров строят хуже всего — на них и заканчиваем
        title: { ru: 'Края регистров + бурдон', uz: 'Registr chetlari + burdon', en: 'Register edges + drone' },
        items: [long('d_4', 4), long('e_5', 4), long('b_4', 3), scale(D, 72, 5), { k: 'scale', tonic: C, type: 'arpMajor', octaves: 1, bpm: 72, min: 4 }, quiz('ear', 20)],
      },
    ],
  },
  {
    id: 'performance',
    level: 'all',
    title: { ru: 'Подготовка к выступлению', uz: 'Chiqishga tayyorgarlik', en: 'Getting ready to perform' },
    desc: {
      ru: 'Две недели перед концертом: разыгровка, гаммы и пьесы в концертном темпе под метроном.',
      uz: 'Konsertdan oldingi ikki hafta: qizdirish, gammalar va asarlar konsert tempida metronom ostida.',
      en: 'Two weeks before a concert: warm-up, scales and pieces at performance tempo with a metronome.',
    },
    weeks: [
      {
        title: { ru: 'Разыгровка и пьесы', uz: 'Qizdirish va asarlar', en: 'Warm-up and pieces' },
        items: [long('g_4', 3), long('d_5', 3), scale(C, 92, 3), scale(G, 92, 3), melody('amazingGrace'), melody('saints'), metro(72, 10)],
      },
      {
        // вторая неделя — «прогон»: темп как на сцене и без остановок
        title: { ru: 'Прогон в концертном темпе', uz: 'Konsert tempida prog‘on', en: 'Run-through at tempo' },
        items: [long('g_4', 3), scale(F, 100, 3), scale(BB, 100, 3), melody('amazingGrace'), melody('saints'), melody('jingleBells'), metro(96, 10)],
      },
    ],
  },
]

export const findProgram = (id: string) => PROGRAMS.find((p) => p.id === id)

/** неделя программы → обычное задание на нужном языке; weekIndex с нуля */
export function programWeekTask(program: Program, weekIndex: number, lang: Lang): Task {
  const w = program.weeks[weekIndex]
  return {
    title: `${loc(program.title, lang)} · ${weekIndex + 1}. ${loc(w.title, lang)}`,
    // копии: отметки «сделано» ставятся прямо в items, а справочник должен остаться чистым
    items: w.items.map((it) => ({ ...it })),
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const ids = {
    melody: new Set(MELODIES.map((m) => m.id)),
    trill: new Set(TRILLS.map((t) => t.id)),
    note: new Set(NOTES.map((n) => n.id)),
  }
  // ключи у decodeTask идут в своём порядке, поэтому сравниваем по полям, а не строкой
  const same = (a: object, b: object) => {
    const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>
    return Object.keys(ra).length === Object.keys(rb).length && Object.keys(ra).every((k) => ra[k] === rb[k])
  }
  for (const p of PROGRAMS) {
    console.assert([p.title, p.desc].every((l) => l.ru && l.uz && l.en), 'program l10n', p.id)
    p.weeks.forEach((w, wi) => {
      console.assert(w.items.length <= MAX_ITEMS && !!(w.title.ru && w.title.uz && w.title.en), 'program week', p.id, wi)
      // название задания режется на 80 символов при передаче ссылкой — держим запас
      console.assert(programWeekTask(p, wi, 'ru').title!.length <= 80, 'program title length', p.id, wi)
      for (const it of w.items) {
        const ok =
          it.k === 'melody' || it.k === 'trill'
            ? ids[it.k].has(it.id)
            : it.k === 'long' || it.k === 'note'
              ? ids.note.has(it.note)
              : it.k === 'scale'
                ? SCALE_TYPES.includes(it.type) && (!it.pattern || PATTERNS.includes(it.pattern as never))
                : true
        console.assert(ok, 'program unknown id', p.id, wi, it)
        // пункт обязан пережить упаковку в ссылку без изменений — иначе «поделиться неделей» её исказит
        const back = decodeTask(encodeTask({ items: [it] }))?.items[0]
        console.assert(!!back && same(it, back), 'program round-trip', p.id, wi, it, back)
      }
    })
  }
}
