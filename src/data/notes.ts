// Данные аппликатур саксофона (письменные ноты, одинаковы для всех видов саксофона).
// Источник таблицы: Woodwind Fingering Guide (wfg.woodwind.org), базовые аппликатуры.
// Звуки и нотный стан извлечены из оригинального приложения Saxophone 2.1.

export type KeyId =
  | 'oct' // октавный клапан (большой палец левой руки)
  | 'pD' | 'pEb' | 'pF' // пальмовые клапаны
  | 'front' | 'bis' // передний F и бис-клапан
  | 'l1' | 'l2' | 'l3' // левая рука
  | 'r1' | 'r2' | 'r3' // правая рука
  | 'gsh' | 'csh' | 'lowB' | 'lowBb' | 'lowA' // мизинец левой руки
  | 'fsh' | 'sE' | 'sC' | 'sBb' // боковые клапаны правой руки
  | 'eb' | 'lowC' // мизинец правой руки

export interface FingeringAlt {
  /** название варианта: «бис», «с клапаном F♯» … */
  name: string
  keys: KeyId[]
}

export interface SaxNote {
  /** имя файла без расширения: c_4, db4, bb3 … */
  id: string
  /** отображаемое имя с бемолем: D♭4 */
  flat: string
  /** энгармонический эквивалент с диезом: C♯4 (null для натуральных) */
  sharp: string | null
  /** есть ли звук (mp3) */
  sound: boolean
  /** регистр */
  register: 'low' | 'second' | 'altissimo'
  /** нажатые клапаны (основная аппликатура) */
  keys: KeyId[]
  /** подсказка (например, поддуть губами) */
  hint?: string
  /** альтернативные аппликатуры */
  alts?: FingeringAlt[]
}

const L123: KeyId[] = ['l1', 'l2', 'l3']
const R123: KeyId[] = ['r1', 'r2', 'r3']

