import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { KEY_LABELS, NOTES } from '../data/notes'
import { TRILLS, toKeys, type Trill } from '../data/trills'
import FingeringDiagram from './FingeringDiagram'
import { keyLabel, pick, type Lang, type STRINGS } from '../lib/i18n'
import { TRILLS_I18N } from '../lib/i18n/trills'
import { usePersisted } from '../lib/persist'
import { playNote, stopAll, type Instrument } from '../lib/sound'
import { toCyrillic } from '../lib/translit'

interface Props {
  instrument: Instrument
  lang: Lang
  t: (typeof STRINGS)['ru']
  /** диезные имена (C♯ вместо D♭) */
  sharp: boolean
  /** открыть сразу на этой трели (id из TRILLS) */
  initialId?: string
}

type Speed = 'slow' | 'medium' | 'fast'
// длительность одной ноты трели, мс: 8 пар на «быстро» укладываются в ~1.5 с
const STEP: Record<Speed, number> = { slow: 260, medium: 160, fast: 95 }
const PAIRS = 8

const BTN =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-3 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'

const byId = (id: string) => NOTES.find((n) => n.id === id)!

function tipText(tr: Trill, lang: Lang): string {
  if (lang === 'uzc') return toCyrillic(tr.tip.uz)
  return tr.tip[lang]
}

export default function Trills({ instrument, lang, t, sharp, initialId }: Props) {
  const s = pick(TRILLS_I18N, lang)
  const [savedId, setSavedId] = usePersisted('trillId', TRILLS[0].id)
  const [speed, setSpeed] = usePersisted<Speed>('trillSpeed', 'medium')
  // initialId (ссылка извне) важнее сохранённого выбора, но только при открытии
  const [id, setId] = useState(() => (initialId && TRILLS.some((x) => x.id === initialId) ? initialId : savedId))
  const [second, setSecond] = useState(false)
  // какая нота звучит сейчас во время трели (null — не играем): схема «мигает» вместе со звуком
  const [phase, setPhase] = useState<0 | 1 | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tr = TRILLS.find((x) => x.id === id) ?? TRILLS[0]
  const name = (noteId: string) => {
    const n = byId(noteId)
    return sharp && n.sharp ? n.sharp : n.flat
  }

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    stopAll()
    setPhase(null)
  }
  // ушли с экрана — ни таймеров, ни звука
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    stopAll()
  }, [])

  const play = () => {
    stop()
    const ms = STEP[speed]
    const tick = (k: number) => {
      if (k >= PAIRS * 2) return stop()
      const p = (k % 2) as 0 | 1
      setPhase(p)
      // всегда синтез (hasRecording=false): mp3 через new Audio() каждый раз грузится
      // заново и запаздывает — на быстрой трели ритм развалился бы
      playNote(p ? tr.to : tr.from, false, instrument, { seconds: (ms / 1000) * 0.95 })
      timer.current = setTimeout(() => tick(k + 1), ms)
    }
    tick(0)
  }

  const select = (x: Trill) => {
    stop()
    setId(x.id)
    setSavedId(x.id)
    setSecond(false)
  }

  const showTo = phase === null ? second : phase === 1
  // Set из 1–10 клапанов дешевле, чем useMemo (и React Compiler мемоизирует сам)
  const pressed = new Set(showTo ? toKeys(tr) : tr.base)
  const moving = new Set(tr.move)
  const keys = (ks: Trill['base']) => ks.map((k) => keyLabel(k, lang, KEY_LABELS)).join(' · ')

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div>
        <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{s.title}</h2>
        <p className="mt-1 text-sm text-[var(--c-a08c64)]">{s.intro}</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label={s.list}>
        {TRILLS.map((x) => (
          <div key={x.id} role="listitem" className="shrink-0">
          <button
            onClick={() => select(x)}
            aria-current={x.id === tr.id}
            className={`h-10 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
              x.id === tr.id ? `${ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]` : 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] hover:border-[var(--c-6b5732)] hover:text-[var(--c-f2c14e)]'
            }`}
          >
            {name(x.from)} ⇄ {name(x.to)}
          </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="order-2 flex flex-col items-center gap-3 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-1">
          <FingeringDiagram pressed={pressed} missing={moving} bisLabel={t.bis} label={`${s.showing}: ${name(showTo ? tr.to : tr.from)}`} />
          <p className="text-center text-sm text-[var(--c-a08c64)]" aria-live="polite">
            {s.showing}: <span className="font-semibold text-[var(--c-f2c14e)]">{name(showTo ? tr.to : tr.from)}</span>
          </p>
        </section>

        <section className="order-1 space-y-4 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-2">
          <div className="font-display text-4xl leading-none text-[var(--c-f2c14e)]">
            {name(tr.from)} ⇄ {name(tr.to)}
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--c-a08c64)]">{s.hold}</dt>
              <dd className="font-semibold text-[var(--c-e8d5ae)]">{tr.base.length ? keys(tr.base) : t.allOpen}</dd>
            </div>
            <div>
              <dt className="text-[var(--c-a08c64)]">
                {s.move} <span className="text-xs">({s.moveHint})</span>
              </dt>
              <dd className="font-semibold text-[var(--c-5fd27a)]">{keys(tr.move)}</dd>
            </div>
          </dl>
          <p className="rounded-xl border border-[var(--c-3a2f1c)] bg-[var(--c-14100a)] p-3 text-sm leading-relaxed text-[var(--c-d9c9a8)]">{tipText(tr, lang)}</p>

          <div className="flex rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="group" aria-label={s.speed}>
            {(['slow', 'medium', 'fast'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  stop()
                  setSpeed(v)
                }}
                aria-pressed={speed === v}
                className={`h-10 flex-1 cursor-pointer rounded-[10px] px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${speed === v ? ON : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'}`}
              >
                {s[v]}
              </button>
            ))}
          </div>

          <button
            onClick={() => (phase === null ? play() : stop())}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${ON}`}
          >
            {phase === null ? <Play size={18} /> : <Square size={18} />}
            {phase === null ? s.play : t.stop}
          </button>

          <button onClick={() => setSecond((v) => !v)} aria-pressed={second} disabled={phase !== null} className={`${BTN} w-full disabled:cursor-not-allowed disabled:opacity-40 ${second ? 'border-[var(--c-f2c14e)] text-[var(--c-f2c14e)]' : ''}`}>
            {s.showSecond}
          </button>
        </section>
      </div>
    </main>
  )
}
