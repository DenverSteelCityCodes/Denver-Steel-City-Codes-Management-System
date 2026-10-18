// Class recipes for the shared primitives (DESIGN.md › Components). The CSS lives in index.css
// (`.ui-input`, `.ui-btn`, `.ui-iconbtn`); these helpers keep the variant names in one place so a
// Link or a native element can look like a button without wrapping it.

export const fieldClass = 'ui-input'

//  primary   — gold: the one primary action on a view (never two)
//  ink       — ink with gold text: the strong secondary, or the action on a gold sign
//  secondary — 2px ink border
//  danger    — red border and text: destructive actions
//  text      — underlined text with a 44px target
export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'danger' | 'text'

export function buttonClass(variant: ButtonVariant = 'secondary', extra?: string, block = false) {
  return ['ui-btn', `ui-btn--${variant}`, block && 'ui-btn--block', extra].filter(Boolean).join(' ')
}
