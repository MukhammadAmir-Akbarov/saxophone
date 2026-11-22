// Задание от учителя, упакованное в ссылку: ?task=<base64url(JSON)>.
// Сервера нет (статика на GitHub Pages), поэтому всё задание живёт в самой ссылке.
// Ссылка приходит от кого угодно — разбираем её как недоверенный ввод.

import { NOTES, type SaxNote } from '../data/notes'
import type { STRINGS } from './i18n'
import type { TASK } from './i18n/task'
import { SCALE_TYPES, tonicName, type ScaleType } from './scales'

export type TaskItem =
  | { k: 'scale'; tonic: number; type: ScaleType; octaves: 1 | 2; pattern?: string; bpm: number; min?: number }
  | { k: 'long'; note: string; min: number }
  | { k: 'quiz'; kind: 'fingering' | 'name' | 'ear'; count: number }
  | { k: 'melody'; id: string }
  | { k: 'trill'; id: string }
  | { k: 'metro'; bpm: number; beats: number; min: number }
  | { k: 'note'; note: string }

export type TaskKind = TaskItem['k']
export const TASK_KINDS: TaskKind[] = ['scale', 'long', 'quiz', 'melody', 'trill', 'metro', 'note']

export interface Task {
  title?: string
  /** имя учителя */
  from?: string
  items: Array<TaskItem & { done?: boolean }>
}

export const MAX_ITEMS = 20
const QUIZ_KINDS = ['fingering', 'name', 'ear'] as const
const NOTE_IDS = new Set(NOTES.map((n) => n.id))
// id мелодий/трелей и паттернов — короткие латинские слаги; всё остальное отбрасываем,
// чтобы из ссылки не пролезла простыня текста или разметка
const SLUG = /^[\w-]{1,40}$/

/** число из недоверенного ввода → целое в [lo, hi]; мусор → def */
const num = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || undefined

function cleanItem(raw: unknown): TaskItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  switch (o.k) {
    case 'scale': {
      if (!SCALE_TYPES.includes(o.type as ScaleType)) return null
      const it: TaskItem = {
        k: 'scale',
        tonic: num(o.tonic, 0, 11, 0),
        type: o.type as ScaleType,
        octaves: o.octaves === 2 ? 2 : 1,
        bpm: num(o.bpm, 20, 300, 80),
      }
      if (typeof o.pattern === 'string' && SLUG.test(o.pattern)) it.pattern = o.pattern
      if (o.min !== undefined) it.min = num(o.min, 1, 120, 5)
      return it
    }
    case 'long':
      return typeof o.note === 'string' && NOTE_IDS.has(o.note) ? { k: 'long', note: o.note, min: num(o.min, 1, 120, 5) } : null
    case 'note':
      return typeof o.note === 'string' && NOTE_IDS.has(o.note) ? { k: 'note', note: o.note } : null
    case 'quiz':
      return QUIZ_KINDS.includes(o.kind as never)
        ? { k: 'quiz', kind: o.kind as (typeof QUIZ_KINDS)[number], count: num(o.count, 1, 100, 10) }
        : null
    case 'melody':
    case 'trill':
      return typeof o.id === 'string' && SLUG.test(o.id) ? { k: o.k, id: o.id } : null
    case 'metro':
      return { k: 'metro', bpm: num(o.bpm, 20, 300, 80), beats: num(o.beats, 1, 12, 4), min: num(o.min, 1, 120, 5) }
    default:
      return null
  }
}

