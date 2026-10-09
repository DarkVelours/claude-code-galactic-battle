import type { Locale } from '../types'

import { en } from './en'
import { fr } from './fr'

// Add a language: copy en.ts, translate it, register it here and in
// plugin.json's `userConfig.language.options`.
export const LOCALES: Record<string, Locale> = { en, fr }

export const LANGUAGES = Object.keys(LOCALES)

// `auto` follows the shell's locale (LC_ALL, then LANG): `fr_FR.UTF-8` → fr.
export const pickLanguage = (setting: unknown, lcAll: string | undefined, lang: string | undefined) => {
  if (typeof setting === 'string' && setting in LOCALES) return setting

  const code = (lcAll || lang || '').slice(0, 2).toLowerCase()

  return code in LOCALES ? code : 'en'
}
