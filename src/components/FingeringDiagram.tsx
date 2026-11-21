import type { KeyId } from '../data/notes'

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

// Геометрия схемы клапанов (вид саксофона спереди, упрощённо)
const SHAPES: KeyShape[] = [
  // пальмовые клапаны (слева сверху)
  { id: 'pD', label: 'D', lx: 14, ly: 48, anchor: 'start', kind: 'ellipse', cx: 58, cy: 44, rx: 20, ry: 27 },
  { id: 'pEb', label: 'E♭', lx: 14, ly: 102, anchor: 'start', kind: 'ellipse', cx: 58, cy: 98, rx: 20, ry: 27 },
  { id: 'pF', label: 'F', lx: 14, ly: 156, anchor: 'start', kind: 'ellipse', cx: 58, cy: 152, rx: 20, ry: 27 },
  // октавный клапан
  { id: 'oct', label: '8ва', lx: 150, ly: 16, anchor: 'middle', kind: 'ellipse', cx: 150, cy: 44, rx: 15, ry: 15 },
  // боковые клапаны правой руки (справа сверху)
  { id: 'sE', label: 'E', lx: 336, ly: 40, anchor: 'end', kind: 'rect', cx: 282, cy: 18, rx: 0, ry: 0 },
  { id: 'sC', label: 'C', lx: 336, ly: 84, anchor: 'end', kind: 'rect', cx: 282, cy: 62, rx: 0, ry: 0 },
  { id: 'sBb', label: 'B♭', lx: 336, ly: 128, anchor: 'end', kind: 'rect', cx: 282, cy: 106, rx: 0, ry: 0 },
  // передний F и бис
  { id: 'front', label: 'F', lx: 78, ly: 200, anchor: 'end', kind: 'ellipse', cx: 100, cy: 196, rx: 12, ry: 18 },
  { id: 'bis', label: 'Бис', lx: 228, ly: 232, anchor: 'start', kind: 'ellipse', cx: 204, cy: 228, rx: 11, ry: 17 },
  // основные клапаны
  { id: 'l1', label: 'L1', lx: 118, ly: 196, anchor: 'end', kind: 'ellipse', cx: 152, cy: 190, rx: 23, ry: 23 },
  { id: 'l2', label: 'L2', lx: 118, ly: 254, anchor: 'end', kind: 'ellipse', cx: 152, cy: 248, rx: 23, ry: 23 },
  { id: 'l3', label: 'L3', lx: 118, ly: 312, anchor: 'end', kind: 'ellipse', cx: 152, cy: 306, rx: 23, ry: 23 },
  { id: 'r1', label: 'R1', lx: 118, ly: 394, anchor: 'end', kind: 'ellipse', cx: 152, cy: 388, rx: 23, ry: 23 },
  { id: 'r2', label: 'R2', lx: 118, ly: 452, anchor: 'end', kind: 'ellipse', cx: 152, cy: 446, rx: 23, ry: 23 },
  { id: 'r3', label: 'R3', lx: 118, ly: 510, anchor: 'end', kind: 'ellipse', cx: 152, cy: 504, rx: 23, ry: 23 },
  // клапан F♯
  { id: 'fsh', label: 'F♯', lx: 240, ly: 422, anchor: 'start', kind: 'ellipse', cx: 216, cy: 417, rx: 11, ry: 11 },
  // мизинец левой руки (слева снизу)
  { id: 'gsh', label: 'G♯', lx: 14, ly: 246, anchor: 'start', kind: 'rect', cx: 52, cy: 220, rx: 0, ry: 0 },
  { id: 'csh', label: 'C♯', lx: 14, ly: 290, anchor: 'start', kind: 'rect', cx: 52, cy: 264, rx: 0, ry: 0 },
  { id: 'lowB', label: 'B', lx: 14, ly: 334, anchor: 'start', kind: 'rect', cx: 52, cy: 308, rx: 0, ry: 0 },
  { id: 'lowBb', label: 'B♭', lx: 14, ly: 378, anchor: 'start', kind: 'rect', cx: 52, cy: 352, rx: 0, ry: 0 },
  { id: 'lowA', label: 'A', lx: 14, ly: 422, anchor: 'start', kind: 'rect', cx: 52, cy: 396, rx: 0, ry: 0 },
  // мизинец правой руки (справа снизу)
  { id: 'eb', label: 'E♭', lx: 336, ly: 434, anchor: 'end', kind: 'rect', cx: 268, cy: 408, rx: 0, ry: 0 },
  { id: 'lowC', label: 'C', lx: 336, ly: 478, anchor: 'end', kind: 'rect', cx: 268, cy: 452, rx: 0, ry: 0 },
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
}

const NONE = new Set<KeyId>()

export default function FingeringDiagram({ pressed, onToggle, missing = NONE, extra = NONE, bisLabel = 'Бис', label = 'Схема клапанов саксофона' }: Props) {
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
      <line x1="96" y1="347" x2="212" y2="347" stroke="#5c4c2e" strokeWidth="3" strokeLinecap="round" />

      {SHAPES.map((k) => {
        const on = pressed.has(k.id)
        const miss = missing.has(k.id)
        const bad = extra.has(k.id)
        const text = k.id === 'bis' ? bisLabel : k.label
        // лишний — красный, недостающий — зелёный пунктир: видно, что исправить
        const common = {
          fill: bad ? '#7a2418' : on ? 'url(#gold)' : miss ? '#16351c' : '#221b10',
          stroke: bad ? '#ff6b57' : miss ? '#5fd27a' : on ? '#f2c14e' : '#7a6845',
          strokeWidth: on || miss || bad ? 2.5 : 2,
          strokeDasharray: miss ? '5 4' : undefined,
          filter: on && !bad ? 'url(#glow)' : undefined,
          style: { transition: 'fill 160ms ease-out, stroke 160ms ease-out' } as React.CSSProperties,
        }
        return (
          <g
            key={k.id}
            {...(interactive && {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': on,
              'aria-label': text,
              className: 'cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-[#f6d98a]',
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
                <title>{text}</title>
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
                <title>{text}</title>
              </rect>
            )}
            <text
              x={k.lx}
              y={k.ly}
              textAnchor={k.anchor}
              fontSize="13"
              fontWeight={on ? 700 : 500}
              fill={bad ? '#ff6b57' : miss ? '#5fd27a' : on ? '#f2c14e' : '#8d7956'}
              style={{ transition: 'fill 160ms ease-out' }}
            >
              {text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
