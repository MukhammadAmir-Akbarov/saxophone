import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import FingeringDiagram from './FingeringDiagram'
import { KEY_LABELS, NOTES, notationFile, type SaxNote } from '../data/notes'
import { altName, keyLabel, pick, type Lang, type STRINGS } from '../lib/i18n'
import { PRINT } from '../lib/i18n/print'
import { usePersisted } from '../lib/persist'
import type { Instrument } from '../lib/sound'

interface Props {
  onClose: () => void
  lang: Lang
  t: (typeof STRINGS)['ru']
  nameOf: (n: SaxNote) => string
  instrument: Instrument
}

type Reg = SaxNote['register']
const REGS: Reg[] = ['low', 'second', 'altissimo']
const COLS = [3, 4, 5]
const PREVIEW_N = 8

interface Opts {
  regs: Reg[]
  alts: boolean
  staff: boolean
  cols: number
}

// Бумага всегда белая — в обеих темах. Поэтому цвета листа здесь, в обычном CSS,
// а не в Tailwind-классах: замена тёмной палитры на светлую их не должна трогать.
// Схему FingeringDiagram править нельзя, поэтому перекрашиваем её SVG по атрибутам:
// нажатый клапан рисуется fill="url(#gold)", отпущенный — fill="#221b10".
// Цвета схемы заданы inline-стилем (ради тем), поэтому печать перебивает их !important.
// Правила схемы — не только для печати: превью в окне показывает ровно то же.
const CSS = `
.ps-paper { background:#fff; color:#000; font-family: system-ui, sans-serif; }
.ps-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; border-bottom:1.5px solid #000; padding-bottom:4px; margin-bottom:6px; }
.ps-head h1 { font-size:16pt; font-weight:700; margin:0; }
.ps-head small { font-size:8pt; color:#555; }
.ps-grid { display:grid; gap:4px; }
.ps-cell { border:1px solid #999; border-radius:4px; padding:4px; break-inside:avoid; page-break-inside:avoid; }
.ps-name { font-weight:700; font-size:11pt; text-align:center; line-height:1.2; }
.ps-sub { font-size:7.5pt; color:#444; text-align:center; }
.ps-body { display:flex; align-items:center; justify-content:center; gap:4px; }
.ps-body .print-diagram { flex:0 1 62%; min-width:0; }
.ps-body img { flex:0 1 38%; min-width:0; max-height:110px; object-fit:contain; }
.ps-alts { font-size:7pt; color:#333; line-height:1.25; margin-top:2px; }
.print-diagram svg { display:block; width:100%; height:auto; }
.print-diagram ellipse, .print-diagram rect { fill:#fff !important; stroke:#000 !important; stroke-width:2; filter:none; stroke-dasharray:none; }
.print-diagram [data-on] { fill:#000 !important; }
.print-diagram text { fill:#555 !important; }
.print-diagram text[font-weight="700"] { fill:#000 !important; }
.print-diagram line { stroke:#999 !important; }
@media screen { .print-sheet { display:none; } }
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { background:#fff !important; }
  body > *:not(.print-sheet) { display:none !important; }
  .print-sheet { display:block; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`

/** ждём картинки нотного стана: без этого в PDF попадают пустые места */
function imagesReady(root: HTMLElement | null): Promise<unknown> {
  const imgs = Array.from(root?.querySelectorAll('img') ?? [])
  const all = Promise.all(
    imgs.map((img) =>
      img.complete
        ? null
        : new Promise((r) => {
            // ошибка загрузки тоже «готово»: лучше лист без одной картинки, чем без печати
            img.addEventListener('load', r, { once: true })
            img.addEventListener('error', r, { once: true })
          }),
    ),
  )
  // битая сеть не должна навсегда блокировать печать: через 5 с печатаем как есть
  return Promise.race([all, new Promise((r) => setTimeout(r, 5000))])
}

