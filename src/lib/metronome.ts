// Метроном на Web Audio. Щелчки планируются по часам аудио-контекста с запасом
// вперёд (lookahead): setInterval в фоне дрожит на десятки мс, а audio-время — нет.
// Колбэки (подсветка доли, шаг гаммы) зовутся по setTimeout к моменту щелчка —
// для глаз точности хватает.
//
// Умеет: размер и ударения по долям, дробление доли (восьмые/триоли/шестнадцатые),
// 4 тембра и громкость, тренажёр скорости (темп растёт каждые N тактов),
// «пропуск тактов» (N тактов звучит, M молчит — проверка внутреннего темпа),
// таймер занятия.

import { audioCtx } from './sound'

/** 0 — тишина, 1 — слабая, 2 — средняя, 3 — сильная доля */
export type Accent = 0 | 1 | 2 | 3
export type ClickSound = 'click' | 'wood' | 'beep' | 'bell'
export const CLICK_SOUNDS: ClickSound[] = ['click', 'wood', 'beep', 'bell']

export interface MetronomeOpts {
  bpm: number
  /** долей в такте; без accents первая — сильная */
  beats: number
  /** ударение каждой доли; длина = beats (недостающее — по умолчанию) */
  accents?: Accent[]
  /** щелчков на долю: 1 — четверти, 2 — восьмые, 3 — триоли, 4 — шестнадцатые */
  subdiv?: number
  sound?: ClickSound
  /** 0…1 */
  volume?: number
  /** щёлкать ли вообще (гамма может идти и без щелчков) */
  click?: boolean
  /** тренажёр скорости: +step уд/мин каждые every тактов, пока не дойдёт до to */
  speed?: { to: number; step: number; every: number } | null
  /** пропуск тактов: play тактов звучит, mute тактов молчит (огоньки идут) */
  gap?: { play: number; mute: number } | null
  /** остановиться через столько секунд (таймер занятия) */
  stopAfter?: number
  onBeat?: (beat: number, count: number) => void
  /** кто запустил: окно метронома меняет настройки только своему, не гамме */
  owner?: string
}

export interface BeatInfo {
  beat: number
  /** номер такта с нуля */
  bar: number
  bpm: number
  /** такт молчит (пропуск тактов) */
  muted: boolean
}

let opts: MetronomeOpts | null = null
let timer = 0
let nextTime = 0
let startTime = 0
let beat = 0
let sub = 0
let bar = 0
let count = 0
// поколение: колбэки, запланированные до stop(), не должны сработать после него
let gen = 0
const listeners = new Set<(running: boolean) => void>()
const beatListeners = new Set<(b: BeatInfo) => void>()
const tempoListeners = new Set<(bpm: number) => void>()
// щелчки, уже поставленные в очередь аудио (до 120 мс вперёд), — их глушим на стопе
let scheduled: AudioScheduledSourceNode[] = []
let noise: AudioBuffer | null = null

export const defaultAccents = (beats: number): Accent[] => Array.from({ length: beats }, (_, i) => (i === 0 ? 3 : 1))

function track(n: AudioScheduledSourceNode) {
  scheduled.push(n)
  n.onended = () => (scheduled = scheduled.filter((x) => x !== n))
}

