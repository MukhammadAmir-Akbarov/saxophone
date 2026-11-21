import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, ChevronLeft, ChevronRight, CircleHelp, Download, Mic, Volume2 } from 'lucide-react'
import { KEY_LABELS, NOTES, notationFile, type KeyId, type SaxNote } from '../data/notes'
import FingeringDiagram from '../components/FingeringDiagram'
import LegendModal from '../components/LegendModal'
import Tuner from '../components/Tuner'
import { STRINGS, altName, hintText, keyLabel, type Lang } from '../lib/i18n'
import { concertMidi, midiName, playNote, stopAll, writtenMidi, type Instrument } from '../lib/sound'

const DEFAULT_INDEX = NOTES.findIndex((n) => n.id === 'a_4')
const INSTRUMENTS: Instrument[] = ['soprano', 'alto', 'tenor', 'baritone']

/** состояние, которое переживает перезагрузку (localStorage) */
function usePersisted<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('sax.' + key)
      return raw === null ? init : (JSON.parse(raw) as T)
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('sax.' + key, JSON.stringify(v))
    } catch {
      /* приватный режим Safari — просто не запоминаем */
    }
  }, [key, v])
  return [v, setV] as const
}

const sameSet = (a: Set<KeyId>, b: KeyId[]) => a.size === new Set(b).size && b.every((k) => a.has(k))

type QuizResult = null | { ok: true } | { ok: false; missing: Set<KeyId>; extra: Set<KeyId> } | { revealed: true }

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

// Базовая форма кнопки отдельно от цвета: если склеить «тёмную» и «золотую»
// раскраску в одной строке классов, Tailwind берёт не ту, что задумана, и текст пропадает.
const BTN_BASE =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#f2c14e]'
const BTN = `${BTN_BASE} border border-[#4a3b22] text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e]`
const BTN_ON = 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08]'
const BTN_PRIMARY = `${BTN_BASE} border border-transparent ${BTN_ON} hover:brightness-110`

