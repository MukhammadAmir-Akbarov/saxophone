import { useState } from 'react'

interface Props {
  value: number
  lo: number
  hi: number
  onCommit: (v: number) => void
  className?: string
  'aria-label'?: string
}

/**
 * Числовое поле, которое ограничивает значение только по уходу из поля (или Enter).
 * Если зажимать в пределы на каждое нажатие, «150» не набрать: первая «1» сразу
 * превращается в минимум 20.
 */
export default function NumInput({ value, lo, hi, onCommit, className, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = Math.round(Number(draft))
    if (draft.trim() !== '' && Number.isFinite(v)) onCommit(Math.max(lo, Math.min(hi, v)))
    setDraft(null)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={lo}
      max={hi}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={className}
      {...rest}
    />
  )
}
