// Дневник занятий: сколько секунд в день ушло на каждый режим.
// Храним в localStorage 'sax.diary' как {день: {режим: секунды}} — сервера нет,
// а для недельного графика и отчёта учителю этого хватает.

import { useEffect } from 'react'

export type Activity =
  | 'table'
  | 'quiz'
  | 'scales'
  | 'ensemble'
  | 'games'
  | 'melodies'
  | 'trills'
  | 'tuner'
  | 'longTone'
  | 'follow'
  | 'metronome'
  | 'selfRecord'

export type Diary = Record<string, Partial<Record<Activity, number>>>

const KEY = 'sax.diary'
const KEEP_DAYS = 120
/** событие «дневник изменился» — окно дневника перерисовывается, пока открыто */
export const DIARY_EVENT = 'sax-diary'

/** местный день YYYY-MM-DD: шведская локаль как раз даёт ISO-вид, а не UTC-день из toISOString */
export const dayKey = (d: Date = new Date()) => d.toLocaleDateString('sv')

/** сдвиг дня на n суток; через конструктор с локальной датой, чтобы переход на летнее время не съел сутки */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

export function readDiary(): Diary {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return v && typeof v === 'object' ? (v as Diary) : {}
  } catch {
    return {}
  }
}

/** выкидываем всё старше 120 дней: ISO-строки дат сравниваются как обычные строки */
export function pruneDiary(d: Diary, today: string): Diary {
  const from = shiftDay(today, -(KEEP_DAYS - 1))
  return Object.fromEntries(Object.entries(d).filter(([day]) => day >= from))
}

export function addPractice(activity: Activity, seconds: number) {
  if (!(seconds > 0)) return
  const today = dayKey()
  const d = readDiary()
  const day = (d[today] ??= {})
  day[activity] = (day[activity] ?? 0) + seconds
  try {
    localStorage.setItem(KEY, JSON.stringify(pruneDiary(d, today)))
  } catch {
    /* приватный режим Safari — дневник просто не ведётся */
  }
  window.dispatchEvent(new Event(DIARY_EVENT))
}

export function daySeconds(day: string, d: Diary = readDiary()): number {
  return Object.values(d[day] ?? {}).reduce((a, b) => a + (b ?? 0), 0)
}

/** последние 7 дней по endDay включительно, от старого к новому — в таком порядке их рисует график */
export function weekDays(endDay: string = dayKey()): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDay(endDay, i - 6))
}

/**
 * Сколько дней подряд выполнена цель. Сегодняшний день засчитываем, если цель уже
 * набрана; если ещё нет — серия не рвётся, считаем от вчера (день ведь не кончился).
 */
export function streakDays(goalMin: number, d: Diary = readDiary(), today: string = dayKey()): number {
  const goal = goalMin * 60
  let day = daySeconds(today, d) >= goal ? today : shiftDay(today, -1)
  let n = 0
  while (daySeconds(day, d) >= goal) {
    n++
    day = shiftDay(day, -1)
  }
  return n
}

export function readGoalMin(): number {
  try {
    const v = Number(JSON.parse(localStorage.getItem('sax.goalMin') ?? '20'))
    return v > 0 ? v : 20
  } catch {
    return 20
  }
}

// На саксофоне играют руками, а не по экрану: в этих режимах время идёт, пока режим
// открыт, даже без касаний. В остальных (таблица, тренажёр…) открытая и забытая
// вкладка не должна накручивать минуты — там нужны недавние касания.
const HANDS_FREE: ReadonlySet<Activity> = new Set(['tuner', 'longTone', 'follow', 'metronome', 'selfRecord'])
const TICK = 5
const IDLE_MS = 90_000

/** время последнего касания/клавиши — общее на всё приложение, хук может стоять в нескольких местах */
let lastInput = Date.now()
const touch = () => {
  lastInput = Date.now()
}

/** считает время в режиме activity (null — ничего не считать), по 5 секунд */
export function usePracticeTracker(activity: Activity | null) {
  useEffect(() => {
    if (!activity) return
    // открыть режим — уже действие пользователя: иначе первые 90 с после долгой паузы не засчитались бы
    touch()
    window.addEventListener('pointerdown', touch, { passive: true })
    window.addEventListener('keydown', touch)
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (HANDS_FREE.has(activity) || Date.now() - lastInput < IDLE_MS) addPractice(activity, TICK)
    }, TICK * 1000)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [activity])
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const t = '2026-03-02'
  console.assert(shiftDay(t, -2) === '2026-02-28' && shiftDay('2024-02-28', 1) === '2024-02-29', 'shiftDay')
  console.assert(weekDays(t)[0] === '2026-02-24' && weekDays(t)[6] === t, 'weekDays')
  const d: Diary = { '2026-03-01': { quiz: 1200 }, '2026-02-28': { tuner: 600, scales: 600 }, '2026-02-27': { quiz: 60 } }
  // сегодня пусто — считаем от вчера: 1 и 28 февраля по 20 мин, 27-го мало
  console.assert(streakDays(20, d, t) === 2, 'streak from yesterday')
  console.assert(streakDays(20, { ...d, [t]: { follow: 1200 } }, t) === 3, 'streak with today')
  console.assert(streakDays(30, d, t) === 0, 'streak none')
  const p = pruneDiary({ [shiftDay(t, -119)]: {}, [shiftDay(t, -120)]: {} }, t)
  console.assert(Object.keys(p).length === 1, 'prune 120 days', p)
}
