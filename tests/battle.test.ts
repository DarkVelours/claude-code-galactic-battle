import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const SPINNER = {
  plugin: 'galactic-battle',
  component: 'Spinner',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
  viewport: { columns: 100, rows: 40 },
} as const

// Stands for the engine's own spinner line beneath the plugin.
const engineSpinner = (on: On) =>
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ key: 'engine', children: `${e.props.word}…` })
  })

// A host where no shell player answers and no file exists but the ones listed.
const host = (on: On, files: string[] = [], env: Record<string, string> = {}) => {
  mock.store(on)
  mock.clock(on)
  mock.env(on, { HOME: '/home/pilot', ...env })
  const runs: string[][] = []
  on('process.run', ($, e) => {
    runs.push([...e.argv])

    return { value: { exitCode: 0, stdout: '4242\n', stderr: '' } }
  })
  on('fs.stat', ($, e) =>
    files.includes(e.path) ? { value: { kind: 'file', size: 1, mtimeMs: 0 } } : { deny: 'ENOENT' },
  )
  on('session.usage', () => ({ value: usage as never }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: 'done' }) as never)

  return runs
}

// What the engine says about the context window and the quota; tests change it.
const usage = {
  startedAt: 0,
  context: { tokens: 38_000, window: 100_000, percent: 38 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 12, source: 'test' }],
}

// The engine beneath the plugin runs the tool: `fails` makes the named tools error.
const tools = (on: On, fails: string[] = [], gate?: Promise<void>, isAsync = false) =>
  on('tool.call', async ($, e) => {
    if (e.tool === 'Agent' && gate) await gate
    if (e.tool === 'Agent' && isAsync) return { result: 'launched', text: 'Async agent launched successfully.' } as never

    return fails.includes(e.tool)
      ? ({ result: 'boom', text: 'boom', isError: true } as never)
      : ({ result: 'ok', text: 'ok' } as never)
  })

type Dollar = Parameters<Parameters<typeof test>[1]>[0]

const run = async ($: Dollar, args: string) => {
  const r = await $.command.run({ command: 'battle', args })

  return 'text' in r ? String(r.text) : JSON.stringify(r)
}

test('the spinner becomes a space battle that animates', async ($, on) => {
  host(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })

  expect(await ui.find({ type: 'Client', key: 'battle' })).toBeDefined()
  expect((await ui.find({ key: 'engine' }))?.text).not.toBe('Sauteing…')

  await ui.advance(70)
  expect(await ui.find({ in: 'battle', text: /REBELS/ })).toBeDefined()

  const before = JSON.stringify(await ui.drawn({ in: 'battle' }))
  await ui.advance(70 * 40)
  expect(JSON.stringify(await ui.drawn({ in: 'battle' }))).not.toBe(before)

  // A long fight still draws: no thrown frame, no tree past the bounds.
  await ui.advance(70 * 2000)
  expect(await ui.find({ in: 'battle', text: /EMPIRE/ })).toBeDefined()

  await ui.unmount()
})

test('French texts when the language option says fr', { options: { language: 'fr' } }, async ($, on) => {
  host(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await ui.advance(70)

  expect(await ui.find({ in: 'battle', text: /REBELLES/ })).toBeDefined()
  expect(await run($, 'statut')).toMatch(/Bataille ON/)
  await ui.unmount()
})

test('the desktop keeps the engine spinner', async ($, on) => {
  host(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'desktop' })

  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  await ui.unmount()
})

test('explosions fire one blaster per 2.5 s through a shell player', async ($, on) => {
  const runs = host(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  runs.length = 0

  await ui.post({ boom: true }, { in: 'battle' })
  await ui.post({ boom: true }, { in: 'battle' })
  await ui.unmount()

  expect(runs.length).toBe(1)
  expect(runs[0]?.slice(0, 2)).toEqual(['sh', '-c'])
  expect(runs[0]?.[4]).toMatch(/sounds\/blaster\.wav$/)
})

test('one command, keywords in English or French', async ($, on) => {
  host(on)

  expect(await run($, 'status')).toMatch(/Battle ON · 🔫 Sound ON · 🎵 Music OFF · 🌐 en/)
  expect(await run($, 'sound')).toMatch(/blasters off/)
  expect(await run($, 'son on')).toMatch(/Blasters armed/)
  expect(await run($, 'music off')).toMatch(/Music off/)
  expect(await run($, 'off')).toMatch(/battle off/)
  expect(await run($, '')).toMatch(/battle on/)
  expect(await run($, 'music loud')).toMatch(/Unknown option “loud”/)
  expect(await run($, 'lang klingon')).toMatch(/Unknown option “klingon”/)
  expect(await run($, 'whatever')).toMatch(/Unknown option “whatever”/)
})

test('music needs a file and says where to put it', async ($, on) => {
  host(on)

  expect(await run($, 'music on')).toMatch(/No music file at \/home\/pilot\/\.claude\/galactic-battle\/music\.mp3/)
  expect(await run($, 'status')).toMatch(/Music OFF/)
})

test('music turns on when its file exists', { options: { musicFile: '/music/theme.mp3' } }, async ($, on) => {
  host(on, ['/music/theme.mp3'])

  expect(await run($, 'music on')).toMatch(/Music ON/)
  expect(await run($, 'status')).toMatch(/Music ON/)
})

test('auto follows LANG', async ($, on) => {
  host(on, [], { LANG: 'fr_FR.UTF-8' })

  expect(await run($, 'statut')).toMatch(/Bataille ON · 🔫 Son ON · 🎵 Musique OFF · 🌐 fr/)
})


const startTurn = async ($: Dollar) => {
  usage.rateLimits[0]!.percentUsed = 12
  await $.turn.start({ text: 'go', turnId: 't1' })
}

test('tool results drive the score, the files and the action line', async ($, on) => {
  host(on)
  tools(on, ['Bash'])
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)

  await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/b.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await ui.advance(70)

  expect(await ui.find({ in: 'battle', text: /REBELS 2/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /1 EMPIRE/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /3 tools · 1 file/ })).toBeDefined()
  // Tool names only by default: no file name, no command on screen.
  expect(await ui.find({ in: 'battle', text: /⚙ Bash$/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /b\.ts|false/ })).toBeUndefined()
  await ui.unmount()
})

