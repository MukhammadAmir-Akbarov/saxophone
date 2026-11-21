import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Play, Plus, Square, Trash2, X } from 'lucide-react'
import {
  CLICK_SOUNDS,
  clampBpm,
  defaultAccents,
  metronomeElapsed,
  metronomeOwner,
  metronomeRunning,
  onMetronomeBeat,
  onMetronomeChange,
  onMetronomeTempo,
  startMetronome,
  stopMetronome,
  tempoName,
  updateMetronome,
  type Accent,
  type BeatInfo,
  type ClickSound,
} from '../lib/metronome'
import { usePersisted } from '../lib/persist'
import type { STRINGS } from '../lib/i18n'

interface Props {
  onClose: () => void
  bpm: number
  setBpm: (v: number) => void
  beats: number
  setBeats: (v: number) => void
  t: (typeof STRINGS)['ru']
}

// Размеры с привычной расстановкой ударений: 6/8 — две группы по три,
// 7/8 — 2+2+3, 5/4 — 3+2. Сильная — 3, средняя — 2.
const METERS: Array<{ label: string; acc: Accent[] }> = [
  { label: '2/4', acc: [3, 1] },
  { label: '3/4', acc: [3, 1, 1] },
  { label: '4/4', acc: [3, 1, 1, 1] },
  { label: '5/4', acc: [3, 1, 1, 2, 1] },
  { label: '6/8', acc: [3, 1, 1, 2, 1, 1] },
  { label: '7/8', acc: [3, 1, 2, 1, 2, 1, 1] },
  { label: '12/8', acc: [3, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1] },
]
const SUBDIVS: Array<{ n: number; sym: string }> = [
  { n: 1, sym: '♩' },
  { n: 2, sym: '♫' },
  { n: 3, sym: '³' },
  { n: 4, sym: '♬' },
]
const TIMERS = [0, 5, 10, 15, 20, 30]
const OWNER = 'modal'

interface Preset {
  bpm: number
  beats: number
  accents: Accent[]
  subdiv: number
  sound: ClickSound
}

/** длина массива ударений = числу долей (при смене размера лишнее отрезаем, новое — слабые) */
const fit = (acc: Accent[], beats: number): Accent[] =>
  Array.from({ length: beats }, (_, i) => acc[i] ?? (i === 0 ? 3 : 1))

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const CHIP = 'h-9 min-w-9 cursor-pointer rounded-[10px] px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#f2c14e]'
const ON = 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08]'
const OFF = 'text-[#c9b892] hover:text-[#f2c14e]'
const ROUND =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] px-2 text-sm font-semibold text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e]'
const NUM =
  'h-9 w-16 rounded-lg border border-[#4a3b22] bg-[#14100a] px-2 text-center text-sm font-semibold text-[#e8d5ae] focus-visible:outline-2 focus-visible:outline-[#f2c14e]'

