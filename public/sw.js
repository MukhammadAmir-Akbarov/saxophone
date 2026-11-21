// Service worker: приложение открывается и звучит без интернета.
// Звуки, нотный стан и картинки кладём в кэш сразу при установке (это ~2 МБ),
// JS/CSS сборки (имена с хешем) — по мере загрузки, плюс страница пришлёт их список.
// При изменении набора файлов — поднять версию CACHE, старый кэш удалится.
const CACHE = 'sax-211e65634b'
const PRECACHE = [
  './',
  'manifest.webmanifest',
  'audio/a_4.mp3',
  'audio/a_5.mp3',
  'audio/a_6.mp3',
  'audio/ab4.mp3',
  'audio/ab5.mp3',
  'audio/ab6.mp3',
  'audio/b_3.mp3',
  'audio/b_4.mp3',
  'audio/b_5.mp3',
  'audio/b_6.mp3',
  'audio/bb3.mp3',
  'audio/bb4.mp3',
  'audio/bb5.mp3',
  'audio/bb6.mp3',
  'audio/c_4.mp3',
  'audio/c_5.mp3',
  'audio/c_6.mp3',
  'audio/c_7.mp3',
  'audio/d_4.mp3',
  'audio/d_5.mp3',
  'audio/d_6.mp3',
  'audio/db4.mp3',
  'audio/db5.mp3',
  'audio/db6.mp3',
  'audio/db7.mp3',
  'audio/e_4.mp3',
  'audio/e_5.mp3',
  'audio/e_6.mp3',
  'audio/eb4.mp3',
  'audio/eb5.mp3',
  'audio/eb6.mp3',
  'audio/f_4.mp3',
  'audio/f_5.mp3',
  'audio/f_6.mp3',
  'audio/g_4.mp3',
  'audio/g_5.mp3',
  'audio/g_6.mp3',
  'audio/gb4.mp3',
  'audio/gb5.mp3',
  'audio/gb6.mp3',
  'notes/a_3.png',
  'notes/a_4.png',
  'notes/a_5.png',
  'notes/a_6.png',
  'notes/a_7.png',
  'notes/ab4.png',
  'notes/ab5.png',
  'notes/ab6.png',
  'notes/ab7.png',
  'notes/b_3.png',
  'notes/b_4.png',
  'notes/b_5.png',
  'notes/b_6.png',
  'notes/b_7.png',
  'notes/bb3.png',
  'notes/bb4.png',
  'notes/bb5.png',
  'notes/bb6.png',
  'notes/bb7.png',
  'notes/c_4.png',
  'notes/c_5.png',
  'notes/c_6.png',
  'notes/c_7.png',
  'notes/c_8.png',
  'notes/d_4.png',
  'notes/d_5.png',
  'notes/d_6.png',
  'notes/d_7.png',
  'notes/d_8.png',
  'notes/db4.png',
  'notes/db5.png',
  'notes/db6.png',
  'notes/db7.png',
  'notes/db8.png',
  'notes/e_4.png',
  'notes/e_5.png',
  'notes/e_6.png',
  'notes/e_7.png',
  'notes/eb4.png',
  'notes/eb5.png',
  'notes/eb6.png',
  'notes/eb7.png',
  'notes/f_4.png',
  'notes/f_5.png',
  'notes/f_6.png',
  'notes/f_7.png',
  'notes/g_4.png',
  'notes/g_5.png',
  'notes/g_6.png',
  'notes/g_7.png',
  'notes/gb4.png',
  'notes/gb5.png',
  'notes/gb6.png',
  'notes/gb7.png',
  'img/apple-touch-icon.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon.svg',
  'img/legend.jpg',
  'img/legend2.jpg',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(// на github.io у всех проектов один origin — чужие кэши не трогаем
        keys.filter((k) => k.startsWith('sax-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// страница присылает уже загруженные ресурсы (бандлы, шрифты) — докладываем в кэш
self.addEventListener('message', (e) => {
  if (e.data?.type === 'cache' && Array.isArray(e.data.urls)) {
    caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => {}))))
  }
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (req.mode === 'navigate') {
    // страницу — сначала из сети (чтобы видеть обновления), без сети — из кэша.
    // В кэш кладём только саму страницу приложения: 404 или открытый во вкладке mp3
    // иначе подменили бы её, и без сети открывалось бы не то.
    const shell = new URL('./', self.registration.scope).pathname
    e.respondWith(
      fetch(req)
        .then((res) => {
          const html = (res.headers.get('content-type') || '').includes('text/html')
          if (res.ok && html && url.pathname === shell) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('./', copy))
          }
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }
  const sameOrigin = url.origin === self.location.origin
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !fonts) return
  e.respondWith(
    caches.match(req.url).then((hit) => {
      if (hit) {
        const range = req.headers.get('range')
        return range ? rangeResponse(hit, range) : hit
      }
      return fetch(req).then((res) => {
        // 206 (кусок аудио) кэш не принимает — кладём только целые ответы
        if (res.status === 200 || res.type === 'opaque') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req.url, copy)).catch(() => {})
        }
        return res
      })
    }),
  )
})

// Safari просит аудио кусками (Range) и не играет, если на такой запрос пришёл
// целый файл с кодом 200. Режем кэшированный файл и отвечаем 206, как сервер.
async function rangeResponse(res, range) {
  const buf = await res.arrayBuffer()
  const m = /bytes=(\d*)-(\d*)/.exec(range)
  let start = m && m[1] ? Number(m[1]) : 0
  let end = m && m[2] ? Number(m[2]) : buf.byteLength - 1
  if (m && !m[1] && m[2]) {
    start = Math.max(0, buf.byteLength - Number(m[2])) // bytes=-500 — последние 500
    end = buf.byteLength - 1
  }
  end = Math.min(end, buf.byteLength - 1)
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${buf.byteLength}` } })
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}