export const NOTES: SaxNote[] = [
  // ── Первая октава (малая) ─────────────────────────────────────────────
  // низкое A (только баритон): как низкое B♭ (левый мизинец B♭ + правый C) и клапан A большим пальцем
  { id: 'a_3', flat: 'A3', sharp: null, sound: false, register: 'low', keys: [...L123, 'lowBb', ...R123, 'lowC', 'lowA'], hint: 'только баритон: клапан A — большим пальцем левой руки' },
  { id: 'bb3', flat: 'B♭3', sharp: 'A♯3', sound: true, register: 'low', keys: [...L123, 'lowBb', ...R123, 'lowC'] },
  { id: 'b_3', flat: 'B3', sharp: null, sound: true, register: 'low', keys: [...L123, 'lowB', ...R123, 'lowC'] },
  { id: 'c_4', flat: 'C4', sharp: null, sound: true, register: 'low', keys: [...L123, ...R123, 'lowC'] },
  { id: 'db4', flat: 'D♭4', sharp: 'C♯4', sound: true, register: 'low', keys: [...L123, 'csh', ...R123, 'lowC'] },
  { id: 'd_4', flat: 'D4', sharp: null, sound: true, register: 'low', keys: [...L123, ...R123] },
  { id: 'eb4', flat: 'E♭4', sharp: 'D♯4', sound: true, register: 'low', keys: [...L123, ...R123, 'eb'] },
  { id: 'e_4', flat: 'E4', sharp: null, sound: true, register: 'low', keys: [...L123, 'r1', 'r2'] },
  { id: 'f_4', flat: 'F4', sharp: null, sound: true, register: 'low', keys: [...L123, 'r1'] },
  { id: 'gb4', flat: 'G♭4', sharp: 'F♯4', sound: true, register: 'low', keys: [...L123, 'r2'], alts: [{ name: 'с клапаном F♯', keys: [...L123, 'r1', 'fsh'] }] },
  { id: 'g_4', flat: 'G4', sharp: null, sound: true, register: 'low', keys: [...L123] },
  { id: 'ab4', flat: 'A♭4', sharp: 'G♯4', sound: true, register: 'low', keys: [...L123, 'gsh'], alts: [{ name: 'мизинец C♯', keys: [...L123, 'csh'] }, { name: 'мизинец B', keys: [...L123, 'lowB'] }, { name: 'мизинец B♭', keys: [...L123, 'lowBb'] }] },
  { id: 'a_4', flat: 'A4', sharp: null, sound: true, register: 'low', keys: ['l1', 'l2'] },
  { id: 'bb4', flat: 'B♭4', sharp: 'A♯4', sound: true, register: 'low', keys: ['l1', 'l2', 'sBb'], hint: 'боковое B♭', alts: [{ name: 'бис', keys: ['l1', 'bis'] }, { name: '«один и один»', keys: ['l1', 'r1'] }, { name: 'L1 + R2 (к F♯)', keys: ['l1', 'r2'] }] },
  { id: 'b_4', flat: 'B4', sharp: null, sound: true, register: 'low', keys: ['l1'] },
  { id: 'c_5', flat: 'C5', sharp: null, sound: true, register: 'low', keys: ['l2'], alts: [{ name: 'боковое C', keys: ['l1', 'sC'] }] },
  { id: 'db5', flat: 'D♭5', sharp: 'C♯5', sound: true, register: 'low', keys: [], hint: 'все клапаны открыты' },

  // ── Вторая октава (+ октавный клапан) ─────────────────────────────────
  { id: 'd_5', flat: 'D5', sharp: null, sound: true, register: 'second', keys: ['oct', ...L123, ...R123] },
  { id: 'eb5', flat: 'E♭5', sharp: 'D♯5', sound: true, register: 'second', keys: ['oct', ...L123, ...R123, 'eb'] },
  { id: 'e_5', flat: 'E5', sharp: null, sound: true, register: 'second', keys: ['oct', ...L123, 'r1', 'r2'] },
  { id: 'f_5', flat: 'F5', sharp: null, sound: true, register: 'second', keys: ['oct', ...L123, 'r1'] },
  { id: 'gb5', flat: 'G♭5', sharp: 'F♯5', sound: true, register: 'second', keys: ['oct', ...L123, 'r2'], alts: [{ name: 'с клапаном F♯', keys: ['oct', ...L123, 'r1', 'fsh'] }] },
  { id: 'g_5', flat: 'G5', sharp: null, sound: true, register: 'second', keys: ['oct', ...L123] },
  { id: 'ab5', flat: 'A♭5', sharp: 'G♯5', sound: true, register: 'second', keys: ['oct', ...L123, 'gsh'], alts: [{ name: 'мизинец C♯', keys: ['oct', ...L123, 'csh'] }, { name: 'мизинец B', keys: ['oct', ...L123, 'lowB'] }, { name: 'мизинец B♭', keys: ['oct', ...L123, 'lowBb'] }] },
  { id: 'a_5', flat: 'A5', sharp: null, sound: true, register: 'second', keys: ['oct', 'l1', 'l2'] },
  { id: 'bb5', flat: 'B♭5', sharp: 'A♯5', sound: true, register: 'second', keys: ['oct', 'l1', 'l2', 'sBb'], hint: 'боковое B♭', alts: [{ name: 'бис', keys: ['oct', 'l1', 'bis'] }, { name: '«один и один»', keys: ['oct', 'l1', 'r1'] }, { name: 'L1 + R2 (к F♯)', keys: ['oct', 'l1', 'r2'] }] },
  { id: 'b_5', flat: 'B5', sharp: null, sound: true, register: 'second', keys: ['oct', 'l1'] },
  { id: 'c_6', flat: 'C6', sharp: null, sound: true, register: 'second', keys: ['oct', 'l2'], alts: [{ name: 'боковое C', keys: ['oct', 'l1', 'sC'] }] },
  { id: 'db6', flat: 'D♭6', sharp: 'C♯6', sound: true, register: 'second', keys: ['oct'], hint: 'только октавный клапан' },
  { id: 'd_6', flat: 'D6', sharp: null, sound: true, register: 'second', keys: ['oct', 'pD'] },
  { id: 'eb6', flat: 'E♭6', sharp: 'D♯6', sound: true, register: 'second', keys: ['oct', 'pD', 'pEb'] },
  { id: 'e_6', flat: 'E6', sharp: null, sound: true, register: 'second', keys: ['oct', 'pD', 'pEb', 'sE'], alts: [{ name: 'передний F + L2 L3', keys: ['oct', 'front', 'l2', 'l3'] }] },
  { id: 'f_6', flat: 'F6', sharp: null, sound: true, register: 'second', keys: ['oct', 'pD', 'pEb', 'pF', 'sE'], alts: [{ name: 'передний F', keys: ['oct', 'front', 'l2'] }] },

  // ── Альтиссимо ─────────────────────────────────────────────────────────
  { id: 'gb6', flat: 'G♭6', sharp: 'F♯6', sound: true, register: 'altissimo', keys: ['oct', 'front', 'l2', 'sBb'], alts: [{ name: 'передний F + L2 + R1', keys: ['oct', 'front', 'l2', 'r1'] }, { name: 'L1 L2 + клапан F♯', keys: ['oct', 'l1', 'l2', 'fsh'] }, { name: 'передний F + бок. B♭', keys: ['oct', 'front', 'sBb'] }, { name: 'L1 L3 + бок. B♭ + R1', keys: ['oct', 'l1', 'l3', 'sBb', 'r1'] }, { name: 'передний F + L2 + бок. B♭ + все R', keys: ['oct', 'front', 'l2', 'sBb', 'r1', 'r2', 'r3'] }] },
  { id: 'g_6', flat: 'G6', sharp: null, sound: true, register: 'altissimo', keys: ['oct', 'l1', 'l3', 'r3'], alts: [{ name: 'L2 + R1 R2', keys: ['oct', 'l2', 'r1', 'r2'] }, { name: 'только передний F', keys: ['oct', 'front'] }, { name: 'передний F + R1', keys: ['oct', 'front', 'r1'] }, { name: 'L1 L3 + бок. B♭ + R1', keys: ['oct', 'l1', 'l3', 'sBb', 'r1'] }] },
  { id: 'ab6', flat: 'A♭6', sharp: 'G♯6', sound: true, register: 'altissimo', keys: ['oct', 'l1', 'l3'], alts: [{ name: 'L2 + R2', keys: ['oct', 'l2', 'r2'] }, { name: 'передний F + бок. E', keys: ['oct', 'front', 'sE'] }] },
  { id: 'a_6', flat: 'A6', sharp: null, sound: true, register: 'altissimo', keys: ['oct', 'l2', 'l3'], alts: [{ name: 'только пальм. D', keys: ['oct', 'pD'] }, { name: 'L2 L3 + R1 R2', keys: ['oct', 'l2', 'l3', 'r1', 'r2'] }] },
  { id: 'bb6', flat: 'B♭6', sharp: 'A♯6', sound: true, register: 'altissimo', keys: ['oct', 'l3', 'sC'], alts: [{ name: 'только L3', keys: ['oct', 'l3'] }, { name: 'пальм. D + L2 L3 + все R', keys: ['oct', 'pD', 'l2', 'l3', 'r1', 'r2', 'r3'] }] },
  { id: 'b_6', flat: 'B6', sharp: null, sound: true, register: 'altissimo', keys: ['oct', 'pD'], alts: [{ name: 'L1 + R1 R2', keys: ['oct', 'l1', 'r1', 'r2'] }, { name: 'пальм. D + бок. C B♭', keys: ['oct', 'pD', 'sC', 'sBb'] }] },
  { id: 'c_7', flat: 'C7', sharp: null, sound: true, register: 'altissimo', keys: ['oct', 'pD', 'pEb'], alts: [{ name: 'передний F + R1', keys: ['oct', 'front', 'r1'] }, { name: 'пальм. D E♭ + L3', keys: ['oct', 'pD', 'pEb', 'l3'] }] },
  { id: 'db7', flat: 'D♭7', sharp: 'C♯7', sound: true, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'sE'], alts: [{ name: 'пальм. E♭ + L1 + R1 R2', keys: ['oct', 'pEb', 'l1', 'r1', 'r2'] }, { name: 'только пальм. E♭', keys: ['oct', 'pEb'] }] },
  { id: 'd_7', flat: 'D7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'pEb', 'l1'], alts: [{ name: 'только передний F', keys: ['oct', 'front'] }, { name: 'только L2', keys: ['oct', 'l2'] }] },
  { id: 'eb7', flat: 'E♭7', sharp: 'D♯7', sound: false, register: 'altissimo', keys: ['oct', 'front', 'l2', 'r1'], alts: [{ name: 'только L3', keys: ['oct', 'l3'] }, { name: 'передний F + бок. C', keys: ['oct', 'front', 'sC'] }] },
  { id: 'e_7', flat: 'E7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'l2', 'r1', 'r2'], alts: [{ name: 'только R1 R3', keys: ['oct', 'r1', 'r3'] }, { name: 'пальм. D + L3', keys: ['oct', 'pD', 'l3'] }] },
  { id: 'f_7', flat: 'F7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'l1', 'l3', 'r1', 'r3'], alts: [{ name: 'пальм. E♭ + L1', keys: ['oct', 'pEb', 'l1'] }, { name: 'пальм. D E♭ + L2 + R1 R2', keys: ['oct', 'pD', 'pEb', 'l2', 'r1', 'r2'] }] },
  { id: 'gb7', flat: 'G♭7', sharp: 'F♯7', sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'l1', 'l3', 'r1', 'r3'], alts: [{ name: 'пальм. D E♭ + R1 R2', keys: ['oct', 'pD', 'pEb', 'r1', 'r2'] }] },
  { id: 'g_7', flat: 'G7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'l2', 'r1', 'r2'], alts: [{ name: 'L3 + бок. C + R3', keys: ['oct', 'l3', 'sC', 'r3'] }, { name: 'передний F + L2 + R1 R2', keys: ['oct', 'front', 'l2', 'r1', 'r2'] }] },
  { id: 'ab7', flat: 'A♭7', sharp: 'G♯7', sound: false, register: 'altissimo', keys: ['oct', 'l2', 'r2'], alts: [{ name: 'только 8ва', keys: ['oct'] }, { name: 'L1 + пальм. F + бок. B♭', keys: ['oct', 'l1', 'pF', 'sBb'] }] },
  { id: 'a_7', flat: 'A7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'pD', 'l2', 'l3', 'r3'], alts: [{ name: 'только передний F', keys: ['oct', 'front'] }, { name: 'все основные', keys: ['oct', ...L123, ...R123] }] },
  { id: 'bb7', flat: 'B♭7', sharp: 'A♯7', sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'l2', 'l3', 'r2', 'r3'], alts: [{ name: 'только бок. B♭', keys: ['oct', 'sBb'] }] },
  { id: 'b_7', flat: 'B7', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'pF', 'l2', 'l3', 'sE', 'sC', 'r2', 'r3'] },
  { id: 'c_8', flat: 'C8', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'l2', 'l3', 'r2', 'r3'] },
  { id: 'db8', flat: 'D♭8', sharp: 'C♯8', sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'l2', 'l3', 'r2', 'r3'], hint: 'поддуть губами от C8' },
  { id: 'd_8', flat: 'D8', sharp: null, sound: false, register: 'altissimo', keys: ['oct', 'pD', 'pEb', 'l2', 'l3', 'r2', 'r3'], hint: 'поддуть губами от C8' },
]

