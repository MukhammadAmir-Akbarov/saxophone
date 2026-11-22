import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Send, Share2, X } from 'lucide-react'
import { NOTES, type SaxNote } from '../data/notes'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { DIARY } from '../lib/i18n/diary'
import { usePersisted } from '../lib/persist'
import { DIARY_EVENT, dayKey, daySeconds, readDiary, streakDays, weekDays, type Activity, type Diary } from '../lib/practice'

interface Props {
  onClose: () => void
  lang: Lang
  t: (typeof STRINGS)['ru']
  nameOf: (n: SaxNote) => string
}

type S = (typeof DIARY)['ru']

const GOALS = [10, 15, 20, 30, 45, 60]

const CHIP =
  'h-10 min-w-10 cursor-pointer rounded-[10px] px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const OFF = 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'
const BTN =
  'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--c-4a3b22)] px-4 text-sm font-semibold text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'

const fill = (tpl: string, a: number | string, b?: number | string) =>
  tpl.replace('{1}', String(a)).replace('{2}', String(b ?? ''))

/** «1 ч 25 мин» / «25 мин»: до минуты округляем — секунды учителю не нужны */
function fmtDur(sec: number, s: S): string {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} ${s.hour} ${m % 60} ${s.min}` : `${m} ${s.min}`
}

/** «16.11» из «2026-11-16» */
const ddmm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`
/** короткое имя дня недели из словаря: Intl для узбекского во многих браузерах не знает */
const wd = (day: string, s: S) => {
  const [y, m, d] = day.split('-').map(Number)
  return s[`wd${new Date(y, m - 1, d).getDay()}` as keyof S]
}
const actName = (a: string, s: S) => s[`a_${a}` as keyof S] ?? a

/** чтение чужих ключей localStorage: их пишут другие режимы, формат проверяем сами */
function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

/** сумма по видам за дни, по убыванию — и для разбивки в окне, и для отчёта */
function byActivity(days: string[], d: Diary): Array<[Activity, number]> {
  const sum: Partial<Record<Activity, number>> = {}
  for (const day of days)
    for (const [a, v] of Object.entries(d[day] ?? {})) sum[a as Activity] = (sum[a as Activity] ?? 0) + (v ?? 0)
  return (Object.entries(sum) as Array<[Activity, number]>).filter(([, v]) => v >= 30).sort((x, y) => y[1] - x[1])
}

function buildReport(days: string[], d: Diary, s: S, t: Props['t'], nameOf: Props['nameOf']): string {
  const secs = days.map((day) => daySeconds(day, d))
  // «занимался» — хотя бы минута: случайные 5 секунд открытой таблицы днём занятий не считаем
  const practiced = secs.filter((x) => x >= 60).length
  const total = secs.reduce((a, b) => a + b, 0)
  const lines = [
    s.rTitle,
    `${ddmm(days[0])} – ${ddmm(days[6])}`,
    '',
    `${s.rDays}: ${fill(s.ofTpl, practiced, 7)}`,
    `${s.rTotal}: ${fmtDur(total, s)}`,
    '',
    `${s.rPerDay}:`,
    ...days.map((day, i) => `${wd(day, s)} ${ddmm(day)} — ${fmtDur(secs[i], s)}`),
  ]
  const acts = byActivity(days, d)
  if (acts.length) lines.push('', `${s.rPerAct}:`, ...acts.map(([a, v]) => `${actName(a, s)} — ${fmtDur(v, s)}`))

  const extra: string[] = []
  const miss = readJSON<Record<string, number>>('sax.quizMiss')
  if (miss && typeof miss === 'object') {
    const weak = Object.entries(miss)
      .filter(([, w]) => typeof w === 'number' && w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => NOTES.find((n) => n.id === id))
      .filter((n): n is SaxNote => !!n)
      .map(nameOf)
    if (weak.length) extra.push(`${s.rWeak}: ${weak.join(', ')}`)
  }
  const best = Number(readJSON('sax.quizBest'))
  if (best > 0) extra.push(`${s.rQuizBest}: ${best}`)
  const hold = Number(readJSON('sax.bestHold'))
  if (hold > 0) extra.push(`${s.rHold}: ${Math.round(hold)} ${t.sec}`)
  const task = readJSON<{ title?: string; items?: Array<{ done?: boolean }> }>('sax.task')
  if (task && Array.isArray(task.items) && task.items.length) {
    const done = task.items.filter((x) => x?.done).length
    const title = typeof task.title === 'string' && task.title ? ` «${task.title}»` : ''
    extra.push(`${s.rTask}${title}: ${fill(s.ofTpl, done, task.items.length)}`)
  }
  if (extra.length) lines.push('', ...extra)
  return lines.join('\n')
}

