// Бурдон — тянущаяся опорная нота (тоника, по желанию с квинтой). Ученик играет
// гамму поверх и на слух ловит, где фальшивит: биения против ровного тона слышны
// сразу. Отдельно от playNote — новая нота гаммы не должна глушить бурдон.

import { audioCtx, midiToFreq } from './sound'

let nodes: { stop: () => void } | null = null
const listeners = new Set<(on: boolean) => void>()

/** концертные MIDI-номера звуков бурдона */
export function startDrone(midis: number[]) {
  stopDrone()
  const ac = audioCtx()
  const t0 = ac.currentTime
  const out = ac.createGain()
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(0.12 / Math.sqrt(midis.length), t0 + 0.6) // мягкое вступление
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1200
  lp.connect(out).connect(ac.destination)
  const oscs = midis.flatMap((m) => {
    const f = midiToFreq(m)
    // треугольник + чистый тон октавой ниже: тёплый, «органный», без резких обертонов
    return (['triangle', 'sine'] as const).map((type, i) => {
      const o = ac.createOscillator()
      o.type = type
      o.frequency.value = i === 0 ? f : f / 2
      const g = ac.createGain()
      g.gain.value = i === 0 ? 0.7 : 0.5
      o.connect(g).connect(lp)
      o.start(t0)
      return o
    })
  })
  nodes = {
    stop: () => {
      const now = ac.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setValueAtTime(out.gain.value, now)
      out.gain.linearRampToValueAtTime(0, now + 0.25)
      oscs.forEach((o) => o.stop(now + 0.3))
    },
  }
  listeners.forEach((l) => l(true))
}

export function stopDrone() {
  if (!nodes) return
  nodes.stop()
  nodes = null
  listeners.forEach((l) => l(false))
}

export const droneOn = () => nodes !== null

export function onDroneChange(l: (on: boolean) => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}
