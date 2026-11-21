// Звук: проигрывание записей, синтез для нот без записи, транспозиция по строю
// и распознавание высоты для тюнера.
//
// Записи mp3 сделаны на АЛЬТ-саксофоне: замерено — письменная A4 звучит как C4
// (−9 полутонов). Поэтому для других строёв запись проигрывается со сдвигом
// скорости (playbackRate), а синтез и тюнер считают от реальной частоты.

import { audioFile } from '../data/notes'

export type Instrument = 'soprano' | 'alto' | 'tenor' | 'baritone'

/** на сколько полутонов реальный звук ниже письменной ноты */
export const TRANSPOSE: Record<Instrument, number> = {
  soprano: -2, // B♭
  alto: -9, // E♭
  tenor: -14, // B♭, на октаву ниже сопрано
  baritone: -21, // E♭, на октаву ниже альта
}

const RECORDED_ON: Instrument = 'alto'

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** id ноты (c_4, db4, bb3) → письменный MIDI-номер */
export function writtenMidi(id: string): number {
  const pc = PC[id[0]] + (id[1] === 'b' ? -1 : 0)
  return 12 * (Number(id[2]) + 1) + pc
}

export function concertMidi(id: string, inst: Instrument): number {
  return writtenMidi(id) + TRANSPOSE[inst]
}

export function midiName(midi: number, sharp = false): string {
  const m = Math.round(midi)
  return (sharp ? SHARP_NAMES : FLAT_NAMES)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1)
}

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12)
export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440)

// ── проигрывание ─────────────────────────────────────────────────────────

let ctx: AudioContext | null = null
function audioCtx(): AudioContext {
  // Контекст создаём лениво: браузер разрешает звук только после жеста пользователя.
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Одновременно звучит одна нота: новая глушит предыдущую.
let stopCurrent: (() => void) | null = null

export function stopAll() {
  stopCurrent?.()
  stopCurrent = null
}

/** синтез «под саксофон»: пила + немного квадрата через фильтр, вибрато после атаки */
function synth(freq: number, seconds: number) {
  const ac = audioCtx()
  const t0 = ac.currentTime
  const out = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = Math.min(freq * 5, 6000)
  filter.Q.value = 0.8
  filter.connect(out)
  out.connect(ac.destination)

  const oscs = (['sawtooth', 'square'] as const).map((type, i) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ac.createGain()
    g.gain.value = i === 0 ? 0.6 : 0.15
    o.connect(g).connect(filter)
    return o
  })

  // вибрато ~5 Гц, вступает плавно — как у живого исполнителя
  const lfo = ac.createOscillator()
  lfo.frequency.value = 5
  const depth = ac.createGain()
  depth.gain.setValueAtTime(0, t0)
  depth.gain.linearRampToValueAtTime(freq * 0.006, t0 + Math.min(0.5, seconds / 2))
  lfo.connect(depth)
  oscs.forEach((o) => depth.connect(o.frequency))

  const peak = 0.22
  const end = t0 + seconds
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(peak, t0 + 0.05)
  out.gain.setValueAtTime(peak, end - 0.3)
  out.gain.linearRampToValueAtTime(0, end)

  const nodes = [...oscs, lfo]
  nodes.forEach((n) => {
    n.start(t0)
    n.stop(end + 0.05)
  })
  return () => {
    // быстрое затухание вместо резкого обрыва (без щелчка)
    const now = ac.currentTime
    out.gain.cancelScheduledValues(now)
    out.gain.setValueAtTime(out.gain.value, now)
    out.gain.linearRampToValueAtTime(0, now + 0.06)
    nodes.forEach((n) => n.stop(now + 0.08))
  }
}

/**
 * Сыграть ноту. Есть запись и не просили длинный тон → mp3 (настоящий тембр);
 * иначе синтез нужной высоты. Возвращает true, если был синтез.
 */
export function playNote(id: string, hasRecording: boolean, inst: Instrument, long: boolean): boolean {
  stopAll()
  if (hasRecording && !long) {
    const a = new Audio(audioFile(id))
    // ponytail: сдвиг скорости меняет и тембр/длину; для тенора/баритона честнее
    // отдельные записи, если появятся
    a.preservesPitch = false
    a.playbackRate = 2 ** ((TRANSPOSE[inst] - TRANSPOSE[RECORDED_ON]) / 12)
    void a.play().catch(() => {})
    stopCurrent = () => a.pause()
    return false
  }
  stopCurrent = synth(midiToFreq(concertMidi(id, inst)), long ? 4 : 1.2)
  return true
}

// ── распознавание высоты (тюнер) ─────────────────────────────────────────

/**
 * Автокорреляция с параболической интерполяцией. Возвращает частоту или null,
 * если тихо/шум. Диапазон 40–2000 Гц покрывает все саксофоны.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0
  for (const v of buf) rms += v * v
  if (Math.sqrt(rms / buf.length) < 0.01) return null

  const minLag = Math.floor(sampleRate / 2000)
  const maxLag = Math.min(Math.floor(sampleRate / 40), buf.length - 1)
  const n = buf.length
  const corr = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0
    for (let i = 0; i < n - lag; i++) s += buf[i] * buf[i + lag]
    corr[lag] = s / (n - lag)
  }
  let energy = 0
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i]
  energy /= n

  // Берём ПЕРВЫЙ пик выше 90% от максимума, а не сам максимум — иначе тюнер
  // путает ноту с её октавой ниже.
  let max = 0
  for (let lag = minLag; lag <= maxLag; lag++) max = Math.max(max, corr[lag])
  if (max < energy * 0.3) return null
  let best = -1
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (corr[lag] > max * 0.9 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      best = lag
      break
    }
  }
  if (best < 0) return null
  const a = corr[best - 1], b = corr[best], c = corr[best + 1]
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
  return sampleRate / (best + shift)
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  // самопроверка: имена/транспозиция и детектор на чистом синусе 261.63 Гц
  console.assert(writtenMidi('a_4') === 69 && writtenMidi('db4') === 61 && writtenMidi('bb3') === 58, 'writtenMidi')
  console.assert(midiName(concertMidi('a_4', 'alto')) === 'C4', 'alto A4 → C4')
  console.assert(midiName(concertMidi('c_5', 'tenor')) === 'B♭3', 'tenor C5 → B♭3')
  const sr = 44100, f = 261.63
  const sine = Float32Array.from({ length: 2048 }, (_, i) => Math.sin((2 * Math.PI * f * i) / sr) * 0.5)
  const got = detectPitch(sine, sr)
  console.assert(got !== null && Math.abs(freqToMidi(got) - 60) < 0.1, 'detectPitch', got)
}
