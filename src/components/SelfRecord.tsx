import { col } from '../lib/theme'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Circle, RotateCcw, Square, X } from 'lucide-react'
import { midiName, stopAll, type Instrument } from '../lib/sound'
import { stopMetronome } from '../lib/metronome'
import { usePitch } from '../lib/usePitch'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { SELFREC } from '../lib/i18n/selfrec'

interface Props {
  onClose: () => void
  instrument: Instrument
  sharp: boolean
  lang: Lang
  t: (typeof STRINGS)['ru']
}

/** кадр высоты: t — мс от начала записи, v — письменный MIDI (дробный) или null (тишина) */
interface Frame {
  t: number
  v: number | null
}

interface Take {
  url: string
  frames: Frame[]
  /** длительность по нашим часам, в секундах: у webm из MediaRecorder audio.duration = Infinity */
  dur: number
}

// Порог «точно» тот же, что в тюнере: ±10 центов.
const IN_TUNE = 10
const MAX_SEC = 60
const GRAPH_H = 200
// слева место под подписи нот
const LABEL_W = 34

/** отклонение от ближайшей ноты в центах, −50…+50 */
const centsOff = (v: number) => (v - Math.round(v)) * 100

/** границы графика: от min до max распознанного ±1 полутон; null — высоты не было */
function pitchRange(frames: Frame[]): { lo: number; hi: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const f of frames) {
    if (f.v === null) continue
    if (f.v < min) min = f.v
    if (f.v > max) max = f.v
  }
  if (min === Infinity) return null
  return { lo: Math.floor(min) - 1, hi: Math.ceil(max) + 1 }
}

/**
 * Итоги по звучащим кадрам. Кадры идут с частотой rAF, т.е. примерно равномерно
 * во времени, поэтому доля кадров ≈ доля времени — отдельно взвешивать не нужно.
 */
function takeStats(frames: Frame[]): { inTune: number; avgAbs: number } | null {
  let n = 0
  let ok = 0
  let sum = 0
  for (const f of frames) {
    if (f.v === null) continue
    const c = Math.abs(centsOff(f.v))
    n++
    sum += c
    if (c <= IN_TUNE) ok++
  }
  return n ? { inTune: Math.round((ok / n) * 100), avgAbs: Math.round(sum / n) } : null
}

function drawTake(cv: HTMLCanvasElement, take: Take, sharp: boolean, cursorSec: number) {
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const range = pitchRange(take.frames)
  if (!range) return
  const { lo, hi } = range
  const pad = 6
  const y = (m: number) => pad + ((hi - m) / (hi - lo)) * (h - 2 * pad)
  const plotW = w - LABEL_W
  const x = (ms: number) => LABEL_W + (ms / (take.dur * 1000)) * plotW

  // Сетка: линия на каждый полутон. На широком диапазоне подписи слиплись бы —
  // подписываем через одну/две, но линии оставляем все: они и есть «лесенка» нот.
  const rowH = (h - 2 * pad) / (hi - lo)
  const every = Math.max(1, Math.ceil(11 / rowH))
  g.font = '10px system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.lineWidth = 1
  for (let m = lo; m <= hi; m++) {
    g.strokeStyle = col('2e2415')
    g.beginPath()
    g.moveTo(LABEL_W, y(m))
    g.lineTo(w, y(m))
    g.stroke()
    if ((m - lo) % every === 0) {
      g.fillStyle = col('7a6845')
      g.fillText(midiName(m, sharp), 2, y(m))
    }
  }

  // Линия высоты: цвет меняем на границе «точно/нет», null — разрыв.
  g.lineWidth = 2.5
  g.lineJoin = 'round'
  let drawing = false
  let lastIn = false
  for (const f of take.frames) {
    if (f.v === null) {
      if (drawing) g.stroke()
      drawing = false
      continue
    }
    const inside = Math.abs(centsOff(f.v)) <= IN_TUNE
    const px = x(f.t)
    const py = y(f.v)
    if (!drawing || inside !== lastIn) {
      if (drawing) {
        g.lineTo(px, py)
        g.stroke()
      }
      g.beginPath()
      g.strokeStyle = inside ? col('5fd27a') : col('f2c14e')
      g.moveTo(px, py)
      drawing = true
    } else g.lineTo(px, py)
    lastIn = inside
  }
  if (drawing) g.stroke()

  // курсор воспроизведения
  const cx = x(Math.min(cursorSec, take.dur) * 1000)
  g.strokeStyle = col('f0e6d2')
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(cx, 0)
  g.lineTo(cx, h)
  g.stroke()
}

