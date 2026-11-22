// «Мой класс» без сервера: ученик шлёт учителю ссылку ?report=<base64url(JSON)>
// с недельным отчётом, а приложение учителя, открыв её, кладёт отчёт в свой
// локальный список класса 'sax.class'. Ссылку может прислать кто угодно —
// поэтому decodeReport разбирает её как недоверенный ввод.

import { NOTES } from '../data/notes'
import { dayKey, daySeconds, readDiary, readGoalMin, streakDays, weekDays } from './practice'
import type { Instrument } from './sound'

export interface StudentReport {
  v: 1
  id: string
  name: string
  inst: Instrument
  /** дата отчёта YYYY-MM-DD */
  at: string
  /** минуты по 7 дням, от старого к новому */
  days: number[]
  /** минуты по видам занятий за неделю */
  byAct: Record<string, number>
  goal: number
  streak: number
  weak: string[]
  quizBest: number
  /** рекорд длинного тона, секунды */
  holdBest: number
  task?: { title?: string; done: number; total: number }
}

export interface ClassStudent {
  name: string
  inst: Instrument
  reports: StudentReport[]
}
export interface ClassData {
  students: Record<string, ClassStudent>
}

const INSTS: Instrument[] = ['soprano', 'alto', 'tenor', 'baritone']
const NOTE_IDS = new Set(NOTES.map((n) => n.id))
const ID = /^[\w-]{1,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
/** сколько отчётов на ученика держим: ~3 месяца недельных — хватит для графика истории */
const KEEP_REPORTS = 12
const CLASS_KEY = 'sax.class'

/** чтение чужих ключей localStorage: формат пишут другие режимы, доверять ему вслепую нельзя */
function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

const num = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : 0
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** id ученика: создаётся один раз и живёт в 'sax.studentId' — по нему учитель отличает «того же» ученика при смене имени */
export function studentId(): string {
  const old = readJSON('sax.studentId')
  if (typeof old === 'string' && ID.test(old)) return old
  const id = crypto.randomUUID?.().slice(0, 18) ?? Math.random().toString(36).slice(2, 14)
  try {
    localStorage.setItem('sax.studentId', JSON.stringify(id))
  } catch {
    /* приватный режим — id будет новым при каждом отчёте, учитель увидит дубль; не критично */
  }
  return id
}

/** имя для учителя — то же, что DiaryModal пишет через usePersisted('studentName') */
export const readStudentName = () => str(readJSON('sax.studentName'), 40)

/** собрать отчёт из localStorage; name по умолчанию — сохранённое */
export function buildReport(name: string = readStudentName()): StudentReport {
  const d = readDiary()
  const today = dayKey()
  const week = weekDays(today)
  const goal = readGoalMin()
  const byAct: Record<string, number> = {}
  for (const day of week)
    for (const [a, v] of Object.entries(d[day] ?? {})) byAct[a] = (byAct[a] ?? 0) + (v ?? 0)
  for (const a of Object.keys(byAct)) {
    byAct[a] = Math.round(byAct[a] / 60)
    // меньше минуты — шум (открыл и закрыл), в ссылке только место занимает
    if (!byAct[a]) delete byAct[a]
  }
  const miss = readJSON('sax.quizMiss')
  const weak =
    miss && typeof miss === 'object'
      ? Object.entries(miss as Record<string, unknown>)
          .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0 && NOTE_IDS.has(e[0]))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id)
      : []
  const inst = readJSON('sax.instrument')
  const r: StudentReport = {
    v: 1,
    id: studentId(),
    name: name.trim().slice(0, 40),
    inst: INSTS.includes(inst as Instrument) ? (inst as Instrument) : 'alto',
    at: today,
    days: week.map((day) => Math.round(daySeconds(day, d) / 60)),
    byAct,
    goal,
    streak: streakDays(goal, d, today),
    weak,
    quizBest: num(Number(readJSON('sax.quizBest')), 0, 100000),
    holdBest: num(Number(readJSON('sax.bestHold')), 0, 3600),
  }
  const task = readJSON('sax.task') as { title?: unknown; items?: unknown } | null
  if (task && Array.isArray(task.items) && task.items.length) {
    const items = task.items as Array<{ done?: boolean } | null>
    r.task = { done: items.filter((x) => x?.done).length, total: items.length }
    const title = str(task.title, 60)
    if (title) r.task.title = title
  }
  return r
}

