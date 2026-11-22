import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { LANGS, type Lang, type STRINGS } from '../lib/i18n'

export type Theme = 'auto' | 'dark' | 'light'

interface Props {
  onClose: () => void
  lang: Lang
  setLang: (l: Lang) => void
  theme: Theme
  setTheme: (t: Theme) => void
  a4: number
  setA4: (v: number) => void
  t: (typeof STRINGS)['ru']
  /** показать подсказки первого входа ещё раз */
  onReplayTour: () => void
  replayLabel: string
}

// 440 — стандарт; 442/443 — оркестры; 432/415 встречаются у любителей «старого строя»
const A4_OPTIONS = [415, 432, 438, 439, 440, 441, 442, 443, 444, 445, 446]

const CHIP = 'h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]'
const ON = 'bg-gradient-to-br from-[var(--c-f6d98a)] to-[var(--c-c8922e)] text-[var(--c-241a08)]'
const OFF = 'border border-[var(--c-3a2f1c)] text-[var(--c-c9b892)] hover:text-[var(--c-f2c14e)]'

export default function SettingsModal({ onClose, lang, setLang, theme, setTheme, a4, setA4, t, onReplayTour, replayLabel }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const themes: Array<[Theme, string]> = [
    ['auto', t.themeAuto],
    ['dark', t.themeDark],
    ['light', t.themeLight],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.settings}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--c-3a2f1c)] bg-[var(--c-1c1610)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-[var(--c-f2e3c2)]">{t.settings}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--c-4a3b22)] text-[var(--c-d9c9a8)] hover:bg-[var(--c-2a2115)] hover:text-[var(--c-f2c14e)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-xs font-semibold tracking-wider text-[var(--c-7a6845)] uppercase">{t.language}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} lang={l.id === 'uzc' ? 'uz-Cyrl' : l.id} className={`${CHIP} ${lang === l.id ? ON : OFF}`}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="mt-4 text-xs font-semibold tracking-wider text-[var(--c-7a6845)] uppercase">{t.theme}</div>
        <div className="mt-1.5 flex gap-1.5">
          {themes.map(([id, label]) => (
            <button key={id} onClick={() => setTheme(id)} aria-pressed={theme === id} className={`${CHIP} flex-1 ${theme === id ? ON : OFF}`}>
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-semibold tracking-wider text-[var(--c-7a6845)] uppercase" htmlFor="a4">
          {t.a4}
        </label>
        <select
          id="a4"
          value={a4}
          onChange={(e) => setA4(Number(e.target.value))}
          className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--c-4a3b22)] bg-[var(--c-14100a)] px-2 text-sm font-semibold text-[var(--c-e8d5ae)] focus-visible:outline-2 focus-visible:outline-[var(--c-f2c14e)]"
        >
          {A4_OPTIONS.map((v) => (
            <option key={v} value={v}>
              A = {v} {t.hz}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-a08c64)]">{t.a4Hint}</p>

        <button
          onClick={() => {
            onReplayTour()
            onClose()
          }}
          className={`${CHIP} ${OFF} mt-4 w-full`}
        >
          {replayLabel}
        </button>
      </div>
    </div>
  )
}
