import type { ClientModule } from 'claude-code'

import type { BattleText, Intel, Mode, Plural } from '../types'

// A tiny space battle drawn on the terminal's frame clock: a starfield with
// parallax, a desert planet and its twin suns, a drifting battle station,
// starfighters trading lasers, explosions, and a rare freighter flyby.
//
// The fight is not random any more: it is driven by what Claude does. A tool
// that succeeds is a rebel shot that kills an imperial fighter, a tool that
// fails is an imperial shot that kills a rebel one, each running helper
// (subagent) is one more rebel fighter. Under the fight, a double-bladed
// lightsaber shows the context window (left blade) and the 5-hour quota
// (right blade). Texts and numbers come in through props.

type Props = { columns: number; mode: string; text: BattleText; intel: Intel }

type Side = 'rebel' | 'empire'
type Strike = 'ok' | 'err'
type Ship = {
  id: number
  side: Side
  kind: number
  x: number
  y: number
  vx: number
  cooldown: number
  isHelper: boolean
  isLeaving: boolean
  // A ship a real shot is flying at stops dodging.
  isLocked: boolean
}
// A real laser has a target and kills it; a decorative one flies through.
type Laser = { side: Side; x: number; y: number; vx: number; targetId: number | null }
type Boom = { x: number; y: number; age: number }
type Falcon = { x: number; y: number }

type Battle = {
  t: number
  seed: number
  nextId: number
  ships: Ship[]
  lasers: Laser[]
  booms: Boom[]
  falcon: Falcon | null
  event: { text: 'collision' | 'freighter'; until: number } | null
  seen: { ok: number; err: number }
  queue: Strike[]
  strikeGap: number
  // The animation timer is set up once, with the first props. This holder is
  // refreshed on every call so the timer always reads the latest numbers.
  latest: { width: number; intel: Intel }
}

const FRAME_MS = 70
const ROWS = 5
const LANES = [1, 2, 3]
const SHIP_WIDTH = 3
const MAX_QUEUE = 8

const SPACE = '#05060d'
const C = {
  starDim: '#3a4060',
  star: '#9aa4c8',
  starBright: '#ffffff',
  sun1: '#ffd23f',
  sun2: '#ff9a3c',
  planet: '#c98a4b',
  planetDark: '#7a4f2a',
  deathStar: '#8a8f99',
  deathStarDark: '#4a4f59',
  rebel: '#e8e8e8',
  rebelTip: '#ff7a1f',
  helper: '#8fe3ff',
  helperTip: '#3bb8e8',
  tie: '#9aa4b0',
  tieCore: '#3d6bff',
  laserRebel: '#ff3b3b',
  laserEmpire: '#3bff6b',
  laserRebelDim: '#7a2a2a',
  laserEmpireDim: '#2a7a45',
  falcon: '#f5e6c8',
  scoreGood: '#3bff6b',
  scoreBad: '#ff3b3b',
  hud: '#ffd23f',
  hudDim: '#778da9',
  helperText: '#6fb8d6',
  hilt: '#aab2c0',
  hiltDark: '#6b7280',
}

// Rebels face right, the Empire faces left; each glyph cell has its colour.
const SPRITES: Record<Side, { text: string; colors: string[] }[]> = {
  rebel: [
    { text: '=╪>', colors: [C.rebel, C.rebel, C.rebelTip] },
    { text: '═─>', colors: [C.rebelTip, C.rebel, C.rebelTip] },
  ],
  empire: [
    { text: '|o|', colors: [C.tie, C.tieCore, C.tie] },
    { text: '<o>', colors: [C.tie, C.tieCore, C.tie] },
  ],
}
const HELPER_SPRITE = { text: '=╪>', colors: [C.helper, C.helperTip, C.helperTip] }

const FALCON = { text: '-=(O)>', colors: [C.falcon, C.falcon, C.falcon, C.tieCore, C.falcon, C.rebelTip] }

const BOOM = [
  { ch: '@', color: '#ffffff' },
  { ch: '*', color: '#ffd23f' },
  { ch: '+', color: '#ff7a1f' },
  { ch: '·', color: '#7a3d1f' },
]

const PLANET = [' ▄███▄ ', '███████', ' ▀███▀ ']
const DEATH_STAR = [' ▄█▄ ', '█o███', ' ▀█▀ ']

// Blade colours: [lit, flicker, retracted]. Same thresholds as a weather
// report: blue is calm, purple means keep an eye on it, red is unstable.
const BLADE = {
  blue: ['#3b82ff', '#9ccaff', '#14284a'],
  purple: ['#a855f7', '#e0bcff', '#2c1650'],
  red: ['#ff2e2e', '#ffa3a3', '#4d1212'],
} as const
type Level = keyof typeof BLADE

