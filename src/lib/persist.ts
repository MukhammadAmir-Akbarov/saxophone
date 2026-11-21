import { useEffect, useState } from 'react'

/** состояние, которое переживает перезагрузку (localStorage, префикс sax.) */
export function usePersisted<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('sax.' + key)
      return raw === null ? init : (JSON.parse(raw) as T)
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('sax.' + key, JSON.stringify(v))
    } catch {
      /* приватный режим Safari — просто не запоминаем */
    }
  }, [key, v])
  return [v, setV] as const
}
