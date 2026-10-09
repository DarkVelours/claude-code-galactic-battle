export type Toggle = boolean
export type Pid = number | null
export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

// [singular, plural], `{n}` standing for the count.
export type Plural = [string, string]

export type Labels = {
  context: string
  quota: string
  tools: Plural
  files: Plural
  helpers: Plural
}

// The texts the battle draws: plain data, handed to the Client module as props.
export type BattleText = {
  quotes: string[]
  modes: Record<Mode, string>
  modeDefault: string
  rebels: string
  empire: string
  collision: string
  freighter: string
  labels: Labels
}

// One running helper (a subagent), as the battle shows it.
export type Helper = { label: string; model: string; seconds: number }

// What the hooks module knows about the turn, handed to the Client as props.
export type Intel = {
  ok: number
  err: number
  files: number
  action: string
  helpers: Helper[]
  helperCount: number
  // Context window and 5-hour quota, in percent; null while unknown.
  ctx: number | null
  quota: number | null
  quotaDelta: number | null
}

// Everything one language holds.
export type Locale = BattleText & {
  spinnerWords: string[]
  usage: string
  battleOn: string
  battleOff: string
  soundOn: string
  soundOff: string
  musicOn: string
  musicOff: string
  noMusicFile: (path: string) => string
  unknownOption: (word: string) => string
  status: (battle: boolean, sound: boolean, music: boolean, language: string, details: string) => string
  languageSet: (language: string) => string
  languageRefused: (reason: string) => string
  detailsSet: (details: string) => string
}

declare module 'claude-code' {
  interface PluginState {
    'galactic-battle': { isOn: Toggle; isSoundOn: Toggle; isMusicOn: Toggle; musicPid: Pid }
  }
}