export default function Home() {
  const [index, setIndex] = usePersisted('index', DEFAULT_INDEX)
  const [sharpMode, setSharpMode] = usePersisted('sharp', false)
  const [instrument, setInstrument] = usePersisted<Instrument>('instrument', 'alto')
  const [lang, setLang] = usePersisted<Lang>('lang', 'ru')
  const [longTone, setLongTone] = usePersisted('longTone', false)
  const [mode, setMode] = usePersisted<'table' | 'quiz'>('mode', 'table')
  const [withAltissimo, setWithAltissimo] = usePersisted('quizAltissimo', false)
  const [best, setBest] = usePersisted('quizBest', 0)

  const [variant, setVariant] = useState(0)
  const [legendOpen, setLegendOpen] = useState(false)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null)
  const railRef = useRef<HTMLDivElement>(null)

  // тренажёр
  // первый вопрос — случайная нота без альтиссимо (после перезагрузки в режиме тренажёра)
  const [quizIdx, setQuizIdx] = useState(() => {
    const easy = NOTES.flatMap((n, i) => (n.register === 'altissimo' ? [] : [i]))
    return easy[Math.floor(Math.random() * easy.length)]
  })
  const [guess, setGuess] = useState<Set<KeyId>>(new Set())
  const [result, setResult] = useState<QuizResult>(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })

  const t = STRINGS[lang]
  const safeIndex = Math.max(0, Math.min(NOTES.length - 1, index)) // старое значение из localStorage
  const note: SaxNote = NOTES[mode === 'quiz' ? quizIdx : safeIndex]
  const nameOf = useCallback((n: SaxNote) => (sharpMode && n.sharp ? n.sharp : n.flat), [sharpMode])
  const displayName = nameOf(note)
  const activeKeys = variant === 0 ? note.keys : (note.alts?.[variant - 1]?.keys ?? note.keys)
  const pressed = useMemo(() => new Set(activeKeys), [activeKeys])
  const kl = (k: KeyId) => keyLabel(k, lang, KEY_LABELS)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t.title
  }, [lang, t.title])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // покажем свою кнопку «Установить» вместо баннера браузера
      setInstallEvt(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const play = useCallback(
    (n: SaxNote = note) => playNote(n.id, n.sound, instrument, longTone),
    [note, instrument, longTone],
  )

  const select = useCallback(
    (i: number, autoplay = true) => {
      const clamped = Math.max(0, Math.min(NOTES.length - 1, i))
      setIndex(clamped)
      setVariant(0)
      if (autoplay) {
        const n = NOTES[clamped]
        playNote(n.id, n.sound, instrument, longTone)
      }
    },
    [setIndex, instrument, longTone],
  )

  // ── тренажёр ──
  const pool = useMemo(
    () => NOTES.map((n, i) => ({ n, i })).filter(({ n }) => withAltissimo || n.register !== 'altissimo').map(({ i }) => i),
    [withAltissimo],
  )
  const nextQuestion = useCallback(() => {
    stopAll()
    setQuizIdx((cur) => {
      // не повторяем ту же ноту два раза подряд
      const options = pool.filter((i) => i !== cur)
      return options[Math.floor(Math.random() * options.length)]
    })
    setGuess(new Set())
    setResult(null)
    setVariant(0)
  }, [pool])

  const toggleKey = useCallback(
    (k: KeyId) => {
      if (result && !('ok' in result && !result.ok)) return // после ответа схема заморожена
      setResult(null)
      setGuess((g) => {
        const s = new Set(g)
        if (s.has(k)) s.delete(k)
        else s.add(k)
        return s
      })
    },
    [result],
  )

  const check = useCallback(() => {
    const answers = [note.keys, ...(note.alts ?? []).map((a) => a.keys)]
    const hit = answers.findIndex((a) => sameSet(guess, a))
    if (hit >= 0) {
      setVariant(hit)
      setResult({ ok: true })
      setScore((s) => {
        const streak = s.streak + 1
        if (streak > best) setBest(streak)
        return { right: s.right + 1, total: s.total + 1, streak }
      })
      play()
      return
    }
    // подсказываем по самому близкому варианту — иначе «не хватает» может быть
    // про другую, тоже правильную аппликатуру
    const closest = answers.reduce((bestA, a) => {
      const diff = (x: KeyId[]) => x.filter((k) => !guess.has(k)).length + [...guess].filter((k) => !x.includes(k)).length
      return diff(a) < diff(bestA) ? a : bestA
    })
    setResult({
      ok: false,
      missing: new Set(closest.filter((k) => !guess.has(k))),
      extra: new Set([...guess].filter((k) => !closest.includes(k))),
    })
    setScore((s) => ({ right: s.right, total: s.total + 1, streak: 0 }))
  }, [note, guess, best, setBest, play])

  const reveal = useCallback(() => {
    if (!result || !('ok' in result)) setScore((s) => ({ right: s.right, total: s.total + 1, streak: 0 }))
    setVariant(0)
    setResult({ revealed: true })
    play()
  }, [result, play])

  const answered = !!result && (('ok' in result && result.ok) || 'revealed' in result)

  // клавиатура: стрелки — навигация, пробел — звук, Enter — проверить/дальше
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (legendOpen || tunerOpen) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'SELECT' || tag === 'INPUT') return
      if (mode === 'table' && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) {
        e.preventDefault()
        select(safeIndex + 1)
      } else if (mode === 'table' && (e.key === 'ArrowLeft' || e.key === 'ArrowDown')) {
        e.preventDefault()
        select(safeIndex - 1)
      } else if (e.key === ' ' && (e.target as HTMLElement).getAttribute('role') !== 'button') {
        e.preventDefault()
        play()
      } else if (mode === 'quiz' && e.key === 'Enter' && tag !== 'BUTTON') {
        e.preventDefault()
        if (answered) nextQuestion()
        else check()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [safeIndex, select, play, legendOpen, tunerOpen, mode, answered, nextQuestion, check])

  // прокрутка активной ноты в видимую область ленты. При первом показе — мгновенно:
  // плавная прокрутка во время загрузки страницы на телефоне обрывается на полпути.
  const railShown = useRef(false)
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: railShown.current ? 'smooth' : 'instant' })
    railShown.current = !!el
  }, [safeIndex, mode])

  // группировка ленты по регистрам
  const rail = useMemo(() => {
    const items: Array<{ type: 'sep'; reg: SaxNote['register'] } | { type: 'note'; note: SaxNote; i: number }> = []
    let lastReg = ''
    NOTES.forEach((n, i) => {
      if (n.register !== lastReg) {
        items.push({ type: 'sep', reg: n.register })
        lastReg = n.register
      }
      items.push({ type: 'note', note: n, i })
    })
    return items
  }, [])

  const concert = midiName(concertMidi(note.id, instrument), sharpMode)

  // что показывать на схеме
  let diagramPressed = pressed
  let missing: Set<KeyId> | undefined
  let extra: Set<KeyId> | undefined
  if (mode === 'quiz') {
    if (result && 'revealed' in result) diagramPressed = pressed
    else if (result && 'ok' in result && result.ok) diagramPressed = guess
    else {
      diagramPressed = guess
      if (result && 'ok' in result && !result.ok) {
        missing = result.missing
        extra = result.extra
      }
    }
  }
  const shownKeys = [...diagramPressed]

  return (
    <div className="flex min-h-dvh flex-col bg-[#14100a] text-[#f0e6d2]">
      {/* шапка */}
      <header className="border-b border-[#2e2415] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="img/icon3.png" alt="" className="h-11 w-11 shrink-0 rounded-lg border border-[#3a2f1c]" />
            <div className="min-w-0">
              <h1 className="font-display text-lg leading-tight text-[#f5e8cd] sm:text-xl">{t.title}</h1>
              <p className="truncate text-xs text-[#a08c64]">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {installEvt && (
              <button
                onClick={() => {
                  void installEvt.prompt()
                  setInstallEvt(null)
                }}
                className={BTN}
                aria-label={t.install}
              >
                <Download size={18} />
                <span className="hidden sm:inline">{t.install}</span>
              </button>
            )}
            <button onClick={() => setLang(lang === 'ru' ? 'uz' : 'ru')} aria-label={t.langToggle} className={BTN}>
              {lang === 'ru' ? 'UZ' : 'RU'}
            </button>
            <button onClick={() => setLegendOpen(true)} aria-label={t.help} className={`${BTN} px-0`}>
              <CircleHelp size={22} />
            </button>
          </div>
        </div>

        {/* панель режимов и настроек */}
        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#4a3b22] p-0.5" role="tablist">
            {(['table', 'quiz'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  stopAll()
                  setMode(m)
                  setVariant(0)
                  if (m === 'quiz' && mode !== 'quiz') nextQuestion()
                }}
                className={`h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${
                  mode === m ? BTN_ON : 'text-[#c9b892] hover:text-[#f2c14e]'
                }`}
              >
                {m === 'table' ? t.modeTable : t.modeQuiz}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="instrument">
            {t.instrument}
          </label>
          <select
            id="instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
            className="h-11 cursor-pointer rounded-xl border border-[#4a3b22] bg-[#14100a] px-2 text-sm font-semibold text-[#e8d5ae] focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {t[i]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSharpMode((v) => !v)}
            aria-pressed={sharpMode}
            aria-label={t.sharpToggle}
            className={`${BTN} text-lg`}
          >
            {sharpMode ? '♯' : '♭'}
          </button>
          <button
            onClick={() => setLongTone((v) => !v)}
            aria-pressed={longTone}
            className={longTone ? BTN_PRIMARY : BTN}
            title={t.longTone}
          >
            <AudioLines size={18} />
            <span className="hidden sm:inline">{t.longTone}</span>
          </button>
          <button onClick={() => setTunerOpen(true)} className={BTN} title={t.tuner}>
            <Mic size={18} />
            <span className="hidden sm:inline">{t.tuner}</span>
          </button>
        </div>
      </header>

      {/* основная часть */}
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_340px]">
        {/* схема клапанов */}
        <section className="order-2 flex flex-col items-center gap-3 rounded-2xl border border-[#2e2415] bg-[#1a1509] p-4 lg:order-1">
          {mode === 'table' && note.alts && note.alts.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t.variants}>
              {[t.main, ...note.alts.map((a) => altName(a.name, lang))].map((label, vi) => (
                <button
                  key={vi}
                  onClick={() => setVariant(vi)}
                  aria-pressed={variant === vi}
                  className={`h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${
                    variant === vi ? BTN_ON : 'border border-[#3a2f1c] text-[#c9b892] hover:border-[#6b5732] hover:text-[#f2c14e]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === 'quiz' && !answered && <p className="text-sm text-[#a08c64]">{t.quizTap}</p>}
          <FingeringDiagram
            pressed={diagramPressed}
            onToggle={mode === 'quiz' && !answered ? toggleKey : undefined}
            missing={missing}
            extra={extra}
            bisLabel={t.bis}
            label={t.legendTitle}
          />
          <p className="min-h-5 text-center text-sm text-[#a08c64]" aria-live="polite">
            {mode === 'quiz' && result && 'ok' in result && !result.ok ? (
              <span className="text-[#ff8a78]">
                {t.wrong}
                {result.missing.size > 0 && (
                  <>
                    {' · '}
                    <span className="text-[#5fd27a]">
                      {t.missing}: {result.missing.size}
                    </span>
                  </>
                )}
                {result.extra.size > 0 && (
                  <>
                    {' · '}
                    {t.extra}: {[...result.extra].map(kl).join(', ')}
                  </>
                )}
              </span>
            ) : mode === 'quiz' && !answered ? null : shownKeys.length > 0 ? (
              <>
                {t.pressed}: <span className="font-semibold text-[#e8d5ae]">{shownKeys.map(kl).join(' · ')}</span>
              </>
            ) : (
              t.allOpen
            )}
          </p>
        </section>

        {/* карточка ноты */}
        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-[#2e2415] bg-[#1a1509] p-4">
            {mode === 'quiz' && <div className="mb-2 text-sm text-[#a08c64]">{t.quizPrompt}</div>}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-5xl leading-none text-[#f2c14e]">{displayName}</div>
                <div className="mt-2 inline-block rounded-full border border-[#4a3b22] px-2.5 py-0.5 text-xs text-[#c9b892]">
                  {t[note.register]}
                </div>
                <div className="mt-2 text-xs text-[#a08c64]">
                  {t.written} {displayName} · {t.sounds} <span className="font-semibold text-[#e8d5ae]">{concert}</span>
                </div>
                {mode === 'table' && note.hint && variant === 0 && (
                  <div className="mt-1 text-xs text-[#a08c64]">{hintText(note, lang)}</div>
                )}
                {mode === 'table' && variant > 0 && note.alts?.[variant - 1] && (
                  <div className="mt-1 text-xs text-[#a08c64]">
                    {t.variant}: {altName(note.alts[variant - 1].name, lang)}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button
                  onClick={() => play()}
                  aria-label={`${t.listen} ${displayName}`}
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08] shadow-[0_0_18px_rgba(217,164,65,0.35)] transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#f2c14e] active:scale-95"
                >
                  <Volume2 size={26} />
                </button>
                {(!note.sound || longTone) && <span className="text-center text-[10px] leading-tight text-[#7a6845]">{t.synth}</span>}
              </div>
            </div>

            {/* нотный стан */}
            <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
              <img
                src={notationFile(note.id)}
                alt={`${t.note} ${displayName} ${t.onStaff}`}
                className="h-36 w-auto object-contain"
              />
            </div>

            {mode === 'table' ? (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => select(safeIndex - 1)}
                  disabled={safeIndex === 0}
                  aria-label={t.prev}
                  className={`${BTN} h-12 flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronLeft size={20} />
                  {safeIndex > 0 && <span>{nameOf(NOTES[safeIndex - 1])}</span>}
                </button>
                <button
                  onClick={() => select(safeIndex + 1)}
                  disabled={safeIndex === NOTES.length - 1}
                  aria-label={t.next}
                  className={`${BTN} h-12 flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {safeIndex < NOTES.length - 1 && <span>{nameOf(NOTES[safeIndex + 1])}</span>}
                  <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {result && 'ok' in result && result.ok && (
                  <div className="rounded-xl border border-[#2f6b3b] bg-[#16351c] px-3 py-2 text-center font-semibold text-[#5fd27a]" role="status">
                    ✓ {t.correct}
                    {variant > 0 && note.alts?.[variant - 1] && (
                      <span className="block text-xs font-normal">
                        {t.variant}: {altName(note.alts[variant - 1].name, lang)}
                      </span>
                    )}
                  </div>
                )}
                {result && 'revealed' in result && (
                  <div className="rounded-xl border border-[#4a3b22] px-3 py-2 text-center text-sm text-[#c9b892]" role="status">
                    {t.revealed}
                  </div>
                )}
                <div className="flex gap-2">
                  {answered ? (
                    <button onClick={nextQuestion} className={`${BTN_PRIMARY} h-12 flex-1`}>
                      {t.nextQ} <ChevronRight size={18} />
                    </button>
                  ) : (
                    <>
                      <button onClick={check} className={`${BTN_PRIMARY} h-12 flex-1`}>
                        {t.check}
                      </button>
                      <button onClick={reveal} className={`${BTN} h-12`}>
                        {t.reveal}
                      </button>
                    </>
                  )}
                </div>
                {!answered && guess.size > 0 && (
                  <button
                    onClick={() => {
                      setGuess(new Set())
                      setResult(null)
                    }}
                    className="w-full cursor-pointer text-center text-xs text-[#a08c64] underline-offset-2 hover:text-[#f2c14e] hover:underline"
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* нижняя панель: лента нот в таблице, счёт в тренажёре (лента выдала бы ответ) */}
      <footer className="sticky bottom-0 border-t border-[#2e2415] bg-[#14100a]/95 backdrop-blur-sm">
        {mode === 'table' ? (
          <div ref={railRef} className="mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6">
            {rail.map((item, k) =>
              item.type === 'sep' ? (
                <span key={`sep-${k}`} className="mx-1 shrink-0 text-[10px] font-semibold tracking-wider text-[#7a6845] uppercase">
                  {t[item.reg]}
                </span>
              ) : (
                <button
                  key={item.note.id}
                  data-active={item.i === safeIndex}
                  onClick={() => select(item.i)}
                  aria-label={`${t.note} ${nameOf(item.note)}`}
                  className={`h-11 min-w-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${
                    item.i === safeIndex
                      ? `${BTN_ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]`
                      : 'border border-[#3a2f1c] text-[#c9b892] hover:border-[#6b5732] hover:text-[#f2c14e]'
                  }`}
                >
                  {nameOf(item.note)}
                </button>
              ),
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
            <div className="flex gap-4 text-[#c9b892]">
              <span>
                {t.score}: <b className="text-[#f2c14e]">{score.right}/{score.total}</b>
              </span>
              <span>
                {t.streak}: <b className="text-[#f2c14e]">{score.streak}</b>
              </span>
              <span>
                {t.best}: <b className="text-[#f2c14e]">{best}</b>
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[#c9b892]">
              <input
                type="checkbox"
                checked={withAltissimo}
                onChange={(e) => setWithAltissimo(e.target.checked)}
                className="h-4 w-4 accent-[#d9a441]"
              />
              {t.withAltissimo}
            </label>
          </div>
        )}
      </footer>

      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} t={t} />}
      {tunerOpen && (
        <Tuner
          onClose={() => setTunerOpen(false)}
          instrument={instrument}
          sharp={sharpMode}
          targetMidi={writtenMidi(note.id)}
          targetName={displayName}
          t={t}
        />
      )}
    </div>
  )
}
