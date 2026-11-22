// Экран «Мелодии»: список мелодий + своя мелодия текстом, и три режима для
// выбранной: «Слушать» (под метроном), «Играть с проверкой» (микрофон) и «По шагам».

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Minus, Music, Pencil, Play, Plus, RotateCcw, SkipForward, Square, Volume2 } from 'lucide-react'
import { NOTES, notationFile } from '../data/notes'
import { MELODIES, type Melody } from '../data/melodies'
import FingeringDiagram from './FingeringDiagram'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { MELODIES_I18N } from '../lib/i18n/melodies'
import { parseMelody, type MelodyNote } from '../lib/melody'
import { clampBpm, onMetronomeChange, startMetronome, stopMetronome } from '../lib/metronome'
import { usePersisted } from '../lib/persist'
import { midiName, playNote, stopAll, writtenMidi, type Instrument } from '../lib/sound'
import { toCyrillic } from '../lib/translit'
import { usePitch } from '../lib/usePitch'

type Strings = (typeof STRINGS)['ru']
type S = (typeof MELODIES_I18N)['ru']

interface Props {
  instrument: Instrument
  lang: Lang
  t: Strings
  bpm: number
  setBpm: (v: number) => void
  sharp: boolean
  /** открыть сразу эту мелодию (например, из задания учителя) */
  initialMelodyId?: string
  /** открыть «Свою мелодию» с этим текстом (ссылка) — сохранённый текст не затирается, пока ученик не начнёт править */
  initialText?: string
}

type Mode = 'listen' | 'check' | 'steps'
const CUSTOM = 'custom'

const BTN =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-3 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-not-allowed disabled:opacity-40'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const PRIMARY = `flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${ON}`

const titleOf = (m: Melody, lang: Lang) => (lang === 'uzc' ? toCyrillic(m.title.uz) : m.title[lang])

const FRAC: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' }
/** 1.5 → «1½», 0.5 → «½»: подпись длительности на фишке ноты */
function beatsLabel(b: number): string {
  const whole = Math.floor(b)
  const rest = +(b - whole).toFixed(3)
  if (!rest) return String(whole)
  const f = FRAC[String(rest)]
  return f ? (whole ? whole + f : f) : String(+b.toFixed(2))
}

const noteName = (n: MelodyNote) => (n.index === null ? '' : n.sharp && NOTES[n.index].sharp ? NOTES[n.index].sharp! : NOTES[n.index].flat)

