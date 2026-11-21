import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, SkipForward, X } from 'lucide-react'
import { NOTES, type SaxNote } from '../data/notes'
import { midiName, playNote, stopAll, writtenMidi, type Instrument } from '../lib/sound'
import { stopMetronome } from '../lib/metronome'
import { usePitch } from '../lib/usePitch'
import type { STRINGS } from '../lib/i18n'

export type TunerTab = 'tuner' | 'long' | 'follow'

interface Props {
  onClose: () => void
  instrument: Instrument
  sharp: boolean
  /** выбранная нота — цель для тюнера и длинного тона */
  note: SaxNote
  nameOf: (n: SaxNote) => string
  tab: TunerTab
  onTab: (t: TunerTab) => void
  t: (typeof STRINGS)['ru']
}

// Порог «точно»: ±10 центов — обычная учебная планка для духовых.
const IN_TUNE = 10
// «Сыграй за мной» мягче: ученик только что услышал ноту и подстраивается
const FOLLOW_TOL = 15
const FOLLOW_HOLD_MS = 700
// длинный тон: столько секунд истории на графике
const GRAPH_SEC = 8
// ноты для «Сыграй за мной»: без альтиссимо — его не играют «с ходу»
const FOLLOW_POOL = NOTES.map((n, i) => (n.register === 'altissimo' ? -1 : i)).filter((i) => i >= 0)

interface HoldResult {
  sec: number
  avg: number
  spread: number
}

function readNum(key: string) {
  try {
    return Number(localStorage.getItem('sax.' + key)) || 0
  } catch {
    return 0
  }
}
function writeNum(key: string, v: number) {
  try {
    localStorage.setItem('sax.' + key, String(v))
  } catch {
    /* приватный режим */
  }
}

/** линия высоты: отклонение в центах от опорной ноты за последние секунды */
function drawGraph(cv: HTMLCanvasElement, hist: Array<{ t: number; c: number | null }>, now: number) {
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (cv.width !== w * dpr) {
    cv.width = w * dpr
    cv.height = h * dpr
  }
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const y = (c: number) => h / 2 - (Math.max(-50, Math.min(50, c)) / 50) * (h / 2 - 4)
  // зелёная полоса «точно»
  g.fillStyle = 'rgba(95,210,122,0.14)'
  g.fillRect(0, y(IN_TUNE), w, y(-IN_TUNE) - y(IN_TUNE))
  g.strokeStyle = '#4a3b22'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, h / 2)
  g.lineTo(w, h / 2)
  g.stroke()
  g.lineWidth = 2.5
  g.lineJoin = 'round'
  let drawing = false
  let lastC = 0
  for (const p of hist) {
    const x = w - ((now - p.t) / (GRAPH_SEC * 1000)) * w
    if (p.c === null) {
      if (drawing) g.stroke()
      drawing = false
      continue
    }
    if (!drawing) {
      g.beginPath()
      g.strokeStyle = Math.abs(p.c) <= IN_TUNE ? '#5fd27a' : '#f2c14e'
      g.moveTo(x, y(p.c))
      drawing = true
    } else {
      // цвет меняем, когда линия выходит из «точно» или возвращается
      const inside = Math.abs(p.c) <= IN_TUNE
      if (inside !== Math.abs(lastC) <= IN_TUNE) {
        g.lineTo(x, y(p.c))
        g.stroke()
        g.beginPath()
        g.strokeStyle = inside ? '#5fd27a' : '#f2c14e'
        g.moveTo(x, y(p.c))
      } else g.lineTo(x, y(p.c))
    }
    lastC = p.c
  }
  if (drawing) g.stroke()
}

