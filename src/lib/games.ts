// Логика детских игр: наборы нот, ритмы, оценка попадания в ритм, звёзды.
// Чистые функции — их легко проверить DEV-ассертами внизу; React и DOM здесь нет
// (кроме маленького щелчка для ритма — метрономный click() наружу не экспортирован).

import { audioCtx } from './sound'

export type GameId = 'speed' | 'rhythm' | 'keys'

// ── «Ноты на скорость» ───────────────────────────────────────────────────

/** первый уровень — только «белые» ноты от D4 до D5: их ребёнок учит первыми */
export const SPEED_L1 = ['d_4', 'e_4', 'f_4', 'g_4', 'a_4', 'b_4', 'c_5', 'd_5']
/** второй уровень — C4…F5 со всеми диезами/бемолями */
export const SPEED_L2 = ['c_4', 'db4', 'd_4', 'eb4', 'e_4', 'f_4', 'gb4', 'g_4', 'ab4', 'a_4', 'bb4', 'b_4', 'c_5', 'db5', 'd_5', 'eb5', 'e_5', 'f_5']
/** после стольких верных ответов включается второй уровень — без отдельного меню, само */
export const SPEED_LEVEL2_AT = 10
export const SPEED_SECONDS = 60

/** множитель комбо: серия 3+ даёт ×2, 6+ — ×3. Больше ×3 не даём, иначе одна серия решает всё */
export const comboMult = (streak: number) => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1)

/** случайный элемент; rnd подменяется в проверках */
export const randOf = <T>(a: readonly T[], rnd = Math.random): T => a[Math.floor(rnd() * a.length)]

/** перемешать копию (Фишер–Йетс) */
export function shuffle<T>(a: readonly T[], rnd = Math.random): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** n разных вариантов ответа, среди них верный; позиция верного случайная */
export function choices<T>(correct: T, pool: readonly T[], n: number, rnd = Math.random): T[] {
  const others = shuffle(pool.filter((x) => x !== correct), rnd).slice(0, n - 1)
  return shuffle([correct, ...others], rnd)
}

// ── «Повтори ритм» ───────────────────────────────────────────────────────

// Ритм — один такт 4/4 строкой: q — четверть, e — восьмая, h — половинка,
// r — четвертная пауза. Строкой, а не массивом объектов: так список читается глазами
// и в нём сразу видно, что сложность растёт.
export const RHYTHMS = [
  'q q q q',
  'h q q',
  'q q h',
  'q r q q',
  'e e q q q',
  'q e e q q',
  'e e e e q q',
  'q e e r q',
]
export const RHYTHM_BPM = 80 // медленно: детям 7–12 лет так легче попадать

const DUR: Record<string, number> = { q: 1, e: 0.5, h: 2, r: 1 }

export interface RhythmNote {
  /** начало, в долях от начала такта */
  at: number
  /** длительность, в долях */
  dur: number
  rest: boolean
}

export function parseRhythm(s: string): RhythmNote[] {
  let at = 0
  return s.split(' ').map((tok) => {
    const n = { at, dur: DUR[tok], rest: tok === 'r' }
    at += DUR[tok]
    return n
  })
}

/** моменты ударов (доли) — паузы не стучат */
export const onsets = (s: string) => parseRhythm(s).filter((n) => !n.rest).map((n) => n.at)

export const GOOD_MS = 120
export const OK_MS = 200
export type Hit = 'good' | 'ok' | 'miss'

/**
 * Оценить удары ребёнка. expected и taps — в одних единицах (мс, одна шкала).
 * Пары «ожидаемый удар — удар ребёнка» берём от самой близкой к самой далёкой:
 * окна ±OK_MS у соседних восьмых (375 мс на 80) перекрываются, и жадный проход
 * по порядку отдал бы поздний удар раннему ожиданию, а следующему — «мимо».
 * Лишние удары не портят hits, но снижают accuracy — иначе «долби без остановки»
 * давал бы 100%.
 */
