/** Canvas font string for shapes made of dots (the clean grotesk, not a pixel face). */
export function pixelFont(size: number, weight = 600): string {
  let family = ''
  if (typeof document !== 'undefined') {
    family = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-sans').trim()
  }
  return `${weight} ${size}px ${family ? family + ',' : ''} ui-sans-serif, system-ui, sans-serif`
}
