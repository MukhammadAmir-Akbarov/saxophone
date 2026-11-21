import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Circle, Download, Play, Share2, Square, Trash2, X } from 'lucide-react'
import { NOTES, type SaxNote } from '../data/notes'
import { deleteRecording, exportZip, processTake, saveRecording } from '../lib/recordings'
import { playNote, type Instrument } from '../lib/sound'
import type { STRINGS } from '../lib/i18n'

interface Props {
  onClose: () => void
  instrument: Instrument
  startIndex: number
  nameOf: (n: SaxNote) => string
  own: Set<string>
  onChange: (own: Set<string>) => void
  t: (typeof STRINGS)['ru']
}

// Дольше 4 секунд нота в приложении не нужна, а файл растёт.
const MAX_MS = 4000

export default function Recorder({ onClose, instrument, startIndex, nameOf, own, onChange, t }: Props) {
  const [idx, setIdx] = useState(startIndex)
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  // окно закрыли во время записи — дубль выбрасываем, а не сохраняем поверх старого
  const cancelled = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const note = NOTES[idx]
  const has = own.has(note.id)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      cancelled.current = true
      if (rec.current?.state === 'recording') rec.current.stop()
    }
  }, [onClose])

  const record = async () => {
    setMsg(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      setMsg(t.micDenied)
      return
    }
    const chunks: Blob[] = []
    let mr: MediaRecorder
    try {
      mr = new MediaRecorder(stream)
    } catch {
      // нет MediaRecorder (старый Safari, встроенные браузеры) — не держим микрофон открытым
      stream.getTracks().forEach((tr) => tr.stop())
      setMsg(t.recUnsupported)
      return
    }
    rec.current = mr
    const id = note.id
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop())
      clearInterval(timer)
      if (cancelled.current) return
      setState('busy')
      const wav = await processTake(new Blob(chunks, { type: mr.mimeType }))
      if (!wav) {
        setState('idle')
        setMsg(t.recSilent)
        return
      }
      try {
        await saveRecording(id, wav, instrument)
      } catch {
        setState('idle')
        setMsg(t.recSaveFailed)
        return
      }
      const next = new Set(own).add(id)
      onChange(next)
      setState('idle')
      setMsg(t.recSaved)
      playNote(id, true, instrument)
      // сразу к следующей незаписанной ноте — записывать подряд удобнее
      const after = NOTES.findIndex((n, i) => i > idx && !next.has(n.id))
      if (after >= 0) setTimeout(() => setIdx(after), 900)
    }
    const t0 = performance.now()
    const timer = setInterval(() => {
      const ms = MAX_MS - (performance.now() - t0)
      setLeft(Math.max(0, Math.ceil(ms / 1000)))
      if (ms <= 0 && mr.state === 'recording') mr.stop()
    }, 100)
    setLeft(MAX_MS / 1000)
    setState('rec')
    try {
      mr.start()
    } catch {
      clearInterval(timer)
      stream.getTracks().forEach((tr) => tr.stop())
      setState('idle')
      setMsg(t.recUnsupported)
    }
  }

  const remove = async () => {
    await deleteRecording(note.id).catch(() => {})
    const next = new Set(own)
    next.delete(note.id)
    onChange(next)
    setMsg(null)
  }

  const exportAll = async (share: boolean) => {
    const blob = await exportZip()
    if (!blob) return
    const file = new File([blob], 'saxophone-recordings.zip', { type: 'application/zip' })
    // на телефоне удобнее сразу «Поделиться» в Telegram, чем искать файл в загрузках
    if (share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t.recTitle })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // человек сам закрыл меню
        // Safari отказал (долго собирали архив, «жест» истёк) — просто скачиваем
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  const canShareFiles = typeof navigator.canShare === 'function'
  const nav =
    'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-[#4a3b22] text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-40'
  const small =
    'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#4a3b22] px-3 text-sm font-semibold text-[#e8d5ae] hover:bg-[#241c11] hover:text-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => state === 'idle' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t.recTitle}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3a2f1c] bg-[#1c1610] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-[#f2e3c2]">{t.recTitle}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.close}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#4a3b22] text-[#d9c9a8] hover:bg-[#2a2115] hover:text-[#f2c14e]"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-[#a08c64]">
          {t.recHint} {t[instrument]}.
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={() => setIdx(idx - 1)} disabled={idx === 0 || state !== 'idle'} aria-label={t.prev} className={nav}>
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <div className="font-display text-5xl leading-none text-[#f2c14e]">{nameOf(note)}</div>
            <div className="mt-1 text-xs text-[#a08c64]">{has ? `✓ ${t.recHave}` : note.sound ? t.recBuiltin : t.synth}</div>
          </div>
          <button onClick={() => setIdx(idx + 1)} disabled={idx === NOTES.length - 1 || state !== 'idle'} aria-label={t.next} className={nav}>
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          onClick={() => (state === 'rec' ? rec.current?.stop() : record())}
          disabled={state === 'busy'}
          className={`mt-4 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors disabled:opacity-50 ${
            state === 'rec' ? 'bg-[#b8322a] text-white' : 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08] hover:brightness-110'
          }`}
        >
          {state === 'rec' ? (
            <>
              <Square size={18} /> {t.stop} · {left}
            </>
          ) : (
            <>
              <Circle size={18} className="fill-current text-[#b8322a]" /> {has ? t.recAgain : t.recStart}
            </>
          )}
        </button>
        <p className="mt-2 min-h-5 text-center text-sm text-[#c9b892]" role="status">
          {state === 'busy' ? t.recBusy : msg}
        </p>

        {has && (
          <div className="mt-1 flex justify-center gap-2">
            <button onClick={() => playNote(note.id, true, instrument)} className={small}>
              <Play size={16} /> {t.listen}
            </button>
            <button onClick={remove} className={small}>
              <Trash2 size={16} /> {t.recDelete}
            </button>
          </div>
        )}

        {/* все ноты: зелёные — уже записаны */}
        <div className="mt-4 flex flex-wrap gap-1" aria-label={t.recProgress}>
          {NOTES.map((n, i) => (
            <button
              key={n.id}
              onClick={() => state === 'idle' && setIdx(i)}
              aria-label={`${nameOf(n)}${own.has(n.id) ? ' ✓' : ''}`}
              aria-current={i === idx}
              className={`h-8 min-w-9 cursor-pointer rounded-md px-1 text-[11px] font-semibold ${
                i === idx
                  ? 'bg-gradient-to-br from-[#f6d98a] to-[#c8922e] text-[#241a08]'
                  : own.has(n.id)
                    ? 'border border-[#2f6b3b] bg-[#16351c] text-[#5fd27a]'
                    : 'border border-[#3a2f1c] text-[#8f7c57]'
              }`}
            >
              {nameOf(n)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#2e2415] pt-4">
          <span className="text-sm text-[#c9b892]">
            {t.recProgress}: <b className="text-[#f2c14e]">{own.size}/{NOTES.length}</b>
          </span>
          <div className="flex gap-2">
            {canShareFiles && (
              <button onClick={() => exportAll(true)} disabled={!own.size} className={small} aria-label={t.recShare}>
                <Share2 size={16} />
              </button>
            )}
            <button onClick={() => exportAll(false)} disabled={!own.size} className={small}>
              <Download size={16} /> {t.recExport}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#7a6845]">{t.recExportHint}</p>
      </div>
    </div>
  )
}
