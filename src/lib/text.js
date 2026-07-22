/**
 * Display-layer text casing.
 *
 * These are presentation transforms only — what's stored stays exactly as typed
 * or as the model returned it. Normalising at render time means a lowercase
 * voice entry ("we're out of pickles") and a hand-typed one both look right
 * without policing input.
 */

// Words that stay lowercase inside a title — but never as the first or last word.
const MINOR = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor',
  'of', 'on', 'onto', 'or', 'over', 'per', 'the', 'to', 'up', 'via', 'vs', 'with',
])

/** "crispy chicken sandwich" -> "Crispy Chicken Sandwich"; "mac and cheese" -> "Mac and Cheese" */
export function titleCase(input) {
  if (!input) return input
  const words = String(input).trim().split(/\s+/)
  return words
    .map((word, i) => {
      // Leave anything already containing capitals alone — acronyms, brand names,
      // "BBQ", "Pad Thai" — recasing those would make them worse, not better.
      if (/[A-Z]/.test(word.slice(1))) return word
      const lower = word.toLowerCase()
      if (i > 0 && i < words.length - 1 && MINOR.has(stripPunct(lower))) return lower
      return capitalizeParts(lower)
    })
    .join(' ')
}

/** "taco night's doable" -> "Taco night's doable" */
export function sentenceCase(input) {
  if (!input) return input
  const s = String(input).trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Hyphens and slashes get their own capital: "stir-fry" -> "Stir-Fry"
function capitalizeParts(word) {
  return word.replace(/(^|[-/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
}

const stripPunct = (w) => w.replace(/[^a-z]/g, '')
