// Окно учителя «Мой класс»: ученики, чьи ссылки-отчёты открыли на этом устройстве.
// Сервера нет — всё лежит в localStorage 'sax.class' (см. lib/report.ts).

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Download, Flame, Trash2, X } from 'lucide-react'
import { NOTES, type SaxNote } from '../data/notes'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { CLASS } from '../lib/i18n/class'
import { DIARY } from '../lib/i18n/diary'
import { dayKey } from '../lib/practice'
import { goalDays, readClass, removeStudent, type ClassData, type StudentReport } from '../lib/report'

interface Props {
  onClose: () => void
  lang: Lang
  t: (typeof STRINGS)['ru']
  nameOf: (n: SaxNote) => string
  /** ученик, только что добавленный по ссылке — подсвечиваем */
  highlightId?: string
}

type S = (typeof CLASS)['ru']

const BTN =
  'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--c-4a3b22)] px-4 text-sm font-semibold text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const BOX = 'rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)]'

const fill = (tpl: string, a: number | string) => tpl.replace('{1}', String(a))
const ddmm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const last = (r: StudentReport[]) => r[r.length - 1]

/** «сегодня / вчера / N дн. назад»: разницу считаем по местным датам, без часов — иначе летнее время даёт 0,96 суток */
function ago(at: string, s: S): string {
  const toDate = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, dd)
  }
  const n = Math.round((toDate(dayKey()) - toDate(at)) / 86_400_000)
  return n <= 0 ? s.today : n === 1 ? s.yesterday : fill(s.daysAgo, n)
}

/** мини-график недели: 7 столбиков, золотые — цель выполнена */
function Spark({ r }: { r: StudentReport }) {
  const max = Math.max(r.goal, ...r.days)
  return (
    <svg viewBox="0 0 70 24" className="h-6 w-[70px] shrink-0" aria-hidden="true">
      {r.days.map((m, i) => {
        const h = m > 0 ? Math.max(2, (22 * m) / max) : 1
        return (
          <rect key={i} x={i * 10 + 1} y={24 - h} width="8" height={h} rx="1.5" style={{ fill: m >= r.goal ? 'var(--c-f2c14e)' : m > 0 ? 'var(--c-6b5732)' : 'var(--c-2e2415)' }} />
        )
      })}
    </svg>
  )
}

/** история: сумма минут каждого присланного отчёта */
function History({ reports, s }: { reports: StudentReport[]; s: S }) {
  const W = 308
  const BASE = 112
  const totals = reports.map((r) => sum(r.days))
  const max = Math.max(1, ...totals)
  const slot = W / Math.max(reports.length, 4)
  return (
    <svg viewBox={`0 0 ${W} 132`} className="w-full" role="img" aria-label={s.history}>
      {reports.map((r, i) => {
        const h = Math.max(totals[i] > 0 ? 2 : 0, ((BASE - 16) * totals[i]) / max)
        const x = i * slot + slot * 0.2
        return (
          <g key={r.at}>
            <rect x={x} y={BASE - h} width={slot * 0.6} height={h} rx="4" style={{ fill: i === reports.length - 1 ? 'var(--c-f2c14e)' : 'var(--c-6b5732)' }} />
            <text x={x + slot * 0.3} y={BASE - h - 4} textAnchor="middle" fontSize="11" style={{ fill: 'var(--c-d9c9a8)' }}>
              {totals[i]}
            </text>
            <text x={x + slot * 0.3} y={BASE + 15} textAnchor="middle" fontSize="10" style={{ fill: 'var(--c-a08c64)' }}>
              {ddmm(r.at)}
            </text>
          </g>
        )
      })}
      <line x1="0" x2={W} y1={BASE} y2={BASE} style={{ stroke: 'var(--c-3a2f1c)' }} />
    </svg>
  )
}

