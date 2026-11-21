// Перед сборкой: переписать список файлов офлайн-кэша в public/sw.js.
// Версия кэша — хеш содержимого: заменили запись ноты (тот же audio/c_4.mp3) —
// версия сменится, телефоны выбросят старый кэш и скачают новый звук.
// Запуск: node scripts/precache.mjs (сам вызывается из npm run build).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const PUB = new URL('../public/', import.meta.url)
const DIRS = ['audio', 'notes', 'img']
const files = DIRS.flatMap((d) =>
  readdirSync(new URL(d + '/', PUB))
    .filter((f) => !f.startsWith('.'))
    .sort()
    .map((f) => `${d}/${f}`),
)
const hash = createHash('sha256')
for (const f of [...files, 'manifest.webmanifest']) hash.update(f).update(readFileSync(new URL(f, PUB)))
const version = hash.digest('hex').slice(0, 10)

const swUrl = new URL('sw.js', PUB)
const sw = readFileSync(swUrl, 'utf8')
const list = ["  './',", "  'manifest.webmanifest',", ...files.map((f) => `  '${f}',`)].join('\n')
const out = sw
  .replace(/const CACHE = '[^']*'/, `const CACHE = 'sax-${version}'`)
  .replace(/const PRECACHE = \[[\s\S]*?\n\]/, `const PRECACHE = [\n${list}\n]`)
writeFileSync(swUrl, out)
console.log(`sw.js: ${files.length + 2} файлов, кэш sax-${version}`)
