import { KEY_LABELS, type KeyId } from '../data/notes'

interface KeyShape {
  id: KeyId
  label: string
  lx: number // подпись
  ly: number
  anchor: 'start' | 'middle' | 'end'
  kind: 'ellipse' | 'rect'
  cx: number
  cy: number
  rx: number
  ry: number
}

// Геометрия схемы клапанов: вид спереди, упрощённо, но клапаны стоят там же, где
// на инструменте (сверено с легендой Woodwind Fingering Guide): передний F — над L1,
// бис — между L1 и L2, боковые E/C/B♭ — у правой руки, F♯ — между R2 и R3,
// мизинцы — у L3 и под R3. Прямоугольники рисуются от (cx, cy) вправо-вниз 30×26,
// подпись прямоугольника — на cy+17 (по центру клавиши).
const SHAPES: KeyShape[] = [
  // пальмовые клапаны (слева сверху); между ними зазор — нажатые не сливаются в одно пятно
  { id: 'pD', label: 'D', lx: 14, ly: 48, anchor: 'start', kind: 'ellipse', cx: 58, cy: 44, rx: 20, ry: 24 },
  { id: 'pEb', label: 'E♭', lx: 14, ly: 102, anchor: 'start', kind: 'ellipse', cx: 58, cy: 98, rx: 20, ry: 24 },
  { id: 'pF', label: 'F', lx: 14, ly: 156, anchor: 'start', kind: 'ellipse', cx: 58, cy: 152, rx: 20, ry: 24 },
  // октавный клапан (большой палец левой руки)
  { id: 'oct', label: '8ва', lx: 150, ly: 16, anchor: 'middle', kind: 'ellipse', cx: 150, cy: 44, rx: 15, ry: 15 },
  // низкое A есть только у баритона, и нажимают его БОЛЬШИМ пальцем левой руки —
  // поэтому рядом с октавным, а не в таблице мизинца
  { id: 'lowA', label: 'A', lx: 210, ly: 49, anchor: 'start', kind: 'ellipse', cx: 192, cy: 44, rx: 11, ry: 11 },
  // передний F — над L1: его нажимают, «перекатывая» указательный палец вверх
  { id: 'front', label: 'F', lx: 132, ly: 154, anchor: 'end', kind: 'ellipse', cx: 152, cy: 150, rx: 12, ry: 10 },
  // основные клапаны
  { id: 'l1', label: 'L1', lx: 118, ly: 196, anchor: 'end', kind: 'ellipse', cx: 152, cy: 190, rx: 23, ry: 23 },
  // бис — маленькая перламутровая кнопка между L1 и L2 (жмут тем же указательным)
  { id: 'bis', label: 'Бис', lx: 182, ly: 223, anchor: 'start', kind: 'ellipse', cx: 152, cy: 219, rx: 10, ry: 5 },
  { id: 'l2', label: 'L2', lx: 118, ly: 254, anchor: 'end', kind: 'ellipse', cx: 152, cy: 248, rx: 23, ry: 23 },
  { id: 'l3', label: 'L3', lx: 118, ly: 312, anchor: 'end', kind: 'ellipse', cx: 152, cy: 306, rx: 23, ry: 23 },
  { id: 'r1', label: 'R1', lx: 118, ly: 394, anchor: 'end', kind: 'ellipse', cx: 152, cy: 388, rx: 23, ry: 23 },
  { id: 'r2', label: 'R2', lx: 118, ly: 452, anchor: 'end', kind: 'ellipse', cx: 152, cy: 446, rx: 23, ry: 23 },
  { id: 'r3', label: 'R3', lx: 118, ly: 510, anchor: 'end', kind: 'ellipse', cx: 152, cy: 504, rx: 23, ry: 23 },
  // боковые клапаны — справа на корпусе, их жмут ребром правой ладони над R1
  { id: 'sE', label: 'E', lx: 336, ly: 299, anchor: 'end', kind: 'rect', cx: 240, cy: 282, rx: 0, ry: 0 },
  { id: 'sC', label: 'C', lx: 336, ly: 335, anchor: 'end', kind: 'rect', cx: 240, cy: 318, rx: 0, ry: 0 },
  { id: 'sBb', label: 'B♭', lx: 336, ly: 371, anchor: 'end', kind: 'rect', cx: 240, cy: 354, rx: 0, ry: 0 },
  // трельный F♯ — сбоку между R2 и R3, жмут безымянным
  { id: 'fsh', label: 'F♯', lx: 232, ly: 480, anchor: 'start', kind: 'ellipse', cx: 212, cy: 475, rx: 11, ry: 11 },
  // мизинец левой руки — на уровне L3, куда достаёт мизинец
  { id: 'gsh', label: 'G♯', lx: 14, ly: 307, anchor: 'start', kind: 'rect', cx: 52, cy: 290, rx: 0, ry: 0 },
  { id: 'csh', label: 'C♯', lx: 14, ly: 351, anchor: 'start', kind: 'rect', cx: 52, cy: 334, rx: 0, ry: 0 },
  { id: 'lowB', label: 'B', lx: 14, ly: 395, anchor: 'start', kind: 'rect', cx: 52, cy: 378, rx: 0, ry: 0 },
  { id: 'lowBb', label: 'B♭', lx: 14, ly: 439, anchor: 'start', kind: 'rect', cx: 52, cy: 422, rx: 0, ry: 0 },
  // мизинец правой руки — под R3
  { id: 'eb', label: 'E♭', lx: 336, ly: 503, anchor: 'end', kind: 'rect', cx: 268, cy: 486, rx: 0, ry: 0 },
  { id: 'lowC', label: 'C', lx: 336, ly: 537, anchor: 'end', kind: 'rect', cx: 268, cy: 520, rx: 0, ry: 0 },
]