test('info full shows file names and commands', { options: { details: 'full' } }, async ($, on) => {
  host(on)
  tools(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)

  await $.tool.call({ tool: 'Edit', file_path: '/work/dir/b.ts', old_string: 'a', new_string: 'b' })
  await ui.advance(70)
  expect(await ui.find({ in: 'battle', text: /⚙ Edit b\.ts/ })).toBeDefined()

  await $.tool.call({ tool: 'Bash', command: 'cd "/mnt/c/some dir" && git status --short' })
  await ui.advance(70)
  expect(await ui.find({ in: 'battle', text: /⚙ Bash git status --short/ })).toBeDefined()
  await ui.unmount()
})

test('the saber shows the context and the quota, and what this turn cost', async ($, on) => {
  host(on)
  tools(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)
  await ui.advance(70)

  expect(await ui.find({ in: 'battle', text: /ctx 38%/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /5h 12%$/ })).toBeDefined()

  usage.rateLimits[0]!.percentUsed = 15
  usage.context.percent = 72
  await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
  await ui.advance(70)

  expect(await ui.find({ in: 'battle', text: /ctx 72%/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /5h 15% \(\+3\)/ })).toBeDefined()
  usage.context.percent = 38
  await ui.unmount()
})

test('a running Agent call is a helper with its own fighter and line', async ($, on) => {
  host(on)
  let release = () => {}
  tools(on, [], new Promise<void>(resolve => (release = resolve)))
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)

  const call = $.tool.call({ tool: 'Agent', description: 'scan', prompt: 'p', subagent_type: 'Explore', model: 'haiku' })
  await ui.advance(70 * 10)

  expect(await ui.find({ in: 'battle', text: /1 helper/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /Explore·haiku \d+s/ })).toBeDefined()

  release()
  await call
  await ui.advance(70)
  expect(await ui.find({ in: 'battle', text: /helper/ })).toBeUndefined()
  await ui.unmount()
})

test('a background Agent call stays a helper until the turn ends', async ($, on) => {
  host(on)
  tools(on, [], undefined, true)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)

  await $.tool.call({ tool: 'Agent', description: 'scan', prompt: 'p', subagent_type: 'Explore', model: 'haiku' })
  await ui.advance(70 * 10)

  expect(await ui.find({ in: 'battle', text: /1 helper/ })).toBeDefined()
  expect(await ui.find({ in: 'battle', text: /Explore·haiku \d+s/ })).toBeDefined()

  await $.turn.complete({ turnId: 't1', text: 'done', answer: 'done' } as never)
  await $.turn.start({ text: 'again', turnId: 't2' })
  await ui.advance(70 * 10)
  expect(await ui.find({ in: 'battle', text: /helper/ })).toBeUndefined()
  await ui.unmount()
})

test('a helper’s turn does not stop the music of the main turn', { options: { musicFile: '/music/theme.mp3' } }, async ($, on) => {
  const runs = host(on, ['/music/theme.mp3'])
  await run($, 'music on')
  await startTurn($)
  const started = runs.length

  await $.turn.start({ text: 'sub', turnId: 't-sub', agentId: 'a1' } as never)
  await $.turn.complete({ turnId: 't-sub', agentId: 'a1', text: 'done', answer: 'done' } as never)
  expect(runs.length).toBe(started)

  await $.turn.complete({ turnId: 't1', text: 'done', answer: 'done' } as never)
  expect(runs.length).toBeGreaterThan(started)
})

test('a helper’s own spinner does not draw a second battle', async ($, on) => {
  host(on)
  engineSpinner(on)
  const main = await $.ui.mount({ ...SPINNER, surface: 'terminal', requestId: 'main' })
  const helper = await $.ui.mount({ ...SPINNER, surface: 'terminal', requestId: 'agent-7' })

  expect(await main.find({ type: 'Client' })).toBeDefined()
  expect(await helper.find({ type: 'Client' })).toBeUndefined()
  await main.unmount()
  await helper.unmount()
})

test('successful tools make the battle explode and the blaster fire', async ($, on) => {
  const runs = host(on)
  tools(on)
  engineSpinner(on)
  const ui = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  await startTurn($)
  await ui.advance(70)
  runs.length = 0

  await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
  await ui.advance(70 * 40)

  // One shot at the frame the tool result lands, then the 2.5 s throttle holds the rest.
  expect(runs.filter(argv => argv[0] === 'sh').length).toBe(1)
  await ui.unmount()
})

test('info needs tool or full', async ($, on) => {
  host(on)

  expect(await run($, 'info loud')).toMatch(/Unknown option “loud”/)
})
