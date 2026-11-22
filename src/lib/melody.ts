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

// ── транспозиция ─────────────────────────────────────────────────────────

// Письменный диапазон для сдвига: A3…F6. Выше F6 — альтиссимо, первогодку
// там нечего делать; транспонированная мелодия туда уходить не должна.
const LO = 57
const HI = 89

/**
 * Сдвинуть мелодию на semis полутонов. sharp — как писать знаки (по новой тональности).
 * Хоть одна нота вне A3…F6 → null: такой вариант ученику не предлагаем.
 * Ноль — мелодия как есть, со своим написанием (даже если автор залез в альтиссимо).
 */
export function transposeNotes(notes: MelodyNote[], semis: number, sharp: boolean): MelodyNote[] | null {
  if (!semis) return notes
  const out: MelodyNote[] = []
  for (const n of notes) {
    if (n.index === null) {
      out.push(n)
      continue
    }
    const m = writtenMidi(NOTES[n.index].id) + semis
    const index = m >= LO && m <= HI ? BY_MIDI.get(m) : undefined
    if (index === undefined) return null
    out.push({ ...n, index, sharp })
  }
  return out
}

/**
 * Реальный сдвиг для выбранной тональности: не влезает — та же тональность
 * октавой выше или ниже (−6 и +6 — одна тональность). Совсем никак — null.
 */
export function fitShift(notes: MelodyNote[], semis: number): number | null {
  if (!semis) return 0
  for (const s of [semis, semis + 12, semis - 12]) if (transposeNotes(notes, s, false)) return s
  return null
}

// ── аккорды аккомпанемента ───────────────────────────────────────────────
// Тот же текстовый формат, что у нот: «G:2 D7:2 | C Am | r:3». Буквы — письменная
// тональность (как и мелодия), в концертный строй переводит accomp.ts.

export type ChordQuality = '' | 'm' | '7' | 'm7'

export interface Chord {
  /** класс высоты корня 0…11 (C = 0); null — тишина */
  pc: number | null
  quality: ChordQuality
  beats: number
}

/** интервалы от корня: трезвучие или септаккорд */
export const CHORD_TONES: Record<ChordQuality, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
}

export function parseChords(text: string): { chords: Chord[]; errors: string[] } {
  const chords: Chord[] = []
  const errors: string[] = []
  for (const tok of text.split(/\s+/)) {
    if (!tok || /^\|+$/.test(tok)) continue
    const [head, dur, extra] = tok.split(':')
    const beats = dur === undefined ? 1 : parseBeats(dur)
    // в аккордах «b» — только бемоль после буквы (Bb), поэтому буква заглавная
    const m = head.match(/^([A-G])([#b]?)(m7|m|7)?$/)
    if (beats === null || extra !== undefined || (!m && head !== 'r')) {
      errors.push(tok)
      continue
    }
    if (!m) chords.push({ pc: null, quality: '', beats })
    else chords.push({ pc: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] ? -1 : 0) + 12) % 12, quality: (m[3] ?? '') as ChordQuality, beats })
  }
  return { chords, errors }
}

export const chordsBeats = (chords: Chord[]) => chords.reduce((s, c) => s + c.beats, 0)

// ── ссылка на свою мелодию ───────────────────────────────────────────────

export interface SharedMelody {
  title: string
  text: string
  meter?: number
  bpm?: number
}

