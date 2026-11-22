import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, CalendarCheck, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Download, Ear, Ellipsis, Link2, Mic, Mic2, Printer, Settings, Timer, Volume2 } from 'lucide-react'
import { KEY_LABELS, NOTES, notationFile, type KeyId, type SaxNote } from '../data/notes'
import FingeringDiagram from '../components/FingeringDiagram'
import LegendModal from '../components/LegendModal'
import MetronomeModal from '../components/MetronomeModal'
import Recorder from '../components/Recorder'
import Scales from '../components/Scales'
import Tuner, { type TunerTab } from '../components/Tuner'
import DiaryModal from '../components/DiaryModal'
import Melodies from '../components/Melodies'
import PrintChart from '../components/PrintChart'
import SelfRecord from '../components/SelfRecord'
import SettingsModal, { type Theme } from '../components/SettingsModal'
import TaskBuilder from '../components/TaskBuilder'
import TaskPanel from '../components/TaskPanel'
import Trills from '../components/Trills'
import { MELODIES } from '../data/melodies'
import { TRILLS } from '../data/trills'
import { pick } from '../lib/i18n'
import { TASK } from '../lib/i18n/task'
import { usePracticeTracker, type Activity } from '../lib/practice'
import { decodeTask, encodeTask, type Task, type TaskItem } from '../lib/task'
import { toCyrillic } from '../lib/translit'
import { getA4, setA4 as applyA4 } from '../lib/sound'
import { STRINGS, altName, hintText, keyLabel, type Lang } from '../lib/i18n'
import { onMetronomeChange, metronomeOwner, metronomeRunning } from '../lib/metronome'
import { usePersisted } from '../lib/persist'
import { loadRecordings } from '../lib/recordings'
import { concertMidi, midiName, playNote, stopAll, writtenMidi, type Instrument } from '../lib/sound'

const DEFAULT_INDEX = NOTES.findIndex((n) => n.id === 'a_4')
const INSTRUMENTS: Instrument[] = ['soprano', 'alto', 'tenor', 'baritone']

// Ссылка на ноту: ?note=c_4&inst=tenor — учитель шлёт ученику, открывается нужная нота.
// Читаем один раз при загрузке; дальше адрес сам обновляется при выборе ноты.
const URL_PARAMS = new URLSearchParams(location.search)
const URL_NOTE = NOTES.findIndex((n) => n.id === URL_PARAMS.get('note'))
const URL_INST = INSTRUMENTS.find((i) => i === URL_PARAMS.get('inst'))
// задание учителя (?task=…) — недоверенный ввод из ссылки, decodeTask его проверяет
const URL_TASK = URL_PARAMS.get('task') ? decodeTask(URL_PARAMS.get('task')!) : null

type Mode = 'table' | 'quiz' | 'scales' | 'melodies' | 'trills'
const MODES: Mode[] = ['table', 'quiz', 'scales', 'melodies', 'trills']
// полноэкранные режимы со своей разметкой — без схемы, карточки и нижней ленты
const FULL: Mode[] = ['scales', 'melodies', 'trills']

const sameSet = (a: Set<KeyId>, b: KeyId[]) => a.size === new Set(b).size && b.every((k) => a.has(k))
const keyStr = (k: KeyId[]) => [...k].sort().join()

type QuizKind = 'fingering' | 'name' | 'ear'
type QuizResult = null | { ok: true } | { ok: false; missing: Set<KeyId>; extra: Set<KeyId> } | { revealed: true }

// «Какая нота»: ноты с одинаковой основной аппликатурой (C8/D♭8/D8 — разница губами)
// по схеме не отличить — такие в вопрос не берём.
const KEY_TWINS = (() => {
  const seen = new Map<string, number>()
  NOTES.forEach((n) => seen.set(keyStr(n.keys), (seen.get(keyStr(n.keys)) ?? 0) + 1))
  return new Set(NOTES.flatMap((n, i) => ((seen.get(keyStr(n.keys)) ?? 0) > 1 ? [i] : [])))
})()

