import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Play, Plus, Square, Volume2 } from 'lucide-react'
import { KEY_LABELS, NOTES, notationFile } from '../data/notes'
import FingeringDiagram from './FingeringDiagram'
import { keyLabel, type Lang, type STRINGS } from '../lib/i18n'
import { clampBpm, onMetronomeChange, startMetronome, stopMetronome } from '../lib/metronome'
import { usePersisted } from '../lib/persist'
import { PATTERNS, SCALE_TYPES, buildScale, keyIsSharp, tonicName, type Pattern, type ScaleType } from '../lib/scales'
import { onDroneChange, startDrone, stopDrone } from '../lib/drone'
import { TRANSPOSE, concertMidi, midiName, playNote, stopAll, type Instrument } from '../lib/sound'

interface Props {
  instrument: Instrument
  lang: Lang
  bpm: number
  setBpm: (v: number) => void
  t: (typeof STRINGS)['ru']
}

// такт отсчёта перед гаммой — чтобы успеть взять инструмент и вступить вместе
const COUNT_IN = 4

const SEL =
  'h-11 cursor-pointer rounded-xl border border-[#4a3b22] bg-[#14100a] px-2 text-sm font-semibold text-[#e8d5ae] focus-visible:outline-2 focus-visible:outline-[#f2c14e]'
const BTN =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#4a3b22] px-3 text-sm font-semibold text-[#e8d5ae] transition-colors hover:bg-[#241c11] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-40'
const ON = 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08]'

