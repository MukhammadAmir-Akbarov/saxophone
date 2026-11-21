// Service worker: приложение открывается и звучит без интернета.
// Звуки, нотный стан и картинки кладём в кэш сразу при установке (это ~2 МБ),
// JS/CSS сборки (имена с хешем) — по мере загрузки, плюс страница пришлёт их список.
// При изменении набора файлов — поднять версию CACHE, старый кэш удалится.
const CACHE = 'sax-v2'
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
  'img/apple-touch-icon.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon3.png',
  'img/legend.jpg',
  'img/legend2.jpg',
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
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
    // страницу — сначала из сети (чтобы видеть обновления), без сети — из кэша
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./', res.clone()))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }
  const sameOrigin = url.origin === self.location.origin
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !fonts) return
  // Range-запросы (аудио) отдаём из кэша целиком: браузер это принимает.
  e.respondWith(
    caches.match(req.url).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          // 206 (кусок аудио) кэш не принимает — кладём только целые ответы
          if (res.status === 200 || res.type === 'opaque') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req.url, copy)).catch(() => {})
          }
          return res
        }),
    ),
  )
})
