import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { LANGUAGES, LOCALES, pickLanguage } from '../locales'
import type { Intel, Locale, Pid } from '../types'

const PLUGIN = 'galactic-battle'

const isOn = atom({ plugin: 'galactic-battle', key: 'isOn' } as const, true)
const isSoundOn = atom({ plugin: 'galactic-battle', key: 'isSoundOn' } as const, true)
const isMusicOn = atom({ plugin: 'galactic-battle', key: 'isMusicOn' } as const, false)
// The music player's pid lives in session state so a module reload can still stop it.
const musicPid = atom({ plugin: 'galactic-battle', key: 'musicPid' } as const, null as Pid)

const STORE_KEY = 'galactic-battle.isOn'
const SOUND_KEY = 'galactic-battle.isSoundOn'
const MUSIC_KEY = 'galactic-battle.isMusicOn'

const BLASTER = 'sounds/blaster.wav'
// Where a person drops their own sounds; overridden by the "Music file" option.
const USER_DIR = '.claude/galactic-battle'
// One blast every 2.5 s at most: a busy fight would otherwise be a machine gun.
const SOUND_GAP_MS = 2500
// How often the context and quota are read while a turn runs.
const TICK_MS = 800

const FILE_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

// Plays one short clip with the first player found: paplay (Linux, WSLg),
// afplay (macOS), ffplay; exits 9 when there is none.
const PLAY_ONCE = [
  'f="$1"; pa="$2"; af="$3"; ff="$4"',
  'if command -v paplay >/dev/null && paplay --volume="$pa" "$f" 2>/dev/null; then exit 0; fi',
  'if command -v afplay >/dev/null; then exec afplay -v "$af" "$f"; fi',
  'if command -v ffplay >/dev/null; then exec ffplay -nodisp -autoexit -loglevel quiet -volume "$ff" "$f"; fi',
  'exit 9',
].join('\n')

// Starts the looping music detached (30 min hard cap, so a missed stop cannot
// leave it playing forever) and prints its pid; exits 9 with no player.
const START_MUSIC = [
  'f="$1"; af="$2"; ff="$3"',
  'if command -v ffplay >/dev/null && command -v timeout >/dev/null; then',
  '  nohup timeout 1800 ffplay -nodisp -loglevel quiet -loop 0 -volume "$ff" "$f" >/dev/null 2>&1 </dev/null &',
  'elif command -v afplay >/dev/null; then',
  '  nohup sh -c \'end=$(( $(date +%s) + 1800 )); while [ "$(date +%s)" -lt "$end" ]; do afplay -v "$1" "$0" || exit; done\' "$f" "$af" >/dev/null 2>&1 </dev/null &',
  'else exit 9; fi',
  'echo $!',
].join('\n')

// Stops the pid only while it is still one of ours (no pid-reuse accident),
// with its children (afplay under the macOS loop).
const STOP_MUSIC = [
  'case "$(ps -o comm= -p "$1" 2>/dev/null)" in',
  '  *timeout*|*sh|*ffplay*) pkill -P "$1" 2>/dev/null; kill "$1" 2>/dev/null ;;',
  'esac',
  'exit 0',
].join('\n')

const SOUND_WORDS = ['sound', 'son', 'blaster']
const MUSIC_WORDS = ['music', 'musique', 'zik']
const LANGUAGE_WORDS = ['lang', 'language', 'langue']
const INFO_WORDS = ['info', 'infos', 'details', 'detail']
const STATUS_WORDS = ['status', 'statut', 'help', 'aide']

const hash = (value: string) => {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  }

  return h >>> 0
}

// `on`/`off` sets the value, nothing toggles it; any other word is refused.
const nextValue = (word: string | undefined, current: boolean) =>
  word === 'on' ? true : word === 'off' ? false : word === undefined ? !current : undefined

const volumes = (volume: number) => {
  const v = Math.min(100, Math.max(0, volume))

  return { pa: String(Math.round(v * 655.36)), af: (v / 100).toFixed(2), ff: String(Math.round(v)) }
}

// What the battle is told about the turn. It lives in the module: a reload
// starts a fresh one, and the next turn fills it again.
type LiveHelper = { label: string; model: string; since: number }
type Live = {
  isTurn: boolean
  ok: number
  err: number
  files: Set<string>
  action: string
  helpers: Map<string, LiveHelper>
  ctx: number | null
  quota: number | null
  quotaBase: number | null
  mode: string
}

