// Свои записи нот: запись с микрофона → обрезка тишины → WAV → IndexedDB.
// Записи сразу звучат в приложении (sound.ts берёт их раньше встроенных),
// а архивом их можно выгрузить и положить в сайт навсегда
// (scripts/import-recordings.mjs переводит WAV в mp3).

import { setOwnRecording, type Instrument } from './sound'

interface Rec {
  id: string
  blob: Blob
  instrument: Instrument
  at: number
}

const DB = 'sax-recordings'
const STORE = 'rec'

// одно соединение на всё время работы — не открываем новое на каждую запись
let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => {
      dbp = null
      rej(r.error)
    }
  })
  return dbp
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    // успех — только когда транзакция записана: нехватка места приходит как abort
    // уже после успешного put, и «Сохранено» было бы враньём
    t.oncomplete = () => res(req.result)
    t.onabort = t.onerror = () => rej(t.error ?? req.error)
  })
}

export const listRecordings = () => tx<Rec[]>('readonly', (s) => s.getAll() as IDBRequest<Rec[]>)

export async function saveRecording(id: string, blob: Blob, instrument: Instrument) {
  await tx('readwrite', (s) => s.put({ id, blob, instrument, at: Date.now() } satisfies Rec))
  setOwnRecording(id, blob, instrument)
}

export async function deleteRecording(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  setOwnRecording(id, null)
}

/** при запуске: подключить сохранённые записи к проигрыванию; вернуть их id */
export async function loadRecordings(): Promise<Set<string>> {
  try {
    const all = await listRecordings()
    all.forEach((r) => setOwnRecording(r.id, r.blob, r.instrument))
    return new Set(all.map((r) => r.id))
  } catch {
    return new Set() // приватный режим / нет IndexedDB — просто без своих записей
  }
}

// ── обработка записи ─────────────────────────────────────────────────────

/**
 * Обрезать тишину до и после звука, выровнять громкость, свести в моно.
 * Без обрезки при нажатии на ноту будет слышна пауза, пока человек брал инструмент.
 */
export async function processTake(raw: Blob): Promise<Blob | null> {
  const ac = new AudioContext()
  try {
    const buf = await ac.decodeAudioData(await raw.arrayBuffer())
    const n = buf.length
    const mono = new Float32Array(n)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels
    }
    let peak = 0
    for (const v of mono) peak = Math.max(peak, Math.abs(v))
    if (peak < 0.02) return null // тишина — микрофон не услышал инструмент

    const sr = buf.sampleRate
    const thr = peak * 0.08
    let a = 0
    while (a < n && Math.abs(mono[a]) < thr) a++
    let b = n - 1
    while (b > a && Math.abs(mono[b]) < thr) b--
    a = Math.max(0, a - Math.round(sr * 0.01)) // 10 мс до атаки — не срезать её начало
    b = Math.min(n - 1, b + Math.round(sr * 0.05))
    const out = mono.slice(a, b + 1)
    const gain = 0.9 / peak
    const fade = Math.min(out.length >> 2, Math.round(sr * 0.08))
    for (let i = 0; i < out.length; i++) {
      let g = gain
      if (i < 32) g *= i / 32 // без щелчка в начале
      const fromEnd = out.length - 1 - i
      if (fromEnd < fade) g *= fromEnd / fade
      out[i] *= g
    }
    return wav(out, sr)
  } catch {
    return null
  } finally {
    void ac.close()
  }
}

function wav(samples: Float32Array, sr: number): Blob {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const str = (o: number, s: string) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  data.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true) // PCM
  data.setUint16(22, 1, true) // моно
  data.setUint32(24, sr, true)
  data.setUint32(28, sr * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  str(36, 'data')
  data.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Blob([data], { type: 'audio/wav' })
}

// ── архив ────────────────────────────────────────────────────────────────

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * ZIP без сжатия (WAV и так не жмётся заметно). Своя упаковка — 40 строк
 * вместо библиотеки: в проекте её нет, а формат «store» простой.
 */
export async function zip(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const body = new Uint8Array(await f.blob.arrayBuffer())
    const name = new TextEncoder().encode(f.name)
    const crc = crc32(body)
    const local = new DataView(new ArrayBuffer(30 + name.length))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, body.length, true)
    local.setUint32(22, body.length, true)
    local.setUint16(26, name.length, true)
    new Uint8Array(local.buffer).set(name, 30)
    const cen = new DataView(new ArrayBuffer(46 + name.length))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, body.length, true)
    cen.setUint32(24, body.length, true)
    cen.setUint16(28, name.length, true)
    cen.setUint32(42, offset, true)
    new Uint8Array(cen.buffer).set(name, 46)
    parts.push(local.buffer, body)
    central.push(new Uint8Array(cen.buffer))
    offset += 30 + name.length + body.length
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cenSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central.map((c) => c.buffer as ArrayBuffer), end.buffer], { type: 'application/zip' })
}

export async function exportZip(): Promise<Blob | null> {
  const all = await listRecordings()
  if (!all.length) return null
  // строй пишем в имя: при импорте в сайт запись другого строя надо сдвинуть
  const manifest = all.map((r) => `${r.id}\t${r.instrument}`).join('\n') + '\n'
  return zip([
    ...all.map((r) => ({ name: `${r.id}.wav`, blob: r.blob })),
    { name: 'instruments.tsv', blob: new Blob([manifest]) },
  ])
}
