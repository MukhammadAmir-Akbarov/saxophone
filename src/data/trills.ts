// Трели и неудобные переходы со специальными (трельными) аппликатурами.
// Берём ТОЛЬКО общепринятые приёмы из школ и таблиц трелей — лучше 18 верных,
// чем 40 сомнительных: ученик выучит неправильное движение пальцев надолго.
// Сознательно НЕ включены: бис-B♭ ⇄ C (это смена формы, а не одно движение),
// C♯5 ⇄ D5 (трельного клапана нет — только отработка), F♯ ⇄ G♯ и прочие
// трели, где у разных фирм механика разная.

import { NOTES, type KeyId } from './notes'

export interface Trill {
  id: string
  /** нижняя (исходная) нота — id из NOTES */
  from: string
  /** вторая нота трели */
  to: string
  /** аппликатура, которую держим всё время (= аппликатура ноты from) */
  base: KeyId[]
  /** клапаны, которые «качаем»: нажимаем (или отпускаем, если они уже в base) */
  move: KeyId[]
  tip: { ru: string; uz: string; en: string }
}

const L123: KeyId[] = ['l1', 'l2', 'l3']
const R123: KeyId[] = ['r1', 'r2', 'r3']

export const TRILLS: Trill[] = [
  {
    id: 'b4-c5',
    from: 'b_4',
    to: 'c_5',
    base: ['l1'],
    move: ['sC'],
    tip: {
      ru: 'Держите B и качайте боковое C ребром правой ладони — пальцы левой руки не двигаются.',
      uz: 'B ni ushlab turing va yon C klapanini o‘ng kaft qirrasi bilan bosing — chap qo‘l barmoqlari qimirlamaydi.',
      en: 'Hold B and rock the side C key with the edge of your right palm — the left fingers stay still.',
    },
  },
  {
    id: 'a4-bb4',
    from: 'a_4',
    to: 'bb4',
    base: ['l1', 'l2'],
    move: ['sBb'],
    tip: {
      ru: 'Держите A и нажимайте боковое B♭ (верхний боковой клапан) ребром правой ладони.',
      uz: 'A ni ushlab turing va yon B♭ klapanini (yuqori yon klapan) o‘ng kaft qirrasi bilan bosing.',
      en: 'Hold A and press the side B♭ key (top side key) with the edge of your right palm.',
    },
  },
  {
    id: 'g4-ab4',
    from: 'g_4',
    to: 'ab4',
    base: [...L123],
    move: ['gsh'],
    tip: {
      ru: 'Держите G и качайте клапан G♯ мизинцем левой руки. Мизинец держите низко, у самого клапана.',
      uz: 'G ni ushlab turing va G♯ klapanini chap qo‘l jimjilog‘i bilan bosing. Jimjiloqni klapanga yaqin tuting.',
      en: 'Hold G and rock the G♯ key with your left pinky. Keep the pinky low, right on the key.',
    },
  },
  {
    id: 'f4-gb4',
    from: 'f_4',
    to: 'gb4',
    base: [...L123, 'r1'],
    move: ['fsh'],
    tip: {
      ru: 'Держите F и нажимайте трельный клапан F♯ (между R2 и R3) безымянным пальцем правой руки — так чище, чем вилкой.',
      uz: 'F ni ushlab turing va F♯ trel klapanini (R2 va R3 orasida) o‘ng qo‘l nomsiz barmog‘i bilan bosing — vilkadan ko‘ra tozaroq.',
      en: 'Hold F and press the F♯ trill key (between R2 and R3) with your right ring finger — cleaner than the fork fingering.',
    },
  },
  {
    id: 'bb4-b4',
    from: 'bb4',
    to: 'b_4',
    base: ['l1', 'r1'],
    move: ['r1'],
    tip: {
      ru: 'B♭ «один и один» (L1 + R1): трель — это просто поднять и опустить R1.',
      uz: '«Bir va bir» B♭ (L1 + R1): trel — shunchaki R1 ni ko‘tarib-tushirish.',
      en: '“One-and-one” B♭ (L1 + R1): the trill is just lifting and dropping R1.',
    },
  },
  {
    id: 'c5-db5',
    from: 'c_5',
    to: 'db5',
    base: ['l2'],
    move: ['l2'],
    tip: {
      ru: 'Только средний палец левой руки (L2) поднимается и опускается — остальные пальцы рядом с клапанами, но не нажимают.',
      uz: 'Faqat chap qo‘l o‘rta barmog‘i (L2) ko‘tariladi va tushadi — qolgan barmoqlar klapan ustida, lekin bosmaydi.',
      en: 'Only the left middle finger (L2) goes up and down — keep the other fingers hovering over their keys.',
    },
  },
  {
    id: 'd4-eb4',
    from: 'd_4',
    to: 'eb4',
    base: [...L123, ...R123],
    move: ['eb'],
    tip: {
      ru: 'Держите D и качайте клапан E♭ мизинцем правой руки.',
      uz: 'D ni ushlab turing va E♭ klapanini o‘ng qo‘l jimjilog‘i bilan bosing.',
      en: 'Hold D and rock the E♭ key with your right pinky.',
    },
  },
  // ── вторая октава: те же движения + октавный клапан ──────────────────
  {
    id: 'd5-eb5',
    from: 'd_5',
    to: 'eb5',
    base: ['oct', ...L123, ...R123],
    move: ['eb'],
    tip: {
      ru: 'Как в нижней октаве: держите D с октавным клапаном и качайте E♭ мизинцем правой руки.',
      uz: 'Pastki oktavadagidek: D ni oktava klapani bilan ushlab, E♭ ni o‘ng jimjiloq bilan bosing.',
      en: 'Same as the low octave: hold D with the octave key and rock E♭ with your right pinky.',
    },
  },
  {
    id: 'g5-ab5',
    from: 'g_5',
    to: 'ab5',
    base: ['oct', ...L123],
    move: ['gsh'],
    tip: {
      ru: 'То же движение, что G4–A♭4, но с октавным клапаном.',
      uz: 'G4–A♭4 dagi harakat, faqat oktava klapani bilan.',
      en: 'Same motion as G4–A♭4, with the octave key.',
    },
  },
  {
    id: 'f5-gb5',
    from: 'f_5',
    to: 'gb5',
    base: ['oct', ...L123, 'r1'],
    move: ['fsh'],
    tip: {
      ru: 'То же, что F4–F♯4: трельный клапан F♯ безымянным пальцем правой руки.',
      uz: 'F4–F♯4 dagidek: F♯ trel klapani o‘ng nomsiz barmoq bilan.',
      en: 'Same as F4–F♯4: the F♯ trill key with your right ring finger.',
    },
  },
  {
    id: 'a5-bb5',
    from: 'a_5',
    to: 'bb5',
    base: ['oct', 'l1', 'l2'],
    move: ['sBb'],
    tip: {
      ru: 'То же, что A4–B♭4: боковое B♭ ребром правой ладони.',
      uz: 'A4–B♭4 dagidek: yon B♭ o‘ng kaft qirrasi bilan.',
      en: 'Same as A4–B♭4: side B♭ with the edge of your right palm.',
    },
  },
  {
    id: 'bb5-b5',
    from: 'bb5',
    to: 'b_5',
    base: ['oct', 'l1', 'r1'],
    move: ['r1'],
    tip: {
      ru: '«Один и один» с октавным клапаном: качается только R1.',
      uz: 'Oktava klapani bilan «bir va bir»: faqat R1 harakatlanadi.',
      en: '“One-and-one” with the octave key: only R1 moves.',
    },
  },
  {
    id: 'b5-c6',
    from: 'b_5',
    to: 'c_6',
    base: ['oct', 'l1'],
    move: ['sC'],
    tip: {
      ru: 'То же, что B4–C5: боковое C ребром правой ладони.',
      uz: 'B4–C5 dagidek: yon C o‘ng kaft qirrasi bilan.',
      en: 'Same as B4–C5: side C with the edge of your right palm.',
    },
  },
  {
    id: 'c6-db6',
    from: 'c_6',
    to: 'db6',
    base: ['oct', 'l2'],
    move: ['l2'],
    tip: {
      ru: 'Как C5–C♯5: двигается только L2, октавный клапан держите.',
      uz: 'C5–C♯5 dagidek: faqat L2 harakatlanadi, oktava klapanini ushlab turing.',
      en: 'Like C5–C♯5: only L2 moves, keep the octave key down.',
    },
  },
  // ── пальмовые клапаны ────────────────────────────────────────────────
  {
    id: 'd6-eb6',
    from: 'd_6',
    to: 'eb6',
    base: ['oct', 'pD'],
    move: ['pEb'],
    tip: {
      ru: 'Держите пальмовое D и качайте пальмовое E♭ средним пальцем левой руки. Кисть не отрывайте.',
      uz: 'Kaft D ni ushlab turing va kaft E♭ ni chap qo‘l o‘rta barmog‘i bilan bosing. Kaftni ko‘tarmang.',
      en: 'Hold palm D and rock palm E♭ with your left middle finger. Keep the hand in place.',
    },
  },
  {
    id: 'eb6-e6',
    from: 'eb6',
    to: 'e_6',
    base: ['oct', 'pD', 'pEb'],
    move: ['sE'],
    tip: {
      ru: 'Держите пальмовые D и E♭, а боковое E (нижний боковой клапан) качайте ребром правой ладони.',
      uz: 'Kaft D va E♭ ni ushlab turing, yon E (pastki yon klapan) ni o‘ng kaft qirrasi bilan bosing.',
      en: 'Hold palm D and E♭ and rock side E (lowest side key) with the edge of your right palm.',
    },
  },
  {
    id: 'e6-f6',
    from: 'e_6',
    to: 'f_6',
    base: ['oct', 'pD', 'pEb', 'sE'],
    move: ['pF'],
    tip: {
      ru: 'Держите E и качайте пальмовое F безымянным пальцем левой руки. Если неудобно — попробуйте передний F.',
      uz: 'E ni ushlab turing va kaft F ni chap qo‘l nomsiz barmog‘i bilan bosing. Noqulay bo‘lsa — oldingi F ni sinab ko‘ring.',
      en: 'Hold E and rock palm F with your left ring finger. If it feels awkward, try the front F fingering.',
    },
  },
]

const same = (a: KeyId[], b: KeyId[]) => a.length === b.length && a.every((k) => b.includes(k))
const fingerings = (id: string) => {
  const n = NOTES.find((x) => x.id === id)
  return n ? [n.keys, ...(n.alts ?? []).map((a) => a.keys)] : []
}

/** аппликатура второй ноты: клапаны move нажимаются, а если они уже в base — отпускаются */
export function toKeys(tr: Trill): KeyId[] {
  const released = tr.move.every((k) => tr.base.includes(k))
  return released ? tr.base.filter((k) => !tr.move.includes(k)) : [...tr.base, ...tr.move]
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  // каждая трель обязана совпадать с таблицей аппликатур: base — это аппликатура from,
  // base±move — аппликатура to. Опечатка в данных сразу всплывёт в консоли.
  for (const tr of TRILLS) {
    console.assert(fingerings(tr.from).some((f) => same(f, tr.base)), 'trill base ≠ from', tr.id)
    console.assert(fingerings(tr.to).some((f) => same(f, toKeys(tr))), 'trill base±move ≠ to', tr.id)
  }
}
