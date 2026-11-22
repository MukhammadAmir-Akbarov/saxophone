// Детские игры (7–12 лет): «Ноты на скорость», «Повтори ритм», «Найди клапан».
// Полноэкранный режим, как «Мелодии»: меню карточек → игра → итог со звёздами.
// Всё короткое (1–2 минуты), кнопки крупные: детские пальцы на телефоне промахиваются.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Drum, KeyRound, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import FingeringDiagram from './FingeringDiagram'
import { KEY_LABELS, NOTES, notationFile, type KeyId, type SaxNote } from '../data/notes'
import { keyLabel, pick, type Lang, type STRINGS } from '../lib/i18n'
import { GAMES_I18N } from '../lib/i18n/games'
import { usePersisted } from '../lib/persist'
import { audioCtx, playNote, stopAll, type Instrument } from '../lib/sound'
import {
  KEYS_ROUNDS,
  KID_KEYS,
  RHYTHMS,
  RHYTHM_BPM,
  RHYTHM_ROUNDS,
  SPEED_L1,
  SPEED_L2,
  SPEED_LEVEL2_AT,
  SPEED_SECONDS,
  audioToPerf,
  choices,
  comboMult,
  judgeTaps,
  onsets,
  parseRhythm,
  randOf,
  starsFor,
  tick,
  type GameId,
  type Hit,
  type KidKey,
} from '../lib/games'

type S = (typeof GAMES_I18N)['ru']

interface Props {
  instrument: Instrument
  lang: Lang
  /** общие строки — пока не нужны, но проп оставлен единым для всех режимов */
  t: (typeof STRINGS)['ru']
  /** диезы/бемоли уже учтены в nameOf — отдельно не нужен */
  sharp: boolean
  nameOf: (n: SaxNote) => string
}

const BTN =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-3 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-not-allowed disabled:opacity-40'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const PRIMARY = `flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 text-lg font-bold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-f2c14e)] ${ON}`
const BIG =
  'flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 text-2xl font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-default'
const BIG_IDLE = 'border-[var(--c-4a3b22)] bg-[var(--c-1a1509)] text-[var(--c-f0e6d2)] hover:border-[var(--c-d9a441)]'
const BIG_GOOD = 'border-[var(--c-5fd27a)] bg-[var(--c-1f4a29)] text-[var(--c-f0e6d2)]'
const BIG_BAD = 'border-[var(--c-ff8a78)] bg-[var(--c-6b2f2a)] text-[var(--c-f0e6d2)]'

const fmt = (tpl: string, ...a: Array<string | number>) => a.reduce<string>((s, v, i) => s.replace(`{${i + 1}}`, String(v)), tpl)
const praise = (s: S) => randOf([s.praise1, s.praise2, s.praise3, s.praise4])
const almost = (s: S) => randOf([s.almost1, s.almost2, s.almost3])
const BY_ID = new Map(NOTES.map((n) => [n.id, n]))
// детский «динь» — та же нота синтезом: короткая и не зависит от длины mp3
const ding = (id: string, inst: Instrument) => playNote(id, false, inst, { synth: true, seconds: 0.35 })

/** таймеры игры: снимаются все разом при выходе, чтобы ничего не «стреляло» после */
function useTimers() {
  const ids = useRef<number[]>([])
  useEffect(() => () => ids.current.forEach(clearTimeout), [])
  return useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms))
  }, [])
}

// Анимации — здесь, а не в index.css/tailwind.config: эти файлы ведёт другой участник.
// prefers-reduced-motion: конфетти не показываем вовсе, тряску выключаем.
const STYLE = `
@keyframes gm-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.gm-shake{animation:gm-shake .4s ease-in-out}
@keyframes gm-fall{0%{transform:translateY(-5vh) rotate(0)}100%{transform:translateY(105vh) rotate(720deg)}}
.gm-confetti span{position:absolute;top:0;width:10px;height:14px;border-radius:2px;animation:gm-fall 2.8s linear forwards}
@keyframes gm-pop{0%{transform:scale(1)}40%{transform:scale(.9)}100%{transform:scale(1)}}
.gm-pop{animation:gm-pop .15s ease-out}
@media (prefers-reduced-motion: reduce){.gm-confetti{display:none}.gm-shake,.gm-pop{animation:none}}
`

