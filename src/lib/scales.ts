// Гаммы и арпеджио в письменных нотах. Строй выбирается отдельно — гамма
// «до мажор» для альта и тенора пишется одинаково, звучит по-разному.

import { NOTES } from '../data/notes'
import { writtenMidi } from './sound'

export type ScaleType = 'major' | 'minor' | 'harmonic' | 'arpMajor' | 'arpMinor' | 'chromatic'

export const SCALE_TYPES: ScaleType[] = ['major', 'minor', 'harmonic', 'arpMajor', 'arpMinor', 'chromatic']

const STEPS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  arpMajor: [0, 4, 7],
  arpMinor: [0, 3, 7],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

/** упражнение поверх гаммы: подряд, терциями, квартами, группами, трезвучиями по ступеням */
export type Pattern = 'plain' | 'thirds' | 'fourths' | 'groups3' | 'groups4' | 'triads'
export const PATTERNS: Pattern[] = ['plain', 'thirds', 'fourths', 'groups3', 'groups4', 'triads']

// Шаблон — смещения от ступени: «терции» = (0, 2): 1-3, 2-4, 3-5…
const PATTERN_STEPS: Record<Exclude<Pattern, 'plain'>, number[]> = {
  thirds: [0, 2],
  fourths: [0, 3],
  groups3: [0, 1, 2],
  groups4: [0, 1, 2, 3],
  triads: [0, 2, 4],
}

/** применить шаблон к ступеням вверх; вниз — тот же шаблон по ступеням сверху */
function applyPattern<T>(degrees: T[], p: Exclude<Pattern, 'plain'>): T[] {
  const steps = PATTERN_STEPS[p]
  const span = steps[steps.length - 1]
  const run = (d: T[]) => {
    const out: T[] = []
    for (let i = 0; i + span < d.length; i++) steps.forEach((s) => out.push(d[i + s]))
    return out
  }
  return [...run(degrees), ...run([...degrees].reverse())]
}

const isMinor = (t: ScaleType) => t === 'minor' || t === 'harmonic' || t === 'arpMinor'

// Диезные тональности (по квинтовому кругу), остальные пишем бемолями:
// в фа мажоре B♭, а не A♯; в ре мажоре F♯, а не G♭.
const SHARP_MAJOR = new Set([7, 2, 9, 4, 11, 6]) // G D A E B F♯
const SHARP_MINOR = new Set([4, 11, 6, 1, 8]) // e b f♯ c♯ g♯

/** названия тоник для выбора (как принято называть тональности) */
export const TONIC_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const TONIC_NAMES_MINOR = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B']

export const tonicName = (pc: number, type: ScaleType) => (isMinor(type) ? TONIC_NAMES_MINOR : TONIC_NAMES)[pc]

/** письменный MIDI → индекс в NOTES */
const BY_MIDI = new Map(NOTES.map((n, i) => [writtenMidi(n.id), i]))

// Нижняя граница — B♭3: у A3 нет записи и не у всех саксофонов есть клапан A.
const LOWEST = 58

export interface ScaleStep {
  index: number
  /** писать диезом (по тональности) */
  sharp: boolean
  /** вводный тон гармонического минора (всегда диезом) */
  leading?: boolean
}

/** диезная ли тональность — и для письменной, и для звучащей (у альта они разные) */
export const keyIsSharp = (pc: number, type: ScaleType) =>
  isMinor(type) ? SHARP_MINOR.has(((pc % 12) + 12) % 12) : SHARP_MAJOR.has(((pc % 12) + 12) % 12)

/**
 * Последовательность вверх и вниз. Тоника — самая низкая на инструменте,
 * чтобы две октавы помещались без альтиссимо, где это возможно.
 */
export function buildScale(pc: number, type: ScaleType, octaves: 1 | 2, pattern: Pattern = 'plain'): ScaleStep[] {
  const start = LOWEST + ((pc - LOWEST) % 12 + 12) % 12
  const sharpKey = isMinor(type) ? SHARP_MINOR.has(pc) : SHARP_MAJOR.has(pc)
  const up: ScaleStep[] = []
  for (let o = 0; o < octaves; o++) {
    STEPS[type].forEach((st, k) => {
      const index = BY_MIDI.get(start + 12 * o + st)
      // в гармоническом миноре вводный тон всегда повышенный — пишем диезом
      const leading = type === 'harmonic' && k === 6
      if (index !== undefined) up.push({ index, sharp: sharpKey || leading, leading })
    })
  }
  const top = BY_MIDI.get(start + 12 * octaves)
  if (top !== undefined) up.push({ index: top, sharp: sharpKey })
  if (pattern !== 'plain') return applyPattern(up, pattern)
  return [...up, ...up.slice(0, -1).reverse()]
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  // до мажор в одну октаву: 8 вверх + 7 вниз, начинается и кончается на C4
  const c = buildScale(0, 'major', 1)
  console.assert(c.length === 15 && NOTES[c[0].index].id === 'c_4' && NOTES[c[7].index].id === 'c_5', 'buildScale C', c)
  // фа мажор пишется бемолями, ре мажор — диезами
  console.assert(!buildScale(5, 'major', 1)[0].sharp && buildScale(2, 'major', 1)[0].sharp, 'scale spelling')
  // терции в до мажоре: C E D F E G … вверх, C A B G A F … вниз
  const th = buildScale(0, 'major', 1, 'thirds').map((s) => NOTES[s.index].flat)
  console.assert(th.slice(0, 4).join() === 'C4,E4,D4,F4' && th.slice(12, 16).join() === 'C5,A4,B4,G4', 'thirds', th)
  // группы по 3: последняя группа вверх заканчивается на верхней тонике
  const g3 = buildScale(0, 'major', 1, 'groups3').map((s) => NOTES[s.index].flat)
  console.assert(g3.length === 36 && g3[17] === 'C5', 'groups3', g3)
}
