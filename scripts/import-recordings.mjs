// Положить записи из режима «Запись» в сайт навсегда.
//   node scripts/import-recordings.mjs ~/Downloads/saxophone-recordings.zip
// Что делает: распаковывает архив, переводит каждый WAV в mp3 (нужен ffmpeg),
// приводит к строю альта (на нём записаны встроенные звуки — sound.ts считает от него),
// отмечает ноту «есть звук» в notes.ts и обновляет список офлайн-кэша.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TRANSPOSE = { soprano: -2, alto: -9, tenor: -14, baritone: -21 }
const zip = process.argv[2]
if (!zip) {
  console.error('Укажите архив: node scripts/import-recordings.mjs saxophone-recordings.zip')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'sax-rec-'))
execFileSync('unzip', ['-q', '-o', zip, '-d', dir])
const inst = Object.fromEntries(
  readFileSync(join(dir, 'instruments.tsv'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t')),
)

const notesUrl = new URL('../src/data/notes.ts', import.meta.url)
let notes = readFileSync(notesUrl, 'utf8')
const done = []
for (const f of readdirSync(dir).filter((f) => f.endsWith('.wav'))) {
  const id = f.slice(0, -4)
  // имя файла пойдёт в путь и в регулярку — пускаем только формат id нот (c_4, db4)
  if (!/^[a-g][_b][0-9]$/.test(id)) {
    console.warn(`пропуск ${f}: не похоже на ноту`)
    continue
  }
  const semis = TRANSPOSE.alto - (TRANSPOSE[inst[id]] ?? TRANSPOSE.alto)
  const factor = 2 ** (semis / 12)
  // asetrate сдвигает высоту вместе с длиной — как playbackRate в браузере.
  // Сначала приводим к 44.1 кГц: WAV из браузера обычно 48 кГц, а asetrate
  // считает от известной частоты — иначе нота уедет ещё на полтона.
  const filter = ['-af', semis ? `aresample=44100,asetrate=44100*${factor},aresample=44100` : 'aresample=44100']
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, f), ...filter, '-ac', '1', '-ar', '44100', '-b:a', '128k',
    new URL(`../public/audio/${id}.mp3`, import.meta.url).pathname])
  notes = notes.replace(new RegExp(`(id: '${id}',[^\\n]*?sound: )false`), '$1true')
  done.push(semis ? `${id} (${inst[id]}, ${semis > 0 ? '+' : ''}${semis})` : id)
}
writeFileSync(notesUrl, notes)
execFileSync('node', [new URL('precache.mjs', import.meta.url).pathname], { stdio: 'inherit' })
console.log(`Готово: ${done.length} нот — ${done.join(', ')}`)