// base64url: обычный base64 в URL ломается на «+» и «/», а «=» в конце не нужен.
// btoa понимает только латиницу, поэтому сначала UTF-8 байты (кириллица в названии).
function toB64url(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** задание → короткая строка для ссылки (отметки «сделано» — личное дело ученика, не передаём) */
export function encodeTask(task: Task): string {
  const items = task.items.slice(0, MAX_ITEMS).map((it) => {
    const copy: Record<string, unknown> = { ...it }
    delete copy.done
    return copy
  })
  const out: Record<string, unknown> = { items }
  if (task.title?.trim()) out.title = task.title.trim().slice(0, 80)
  if (task.from?.trim()) out.from = task.from.trim().slice(0, 40)
  return toB64url(JSON.stringify(out))
}

/** строка из ссылки → задание; битая или пустая → null */
export function decodeTask(s: string): Task | null {
  // потолок длины — защита от гигантской ссылки до разбора
  if (!s || s.length > 8000) return null
  let raw: unknown
  try {
    raw = JSON.parse(fromB64url(s))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Task).items)) return null
  const o = raw as Record<string, unknown>
  const items = (o.items as unknown[])
    .slice(0, MAX_ITEMS)
    .map(cleanItem)
    .filter((x): x is TaskItem => x !== null)
  if (!items.length) return null
  return { title: str(o.title, 80), from: str(o.from, 40), items }
}

/** полная ссылка на текущую страницу с заданием (подпапка GitHub Pages сохраняется через pathname) */
export const taskUrl = (task: Task) => location.origin + location.pathname + '?task=' + encodeTask(task)

const QUIZ = { fingering: 'kindFingering', name: 'kindName', ear: 'kindEar' } as const

/** человеческое описание пункта: «G мажор, 1 окт., 80 уд/мин, 5 мин» */
const PAT_KEYS = {
  thirds: 'patThirds',
  fourths: 'patFourths',
  groups3: 'patGroups3',
  groups4: 'patGroups4',
  triads: 'patTriads',
} as const

export function describeItem(
  it: TaskItem,
  s: (typeof TASK)['ru'],
  t: (typeof STRINGS)['ru'],
  nameOf: (n: SaxNote) => string,
  melodyTitle: (id: string) => string,
  trillTitle: (id: string) => string,
): string {
  // нота могла пропасть из справочника — тогда показываем сырой id, а не падаем
  const note = (id: string) => {
    const n = NOTES.find((x) => x.id === id)
    return n ? nameOf(n) : id
  }
  switch (it.k) {
    case 'scale': {
      const parts = [`${s.scale}: ${tonicName(it.tonic, it.type)} ${t[it.type].toLowerCase()}`, `${it.octaves} ${t.octShort}`, `${it.bpm} ${t.bpm}`]
      // упражнение поверх гаммы (терции, группы…) — ученик должен видеть, что именно играть
      const pat = PAT_KEYS[it.pattern as keyof typeof PAT_KEYS]
      if (pat) parts.splice(1, 0, t[pat].toLowerCase())
      if (it.min) parts.push(`${it.min} ${t.minShort}`)
      return parts.join(', ')
    }
    case 'long':
      return `${s.long}: ${note(it.note)}, ${it.min} ${t.minShort}`
    case 'note':
      return `${s.note}: ${note(it.note)}`
    case 'quiz':
      return `${s.quiz}: ${t[QUIZ[it.kind]].toLowerCase()}, ${it.count} ${s.questions}`
    case 'melody':
      return `${s.melody}: ${melodyTitle(it.id)}`
    case 'trill':
      return `${s.trill}: ${trillTitle(it.id)}`
    case 'metro':
      return `${s.metro}: ${it.bpm} ${t.bpm}, ${it.beats} ${t.beatsShort}, ${it.min} ${t.minShort}`
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const t: Task = {
    title: 'Домашка: соль мажор',
    from: 'Учитель',
    items: [
      { k: 'scale', tonic: 7, type: 'major', octaves: 1, bpm: 80, min: 5, done: true },
      { k: 'long', note: 'g_4', min: 5 },
    ],
  }
  const back = decodeTask(encodeTask(t))
  console.assert(back?.title === t.title && back?.items.length === 2 && !('done' in back.items[0]), 'task round-trip', back)
  console.assert(/^[\w-]+$/.test(encodeTask(t)), 'task url-safe')
  // мусор отбрасывается, числа зажимаются
  const bad = decodeTask(toB64url(JSON.stringify({ items: [{ k: 'evil' }, { k: 'metro', bpm: 9999, beats: -3, min: 'x' }] })))
  console.assert(bad?.items.length === 1 && (bad.items[0] as { bpm: number }).bpm === 300, 'task clamp', bad)
  console.assert(decodeTask('%%%') === null && decodeTask('') === null, 'task garbage')
}