/** кольцо прогресса за сегодня; больше цели — кольцо просто полное */
function Ring({ value, goal, s }: { value: number; goal: number; s: S }) {
  const R = 52
  const C = 2 * Math.PI * R
  const p = Math.min(1, value / (goal * 60))
  const met = p >= 1
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img" aria-label={`${s.today}: ${fmtDur(value, s)} / ${goal} ${s.min}`}>
      <circle cx="64" cy="64" r={R} fill="none" style={{ stroke: 'var(--c-2e2415)' }} strokeWidth="12" />
      <circle
        cx="64"
        cy="64"
        r={R}
        fill="none"
        style={{ stroke: met ? 'var(--c-5fd27a)' : 'var(--c-f2c14e)' }}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${C * p} ${C}`}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="64" textAnchor="middle" fontSize="28" fontWeight="700" style={{ fill: 'var(--c-f5e8cd)' }}>
        {Math.floor(value / 60)}
      </text>
      <text x="64" y="86" textAnchor="middle" fontSize="12" style={{ fill: 'var(--c-a08c64)' }}>
        / {goal} {s.min}
      </text>
    </svg>
  )
}

/** недельный столбчатый график; пунктир — цель, золотые столбики — цель выполнена */
function WeekChart({ days, d, goal, s }: { days: string[]; d: Diary; goal: number; s: S }) {
  const W = 308
  const H = 150
  const TOP = 16
  const BASE = 124
  const secs = days.map((day) => daySeconds(day, d))
  // масштаб — по цели или лучшему дню, иначе пустая неделя рисовала бы линию цели под потолком
  const max = Math.max(goal * 60 * 1.25, ...secs)
  const y = (v: number) => BASE - ((BASE - TOP) * v) / max
  const slot = W / 7
  const today = dayKey()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={s.week}>
      {days.map((day, i) => {
        const v = secs[i]
        const met = v >= goal * 60
        const x = i * slot + slot * 0.2
        const h = Math.max(v > 0 ? 2 : 0, BASE - y(v))
        return (
          <g key={day}>
            <rect x={x} y={BASE - h} width={slot * 0.6} height={h} rx="4" style={{ fill: met ? 'var(--c-f2c14e)' : 'var(--c-6b5732)' }} />
            {v >= 60 && (
              <text x={x + slot * 0.3} y={BASE - h - 4} textAnchor="middle" fontSize="11" style={{ fill: 'var(--c-d9c9a8)' }}>
                {Math.round(v / 60)}
              </text>
            )}
            <text
              x={x + slot * 0.3}
              y={BASE + 16}
              textAnchor="middle"
              fontSize="11"
              fontWeight={day === today ? 700 : 400}
              style={{ fill: day === today ? 'var(--c-f2c14e)' : 'var(--c-a08c64)' }}
            >
              {wd(day, s)}
            </text>
          </g>
        )
      })}
      <line x1="0" x2={W} y1={y(goal * 60)} y2={y(goal * 60)} style={{ stroke: 'var(--c-d9a441)' }} strokeDasharray="4 4" strokeWidth="1" />
      <text x={W - 2} y={y(goal * 60) - 4} textAnchor="end" fontSize="10" style={{ fill: 'var(--c-d9a441)' }}>
        {s.goalLine} {goal}
      </text>
      <line x1="0" x2={W} y1={BASE} y2={BASE} style={{ stroke: 'var(--c-3a2f1c)' }} />
    </svg>
  )
}

export default function DiaryModal({ onClose, lang, t, nameOf }: Props) {
  const s = pick(DIARY, lang)
  const [goal, setGoal] = usePersisted('goalMin', 20)
  const [diary, setDiary] = useState<Diary>(readDiary)
  const [report, setReport] = useState<string | null>(null)
  const [status, setStatus] = useState<'' | 'copied' | 'failed'>('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // счётчик тикает и пока окно открыто (метроном, тюнер в фоне) — перечитываем дневник
  useEffect(() => {
    const upd = () => setDiary(readDiary())
    window.addEventListener(DIARY_EVENT, upd)
    return () => window.removeEventListener(DIARY_EVENT, upd)
  }, [])

  const days = useMemo(() => weekDays(), [])
  const today = days[6]
  const weekTotal = days.reduce((a, day) => a + daySeconds(day, diary), 0)
  const acts = byActivity(days, diary)
  const streak = streakDays(goal, diary, today)

  const openReport = () => {
    setStatus('')
    setReport(buildReport(days, diary, s, t, nameOf))
  }
  const site = location.origin + location.pathname
  const sendTelegram = () => {
    if (!report) return
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(site)}&text=${encodeURIComponent(report)}`,
      '_blank',
      'noopener',
    )
  }
  const share = async () => {
    try {
      await navigator.share({ text: report ?? '' })
    } catch {
      /* пользователь закрыл системное меню — это не ошибка */
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report ?? '')
      setStatus('copied')
    } catch {
      // нет HTTPS или запрещён буфер — пусть выделит текст в превью сам
      setStatus('failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
    >
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-[var(--c-f2e3c2)]">{report === null ? s.title : s.reportPreview}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <X size={20} />
          </button>
        </div>

        {report === null ? (
          <>
            <div className="flex items-center gap-4">
              <Ring value={daySeconds(today, diary)} goal={goal} s={s} />
              <div className="min-w-0">
                <div className="text-sm text-[var(--c-a08c64)]">{s.streak}</div>
                <div className="font-display text-3xl text-[var(--c-f2c14e)]">{streak}</div>
                <div className="mt-2 text-sm text-[var(--c-a08c64)]">{s.weekTotal}</div>
                <div className="text-lg font-semibold text-[var(--c-f5e8cd)]">{fmtDur(weekTotal, s)}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-[var(--c-c9b892)]">{s.goal}</div>
            <div className="mt-1 flex flex-wrap gap-1 rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] p-1" role="radiogroup" aria-label={s.goal}>
              {GOALS.map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={goal === g}
                  aria-label={fill(s.goalAria, g)}
                  onClick={() => setGoal(g)}
                  className={`${CHIP} flex-1 ${goal === g ? ON : OFF}`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm text-[var(--c-c9b892)]">{s.week}</div>
            <div className="mt-1 rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] p-2">
              <WeekChart days={days} d={diary} goal={goal} s={s} />
            </div>

            <div className="mt-4 text-sm text-[var(--c-c9b892)]">{s.byActivity}</div>
            {acts.length ? (
              <ul className="mt-1 divide-y divide-[var(--c-2e2415)] rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)]">
                {acts.map(([a, v]) => (
                  <li key={a} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-[var(--c-e8d5ae)]">{actName(a, s)}</span>
                    <span className="font-semibold text-[var(--c-f6d98a)]">{fmtDur(v, s)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--c-7a6845)]">{s.empty}</p>
            )}

            <button onClick={openReport} className={`${BTN} mt-5 w-full border-transparent ${ON} hover:text-[var(--c-241a08)]`}>
              <Send size={18} /> {s.report}
            </button>
          </>
        ) : (
          <>
            <pre className="max-h-[50dvh] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] p-3 font-sans text-sm text-[var(--c-e8d5ae)] select-text">
              {report}
            </pre>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={sendTelegram} className={`${BTN} col-span-2 border-transparent ${ON} hover:text-[var(--c-241a08)]`}>
                <Send size={18} /> {s.sendTelegram}
              </button>
              {typeof navigator.share === 'function' && (
                <button onClick={share} className={BTN}>
                  <Share2 size={18} /> {s.share}
                </button>
              )}
              <button onClick={copy} className={BTN}>
                <Copy size={18} /> {s.copy}
              </button>
              <button onClick={() => setReport(null)} className={`${BTN} col-span-2`}>
                {s.back}
              </button>
            </div>
            <p className="mt-2 min-h-5 text-sm" role="status" aria-live="polite">
              {status === 'copied' && <span className="text-[var(--c-5fd27a)]">{s.copied}</span>}
              {status === 'failed' && <span className="text-[var(--c-ff8a78)]">{s.copyFailed}</span>}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