const BTN =
  'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-not-allowed disabled:opacity-50'
const PRIMARY = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const GHOST = 'border border-[var(--c-4a3b22)] text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)]'

export default function SelfRecord({ onClose, instrument, sharp, lang, t }: Props) {
  const s = pick(SELFREC, lang)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [take, setTake] = useState<Take | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const frames = useRef<Frame[]>([])
  const startedAt = useRef(0)

  // Кадры копим только во время записи; ссылку на массив держим в ref —
  // setState на каждый кадр (60 раз в секунду) перерисовывал бы всё окно.
  const onFrame = useCallback((v: number | null, now: number) => {
    if (recRef.current?.state === 'recording') frames.current.push({ t: now - startedAt.current, v })
  }, [])
  const { denied } = usePitch(instrument, onFrame, setStream)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Как в тюнере: звук из динамика попал бы в запись и в график высоты.
  useEffect(() => {
    stopMetronome()
    stopAll()
  }, [])

  // Закрыли окно посреди записи — глушим рекордер и не собираем дубль.
  // Дорожки микрофона останавливает сам usePitch: поток его.
  useEffect(
    () => () => {
      const rec = recRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
      }
    },
    [],
  )

  // object URL держит блоб в памяти до revoke: отпускаем при новом дубле и при закрытии
  useEffect(() => {
    const url = take?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [take])

  const stop = useCallback(() => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const start = () => {
    if (!stream) return
    setErr(null)
    audioRef.current?.pause()
    if (typeof MediaRecorder === 'undefined') return setErr(s.noRecorder)
    let rec: MediaRecorder
    try {
      // mimeType не задаём: Chrome сам даст webm/opus, iOS Safari — audio/mp4
      rec = new MediaRecorder(stream)
    } catch {
      return setErr(s.recError)
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.onstop = () => {
      setRecording(false)
      const dur = (performance.now() - startedAt.current) / 1000
      // тип блоба — тот, что реально выдал рекордер; иначе Safari не проиграет mp4
      const type = rec.mimeType || chunks[0]?.type || 'audio/webm'
      setTake({ url: URL.createObjectURL(new Blob(chunks, { type })), frames: frames.current, dur })
    }
    frames.current = []
    try {
      rec.start()
    } catch {
      return setErr(s.recError)
    }
    recRef.current = rec
    startedAt.current = performance.now()
    setTake(null)
    setElapsed(0)
    setRecording(true)
  }

  // таймер записи и потолок 60 с
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      const sec = (performance.now() - startedAt.current) / 1000
      setElapsed(sec)
      if (sec >= MAX_SEC) stop()
    }, 200)
    return () => clearInterval(id)
  }, [recording, stop])

  // График: рисуем сразу и потом каждый кадр, пока играет (курсор едет за audio.currentTime).
  // Перерисовка целиком дешёвая: даже 60 с — это ~3600 точек.
  useEffect(() => {
    const cv = canvasRef.current
    const au = audioRef.current
    if (!take || !cv || !au) return
    let raf = 0
    const paint = () => drawTake(cv, take, sharp, au.currentTime)
    const loop = () => {
      paint()
      raf = requestAnimationFrame(loop)
    }
    const play = () => {
      cancelAnimationFrame(raf)
      loop()
    }
    const halt = () => {
      cancelAnimationFrame(raf)
      paint()
    }
    paint()
    au.addEventListener('play', play)
    au.addEventListener('pause', halt)
    au.addEventListener('ended', halt)
    au.addEventListener('seeked', paint)
    window.addEventListener('resize', paint)
    return () => {
      cancelAnimationFrame(raf)
      au.removeEventListener('play', play)
      au.removeEventListener('pause', halt)
      au.removeEventListener('ended', halt)
      au.removeEventListener('seeked', paint)
      window.removeEventListener('resize', paint)
    }
  }, [take, sharp])

  const seekTo = (sec: number) => {
    const au = audioRef.current
    if (!au || !take) return
    au.currentTime = Math.max(0, Math.min(take.dur, sec))
    drawTake(canvasRef.current!, take, sharp, au.currentTime)
  }

  const onGraphClick = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!take) return
    const r = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - r.left - LABEL_W) / (r.width - LABEL_W)
    seekTo(frac * take.dur)
  }

  const stats = take ? takeStats(take.frames) : null
  const voiced = take ? pitchRange(take.frames) !== null : false

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[var(--c-f5e8cd)]">{s.title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-d9c9a8)] transition-colors hover:bg-[var(--c-2a2115)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <X size={20} />
          </button>
        </div>

        {denied ? (
          <p className="py-8 text-center text-sm text-[var(--c-ff8a78)]">{t.micDenied}</p>
        ) : (
          <>
            {!take && !recording && <p className="mb-4 text-sm text-[var(--c-a08c64)]">{s.intro}</p>}

            {recording ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-[var(--c-ff8a78)]" aria-live="polite">
                  <Circle size={12} className="animate-pulse fill-[var(--c-ff8a78)]" />
                  {s.recording}
                </div>
                <div className="text-3xl font-bold tabular-nums text-[var(--c-f0e6d2)]">
                  {elapsed.toFixed(1)} <span className="text-base text-[var(--c-a08c64)]">/ {MAX_SEC} {t.sec}</span>
                </div>
                <button onClick={stop} className={`${BTN} ${PRIMARY} w-full`}>
                  <Square size={16} /> {t.stop}
                </button>
              </div>
            ) : (
              <button onClick={start} disabled={!stream} className={`${BTN} ${take ? GHOST : PRIMARY} w-full`}>
                {take ? <RotateCcw size={16} /> : <Circle size={16} />}
                {!stream ? s.waitMic : take ? s.again : s.record}
                {stream && !take && <span className="font-normal opacity-70">· {s.maxLen}</span>}
              </button>
            )}

            {err && <p className="mt-3 text-center text-sm text-[var(--c-ff8a78)]">{err}</p>}

            {take && (
              <div className="mt-4 flex flex-col gap-3">
                <audio ref={audioRef} src={take.url} controls preload="auto" className="w-full" />
                {voiced ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      onPointerDown={onGraphClick}
                      onKeyDown={(e) => {
                        const au = audioRef.current
                        if (!au || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
                        e.preventDefault()
                        seekTo(au.currentTime + (e.key === 'ArrowRight' ? 2 : -2))
                      }}
                      // стрелки ←/→ — перемотка на 2 с для тех, кто без мыши
                      tabIndex={0}
                      aria-label={`${s.graph}. ${s.graphHint}`}
                      style={{ height: GRAPH_H }}
                      className="w-full cursor-pointer touch-none rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
                    />
                    <p className="text-xs text-[var(--c-7a6845)]">{s.graphHint}</p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--c-a08c64)]">{s.noPitch}</p>
                )}
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Stat label={s.duration} value={`${take.dur.toFixed(1)} ${t.sec}`} />
                  <Stat label={s.inTune} value={stats ? `${stats.inTune}%` : '—'} good={!!stats && stats.inTune >= 70} />
                  <Stat label={s.avgDev} value={stats ? `${stats.avgAbs} ${t.cents}` : '—'} />
                </dl>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--c-2e2415)] bg-[var(--c-14100a)] px-2 py-2">
      <dt className="text-[11px] leading-tight text-[var(--c-7a6845)]">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${good ? 'text-[var(--c-5fd27a)]' : 'text-[var(--c-f2e3c2)]'}`}>{value}</dd>
    </div>
  )
}

// DEV-самопроверка чистой логики (в прод-сборку не попадает)
if (import.meta.env.DEV) {
  const fr: Frame[] = [
    { t: 0, v: 60.02 },
    { t: 16, v: null },
    { t: 32, v: 62.3 },
    { t: 48, v: 61.95 },
  ]
  const r = pitchRange(fr)
  console.assert(r?.lo === 59 && r?.hi === 64, 'selfrec: range', r)
  console.assert(pitchRange([{ t: 0, v: null }]) === null, 'selfrec: empty range')
  const st = takeStats(fr)
  // 2 cents, 30 cents, 5 cents → 2 из 3 чисто, среднее 12
  console.assert(st?.inTune === 67 && st?.avgAbs === 12, 'selfrec: stats', st)
  console.assert(Math.abs(centsOff(61.6) + 40) < 1e-9, 'selfrec: cents')
}
