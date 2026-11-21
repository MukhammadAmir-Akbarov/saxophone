// Микрофон → письменная высота на каждом кадре. Общий для тюнера, графика
// длинного тона и «Сыграй за мной».

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TRANSPOSE, detectPitch, freqToMidi, type Instrument } from './sound'

/**
 * onFrame получает письменную высоту (дробный MIDI) или null, если тихо.
 * muteUntil(ms) — не слушать до момента performance.now(): пока звучит образец
 * из динамика, микрофон слышит его, а не ученика.
 */
export function usePitch(instrument: Instrument, onFrame: (written: number | null, now: number) => void) {
  const [denied, setDenied] = useState(false)
  const cb = useRef(onFrame)
  useLayoutEffect(() => {
    cb.current = onFrame
  })
  const mutedTill = useRef(0)

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
      // после await жест пользователя «истёк» — контекст может родиться спящим
      await ac.resume().catch(() => {})
      // окно закрыли, пока будили контекст, — не запускать цикл, который уже некому остановить
      if (!alive) return
      const analyser = ac.createAnalyser()
      analyser.fftSize = 4096
      ac.createMediaStreamSource(stream).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      let quiet = 0

      const tick = () => {
        if (!alive) return
        const now = performance.now()
        analyser.getFloatTimeDomainData(buf)
        const f = now < mutedTill.current ? null : detectPitch(buf, ac!.sampleRate)
        if (f) {
          quiet = 0
          // медиана последних 5 замеров гасит скачки на атаке звука
          recent.push(freqToMidi(f) - TRANSPOSE[instrument])
          if (recent.length > 5) recent.shift()
          const sorted = [...recent].sort((a, b) => a - b)
          cb.current(sorted[Math.floor(sorted.length / 2)], now)
        } else if (++quiet > 8) {
          recent.length = 0
          cb.current(null, now)
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

  return {
    denied,
    muteUntil: (t: number) => {
      mutedTill.current = t
    },
  }
}