export default function Melodies({ instrument, lang, t, bpm, setBpm, sharp, initialMelodyId, initialText }: Props) {
  const s = pick(MELODIES_I18N, lang)
  const [savedCustom, setSavedCustom] = usePersisted('melodyCustom', '')
  // текст из ссылки показываем поверх сохранённого; при первой правке он становится своим
  const [linkText, setLinkText] = useState<string | undefined>(initialText)
  const customText = linkText ?? savedCustom
  const [selected, setSelected] = useState<string | null>(() =>
    initialText !== undefined ? CUSTOM : initialMelodyId && MELODIES.some((m) => m.id === initialMelodyId) ? initialMelodyId : null,
  )

  const melody = MELODIES.find((m) => m.id === selected)
  const text = selected === CUSTOM ? customText : (melody?.text ?? '')
  // мемоизацию делает React Compiler
  const parsed = parseMelody(text)

  const open = (id: string) => {
    const m = MELODIES.find((x) => x.id === id)
    // у каждой мелодии свой удобный темп; ученик потом подвинет −/+
    if (m) setBpm(m.bpm)
    setSelected(id)
  }

  if (selected === null) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{s.title}</h2>
          <p className="mt-1 text-sm text-[var(--c-a08c64)]">{s.intro}</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MELODIES.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => open(m.id)}
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--c-3a2f1c)] bg-[var(--c-1a1509)] px-4 py-3 text-left transition-colors hover:border-[var(--c-6b5732)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
              >
                <span className="flex items-center gap-3">
                  <Music size={18} className="shrink-0 text-[var(--c-d9a441)]" />
                  <span className="font-semibold text-[var(--c-f0e6d2)]">{titleOf(m, lang)}</span>
                </span>
                <span className="shrink-0 text-sm tracking-widest text-[var(--c-d9a441)]" aria-label={`${s.level} ${m.level}/3`}>
                  {'★'.repeat(m.level)}
                  <span className="text-[var(--c-5c4c2e)]">{'★'.repeat(3 - m.level)}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => setSelected(CUSTOM)}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--c-6b5732)] bg-[var(--c-14100a)] px-4 py-3 text-left hover:border-[var(--c-d9a441)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
            >
              <Pencil size={18} className="shrink-0 text-[var(--c-d9a441)]" />
              <span>
                <span className="block font-semibold text-[var(--c-f0e6d2)]">{s.custom}</span>
                <span className="block text-xs text-[var(--c-a08c64)]">{s.customDesc}</span>
              </span>
            </button>
          </li>
        </ul>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setSelected(null)} aria-label={s.back} className={BTN}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{melody ? titleOf(melody, lang) : s.custom}</h2>
      </div>

      {selected === CUSTOM && (
        <section className="space-y-2 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4">
          <label htmlFor="melodyText" className="text-sm font-semibold text-[var(--c-e8d5ae)]">
            {s.customLabel}
          </label>
          <textarea
            id="melodyText"
            value={customText}
            onChange={(e) => {
              setLinkText(undefined)
              setSavedCustom(e.target.value)
            }}
            rows={3}
            spellCheck={false}
            placeholder="G4 A4 B4:2 | r B4 A4 G4:2"
            className="w-full rounded-xl border border-[var(--c-4a3b22)] bg-[var(--c-14100a)] p-3 font-mono text-sm text-[var(--c-f0e6d2)] placeholder:text-[var(--c-5c4c2e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          />
          <p className="text-xs text-[var(--c-a08c64)]">{s.customHelp}</p>
          {parsed.errors.length > 0 && (
            <p className="text-sm text-[var(--c-ff8a78)]" role="alert">
              {s.errors}: <span className="font-mono">{parsed.errors.join('  ')}</span>
            </p>
          )}
        </section>
      )}

      {parsed.notes.some((n) => n.index !== null) ? (
        // key: другая мелодия — свежий плеер (курсор, таймеры, режим «с проверкой»)
        <Player key={selected + '|' + text} notes={parsed.notes} meter={melody?.meter ?? 4} {...{ instrument, lang, t, s, bpm, setBpm, sharp }} />
      ) : (
        <p className="text-sm text-[var(--c-a08c64)]">{s.empty}</p>
      )}
    </main>
  )
}

interface PlayerProps {
  notes: MelodyNote[]
  meter: number
  instrument: Instrument
  lang: Lang
  t: Strings
  s: S
  bpm: number
  setBpm: (v: number) => void
  sharp: boolean
}

