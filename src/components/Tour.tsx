import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { pick, type Lang, type STRINGS } from '../lib/i18n'
import { TOUR } from '../lib/i18n/tour'

export interface TourStep {
  /** CSS-селектор цели, например [data-tour="modes"] */
  target: string
  title: string
  text: string
}

interface Props {
  steps: TourStep[]
  onDone: () => void
  lang: Lang
  t: (typeof STRINGS)['ru']
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6 // отступ подсветки вокруг цели
const GAP = 12 // зазор между подсветкой и карточкой
const MARGIN = 8 // карточка не прилипает к краю экрана
const CARD_W = 320

/**
 * Где поставить карточку: под целью, если снизу хватает места, иначе над ней;
 * если не влезает нигде — туда, где места больше. По горизонтали — по центру
 * цели, но зажата в экран. Чистая функция, чтобы её можно было проверить.
 */
function placeCard(
  hole: Box,
  card: { width: number; height: number },
  vw: number,
  vh: number,
): { top: number; left: number; below: boolean } {
  const spaceBelow = vh - (hole.top + hole.height) - GAP
  const spaceAbove = hole.top - GAP
  const below = spaceBelow >= card.height || spaceBelow >= spaceAbove
  let top = below ? hole.top + hole.height + GAP : hole.top - GAP - card.height
  top = Math.max(MARGIN, Math.min(top, vh - card.height - MARGIN))
  let left = hole.left + hole.width / 2 - card.width / 2
  left = Math.max(MARGIN, Math.min(left, vw - card.width - MARGIN))
  return { top, left, below }
}

if (import.meta.env.DEV) {
  const c = { width: 300, height: 100 }
  // Цель вверху — карточка снизу.
  console.assert(placeCard({ top: 10, left: 10, width: 50, height: 30 }, c, 400, 800).below, 'tour: below')
  // Цель у нижнего края — карточка сверху.
  console.assert(!placeCard({ top: 740, left: 10, width: 50, height: 30 }, c, 400, 800).below, 'tour: above')
  // Цель у левого края — карточка зажата отступом.
  console.assert(placeCard({ top: 10, left: 0, width: 20, height: 20 }, c, 400, 800).left === MARGIN, 'tour: clamp')
}

// Цель есть в DOM и видна (display:none даёт нулевой прямоугольник).
function findTarget(sel: string): Element | null {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 || r.height > 0 ? el : null
}

export default function Tour({ steps, onDone, lang, t }: Props) {
  const d = pick(TOUR, lang)
  const [i, setI] = useState(0)
  const [hole, setHole] = useState<Box | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // Направление последнего шага: если цели нет, пропускаем её в ту же сторону,
  // иначе «Назад» на пропущенный шаг вернул бы нас вперёд.
  const dir = useRef<1 | -1>(1)

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const measure = useCallback(() => {
    const step = steps[i]
    const el = step && findTarget(step.target)
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
    setHole(h)
    const card = cardRef.current
    const cw = card?.offsetWidth ?? CARD_W
    const ch = card?.offsetHeight ?? 160
    setPos(placeCard(h, { width: cw, height: ch }, window.innerWidth, window.innerHeight))
  }, [steps, i])

  // Смена шага: пропускаем отсутствующие цели, прокручиваем цель в центр и меряем.
  useLayoutEffect(() => {
    if (i >= steps.length || i < 0) {
      onDone()
      return
    }
    const el = findTarget(steps[i].target)
    if (!el) {
      setI((v) => v + dir.current)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    measure()
    // Плавная прокрутка идёт несколько кадров — перемеряем, когда она осядет.
    const id = window.setTimeout(measure, reduced ? 0 : 350)
    return () => window.clearTimeout(id)
  }, [i, steps, onDone, measure, reduced])

  // Карточка получила реальный размер после первого рендера — уточняем позицию,
  // и переводим фокус на неё, чтобы клавиатура и скринридер сразу были в туре.
  useLayoutEffect(() => {
    if (!hole) return
    measure()
    cardRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, hole !== null])

  useEffect(() => {
    // scroll с capture: ловим прокрутку и вложенных контейнеров, не только окна.
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const step = steps[i]
  if (!step) return null
  const last = i === steps.length - 1
  const go = (delta: 1 | -1) => {
    dir.current = delta
    setI((v) => v + delta)
  }
  const anim = reduced ? '' : 'transition-all duration-300 ease-out'

  return (
    // Слой ловит клики, чтобы во время тура случайно не нажать что-то под ним.
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={step.title}>
      {hole && (
        // Подсветка: один div с огромной тенью — затемняет всё вокруг, а сам
        // прямоугольник остаётся «дыркой». Проще и надёжнее SVG-маски.
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-xl ring-2 ring-[var(--c-f2c14e)] ${anim}`}
          style={{ ...hole, boxShadow: '0 0 0 9999px rgba(0,0,0,.65)' }}
        />
      )}
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`absolute w-[calc(100vw-16px)] max-w-[320px] rounded-2xl border border-[var(--c-4a3b22)] bg-[var(--c-1c1610)] p-4 shadow-2xl outline-none ${anim}`}
        // Пока не измерили — прячем, чтобы карточка не мигнула в углу.
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg text-[var(--c-f2e3c2)]">{step.title}</h2>
          <button
            onClick={onDone}
            aria-label={t.close}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--c-a08c64)] hover:bg-[var(--c-2a2115)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-[var(--c-d9c9a8)]">{step.text}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-[var(--c-7a6845)]" aria-live="polite">
            {i + 1} / {steps.length}
          </span>
          <button
            onClick={onDone}
            className="mr-auto cursor-pointer px-2 py-1 text-xs text-[var(--c-a08c64)] underline-offset-2 hover:text-[var(--c-e8d5ae)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            {d.skip}
          </button>
          {i > 0 && (
            <button
              onClick={() => go(-1)}
              className="cursor-pointer rounded-lg border border-[var(--c-4a3b22)] px-3 py-1.5 text-sm text-[var(--c-e8d5ae)] hover:bg-[var(--c-2a2115)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
            >
              {d.back}
            </button>
          )}
          <button
            onClick={() => (last ? onDone() : go(1))}
            className="cursor-pointer rounded-lg bg-[var(--c-f2c14e)] px-3 py-1.5 text-sm font-semibold text-[var(--c-241a08)] hover:bg-[var(--c-f6d98a)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            {last ? d.done : d.next}
          </button>
        </div>
      </div>
    </div>
  )
}
