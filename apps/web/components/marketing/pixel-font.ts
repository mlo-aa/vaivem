/** Canvas font string for the brand pixel face (size in canvas units). */
export function pixelFont(size: number, weight = 700): string {
  let family = ''
  if (typeof document !== 'undefined') {
    family = getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim()
  }
  return `${weight} ${size}px ${family ? family + ',' : ''} ui-monospace, monospace`
}
