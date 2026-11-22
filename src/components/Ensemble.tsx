// Экран «Ансамбль»: мелодия на три голоса (мелодия, второй голос, бас) для разных
// саксофонов. Ученик выбирает свою партию; его строй — общий строй приложения.
// «Играть вместе»: такт отсчёта метронома, остальные партии звучат синтезом,
// своя — подсвечивается (и по желанию тихо звучит). «Партитура» — все партии для
// всех четырёх строёв, чтобы учитель раздал их ученикам.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Minus, Music, Play, Plus, Square, Users, Volume2, VolumeX } from 'lucide-react'
import { NOTES, notationFile } from '../data/notes'
import { melodyTitle, MELODIES, type Melody } from '../data/melodies'
import FingeringDiagram from './FingeringDiagram'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { ENSEMBLE_I18N } from '../lib/i18n/ensemble'
import { buildParts, fitsInstrument, octaveShift, PART_IDS, partForInstrument, playParts, type EnsPlayback, type PartId, type WrittenNote } from '../lib/ensemble'
import { clampBpm, onMetronomeChange, startMetronome, stopMetronome } from '../lib/metronome'
import { usePersisted } from '../lib/persist'
import { keyIsSharp } from '../lib/scales'
import { audioCtx, midiName, stopAll, TRANSPOSE, type Instrument } from '../lib/sound'

type Strings = (typeof STRINGS)['ru']
type S = (typeof ENSEMBLE_I18N)['ru']

interface Props {
  instrument: Instrument
  lang: Lang
  t: Strings
  bpm: number
  setBpm: (v: number) => void
  /** общая настройка знаков; в ансамбле знаки берём по тональности строя, это — запас */
  sharp: boolean
}

const INSTRUMENTS: Instrument[] = ['soprano', 'alto', 'tenor', 'baritone']
// только мелодии с аккордами: без гармонии не из чего строить второй голос и бас
const LIST = MELODIES.filter((m) => m.chords.trim())
const SCORE_BARS = 4

type Mix = Record<PartId, { vol: number; mute: boolean }>
const MIX0: Mix = { melody: { vol: 0.9, mute: false }, second: { vol: 0.8, mute: false }, bass: { vol: 0.8, mute: false } }

const BTN =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--c-4a3b22)] px-3 text-sm font-semibold text-[var(--c-e8d5ae)] transition-colors hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] disabled:cursor-not-allowed disabled:opacity-40'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const PRIMARY = `flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${ON}`
const SEG = (on: boolean) =>
  `h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${on ? ON : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'}`

const fill = (tpl: string, ...v: string[]) => v.reduce((s, x, i) => s.replace(`{${i + 1}}`, x), tpl)
const mod12 = (v: number) => ((v % 12) + 12) % 12

/** знаки по письменной тональности строя: «Ода» в соль у альта — у тенора до, у сопрано ре (диезы) */
const sharpFor = (m: Melody, inst: Instrument) => keyIsSharp(mod12(m.key + TRANSPOSE.alto - TRANSPOSE[inst]), 'major')

const nameOf = (n: WrittenNote, sharp: boolean) => (n.index === null ? '' : sharp && NOTES[n.index].sharp ? NOTES[n.index].sharp! : NOTES[n.index].flat)

/** 1.5 → «1.5», 0.5 → «0.5»: длительность в том же виде, что в тексте мелодии */
const beatsText = (b: number) => String(+b.toFixed(2))

