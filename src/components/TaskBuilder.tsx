import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Copy, Send, Share2, Trash2, X } from 'lucide-react'
import { NOTES, type SaxNote } from '../data/notes'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { TASK } from '../lib/i18n/task'
import { usePersisted } from '../lib/persist'
import { SCALE_TYPES, TONIC_NAMES, type ScaleType } from '../lib/scales'
import type { Instrument } from '../lib/sound'
import { MAX_ITEMS, TASK_KINDS, taskUrl, type Task, type TaskItem, type TaskKind } from '../lib/task'

type T = (typeof STRINGS)['ru']

interface Props {
  onClose: () => void
  lang: Lang
  t: T
  /** строй пока не входит в задание: ученик играет на своём, а ноты письменные */
  instrument: Instrument
  nameOf: (n: SaxNote) => string
  currentNoteId: string
  melodies: Array<{ id: string; title: string }>
  trills: Array<{ id: string; title: string }>
}

// для длинного тона альтиссимо не предлагаем — это не ученическое упражнение
const PLAIN = NOTES.filter((n) => n.register !== 'altissimo')
const QUIZ_KINDS = [
  ['fingering', 'kindFingering'],
  ['name', 'kindName'],
  ['ear', 'kindEar'],
] as const

const FIELD =
  'h-10 rounded-lg border border-[var(--c-4a3b22)] bg-[var(--c-14100a)] px-2 text-sm font-semibold text-[var(--c-e8d5ae)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const BTN =
  'flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-2 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-not-allowed disabled:opacity-40'
const PRIMARY =
  'flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] px-3 text-sm font-semibold text-[var(--c-241a08)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs text-[var(--c-a08c64)]">
    {label}
    {children}
  </label>
)

/** числовое поле: пустое/мусор не пишем в черновик, границы — те же, что при разборе ссылки */
const Num = ({ label, value, lo, hi, set }: { label: string; value: number; lo: number; hi: number; set: (v: number) => void }) => (
  <Field label={label}>
    <input
      type="number"
      inputMode="numeric"
      min={lo}
      max={hi}
      value={value}
      onChange={(e) => {
        const v = Math.round(Number(e.target.value))
        if (Number.isFinite(v)) set(Math.max(lo, Math.min(hi, v)))
      }}
      className={`${FIELD} w-20`}
    />
  </Field>
)

