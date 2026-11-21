import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { TRANSPOSE, detectPitch, freqToMidi, midiName, type Instrument } from '../lib/sound'
import type { STRINGS } from '../lib/i18n'

interface Props {
  onClose: () => void
  instrument: Instrument
  sharp: boolean
  /** письменный MIDI выбранной ноты — тюнер показывает отклонение от неё */
  targetMidi: number
  targetName: string
  t: (typeof STRINGS)['ru']
}

// Порог «точно»: ±10 центов — обычная учебная планка для духовых.
const IN_TUNE = 10

export default function Tuner({ onClose, instrument, sharp, targetMidi, targetName, t }: Props) {
  const [denied, setDenied] = useState(false)
  // письменная высота (с дробной частью), которую сейчас слышим
  const [heard, setHeard] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let stream: MediaStream | null = null
    let ac: AudioContext | null = null
    let raf = 0
    let alive = true
    const recent: number[] = []

    ;(async () => {
      try {
        // шумодав и автогромкость искажают высоту — выключаем
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
      } catch {
        if (alive) setDenied(true)
        return
      }
      if (!alive) return stream.getTracks().forEach((tr) => tr.stop())
      ac = new AudioContext()
      const analyser = ac.createAnalyser()
      analyser.fftSize = 4096
      ac.createMediaStreamSource(stream).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      let quiet = 0

      const tick = () => {
        analyser.getFloatTimeDomainData(buf)
        const f = detectPitch(buf, ac!.sampleRate)
        if (f) {
          quiet = 0
          // медиана последних 5 замеров гасит скачки на атаке звука
          recent.push(freqToMidi(f) - TRANSPOSE[instrument])
          if (recent.length > 5) recent.shift()
          const sorted = [...recent].sort((a, b) => a - b)
          setHeard(sorted[Math.floor(sorted.length / 2)])
        } else if (++quiet > 20) {
          recent.length = 0
          setHeard(null)
        }
        raf = requestAnimationFrame(tick)
      }
      tick()
    })()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((tr) => tr.stop())
      void ac?.close()
    }
  }, [instrument])

  const nearest = heard === null ? null : Math.round(heard)
  const centsFromNearest = heard === null ? 0 : Math.round((heard - nearest!) * 100)
  const centsFromTarget = heard === null ? 0 : Math.round((heard - targetMidi) * 100)
  const onTarget = nearest === targetMidi
  const inTune = onTarget && Math.abs(centsFromNearest) <= IN_TUNE
  // стрелка: −50…+50 центов от ближайшей ноты
  const needle = Math.max(-50, Math.min(50, centsFromNearest))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.tuner}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#3a2f1c] bg-[#1c1610] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-[#f2e3c2]">{t.tuner}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] text-[#d9c9a8] transition-colors hover:bg-[#2a2115] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
          >
            <X size={20} />
          </button>
        </div>

        {denied ? (
          <p className="py-8 text-center text-sm text-[#ff8a78]">{t.micDenied}</p>
        ) : (
          <>
            <div className="text-center text-sm text-[#a08c64]">
              {t.target}: <span className="font-semibold text-[#e8d5ae]">{targetName}</span> · {t[instrument]}
            </div>
            <div
              className={`font-display mt-3 text-center text-6xl leading-none transition-colors ${
                heard === null ? 'text-[#5c4c2e]' : inTune ? 'text-[#5fd27a]' : 'text-[#f2c14e]'
              }`}
              aria-live="polite"
            >
              {nearest === null ? '—' : midiName(nearest, sharp)}
            </div>

            {/* шкала центов */}
            <div className="relative mx-auto mt-6 h-10 w-full max-w-xs">
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
              <span className="absolute -bottom-5 left-0 text-[10px] text-[#7a6845]">−50</span>
              <span className="absolute -bottom-5 right-0 text-[10px] text-[#7a6845]">+50</span>
            </div>

            <p className="mt-8 min-h-10 text-center text-sm text-[#c9b892]">
              {heard === null ? (
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
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