export default function PrintChart({ onClose, lang, t, nameOf, instrument }: Props) {
  const s = pick(PRINT, lang)
  const [opts, setOpts] = usePersisted<Opts>('printOpts', { regs: ['low', 'second'], alts: true, staff: true, cols: 4 })
  const [busy, setBusy] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const notes = useMemo(() => NOTES.filter((n) => opts.regs.includes(n.register)), [opts.regs])
  const url = location.origin + location.pathname

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleReg = (r: Reg) =>
    setOpts({ ...opts, regs: opts.regs.includes(r) ? opts.regs.filter((x) => x !== r) : REGS.filter((x) => x === r || opts.regs.includes(x)) })

  const doPrint = async () => {
    setBusy(true)
    await imagesReady(sheetRef.current)
    setBusy(false)
    window.print()
  }

  const cell = (n: SaxNote) => {
    const title = n.sharp ? `${n.flat} / ${n.sharp}` : n.flat
    const own = nameOf(n)
    return (
      <div key={n.id} className="ps-cell">
        <div className="ps-name">{title}</div>
        {/* nameOf может давать сольфеджио или другую запись — показываем, если она другая */}
        {own !== n.flat && own !== n.sharp && own !== title && <div className="ps-sub">{own}</div>}
        <div className="ps-body">
          <div className="print-diagram">
            <FingeringDiagram pressed={new Set(n.keys)} bisLabel={t.bis} label={title} />
          </div>
          {opts.staff && <img src={notationFile(n.id)} alt={`${title} — ${t.onStaff}`} />}
        </div>
        {opts.alts && n.alts?.length ? (
          <div className="ps-alts">
            {s.alts}{' '}
            {n.alts.map((a) => `${altName(a.name, lang)} (${a.keys.map((k) => keyLabel(k, lang, KEY_LABELS)).join(', ')})`).join('; ')}
          </div>
        ) : null}
      </div>
    )
  }

  const head = (
    <div className="ps-head">
      <h1>
        {s.sheetTitle} · {t[instrument]}
      </h1>
      <small>{url}</small>
    </div>
  )
  const grid = (list: SaxNote[]) => (
    <div className="ps-grid" style={{ gridTemplateColumns: `repeat(${opts.cols}, minmax(0, 1fr))` }}>
      {list.map(cell)}
    </div>
  )

  const CHIP = 'h-10 min-w-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
  const CHECK = 'flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--c-e8d5ae)]'

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={s.title}
      >
        <div
          className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[var(--c-f5e8cd)]">{s.title}</h2>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label={t.close}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--c-c9b892)] hover:bg-[var(--c-241c11)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
            >
              <X size={20} />
            </button>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--c-a08c64)]">{s.registers}</legend>
            {REGS.map((r) => (
              <label key={r} className={CHECK}>
                <input type="checkbox" checked={opts.regs.includes(r)} onChange={() => toggleReg(r)} className="h-4 w-4 accent-[var(--c-d9a441)]" />
                {t[r]}
              </label>
            ))}
          </fieldset>

          <div className="mt-3 border-t border-[var(--c-2e2415)] pt-3">
            <label className={CHECK}>
              <input type="checkbox" checked={opts.alts} onChange={(e) => setOpts({ ...opts, alts: e.target.checked })} className="h-4 w-4 accent-[var(--c-d9a441)]" />
              {s.showAlts}
            </label>
            <label className={CHECK}>
              <input type="checkbox" checked={opts.staff} onChange={(e) => setOpts({ ...opts, staff: e.target.checked })} className="h-4 w-4 accent-[var(--c-d9a441)]" />
              {s.showStaff}
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--c-2e2415)] pt-3">
            <span className="mr-1 text-sm font-semibold text-[var(--c-e8d5ae)]">{s.columns}</span>
            <div role="radiogroup" aria-label={s.columns} className="flex gap-1 rounded-xl bg-[var(--c-14100a)] p-1">
              {COLS.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={opts.cols === c}
                  onClick={() => setOpts({ ...opts, cols: c })}
                  className={`${CHIP} ${opts.cols === c ? 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]' : 'text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--c-a08c64)]">{s.preview}</p>
          {/* превью: те же классы, что и у листа, только уже — видно и сетку, и цвета печати */}
          <div className="mt-1 max-h-72 overflow-hidden rounded-lg border border-[var(--c-4a3b22)]" aria-hidden="true">
            <div className="ps-paper p-2" style={{ zoom: 0.55 }}>
              {head}
              {grid(notes.slice(0, PREVIEW_N))}
            </div>
          </div>

          <p className="mt-3 text-sm text-[var(--c-c9b892)]">
            {notes.length ? `${s.count} ${notes.length}` : s.empty}
          </p>
          <p className="mt-1 text-xs text-[var(--c-7a6845)]">{s.pdfHint}</p>

          <button
            onClick={doPrint}
            disabled={!notes.length || busy}
            className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] font-bold text-[var(--c-241a08)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <Printer size={18} />
            {busy ? s.preparing : s.print}
          </button>
        </div>
      </div>

      {/* Лист — прямой ребёнок body: печатное правило прячет всех остальных детей body
          (весь #root вместе с этим окном), а лист остаётся. На экране он скрыт. */}
      {createPortal(
        <div ref={sheetRef} className="print-sheet ps-paper">
          <style>{CSS}</style>
          {head}
          {grid(notes)}
        </div>,
        document.body,
      )}
    </>
  )
}
