import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Play, X } from 'lucide-react'
import type { SaxNote } from '../data/notes'
import { findProgram, loc, programWeekTask, PROGRAMS, type Program } from '../data/programs'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { PROGRAMS_I18N } from '../lib/i18n/programs'
import { TASK } from '../lib/i18n/task'
import { describeItem, type Task } from '../lib/task'

type T = (typeof STRINGS)['ru']
type Meta = { programId: string; week: number }

interface Props {
  onClose: () => void
  lang: Lang
  t: T
  /** week — индекс недели с нуля */
  onStart: (task: Task, meta: Meta) => void
  /** программа, которую ученик сейчас проходит (хранит Home, не мы) */
  current?: Meta
  nameOf: (n: SaxNote) => string
  melodyTitle: (id: string) => string
  trillTitle: (id: string) => string
}

const BTN =
  'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-3 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const PRIMARY =
  'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] px-3 text-sm font-semibold text-[var(--c-241a08)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'

const LEVEL = { beginner: 'levelBeginner', intermediate: 'levelIntermediate', all: 'levelAll' } as const
const fill = (s: string, n: number) => s.replace('{1}', String(n))

export default function ProgramsModal({ onClose, lang, t, onStart, current, nameOf, melodyTitle, trillTitle }: Props) {
  const s = pick(PROGRAMS_I18N, lang)
  const ts = pick(TASK, lang)
  const closeRef = useRef<HTMLButtonElement>(null)
  // начатая программа открывается сразу на своих неделях — за ней ученик обычно и пришёл
  const [openId, setOpenId] = useState<string | null>(current && findProgram(current.programId) ? current.programId : null)
  const program = openId ? findProgram(openId) : undefined

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const start = (p: Program, week: number) => onStart(programWeekTask(p, week, lang), { programId: p.id, week })
  const curWeek = program && current?.programId === program.id ? current.week : -1
  const hasNext = program && curWeek >= 0 && curWeek + 1 < program.weeks.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={s.title}>
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          {program && (
            <button onClick={() => setOpenId(null)} aria-label={s.back} className={`${BTN} w-10 px-0`}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-[var(--c-f2e3c2)]">{program ? loc(program.title, lang) : s.title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-d9c9a8)] transition-colors hover:bg-[var(--c-2a2115)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <X size={20} />
          </button>
        </div>

        {!program ? (
          <>
            <p className="mb-4 text-sm leading-relaxed text-[var(--c-c9b892)]">{s.intro}</p>
            <ul className="flex flex-col gap-2">
              {PROGRAMS.map((p) => {
                const isCur = current?.programId === p.id
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setOpenId(p.id)}
                      className={`w-full cursor-pointer rounded-xl border bg-[var(--c-14100a)] p-3 text-left transition-colors hover:bg-[var(--c-241c11)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
                        isCur ? 'border-[var(--c-d9a441)]' : 'border-[var(--c-2e2415)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="shrink-0 text-[var(--c-f2c14e)]" aria-hidden />
                        <span className="min-w-0 flex-1 font-semibold text-[var(--c-f2e3c2)]">{loc(p.title, lang)}</span>
                        {isCur && <span className="text-xs font-semibold text-[var(--c-f2c14e)]">{s.current}</span>}
                      </div>
                      <div className="mt-1 text-xs text-[var(--c-a08c64)]">
                        {s[LEVEL[p.level]]} · {fill(s.weeks, p.weeks.length)}
                      </div>
                      <p className="mt-1 text-sm text-[var(--c-c9b892)]">{loc(p.desc, lang)}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-[var(--c-c9b892)]">{loc(program.desc, lang)}</p>
            {hasNext && (
              <button onClick={() => start(program, curWeek + 1)} className={`${PRIMARY} mb-3 w-full`}>
                <Play size={16} aria-hidden /> {s.next}: {fill(s.week, curWeek + 2)}
              </button>
            )}
            <ol className="flex flex-col gap-3">
              {program.weeks.map((w, wi) => {
                const isCur = wi === curWeek
                return (
                  <li
                    key={wi}
                    aria-current={isCur ? 'step' : undefined}
                    className={`rounded-xl border bg-[var(--c-14100a)] p-3 ${isCur ? 'border-[var(--c-d9a441)]' : 'border-[var(--c-2e2415)]'}`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase text-[var(--c-a08c64)]">{fill(s.week, wi + 1)}</span>
                      <span className="min-w-0 flex-1 font-semibold text-[var(--c-f2e3c2)]">{loc(w.title, lang)}</span>
                      {isCur && <span className="text-xs font-semibold text-[var(--c-f2c14e)]">{s.current}</span>}
                    </div>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-[var(--c-d9c9a8)]">
                      {w.items.map((it, i) => (
                        <li key={i}>{describeItem(it, ts, t, nameOf, melodyTitle, trillTitle)}</li>
                      ))}
                    </ul>
                    {/* текущую неделю можно начать заново — например, если задание случайно скрыли */}
                    <button onClick={() => start(program, wi)} className={`${isCur ? PRIMARY : BTN} mt-3`}>
                      <Play size={16} aria-hidden /> {fill(s.start, wi + 1)}
                    </button>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
