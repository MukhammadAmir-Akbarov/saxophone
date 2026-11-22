// Ансамбль: одна мелодия на три голоса для разных саксофонов.
//
// Мелодии в data/melodies.ts записаны для АЛЬТА (письменная высота, как и аккорды).
// Ансамбль думает в КОНЦЕРТНОМ строе — реальном звуке, одинаковом для всех:
// концертный = письменный альта + TRANSPOSE.alto. Каждому строю партия пишется
// обратно: письменный = концертный − TRANSPOSE[строй], и целиком сдвигается на
// октаву, если не влезает в удобный диапазон.
//
// Свой синтез, а не playNote: playNote монофонический (каждый вызов глушит
// предыдущую ноту), а тут три голоса звучат одновременно.

import { NOTES } from '../data/notes'
import { MELODIES, type Melody } from '../data/melodies'
import { CHORD_TONES, parseChords, parseMelody, type Chord } from './melody'
import { audioCtx, midiToFreq, TRANSPOSE, writtenMidi, type Instrument } from './sound'

/** нота партии в концертном строе; null — пауза */
export interface EnsNote {
  concert: number | null
  beats: number
}

export type PartId = 'melody' | 'second' | 'bass'
export const PART_IDS: PartId[] = ['melody', 'second', 'bass']
export type Parts = Record<PartId, EnsNote[]>

/** нота для конкретного строя — как MelodyNote: индекс в NOTES или пауза */
export interface WrittenNote {
  index: number | null
  beats: number
}

const BY_MIDI = new Map(NOTES.map((n, i) => [writtenMidi(n.id), i]))
const mod12 = (v: number) => ((v % 12) + 12) % 12

// бас — корни аккордов в окне C2…B2 (концертные, это регистр баритона); в письменный
// диапазон остальных строёв его потом сдвигает partForInstrument.
// ponytail: окно фиксированное — при очень низкой мелодии бас может на миг подняться
// над вторым голосом; тогда выбирать октаву баса под второй голос
const BASS_LO = 36

/** аккорд, звучащий на доле beat; на «r» (затакт) — ближайший следующий: второму голосу нужна гармония */
function chordAt(chords: Chord[], beat: number): Chord | null {
  let acc = 0
  let k = 0
  for (; k < chords.length; k++) {
    if (beat < acc + chords[k].beats) break
    acc += chords[k].beats
  }
  for (let j = k; j < chords.length; j++) if (chords[j].pc !== null) return chords[j]
  for (let j = k - 1; j >= 0; j--) if (chords[j].pc !== null) return chords[j]
  return null
}

/**
 * Три голоса из мелодии и её аккордов (всё — в концертном строе).
 * Второй голос: на каждую ноту мелодии — звук аккорда на 3…9 полутонов ниже,
 * лучше терция или секста (они «сладкие»), и ближе к своей прошлой ноте —
 * плавное голосоведение, без скачков. В окне из 7 полутонов звук трезвучия
 * есть всегда (самый большой зазор в трезвучии — кварта), так что выбор не пуст.
 */
export function buildParts(m: Pick<Melody, 'text' | 'chords'>): Parts {
  const notes = parseMelody(m.text).notes
  const chords = parseChords(m.chords).chords
  const shiftAlto = TRANSPOSE.alto

  const melody: EnsNote[] = notes.map((n) => ({ concert: n.index === null ? null : writtenMidi(NOTES[n.index].id) + shiftAlto, beats: n.beats }))

  const second: EnsNote[] = []
  let prev: number | null = null
  let beat = 0
  for (const n of melody) {
    const c = chordAt(chords, beat)
    beat += n.beats
    if (n.concert === null || !c) {
      second.push({ concert: null, beats: n.beats })
      continue
    }
    const tones = new Set(CHORD_TONES[c.quality].map((iv) => mod12(c.pc! + shiftAlto + iv)))
    // первая нота — «как будто» были терцией ниже: стартуем от сладкого интервала
    const ref = prev ?? n.concert - 4
    let best = n.concert - 4
    let bestCost = Infinity
    for (let d = 3; d <= 9; d++) {
      const cand = n.concert - d
      if (!tones.has(mod12(cand))) continue
      // штраф 2 за не-терцию/не-сексту: скачок на полутон дешевле, чем кварта вместо терции
      const cost = Math.abs(cand - ref) + ([3, 4, 8, 9].includes(d) ? 0 : 2)
      if (cost < bestCost) {
        bestCost = cost
        best = cand
      }
    }
    second.push({ concert: best, beats: n.beats })
    prev = best
  }

  // бас — одна нота на аккорд: корень на всю длину аккорда
  const bass: EnsNote[] = chords.map((c) => ({
    concert: c.pc === null ? null : BASS_LO + mod12(c.pc + shiftAlto - BASS_LO),
    beats: c.beats,
  }))

  return { melody, second, bass }
}

// удобный письменный диапазон: B♭3…F6 (A3 — только баритон), выше — альтиссимо
const HI = 89
const lowest = (inst: Instrument) => (inst === 'baritone' ? 57 : 58)

/**
 * Сдвиг партии на октавы (письменных полутонов, кратно 12), чтобы она целиком
 * легла в диапазон строя. Предпочитаем 0 (звук как задуман), потом ±12, ±24.
 * Не влезает никак (не бывает у наших мелодий) — 0.
 */