export function judgeTaps(expected: number[], taps: number[]): { hits: Hit[]; extra: number; accuracy: number } {
  const pairs: Array<[number, number, number]> = []
  expected.forEach((e, ei) => taps.forEach((t, ti) => Math.abs(t - e) <= OK_MS && pairs.push([Math.abs(t - e), ei, ti])))
  pairs.sort((a, b) => a[0] - b[0])
  const hits: Hit[] = expected.map(() => 'miss')
  const used = new Set<number>()
  for (const [d, ei, ti] of pairs) {
    if (hits[ei] !== 'miss' || used.has(ti)) continue
    used.add(ti)
    hits[ei] = d <= GOOD_MS ? 'good' : 'ok'
  }
  const extra = taps.length - used.size
  const points = hits.reduce((s, h) => s + (h === 'good' ? 1 : h === 'ok' ? 0.5 : 0), 0)
  const accuracy = expected.length ? Math.round((100 * points) / (expected.length + extra)) : 0
  return { hits, extra, accuracy }
}

/**
 * Время аудиоклока → performance.now(). Удары пальцем меряем в performance.now
 * (event.timeStamp), а щелчки стоят по ac.currentTime. getOutputTimestamp учитывает
 * задержку вывода (момент, когда звук реально вышел из колонок); где его нет —
 * считаем «сейчас = сейчас».
 */
export function audioToPerf(t: number): number {
  const ac = audioCtx()
  const ts = ac.getOutputTimestamp?.()
  if (ts?.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.performanceTime + (t - ts.contextTime) * 1000
  }
  return performance.now() + (t - ac.currentTime) * 1000
}

/** короткий щелчок в момент at (аудиоклок). Возвращает узел — чтобы остановить при выходе */
export function tick(at: number, freq: number, volume: number, len = 0.05): OscillatorNode {
  const ac = audioCtx()
  const g = ac.createGain()
  g.connect(ac.destination)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, at + len)
  const o = ac.createOscillator()
  o.type = 'triangle'
  o.frequency.value = freq
  o.connect(g)
  o.start(at)
  o.stop(at + len + 0.02)
  return o
}

// ── «Найди клапан» ───────────────────────────────────────────────────────

/** клапаны, которые ребёнок встречает первыми; к каждому есть подсказка «какая рука/палец» */
export const KID_KEYS = ['oct', 'pD', 'l1', 'l2', 'l3', 'gsh', 'r1', 'r2', 'r3', 'eb', 'lowC', 'sBb'] as const
export type KidKey = (typeof KID_KEYS)[number]
export const KEYS_ROUNDS = 10
export const RHYTHM_ROUNDS = 8

// ── звёзды ───────────────────────────────────────────────────────────────

/** пороги на 1/2/3 звезды: очки за минуту, средняя точность ритма в %, верных из 10 */
export const STAR_AT: Record<GameId, [number, number, number]> = {
  speed: [8, 16, 25],
  rhythm: [50, 70, 85],
  keys: [5, 8, 10],
}

export const starsFor = (game: GameId, value: number) => STAR_AT[game].filter((x) => value >= x).length

if (import.meta.env?.DEV) {
  // ритмы: каждый ровно на такт 4/4
  console.assert(RHYTHMS.every((r) => parseRhythm(r).reduce((s, n) => s + n.dur, 0) === 4), 'ритм не 4 доли')
  console.assert(onsets('q r q q').join() === '0,2,3', 'onsets с паузой')
  console.assert(onsets('e e q q q').join() === '0,0.5,1,2,3', 'onsets с восьмыми')
  // оценка: точно, «почти», мимо
  const j = judgeTaps([0, 750, 1500], [30, 900, 2000])
  console.assert(j.hits.join() === 'good,ok,miss' && j.extra === 1 && j.accuracy === 38, 'judgeTaps', j)
  // один удар не засчитывается двум ожидаемым, ближний выигрывает
  const j2 = judgeTaps([0, 375], [190])
  console.assert(j2.hits.join() === 'miss,ok' && j2.extra === 0, 'judgeTaps ближний', j2)
  console.assert(judgeTaps([0, 1000], [0, 1000]).accuracy === 100, 'judgeTaps 100%')
  // «долбить без остановки» — не 100%
  console.assert(judgeTaps([0], [-150, -50, 0, 50, 150]).accuracy === 20, 'judgeTaps лишние')
  console.assert(comboMult(0) === 1 && comboMult(3) === 2 && comboMult(9) === 3, 'comboMult')
  console.assert(starsFor('keys', 10) === 3 && starsFor('keys', 4) === 0 && starsFor('speed', 16) === 2, 'starsFor')
  const c = choices('a', ['a', 'b', 'c', 'd', 'e'], 4)
  console.assert(c.length === 4 && c.includes('a') && new Set(c).size === 4, 'choices')
}