/** один щелчок; level 1–3 — сила доли, isSub — щелчок дробления (тише и ниже) */
function click(at: number, level: number, isSub: boolean, sound: ClickSound, volume: number) {
  const ac = audioCtx()
  const out = ac.createGain()
  out.connect(ac.destination)
  const loud = (isSub ? 0.35 : [0, 0.45, 0.7, 1][level]) * volume
  // высота растёт с силой доли — сильную слышно, даже не глядя
  const pitch = isSub ? 0.75 : [1, 1, 1.25, 1.6][level]

  if (sound === 'wood') {
    // «деревяшка»: короткий шум через узкий полосовой фильтр
    noise ??= (() => {
      const b = ac.createBuffer(1, Math.round(ac.sampleRate * 0.1), ac.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      return b
    })()
    const src = ac.createBufferSource()
    src.buffer = noise
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400 * pitch
    bp.Q.value = 12
    out.gain.setValueAtTime(loud * 3, at)
    out.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
    src.connect(bp).connect(out)
    src.start(at)
    src.stop(at + 0.06)
    track(src)
    return
  }

  // «колокольчик» — два негармоничных тона, как у ковбелла; остальные — один
  const freqs = sound === 'bell' ? [560 * pitch, 845 * pitch] : [(sound === 'beep' ? 880 : 1100) * pitch]
  const len = sound === 'beep' ? 0.08 : sound === 'bell' ? 0.15 : 0.04
  out.gain.setValueAtTime(0, at)
  out.gain.linearRampToValueAtTime(loud * (sound === 'bell' ? 0.35 : 0.5), at + 0.002)
  out.gain.exponentialRampToValueAtTime(0.001, at + len)
  for (const f of freqs) {
    const o = ac.createOscillator()
    o.type = sound === 'beep' ? 'sine' : 'square'
    o.frequency.value = f
    if (sound === 'bell') {
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 2600
      o.connect(bp).connect(out)
    } else o.connect(out)
    o.start(at)
    o.stop(at + len + 0.02)
    track(o)
  }
}

function schedule() {
  if (!opts) return
  const ac = audioCtx()
  if (opts.stopAfter && ac.currentTime - startTime >= opts.stopAfter) return stopMetronome()
  const my = gen
  // если вкладка спала и мы отстали — не выстреливаем пачку щелчков, а догоняем
  if (nextTime < ac.currentTime - 0.2) nextTime = ac.currentTime + 0.05
  while (nextTime < ac.currentTime + 0.12) {
    const o = opts
    const subdiv = Math.max(1, o.subdiv ?? 1)
    const gap = o.gap
    const muted = !!gap && gap.play > 0 && gap.mute > 0 && bar % (gap.play + gap.mute) >= gap.play
    const level = o.accents?.[beat] ?? (beat === 0 ? 3 : 1)
    // дробление звучит, только если сама доля не выключена
    if (o.click !== false && !muted && level > 0) click(nextTime, level, sub > 0, o.sound ?? 'click', o.volume ?? 0.8)

    if (sub === 0) {
      const info: BeatInfo = { beat, bar, bpm: o.bpm, muted }
      const c = count
      const cb = o.onBeat
      setTimeout(
        () => {
          if (my !== gen) return
          cb?.(info.beat, c)
          beatListeners.forEach((l) => l(info))
        },
        Math.max(0, (nextTime - ac.currentTime) * 1000),
      )
    }

    nextTime += 60 / o.bpm / subdiv
    if (++sub >= subdiv) {
      sub = 0
      count++
      if (++beat >= o.beats) {
        beat = 0
        bar++
        // тренажёр скорости: темп растёт на границе такта
        const sp = o.speed
        if (sp && sp.every > 0 && bar % sp.every === 0 && o.bpm < sp.to) {
          o.bpm = clampBpm(Math.min(sp.to, o.bpm + sp.step))
          const bpm = o.bpm
          tempoListeners.forEach((l) => l(bpm))
        }
      }
    }
  }
}

export function startMetronome(o: MetronomeOpts) {
  stopMetronome()
  gen++
  opts = { ...o }
  beat = 0
  sub = 0
  bar = 0
  count = 0
  startTime = audioCtx().currentTime
  nextTime = startTime + 0.08
  schedule()
  timer = window.setInterval(schedule, 25)
  listeners.forEach((l) => l(true))
}

/** сменить настройки на ходу, не сбивая счёт; только если метроном запустил тот же owner */
export function updateMetronome(o: Partial<Omit<MetronomeOpts, 'onBeat' | 'owner'>>, owner?: string) {
  if (!opts || opts.owner !== owner) return
  Object.assign(opts, o)
  beat %= opts.beats
  sub %= Math.max(1, opts.subdiv ?? 1)
}

export function stopMetronome() {
  if (!opts) return
  gen++
  clearInterval(timer)
  scheduled.forEach((n) => {
    try {
      n.stop()
    } catch {
      /* уже отзвучал */
    }
  })
  scheduled = []
  opts = null
  listeners.forEach((l) => l(false))
}

export const metronomeRunning = () => opts !== null
export const metronomeOwner = () => opts?.owner
/** секунд с запуска (для таймера в окне) */
export const metronomeElapsed = () => (opts ? audioCtx().currentTime - startTime : 0)

/** подписка на старт/стоп — кнопка в шапке подсвечивается, пока метроном идёт */
export function onMetronomeChange(l: (running: boolean) => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** подписка на доли — мигающие точки и счётчик тактов в окне метронома */
export function onMetronomeBeat(l: (b: BeatInfo) => void) {
  beatListeners.add(l)
  return () => void beatListeners.delete(l)
}

/** тренажёр скорости поднял темп — окно показывает новый */
export function onMetronomeTempo(l: (bpm: number) => void) {
  tempoListeners.add(l)
  return () => void tempoListeners.delete(l)
}

export const clampBpm = (v: number) => Math.max(20, Math.min(300, Math.round(v)))

/** итальянское название темпа — так его пишут в нотах */
export function tempoName(bpm: number): string {
  const names: Array<[number, string]> = [
    [40, 'Grave'],
    [60, 'Largo'],
    [66, 'Larghetto'],
    [76, 'Adagio'],
    [108, 'Andante'],
    [120, 'Moderato'],
    [156, 'Allegro'],
    [176, 'Vivace'],
    [200, 'Presto'],
  ]
  return names.find(([max]) => bpm < max)?.[1] ?? 'Prestissimo'
}