const levelOf = (value: number, warn: number, danger: number): Level =>
  value >= danger ? 'red' : value >= warn ? 'purple' : 'blue'

// Park–Miller LCG kept in state so a frame is a pure function of the last one.
const rand = (b: Battle) => {
  b.seed = (b.seed * 48271) % 2147483647

  return b.seed / 2147483647
}

const noise = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return (h ^ (h >>> 16)) >>> 0
}

const pick = <T,>(b: Battle, items: T[]): T | undefined => items[Math.floor(rand(b) * items.length)]

const plural = (pair: Plural, n: number) => (n === 1 ? pair[0] : pair[1]).replace('{n}', String(n))

const fit = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(0, n - 1))}…` : text)

const percent = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

const spawn = (b: Battle, side: Side, width: number, isHelper = false): Ship => {
  const kind = Math.floor(rand(b) * SPRITES[side].length)
  const speed = 0.25 + rand(b) * 0.35

  return {
    id: b.nextId++,
    side,
    kind,
    x: side === 'rebel' ? -SHIP_WIDTH - rand(b) * 20 : width + rand(b) * 20,
    y: LANES[Math.floor(rand(b) * LANES.length)] ?? 1,
    vx: side === 'rebel' ? speed : -speed,
    cooldown: 5 + Math.floor(rand(b) * 15),
    isHelper,
    isLeaving: false,
    isLocked: false,
  }
}

const initial = (width: number, intel: Intel): Battle => {
  const b: Battle = {
    t: 0,
    seed: 1 + (Date.now() % 2147483646),
    nextId: 1,
    ships: [],
    lasers: [],
    booms: [],
    falcon: null,
    event: null,
    // Counters already on the board at mount are history, not new shots.
    seen: { ok: intel.ok, err: intel.err },
    queue: [],
    strikeGap: 0,
    latest: { width, intel },
  }

  b.ships.push(spawn(b, 'rebel', width))
  b.ships[0]!.x = 4

  for (let i = 0; i < Math.min(4, intel.helperCount); i++) {
    b.ships.push(spawn(b, 'rebel', width, true))
  }

  for (let i = 0; i < (width < 60 ? 2 : 3); i++) {
    b.ships.push(spawn(b, 'empire', width))
  }

  return b
}

const explode = (b: Battle, x: number, y: number) => {
  b.booms.push({ x: Math.round(x), y, age: 0 })
}

// Turns the new tool results into queued shots, one every few frames.
const intake = (b: Battle, intel: Intel) => {
  if (intel.ok < b.seen.ok || intel.err < b.seen.err) {
    // The counters went back to zero: a new turn.
    b.queue = []
  } else {
    for (let i = b.seen.ok; i < intel.ok && b.queue.length < MAX_QUEUE; i++) b.queue.push('ok')
    for (let i = b.seen.err; i < intel.err && b.queue.length < MAX_QUEUE; i++) b.queue.push('err')
  }

  b.seen = { ok: intel.ok, err: intel.err }
}

// One rebel fighter for the main thread, one more for each running helper.
const syncFleet = (b: Battle, intel: Intel, width: number) => {
  const wantHelpers = Math.min(4, intel.helperCount)
  const active = b.ships.filter(s => s.side === 'rebel' && !s.isLeaving)
  const helpers = active.filter(s => s.isHelper)

  if (!active.some(s => !s.isHelper)) b.ships.push(spawn(b, 'rebel', width))

  for (let i = helpers.length; i < wantHelpers; i++) b.ships.push(spawn(b, 'rebel', width, true))

  for (const s of helpers.slice(wantHelpers)) {
    s.isLeaving = true
    s.vx = 2.2
  }
}

// A finished tool call becomes a shot that is sure to land.
const fireStrike = (b: Battle, kind: Strike, width: number) => {
  const rebels = b.ships.filter(s => s.side === 'rebel' && !s.isLeaving)
  const empire = b.ships.filter(s => s.side === 'empire')

  if (kind === 'ok') {
    const target = pick(b, empire.filter(s => !s.isLocked && s.x > 8 && s.x < width - 4))
    const shooter = target && pick(b, rebels.filter(s => s.x + SHIP_WIDTH < target.x - 4))

    if (target && shooter) {
      shooter.y = target.y
      target.isLocked = true
      b.lasers.push({ side: 'rebel', x: shooter.x + SHIP_WIDTH, y: target.y, vx: 2.4, targetId: target.id })
    } else {
      explode(b, 8 + rand(b) * Math.max(1, width - 16), LANES[Math.floor(rand(b) * LANES.length)] ?? 1)
    }

    return
  }

  const target = pick(b, rebels.filter(s => !s.isLocked && s.x > 6 && s.x < width - 20))
  const shooter = target && pick(b, empire.filter(s => s.x > target.x + SHIP_WIDTH + 8 && s.x < width))

  if (target && shooter) {
    shooter.y = target.y
    target.isLocked = true
    b.lasers.push({ side: 'empire', x: shooter.x - 1, y: target.y, vx: -2.4, targetId: target.id })
  } else if (target) {
    target.isLocked = true
    explode(b, target.x + 1, target.y)
    target.x = width + 10
  }
}

const step = (prev: Battle, width: number, intel: Intel): Battle => {
  const b: Battle = {
    ...prev,
    t: prev.t + 1,
    ships: prev.ships.map(s => ({ ...s })),
    lasers: prev.lasers.map(l => ({ ...l })),
    booms: prev.booms.map(o => ({ ...o, age: o.age + 1 })).filter(o => o.age < 8),
    falcon: prev.falcon ? { ...prev.falcon } : null,
    event: prev.event && prev.event.until > prev.t ? prev.event : null,
    seen: { ...prev.seen },
    queue: [...prev.queue],
  }

  intake(b, intel)
  syncFleet(b, intel, width)

  b.strikeGap = Math.max(0, b.strikeGap - 1)

  if (b.queue.length > 0 && b.strikeGap === 0) {
    fireStrike(b, b.queue.shift() ?? 'ok', width)
    b.strikeGap = 5
  }

  for (const s of b.ships) {
    s.x += s.vx
    s.cooldown -= 1

    if (s.cooldown <= 0 && !s.isLeaving) {
      const nose = s.side === 'rebel' ? s.x + SHIP_WIDTH : s.x - 1
      b.lasers.push({ side: s.side, x: nose, y: s.y, vx: s.side === 'rebel' ? 1.8 : -1.8, targetId: null })
      s.cooldown = 16 + Math.floor(rand(b) * 24)
    }

    // Dodge: sometimes change lane.
    if (!s.isLocked && rand(b) < 0.02) {
      s.y = Math.min(3, Math.max(1, s.y + (rand(b) < 0.5 ? -1 : 1)))
    }
  }

  for (const l of b.lasers) {
    l.x += l.vx
  }

  const deadShips = new Set<Ship>()
  const spentLasers = new Set<Laser>()

  for (const l of b.lasers) {
    if (l.targetId === null) continue

    const s = b.ships.find(o => o.id === l.targetId)

    if (!s || deadShips.has(s)) {
      l.targetId = null

      continue
    }

    // The shot reached the target's cells (or went past them this frame).
    const reached = l.vx > 0 ? l.x >= s.x - 0.5 : l.x <= s.x + SHIP_WIDTH - 0.5

    if (reached) {
      deadShips.add(s)
      spentLasers.add(l)
      explode(b, s.x + 1, s.y)
    }
  }

  // Head-on collisions take both ships, and nobody scores.
  for (const a of b.ships) {
    for (const o of b.ships) {
      if (a.side !== 'rebel' || o.side !== 'empire' || a.y !== o.y) continue
      if (a.isLeaving || deadShips.has(a) || deadShips.has(o)) continue

      if (Math.abs(a.x - o.x) < SHIP_WIDTH - 0.5) {
        deadShips.add(a)
        deadShips.add(o)
        explode(b, (a.x + o.x) / 2 + 1, a.y)
        b.event = { text: 'collision', until: b.t + 30 }
      }
    }
  }

  b.lasers = b.lasers.filter(l => !spentLasers.has(l) && l.x > -2 && l.x < width + 2)

  b.ships = b.ships.flatMap(s => {
    const gone = deadShips.has(s) || s.x > width + 4 || s.x < -SHIP_WIDTH - 24

    if (!gone) return [s]
    if (s.isLeaving) return []

    return [spawn(b, s.side, width, s.isHelper)]
  })

  // The freighter: rare, fast, untouchable.
  if (b.falcon) {
    b.falcon.x += 2.4

    if (b.falcon.x > width + 2) b.falcon = null
  } else if (rand(b) < 0.004) {
    b.falcon = { x: -FALCON.text.length, y: LANES[Math.floor(rand(b) * LANES.length)] ?? 1 }
    b.event = { text: 'freighter', until: b.t + 45 }
  }

  return b
}

type Cell = { ch: string; color: string }

const draw = (b: Battle, width: number): Cell[][] => {
  const grid: Cell[][] = []

  // Two star layers with parallax: the far one drifts slower.
  for (let y = 0; y < ROWS; y++) {
    const row: Cell[] = []

    for (let x = 0; x < width; x++) {
      const far = noise(x + Math.floor(b.t / 12), y)
      const near = noise(x + Math.floor(b.t / 4), y + 101)
      let cell: Cell = { ch: ' ', color: C.star }

      if (near % 53 === 0) {
        const twinkle = (near >>> 8) % 7 === Math.floor(b.t / 6) % 7
        cell = { ch: twinkle ? '+' : '·', color: twinkle ? C.starBright : C.star }
      } else if (far % 29 === 0) {
        cell = { ch: '.', color: C.starDim }
      }

      row.push(cell)
    }

    grid.push(row)
  }

  const put = (x: number, y: number, ch: string, color: string) => {
    const cx = Math.round(x)

    if (y < 0 || y >= ROWS || cx < 0 || cx >= width || ch === ' ') return
    grid[y]![cx] = { ch, color }
  }

  // A desert planet and its twin suns, fixed on the right.
  const px = width - PLANET[0]!.length - 3
  PLANET.forEach((line, dy) => {
    for (let i = 0; i < line.length; i++) {
      put(px + i, 2 + dy, line[i] ?? ' ', i < 3 ? C.planet : C.planetDark)
    }
  })
  put(px - 6, 0, '●', C.sun1)
  put(px - 3, 1, '●', C.sun2)

  // The battle station drifts slowly right to left behind the fight.
  const span = width + DEATH_STAR[0]!.length + 10
  const dx = width - ((b.t / 10) % span)
  DEATH_STAR.forEach((line, dy) => {
    for (let i = 0; i < line.length; i++) {
      put(dx + i, dy, line[i] ?? ' ', line[i] === 'o' ? C.deathStarDark : C.deathStar)
    }
  })

  for (const l of b.lasers) {
    const real = l.targetId !== null
    const color =
      l.side === 'rebel' ? (real ? C.laserRebel : C.laserRebelDim) : real ? C.laserEmpire : C.laserEmpireDim
    const glyph = real ? '━' : '─'
    put(l.x, l.y, glyph, color)
    put(l.x - Math.sign(l.vx), l.y, glyph, color)
  }

  for (const s of b.ships) {
    const sprite = s.side === 'rebel' && s.isHelper ? HELPER_SPRITE : SPRITES[s.side][s.kind]!

    for (let i = 0; i < SHIP_WIDTH; i++) {
      put(s.x + i, s.y, sprite.text[i] ?? ' ', sprite.colors[i] ?? C.rebel)
    }
  }

  if (b.falcon) {
    for (let i = 0; i < FALCON.text.length; i++) {
      put(b.falcon.x + i, b.falcon.y, FALCON.text[i] ?? ' ', FALCON.colors[i] ?? C.falcon)
    }
  }

  for (const o of b.booms) {
    const f = BOOM[Math.min(BOOM.length - 1, Math.floor(o.age / 2))]!
    put(o.x, o.y, f.ch, f.color)

    if (o.age >= 1 && o.age < 6) {
      const r = Math.ceil(o.age / 2)
      put(o.x - r, o.y, '·', f.color)
      put(o.x + r, o.y, '·', f.color)
      put(o.x, o.y - 1, '\'', f.color)
      put(o.x, o.y + 1, '.', f.color)
    }
  }

  return grid
}

// One Text per run of a colour keeps the tree small.
const runs = (row: Cell[]) => {
  const out: Cell[] = []

  for (const cell of row) {
    const last = out[out.length - 1]

    if (last && (last.color === cell.color || cell.ch === ' ')) {
      last.ch += cell.ch
    } else {
      out.push({ ...cell })
    }
  }

  return out
}

const bladeColor = (level: Level, t: number) => {
  const [lit, flicker] = BLADE[level]
  // Red is an unstable crystal: it flickers at random. The others only hum.
  const isFlicker = level === 'red' ? noise(t, 7) % 3 === 0 : t % 9 < 2

  return isFlicker ? flicker : lit
}

// Left blade: context window. Right blade: 5-hour quota. Both grow from the hilt.
const saber = (width: number, intel: Intel, t: number, text: BattleText): Cell[] => {
  const labelL = `${text.labels.context} ${intel.ctx === null ? '?' : Math.round(intel.ctx)}% `
  const delta = intel.quotaDelta !== null && intel.quotaDelta > 0 ? ` (+${percent(intel.quotaDelta)})` : ''
  const labelR = ` ${text.labels.quota} ${intel.quota === null ? '?' : Math.round(intel.quota)}%${delta}`
  const room = width - labelL.length - labelR.length - 3 - 2
  const length = Math.max(6, Math.min(30, Math.floor(room / 2)))

  const left = intel.ctx === null ? 0 : Math.min(length, Math.round((intel.ctx / 100) * length))
  const right = intel.quota === null ? 0 : Math.min(length, Math.round((intel.quota / 100) * length))
  const levelL = levelOf(intel.ctx ?? 0, 50, 70)
  const levelR = levelOf(intel.quota ?? 0, 50, 80)

  return [
    { ch: ` ${labelL}`, color: C.hudDim },
    { ch: '·'.repeat(length - left), color: BLADE[levelL][2] },
    { ch: '━'.repeat(left), color: bladeColor(levelL, t) },
    { ch: '▐', color: C.hilt },
    { ch: '█', color: C.hiltDark },
    { ch: '▌', color: C.hilt },
    { ch: '━'.repeat(right), color: bladeColor(levelR, t + 3) },
    { ch: '·'.repeat(length - right), color: BLADE[levelR][2] },
    { ch: labelR, color: C.hudDim },
  ].filter(c => c.ch.length > 0)
}

const Battle: ClientModule<Props, Battle> = (props, surface) => {
  const { Box, Text } = surface.elements
  const width = Math.max(30, props.columns)
  const { text, intel } = props

  if (surface.state === undefined) {
    surface.every(FRAME_MS, () => {
      const prev = surface.state
      if (!prev) return

      const next = step(prev, prev.latest.width, prev.latest.intel)
      surface.setState(next)

      // Fresh explosions ask the hooks module for a blaster sound.
      if (next.booms.some(o => o.age === 0)) {
        surface.post({ boom: true })
      }
    })
    surface.setState(initial(width, intel))

    return <Box height={ROWS + 2} />
  }

  const b = surface.state
  b.latest.width = width
  b.latest.intel = intel
  const grid = draw(b, width)
  const quote = text.quotes[Math.floor(b.t / 60) % Math.max(1, text.quotes.length)] ?? ''
  const mode = text.modes[props.mode as Mode] ?? text.modeDefault
  const now = b.event && b.event.until > b.t ? text[b.event.text] : intel.action ? `⚙ ${intel.action}` : `${mode} · ${quote}`

  // The counts drop from the right when the line is too long.
  const counts = [
    intel.ok + intel.err > 0 ? plural(text.labels.tools, intel.ok + intel.err) : '',
    intel.files > 0 ? plural(text.labels.files, intel.files) : '',
    intel.helperCount > 0 ? plural(text.labels.helpers, intel.helperCount) : '',
  ].filter(Boolean)
  const score = ` ✦ ${text.rebels} ${intel.ok} vs ${intel.err} ${text.empire} ⬢ `
  let tail = counts.length > 0 ? ` · ${counts.join(' · ')}` : ''
  while (tail.length > 0 && score.length + now.length + 2 + tail.length > width) {
    counts.pop()
    tail = counts.length > 0 ? ` · ${counts.join(' · ')}` : ''
  }
  const room = Math.max(8, width - score.length - tail.length - 2)

  const helpersLine = intel.helpers
    .map(h => `${h.label}${h.model ? `·${h.model}` : ''} ${h.seconds}s`)
    .join('   ')

  return (
    <Box flexDirection="column">
      {grid.map((row, y) => (
        <Box key={`r${y}`} flexDirection="row">
          {runs(row).map((run, i) => (
            <Text key={`c${i}`} color={run.color} backgroundColor={SPACE}>
              {run.ch}
            </Text>
          ))}
        </Box>
      ))}
      <Box key="saber" flexDirection="row">
        {saber(width, intel, b.t, text).map((run, i) => (
          <Text key={`s${i}`} color={run.color}>
            {run.ch}
          </Text>
        ))}
      </Box>
      <Box key="hud" flexDirection="row">
        <Text color={C.scoreGood} bold>
          {` ✦ ${text.rebels} ${intel.ok}`}
        </Text>
        <Text color={C.hudDim}>{' vs '}</Text>
        <Text color={C.scoreBad} bold>
          {`${intel.err} ${text.empire} ⬢ `}
        </Text>
        <Text color={C.hud}>{`· ${fit(now, room)}`}</Text>
        <Text color={C.hudDim}>{tail}</Text>
      </Box>
      {helpersLine ? (
        <Text key="helpers" color={C.helperText}>
          {fit(` ⚙ ${helpersLine}`, width)}
        </Text>
      ) : null}
    </Box>
  )
}

export default Battle