export default function MetronomeModal({ onClose, bpm, setBpm, beats, setBeats, t }: Props) {
  const [accentsRaw, setAccents] = usePersisted<Accent[]>('metroAccents', defaultAccents(4))
  const [subdiv, setSubdiv] = usePersisted('metroSubdiv', 1)
  const [sound, setSound] = usePersisted<ClickSound>('metroSound', 'click')
  const [volume, setVolume] = usePersisted('metroVolume', 0.8)
  const [speed, setSpeed] = usePersisted('metroSpeed', { on: false, to: 120, step: 4, every: 4 })
  const [gap, setGap] = usePersisted('metroGap', { on: false, play: 2, mute: 2 })
  const [timerMin, setTimerMin] = usePersisted('metroTimer', 0)
  const [presets, setPresets] = usePersisted<Preset[]>('metroPresets', [])

  // своим окно считает только метроном, запущенный отсюда (не гамму)
  const [running, setRunning] = useState(() => metronomeRunning() && metronomeOwner() === OWNER)
  const [info, setInfo] = useState<BeatInfo | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [flash, setFlash] = useState(false)
  const taps = useRef<number[]>([])
  const closeRef = useRef<HTMLButtonElement>(null)
  const accents = useMemo(() => fit(accentsRaw, beats), [accentsRaw, beats])

  const cfg = useMemo(
    () => ({
      bpm,
      beats,
      accents,
      subdiv,
      sound,
      volume,
      speed: speed.on ? { to: speed.to, step: speed.step, every: speed.every } : null,
      gap: gap.on ? { play: gap.play, mute: gap.mute } : null,
    }),
    [bpm, beats, accents, subdiv, sound, volume, speed, gap],
  )

  const toggle = () => {
    if (running) return stopMetronome()
    startMetronome({ ...cfg, owner: OWNER, stopAfter: timerMin ? timerMin * 60 : undefined })
  }
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  })

  const tap = () => {
    // «простучать темп»: среднее по последним 4 интервалам, пауза > 2 с — заново
    const now = performance.now()
    const ts = taps.current.filter((x) => now - x < 2000)
    ts.push(now)
    taps.current = ts.slice(-5)
    if (taps.current.length >= 2) {
      const span = taps.current[taps.current.length - 1] - taps.current[0]
      setBpm(clampBpm((60000 * (taps.current.length - 1)) / span))
    }
  }
  const tapRef = useRef(tap)
  useEffect(() => {
    tapRef.current = tap
  })
  const bpmRef = useRef(bpm)
  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  useEffect(() => {
    closeRef.current?.focus()
    // пробел — старт/стоп, стрелки — темп (Shift — по 5), T — простучать
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return
      if (e.key === ' ' && !el.closest('button')) {
        e.preventDefault()
        toggleRef.current()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault()
        setBpm(clampBpm(bpmRef.current + (e.shiftKey ? 5 : 1)))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setBpm(clampBpm(bpmRef.current - (e.shiftKey ? 5 : 1)))
      } else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') tapRef.current()
    }
    window.addEventListener('keydown', onKey)
    const offRun = onMetronomeChange((r) => {
      setRunning(r && metronomeOwner() === OWNER)
      if (!r) setInfo(null)
    })
    const offBeat = onMetronomeBeat((b) => {
      if (metronomeOwner() !== OWNER) return
      setInfo(b)
      setElapsed(metronomeElapsed())
      if (b.beat === 0) {
        setFlash(true)
        setTimeout(() => setFlash(false), 90)
      }
    })
    // разгон темпа поднял скорость — показываем и запоминаем новую
    const offTempo = onMetronomeTempo((v) => metronomeOwner() === OWNER && setBpm(v))
    return () => {
      window.removeEventListener('keydown', onKey)
      offRun()
      offBeat()
      offTempo()
    }
  }, [onClose, setBpm])

  // любые настройки — на ходу, метроном не останавливается
  useEffect(() => updateMetronome(cfg, OWNER), [cfg])

  const setMeter = (acc: Accent[]) => {
    setBeats(acc.length)
    setAccents(acc)
  }
  const setBeatCount = (n: number) => {
    const b = Math.max(1, Math.min(12, n))
    setBeats(b)
    setAccents(fit(accents, b))
  }
  // нажатие на долю: сильная → средняя → слабая → тишина → сильная
  const cycle = (i: number) => {
    const next = [...accents]
    next[i] = (accents[i] === 0 ? 3 : accents[i] - 1) as Accent
    setAccents(next)
  }
  const meterLabel = METERS.find((m) => m.acc.length === beats && m.acc.every((a, i) => a === accents[i]))?.label

  const savePreset = () => {
    const p: Preset = { bpm, beats, accents, subdiv, sound }
    setPresets((ps) => [p, ...ps.filter((x) => JSON.stringify(x) !== JSON.stringify(p))].slice(0, 8))
  }
  const loadPreset = (p: Preset) => {
    setBpm(p.bpm)
    setBeats(p.beats)
    setAccents(p.accents)
    setSubdiv(p.subdiv)
    setSound(p.sound)
  }
  const presetLabel = (p: Preset) =>
    `${METERS.find((m) => m.acc.length === p.beats && m.acc.every((a, i) => a === p.accents[i]))?.label ?? p.beats} · ${p.bpm} ${SUBDIVS.find((s) => s.n === p.subdiv)?.sym ?? ''}`

  const soundName: Record<ClickSound, string> = { click: t.soundClick, wood: t.soundWood, beep: t.soundBeep, bell: t.soundBell }
  const subName = [t.subQuarter, t.subEighth, t.subTriplet, t.subSixteenth]
  const left = timerMin ? timerMin * 60 - elapsed : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.metronome}
    >
      <div
        className={`max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border bg-[#1c1610] p-5 shadow-2xl transition-colors duration-75 ${
          flash && !info?.muted ? 'border-[#f2c14e]' : 'border-[#3a2f1c]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-[#f2e3c2]">{t.metronome}</h2>
          <button ref={closeRef} onClick={onClose} aria-label={t.close} className={`${ROUND} w-10 min-w-10 px-0`}>
            <X size={20} />
          </button>
        </div>

        {/* доли: подсветка текущей + нажатием меняется ударение */}
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t.accentHint}>
          {accents.map((a, i) => {
            const now = info?.beat === i
            const size = ['h-5 w-5', 'h-6 w-6', 'h-8 w-8', 'h-10 w-10'][a]
            return (
              <button
                key={i}
                onClick={() => cycle(i)}
                aria-label={`${i + 1}: ${[t.accMute, t.accWeak, t.accMid, t.accStrong][a]}`}
                className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
              >
                <span
                  className={`rounded-full transition-colors duration-75 ${size} ${
                    a === 0
                      ? `border-2 border-dashed ${now ? 'border-[#e8d5ae]' : 'border-[#4a3b22]'}`
                      : now
                        ? info?.muted
                          ? 'bg-[#5c4c2e]'
                          : a === 3
                            ? 'bg-[#f2c14e] shadow-[0_0_14px_rgba(242,193,78,0.7)]'
                            : 'bg-[#e8d5ae]'
                        : a === 3
                          ? 'bg-[#6b5228]'
                          : 'bg-[#3a2f1c]'
                  }`}
                />
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-center text-[11px] text-[#7a6845]">{t.accentHint}</p>

        {/* темп */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button onClick={() => setBpm(clampBpm(bpm - 5))} className={ROUND} aria-label="−5">
            −5
          </button>
          <button onClick={() => setBpm(clampBpm(bpm - 1))} className={`${ROUND} px-0`} aria-label="−1">
            <Minus size={18} />
          </button>
          <div className="w-28 text-center">
            <div className="font-display text-5xl leading-none text-[#f2c14e]">{bpm}</div>
            <div className="mt-1 text-xs text-[#a08c64]">
              {t.bpm} · <i>{tempoName(bpm)}</i>
            </div>
          </div>
          <button onClick={() => setBpm(clampBpm(bpm + 1))} className={`${ROUND} px-0`} aria-label="+1">
            <Plus size={18} />
          </button>
          <button onClick={() => setBpm(clampBpm(bpm + 5))} className={ROUND} aria-label="+5">
            +5
          </button>
        </div>
        <input
          type="range"
          min={20}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(clampBpm(Number(e.target.value)))}
          aria-label={t.bpm}
          className="mt-3 w-full accent-[#d9a441]"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={toggle}
            className={`flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${ON}`}
          >
            {running ? <Square size={18} /> : <Play size={18} />}
            {running ? t.stop : t.start}
          </button>
          <button
            onClick={tap}
            className="h-12 cursor-pointer rounded-xl border border-[#4a3b22] px-4 font-semibold text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
          >
            {t.tap}
          </button>
        </div>

        {/* счётчик: такт, время, таймер, пропуск тактов */}
        <div className="mt-2 flex min-h-5 justify-center gap-4 text-xs text-[#a08c64]" aria-live="off">
          {running && info && (
            <>
              <span>
                {t.bar}: <b className="text-[#e8d5ae]">{info.bar + 1}</b>
              </span>
              <span>
                ⏱ <b className="text-[#e8d5ae]">{mmss(elapsed)}</b>
              </span>
              {timerMin > 0 && (
                <span>
                  {t.timerLeft}: <b className="text-[#e8d5ae]">{mmss(Math.max(0, left))}</b>
                </span>
              )}
              {info.muted && <span className="text-[#f2c14e]">{t.mutedBar}</span>}
            </>
          )}
        </div>

        {/* размер */}
        <div className="mt-4 text-xs font-semibold tracking-wider text-[#7a6845] uppercase">{t.meter}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {METERS.map((m) => (
            <button key={m.label} onClick={() => setMeter(m.acc)} aria-pressed={meterLabel === m.label} className={`${CHIP} ${meterLabel === m.label ? ON : `border border-[#3a2f1c] ${OFF}`}`}>
              {m.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setBeatCount(beats - 1)} className={`${CHIP} border border-[#3a2f1c] ${OFF}`} aria-label={`${t.beatsPerBar} −`}>
              −
            </button>
            <span className="w-14 text-center text-sm text-[#e8d5ae]">
              {beats} <span className="text-[10px] text-[#a08c64]">{t.beatsShort}</span>
            </span>
            <button onClick={() => setBeatCount(beats + 1)} className={`${CHIP} border border-[#3a2f1c] ${OFF}`} aria-label={`${t.beatsPerBar} +`}>
              +
            </button>
          </div>
        </div>

        {/* дробление доли */}
        <div className="mt-4 text-xs font-semibold tracking-wider text-[#7a6845] uppercase">{t.subdiv}</div>
        <div className="mt-1.5 flex rounded-xl border border-[#4a3b22] p-0.5">
          {SUBDIVS.map((s, i) => (
            <button key={s.n} onClick={() => setSubdiv(s.n)} aria-pressed={subdiv === s.n} title={subName[i]} className={`${CHIP} flex-1 ${subdiv === s.n ? ON : OFF}`}>
              <span className="text-lg leading-none">{s.sym}</span> <span className="text-[11px]">{subName[i]}</span>
            </button>
          ))}
        </div>

        {/* звук */}
        <div className="mt-4 text-xs font-semibold tracking-wider text-[#7a6845] uppercase">{t.soundLabel}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {CLICK_SOUNDS.map((s) => (
            <button key={s} onClick={() => setSound(s)} aria-pressed={sound === s} className={`${CHIP} ${sound === s ? ON : `border border-[#3a2f1c] ${OFF}`}`}>
              {soundName[s]}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-3 text-sm text-[#c9b892]">
          {t.volume}
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1 accent-[#d9a441]" />
        </label>

        {/* тренажёры */}
        <details className="mt-4 rounded-xl border border-[#2e2415] p-3" open={speed.on || gap.on || timerMin > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-[#e8d5ae]">{t.trainers}</summary>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#e8d5ae]">
            <input type="checkbox" checked={speed.on} onChange={(e) => setSpeed({ ...speed, on: e.target.checked })} className="h-4 w-4 accent-[#d9a441]" />
            {t.speedTrainer}
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6 text-sm text-[#c9b892]">
            +
            <input type="number" min={1} max={20} value={speed.step} onChange={(e) => setSpeed({ ...speed, step: Math.max(1, Number(e.target.value) || 1) })} className={NUM} aria-label={t.speedStep} />
            {t.bpm} {t.every}
            <input type="number" min={1} max={32} value={speed.every} onChange={(e) => setSpeed({ ...speed, every: Math.max(1, Number(e.target.value) || 1) })} className={NUM} aria-label={t.barsWord} />
            {t.barsWord}, {t.upTo}
            <input type="number" min={20} max={300} value={speed.to} onChange={(e) => setSpeed({ ...speed, to: clampBpm(Number(e.target.value) || 120) })} className={NUM} aria-label={t.upTo} />
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#e8d5ae]">
            <input type="checkbox" checked={gap.on} onChange={(e) => setGap({ ...gap, on: e.target.checked })} className="h-4 w-4 accent-[#d9a441]" />
            {t.gapTrainer}
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6 text-sm text-[#c9b892]">
            <input type="number" min={1} max={16} value={gap.play} onChange={(e) => setGap({ ...gap, play: Math.max(1, Number(e.target.value) || 1) })} className={NUM} aria-label={t.gapPlay} />
            {t.gapPlay},
            <input type="number" min={1} max={16} value={gap.mute} onChange={(e) => setGap({ ...gap, mute: Math.max(1, Number(e.target.value) || 1) })} className={NUM} aria-label={t.gapMute} />
            {t.gapMute}
          </div>
          <p className="mt-1 pl-6 text-[11px] text-[#7a6845]">{t.gapHint}</p>

          <div className="mt-3 text-sm font-semibold text-[#e8d5ae]">{t.timer}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {TIMERS.map((m) => (
              <button key={m} onClick={() => setTimerMin(m)} aria-pressed={timerMin === m} className={`${CHIP} ${timerMin === m ? ON : `border border-[#3a2f1c] ${OFF}`}`}>
                {m ? `${m} ${t.minShort}` : t.off}
              </button>
            ))}
          </div>
          {running && <p className="mt-1 text-[11px] text-[#7a6845]">{t.timerRestart}</p>}
        </details>

        {/* сохранённые настройки */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-[#7a6845] uppercase">{t.presets}</span>
          <button onClick={savePreset} className="cursor-pointer text-sm font-semibold text-[#f2c14e] hover:underline">
            + {t.savePreset}
          </button>
        </div>
        {presets.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {presets.map((p, i) => (
              <span key={i} className="flex items-center rounded-[10px] border border-[#3a2f1c]">
                <button onClick={() => loadPreset(p)} className={`${CHIP} ${OFF}`}>
                  {presetLabel(p)}
                </button>
                <button
                  onClick={() => setPresets(presets.filter((_, k) => k !== i))}
                  aria-label={`${t.recDelete} ${presetLabel(p)}`}
                  className="flex h-9 w-7 cursor-pointer items-center justify-center text-[#7a6845] hover:text-[#ff8a78]"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-[#7a6845]">{t.presetsEmpty}</p>
        )}

        <p className="mt-4 text-center text-[11px] text-[#7a6845]">{t.metroKeys}</p>
      </div>
    </div>
  )
}
