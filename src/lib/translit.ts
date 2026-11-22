// Узбекская латиница → кириллица (школьная латиница и привычная старшим кириллица).
// Переводим автоматически, а не вторым словарём: строк сотни, а правила простые.
// Не трогаем то, что пишется одинаково на любом языке: названия нот (B♭4, C),
// пальцы (L1, R2), 8va, бренды (Chrome, Safari, Telegram).

const KEEP = /^(?:[A-G][♭♯b#]?\d?|[LR]\d|8va|Chrome|Safari|Telegram|Shift|PDF|PWA|APK|Hz|BPM|T|A4|UZ|RU|EN|ЎЗ)$/

const DI: Array<[RegExp, string]> = [
  [/o[‘'’ʻ`]/gi, '\u0001'], // ў
  [/g[‘'’ʻ`]/gi, '\u0002'], // ғ
  [/sh/gi, '\u0003'],
  [/ch/gi, '\u0004'],
  [/yo/gi, '\u0005'],
  [/yu/gi, '\u0006'],
  [/ya/gi, '\u0007'],
  [/ye/gi, '\u000e'],
]
const DI_OUT: Record<string, string> = { '\u0001': 'ў', '\u0002': 'ғ', '\u0003': 'ш', '\u0004': 'ч', '\u0005': 'ё', '\u0006': 'ю', '\u0007': 'я', '\u000e': 'е' }
const ONE: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
}
const VOWELS = 'аеёиоуўэюя'

function word(w: string): string {
  if (KEEP.test(w)) return w
  // запоминаем, какие буквы были заглавными, по позициям исходного слова не выйдет —
  // диграфы сжимают длину; поэтому регистр берём по первой букве диграфа
  let s = w
  const upper: boolean[] = []
  for (const [re, mark] of DI) s = s.replace(re, (m) => (upper.push(m[0] !== m[0].toLowerCase()), mark + (m[0] !== m[0].toLowerCase() ? '\u000f' : '')))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\u000f') continue
    const capNext = s[i + 1] === '\u000f'
    let c: string
    if (DI_OUT[ch]) c = DI_OUT[ch]
    else if (ch === '’' || ch === 'ʼ' || ch === "'") c = 'ъ' // тутуқ белгиси
    else {
      const low = ch.toLowerCase()
      c = ONE[low] ?? ch
      // «e» в начале слова и после гласной — «э» (eshik → эшик, poezd → поэзд)
      if (low === 'e' && (out.length === 0 || VOWELS.includes(out[out.length - 1].toLowerCase()))) c = 'э'
      if (ch !== low) c = c.toUpperCase()
      out += c
      continue
    }
    out += capNext ? c.toUpperCase() : c
  }
  // слово целиком заглавными (UZ-подписи) — оставляем заглавными
  return w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? out.toUpperCase() : out
}

export function toCyrillic(text: string): string {
  return text.replace(/[A-Za-z0-9♭♯#'‘’ʻʼ`]+/g, (w) => {
    // апостроф в начале/конце слова — это кавычка или знак, а не часть буквы
    const lead = w.match(/^['‘’ʻʼ`]*/)![0]
    const core = w.slice(lead.length)
    return lead + (core ? word(core) : '')
  })
}

/** перевести все строки объекта (словарь интерфейса) */
export function cyrDict<T extends Record<string, string>>(d: T): T {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, toCyrillic(v)])) as T
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const t = (a: string, b: string) => console.assert(toCyrillic(a) === b, 'translit', a, '→', toCyrillic(a), '≠', b)
  t('Sxemani qanday o‘qish kerak', 'Схемани қандай ўқиш керак')
  t('Notani chaling — tyuner mikrofonni tinglaydi', 'Нотани чалинг — тюнер микрофонни тинглайди')
  t('kaft E♭ va L1', 'кафт E♭ ва L1')
  t('Eshitib', 'Эшитиб')
  t('G‘alaba', 'Ғалаба')
  t('Saksofon — applikaturalar', 'Саксофон — аппликатуралар')
}