export function octaveShift(part: EnsNote[], inst: Instrument): number {
  const w = part.flatMap((n) => (n.concert === null ? [] : [n.concert - TRANSPOSE[inst]]))
  if (!w.length) return 0
  const lo = Math.min(...w)
  const hi = Math.max(...w)
  for (const s of [0, 12, -12, 24, -24, 36, -36]) if (lo + s >= lowest(inst) && hi + s <= HI) return s
  return 0
}

/** партия для строя: письменные ноты (индексы NOTES), октавный сдвиг уже применён */
export function partForInstrument(part: EnsNote[], inst: Instrument): WrittenNote[] {
  const s = octaveShift(part, inst)
  return part.map((n) => ({
    // вне таблицы нот (теоретически, если сдвиг не нашёлся) — пауза, а не падение
    index: n.concert === null ? null : (BY_MIDI.get(n.concert - TRANSPOSE[inst] + s) ?? null),
    beats: n.beats,
  }))
}

// ── многоголосный синтез ─────────────────────────────────────────────────

export interface EnsPlayback {
  /** громкость партии 0…1 — микшер двигает её прямо во время игры */
  setGain: (p: PartId, v: number) => void
  stop: () => void
}

/**
 * Запланировать все партии сразу по часам аудио (как accomp.ts): setTimeout в
 * фоне дрожит, audio-время — нет. startTime — audio-время первой доли.
 * gains — начальная громкость каждой партии; не переданные в parts партии не звучат вовсе.
 * semis — сдвиг концертной высоты партии (своя партия звучит той октавой, что играет ученик).
 */
export function playParts(parts: Partial<Record<PartId, EnsNote[]>>, bpm: number, startTime: number, gains: Record<PartId, number>, semis: Partial<Record<PartId, number>> = {}): EnsPlayback {
  const ac = audioCtx()
  const master = ac.createGain()
  master.connect(ac.destination)
  const beat = 60 / bpm
  const oscs: OscillatorNode[] = []
  const bus = {} as Record<PartId, GainNode>

  const voice = (out: AudioNode, freq: number, type: OscillatorType, at: number, len: number, peak: number) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    const env = ac.createGain()
    // атака/спад с зазором — повторы одной ноты (G G G) не сливаются и не щёлкают
    const edge = Math.min(0.04, len / 4)
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(peak, at + edge)
    env.gain.setValueAtTime(peak, at + len - edge)
    env.gain.linearRampToValueAtTime(0, at + len)
    o.connect(env).connect(out)
    o.start(at)
    o.stop(at + len + 0.05)
    oscs.push(o)
  }

  for (const id of PART_IDS) {
    const g = ac.createGain()
    g.gain.value = gains[id]
    g.connect(master)
    bus[id] = g
    const notes = parts[id]
    if (!notes) continue
    // фильтр мягчит пилу: три синтетических голоса без него режут ухо
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = id === 'bass' ? 700 : 2200
    lp.connect(g)
    let t = startTime
    for (const n of notes) {
      const len = n.beats * beat
      if (n.concert !== null) voice(lp, midiToFreq(n.concert + (semis[id] ?? 0)), id === 'bass' ? 'triangle' : 'sawtooth', t, len * 0.92, id === 'bass' ? 0.3 : 0.1)
      t += len
    }
  }

  let stopped = false
  return {
    setGain: (p, v) => {
      if (!stopped) bus[p].gain.setTargetAtTime(v, ac.currentTime, 0.03)
    },
    stop: () => {
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
    },
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  {
    // концертное C у альта пишется как A (письменная A4 альта звучит C4)
    console.assert(writtenMidi('a_4') + TRANSPOSE.alto === 60, 'ensemble alto A4 → C4')
    const ode = MELODIES.find((m) => m.id === 'odeToJoy')!
    const p = buildParts(ode)
    // первая нота «Оды» у альта B4 → звучит D4 → тенор пишет E5 (нона вверх от звука)
    const ten = partForInstrument(p.melody, 'tenor')
    console.assert(p.melody[0].concert === 62 && NOTES[ten[0].index!].id === 'e_5', 'ensemble ode tenor', ten[0])
    // сопрано пишет на тон выше звука: D4 → E4, но нижнее D4 «Оды» (звук F3) ниже его
    // B♭3 — вся партия уходит на октаву вверх: E5
    console.assert(octaveShift(p.melody, 'soprano') === 12 && NOTES[partForInstrument(p.melody, 'soprano')[0].index!].id === 'e_5', 'ensemble ode soprano')
    for (const m of MELODIES) {
      const q = buildParts(m)
      // второй голос всегда ниже мелодии на 3…9 полутонов, паузы совпадают
      q.second.forEach((n, i) => {
        const mel = q.melody[i].concert
        console.assert(mel === null ? n.concert === null : n.concert !== null && mel - n.concert >= 3 && mel - n.concert <= 9, 'ensemble second', m.id, i)
      })
      // бас в своём окне, и каждая партия ложится в диапазон каждого строя
      console.assert(q.bass.every((n) => n.concert === null || (n.concert >= BASS_LO && n.concert < BASS_LO + 12)), 'ensemble bass', m.id)
      for (const inst of ['soprano', 'alto', 'tenor', 'baritone'] as Instrument[])
        for (const id of PART_IDS)
          console.assert(
            partForInstrument(q[id], inst).every((n, i) => (n.index === null) === (q[id][i].concert === null) && (n.index === null || (writtenMidi(NOTES[n.index].id) >= lowest(inst) && writtenMidi(NOTES[n.index].id) <= HI))),
            'ensemble range',
            m.id,
            inst,
            id,
          )
    }
  }
}