/** случайная нота с весом: на чём ошибались — попадается чаще */
function weightedPick(pool: number[], miss: Record<string, number>): number {
  const w = pool.map((i) => 1 + 2 * (miss[NOTES[i].id] ?? 0))
  let r = Math.random() * w.reduce((a, b) => a + b, 0)
  for (let k = 0; k < pool.length; k++) if ((r -= w[k]) < 0) return pool[k]
  return pool[pool.length - 1]
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** 3 неверных варианта: соседние ноты (так труднее), не совпадающие по аппликатуре */
function distractors(idx: number, pool: number[], kind: QuizKind): number[] {
  const m = writtenMidi(NOTES[idx].id)
  const shown = keyStr(NOTES[idx].keys)
  const ok = (i: number) => {
    if (i === idx) return false
    const n = NOTES[i]
    // у варианта не должно быть аппликатуры, совпадающей с показанной
    if (kind === 'name' && [n.keys, ...(n.alts ?? []).map((a) => a.keys)].some((k) => keyStr(k) === shown)) return false
    return true
  }
  const near = pool.filter((i) => ok(i) && Math.abs(writtenMidi(NOTES[i].id) - m) <= 7)
  const rest = pool.filter((i) => ok(i) && !near.includes(i))
  return [...shuffle(near), ...shuffle(rest)].slice(0, 3)
}

const poolOf = (withAltissimo: boolean) =>
  NOTES.flatMap((n, i) => (withAltissimo || n.register !== 'altissimo' ? [i] : []))

const today = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD по местному времени

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

// Базовая форма кнопки отдельно от цвета: если склеить «тёмную» и «золотую»
// раскраску в одной строке классов, Tailwind берёт не ту, что задумана, и текст пропадает.
const BTN_BASE =
  'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const BTN = `${BTN_BASE} border border-[var(--c-4a3b22)] text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)]`
const BTN_ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const BTN_PRIMARY = `${BTN_BASE} border border-transparent ${BTN_ON} hover:brightness-110`

export default function Home() {
  const [index, setIndex] = usePersisted('index', DEFAULT_INDEX)
  const [sharpMode, setSharpMode] = usePersisted('sharp', false)
  const [instrument, setInstrument] = usePersisted<Instrument>('instrument', 'alto')
  const [lang, setLang] = usePersisted<Lang>('lang', 'ru')
  const [longTone, setLongTone] = usePersisted('longTone', false)
  const [mode, setMode] = usePersisted<Mode>('mode', 'table')
  const [theme, setTheme] = usePersisted<Theme>('theme', 'auto')
  const [a4, setA4State] = useState(getA4)
  const [task, setTask] = usePersisted<Task | null>('task', null)
  const [withAltissimo, setWithAltissimo] = usePersisted('quizAltissimo', false)
  const [best, setBest] = usePersisted('quizBest', 0)
  const [quizKind, setQuizKind] = usePersisted<QuizKind>('quizKind', 'fingering')
  const [miss, setMiss] = usePersisted<Record<string, number>>('quizMiss', {})
  const [practice, setPractice] = usePersisted('practiceDays', { last: '', days: 0 })
  const [bpm, setBpm] = usePersisted('bpm', 80)
  const [beats, setBeats] = usePersisted('beats', 4)

  const [variant, setVariant] = useState(0)
  const [legendOpen, setLegendOpen] = useState(false)
  const [tunerTab, setTunerTab] = useState<TunerTab | null>(null)
  const tunerOpen = tunerTab !== null
  const [metroOpen, setMetroOpen] = useState(false)
  const [metroOn, setMetroOn] = useState(metronomeRunning)
  const [recOpen, setRecOpen] = useState(false)
  const [own, setOwn] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [selfRecOpen, setSelfRecOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtn = useRef<HTMLButtonElement>(null)
  // открытие из задания: какую мелодию/трель показать; key пересоздаёт экран с новыми настройками
  const [openMelody, setOpenMelody] = useState<string | undefined>()
  const [openTrill, setOpenTrill] = useState<string | undefined>()
  const [screenKey, setScreenKey] = useState(0)
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null)
  const railRef = useRef<HTMLDivElement>(null)

  // тренажёр
  // первый вопрос — случайная нота без альтиссимо (после перезагрузки в режиме тренажёра)
  const [quizIdx, setQuizIdx] = useState(() => {
    const easy = NOTES.flatMap((n, i) => (n.register === 'altissimo' || KEY_TWINS.has(i) ? [] : [i]))
    return easy[Math.floor(Math.random() * easy.length)]
  })
  // варианты ответа для «Какая нота» и «На слух»; выбранный вариант
  // после перезагрузки в «Какая нота»/«На слух» варианты нужны сразу, иначе вопрос без кнопок
  const [options, setOptions] = useState<number[]>(() =>
    quizKind === 'fingering' ? [] : shuffle([quizIdx, ...distractors(quizIdx, poolOf(withAltissimo), quizKind)]),
  )
  const [choice, setChoice] = useState<number | null>(null)
  // ошибку по вопросу считаем один раз: после «не совсем» ученик правит схему и пробует снова
  const penalized = useRef(false)
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
  const ts = pick(TASK, lang)
  const melodyTitle = (id: string) => {
    const m = MELODIES.find((x) => x.id === id)
    if (!m) return id
    return lang === 'uzc' ? toCyrillic(m.title.uz) : m.title[lang]
  }
  const trillTitle = (id: string) => {
    const tr = TRILLS.find((x) => x.id === id)
    const n = (nid: string) => nameOf(NOTES.find((x) => x.id === nid)!)
    return tr ? `${n(tr.from)} ⇄ ${n(tr.to)}` : id
  }
  const anyModal = settingsOpen || diaryOpen || selfRecOpen || printOpen || builderOpen
  // стабильные onClose: окна вешают на них обработчик Escape в эффекте
  const closeDiary = useCallback(() => setDiaryOpen(false), [])
  const closeSelfRec = useCallback(() => setSelfRecOpen(false), [])
  const closePrint = useCallback(() => setPrintOpen(false), [])

  // тема: «как в системе» следит за настройкой телефона и на ходу
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const light = theme === 'light' || (theme === 'auto' && mq.matches)
      document.documentElement.classList.toggle('light', light)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#faf6ee' : '#14100a')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  // задание из ссылки: сохраняем (галочки переживут перезагрузку) и раскрываем панель
  useEffect(() => {
    if (!URL_TASK) return
    // та же ссылка ещё раз (или перезагрузка) — галочки ученика сохраняем
    if (task && encodeTask(task) === encodeTask(URL_TASK)) return
    setTask(URL_TASK)
    try {
      localStorage.setItem('sax.taskCollapsed', 'false')
    } catch {
      /* приватный режим */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // дневник: что сейчас делает ученик (открытое окно важнее режима под ним)
  const activity: Activity | null = tunerTab
    ? tunerTab === 'long'
      ? 'longTone'
      : tunerTab === 'follow'
        ? 'follow'
        : 'tuner'
    : selfRecOpen
      ? 'selfRecord'
      : metroOn && metronomeOwner() === 'modal'
        ? 'metronome'
        : mode
  usePracticeTracker(activity)

  useEffect(() => {
    document.documentElement.lang = lang === 'uzc' ? 'uz-Cyrl' : lang
    document.title = t.title
  }, [lang, t.title])

  // своя запись нот (IndexedDB) — подключаем к проигрыванию при запуске
  useEffect(() => {
    void loadRecordings().then(setOwn)
  }, [])
  useEffect(() => onMetronomeChange(setMetroOn), [])

  // ссылка на ноту из адреса — важнее запомненной ноты
  useEffect(() => {
    if (URL_NOTE >= 0) {
      setIndex(URL_NOTE)
      setMode('table')
    }
    // в ссылке нет inst = альт (так её пишем), а не «строй получателя»
    if (URL_NOTE >= 0) setInstrument(URL_INST ?? 'alto')
    else if (URL_INST) setInstrument(URL_INST)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // адрес повторяет выбранную ноту — его можно скопировать и отправить
  useEffect(() => {
    const q = mode === 'table' ? `?note=${NOTES[safeIndex].id}${instrument !== 'alto' ? `&inst=${instrument}` : ''}` : ''
    history.replaceState(null, '', location.pathname + q)
  }, [mode, safeIndex, instrument])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(id)
  }, [toast])

  const share = async () => {
    const url = location.href
    if (navigator.share) {
      await navigator.share({ title: `${t.title}: ${displayName}`, url }).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setToast(t.linkCopied)
    } catch {
      setToast(url)
    }
  }

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // покажем свою кнопку «Установить» вместо баннера браузера
      setInstallEvt(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const play = useCallback(
    (n: SaxNote = note) => playNote(n.id, n.sound, instrument, { long: longTone }),
    [note, instrument, longTone],
  )

  const select = useCallback(
    (i: number, autoplay = true) => {
      const clamped = Math.max(0, Math.min(NOTES.length - 1, i))
      setIndex(clamped)
      setVariant(0)
      if (autoplay) {
        const n = NOTES[clamped]
        playNote(n.id, n.sound, instrument, { long: longTone })
      }
    },
    [setIndex, instrument, longTone],
  )

  // ── тренажёр ──
  const pool = useMemo(() => poolOf(withAltissimo), [withAltissimo])
  const nextQuestion = useCallback(
    (kind: QuizKind = quizKind) => {
      stopAll()
      // не повторяем ту же ноту два раза подряд
      const from = pool.filter((i) => i !== quizIdx && !(kind === 'name' && KEY_TWINS.has(i)))
      const idx = weightedPick(from, miss)
      setQuizIdx(idx)
      setOptions(kind === 'fingering' ? [] : shuffle([idx, ...distractors(idx, pool, kind)]))
      setChoice(null)
      penalized.current = false
      setGuess(new Set())
      setResult(null)
      setVariant(0)
      // «На слух»: нота звучит сразу (вызов идёт из нажатия — браузер разрешит звук)
      if (kind === 'ear') playNote(NOTES[idx].id, NOTES[idx].sound, instrument, { long: longTone })
    },
    [pool, quizIdx, quizKind, miss, instrument, longTone],
  )

  /** учёт ответа: счёт, серия, вес ноты для повторов, дни занятий подряд */
  const record = useCallback(
    (ok: boolean) => {
      const id = NOTES[quizIdx].id
      setMiss((m) => {
        const v = ok ? Math.max(0, (m[id] ?? 0) - 1) : Math.min(5, (m[id] ?? 0) + 2)
        const next = { ...m }
        if (v) next[id] = v
        else delete next[id]
        return next
      })
      setScore((s) => {
        const streak = ok ? s.streak + 1 : 0
        if (streak > best) setBest(streak)
        return { right: s.right + (ok ? 1 : 0), total: s.total + 1, streak }
      })
      const d = today()
      setPractice((p) => {
        if (p.last === d) return p
        const y = new Date()
        y.setDate(y.getDate() - 1)
        return { last: d, days: p.last === y.toLocaleDateString('sv') ? p.days + 1 : 1 }
      })
    },
    [quizIdx, best, setBest, setMiss, setPractice],
  )

  const choose = (i: number) => {
    if (choice !== null) return
    setChoice(i)
    record(i === quizIdx)
    play(NOTES[quizIdx])
  }

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
      if (!penalized.current) record(true)
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
    if (!penalized.current) record(false)
    penalized.current = true
  }, [note, guess, record, play])

  const reveal = useCallback(() => {
    if (!penalized.current) record(false)
    penalized.current = true
    setVariant(0)
    setResult({ revealed: true })
    play()
  }, [record, play])

  const choiceKind = mode === 'quiz' && quizKind !== 'fingering'
  const answered = choiceKind ? choice !== null : !!result && (('ok' in result && result.ok) || 'revealed' in result)
  // в «Какая нота» и «На слух» имя, нотный стан и звучание до ответа выдали бы ответ
  const hideAnswer = choiceKind && !answered
  // серия прервалась (не занимались вчера и сегодня) — не показываем старое число
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const shownDays = practice.last === today() || practice.last === yesterday.toLocaleDateString('sv') ? practice.days : 0
  const weakNotes = Object.entries(miss)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => NOTES.find((n) => n.id === id))
    .filter((n): n is SaxNote => !!n)

  // клавиатура: стрелки — навигация, пробел — звук, Enter — проверить/дальше
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (legendOpen || tunerOpen || metroOpen || recOpen || anyModal || moreOpen || FULL.includes(mode)) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'SELECT' || tag === 'INPUT') return
      if (mode === 'table' && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) {
        e.preventDefault()
        select(safeIndex + 1)
      } else if (mode === 'table' && (e.key === 'ArrowLeft' || e.key === 'ArrowDown')) {
        e.preventDefault()
        select(safeIndex - 1)
      } else if (e.key === ' ') {
        // пробел на кнопке/вкладке — нажать её, а не играть ноту
        if ((e.target as HTMLElement).closest('button,a,[role=button],[role=tab],textarea')) return
        e.preventDefault()
        // в «Какая нота» звук выдал бы ответ
        if (!(quizKind === 'name' && hideAnswer)) play()
      } else if (mode === 'quiz' && e.key === 'Enter' && tag !== 'BUTTON') {
        e.preventDefault()
        if (answered) nextQuestion()
        else if (!choiceKind) check()
      } else if (choiceKind && !answered && /^[1-4]$/.test(e.key) && options[Number(e.key) - 1] !== undefined) {
        choose(options[Number(e.key) - 1]) // 1–4 — выбрать вариант с клавиатуры
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, select, play, legendOpen, tunerOpen, metroOpen, recOpen, anyModal, moreOpen, mode, answered, nextQuestion, check, choiceKind, options, quizKind, hideAnswer])

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
  if (choiceKind) {
    // «Какая нота» показывает аппликатуру; «На слух» — только после ответа
    diagramPressed = quizKind === 'ear' && !answered ? new Set() : new Set(note.keys)
  } else if (mode === 'quiz') {
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


  /** «Открыть» в задании учителя: переключить режим с нужными настройками */
  const openTaskItem = (it: TaskItem) => {
    stopAll()
    const put = (k: string, v: unknown) => {
      try {
        localStorage.setItem('sax.' + k, JSON.stringify(v))
      } catch {
        /* приватный режим */
      }
    }
    const noteIdx = (id: string) => Math.max(0, NOTES.findIndex((n) => n.id === id))
    switch (it.k) {
      case 'scale':
        // экран гамм читает настройки из памяти при создании — кладём и пересоздаём его
        put('scaleTonic', it.tonic)
        put('scaleType', it.type)
        put('scaleOctaves', it.octaves)
        put('scalePattern', it.pattern ?? 'plain')
        setBpm(it.bpm)
        setMode('scales')
        setScreenKey((k) => k + 1)
        break
      case 'long':
        setIndex(noteIdx(it.note))
        setMode('table')
        setTunerTab('long')
        break
      case 'quiz':
        setMode('quiz')
        setQuizKind(it.kind)
        nextQuestion(it.kind)
        break
      case 'melody':
        setBpm(MELODIES.find((m) => m.id === it.id)?.bpm ?? bpm)
        setOpenMelody(it.id)
        setMode('melodies')
        setScreenKey((k) => k + 1)
        break
      case 'trill':
        setOpenTrill(it.id)
        setMode('trills')
        setScreenKey((k) => k + 1)
        break
      case 'metro':
        setBpm(it.bpm)
        setBeats(it.beats)
        setMetroOpen(true)
        break
      case 'note':
        setIndex(noteIdx(it.note))
        setMode('table')
        setVariant(0)
        break
    }
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--c-14100a)] text-[var(--c-f0e6d2)]">
      {/* шапка */}
      <header className="border-b border-[var(--c-2e2415)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="img/icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-lg border border-[var(--c-3a2f1c)]" />
            <div className="min-w-0">
              <h1 className="font-display text-lg leading-tight text-[var(--c-f5e8cd)] sm:text-xl">{t.title}</h1>
              <p className="truncate text-xs text-[var(--c-a08c64)]">{t.subtitle}</p>
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
            <button onClick={() => setSettingsOpen(true)} aria-label={t.settings} title={t.settings} className={`${BTN} px-0`}>
              <Settings size={20} />
            </button>
            <button onClick={() => setLegendOpen(true)} aria-label={t.help} className={`${BTN} px-0`}>
              <CircleHelp size={22} />
            </button>
          </div>
        </div>

        {/* панель режимов и настроек */}
        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
          <div className="flex max-w-full overflow-x-auto rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="tablist">
            {MODES.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  stopAll()
                  // ручной выбор вкладки — без «мелодии из задания», своя память экрана
                  setOpenMelody(undefined)
                  setOpenTrill(undefined)
                  setMode(m)
                  setVariant(0)
                  if (m === 'quiz' && mode !== 'quiz') nextQuestion()
                }}
                className={`h-10 shrink-0 cursor-pointer rounded-[10px] px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
                  mode === m ? BTN_ON : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'
                }`}
              >
                {{ table: t.modeTable, quiz: t.modeQuiz, scales: t.modeScales, melodies: t.modeMelodies, trills: t.modeTrills }[m]}
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
            className="h-11 cursor-pointer rounded-xl border border-[var(--c-4a3b22)] bg-[var(--c-14100a)] px-2 text-sm font-semibold text-[var(--c-e8d5ae)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
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
          <button onClick={() => setTunerTab('tuner')} className={BTN} title={t.tuner} aria-label={t.tuner}>
            <Mic size={18} />
            <span className="hidden sm:inline">{t.tuner}</span>
          </button>
          <button
            onClick={() => setMetroOpen(true)}
            className={metroOn && metronomeOwner() === 'modal' ? BTN_PRIMARY : BTN}
            title={t.metronome}
            aria-label={t.metronome}
          >
            <Timer size={18} />
            <span className="hidden sm:inline">{t.metronome}</span>
          </button>
          <button onClick={() => setSelfRecOpen(true)} className={BTN} title={t.selfRecord} aria-label={t.selfRecord}>
            <Ear size={18} />
            <span className="hidden sm:inline">{t.selfRecord}</span>
          </button>
          <button onClick={() => setDiaryOpen(true)} className={BTN} title={t.diary} aria-label={t.diary}>
            <CalendarCheck size={18} />
            <span className="hidden sm:inline">{t.diary}</span>
          </button>
          {/* редкие действия — в меню, чтобы панель не разрасталась на телефоне */}
          <div className="relative">
            <button ref={moreBtn} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} aria-haspopup="menu" className={BTN} title={t.more} aria-label={t.more}>
              <Ellipsis size={18} />
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  // Escape закрывает меню и возвращает фокус на кнопку «Ещё»
                  onKeyDown={(e) => {
                    if (e.key !== 'Escape') return
                    setMoreOpen(false)
                    moreBtn.current?.focus()
                  }}
                  ref={(el) => el?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()}
                  className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-1 shadow-2xl">
                  {(
                    [
                      [Mic2, t.recTitle, () => setRecOpen(true)],
                      [ClipboardList, ts.builderOpen, () => setBuilderOpen(true)],
                      [Printer, t.printChart, () => setPrintOpen(true)],
                    ] as const
                  ).map(([Icon, label, act]) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false)
                        act()
                      }}
                      className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[var(--c-e8d5ae)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
                    >
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {task && (
          <div className="mx-auto mt-3 max-w-5xl">
            <TaskPanel
              task={task}
              lang={lang}
              t={t}
              nameOf={nameOf}
              onToggle={(i) => setTask({ ...task, items: task.items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
              onOpen={openTaskItem}
              onClose={() => setTask(null)}
              melodyTitle={melodyTitle}
              trillTitle={trillTitle}
            />
          </div>
        )}
      </header>

      {/* основная часть */}
      {mode === 'scales' ? (
        <Scales key={screenKey} instrument={instrument} lang={lang} bpm={bpm} setBpm={setBpm} a4={a4} t={t} />
      ) : mode === 'melodies' ? (
        <Melodies key={screenKey} instrument={instrument} lang={lang} t={t} bpm={bpm} setBpm={setBpm} sharp={sharpMode} initialMelodyId={openMelody} />
      ) : mode === 'trills' ? (
        <Trills key={screenKey} instrument={instrument} lang={lang} t={t} sharp={sharpMode} initialId={openTrill} />
      ) : (
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_340px]">
        {/* схема клапанов */}
        <section className="order-2 flex flex-col items-center gap-3 rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4 lg:order-1">
          {mode === 'table' && note.alts && note.alts.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t.variants}>
              {[t.main, ...note.alts.map((a) => altName(a.name, lang))].map((label, vi) => (
                <button
                  key={vi}
                  onClick={() => setVariant(vi)}
                  aria-pressed={variant === vi}
                  className={`h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
                    variant === vi ? BTN_ON : 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] hover:border-[var(--c-6b5732)] hover:text-[var(--c-f2c14e)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === 'quiz' && !choiceKind && !answered && <p className="text-sm text-[var(--c-a08c64)]">{t.quizTap}</p>}
          <FingeringDiagram
            pressed={diagramPressed}
            onToggle={mode === 'quiz' && !choiceKind && !answered ? toggleKey : undefined}
            missing={missing}
            extra={extra}
            bisLabel={t.bis}
            label={t.legendTitle}
          />
          <p className="min-h-5 text-center text-sm text-[var(--c-a08c64)]" aria-live="polite">
            {mode === 'quiz' && result && 'ok' in result && !result.ok ? (
              <span className="text-[var(--c-ff8a78)]">
                {t.wrong}
                {result.missing.size > 0 && (
                  <>
                    {' · '}
                    <span className="text-[var(--c-5fd27a)]">
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
            ) : (mode === 'quiz' && !answered && !(choiceKind && quizKind === 'name')) ? null : shownKeys.length > 0 ? (
              <>
                {t.pressed}: <span className="font-semibold text-[var(--c-e8d5ae)]">{shownKeys.map(kl).join(' · ')}</span>
              </>
            ) : (
              t.allOpen
            )}
          </p>
        </section>

        {/* карточка ноты */}
        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-[var(--c-2e2415)] bg-[var(--c-1a1509)] p-4">
            {mode === 'quiz' && (
              <>
                <div className="mb-3 flex rounded-xl border border-[var(--c-4a3b22)] p-0.5" role="tablist" aria-label={t.modeQuiz}>
                  {(['fingering', 'name', 'ear'] as const).map((k) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={quizKind === k}
                      onClick={() => {
                        if (k === quizKind) return
                        setQuizKind(k)
                        nextQuestion(k)
                      }}
                      className={`h-9 flex-1 cursor-pointer rounded-[10px] px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] sm:text-sm ${
                        quizKind === k ? BTN_ON : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'
                      }`}
                    >
                      {k === 'fingering' ? t.kindFingering : k === 'name' ? t.kindName : t.kindEar}
                    </button>
                  ))}
                </div>
                <div className="mb-2 text-sm text-[var(--c-a08c64)]">
                  {quizKind === 'fingering' ? t.quizPrompt : quizKind === 'name' ? t.quizNamePrompt : t.quizEarPrompt}
                </div>
              </>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-5xl leading-none text-[var(--c-f2c14e)]">{hideAnswer ? '?' : displayName}</div>
                {!hideAnswer && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-block rounded-full border border-[var(--c-4a3b22)] px-2.5 py-0.5 text-xs text-[var(--c-c9b892)]">
                        {t[note.register]}
                      </span>
                      {mode === 'table' && (
                        <button
                          onClick={share}
                          aria-label={t.share}
                          title={t.share}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
                        >
                          <Link2 size={15} />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-[var(--c-a08c64)]">
                      {t.written} {displayName} · {t.sounds} <span className="font-semibold text-[var(--c-e8d5ae)]">{concert}</span>
                    </div>
                  </>
                )}
                {mode === 'table' && note.hint && variant === 0 && (
                  <div className="mt-1 text-xs text-[var(--c-a08c64)]">{hintText(note, lang)}</div>
                )}
                {mode === 'table' && variant > 0 && note.alts?.[variant - 1] && (
                  <div className="mt-1 text-xs text-[var(--c-a08c64)]">
                    {t.variant}: {altName(note.alts[variant - 1].name, lang)}
                  </div>
                )}
              </div>
              <div className={`flex shrink-0 flex-col items-center gap-1 ${quizKind === 'name' && hideAnswer ? 'invisible' : ''}`}>
                <button
                  onClick={() => play()}
                  aria-label={hideAnswer ? t.playAgain : `${t.listen} ${displayName}`}
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)] shadow-[0_0_18px_rgba(217,164,65,0.35)] transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] active:scale-95"
                >
                  <Volume2 size={26} />
                </button>
                {!hideAnswer && ((!note.sound && !own.has(note.id)) || longTone) && (
                  <span className="text-center text-[10px] leading-tight text-[var(--c-7a6845)]">{t.synth}</span>
                )}
              </div>
            </div>

            {/* нотный стан */}
            {hideAnswer ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {options.map((i, k) => (
                  <button key={i} onClick={() => choose(i)} className={`${BTN} h-14 text-lg`}>
                    <span className="text-xs text-[var(--c-7a6845)]">{k + 1}</span> {nameOf(NOTES[i])}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
                <img
                  src={notationFile(note.id)}
                  alt={`${t.note} ${displayName} ${t.onStaff}`}
                  className="h-36 w-auto object-contain"
                />
              </div>
            )}

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
                {choiceKind && choice !== null && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-center font-semibold ${
                      choice === quizIdx ? 'border-[var(--c-2f6b3b)] bg-[var(--c-16351c)] text-[var(--c-5fd27a)]' : 'border-[var(--c-6b2f2a)] bg-[var(--c-351816)] text-[var(--c-ff8a78)]'
                    }`}
                    role="status"
                  >
                    {choice === quizIdx ? `✓ ${t.correct}` : `${t.wrong}: ${nameOf(NOTES[choice])} → ${displayName}`}
                  </div>
                )}
                {!choiceKind && result && 'ok' in result && result.ok && (
                  <div className="rounded-xl border border-[var(--c-2f6b3b)] bg-[var(--c-16351c)] px-3 py-2 text-center font-semibold text-[var(--c-5fd27a)]" role="status">
                    ✓ {t.correct}
                    {variant > 0 && note.alts?.[variant - 1] && (
                      <span className="block text-xs font-normal">
                        {t.variant}: {altName(note.alts[variant - 1].name, lang)}
                      </span>
                    )}
                  </div>
                )}
                {!choiceKind && result && 'revealed' in result && (
                  <div className="rounded-xl border border-[var(--c-4a3b22)] px-3 py-2 text-center text-sm text-[var(--c-c9b892)]" role="status">
                    {t.revealed}
                  </div>
                )}
                <div className="flex gap-2">
                  {answered ? (
                    <button onClick={() => nextQuestion()} className={`${BTN_PRIMARY} h-12 flex-1`}>
                      {t.nextQ} <ChevronRight size={18} />
                    </button>
                  ) : choiceKind ? null : (
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
                {!choiceKind && !answered && guess.size > 0 && (
                  <button
                    onClick={() => {
                      setGuess(new Set())
                      setResult(null)
                    }}
                    className="w-full cursor-pointer text-center text-xs text-[var(--c-a08c64)] underline-offset-2 hover:text-[var(--c-f2c14e)] hover:underline"
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      )}

      {/* нижняя панель: лента нот в таблице, счёт в тренажёре (лента выдала бы ответ) */}
      {!FULL.includes(mode) && (
      <footer className="sticky bottom-0 border-t border-[var(--c-2e2415)] bg-[color-mix(in_srgb,var(--c-14100a)_95%,transparent)] backdrop-blur-sm">
        {mode === 'table' ? (
          <div ref={railRef} className="mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6">
            {rail.map((item, k) =>
              item.type === 'sep' ? (
                <span key={`sep-${k}`} className="mx-1 shrink-0 text-[10px] font-semibold tracking-wider text-[var(--c-7a6845)] uppercase">
                  {t[item.reg]}
                </span>
              ) : (
                <button
                  key={item.note.id}
                  data-active={item.i === safeIndex}
                  onClick={() => select(item.i)}
                  aria-label={`${t.note} ${nameOf(item.note)}`}
                  className={`h-11 min-w-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)] ${
                    item.i === safeIndex
                      ? `${BTN_ON} shadow-[0_0_12px_rgba(217,164,65,0.4)]`
                      : 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] hover:border-[var(--c-6b5732)] hover:text-[var(--c-f2c14e)]'
                  }`}
                >
                  {nameOf(item.note)}
                </button>
              ),
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
            <div className="flex gap-4 text-[var(--c-c9b892)]">
              <span>
                {t.score}: <b className="text-[var(--c-f2c14e)]">{score.right}/{score.total}</b>
              </span>
              <span>
                {t.streak}: <b className="text-[var(--c-f2c14e)]">{score.streak}</b>
              </span>
              <span>
                {t.best}: <b className="text-[var(--c-f2c14e)]">{best}</b>
              </span>
              {shownDays > 0 && (
                <span title={t.days}>
                  🔥 <b className="text-[var(--c-f2c14e)]">{shownDays}</b> {t.days}
                </span>
              )}
            </div>
            {weakNotes.length > 0 && (
              <div className="flex items-center gap-2 text-[var(--c-c9b892)]">
                {t.weak}: <b className="text-[var(--c-ff8a78)]">{weakNotes.map(nameOf).join(', ')}</b>
                <button
                  onClick={() => setMiss({})}
                  className="cursor-pointer text-xs text-[var(--c-7a6845)] underline-offset-2 hover:text-[var(--c-f2c14e)] hover:underline"
                >
                  {t.resetStats}
                </button>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-[var(--c-c9b892)]">
              <input
                type="checkbox"
                checked={withAltissimo}
                onChange={(e) => setWithAltissimo(e.target.checked)}
                className="h-4 w-4 accent-[var(--c-d9a441)]"
              />
              {t.withAltissimo}
            </label>
          </div>
        )}
      </footer>
      )}

      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} t={t} />}
      {tunerTab && (
        <Tuner
          onClose={() => setTunerTab(null)}
          instrument={instrument}
          sharp={sharpMode}
          note={mode === 'scales' || hideAnswer ? NOTES[safeIndex] : note}
          nameOf={nameOf}
          tab={tunerTab}
          onTab={setTunerTab}
          t={t}
        />
      )}
      {metroOpen && (
        <MetronomeModal onClose={() => setMetroOpen(false)} bpm={bpm} setBpm={setBpm} beats={beats} setBeats={setBeats} t={t} />
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          a4={a4}
          setA4={(v) => {
            applyA4(v)
            setA4State(v)
          }}
          t={t}
        />
      )}
      {diaryOpen && <DiaryModal onClose={closeDiary} lang={lang} t={t} nameOf={nameOf} />}
      {selfRecOpen && <SelfRecord onClose={closeSelfRec} instrument={instrument} sharp={sharpMode} lang={lang} t={t} />}
      {printOpen && <PrintChart onClose={closePrint} lang={lang} t={t} nameOf={nameOf} instrument={instrument} />}
      {builderOpen && (
        <TaskBuilder
          onClose={() => setBuilderOpen(false)}
          lang={lang}
          t={t}
          instrument={instrument}
          nameOf={nameOf}
          currentNoteId={NOTES[safeIndex].id}
          melodies={MELODIES.map((m) => ({ id: m.id, title: melodyTitle(m.id) }))}
          trills={TRILLS.map((tr) => ({ id: tr.id, title: trillTitle(tr.id) }))}
        />
      )}
      {recOpen && (
        <Recorder
          onClose={() => setRecOpen(false)}
          instrument={instrument}
          startIndex={mode === 'quiz' ? safeIndex : NOTES.indexOf(note)}
          nameOf={nameOf}
          own={own}
          onChange={setOwn}
          t={t}
        />
      )}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-xl border border-[var(--c-4a3b22)] bg-[var(--c-241c11)] px-4 py-2 text-sm text-[var(--c-e8d5ae)] shadow-xl"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