export const REGISTER_LABELS: Record<SaxNote['register'], string> = {
  low: 'Малая октава',
  second: 'Вторая октава',
  altissimo: 'Альтиссимо',
}

/** подписи клапанов для текстового списка */
export const KEY_LABELS: Record<KeyId, string> = {
  oct: '8ва',
  pD: 'пальм. D',
  pEb: 'пальм. E♭',
  pF: 'пальм. F',
  front: 'передний F',
  bis: 'бис',
  l1: 'L1',
  l2: 'L2',
  l3: 'L3',
  r1: 'R1',
  r2: 'R2',
  r3: 'R3',
  gsh: 'G♯ (мизинец)',
  csh: 'C♯ (мизинец)',
  lowB: 'нижнее B',
  lowBb: 'нижнее B♭',
  lowA: 'нижнее A (большой палец, баритон)',
  fsh: 'клапан F♯',
  sE: 'боковое E',
  sC: 'боковое C',
  sBb: 'боковое B♭',
  eb: 'E♭ (мизинец)',
  lowC: 'нижнее C',
}

/** путь к файлу звука (относительный — сайт может жить в подпапке, напр. GitHub Pages) */
export function audioFile(id: string): string {
  return `audio/${id}.mp3`
}

/** путь к картинке нотного стана */
export function notationFile(id: string): string {
  return `notes/${id}.png`
}