function Player({ notes, meter, instrument, t, s, bpm, setBpm, sharp }: PlayerProps) {
  const [mode, setMode] = useState<Mode>('listen')
  const [clicks, setClicks] = usePersisted('melodyClicks', true)
  const first = Math.max(0, notes.findIndex((n) => n.index !== null))
  const [pos, setPos] = useState(first)
  const [playing, setPlaying] = useState(false)
  const [countIn, setCountIn] = useState(0)
  const chipsRef = useRef<HTMLDivElement>(null)
  // таймеры дробных долей «Слушать»: их надо снять на стопе, иначе ноты доиграют сами
  const timers = useRef<number[]>([])

  // доля начала каждой ноты — по ней «Слушать» понимает, что играть на этом щелчке
  const starts: number[] = []
  for (let i = 0, acc = 0; i < notes.length; acc += notes[i].beats, i++) starts.push(acc)
  const total = starts.length ? starts[starts.length - 1] + notes[notes.length - 1].beats : 0

  const cur = notes[Math.min(pos, notes.length - 1)]
  const note = cur.index === null ? null : NOTES[cur.index]
  const pressed = useMemo(() => new Set(note?.keys ?? []), [note])

  const sound = (k: number, seconds?: number) => {
    const n = notes[k]
    if (n.index === null) return stopAll()
    const sn = NOTES[n.index]
    playNote(sn.id, sn.sound, instrument, { seconds: seconds ?? Math.min(1.5, n.beats * (60 / bpm) * 0.9) })
  }

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // метроном остановили (кнопкой, окном метронома или концом мелодии) — гасим и наши таймеры
  useEffect(
    () =>
      onMetronomeChange((r) => {
        if (r) return
        timers.current.forEach(clearTimeout)
        timers.current = []
        setPlaying(false)
        setCountIn(0)
      }),
    [],
  )
  // ушли с экрана — тишина; метроном глушим, только если он наш (чужой из окна «Метроном» не трогаем)
  const playingRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      if (playingRef.current) stopMetronome()
      stopAll()
    },
    [],
  )

  useEffect(() => {
    chipsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pos])

  const stopPlay = () => {
    clearTimers()
    if (playingRef.current) stopMetronome()
    stopAll()
  }

  const switchMode = (m: Mode) => {
    stopPlay()
    setPos(first)
    setMode(m)
  }

  const start = () => {
    // сначала гасим чужой метроном: его «стоп» иначе придёт после setPlaying(true)
    stopMetronome()
    clearTimers()
    setPos(first)
    setPlaying(true)
    setCountIn(meter)
    const beatSec = 60 / bpm
    // ponytail: темп фиксируется на старте; сменили −/+ — «Стоп» и снова «Сыграть»
    startMetronome({
      bpm,
      beats: meter,
      click: clicks,
      owner: 'melody',
      onBeat: (_b, c) => {
        // такт отсчёта — чтобы успеть взять инструмент и вступить вместе
        const k = c - meter
        if (k < 0) return setCountIn(meter - c)
        setCountIn(0)
        if (k >= total) {
          stopMetronome()
          stopAll()
          return
        }
        // все ноты, начинающиеся в этой доле: целые — сразу, дробные — со сдвигом
        // внутри доли (восьмые, пунктир). Метроном зовёт onBeat в момент щелчка.
        notes.forEach((n, i) => {
          if (starts[i] < k || starts[i] >= k + 1) return
          const go = () => {
            setPos(i)
            if (n.index === null) stopAll()
            else {
              const sn = NOTES[n.index]
              // 0.9 — короткий зазор между нотами, иначе повторы (G G G) сливаются в одну
              playNote(sn.id, sn.sound, instrument, { seconds: n.beats * beatSec * 0.9 })
            }
          }
          const off = (starts[i] - k) * beatSec * 1000
          if (off < 1) go()
          else timers.current.push(window.setTimeout(go, off))
        })
      },
    })
  }

  const go = (k: number) => {
    const c = Math.max(0, Math.min(notes.length - 1, k))
    setPos(c)
    sound(c)
  }

  const modes: Array<[Mode, string]> = [
    ['listen', s.modeListen],
    ['check', s.modeCheck],
    ['steps', s.modeSteps],
  ]
  const big = countIn > 0 ? String(countIn) : note ? noteName(cur) : s.rest

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="group" aria-label={s.modes}>
          {modes.map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${mode === m ? ON : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setBpm(clampBpm(bpm - 4))} aria-label={`${t.bpm} −`} className={`${BTN} px-0`} disabled={playing}>
            <Minus size={16} />
          </button>
          <span className="w-16 text-center text-sm font-semibold text-[var(--c-e8d5ae)]">
            {bpm} <span className="text-xs font-normal text-[var(--c-a08c64)]">{t.bpm}</span>
          </span>
          <button onClick={() => setBpm(clampBpm(bpm + 4))} aria-label={`${t.bpm} +`} className={`${BTN} px-0`} disabled={playing}>
            <Plus size={16} />
          </button>
        </div>
        <span className="text-sm text-[var(--c-a08c64)]">
          {s.meter} {meter}/4
        </span>
        {mode === 'listen' && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--c-c9b892)]">
            <input type="checkbox" checked={clicks} onChange={(e) => setClicks(e.target.checked)} disabled={playing} className="h-4 w-4 accent-[var(--c-d9a441)]" />
            {t.clicks}
          </label>
        )}
      </div>

      {/* лента нот: имя + длительность в долях */}
      <div ref={chipsRef} className="flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label={s.notes}>
        {notes.map((n, k) => (
          <button
            key={k}
            role="listitem"
            data-active={k === pos}
            // в режиме проверки ноты выбирает микрофон, а не палец
            disabled={mode === 'check' || playing}
            onClick={() => go(k)}
            aria-label={`${n.index === null ? s.rest : noteName(n)}, ${beatsLabel(n.beats)} ${s.beats}`}
            className={`flex h-12 min-w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg px-2 leading-tight transition-all disabled:cursor-default ${
              k === pos ? `${ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]` : 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] enabled:hover:border-[var(--c-6b5732)] enabled:hover:text-[var(--c-f2c14e)]'
            }`}
          >
            <span className="text-sm font-semibold">{n.index === null ? '𝄽' : noteName(n)}</span>
            <span className={`text-[10px] ${k === pos ? 'text-[var(--c-241a08)]' : 'text-[var(--c-7a6845)]'}`}>{beatsLabel(n.beats)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="order-2 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-1">
          {/* у паузы схемы нет: пустая схема выглядела бы как «все клапаны открыты» (C♯5) */}
          {note ? <FingeringDiagram pressed={pressed} bisLabel={t.bis} label={t.legendTitle} /> : <span className="font-display text-6xl text-[var(--c-5c4c2e)]">𝄽</span>}
        </section>

        <section className="order-1 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-2">
          <div className="text-sm text-[var(--c-a08c64)]">
            {countIn > 0 ? s.countIn : `${pos + 1}/${notes.length} · ${beatsLabel(cur.beats)} ${s.beats}`}
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="font-display text-5xl leading-none text-[var(--c-f2c14e)]" aria-live="polite">
              {big}
            </div>
            {note && mode !== 'check' && (
              <button
                onClick={() => sound(pos)}
                aria-label={`${t.listen} ${noteName(cur)}`}
                className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
              >
                <Volume2 size={22} />
              </button>
            )}
          </div>
          {note && (
            <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
              <img src={notationFile(note.id)} alt={`${t.note} ${noteName(cur)} ${t.onStaff}`} className="h-32 w-auto object-contain" />
            </div>
          )}

          {mode === 'listen' && (
            <div className="mt-4 flex">
              <button onClick={() => (playing ? stopPlay() : start())} className={PRIMARY}>
                {playing ? <Square size={18} /> : <Play size={18} />}
                {playing ? t.stop : s.play}
              </button>
            </div>
          )}

          {mode === 'steps' && (
            <div className="mt-4 flex gap-2">
              <button onClick={() => go(pos - 1)} disabled={pos === 0} aria-label={t.prev} className={`${BTN} flex-1`}>
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => go(pos + 1)} disabled={pos === notes.length - 1} aria-label={t.next} className={`${BTN} flex-1`}>
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {mode === 'check' && <CheckMode notes={notes} first={first} pos={pos} setPos={setPos} {...{ instrument, t, s, sharp }} />}
        </section>
      </div>
    </>
  )
}

interface CheckProps {
  notes: MelodyNote[]
  first: number
  pos: number
  setPos: (k: number) => void
  instrument: Instrument
  t: Strings
  s: S
  sharp: boolean
}

// попадание: ±25 центов от письменной цели, удержано 250 мс без перерыва
const CENTS_OK = 25
const HOLD_MS = 250
// после попадания чуть не слушаем: иначе повтор той же ноты (G G G) засчитается
// тем же самым тянущимся звуком через 250 мс
const COOLDOWN_MS = 200

/** «Играть с проверкой». Отдельный компонент — микрофон живёт, только пока открыт этот режим. */
function CheckMode({ notes, first, pos, setPos, instrument, t, s, sharp }: CheckProps) {
  const [live, setLive] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [hints, setHints] = useState(0)
  const [doneSec, setDoneSec] = useState<number | null>(null)
  const startedAt = useRef(performance.now())
  const holdFrom = useRef<number | null>(null)
  const quietTill = useRef(0)
  const flashTimer = useRef(0)

  const cur = notes[pos]
  const target = cur.index === null ? null : writtenMidi(NOTES[cur.index].id)

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  /** следующая нота (паузы пропускаем); дальше нет — готово */
  const advance = (now: number) => {
    let k = pos + 1
    while (k < notes.length && notes[k].index === null) k++
    holdFrom.current = null
    quietTill.current = now + COOLDOWN_MS
    if (k >= notes.length) setDoneSec((now - startedAt.current) / 1000)
    else setPos(k)
  }

  const { denied, muteUntil } = usePitch(instrument, (v, now) => {
    // шаг 0.05 полутона = 5 центов: реже перерисовка, глазу хватает
    setLive(v === null ? null : Math.round(v * 20) / 20)
    if (doneSec !== null || target === null || v === null || now < quietTill.current) {
      holdFrom.current = null
      return
    }
    if (Math.round(v) === target && Math.abs(v - target) * 100 <= CENTS_OK) {
      holdFrom.current ??= now
      if (now - holdFrom.current >= HOLD_MS) {
        setFlash(true)
        clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlash(false), 400)
        advance(now)
      }
    } else holdFrom.current = null
  })

  const skip = () => {
    setHints((h) => h + 1)
    advance(performance.now())
  }
  const listen = () => {
    if (cur.index === null) return
    const sn = NOTES[cur.index]
    setHints((h) => h + 1)
    // пока звучит образец, микрофон слышит динамик — не засчитываем его как ученика
    muteUntil(performance.now() + 1300)
    playNote(sn.id, sn.sound, instrument, { seconds: 1.2 })
  }
  const restart = () => {
    setPos(first)
    setHints(0)
    setDoneSec(null)
    holdFrom.current = null
    startedAt.current = performance.now()
  }

  if (denied) return <p className="mt-4 text-sm text-[var(--c-ff8a78)]">{t.micDenied}</p>

  if (doneSec !== null) {
    const mm = Math.floor(doneSec / 60)
    const ss = String(Math.round(doneSec % 60)).padStart(2, '0')
    return (
      <div className="mt-4 space-y-3 rounded-xl border border-[var(--c-2f6b3b)] bg-[var(--c-16351c)] p-4 text-center" role="status">
        <div className="font-display text-2xl text-[var(--c-5fd27a)]">{s.done}</div>
        <div className="text-sm text-[var(--c-e8d5ae)]">
          {s.time}: {mm}:{ss}, {s.hints}: {hints}
        </div>
        <button onClick={restart} className={PRIMARY}>
          <RotateCcw size={18} />
          {s.restart}
        </button>
      </div>
    )
  }

  const cents = live === null || target === null ? null : Math.round((live - target) * 100)
  const hit = cents !== null && Math.round(live!) === target && Math.abs(cents) <= CENTS_OK

  return (
    <div className="mt-4 space-y-3">
      <div
        className={`flex h-14 items-center justify-between rounded-xl border px-4 ${flash ? 'border-[var(--c-2f6b3b)] bg-[var(--c-16351c)]' : 'border-[var(--c-3a2f1c)] bg-[var(--c-14100a)]'}`}
        aria-live="polite"
      >
        {flash ? (
          <span className="flex items-center gap-2 font-semibold text-[var(--c-5fd27a)]">
            <Check size={20} /> {t.correct}
          </span>
        ) : live === null ? (
          <span className="text-sm text-[var(--c-a08c64)]">{s.silence}</span>
        ) : (
          <>
            <span className="text-sm text-[var(--c-a08c64)]">
              {s.hearing} <span className={`font-display text-2xl ${hit ? 'text-[var(--c-5fd27a)]' : 'text-[var(--c-f0e6d2)]'}`}>{midiName(live, sharp)}</span>
            </span>
            {cents !== null && Math.abs(cents) < 100 && (
              <span className={`text-sm font-semibold ${hit ? 'text-[var(--c-5fd27a)]' : 'text-[var(--c-ff8a78)]'}`}>
                {cents > 0 ? '+' : ''}
                {cents} {t.cents}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={listen} aria-label={t.listen} className={BTN}>
          <Volume2 size={18} />
        </button>
        <button onClick={skip} className={`${BTN} flex-1`}>
          <SkipForward size={18} />
          {s.skipNote}
        </button>
        <button onClick={restart} aria-label={s.restart} className={BTN}>
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  )
}
