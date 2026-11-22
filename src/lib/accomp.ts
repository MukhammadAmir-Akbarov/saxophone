// Аккомпанемент к мелодии: на каждый аккорд — мягкий бас (корень, низко) на
// первую долю и тихая тянущаяся «подушка» из звуков аккорда. Тихо и через фильтр,
// чтобы саксофон (свой или синтез мелодии) оставался сверху.
//
// Аккорды записаны в ПИСЬМЕННОЙ тональности, как и мелодия; звучать они должны
// в концертном строе инструмента: концертный = письменный + TRANSPOSE[строй].
//
// Отдельно от playNote: новая нота мелодии глушит предыдущую ноту, но не аккорд.

import { CHORD_TONES, parseChords } from './melody'
import { audioCtx, midiToFreq, TRANSPOSE, type Instrument } from './sound'

/** класс высоты → MIDI в окне [lo, lo+12): бас и подушка всегда в своём регистре */
const inWindow = (pc: number, lo: number) => lo + ((((pc - lo) % 12) + 12) % 12)

// регистры (концертные MIDI): бас E2…D♯3, подушка E3…D♯4 — под мелодией альта/сопрано
const BASS_LO = 40
const PAD_LO = 52

/**
 * Запланировать весь аккомпанемент сразу по часам аудио-контекста.
 * startTime — audio-время первой доли мелодии (после отсчёта).
 * transpose — сдвиг тональности мелодии в полутонах (письменных).
 * Возвращает stop(): глушит всё, в том числе ещё не начавшиеся аккорды.
 */
export function startAccomp(chords: string, bpm: number, startTime: number, instrument: Instrument, transpose = 0): () => void {
  const ac = audioCtx()
  const master = ac.createGain()
  master.connect(ac.destination)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  lp.connect(master)
  const beat = 60 / bpm
  const oscs: OscillatorNode[] = []

  const voice = (freq: number, type: OscillatorType, at: number, len: number, peak: number, bass: boolean) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ac.createGain()
    g.gain.setValueAtTime(0, at)
    if (bass) {
      // бас — щипок: быстрая атака и затухание к концу аккорда (не гудит поверх смены)
      g.gain.linearRampToValueAtTime(peak, at + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.1, len * 0.95))
    } else {
      // подушка — плавно входит и выходит; зазор в конце, чтобы смена аккорда не щёлкала
      const edge = Math.min(0.12, len / 3)
      g.gain.linearRampToValueAtTime(peak, at + edge)
      g.gain.setValueAtTime(peak, at + len - edge)
      g.gain.linearRampToValueAtTime(0, at + len)
    }
    o.connect(g).connect(lp)
    o.start(at)
    o.stop(at + len + 0.05)
    oscs.push(o)
  }

  // ponytail: всё запланировано вперёд; если вкладка уснёт и метроном «догонит»
  // счёт, аккомпанемент разойдётся с ним — тогда «Стоп» и заново
  let t = startTime
  for (const c of parseChords(chords).chords) {
    const len = c.beats * beat
    if (c.pc !== null) {
      const pc = c.pc + transpose + TRANSPOSE[instrument]
      // тенор и баритон звучат на октаву (и ниже) ниже альта — опускаем и аккомпанемент,
      // иначе пэд оказался бы поверх мелодии саксофона
      const low = TRANSPOSE[instrument] <= -14 ? -12 : 0
      voice(midiToFreq(inWindow(pc, BASS_LO + low)), 'triangle', t, len, 0.22, true)
      const root = inWindow(pc, PAD_LO + low)
      const tones = CHORD_TONES[c.quality]
      // громкость делим на число голосов: септаккорд не громче трезвучия
      for (const iv of tones) voice(midiToFreq(root + iv), 'sine', t, len, 0.09 / tones.length, false)
    }
    t += len
  }

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    const now = ac.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(0, now + 0.08)
    for (const o of oscs) {
      try {
        o.stop(now + 0.1)
      } catch {
        /* уже отзвучал */
      }
    }
    setTimeout(() => master.disconnect(), 200)
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  // письменный G у альта звучит как B♭: (7 − 9) → 10; окно держит регистр
  console.assert(inWindow(7 + TRANSPOSE.alto, BASS_LO) === 46 && inWindow(4, BASS_LO) === 40 && inWindow(3, BASS_LO) === 51, 'accomp window')
}