/** CSV последнего отчёта каждого ученика; кавычим все поля — в именах бывают запятые и кавычки */
function exportCsv(c: ClassData, s: S, t: Props['t'], weakNames: (r: StudentReport) => string) {
  const q = (v: string | number) => {
    const str = String(v)
    // ведущие = + - @ Excel принял бы за формулу — имя ученика приходит из чужой ссылки
    return `"${(/^[=+\-@]/.test(str) ? "'" + str : str).replace(/"/g, '""')}"`
  }
  const rows = Object.values(c.students)
    .filter((st) => st.reports?.length)
    .map((st) => {
    const r = last(st.reports)
    const task = r.task ? `${r.task.title ? r.task.title + ' ' : ''}${r.task.done}/${r.task.total}` : ''
    return [st.name, t[st.inst], r.at, sum(r.days), goalDays(r), r.goal, r.streak, weakNames(r), r.quizBest, r.holdBest, task].map(q).join(',')
  })
  // BOM — иначе Excel откроет UTF-8 как cp1251 и кириллица превратится в кракозябры
  const blob = new Blob(['﻿' + [s.csvHead, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `class-${dayKey()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function ClassModal({ onClose, lang, t, nameOf, highlightId }: Props) {
  const s = pick(CLASS, lang)
  const d = pick(DIARY, lang)
  const [data, setData] = useState<ClassData>(readClass)
  const [open, setOpen] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const hiRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // в большом классе новичок может оказаться ниже края окна
  // тело в фигурных скобках: эффект не должен ничего возвращать, кроме функции очистки
  useEffect(() => {
    hiRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  const weakNames = (r: StudentReport) =>
    r.weak
      .map((id) => NOTES.find((n) => n.id === id))
      .filter((n): n is SaxNote => !!n)
      .map(nameOf)
      .join(', ')
  const actName = (a: string) => d[`a_${a}` as keyof typeof d] ?? a

  const list = Object.entries(data.students)
    .filter(([, st]) => st.reports?.length)
    .sort((a, b) => last(b[1].reports).at.localeCompare(last(a[1].reports).at))
  const cur = open ? data.students[open] : undefined

  const remove = (id: string, name: string) => {
    if (!confirm(fill(s.confirmRemove, name))) return
    removeStudent(id)
    setData(readClass())
    setOpen(null)
  }

  const stats = (r: StudentReport) => (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--c-a08c64)]">
      <span className="font-semibold text-[var(--c-f6d98a)]">
        {sum(r.days)} {s.min} {s.week}
      </span>
      {r.streak > 0 && (
        <span className="flex items-center gap-0.5">
          <Flame size={12} className="text-[var(--c-f2c14e)]" /> {s.streak} {r.streak}
        </span>
      )}
      <span>{fill(s.goalDays, goalDays(r))}</span>
      {r.task && (
        <span>
          {s.task}: {r.task.done}/{r.task.total}
        </span>
      )}
    </div>
  )

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
        <div className="mb-3 flex items-center justify-between gap-2">
          {cur && (
            <button onClick={() => setOpen(null)} aria-label={s.back} className={`${BTN} w-10 px-0`}>
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-[var(--c-f2e3c2)]">{cur ? cur.name : s.title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label={t.close} className={`${BTN} w-10 px-0`}>
            <X size={20} />
          </button>
        </div>

        {open && cur ? (
          (() => {
            const r = last(cur.reports)
            const acts = Object.entries(r.byAct)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
            const weak = weakNames(r)
            return (
              <>
                <div className="text-sm text-[var(--c-a08c64)]">
                  {t[cur.inst]} · {fill(s.reportOf, ddmm(r.at))} ({ago(r.at, s)})
                </div>
                {stats(r)}
                <div className={`mt-3 p-2 ${BOX}`}>
                  <div className="mb-1 px-1 text-sm text-[var(--c-c9b892)]">{s.history}</div>
                  <History reports={cur.reports} s={s} />
                </div>

                <div className="mt-4 text-sm text-[var(--c-c9b892)]">{s.latestAct}</div>
                {acts.length ? (
                  <ul className={`mt-1 divide-y divide-[var(--c-2e2415)] ${BOX}`}>
                    {acts.map(([a, v]) => (
                      <li key={a} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-[var(--c-e8d5ae)]">{actName(a)}</span>
                        <span className="font-semibold text-[var(--c-f6d98a)]">
                          {v} {s.min}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-[var(--c-7a6845)]">{s.noAct}</p>
                )}

                <dl className="mt-4 space-y-1 text-sm">
                  {weak && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--c-a08c64)]">{s.weak}</dt>
                      <dd className="text-right text-[var(--c-ff8a78)]">{weak}</dd>
                    </div>
                  )}
                  {r.quizBest > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--c-a08c64)]">{s.quizBest}</dt>
                      <dd className="text-[var(--c-e8d5ae)]">{r.quizBest}</dd>
                    </div>
                  )}
                  {r.holdBest > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--c-a08c64)]">{s.hold}</dt>
                      <dd className="text-[var(--c-e8d5ae)]">
                        {r.holdBest} {s.sec}
                      </dd>
                    </div>
                  )}
                  {r.task && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--c-a08c64)]">{s.task}</dt>
                      <dd className="text-right text-[var(--c-e8d5ae)]">
                        {r.task.title ? `«${r.task.title}» ` : ''}
                        {r.task.done}/{r.task.total}
                      </dd>
                    </div>
                  )}
                </dl>

                <button onClick={() => remove(open, cur.name)} className={`${BTN} mt-5 w-full border-[var(--c-6b2f2a)] text-[var(--c-ff8a78)] hover:text-[var(--c-ff8a78)]`}>
                  <Trash2 size={18} /> {s.remove}
                </button>
              </>
            )
          })()
        ) : list.length ? (
          <>
            <ul className="space-y-2">
              {list.map(([id, st]) => {
                const r = last(st.reports)
                const hi = id === highlightId
                return (
                  <li key={id}>
                    <button
                      ref={hi ? hiRef : undefined}
                      onClick={() => setOpen(id)}
                      className={`w-full cursor-pointer p-3 text-left hover:bg-[var(--c-241c11)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${BOX} ${hi ? 'border-[var(--c-f2c14e)]' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-[var(--c-f5e8cd)]">{st.name}</span>
                            {hi && (
                              <span className="shrink-0 rounded-full bg-[var(--c-2f6b3b)] px-2 text-xs text-[var(--c-f5e8cd)]">{s.newBadge}</span>
                            )}
                          </div>
                          <div className="truncate text-xs text-[var(--c-a08c64)]">
                            {t[st.inst]} · {ago(r.at, s)}
                          </div>
                        </div>
                        <Spark r={r} />
                      </div>
                      {stats(r)}
                      {r.weak.length > 0 && (
                        <div className="mt-0.5 truncate text-xs text-[var(--c-ff8a78)]">
                          {s.weak}: {weakNames(r)}
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button onClick={() => exportCsv(data, s, t, weakNames)} className={`${BTN} mt-4 w-full`}>
              <Download size={18} /> {s.exportCsv}
            </button>
          </>
        ) : (
          <div className={`p-4 text-sm ${BOX}`}>
            <p className="font-semibold text-[var(--c-e8d5ae)]">{s.empty}</p>
            <p className="mt-1 text-[var(--c-a08c64)]">{s.emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}