// base64url — как в task.ts (там помощники не экспортируются): «+» и «/» ломают
// адрес, «=» не нужен; btoa понимает только латиницу, поэтому сначала UTF-8 байты.
function toB64url(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function encodeMelody(m: SharedMelody): string {
  const out: SharedMelody = { title: m.title.trim().slice(0, 80), text: m.text.slice(0, 4000) }
  if (m.meter) out.meter = m.meter
  if (m.bpm) out.bpm = m.bpm
  return toB64url(JSON.stringify(out))
}

const clampInt = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined

/** строка из ?melody= → мелодия. Ссылка чужая: всё проверяем и обрезаем, битая → null */
export function decodeMelody(s: string): SharedMelody | null {
  // потолок длины до разбора: 4000 символов текста — это ≤ ~16 КБ в base64 даже для кириллицы
  if (typeof s !== 'string' || !s || s.length > 16000 || !/^[\w-]+$/.test(s)) return null
  let raw: unknown
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.text !== 'string' || !o.text.trim()) return null
  const out: SharedMelody = { title: typeof o.title === 'string' ? o.title.slice(0, 80) : '', text: o.text.slice(0, 4000) }
  const meter = clampInt(o.meter, 2, 7)
  const bpm = clampInt(o.bpm, 20, 300)
  if (meter) out.meter = meter
  if (bpm) out.bpm = bpm
  return out
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const p = parseMelody('G4 | Bb4:2 C#5:1/2 r:0.5 Db5:1,5 X9 C5:abc A2')
  const id = (k: number) => NOTES[p.notes[k].index!].id
  console.assert(p.notes.length === 5 && id(0) === 'g_4' && id(1) === 'bb4' && p.notes[1].beats === 2, 'parseMelody basic', p)
  // C# и Db — один индекс, но имя пишется по-разному
  console.assert(id(2) === 'db5' && p.notes[2].sharp && id(4) === 'db5' && !p.notes[4].sharp && p.notes[2].beats === 0.5, 'parseMelody enh', p)
  console.assert(p.notes[3].index === null && p.notes[3].beats === 0.5 && p.notes[4].beats === 1.5, 'parseMelody rest', p)
  console.assert(p.errors.join() === 'X9,C5:abc,A2', 'parseMelody errors', p.errors)
  console.assert(totalBeats(p.notes) === 5.5, 'totalBeats')

  // транспозиция: G4 +2 → A4; D4 −6 вылезает ниже A3 → берём +6 (октавой выше)
  const g = parseMelody('G4 D4 r F#4').notes
  const up = transposeNotes(g, 2, true)!
  console.assert(NOTES[up[0].index!].id === 'a_4' && up[2].index === null && NOTES[up[3].index!].id === 'ab4' && up[3].sharp, 'transpose', up)
  console.assert(transposeNotes(g, -6, false) === null && fitShift(g, -6) === 6 && fitShift(g, 0) === 0, 'fitShift')
  console.assert(fitShift(parseMelody('A3 F6').notes, 1) === null, 'fitShift none')

  const c = parseChords('C:4 | G7:2 Am Bb:0.5 F#m7:0.5 r X Cmaj7 G:0')
  console.assert(c.chords.length === 6 && c.chords[1].pc === 7 && c.chords[1].quality === '7' && c.chords[2].quality === 'm', 'parseChords', c)
  console.assert(c.chords[3].pc === 10 && c.chords[4].pc === 6 && c.chords[4].quality === 'm7' && c.chords[5].pc === null, 'parseChords acc', c)
  console.assert(c.errors.join() === 'X,Cmaj7,G:0' && chordsBeats(c.chords) === 9, 'parseChords errors', c.errors)

  // ссылка: туда-обратно с кириллицей, чужой мусор отбрасывается, числа зажаты
  const sm = { title: 'Моя «песня»', text: 'G4 A4 | r B4:2', meter: 3, bpm: 96 }
  const enc = encodeMelody(sm)
  console.assert(/^[\w-]+$/.test(enc) && JSON.stringify(decodeMelody(enc)) === JSON.stringify(sm), 'melody link', decodeMelody(enc))
  console.assert(decodeMelody('!!!') === null && decodeMelody(toB64url('[1]')) === null && decodeMelody(toB64url('{"text":5}')) === null, 'melody link junk')
  const big = decodeMelody(toB64url(JSON.stringify({ title: 'x'.repeat(200), text: 'G4 '.repeat(2000), meter: 99, bpm: -5 })))!
  console.assert(big.title.length === 80 && big.text.length === 4000 && big.meter === 7 && big.bpm === 20, 'melody link clamp', big)
}
