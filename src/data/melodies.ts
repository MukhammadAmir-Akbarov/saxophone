// Мелодии для разучивания. Только общественное достояние (народные, детские,
// гимны XVIII–XIX вв., Бетховен; Happy Birthday — без авторских прав в США
// с 2016 г. и в ЕС с 2017 г.). Узбекские мелодии НЕ добавлены: у многих
// известных песен есть живые авторы — права нужно проверить отдельно.
//
// Высота письменная, тональности выбраны так, чтобы почти всё лежало в D4…D5
// (без октавного клапана и мизинцев) — удобно в первый год.
// Затакт (pickup): добиваем такт паузой «r» спереди, чтобы сильная доля
// метронома совпала с сильной долей мелодии.
//
// Формат — см. src/lib/melody.ts. Каждую мелодию проверяли «напеванием» по слогам.

import type { Lang } from '../lib/i18n'
import { toCyrillic } from '../lib/translit'
import { parseMelody, totalBeats } from '../lib/melody'

export interface Melody {
  id: string
  title: { ru: string; uz: string; en: string }
  /** долей в такте — для отсчёта и ударений метронома */
  meter: number
  /** темп по умолчанию, уд/мин */
  bpm: number
  /** 1 — первые недели, 3 — пунктир и восьмые */
  level: 1 | 2 | 3
  text: string
}

