// The segmented control (DESIGN.md › Inputs) as class recipes, for weeks, days and filters: a 2px
// ink frame and dividers, 44px+ items; the selected one is an ink fill (bone at night, because --ink
// and --bg swap). Height and padding are the caller's: text items take min-h-11 px-3, day tiles are
// taller and narrower. `Segmented` in pages/volunteer/parts.tsx wraps the common case.
export const segCls = 'flex border-2 border-ink rounded overflow-hidden'

export function segItemCls(pressed: boolean): string {
  return `flex-1 min-w-0 border-l-2 border-ink first:border-l-0 font-bold leading-tight text-center transition-colors ${
    pressed ? 'bg-ink text-bg' : 'text-ink hover:bg-ink/6'}`
}