export default function Scales({ instrument, lang, bpm, setBpm, t }: Props) {
  const [tonic, setTonic] = usePersisted('scaleTonic', 0)
  const [type, setType] = usePersisted<ScaleType>('scaleType', 'major')
  const [octaves, setOctaves] = usePersisted<1 | 2>('scaleOctaves', 1)
  const [clicks, setClicks] = usePersisted('scaleClicks', true)
  const [pattern, setPattern] = usePersisted<Pattern>('scalePattern', 'plain')
  const [droneFifth, setDroneFifth] = usePersisted('droneFifth', false)
  // бурдон не запоминаем между заходами: внезапный гул при открытии экрана пугает
  const [drone, setDrone] = useState(false)
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  // идёт отсчёт: сколько долей осталось до первой ноты
  const [countIn, setCountIn] = useState(0)
  const chipsRef = useRef<HTMLDivElement>(null)

  const seq = useMemo(() => buildScale(tonic, type, octaves, pattern), [tonic, type, octaves, pattern])
  // бурдон на звучащей тонике выбранного строя (у альта письменная C звучит как E♭)
  const droneMidi = concertMidi(NOTES[seq[0].index].id, instrument)
  useEffect(() => {
    if (!drone) return
    startDrone(droneFifth ? [droneMidi, droneMidi + 7] : [droneMidi])
    return () => stopDrone()
  }, [drone, droneMidi, droneFifth])
  // тюнер глушит бурдон (иначе микрофон слушал бы его) — кнопка должна погаснуть
  useEffect(() => onDroneChange((on) => !on && setDrone(false)), [])
  const cur = seq[Math.min(pos, seq.length - 1)]
  const note = NOTES[cur.index]
  const name = (k: number) => {
    const s = seq[k]
    const n = NOTES[s.index]
    return s.sharp && n.sharp ? n.sharp : n.flat
  }
  const pressed = useMemo(() => new Set(note.keys), [note])
  const noteSeconds = Math.min(1.5, (60 / bpm) * 0.9)

  // гамма сменилась — в начало и стоп
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    stopMetronome()
    setPos(0)
    set(v)
  }

  useEffect(
    () =>
      onMetronomeChange((r) => {
        if (r) return
        setPlaying(false)
        setCountIn(0)
      }),
    [],
  )
  // ушли с экрана гамм — метроном гаммы не должен щёлкать дальше
  const playingRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(
    () => () => {
      if (playingRef.current) stopMetronome()
    },
    [],
  )

  useEffect(() => {
    chipsRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pos])

  const sound = (k: number) => {
    const n = NOTES[seq[k].index]
    playNote(n.id, n.sound, instrument, { seconds: noteSeconds })
  }

  const start = () => {
    // сначала остановить чужой метроном (из окна «Метроном»): его «стоп» иначе
    // придёт после нашего setPlaying(true) и сбросит кнопку
    stopMetronome()
    setPos(0)
    setPlaying(true)
    setCountIn(COUNT_IN)
    // ponytail: темп фиксируется на старте; сменили — нажать «Стоп» и снова «Играть»
    startMetronome({
      bpm,
      beats: 4,
      click: clicks,
      onBeat: (_b, c) => {
        const k = c - COUNT_IN
        if (k < 0) return setCountIn(COUNT_IN - c)
        setCountIn(0)
        if (k >= seq.length) {
          stopMetronome()
          stopAll()
          return
        }
        setPos(k)
        sound(k)
      },
    })
  }

  const go = (k: number) => {
    if (playing) stopMetronome()
    const c = Math.max(0, Math.min(seq.length - 1, k))
    setPos(c)
    sound(c)
  }

  const patternLabel: Record<Pattern, string> = {
    plain: t.patPlain,
    thirds: t.patThirds,
    fourths: t.patFourths,
    groups3: t.patGroups3,
    groups4: t.patGroups4,
    triads: t.patTriads,
  }
  const typeLabel: Record<ScaleType, string> = {
    major: t.major,
    minor: t.minor,
    harmonic: t.harmonic,
    arpMajor: t.arpMajor,
    arpMinor: t.arpMinor,
    chromatic: t.chromatic,
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* выбор гаммы */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="tonic">
          {t.tonic}
        </label>
        <select id="tonic" value={tonic} onChange={(e) => change(setTonic)(Number(e.target.value))} className={SEL}>
          {Array.from({ length: 12 }, (_, pc) => (
            <option key={pc} value={pc}>
              {tonicName(pc, type)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="scaleType">
          {t.scaleType}
        </label>
        <select id="scaleType" value={type} onChange={(e) => change(setType)(e.target.value as ScaleType)} className={SEL}>
          {SCALE_TYPES.map((s) => (
            <option key={s} value={s}>
              {typeLabel[s]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="scalePattern">
          {t.patternLabel}
        </label>
        <select id="scalePattern" value={pattern} onChange={(e) => change(setPattern)(e.target.value as Pattern)} className={SEL}>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {patternLabel[p]}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl border border-[#4a3b22] p-0.5" role="group" aria-label={t.octaves}>
          {([1, 2] as const).map((o) => (
            <button
              key={o}
              onClick={() => change(setOctaves)(o)}
              aria-pressed={octaves === o}
              className={`h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold ${octaves === o ? ON : 'text-[#c9b892] hover:text-[#f2c14e]'}`}
            >
              {o} {t.octShort}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setBpm(clampBpm(bpm - 4))} aria-label={`${t.bpm} −`} className={`${BTN} px-0`} disabled={playing}>
            <Minus size={16} />
          </button>
          <span className="w-16 text-center text-sm font-semibold text-[#e8d5ae]">
            {bpm} <span className="text-xs font-normal text-[#a08c64]">{t.bpm}</span>
          </span>
          <button onClick={() => setBpm(clampBpm(bpm + 4))} aria-label={`${t.bpm} +`} className={`${BTN} px-0`} disabled={playing}>
            <Plus size={16} />
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#c9b892]">
          <input type="checkbox" checked={clicks} onChange={(e) => setClicks(e.target.checked)} disabled={playing} className="h-4 w-4 accent-[#d9a441]" />
          {t.clicks}
        </label>
        <button onClick={() => setDrone((d) => !d)} aria-pressed={drone} className={drone ? `${BTN} border-transparent ${ON}` : BTN} title={t.droneHint}>
          {t.drone}
        </button>
        {drone && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#c9b892]">
            <input type="checkbox" checked={droneFifth} onChange={(e) => setDroneFifth(e.target.checked)} className="h-4 w-4 accent-[#d9a441]" />
            {t.droneFifth}
          </label>
        )}
      </div>

      {/* лента нот гаммы */}
      <div ref={chipsRef} className="flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label={t.scaleNotes}>
        {seq.map((_, k) => (
          <button
            key={k}
            role="listitem"
            data-active={k === pos}
            onClick={() => go(k)}
            className={`h-10 min-w-10 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold transition-all ${
              k === pos ? `${ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]` : 'border border-[#3a2f1c] text-[#c9b892] hover:border-[#6b5732] hover:text-[#f2c14e]'
            }`}
          >
            {name(k)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="order-2 flex flex-col items-center gap-3 rounded-2xl border border-[#2e2415] bg-[#1a1509] p-4 lg:order-1">
          <FingeringDiagram pressed={pressed} bisLabel={t.bis} label={t.legendTitle} />
          <p className="text-center text-sm text-[#a08c64]">
            {note.keys.length ? (
              <>
                {t.pressed}: <span className="font-semibold text-[#e8d5ae]">{note.keys.map((k) => keyLabel(k, lang, KEY_LABELS)).join(' · ')}</span>
              </>
            ) : (
              t.allOpen
            )}
          </p>
        </section>

        <section className="order-1 rounded-2xl border border-[#2e2415] bg-[#1a1509] p-4 lg:order-2">
          <div className="text-sm text-[#a08c64]">
            {tonicName(tonic, type)} {typeLabel[type].toLowerCase()} · {pos + 1}/{seq.length}
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-5xl leading-none text-[#f2c14e]" aria-live="polite">
                {countIn > 0 ? countIn : name(pos)}
              </div>
              <div className="mt-2 text-xs text-[#a08c64]">
                {t.sounds} <span className="font-semibold text-[#e8d5ae]">{midiName(concertMidi(note.id, instrument), keyIsSharp(tonic + TRANSPOSE[instrument], type) || !!cur.leading)}</span>
              </div>
            </div>
            <button
              onClick={() => sound(pos)}
              aria-label={`${t.listen} ${name(pos)}`}
              className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e]"
            >
              <Volume2 size={22} />
            </button>
          </div>
          <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
            <img src={notationFile(note.id)} alt={`${t.note} ${name(pos)} ${t.onStaff}`} className="h-32 w-auto object-contain" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => go(pos - 1)} disabled={pos === 0} aria-label={t.prev} className={BTN}>
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => (playing ? stopMetronome() : start())}
              className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${ON}`}
            >
              {playing ? <Square size={18} /> : <Play size={18} />}
              {playing ? t.stop : t.playScale}
            </button>
            <button onClick={() => go(pos + 1)} disabled={pos === seq.length - 1} aria-label={t.next} className={BTN}>
              <ChevronRight size={20} />
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