export default function Games({ instrument, lang, nameOf }: Props) {
  const s = pick(GAMES_I18N, lang)
  const [best, setBest] = usePersisted<Partial<Record<GameId, number>>>('gameBest', {})
  const [game, setGame] = useState<GameId | null>(null)
  const [result, setResult] = useState<{ value: number; newBest: boolean } | null>(null)
  // смена ключа пересоздаёт игру с нуля — «Ещё раз» без ручного сброса состояния
  const [run, setRun] = useState(0)

  // выход из режима посреди игры — глушим ноту (щелчки ритма гасит сама игра)
  useEffect(() => () => stopAll(), [])

  const finish = (g: GameId) => (value: number) => {
    setResult({ value, newBest: value > (best[g] ?? 0) })
    setBest((b) => ({ ...b, [g]: Math.max(b[g] ?? 0, value) }))
  }
  const open = (g: GameId | null) => {
    stopAll()
    setResult(null)
    setRun((r) => r + 1)
    setGame(g)
  }

  const CARDS: Array<{ id: GameId; title: string; desc: string; icon: typeof Zap; unit: string }> = [
    { id: 'speed', title: s.speedTitle, desc: s.speedDesc, icon: Zap, unit: s.speedUnit },
    { id: 'rhythm', title: s.rhythmTitle, desc: s.rhythmDesc, icon: Drum, unit: s.rhythmUnit },
    { id: 'keys', title: s.keysTitle, desc: s.keysDesc, icon: KeyRound, unit: s.keysUnit },
  ]

  if (game === null) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{s.title}</h2>
          <p className="mt-1 text-sm text-[var(--c-a08c64)]">{s.intro}</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CARDS.map(({ id, title, desc, icon: Icon, unit }) => {
            const b = best[id]
            return (
              <li key={id}>
                <button
                  onClick={() => open(id)}
                  className="flex h-full w-full cursor-pointer flex-col gap-3 rounded-2xl border-2 border-[var(--c-3a2f1c)] bg-[var(--c-1a1509)] p-5 text-left transition-colors hover:border-[var(--c-d9a441)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-f2c14e)]"
                >
                  <Icon size={40} className="text-[var(--c-f2c14e)]" aria-hidden />
                  <span className="text-xl font-bold text-[var(--c-f0e6d2)]">{title}</span>
                  <span className="text-sm text-[var(--c-c9b892)]">{desc}</span>
                  <span className="mt-auto flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--c-a08c64)]">
                      <Trophy size={14} className="me-1 inline" aria-hidden />
                      {b === undefined ? s.noBest : `${s.best}: ${b} ${unit}`}
                    </span>
                    <Stars n={b === undefined ? 0 : starsFor(id, b)} label={fmt(s.starsTpl, b === undefined ? 0 : starsFor(id, b))} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </main>
    )
  }

  const card = CARDS.find((c) => c.id === game)!
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 sm:px-6">
      <style>{STYLE}</style>
      <div className="flex items-center gap-2">
        <button onClick={() => open(null)} aria-label={s.back} className={BTN}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{card.title}</h2>
      </div>

      {result ? (
        <Result s={s} game={game} unit={card.unit} {...result} onAgain={() => open(game)} onMenu={() => open(null)} />
      ) : game === 'speed' ? (
        <SpeedGame key={run} s={s} instrument={instrument} nameOf={nameOf} onFinish={finish('speed')} />
      ) : game === 'rhythm' ? (
        <RhythmGame key={run} s={s} onFinish={finish('rhythm')} />
      ) : (
        <KeysGame key={run} s={s} lang={lang} instrument={instrument} onFinish={finish('keys')} />
      )}
    </main>
  )
}

function Stars({ n, label, big }: { n: number; label: string; big?: boolean }) {
  return (
    <span role="img" aria-label={label} className={`tracking-widest ${big ? 'text-6xl' : 'text-lg'}`}>
      <span className="text-[var(--c-f2c14e)]">{'★'.repeat(n)}</span>
      <span className="text-[var(--c-4a3b22)]">{'★'.repeat(3 - n)}</span>
    </span>
  )
}

const CONFETTI = ['var(--c-f2c14e)', 'var(--c-5fd27a)', 'var(--c-ff8a78)', 'var(--c-f6d98a)', 'var(--c-d9a441)']