// base64url, как в task.ts: «+», «/» и «=» ломают URL, а btoa знает только латиницу — сначала UTF-8
function toB64url(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export const encodeReport = (r: StudentReport) => toB64url(JSON.stringify(r))

/** строка из ссылки → отчёт; всё лишнее выкидываем, числа зажимаем; без id/имени/даты → null */
export function decodeReport(s: string): StudentReport | null {
  if (!s || s.length > 4000) return null
  let raw: unknown
  try {
    raw = JSON.parse(fromB64url(s))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = str(o.name, 40)
  if (o.v !== 1 || typeof o.id !== 'string' || !ID.test(o.id) || !name) return null
  if (typeof o.at !== 'string' || !DATE.test(o.at)) return null
  // неделя — ровно 7 дней; короче дополняем нулями слева, чтобы «сегодня» осталось последним
  const days = Array.isArray(o.days) ? o.days.slice(-7).map((v) => num(v, 0, 1440)) : []
  while (days.length < 7) days.unshift(0)
  const byAct: Record<string, number> = {}
  if (o.byAct && typeof o.byAct === 'object' && !Array.isArray(o.byAct))
    for (const [k, v] of Object.entries(o.byAct).slice(0, 20)) if (/^\w{1,20}$/.test(k)) byAct[k] = num(v, 0, 10080)
  const r: StudentReport = {
    v: 1,
    id: o.id,
    name,
    inst: INSTS.includes(o.inst as Instrument) ? (o.inst as Instrument) : 'alto',
    at: o.at,
    days,
    byAct,
    goal: num(o.goal, 1, 600) || 20,
    streak: num(o.streak, 0, 3650),
    weak: Array.isArray(o.weak)
      ? o.weak.filter((x): x is string => typeof x === 'string' && NOTE_IDS.has(x)).slice(0, 5)
      : [],
    quizBest: num(o.quizBest, 0, 100000),
    holdBest: num(o.holdBest, 0, 3600),
  }
  if (o.task && typeof o.task === 'object') {
    const t = o.task as Record<string, unknown>
    const total = num(t.total, 0, 100)
    if (total) {
      r.task = { done: Math.min(num(t.done, 0, 100), total), total }
      const title = str(t.title, 60)
      if (title) r.task.title = title
    }
  }
  return r
}

/** ссылка на это же приложение (подпапка GitHub Pages сохраняется через pathname) */
export const reportUrl = (r: StudentReport) => location.origin + location.pathname + '?report=' + encodeReport(r)

/** дней с выполненной целью в отчёте */
export const goalDays = (r: StudentReport) => r.days.filter((m) => m >= r.goal).length

export function readClass(): ClassData {
  const v = readJSON(CLASS_KEY) as ClassData | null
  return v && typeof v === 'object' && v.students && typeof v.students === 'object' ? v : { students: {} }
}
export function writeClass(c: ClassData) {
  try {
    localStorage.setItem(CLASS_KEY, JSON.stringify(c))
  } catch {
    /* переполнен/приватный режим — класс не сохранится, но и не упадём */
  }
}

/** чистая часть addReport — отдельно, чтобы проверить без localStorage */
export function mergeReport(c: ClassData, r: StudentReport): { data: ClassData; isNew: boolean } {
  const old = c.students[r.id]
  // один отчёт на дату: повторная отправка в тот же день заменяет прежнюю (свежие минуты)
  const reports = [...(old?.reports ?? []).filter((x) => x.at !== r.at), r]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-KEEP_REPORTS)
  // имя/строй берём из самого свежего отчёта: присланный старый отчёт не откатывает переименование
  const last = reports[reports.length - 1]
  return {
    data: { students: { ...c.students, [r.id]: { name: last.name, inst: last.inst, reports } } },
    isNew: !old,
  }
}

export function addReport(r: StudentReport): { isNew: boolean; name: string } {
  const { data, isNew } = mergeReport(readClass(), r)
  writeClass(data)
  return { isNew, name: data.students[r.id].name }
}

export function removeStudent(id: string) {
  const c = readClass()
  delete c.students[id]
  writeClass(c)
}

/**
 * Для Home при загрузке: берёт ?report= один раз и убирает его из адреса —
 * иначе перезагрузка страницы или «добавить на главный экран» тащили бы отчёт снова.
 */
export function ingestReportFromUrl(): { added: boolean; name: string; id: string } | null {
  const params = new URLSearchParams(location.search)
  const raw = params.get('report')
  if (raw === null) return null
  params.delete('report')
  const q = params.toString()
  history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash)
  const r = decodeReport(raw)
  if (!r) return null
  const { isNew, name } = addReport(r)
  return { added: isNew, name, id: r.id }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const r: StudentReport = {
    v: 1,
    id: 'abc-123',
    name: 'Алишер Ўғли',
    inst: 'tenor',
    at: '2026-11-20',
    days: [0, 10, 20, 30, 0, 25, 40],
    byAct: { quiz: 30, scales: 95 },
    goal: 20,
    streak: 2,
    weak: [NOTES[0].id],
    quizBest: 12,
    holdBest: 18,
    // порядок полей как у decodeReport — сравниваем через JSON.stringify
    task: { done: 2, total: 3, title: 'Домашка' },
  }
  const enc = encodeReport(r)
  console.assert(/^[\w-]+$/.test(enc), 'report url-safe')
  console.assert(JSON.stringify(decodeReport(enc)) === JSON.stringify(r), 'report round-trip', decodeReport(enc))
  const bad = decodeReport(toB64url(JSON.stringify({ ...r, id: '<x>', evil: 1 })))
  console.assert(bad === null, 'report bad id')
  const clamp = decodeReport(
    toB64url(JSON.stringify({ ...r, days: [9999, -5], weak: ['nope', NOTES[1].id], inst: 'kazoo', byAct: { 'a b': 1, ok: 1e9 } })),
  )
  console.assert(
    clamp?.days.length === 7 && clamp.days[5] === 1440 && clamp.days[6] === 0 && clamp.weak.length === 1 && clamp.inst === 'alto' &&
      !('a b' in clamp.byAct) && clamp.byAct.ok === 10080,
    'report clamp',
    clamp,
  )
  console.assert(decodeReport('%%%') === null && decodeReport('') === null, 'report garbage')
  const m1 = mergeReport({ students: {} }, r)
  const m2 = mergeReport(m1.data, { ...r, name: 'Новое', days: [1, 1, 1, 1, 1, 1, 1] })
  const m3 = mergeReport(m2.data, { ...r, at: '2026-11-01', name: 'Старое' })
  console.assert(m1.isNew && !m2.isNew && m2.data.students[r.id].reports.length === 1, 'report dedupe date')
  console.assert(m3.data.students[r.id].reports.length === 2 && m3.data.students[r.id].name === 'Новое', 'report keep latest name')
  console.assert(goalDays(r) === 4, 'goalDays')
}