export default function Tuner({ onClose, instrument, sharp, note, nameOf, tab, onTab, t }: Props) {
  const [heard, setHeard] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hist = useRef<Array<{ t: number; c: number | null }>>([])

  // длинный тон
  const [holdSec, setHoldSec] = useState(0)
  const [lastHold, setLastHold] = useState<HoldResult | null>(null)
  const [bestHold, setBestHold] = useState(() => readNum('bestHold'))
  const hold = useRef<{ start: number; cents: number[]; lost: number } | null>(null)

  // «Сыграй за мной»
  const [fIdx, setFIdx] = useState<number | null>(null)
  const [fPhase, setFPhase] = useState<'idle' | 'playing' | 'listen' | 'done'>('idle')
  const [fScore, setFScore] = useState({ right: 0, total: 0 })
  const [fWrong, setFWrong] = useState<number | null>(null)
  const [hideName, setHideName] = useState(() => readNum('followHide') === 1)
  const fOk = useRef(0)
  const fWrongSince = useRef<{ m: number; since: number } | null>(null)

  const targetNote = tab === 'follow' && fIdx !== null ? NOTES[fIdx] : note
  const targetMidi = writtenMidi(targetNote.id)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Тюнер слушает микрофон: гамма/метроном из динамика сбили бы замер и засчитали
  // бы «ответ» за ученика — при открытии глушим всё; при закрытии — образец.
  useEffect(() => {
    stopMetronome()
    stopAll()
    return () => stopAll()
  }, [])

  const finishHold = useCallback(
    (now: number) => {
      const h = hold.current
      hold.current = null
      setHoldSec(0)
      if (!h) return
      // h.lost — сколько длился тон до того, как звук ушёл (хвост тишины не считаем)
      const sec = (h.lost || now - h.start) / 1000
      if (sec < 1 || h.cents.length < 10) return // случайный короткий звук — не результат
      const avg = h.cents.reduce((s, c) => s + c, 0) / h.cents.length
      const spread = Math.sqrt(h.cents.reduce((s, c) => s + (c - avg) ** 2, 0) / h.cents.length)
      setLastHold({ sec, avg, spread })
      setBestHold((b) => {
        if (sec <= b) return b
        writeNum('bestHold', Math.round(sec * 10) / 10)
        return sec
      })
    },
    [],
  )

  const onFrame = useCallback(
    (v: number | null, now: number) => {
      setHeard(v)
      // опорная нота графика: в тюнере — ближайшая, иначе — цель
      const c = v === null ? null : (v - (tab === 'tuner' ? Math.round(v) : targetMidi)) * 100
      const hs = hist.current
      hs.push({ t: now, c })
      while (hs.length && now - hs[0].t > GRAPH_SEC * 1000) hs.shift()
      if (canvasRef.current) drawGraph(canvasRef.current, hs, now)

      if (tab === 'long') {
        const onTarget = c !== null && Math.abs(c) < 50
        const h = hold.current
        if (onTarget) {
          if (!h) hold.current = { start: now, cents: [c], lost: 0 }
          else {
            h.lost = 0
            h.cents.push(c)
            setHoldSec(Math.floor((now - h.start) / 100) / 10)
          }
        } else if (h) {
          // короткий провал (вдох, щелчок) прощаем: тон кончился, если тишина > 250 мс
          if (!h.lost) h.lost = now - h.start
          else if (now - h.start - h.lost > 250) finishHold(now)
        }
      }

      if (tab === 'follow' && fPhase === 'listen' && v !== null) {
        const m = Math.round(v)
        if (m === targetMidi && Math.abs(c!) <= FOLLOW_TOL) {
          fWrongSince.current = null
          setFWrong(null)
          if (!fOk.current) fOk.current = now
          else if (now - fOk.current >= FOLLOW_HOLD_MS) {
            fOk.current = 0
            setFPhase('done')
            setFWrong(null)
            setFScore((s) => ({ right: s.right + 1, total: s.total + 1 }))
          }
        } else {
          fOk.current = 0
          // «это не та нота» показываем, только если ученик уверенно держит другую
          const w = fWrongSince.current
          if (m === targetMidi) {
            fWrongSince.current = null
            setFWrong(null)
          }
          else if (!w || w.m !== m) fWrongSince.current = { m, since: now }
          else if (now - w.since > 600) setFWrong(m)
        }
      }
    },
    [tab, targetMidi, fPhase, finishHold],
  )

  const { denied, muteUntil: mute } = usePitch(instrument, onFrame)

  // текущая нота «Сыграй за мной» нужна синхронно (повтор), поэтому ещё и в ref
  const fIdxRef = useRef<number | null>(null)
  const nextFollow = (replay = false) => {
    // Сначала глушим прежний образец: его onEnd снял бы mute и включил «слушаю»,
    // пока новый образец ещё звучит, — и динамик «ответил» бы за ученика.
    stopAll()
    hist.current = []
    setFWrong(null)
    fOk.current = 0
    fWrongSince.current = null
    let i = fIdxRef.current
    if (!replay || i === null) {
      const options = FOLLOW_POOL.filter((k) => k !== i)
      i = options[Math.floor(Math.random() * options.length)]
    }
    fIdxRef.current = i
    setFIdx(i)
    const n = NOTES[i]
    setFPhase('playing')
    // слушаем ученика только после образца (+ эхо комнаты)
    mute(performance.now() + 30_000)
    playNote(n.id, n.sound, instrument, {
      onEnd: () => {
        mute(performance.now() + 300)
        setFPhase((p) => (p === 'playing' ? 'listen' : p))
      },
    })
  }
  const nextFollowRef = useRef(nextFollow)
  useEffect(() => {
    nextFollowRef.current = nextFollow
  })


  // после верного ответа — следующая нота сама
  useEffect(() => {
    if (fPhase !== 'done') return
    const id = setTimeout(() => nextFollowRef.current(), 1300)
    return () => clearTimeout(id)
  }, [fPhase])

  // смена вкладки: сбросить длинный тон и остановить образец
  const switchTab = (id: TunerTab) => {
    // точки графика считаны от другой опорной ноты — на новой вкладке они врут
    hist.current = []
    hold.current = null
    setHoldSec(0)
    if (id !== 'follow') {
      // ушли из «За мной» — по возвращении начнём заново, а не с «полуответа»
      stopAll()
      setFPhase('idle')
      setFIdx(null)
      fIdxRef.current = null
    }
    onTab(id)
  }

  const nearest = heard === null ? null : Math.round(heard)
  const centsFromNearest = heard === null ? 0 : Math.round((heard - nearest!) * 100)
  const centsFromTarget = heard === null ? 0 : Math.round((heard - targetMidi) * 100)
  const onTarget = nearest === targetMidi
  const inTune = onTarget && Math.abs(centsFromNearest) <= IN_TUNE
  const needle = Math.max(-50, Math.min(50, tab === 'tuner' ? centsFromNearest : centsFromTarget))
  const targetName = nameOf(targetNote)
  const showFollowName = !hideName || fPhase === 'done'

  const deviation =
    heard === null ? (
      <>
        {t.silence}
        <br />
        <span className="text-[#a08c64]">{t.tunerHint}</span>
      </>
    ) : inTune ? (
      <span className="font-semibold text-[#5fd27a]">✓ {t.inTune}</span>
    ) : onTarget ? (
      <>
        {Math.abs(centsFromNearest)} {t.cents} {centsFromNearest < 0 ? t.flat : t.sharp}
      </>
    ) : (
      <>
        {t.target} {targetName}: {Math.abs(Math.round(centsFromTarget / 100))} {t.semis}{' '}
        {centsFromTarget < 0 ? t.flat : t.sharp}
      </>
    )

  const TABS: Array<[TunerTab, string]> = [
    ['tuner', t.tuner],
    ['long', t.longToneTab],
    ['follow', t.follow],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.tuner}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3a2f1c] bg-[#1c1610] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex rounded-xl border border-[#4a3b22] p-0.5" role="tablist">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => switchTab(id)}
                className={`h-9 cursor-pointer rounded-[10px] px-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${
                  tab === id ? 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08]' : 'text-[#c9b892] hover:text-[#f2c14e]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] text-[#d9c9a8] transition-colors hover:bg-[#2a2115] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
          >
            <X size={20} />
          </button>
        </div>

        {denied ? (
          <p className="py-8 text-center text-sm text-[#ff8a78]">{t.micDenied}</p>
        ) : (
          <>
            <div className="text-center text-sm text-[#a08c64]">
              {tab === 'follow' ? (
                fIdx === null ? (
                  t.followIntro
                ) : (
                  <>
                    {fPhase === 'playing' ? t.followListen : fPhase === 'done' ? t.correct : t.followYourTurn}
                    {': '}
                    <span className="font-semibold text-[#e8d5ae]">{showFollowName ? targetName : '?'}</span>
                  </>
                )
              ) : (
                <>
                  {t.target}: <span className="font-semibold text-[#e8d5ae]">{targetName}</span> · {t[instrument]}
                </>
              )}
            </div>

            <div
              className={`font-display mt-3 text-center text-6xl leading-none transition-colors ${
                heard === null ? 'text-[#5c4c2e]' : inTune ? 'text-[#5fd27a]' : 'text-[#f2c14e]'
              }`}
            >
              {nearest === null ? '—' : midiName(nearest, sharp)}
            </div>

            {/* шкала центов */}
            <div className="relative mx-auto mt-5 h-8 w-full max-w-xs">
              <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-[#3a2f1c]" />
              <div
                className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-[#1f4a29]"
                style={{ left: `${50 - IN_TUNE}%`, width: `${IN_TUNE * 2}%` }}
              />
              <div className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 bg-[#7a6845]" />
              {heard !== null && (
                <div
                  className={`absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full transition-[left] duration-100 ${
                    Math.abs(needle) <= IN_TUNE ? 'bg-[#5fd27a]' : 'bg-[#f2c14e]'
                  }`}
                  style={{ left: `${50 + needle}%` }}
                />
              )}
              <span className="absolute -bottom-4 left-0 text-[10px] text-[#7a6845]">−50</span>
              <span className="absolute -bottom-4 right-0 text-[10px] text-[#7a6845]">+50</span>
            </div>

            {/* график высоты */}
            <canvas
              ref={canvasRef}
              className="mt-6 h-24 w-full rounded-lg border border-[#2e2415] bg-[#14100a]"
              aria-label={t.graphLabel}
              role="img"
            />

            {tab === 'tuner' && <p className="mt-3 min-h-10 text-center text-sm text-[#c9b892]">{deviation}</p>}

            {tab === 'long' && (
              <div className="mt-3 text-center text-sm text-[#c9b892]">
                <div className="font-display text-3xl text-[#f2c14e]" aria-live="off">
                  {holdSec > 0 ? `${holdSec.toFixed(1)} ${t.sec}` : '—'}
                </div>
                <p className="mt-1 text-xs text-[#a08c64]">{t.longHint}</p>
                {lastHold && (
                  <p className="mt-2" role="status">
                    {t.lastTone}: <b className="text-[#e8d5ae]">{lastHold.sec.toFixed(1)} {t.sec}</b> · {t.avgDev}{' '}
                    <b className="text-[#e8d5ae]">
                      {lastHold.avg > 0 ? '+' : ''}
                      {Math.round(lastHold.avg)}
                    </b>{' '}
                    · {t.spread}{' '}
                    <b className={lastHold.spread <= 8 ? 'text-[#5fd27a]' : 'text-[#e8d5ae]'}>±{Math.round(lastHold.spread)}</b>{' '}
                    {t.cents}
                  </p>
                )}
                {bestHold > 0 && (
                  <p className="mt-1 text-xs text-[#a08c64]">
                    {t.best}: {bestHold.toFixed(1)} {t.sec}
                  </p>
                )}
              </div>
            )}

            {tab === 'follow' && (
              <div className="mt-3 space-y-3 text-center text-sm text-[#c9b892]">
                <p className="min-h-5" aria-live="polite">
                  {fPhase === 'done' ? (
                    <span className="font-semibold text-[#5fd27a]">✓ {t.correct}</span>
                  ) : fPhase === 'listen' && fWrong !== null ? (
                    <span className="text-[#ff8a78]">
                      {t.followWrong} {midiName(fWrong, sharp)} — {fWrong < targetMidi ? t.goHigher : t.goLower}
                    </span>
                  ) : fPhase === 'listen' && onTarget && !inTune ? (
                    <>
                      {Math.abs(centsFromTarget)} {t.cents} {centsFromTarget < 0 ? t.flat : t.sharp}
                    </>
                  ) : null}
                </p>
                <div className="flex gap-2">
                  {fIdx === null ? (
                    <button
                      onClick={() => nextFollow()}
                      className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#f6d98a] to-[#c8922e] font-semibold text-[#241a08] hover:brightness-110"
                    >
                      <Play size={18} /> {t.start}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => nextFollow(true)}
                        className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#4a3b22] font-semibold text-[#e8d5ae] hover:bg-[#241c11]"
                      >
                        <RotateCcw size={16} /> {t.replay}
                      </button>
                      <button
                        onClick={() => {
                          if (fPhase !== 'done') setFScore((s) => ({ ...s, total: s.total + 1 }))
                          nextFollow()
                        }}
                        className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#4a3b22] font-semibold text-[#e8d5ae] hover:bg-[#241c11]"
                      >
                        <SkipForward size={16} /> {t.skip}
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-[#a08c64]">
                  <span>
                    {t.score}: <b className="text-[#f2c14e]">{fScore.right}/{fScore.total}</b>
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hideName}
                      onChange={(e) => {
                        setHideName(e.target.checked)
                        writeNum('followHide', e.target.checked ? 1 : 0)
                      }}
                      className="h-4 w-4 accent-[#d9a441]"
                    />
                    {t.byEar}
                  </label>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