function Result({ s, game, unit, value, newBest, onAgain, onMenu }: { s: S; game: GameId; unit: string; value: number; newBest: boolean; onAgain: () => void; onMenu: () => void }) {
  const stars = starsFor(game, value)
  const again = useRef<HTMLButtonElement>(null)
  // фокус на «Ещё раз»: с клавиатуры продолжить можно сразу, экранный диктор прочтёт итог
  useEffect(() => again.current?.focus(), [])
  return (
    <section className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] px-4 py-8 text-center" aria-live="polite">
      {stars > 0 && (
        <div className="gm-confetti pointer-events-none absolute inset-0" aria-hidden>
          {/* позиции «псевдослучайные» от индекса: Math.random в рендере дёргал бы их при каждой перерисовке */}
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 9) * 0.12}s` }} />
          ))}
        </div>
      )}
      <p className="text-sm text-[var(--c-a08c64)]">{s.result}</p>
      <Stars n={stars} label={fmt(s.starsTpl, stars)} big />
      <p className="text-4xl font-bold text-[var(--c-f0e6d2)]">
        {value} <span className="text-lg font-semibold text-[var(--c-c9b892)]">{unit}</span>
      </p>
      {newBest && value > 0 && (
        <p className="flex items-center gap-2 rounded-full bg-[var(--c-1f4a29)] px-4 py-1 font-bold text-[var(--c-5fd27a)]">
          <Trophy size={18} aria-hidden /> {s.newBest}
        </p>
      )}
      <p className="text-lg text-[var(--c-e8d5ae)]">{[s.end0, s.end1, s.end2, s.end3][stars]}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button ref={again} onClick={onAgain} className={PRIMARY}>
          <RotateCcw size={20} aria-hidden /> {s.again}
        </button>
        <button onClick={onMenu} className={`${BTN} h-14 px-6 text-base`}>
          {s.toMenu}
        </button>
      </div>
    </section>
  )
}

// ── 1. Ноты на скорость ──────────────────────────────────────────────────

interface Q {
  id: string
  opts: string[]
  n: number // номер вопроса — ключ для повторного запуска анимации
}

function nextQ(correct: number, prev: string | null, n: number): Q {
  const pool = correct >= SPEED_LEVEL2_AT ? SPEED_L2 : SPEED_L1
  // одна и та же нота два раза подряд выглядит как зависание
  const id = randOf(pool.filter((x) => x !== prev))
  return { id, opts: choices(id, pool, 4), n }
}

function SpeedGame({ s, instrument, nameOf, onFinish }: { s: S; instrument: Instrument; nameOf: (n: SaxNote) => string; onFinish: (v: number) => void }) {
  const [q, setQ] = useState<Q>(() => nextQ(0, null, 0))
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [fb, setFb] = useState<{ chosen: string; ok: boolean; text: string } | null>(null)
  // дедлайн, а не счётчик тиков: таймеры в фоновой вкладке тормозят, а 60 с — это 60 с
  const [deadline] = useState(() => Date.now() + SPEED_SECONDS * 1000)
  const [left, setLeft] = useState(SPEED_SECONDS)
  const later = useTimers()
  const finished = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250)
    return () => clearInterval(id)
  }, [deadline])
  useEffect(() => {
    if (left > 0 || finished.current) return
    finished.current = true
    onFinish(score)
  }, [left, score, onFinish])

  const answer = (id: string) => {
    if (fb || left === 0) return
    const ok = id === q.id
    if (ok) {
      const st = streak + 1
      setStreak(st)
      setScore((v) => v + comboMult(st))
      setCorrect((c) => c + 1)
      ding(q.id, instrument)
    } else setStreak(0)
    setFb({ chosen: id, ok, text: ok ? praise(s) : `${almost(s)} ${fmt(s.correctWasTpl, nameOf(BY_ID.get(q.id)!))}` })
    // после ошибки — подольше: ребёнок должен успеть увидеть правильный ответ
    later(() => {
      setFb(null)
      setQ(nextQ(correct + (ok ? 1 : 0), q.id, q.n + 1))
    }, ok ? 450 : 1300)
  }

  const mult = comboMult(streak)
  const lvl2 = correct >= SPEED_LEVEL2_AT
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
        <span className={`flex items-center gap-1.5 ${left <= 10 ? 'text-[var(--c-ff8a78)]' : 'text-[var(--c-e8d5ae)]'}`} aria-label={`${s.time}: ${left}`}>
          <Timer size={20} aria-hidden /> {left}
        </span>
        {mult > 1 && <span className="rounded-full bg-[var(--c-3a2f1c)] px-3 py-0.5 text-[var(--c-f2c14e)]">{fmt(s.comboTpl, mult)}</span>}
        <span className="text-[var(--c-f2c14e)]">
          {s.score}: {score}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--c-2a2115)]" aria-hidden>
        <div className="h-full bg-[var(--c-d9a441)] transition-[width] duration-300" style={{ width: `${(left / SPEED_SECONDS) * 100}%` }} />
      </div>
      {lvl2 && <p className="text-center text-sm font-semibold text-[var(--c-5fd27a)]">{s.level2}</p>}
      <p className="text-center text-xl font-bold text-[var(--c-f0e6d2)]">{s.whichNote}</p>
      <div
        key={q.n}
        className={`mx-auto flex max-w-sm justify-center rounded-2xl bg-white p-3 ring-4 transition-shadow ${fb?.ok ? 'ring-[var(--c-5fd27a)]' : fb ? 'gm-shake ring-[var(--c-ff8a78)]' : 'ring-transparent'}`}
      >
        <img src={notationFile(q.id)} alt={s.noteOnStaff} className="h-36 w-auto object-contain" />
      </div>
      <p className="min-h-7 text-center text-lg font-bold" aria-live="polite" style={{ color: fb?.ok ? 'var(--c-5fd27a)' : 'var(--c-ff8a78)' }}>
        {fb?.text}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {q.opts.map((id) => {
          const cls = fb && id === q.id ? BIG_GOOD : fb && id === fb.chosen ? BIG_BAD : BIG_IDLE
          return (
            <button key={id} onClick={() => answer(id)} disabled={!!fb} className={`${BIG} ${cls}`}>
              {nameOf(BY_ID.get(id)!)}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ── 2. Повтори ритм ──────────────────────────────────────────────────────

type Phase = 'idle' | 'count' | 'listen' | 'ready' | 'tap' | 'result'
const BEAT = 60 / RHYTHM_BPM
/** окно приёма ударов чуть шире такта: ранний первый и поздний последний удар тоже считаем */
const TAP_MARGIN = 0.25

function RhythmGame({ s, onFinish }: { s: S; onFinish: (v: number) => void }) {
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scores, setScores] = useState<number[]>([])
  const [last, setLast] = useState<ReturnType<typeof judgeTaps> | null>(null)
  const nodes = useRef<OscillatorNode[]>([])
  const taps = useRef<number[]>([])
  const expected = useRef<number[]>([])
  const tapping = useRef(false)
  const drum = useRef<HTMLButtonElement>(null)
  const later = useTimers()

  const pattern = RHYTHMS[round % RHYTHMS.length]
  const notes = useMemo(() => parseRhythm(pattern), [pattern])

  const silence = () => {
    nodes.current.forEach((n) => {
      try {
        n.stop()
      } catch {
        /* уже отзвучал */
      }
    })
    nodes.current = []
  }
  // выход посреди раунда — запланированные щелчки иначе доиграли бы такт
  useEffect(() => () => silence(), [])

  const start = () => {
    silence()
    const ac = audioCtx()
    // запас 0.3 с: контекст мог только что проснуться после жеста
    const t0 = ac.currentTime + 0.3
    const at = (beats: number) => t0 + beats * BEAT
    const add = (n: OscillatorNode) => nodes.current.push(n)
    // такт 1 — отсчёт, 2 — ритм, 3 — снова отсчёт, 4 — стучит ребёнок под тихий пульс
    for (let i = 0; i < 4; i++) {
      add(tick(at(i), i === 0 ? 1600 : 1100, 0.5))
      add(tick(at(8 + i), i === 0 ? 1600 : 1100, 0.5))
      add(tick(at(12 + i), 1100, 0.12))
    }
    const on = onsets(pattern)
    // «барабан» — низкий и длиннее щелчка, чтобы ритм отличался от отсчёта
    on.forEach((o) => add(tick(at(4 + o), 220, 0.9, 0.18)))
    expected.current = on.map((o) => audioToPerf(at(12 + o)))
    taps.current = []
    const wait = (beats: number, extra = 0) => Math.max(0, audioToPerf(at(beats) + extra) - performance.now())
    setLast(null)
    setPhase('count')
    later(() => setPhase('listen'), wait(4))
    later(() => setPhase('ready'), wait(8))
    later(() => {
      tapping.current = true
      setPhase('tap')
      drum.current?.focus()
    }, wait(12, -TAP_MARGIN))
    later(() => {
      tapping.current = false
      const r = judgeTaps(expected.current, taps.current)
      setLast(r)
      setScores((v) => [...v, r.accuracy])
      setPhase('result')
    }, wait(16, TAP_MARGIN))
  }

  const onTap = (time: number) => {
    // анимацию «вдавливания» перезапускаем вручную: перемонтаж кнопки по key сбил бы фокус
    const el = drum.current
    if (el) {
      el.classList.remove('gm-pop')
      void el.offsetWidth
      el.classList.add('gm-pop')
    }
    if (!tapping.current) return
    taps.current.push(time)
    // мгновенный отклик на удар — без него кажется, что барабан «не нажался»
    nodes.current.push(tick(audioCtx().currentTime, 300, 0.6, 0.1))
  }

  // пробел — тот же удар. keyup тоже гасим: иначе пробел на кнопке «Назад» нажал бы её
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== ' ' || phase !== 'tap') return
      e.preventDefault()
      if (!e.repeat) onTap(e.timeStamp)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && phase === 'tap') e.preventDefault()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [phase])

  const isLast = round + 1 >= RHYTHM_ROUNDS
  const next = () => {
    if (isLast) return onFinish(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length))
    setRound((r) => r + 1)
    setPhase('idle')
  }

  const label = { idle: '', count: s.countIn, listen: s.listen, ready: s.getReady, tap: s.yourTurn, result: '' }[phase]
  // кружок под каждой нотой: результат удара (паузы — без кружка)
  let hitIdx = 0
  const HIT_COLOR: Record<Hit, string> = { good: 'var(--c-5fd27a)', ok: 'var(--c-f2c14e)', miss: 'var(--c-ff8a78)' }
  const HIT_TEXT: Record<Hit, string> = { good: s.hitGood, ok: s.hitOk, miss: s.hitMiss }

  return (
    <section className="space-y-5">
      <p className="text-center text-sm font-semibold text-[var(--c-a08c64)]">{fmt(s.roundTpl, round + 1, RHYTHM_ROUNDS)}</p>

      <div className="flex gap-1.5" role="list" aria-label={s.pattern}>
        {notes.map((n, i) => {
          const hit = !n.rest && last ? last.hits[hitIdx++] : undefined
          return (
            <div key={i} role="listitem" className="flex flex-col items-center gap-2" style={{ flexGrow: n.dur, flexBasis: 0 }} aria-label={hit ? HIT_TEXT[hit] : undefined}>
              <div
                className={`h-10 w-full rounded-lg border-2 ${n.rest ? 'border-dashed border-[var(--c-4a3b22)]' : 'border-[var(--c-d9a441)] bg-[var(--c-3a2f1c)]'}`}
                aria-hidden
              />
              <span className="h-5 w-5 rounded-full" style={{ background: hit ? HIT_COLOR[hit] : 'transparent' }} aria-hidden />
            </div>
          )
        })}
      </div>

      <p className="min-h-8 text-center text-2xl font-bold text-[var(--c-f2c14e)]" aria-live="assertive">
        {label}
      </p>

      <div className="flex justify-center">
        <button
          ref={drum}
          onPointerDown={(e) => onTap(e.timeStamp)}
          aria-label={s.drum}
          className={`flex h-44 w-44 cursor-pointer select-none items-center justify-center rounded-full border-4 ${phase === 'tap' ? 'border-[var(--c-f2c14e)] bg-[var(--c-4a3b22)]' : 'border-[var(--c-4a3b22)] bg-[var(--c-241c11)]'} text-[var(--c-f6d98a)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--c-f2c14e)]`}
          style={{ touchAction: 'manipulation' }}
        >
          <Drum size={72} aria-hidden />
        </button>
      </div>
      <p className="text-center text-xs text-[var(--c-7a6845)]">{s.spaceHint}</p>

      {phase === 'idle' && (
        <div className="flex justify-center">
          <button onClick={start} className={PRIMARY}>
            {s.startRound}
          </button>
        </div>
      )}
      {phase === 'result' && last && (
        <div className="space-y-3 text-center" aria-live="polite">
          <p className="text-xl font-bold" style={{ color: last.accuracy >= 70 ? 'var(--c-5fd27a)' : 'var(--c-f2c14e)' }}>
            {last.accuracy >= 70 ? praise(s) : almost(s)} {fmt(s.accuracyTpl, last.accuracy)}
          </p>
          {last.extra > 0 && <p className="text-sm text-[var(--c-c9b892)]">{fmt(s.extraTpl, last.extra)}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={next} className={PRIMARY}>
              {isLast ? s.finish : s.next}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ── 3. Найди клапан ──────────────────────────────────────────────────────

const NO_KEYS = new Set<KeyId>()

function KeysGame({ s, lang, instrument, onFinish }: { s: S; lang: Lang; instrument: Instrument; onFinish: (v: number) => void }) {
  const [round, setRound] = useState(0)
  const [target, setTarget] = useState<KidKey>(() => randOf(KID_KEYS))
  const [opts, setOpts] = useState<KidKey[]>(() => choices(target, KID_KEYS, 3))
  const [correct, setCorrect] = useState(0)
  const [fb, setFb] = useState<{ chosen: KeyId; ok: boolean; text: string } | null>(null)
  const later = useTimers()
  // чётные раунды — «нажми клапан», нечётные — «как зовут светящийся»: два навыка по очереди
  const tapMode = round % 2 === 0
  const name = (k: KeyId) => keyLabel(k, lang, KEY_LABELS)
  const names = useMemo(() => Object.fromEntries((Object.keys(KEY_LABELS) as KeyId[]).map((k) => [k, keyLabel(k, lang, KEY_LABELS)])), [lang])
  const hint = (k: KidKey) => s[`h_${k}` as const]

  const answer = (k: KeyId) => {
    if (fb) return
    const ok = k === target
    if (ok) {
      setCorrect((c) => c + 1)
      // одна и та же нота-«динь»: награда за ответ, а не подсказка о высоте
      ding('b_4', instrument)
    }
    setFb({ chosen: k, ok, text: ok ? praise(s) : `${almost(s)} ${name(target)}` })
    later(() => {
      if (round + 1 >= KEYS_ROUNDS) return onFinish(correct + (ok ? 1 : 0))
      const t = randOf(KID_KEYS.filter((x) => x !== target))
      setTarget(t)
      setOpts(choices(t, KID_KEYS, 3))
      setRound((r) => r + 1)
      setFb(null)
    }, ok ? 900 : 1800)
  }

  // подсветка: верно — клапан золотой; ошибка — нажатый красный, нужный зелёным пунктиром;
  // в «как зовут» нужный клапан с самого начала обведён пунктиром — он и «светится»
  const pressed = fb?.ok ? new Set<KeyId>([target]) : NO_KEYS
  const missing = (!tapMode && !fb?.ok) || (fb && !fb.ok) ? new Set<KeyId>([target]) : NO_KEYS
  const extra = fb && !fb.ok && tapMode ? new Set<KeyId>([fb.chosen]) : NO_KEYS

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-[var(--c-a08c64)]">
        <span>{fmt(s.roundTpl, round + 1, KEYS_ROUNDS)}</span>
        <span className="text-lg text-[var(--c-f2c14e)]">★ {correct}</span>
      </div>
      <div className="rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1a1509)] p-4 text-center">
        {tapMode ? (
          <>
            <p className="text-sm text-[var(--c-a08c64)]">{s.tapKey}</p>
            <p className="text-2xl font-bold text-[var(--c-f0e6d2)]">{hint(target)}</p>
            <p className="text-sm text-[var(--c-c9b892)]">({name(target)})</p>
          </>
        ) : (
          <p className="text-xl font-bold text-[var(--c-f0e6d2)]">{s.whichKey}</p>
        )}
        <p className="mt-1 min-h-7 text-lg font-bold" aria-live="polite" style={{ color: fb?.ok ? 'var(--c-5fd27a)' : 'var(--c-ff8a78)' }}>
          {fb?.text}
        </p>
      </div>

      <div className={`grid gap-4 ${tapMode ? '' : 'sm:grid-cols-[1fr_auto]'} items-center`}>
        <div key={`${round}-${fb ? 'a' : 'q'}`} className={`flex justify-center ${fb && !fb.ok ? 'gm-shake' : ''}`}>
          <FingeringDiagram
            pressed={pressed}
            missing={missing}
            extra={extra}
            onToggle={tapMode ? answer : undefined}
            label={s.diagram}
            bisLabel={name('bis')}
            names={names}
          />
        </div>
        {!tapMode && (
          <div className="grid gap-3 sm:w-64">
            {opts.map((k) => {
              const cls = fb && k === target ? BIG_GOOD : fb && k === fb.chosen ? BIG_BAD : BIG_IDLE
              return (
                <button key={k} onClick={() => answer(k)} disabled={!!fb} className={`${BIG} ${cls} flex-col text-xl`}>
                  {name(k)}
                  <span className="text-xs font-normal opacity-80">{hint(k)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
