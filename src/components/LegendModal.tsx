import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  t: { legendTitle: string; legendText: string; legendKeys: string; close: string }
}

export default function LegendModal({ onClose, t }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.legendTitle}
    >
      <div
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#3a2f1c] bg-[#1c1610] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-[#f2e3c2]">{t.legendTitle}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] text-[#d9c9a8] transition-colors hover:bg-[#2a2115] hover:text-[#f2c14e] focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-[#c9b892]">
          {t.legendText}
          <span className="mt-2 hidden text-[#a08c64] sm:block">{t.legendKeys}</span>
        </p>
        <div className="space-y-4">
          <img src="img/legend2.jpg" alt="Раскладка пальцев L1–L3 и R1–R3 на саксофоне" className="w-full rounded-xl border border-[#3a2f1c]" />
          <img src="img/legend.jpg" alt="Дополнительные клапаны саксофона, включая Low A" className="w-full rounded-xl border border-[#3a2f1c]" />
        </div>
      </div>
    </div>
  )
}