const RECT_W = 30
const RECT_H = 26

interface Props {
  pressed: Set<KeyId>
  /** клик по клапану (режим тренажёра); без него схема только показывает */
  onToggle?: (k: KeyId) => void
  /** подсветка после проверки: каких клапанов не хватило и какие лишние */
  missing?: Set<KeyId>
  extra?: Set<KeyId>
  bisLabel?: string
  label?: string
  /** полные имена клапанов на языке интерфейса (для диктора); без них — русские */
  names?: Partial<Record<KeyId, string>>
}

const NONE = new Set<KeyId>()

export default function FingeringDiagram({ pressed, onToggle, missing = NONE, extra = NONE, bisLabel = 'Бис', label = 'Схема клапанов саксофона', names }: Props) {
  const interactive = !!onToggle
  return (
    <svg
      viewBox="0 0 344 548"
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      className="h-auto w-full max-w-[420px] select-none"
    >
      <defs>
        <radialGradient id="gold" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#f6d98a" />
          <stop offset="55%" stopColor="#d9a441" />
          <stop offset="100%" stopColor="#a87420" />
        </radialGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* перемычка между руками */}
      <line x1="96" y1="347" x2="212" y2="347" style={{ stroke: 'var(--c-5c4c2e)' }} strokeWidth="3" strokeLinecap="round" />

      {SHAPES.map((k) => {
        const on = pressed.has(k.id)
        const miss = missing.has(k.id)
        const bad = extra.has(k.id)
        const text = k.id === 'bis' ? bisLabel : k.label
        // для экранного диктора — полное имя: коротких «F», «C», «B♭» на схеме по два
        const name = k.id === 'bis' ? bisLabel : (names?.[k.id] ?? KEY_LABELS[k.id])
        // лишний — красный, недостающий — зелёный пунктир: видно, что исправить
        // Цвета — в style, не атрибутами: var(--c-…) (светлая тема) в SVG-атрибутах
        // работает не во всех браузерах. data-on — метка нажатого для печатной версии.
        const common = {
          strokeWidth: on || miss || bad ? 2.5 : 2,
          strokeDasharray: miss ? '5 4' : undefined,
          filter: on && !bad ? 'url(#glow)' : undefined,
          'data-on': on || undefined,
          style: {
            fill: bad ? 'var(--c-7a2418)' : on ? 'url(#gold)' : miss ? 'var(--c-16351c)' : 'var(--c-221b10)',
            stroke: bad ? 'var(--c-ff6b57)' : miss ? 'var(--c-5fd27a)' : on ? 'var(--c-f2c14e)' : 'var(--c-7a6845)',
            transition: 'fill 160ms ease-out, stroke 160ms ease-out',
          } as React.CSSProperties,
        }
        return (
          <g
            key={k.id}
            {...(interactive && {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': on,
              'aria-label': name,
              className: 'cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-[var(--c-f6d98a)]',
              onClick: () => onToggle(k.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggle(k.id)
                }
              },
            })}
          >
            {k.kind === 'ellipse' ? (
              <ellipse cx={k.cx} cy={k.cy} rx={k.rx} ry={k.ry} {...common}>
                <title>{name}</title>
              </ellipse>
            ) : (
              <rect
                x={k.cx}
                y={k.cy}
                width={RECT_W}
                height={RECT_H}
                rx={9}
                {...common}
              >
                <title>{name}</title>
              </rect>
            )}
            <text
              x={k.lx}
              y={k.ly}
              textAnchor={k.anchor}
              fontSize="13"
              fontWeight={on ? 700 : 500}
              style={{ fill: bad ? 'var(--c-ff6b57)' : miss ? 'var(--c-5fd27a)' : on ? 'var(--c-f2c14e)' : 'var(--c-8d7956)', transition: 'fill 160ms ease-out' }}
            >
              {text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
