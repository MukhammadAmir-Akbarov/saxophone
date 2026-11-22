// Мелодия в простом текстовом виде: «G4 A4 B4:2 | r B4:1/2 …».
// Текст, а не массив объектов: его удобно набрать руками («Своя мелодия»),
// переслать ссылкой и проверить глазами против нот.
//
// Высота — ПИСЬМЕННАЯ (как в нотах саксофониста), строй выбирается отдельно.

import { NOTES } from '../data/notes'
import { writtenMidi } from './sound'

export interface MelodyNote {
  /** индекс в NOTES; null — пауза */
  index: number | null
  /** длительность в долях метронома */
  beats: number
  /** написано через # — показывать диезное имя */
  sharp: boolean
}

export interface ParsedMelody {
  notes: MelodyNote[]
  /** токены, которые не поняли (показываем ученику как есть) */
  errors: string[]
}

// по MIDI, а не по id: C#5 и Db5 — один клапан и один файл (db5)
const BY_MIDI = new Map(NOTES.map((n, i) => [writtenMidi(n.id), i]))
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** «1», «0.5», «1,5», «3/2» → число долей; мусор и ноль → null */
function parseBeats(s: string): number | null {
  const m = s.match(/^(\d+)\/(\d+)$/)
  const v = m ? Number(m[1]) / Number(m[2]) : Number(s.replace(',', '.'))
  // верхняя граница — защита от опечатки «G4:40» вместо «G4:4»: такая нота
  // повесила бы проигрывание на минуту
  return Number.isFinite(v) && v > 0 && v <= 16 ? v : null
}

export function parseMelody(text: string): ParsedMelody {
  const notes: MelodyNote[] = []
  const errors: string[] = []
  for (const tok of text.split(/\s+/)) {
    if (!tok || /^\|+$/.test(tok)) continue
    const [head, dur, extra] = tok.split(':')
    const beats = dur === undefined ? 1 : parseBeats(dur)
    if (beats === null || extra !== undefined) {
      errors.push(tok)
      continue
    }
    // пауза: латинская r или кириллическая «р» — узбекская раскладка в кириллице
    if (/^[rRрР]$/.test(head)) {
      notes.push({ index: null, beats, sharp: false })
      continue
    }
    // строчную b после буквы читаем как бемоль: «Bb4», «eb5»; # и ♯/♭ тоже понимаем
    const m = head.match(/^([A-Ga-g])([#♯b♭]?)(\d)$/)
    const index = m ? BY_MIDI.get(12 * (Number(m[3]) + 1) + PC[m[1].toUpperCase()] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0)) : undefined
    // вне диапазона саксофона (A3…D8) — тоже ошибка, а не тихий пропуск
    if (index === undefined) errors.push(tok)
    else notes.push({ index, beats, sharp: m![2] === '#' || m![2] === '♯' })
  }
  return { notes, errors }
}

/** сколько долей длится мелодия целиком */
export const totalBeats = (notes: MelodyNote[]) => notes.reduce((s, n) => s + n.beats, 0)

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const p = parseMelody('G4 | Bb4:2 C#5:1/2 r:0.5 Db5:1,5 X9 C5:abc A2')
  const id = (k: number) => NOTES[p.notes[k].index!].id
  console.assert(p.notes.length === 5 && id(0) === 'g_4' && id(1) === 'bb4' && p.notes[1].beats === 2, 'parseMelody basic', p)
  // C# и Db — один индекс, но имя пишется по-разному
  console.assert(id(2) === 'db5' && p.notes[2].sharp && id(4) === 'db5' && !p.notes[4].sharp && p.notes[2].beats === 0.5, 'parseMelody enh', p)
  console.assert(p.notes[3].index === null && p.notes[3].beats === 0.5 && p.notes[4].beats === 1.5, 'parseMelody rest', p)
  console.assert(p.errors.join() === 'X9,C5:abc,A2', 'parseMelody errors', p.errors)
  console.assert(totalBeats(p.notes) === 5.5, 'totalBeats')
}