export default function TaskBuilder({ onClose, lang, t, nameOf, currentNoteId, melodies, trills }: Props) {
  const s = pick(TASK, lang)
  const [draft, setDraft] = usePersisted<Task>('taskDraft', { items: [] })
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const items = draft.items

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const noteDefault = PLAIN.some((n) => n.id === currentNoteId) ? currentNoteId : 'g_4'
  const fresh = (k: TaskKind): TaskItem => {
    switch (k) {
      case 'scale':
        return { k, tonic: 0, type: 'major', octaves: 1, bpm: 80, min: 5 }
      case 'long':
        return { k, note: noteDefault, min: 5 }
      case 'quiz':
        return { k, kind: 'fingering', count: 10 }
      case 'melody':
        return { k, id: melodies[0]?.id ?? '' }
      case 'trill':
        return { k, id: trills[0]?.id ?? '' }
      case 'metro':
        return { k, bpm: 80, beats: 4, min: 5 }
      case 'note':
        return { k, note: currentNoteId }
    }
  }
  // мелодий/трелей может не быть (фича ещё не подключена) — кнопку тогда гасим
  const canAdd = (k: TaskKind) => items.length < MAX_ITEMS && (k === 'melody' ? melodies.length > 0 : k === 'trill' ? trills.length > 0 : true)

  const setItems = (next: TaskItem[]) => setDraft({ ...draft, items: next })
  const patch = (i: number, p: Partial<TaskItem>) => setItems(items.map((it, j) => (j === i ? ({ ...it, ...p } as TaskItem) : it)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setItems(next)
  }

  const url = useMemo(() => (items.length ? taskUrl(draft) : ''), [draft, items.length])
  const shareText = draft.title?.trim() || s.task

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // без https/разрешения буфер недоступен — выделяем текст, пусть копируют вручную
      linkRef.current?.select()
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const share = () => navigator.share({ title: shareText, url }).catch(() => {})

  const noteSelect = (list: SaxNote[], value: string, set: (id: string) => void) => (
    <Field label={t.note}>
      <select value={value} onChange={(e) => set(e.target.value)} className={FIELD}>
        {list.map((n) => (
          <option key={n.id} value={n.id}>
            {nameOf(n)}
          </option>
        ))}
      </select>
    </Field>
  )
  const listSelect = (list: Array<{ id: string; title: string }>, value: string, set: (id: string) => void, label: string) => (
    <Field label={label}>
      <select value={value} onChange={(e) => set(e.target.value)} className={`${FIELD} max-w-56`}>
        {!list.some((x) => x.id === value) && <option value={value}>{value || s.noneYet}</option>}
        {list.map((x) => (
          <option key={x.id} value={x.id}>
            {x.title}
          </option>
        ))}
      </select>
    </Field>
  )

  const fields = (it: TaskItem, i: number) => {
    switch (it.k) {
      case 'scale':
        return (
          <>
            <Field label={t.tonic}>
              <select value={it.tonic} onChange={(e) => patch(i, { tonic: Number(e.target.value) })} className={FIELD}>
                {TONIC_NAMES.map((n, pc) => (
                  <option key={pc} value={pc}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.scaleType}>
              <select value={it.type} onChange={(e) => patch(i, { type: e.target.value as ScaleType })} className={FIELD}>
                {SCALE_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t[ty]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.octaves}>
              <select value={it.octaves} onChange={(e) => patch(i, { octaves: e.target.value === '2' ? 2 : 1 })} className={FIELD}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </Field>
            <Num label={t.bpm} value={it.bpm} lo={20} hi={300} set={(v) => patch(i, { bpm: v })} />
            <Num label={s.minutes} value={it.min ?? 5} lo={1} hi={120} set={(v) => patch(i, { min: v })} />
          </>
        )
      case 'long':
        return (
          <>
            {noteSelect(PLAIN, it.note, (note) => patch(i, { note }))}
            <Num label={s.minutes} value={it.min} lo={1} hi={120} set={(v) => patch(i, { min: v })} />
          </>
        )
      case 'note':
        return noteSelect(NOTES, it.note, (note) => patch(i, { note }))
      case 'quiz':
        return (
          <>
            <Field label={s.quiz}>
              <select value={it.kind} onChange={(e) => patch(i, { kind: e.target.value as typeof it.kind })} className={FIELD}>
                {QUIZ_KINDS.map(([k, key]) => (
                  <option key={k} value={k}>
                    {t[key]}
                  </option>
                ))}
              </select>
            </Field>
            <Num label={s.count} value={it.count} lo={1} hi={100} set={(v) => patch(i, { count: v })} />
          </>
        )
      case 'melody':
        return listSelect(melodies, it.id, (id) => patch(i, { id }), s.melody)
      case 'trill':
        return listSelect(trills, it.id, (id) => patch(i, { id }), s.trill)
      case 'metro':
        return (
          <>
            <Num label={t.bpm} value={it.bpm} lo={20} hi={300} set={(v) => patch(i, { bpm: v })} />
            <Num label={s.beats} value={it.beats} lo={1} hi={12} set={(v) => patch(i, { beats: v })} />
            <Num label={s.minutes} value={it.min} lo={1} hi={120} set={(v) => patch(i, { min: v })} />
          </>
        )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={s.builderTitle}
    >
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-[var(--c-f2e3c2)]">{s.builderTitle}</h2>
          <button ref={closeRef} onClick={onClose} aria-label={t.close} className={`${BTN} rounded-full`}>
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={s.taskName}>
            <input
              value={draft.title ?? ''}
              maxLength={80}
              placeholder={s.taskNamePh}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label={s.teacher}>
            <input
              value={draft.from ?? ''}
              maxLength={40}
              placeholder={s.teacherPh}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className={FIELD}
            />
          </Field>
        </div>

        <ol className="mt-4 flex flex-col gap-2">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] p-2">
              <div className="mb-2 flex items-center gap-1">
                <span className="flex-1 text-sm font-semibold text-[var(--c-f2c14e)]">
                  {i + 1}. {s[it.k]}
                </span>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={s.up} className={BTN}>
                  <ArrowUp size={16} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={s.down} className={BTN}>
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={s.remove} className={`${BTN} hover:text-[var(--c-ff8a78)]`}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">{fields(it, i)}</div>
            </li>
          ))}
        </ol>

        <div className="mt-3 text-xs text-[var(--c-a08c64)]">{s.add}</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {TASK_KINDS.map((k) => (
            <button key={k} onClick={() => setItems([...items, fresh(k)])} disabled={!canAdd(k)} className={BTN}>
              + {s[k]}
            </button>
          ))}
        </div>
        {items.length >= MAX_ITEMS && <p className="mt-2 text-xs text-[var(--c-ff8a78)]">{s.tooMany}</p>}

        <div className="mt-4 border-t border-[var(--c-2e2415)] pt-3">
          {url ? (
            <>
              <Field label={s.link}>
                <div className="flex gap-2">
                  <input ref={linkRef} readOnly value={url} onFocus={(e) => e.target.select()} className={`${FIELD} min-w-0 flex-1 font-normal`} />
                  <button onClick={copy} aria-label={s.copy} className={BTN}>
                    <Copy size={16} />
                    <span className="text-xs">{copied ? s.copied : s.copy}</span>
                  </button>
                </div>
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={PRIMARY}
                >
                  <Send size={16} /> {s.telegram}
                </a>
                {typeof navigator.share === 'function' && (
                  <button onClick={share} className={BTN}>
                    <Share2 size={16} /> {s.share}
                  </button>
                )}
                <button onClick={() => setDraft({ items: [] })} className={`${BTN} ml-auto`}>
                  {s.clearAll}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--c-a08c64)]">{s.empty}</p>
          )}
        </div>
      </div>
    </div>
  )
}
