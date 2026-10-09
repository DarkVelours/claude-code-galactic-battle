// Draws docs/demo.svg from the real battle module, with a scripted turn.
//   npx tsx docs/make-demo.tsx docs/demo.svg
import { writeFile } from 'node:fs/promises'

import { en } from '../locales/en.ts'

const flat = (n: any): any[] => (n == null || n === false ? [] : Array.isArray(n) ? n.flatMap(flat) : [n])
;(globalThis as any).h = (tag: any, props: any, ...children: any[]) => tag({ ...(props ?? {}), children: flat(children) })
const Box = (p: any) => ({ type: 'Box', props: p })
const Text = (p: any) => ({ type: 'Text', props: p })

async function main() {
const mod = await import('../hooks/battle.tsx')
let state: any
let tick: () => void = () => {}
const surface: any = {
  elements: { Box, Text },
  get state() {
    return state
  },
  setState: (s: any) => {
    state = s
  },
  every: (_: number, fn: () => void) => {
    tick = fn
  },
  post: () => {},
}

const COLS = 92
const text = {
  quotes: en.quotes,
  modes: en.modes,
  modeDefault: en.modeDefault,
  rebels: en.rebels,
  empire: en.empire,
  collision: en.collision,
  freighter: en.freighter,
  labels: en.labels,
}

// The turn: a tool finishes every ~9 ticks, one fails, two helpers run for a while,
// and the context window fills up from blue to purple to red.
const ACTIONS = ['Read register.tsx', 'Grep "isOn"', 'Edit battle.tsx', 'Bash npm test', 'Read plugin.json', 'Edit README.md']
const intelAt = (tick: number) => {
  const done = Math.floor(tick / 9)
  const err = tick > 150 ? 1 : 0
  const helpers = tick > 70 && tick < 200 ? [
    { label: 'Explore', model: 'haiku', seconds: Math.floor((tick - 70) / 7) },
    ...(tick > 110 ? [{ label: 'general-purpose', model: 'sonnet', seconds: Math.floor((tick - 110) / 7) }] : []),
  ] : []

  return {
    ok: done - err,
    err,
    files: Math.floor(done / 3),
    action: done === 0 ? '' : (ACTIONS[done % ACTIONS.length] ?? ''),
    helpers,
    helperCount: helpers.length,
    ctx: Math.min(92, 36 + tick / 4.2),
    quota: 12,
    quotaDelta: Math.round(tick / 90) / 10,
  }
}
const propsAt = (t: number) => ({ columns: COLS, mode: 'tool-use', text, intel: intelAt(t) })

mod.default(propsAt(0), surface)
for (let i = 0; i < 30; i++) {
  mod.default(propsAt(0), surface)
  tick()
}

type Run = { t: string; c: string; b?: boolean }
const runsOf = (row: any): Run[] =>
  row.type === 'Text'
    ? [{ t: flat(row.props.children).join(''), c: row.props.color, b: !!row.props.bold }]
    : flat(row.props.children).map((t: any) => ({ t: flat(t.props.children).join(''), c: t.props.color, b: !!t.props.bold }))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const FRAMES = 120
const TICKS_PER_FRAME = 2
const DT = 0.1
const W = 9.6
const LH = 20
const PADX = 16
const PADY = 40
const LINES = 10

const frames: string[] = []
for (let f = 0; f < FRAMES; f++) {
  const t = f * TICKS_PER_FRAME
  for (let k = 0; k < TICKS_PER_FRAME; k++) {
    mod.default(propsAt(t + k), surface)
    tick()
  }
  const tree: any = mod.default(propsAt(t), surface)
  const rows = flat(tree.props.children).map(runsOf)
  rows.push([
    { t: '✻ ', c: '#ff7a1f' },
    { t: 'Jumping to hyperspace… ', c: '#ff7a1f' },
    { t: `(${14 + Math.floor(t / 7)}s · ↓ ${(1.2 + t * 0.012).toFixed(1)}k tokens)`, c: '#778da9' },
  ])
  const lines = rows
    .map(
      (runs, y) =>
        `<text x="${PADX}" y="${PADY + y * LH}">${runs.map(r => `<tspan fill="${r.c}"${r.b ? ' font-weight="bold"' : ''}>${esc(r.t)}</tspan>`).join('')}</text>`,
    )
    .join('')
  frames.push(`<g class="f" style="animation-delay:${(f * DT).toFixed(2)}s">${lines}</g>`)
}

const width = PADX * 2 + COLS * W
const height = PADY + LINES * LH
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
text{font-family:'SF Mono',Menlo,Consolas,'DejaVu Sans Mono',monospace;font-size:15px;white-space:pre}
.f{visibility:hidden;animation:show ${(FRAMES * DT).toFixed(2)}s steps(1,end) infinite}
@keyframes show{0%{visibility:visible}${(100 / FRAMES).toFixed(3)}%{visibility:hidden}100%{visibility:hidden}}
</style>
<rect width="100%" height="100%" rx="10" fill="#05060d"/>
<circle cx="20" cy="16" r="6" fill="#ff5f57"/><circle cx="40" cy="16" r="6" fill="#febc2e"/><circle cx="60" cy="16" r="6" fill="#28c840"/>
<g xml:space="preserve">${frames.join('\n')}</g>
</svg>`

await writeFile(process.argv[2] ?? 'docs/demo.svg', svg)
console.log('frames', FRAMES, 'bytes', svg.length)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