const fresh = (): Live => ({
  isTurn: false,
  ok: 0,
  err: 0,
  files: new Set(),
  action: '',
  helpers: new Map(),
  ctx: null,
  quota: null,
  quotaBase: null,
  mode: '',
})

let live = fresh()

const str = (value: unknown) => (typeof value === 'string' ? value : '')

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

// The shell command without its `cd "<dir>" &&` lead-in, on one short line.
const shortCommand = (command: string) =>
  command
    .replace(/^\s*cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 36)

// What a tool call is doing, for the battle's line. Only the tool's name unless
// the person asked for the details: file names and commands are on screen.
function describe(tool: string, args: Record<string, unknown>, isFull: boolean) {
  if (!isFull) return tool

  const path = str(args.file_path) || str(args.notebook_path)
  const detail =
    path !== ''
      ? baseName(path)
      : tool === 'Bash'
        ? shortCommand(str(args.command))
        : tool === 'Grep' || tool === 'Glob'
          ? str(args.pattern).slice(0, 30)
          : tool === 'WebFetch'
            ? (str(args.url).replace(/^https?:\/\//, '').split('/')[0] ?? '')
            : tool === 'Agent'
              ? str(args.description).slice(0, 30)
              : ''

  return detail === '' ? tool : `${tool} ${detail}`
}

const helperLabel = (args: Record<string, unknown>, isFull: boolean) =>
  isFull
    ? str(args.name) || str(args.description).slice(0, 22) || str(args.subagent_type) || 'agent'
    : str(args.subagent_type) || 'agent'

// Reads the context window and the 5-hour quota, then asks for a redraw.
async function refresh($: EngineInterface) {
  if (!live.isTurn) return

  const usage = await $.session.usage()
  live.ctx = usage.context.percent ?? null
  const fiveHour = usage.rateLimits.find(limit => limit.kind === 'five_hour')
  live.quota = fiveHour ? fiveHour.percentUsed : null

  if (live.quotaBase === null) live.quotaBase = live.quota

  $.ui.invalidate('ui.render')
}

async function detectLanguage($: EngineInterface, setting: unknown) {
  return pickLanguage(setting, await $.env.get('LC_ALL'), await $.env.get('LANG'))
}

// Read once per module load (an option change reloads the module).
let language: string | null = null

async function resolveLanguage($: EngineInterface, setting: unknown) {
  language ??= await detectLanguage($, setting)
}

async function homePath($: EngineInterface, path: string) {
  const home = (await $.env.get('HOME')) ?? ''

  return path.startsWith('~/') ? `${home}/${path.slice(2)}` : path
}

async function musicPath($: EngineInterface, setting: unknown) {
  const configured = typeof setting === 'string' ? setting.trim() : ''

  return homePath($, configured || `~/${USER_DIR}/music.mp3`)
}

async function exists($: EngineInterface, path: string) {
  try {
    await $.fs.stat(path)

    return true
  } catch {
    return false
  }
}

// A blaster.wav of the person's own beats the bundled one.
async function blasterPath($: EngineInterface) {
  const own = await homePath($, `~/${USER_DIR}/blaster.wav`)

  return (await exists($, own)) ? own : `${$.plugin.root}/${BLASTER}`
}

async function startMusic($: EngineInterface, path: string, volume: number) {
  if ((await read($, musicPid)) !== null) return

  const v = volumes(volume)

  try {
    const r = await $.process.run(['sh', '-c', START_MUSIC, PLUGIN, path, v.af, v.ff], { timeoutMs: 5000 })
    const pid = Number(r.stdout.trim())

    if (r.exitCode === 0 && pid > 0) {
      await update($, musicPid, () => pid)
    }
  } catch {
    // no shell player: nothing plays
  }
}

async function stopMusic($: EngineInterface) {
  const pid = await read($, musicPid)

  if (pid === null) return
  await update($, musicPid, () => null)
  await $.process.run(['sh', '-c', STOP_MUSIC, PLUGIN, String(pid)], { timeoutMs: 5000 }).catch(() => undefined)
}

export const register: Register = (on, options) => {
  language = null
  live = fresh()
  let lastSoundAt = Number.NEGATIVE_INFINITY
  const volume = typeof options.volume === 'number' ? options.volume : 40
  const isFull = options.details === 'full'
  const details = isFull ? 'full' : 'tool'
  const t = (): Locale => LOCALES[language ?? 'en'] ?? (LOCALES.en as Locale)

  on('session.start', async ($, e, next) => {
    await resolveLanguage($, options.language)

    await $.command.register({
      name: 'battle',
      description: 'Galactic battle: animation, live gauges, blaster sound, music, language',
      argumentHint: '[on|off|sound|music|lang|info|status]',
      immediate: true,
    })

    if ((await $.store.get(STORE_KEY)) === false) await update($, isOn, () => false)
    if ((await $.store.get(SOUND_KEY)) === false) await update($, isSoundOn, () => false)
    if ((await $.store.get(MUSIC_KEY)) === true) await update($, isMusicOn, () => true)

    // Cheap when idle: it only reads the usage while a turn runs.
    $.clock.every(TICK_MS, () => {
      refresh($).catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'battle' }, async ($, e) => {
    await resolveLanguage($, options.language)
    const [first, second] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const usage = `\n${t().usage}`

    if (first !== undefined && STATUS_WORDS.includes(first)) {
      const status = t().status(
        await read($, isOn),
        await read($, isSoundOn),
        await read($, isMusicOn),
        language ?? 'en',
        details,
      )

      return { text: status + usage }
    }

    if (first !== undefined && LANGUAGE_WORDS.includes(first)) {
      if (second === undefined || !['auto', ...LANGUAGES].includes(second)) {
        return { text: t().unknownOption(second ?? '') + usage }
      }

      // The option is the one source: /config shows it, and setting it reloads the module.
      const r = await $.config.set({ key: 'galactic-battle.language', value: second })

      if ('deny' in r && r.deny) return { text: t().languageRefused(String(r.deny)) }
      language = await detectLanguage($, second)

      return { text: t().languageSet(second === 'auto' ? `auto (${language})` : language) }
    }

    if (first !== undefined && INFO_WORDS.includes(first)) {
      const value = second === undefined ? (isFull ? 'tool' : 'full') : second

      if (value !== 'tool' && value !== 'full') return { text: t().unknownOption(second ?? '') + usage }

      const r = await $.config.set({ key: 'galactic-battle.details', value })

      if ('deny' in r && r.deny) return { text: t().languageRefused(String(r.deny)) }

      return { text: t().detailsSet(value) }
    }

    if (first !== undefined && SOUND_WORDS.includes(first)) {
      const value = nextValue(second, await read($, isSoundOn))
      if (value === undefined) return { text: t().unknownOption(second ?? '') + usage }
      await update($, isSoundOn, () => value)
      await $.store.set(SOUND_KEY, value)

      return { text: value ? t().soundOn : t().soundOff }
    }

    if (first !== undefined && MUSIC_WORDS.includes(first)) {
      const value = nextValue(second, await read($, isMusicOn))
      if (value === undefined) return { text: t().unknownOption(second ?? '') + usage }

      if (!value) {
        await update($, isMusicOn, () => false)
        await $.store.set(MUSIC_KEY, false)
        await stopMusic($)

        return { text: t().musicOff }
      }

      const path = await musicPath($, options.musicFile)
      if (!(await exists($, path))) return { text: t().noMusicFile(path) }
      await update($, isMusicOn, () => true)
      await $.store.set(MUSIC_KEY, true)
      if (live.isTurn && (await read($, isOn))) await startMusic($, path, volume)

      return { text: t().musicOn }
    }

    const value = nextValue(first, await read($, isOn))
    if (value === undefined) return { text: t().unknownOption(first ?? '') + usage }
    await update($, isOn, () => value)
    await $.store.set(STORE_KEY, value)
    if (!value) await stopMusic($)

    return { text: value ? t().battleOn : t().battleOff }
  })

  // The music plays for the length of a turn, the same time the battle is drawn.
  // A helper's own turns fire these hooks too (agentId set): they must not
  // reset the battle or cut the music of the main turn.
  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)

    live = fresh()
    live.isTurn = true
    await refresh($).catch(() => undefined)

    if ((await read($, isOn)) && (await read($, isMusicOn))) {
      const path = await musicPath($, options.musicFile)
      if (await exists($, path)) await startMusic($, path, volume)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)

    live.isTurn = false
    live.helpers.clear()
    await stopMusic($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    live.isTurn = false
    await stopMusic($)

    return next(e)
  })

  // Every tool call feeds the battle: a result is a win, an error a loss, a
  // running Agent call is a helper. The hook only watches: the call and its
  // result go through untouched, and if this hook fails it is skipped.
  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const id = e.tool_use_id ?? `${e.tool}-${live.ok + live.err}`
    const isHelper = e.tool === 'Agent'

    live.action = describe(e.tool, args, isFull)

    if (isHelper) {
      live.helpers.set(id, { label: helperLabel(args, isFull), model: str(args.model), since: await $.clock.now() })
    }

    let isFailed = false
    let isBackground = false

    try {
      const result = await next(e)
      // A background Agent call returns at once while the helper keeps working:
      // it stays on the battlefield until the turn ends.
      isBackground = isHelper && 'text' in result && /async agent launched/i.test(String(result.text))
      isFailed = ('isError' in result && result.isError === true) || ('deny' in result && Boolean(result.deny))

      return result
    } catch (error) {
      isFailed = true

      throw error
    } finally {
      if (!isBackground) live.helpers.delete(id)

      if (isFailed) {
        live.err += 1
      } else {
        live.ok += 1
        const path = str(args.file_path) || str(args.notebook_path)
        if (FILE_TOOLS.includes(e.tool) && path !== '') live.files.add(path)
      }

      // Reads the gauges too, so they move with the work and not only on the timer.
      await refresh($).catch(() => undefined)
    }
  })

  // An explosion in the battle: a shell player first ($.audio.play has none
  // on Linux or WSL), the engine's own player as the last resort.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { boom?: unknown } | null

    if (e.element !== 'battle' || data?.boom !== true || !(await read($, isSoundOn))) {
      return next(e)
    }

    const now = await $.clock.now()

    if (now - lastSoundAt >= SOUND_GAP_MS) {
      lastSoundAt = now
      const v = volumes(volume)
      const path = await blasterPath($)
      $.process
        .run(['sh', '-c', PLAY_ONCE, PLUGIN, path, v.pa, v.af, v.ff], { timeoutMs: 5000 })
        .then(r => (r.exitCode === 0 ? undefined : $.audio.play({ asset: BLASTER })))
        .catch(() => $.audio.play({ asset: BLASTER }).catch(() => undefined))
    }

    return next(e)
  })

  // The spinner keeps its own line, with themed words; the battle itself is
  // drawn in the band just above the prompt (below).
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !(await read($, isOn))) {
      return next(e)
    }

    live.mode = e.props.mode
    await resolveLanguage($, options.language)
    const locale = t()
    const word = locale.spinnerWords[hash(e.props.word) % locale.spinnerWords.length] ?? e.props.word

    return next({ ...e, props: { ...e.props, word } })
  })

  // The battle sits in the AbovePrompt slot, under the other bands, so it is
  // the nearest thing to the input box. Only while Claude works.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)

    if (e.surface !== 'terminal' || e.props.hasSurvey || !(await read($, isOn))) return below
    if (!live.isTurn && !e.props.isWorking) return below

    await resolveLanguage($, options.language)
    const locale = t()
    const now = await $.clock.now()
    const columns = Math.min(Math.max(e.props.bodyColumns - 2, 30), 160)
    const battleText = {
      quotes: locale.quotes,
      modes: locale.modes,
      modeDefault: locale.modeDefault,
      rebels: locale.rebels,
      empire: locale.empire,
      collision: locale.collision,
      freighter: locale.freighter,
      labels: locale.labels,
    }
    const quotaDelta =
      live.quota !== null && live.quotaBase !== null ? Math.round((live.quota - live.quotaBase) * 10) / 10 : null
    const intel: Intel = {
      ok: live.ok,
      err: live.err,
      files: live.files.size,
      action: live.action,
      helperCount: live.helpers.size,
      helpers: [...live.helpers.values()].slice(0, 4).map(h => ({
        label: h.label,
        model: h.model,
        seconds: Math.max(0, Math.round((now - h.since) / 1000)),
      })),
      ctx: live.ctx,
      quota: live.quota,
      quotaDelta,
    }
    const { Box, Client } = $.ui.resolve(e)
    const battle = <Client key="battle" module="./battle.tsx" props={{ columns, mode: live.mode, text: battleText, intel }} />

    return below ? (
      <Box flexDirection="column">
        {below}
        {battle}
      </Box>
    ) : (
      battle
    )
  })
}