export default function Ensemble({ instrument, lang, t, bpm, setBpm }: Props) {
  const s = pick(ENSEMBLE_I18N, lang)
  const [savedId, setSavedId] = usePersisted<string | null>('ensembleMelody', null)
  // сохранённый id мог исчезнуть из списка (мелодию переименовали) — тогда список
  const melody = LIST.find((m) => m.id === savedId)

  if (!melody) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-[var(--c-f2c14e)]">
            <Users size={22} /> {s.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--c-a08c64)]">{s.intro}</p>
          <p className="mt-1 text-sm text-[var(--c-c9b892)]">{fill(s.yourInst, t[instrument])}</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LIST.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setSavedId(m.id)}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-[var(--c-3a2f1c)] bg-[var(--c-1a1509)] px-4 py-3 text-left transition-colors hover:border-[var(--c-6b5732)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
              >
                <Music size={18} className="shrink-0 text-[var(--c-d9a441)]" />
                <span className="font-semibold text-[var(--c-f0e6d2)]">{melodyTitle(m, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  // key — новое состояние (позиция, игра) для каждой мелодии; Room гасит звук при размонтировании
  return <Room key={melody.id} melody={melody} instrument={instrument} lang={lang} t={t} s={s} bpm={bpm} setBpm={setBpm} onBack={() => setSavedId(null)} />
}

interface RoomProps {
  melody: Melody
  instrument: Instrument
  lang: Lang
  t: Strings
  s: S
  bpm: number
  setBpm: (v: number) => void
  onBack: () => void
}

function Room({ melody, instrument, lang, t, s, bpm, setBpm, onBack }: RoomProps) {
  const parts = useMemo(() => buildParts(melody), [melody])
  const [part, setPart] = usePersisted<PartId>('ensemblePart', 'melody')
  const [withMe, setWithMe] = usePersisted('ensembleWithMe', false)
  const [mix, setMix] = usePersisted<Mix>('ensembleMix', MIX0)
  const [view, setView] = useState<'play' | 'score'>('play')
  const [playing, setPlaying] = useState(false)
  const [countIn, setCountIn] = useState(0)
  const [pos, setPos] = useState(0)
  const pb = useRef<EnsPlayback | null>(null)
  const raf = useRef(0)
  const chipsRef = useRef<HTMLDivElement>(null)

  // localStorage мог прийти от старой версии с другим id партии — не падаем
  // партия не подходит этому строю (или пришла из старой версии) — играем мелодию
  const my: PartId = PART_IDS.includes(part) && fitsInstrument(parts, part, instrument) ? part : 'melody'
  const mine = partForInstrument(parts[my], instrument)
  const shift = octaveShift(parts[my], instrument)
  const sharp = sharpFor(melody, instrument)
  const concertSharp = keyIsSharp(mod12(melody.key + TRANSPOSE.alto), 'major')
  const labels: Record<PartId, string> = { melody: s.melody, second: s.second, bass: s.bass }

  const starts: number[] = []
  for (let i = 0, acc = 0; i < mine.length; acc += mine[i].beats, i++) starts.push(acc)
  const total = starts.length ? starts[starts.length - 1] + mine[mine.length - 1].beats : 0

  const cur = mine[Math.min(pos, mine.length - 1)]
  const note = cur?.index == null ? null : NOTES[cur.index]
  const pressed = useMemo(() => new Set(note?.keys ?? []), [note])
  // реальный звук, который берёт ученик (с учётом октавного сдвига его партии)
  const sounding = note ? parts[my][pos].concert! + shift : null

  // своя партия тише: она — подсказка, а играть её должен ученик
  const gainOf = (id: PartId, m: Mix) => (m[id].mute ? 0 : m[id].vol * (id === my ? 0.5 : 1))

  const stopPlay = () => {
    cancelAnimationFrame(raf.current)
    const was = pb.current
    pb.current = null
    was?.stop()
    // метроном глушим, только если играли мы: чужой из окна «Метроном» не трогаем
    if (was) stopMetronome()
    setPlaying(false)
    setCountIn(0)
  }
  // ref на свежий stopPlay: подписка и размонтирование живут дольше одного рендера
  const stopRef = useRef(stopPlay)
  useEffect(() => {
    stopRef.current = stopPlay
  })
  // метроном остановили со стороны (окно «Метроном») — останавливаемся и мы
  useEffect(() => onMetronomeChange((r) => !r && pb.current && stopRef.current()), [])
  useEffect(() => () => stopRef.current(), [])

  useEffect(() => {
    chipsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pos])

  const start = () => {
    // сначала чужой метроном и звук нот: их «стоп» не должен прийти после нашего старта
    stopMetronome()
    stopAll()
    const ac = audioCtx()
    const beat = 60 / bpm
    // метроном ставит первый щелчок на currentTime + 0.08 — считаем от тех же часов
    // ponytail: metronome.ts не отдаёт своё время старта; расхождение — доли миллисекунды
    const begin = ac.currentTime + 0.08 + melody.meter * beat
    // stopAfter: в фоновой вкладке rAF спит и конец пьесы по нему не заметить —
    // метроном сам замолкает, когда пьеса кончилась
    startMetronome({ bpm, beats: melody.meter, owner: 'ensemble', stopAfter: begin - ac.currentTime + total * beat + 0.1 })
    const play = Object.fromEntries(PART_IDS.filter((id) => id !== my || withMe).map((id) => [id, parts[id]]))
    pb.current = playParts(play, bpm, begin, { melody: gainOf('melody', mix), second: gainOf('second', mix), bass: gainOf('bass', mix) }, { [my]: shift })
    setPlaying(true)
    setPos(0)
    // подсветка по часам аудио, а не по таймерам: дробные доли (восьмые, пунктир) не плывут
    const tick = () => {
      const el = (ac.currentTime - begin) / beat
      if (el >= total) return stopRef.current()
      if (el < 0) setCountIn(Math.ceil(-el))
      else {
        setCountIn(0)
        let k = 0
        while (k + 1 < starts.length && starts[k + 1] <= el) k++
        setPos(k)
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const setPartMix = (id: PartId, p: Partial<Mix[PartId]>) => {
    const next = { ...mix, [id]: { ...mix[id], ...p } }
    setMix(next)
    // микшер работает и на ходу: громкость меняется у уже запланированных нот
    pb.current?.setGain(id, gainOf(id, next))
  }

  const big = countIn > 0 ? String(countIn) : note ? nameOf(cur, sharp) : s.rest

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} aria-label={s.back} className={BTN}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-display text-2xl text-[var(--c-f2c14e)]">{melodyTitle(melody, lang)}</h2>
        <span className="ml-auto text-sm text-[var(--c-c9b892)]">{fill(s.yourInst, t[instrument])}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="group">
          {(['play', 'score'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={SEG(view === v)}>
              {v === 'play' ? s.viewPlay : s.viewScore}
            </button>
          ))}
        </div>
        {view === 'play' && (
          <div className="flex flex-wrap rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="group" aria-label={s.yourPart}>
            {PART_IDS.map((id) => (
              <button
                key={id}
                onClick={() => {
                  stopPlay()
                  setPos(0)
                  setPart(id)
                }}
                aria-pressed={my === id}
                disabled={!fitsInstrument(parts, id, instrument)}
                title={fitsInstrument(parts, id, instrument) ? undefined : s.notForInst}
                className={`${SEG(my === id)} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {labels[id]}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setBpm(clampBpm(bpm - 4))} aria-label={`${t.bpm} −`} className={`${BTN} px-0`} disabled={playing}>
            <Minus size={16} />
          </button>
          <span className="w-16 text-center text-sm font-semibold text-[var(--c-e8d5ae)]">
            {bpm} <span className="text-xs font-normal text-[var(--c-a08c64)]">{t.bpm}</span>
          </span>
          <button onClick={() => setBpm(clampBpm(bpm + 4))} aria-label={`${t.bpm} +`} className={`${BTN} px-0`} disabled={playing}>
            <Plus size={16} />
          </button>
        </div>
        <span className="text-sm text-[var(--c-a08c64)]">
          {s.meter} {melody.meter}/4
        </span>
      </div>

      {view === 'score' ? (
        <Score melody={melody} parts={parts} instrument={instrument} t={t} s={s} labels={labels} />
      ) : (
        <>
          {shift !== 0 && <p className="text-xs text-[var(--c-a08c64)]">{shift > 0 ? s.octUp : s.octDown}</p>}

          {/* лента нот своей партии */}
          <div ref={chipsRef} className="flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label={s.notes}>
            {mine.map((n, k) => (
              <div key={k} role="listitem" className="shrink-0">
                <button
                  data-active={k === pos}
                  disabled={playing}
                  onClick={() => setPos(k)}
                  aria-label={`${n.index === null ? s.rest : nameOf(n, sharp)}, ${beatsText(n.beats)} ${s.beats}`}
                  className={`flex h-12 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg px-2 leading-tight transition-all disabled:cursor-default ${
                    k === pos ? `${ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]` : 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] enabled:hover:border-[var(--c-6b5732)] enabled:hover:text-[var(--c-f2c14e)]'
                  }`}
                >
                  <span className="text-sm font-semibold">{n.index === null ? '𝄽' : nameOf(n, sharp)}</span>
                  <span className={`text-[10px] ${k === pos ? 'text-[var(--c-241a08)]' : 'text-[var(--c-7a6845)]'}`}>{beatsText(n.beats)}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
            <section className="order-2 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-1">
              {note ? <FingeringDiagram pressed={pressed} bisLabel={t.bis} label={t.legendTitle} /> : <span className="font-display text-6xl text-[var(--c-5c4c2e)]">𝄽</span>}
            </section>

            <section className="order-1 space-y-4 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-2">
              <div>
                <div className="text-sm text-[var(--c-a08c64)]">{countIn > 0 ? s.countIn : `${labels[my]} · ${pos + 1}/${mine.length}`}</div>
                <div className="mt-1 font-display text-5xl leading-none text-[var(--c-f2c14e)]" aria-live="polite">
                  {big}
                </div>
              </div>
              {sounding !== null && (
                <p className="text-xs leading-relaxed text-[var(--c-c9b892)]">
                  {fill(s.sounds, midiName(sounding, concertSharp))}{' '}
                  {INSTRUMENTS.map((i) => `${t[i]} — ${midiName(sounding - TRANSPOSE[i], sharpFor(melody, i))}`).join(' · ')}
                </p>
              )}
              {note && (
                <div className="flex justify-center rounded-xl bg-white p-3">
                  <img src={notationFile(note.id)} alt={`${t.note} ${nameOf(cur, sharp)} ${t.onStaff}`} className="h-32 w-auto object-contain" />
                </div>
              )}

              <div className="flex">
                <button onClick={() => (playing ? stopPlay() : start())} className={PRIMARY}>
                  {playing ? <Square size={18} /> : <Play size={18} />}
                  {playing ? t.stop : s.play}
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--c-c9b892)]">
                <input type="checkbox" checked={withMe} onChange={(e) => setWithMe(e.target.checked)} disabled={playing} className="h-4 w-4 accent-[var(--c-d9a441)]" />
                {s.withMe}
              </label>
              <p className="text-xs text-[var(--c-a08c64)]">{s.withMeHint}</p>

              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold text-[var(--c-e8d5ae)]">{s.mixer}</legend>
                {PART_IDS.map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <button
                      onClick={() => setPartMix(id, { mute: !mix[id].mute })}
                      aria-pressed={mix[id].mute}
                      aria-label={`${mix[id].mute ? s.unmute : s.mute}: ${labels[id]}`}
                      className={`${BTN} h-9 min-w-9 px-0`}
                    >
                      {mix[id].mute ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className={`w-20 text-sm ${id === my ? 'font-semibold text-[var(--c-f2c14e)]' : 'text-[var(--c-c9b892)]'}`}>{labels[id]}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={mix[id].vol}
                      onChange={(e) => setPartMix(id, { vol: Number(e.target.value) })}
                      aria-label={`${s.volume}: ${labels[id]}`}
                      className="flex-1 accent-[var(--c-d9a441)]"
                    />
                  </div>
                ))}
              </fieldset>
            </section>
          </div>
        </>
      )}
    </main>
  )
}

interface ScoreProps {
  melody: Melody
  parts: ReturnType<typeof buildParts>
  instrument: Instrument
  t: Strings
  s: S
  labels: Record<PartId, string>
}

/** «Партитура»: первые такты каждой партии для каждого строя — текстом, как в «Своей мелодии» */
function Score({ melody, parts, instrument, t, s, labels }: ScoreProps) {
  const limit = SCORE_BARS * melody.meter
  const line = (notes: WrittenNote[], sharp: boolean) => {
    const out: string[] = []
    let acc = 0
    for (const n of notes) {
      if (acc >= limit) break
      // черта такта — как в тексте мелодий, чтобы ученику было где сверяться
      if (acc > 0 && acc % melody.meter === 0) out.push('|')
      const name = n.index === null ? 'r' : nameOf(n, sharp)
      out.push(n.beats === 1 ? name : `${name}:${beatsText(n.beats)}`)
      acc += n.beats
    }
    return out.join(' ')
  }
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4">
      <p className="text-sm text-[var(--c-a08c64)]">{fill(s.scoreIntro, String(SCORE_BARS))}</p>
      {PART_IDS.map((id) => (
        <div key={id} className="overflow-x-auto">
          <h3 className="mb-1 font-semibold text-[var(--c-f2c14e)]">{labels[id]}</h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {INSTRUMENTS.map((i) => {
                const sh = octaveShift(parts[id], i)
                return (
                  <tr key={i} className={`border-t border-[var(--c-2e2415)] ${i === instrument ? 'text-[var(--c-f2c14e)]' : 'text-[var(--c-e8d5ae)]'}`}>
                    <th scope="row" className="whitespace-nowrap py-1.5 pr-3 font-semibold">
                      {t[i]}
                      {sh !== 0 && <span className="ml-1 text-xs font-normal text-[var(--c-a08c64)]">{(Math.abs(sh) > 12 ? '15m' : '8v') + (sh > 0 ? 'a' : 'b')}</span>}
                    </th>
                    <td className="whitespace-nowrap py-1.5 font-mono text-xs">
                      {fitsInstrument(parts, id, i) ? line(partForInstrument(parts[id], i), sharpFor(melody, i)) : <span className="font-sans text-[var(--c-7a6845)]">{s.notForInst}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}
