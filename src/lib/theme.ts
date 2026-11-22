/**
 * Цвет палитры с учётом темы — для canvas (ему CSS-переменные не передать).
 * В классах и style цвета уже идут через var(--c-…), см. index.css.
 */
export function col(hex: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--c-' + hex).trim() || '#' + hex
}