export const MELODIES: Melody[] = [
  {
    id: 'hotCrossBuns',
    title: { ru: 'Горячие булочки', uz: 'Issiq bulochkalar', en: 'Hot Cross Buns' },
    meter: 4,
    bpm: 90,
    level: 1,
    // классика первого урока: только B–A–G
    text: 'B4 A4 G4:2 | B4 A4 G4:2 | G4:0.5 G4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 A4:0.5 A4:0.5 | B4 A4 G4:2',
  },
  {
    id: 'maryLamb',
    title: { ru: 'У Мэри был барашек', uz: 'Merining qo‘zichog‘i', en: 'Mary Had a Little Lamb' },
    meter: 4,
    bpm: 100,
    level: 1,
    text: 'B4 A4 G4 A4 | B4 B4 B4:2 | A4 A4 A4:2 | B4 D5 D5:2 | B4 A4 G4 A4 | B4 B4 B4 B4 | A4 A4 B4 A4 | G4:4',
  },
  {
    id: 'auClair',
    title: { ru: 'При свете луны (Au clair de la lune)', uz: 'Oy yorug‘ida (Au clair de la lune)', en: 'Au clair de la lune' },
    meter: 4,
    bpm: 90,
    level: 1,
    text:
      'G4 G4 G4 A4 | B4:2 A4:2 | G4 B4 A4 A4 | G4:4 | G4 G4 G4 A4 | B4:2 A4:2 | G4 B4 A4 A4 | G4:4 | ' +
      'A4 A4 A4 A4 | E4:2 E4:2 | A4 G4 F#4 E4 | D4:4 | G4 G4 G4 A4 | B4:2 A4:2 | G4 B4 A4 A4 | G4:4',
  },
  {
    id: 'twinkle',
    title: { ru: 'Мерцай, звёздочка', uz: 'Miltilla, yulduzcha', en: 'Twinkle, Twinkle, Little Star' },
    meter: 4,
    bpm: 90,
    level: 2,
    // фа мажор: первое знакомство с B♭
    text:
      'F4 F4 C5 C5 | D5 D5 C5:2 | Bb4 Bb4 A4 A4 | G4 G4 F4:2 | C5 C5 Bb4 Bb4 | A4 A4 G4:2 | ' +
      'C5 C5 Bb4 Bb4 | A4 A4 G4:2 | F4 F4 C5 C5 | D5 D5 C5:2 | Bb4 Bb4 A4 A4 | G4 G4 F4:2',
  },
  {
    id: 'frereJacques',
    title: { ru: 'Братец Жак (Frère Jacques)', uz: 'Jak aka (Frère Jacques)', en: 'Frère Jacques' },
    meter: 4,
    bpm: 100,
    level: 2,
    text:
      'G4 A4 B4 G4 | G4 A4 B4 G4 | B4 C5 D5:2 | B4 C5 D5:2 | ' +
      'D5:0.5 E5:0.5 D5:0.5 C5:0.5 B4 G4 | D5:0.5 E5:0.5 D5:0.5 C5:0.5 B4 G4 | G4 D4 G4:2 | G4 D4 G4:2',
  },
  {
    id: 'odeToJoy',
    title: { ru: 'Ода к радости (Бетховен)', uz: 'Shodlik qasidasi (Betxoven)', en: 'Ode to Joy (Beethoven)' },
    meter: 4,
    bpm: 100,
    level: 2,
    text:
      'B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | B4:1.5 A4:0.5 A4:2 | ' +
      'B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | A4:1.5 G4:0.5 G4:2 | ' +
      'A4 A4 B4 G4 | A4 B4:0.5 C5:0.5 B4 G4 | A4 B4:0.5 C5:0.5 B4 A4 | G4 A4 D4:2 | ' +
      'B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | A4:1.5 G4:0.5 G4:2',
  },
  {
    id: 'londonBridge',
    title: { ru: 'Лондонский мост', uz: 'London ko‘prigi', en: 'London Bridge' },
    meter: 4,
    bpm: 100,
    level: 2,
    text:
      'D5:1.5 E5:0.5 D5 C5 | B4 C5 D5:2 | A4 B4 C5:2 | B4 C5 D5:2 | ' +
      'D5:1.5 E5:0.5 D5 C5 | B4 C5 D5:2 | A4:2 D5:2 | B4 G4:3',
  },
  {
    id: 'saints',
    title: { ru: 'When the Saints Go Marching In', uz: 'When the Saints Go Marching In', en: 'When the Saints Go Marching In' },
    meter: 4,
    bpm: 110,
    level: 2,
    // затакт в три доли: «Oh when the | saints»
    text:
      'r G4 B4 C5 | D5:4 | r G4 B4 C5 | D5:4 | r G4 B4 C5 | D5:2 B4:2 | G4:2 B4:2 | A4:4 | ' +
      'r B4 B4 A4 | G4:3 G4 | B4:2 D5 D5 | D5 C5:3 | r B4 C5 D5 | B4:2 G4:2 | A4:4 | G4:4',
  },
  {
    id: 'jingleBells',
    title: { ru: 'Jingle Bells (припев)', uz: 'Jingle Bells (naqarot)', en: 'Jingle Bells (chorus)' },
    meter: 4,
    bpm: 120,
    level: 3,
    text:
      'B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:0.5 | B4:4 | ' +
      'C5 C5 C5:1.5 C5:0.5 | C5 B4 B4 B4:0.5 B4:0.5 | B4 A4 A4 B4 | A4:2 D5:2 | ' +
      'B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:0.5 | B4:4 | ' +
      'C5 C5 C5:1.5 C5:0.5 | C5 B4 B4 B4:0.5 B4:0.5 | D5 D5 C5 A4 | G4:4',
  },
  {
    id: 'happyBirthday',
    title: { ru: 'С днём рождения', uz: 'Tug‘ilgan kuning bilan', en: 'Happy Birthday' },
    meter: 3,
    bpm: 90,
    level: 3,
    // затакт «Hap-py» — пунктир: 3/4 + 1/4 доли
    text:
      'r:2 D4:0.75 D4:0.25 | E4 D4 G4 | F#4:2 D4:0.75 D4:0.25 | E4 D4 A4 | G4:2 D4:0.75 D4:0.25 | ' +
      'D5 B4 G4 | F#4 E4 C5:0.75 C5:0.25 | B4 G4 A4 | G4:3',
  },
  {
    id: 'amazingGrace',
    title: { ru: 'Amazing Grace', uz: 'Amazing Grace', en: 'Amazing Grace' },
    meter: 3,
    bpm: 72,
    level: 3,
    // «me» тянется через тактовую черту (лига) — одна нота на 5 долей, без повторной атаки
    text:
      'r:2 D4 | G4:2 B4:0.5 G4:0.5 | B4:2 A4 | G4:2 E4 | D4:2 D4 | G4:2 B4:0.5 G4:0.5 | B4:2 A4 | D5:5 B4 | ' +
      'D5:2 B4:0.5 G4:0.5 | B4:2 A4 | G4:2 E4 | D4:2 D4 | G4:2 B4:0.5 G4:0.5 | B4:2 A4 | G4:3',
  },
]

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  // каждая мелодия разбирается без ошибок и укладывается в целое число тактов —
  // ловит опечатку в длительности, которая сдвинула бы всё после неё
  for (const m of MELODIES) {
    const p = parseMelody(m.text)
    console.assert(p.errors.length === 0, 'melody errors', m.id, p.errors)
    console.assert(totalBeats(p.notes) % m.meter === 0, 'melody bars', m.id, totalBeats(p.notes))
  }
}

/**
 * Название на нужном языке. Для узбекской кириллицы транслитерируем только
 * узбекские слова: «Amazing Grace» или «(Au clair de la lune)» — имена собственные
 * на чужом языке, кириллицей они превратились бы в абракадабру.
 */
export function melodyTitle(m: Melody, lang: Lang): string {
  if (lang !== 'uzc') return m.title[lang]
  if (m.title.uz === m.title.en) return m.title.uz
  // текст в скобках — оригинальное название, оставляем как есть
  return m.title.uz.replace(/^[^(]*/, (head) => toCyrillic(head))
}
