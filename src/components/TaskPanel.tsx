import { Check, ChevronDown, ChevronUp, ClipboardList, X } from 'lucide-react'
import type { SaxNote } from '../data/notes'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { TASK } from '../lib/i18n/task'
import { usePersisted } from '../lib/persist'
import { describeItem, type Task, type TaskItem } from '../lib/task'

type T = (typeof STRINGS)['ru']

interface Props {
  task: Task
  lang: Lang
  t: T
  nameOf: (n: SaxNote) => string
  onToggle: (index: number) => void
  onOpen: (item: TaskItem) => void
  /** спрятать задание целиком */
  onClose: () => void
  melodyTitle: (id: string) => string
  trillTitle: (id: string) => string
}

const BTN =
  'flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--c-4a3b22)] px-2 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'

export default function TaskPanel({ task, lang, t, nameOf, onToggle, onOpen, onClose, melodyTitle, trillTitle }: Props) {
  const s = pick(TASK, lang)
  const [collapsed, setCollapsed] = usePersisted('taskCollapsed', false)
  const done = task.items.filter((x) => x.done).length
  const all = task.items.length
  const finished = all > 0 && done === all

  return (
    <section className="mx-auto mb-3 w-full max-w-3xl rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-3" aria-label={s.task}>
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="shrink-0 text-[var(--c-f2c14e)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[var(--c-f2e3c2)]">{task.title || s.task}</div>
          <div className="text-xs text-[var(--c-a08c64)]">
            {task.from && (
              <>
                {s.from} {task.from} ·{' '}
              </>
            )}
            <span className={finished ? 'text-[var(--c-5fd27a)]' : undefined}>
              {done} {s.of} {all}
            </span>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? s.expand : s.collapse}
          className={BTN}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        <button onClick={onClose} aria-label={s.hide} className={BTN}>
          <X size={18} />
        </button>
      </div>

      {/* полоска прогресса видна и в свёрнутом виде — напоминает, что задание не закончено */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--c-2a2115)]" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] transition-all" style={{ width: `${all ? (100 * done) / all : 0}%` }} />
      </div>

      {!collapsed && (
        <>
          <ul className="mt-3 flex flex-col gap-2">
            {task.items.map((it, i) => {
              const text = describeItem(it, s, t, nameOf, melodyTitle, trillTitle)
              return (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] p-1.5">
                  <button
                    onClick={() => onToggle(i)}
                    role="checkbox"
                    aria-checked={!!it.done}
                    aria-label={`${s.markDone}: ${text}`}
                    className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
                      it.done ? 'border-[var(--c-2f6b3b)] bg-[var(--c-16351c)] text-[var(--c-5fd27a)]' : 'border-[var(--c-4a3b22)] text-transparent hover:border-[var(--c-6b5732)]'
                    }`}
                  >
                    <Check size={18} />
                  </button>
                  <span className={`min-w-0 flex-1 text-sm ${it.done ? 'text-[var(--c-7a6845)] line-through' : 'text-[var(--c-e8d5ae)]'}`}>{text}</span>
                  <button onClick={() => onOpen(it)} className={`${BTN} shrink-0 px-3`}>
                    {s.open}
                  </button>
                </li>
              )
            })}
          </ul>
          {finished && <p className="mt-3 text-center text-sm font-semibold text-[var(--c-5fd27a)]">{s.allDone}</p>}
        </>
      )}
    </section>
  )
}
