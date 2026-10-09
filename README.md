# Galactic Battle for Claude Code

**English** · [Français](README.fr.md)

While Claude works, a space battle fills the band right above the prompt: starfighters trading lasers over a starfield, explosions, a running score, and the odd fast freighter. There are blaster sounds too, and you can add music.

![Galactic Battle demo](docs/demo.svg)

[▶ 18-second video](https://github.com/DarkVelours/claude-code-galactic-battle/releases/download/v1.1.0/galactic-battle-demo.mp4) (a scripted turn drawn by the mod's own code)

- A starfield on two scrolling layers, a desert planet with twin suns, and a battle station drifting by.
- **The fight follows your session.** Every tool Claude runs successfully is a rebel shot that downs an imperial fighter; every tool that fails is an imperial shot that downs a rebel one. The score is the real count **for the current turn**, and starts again at 0 on the next one: `REBELS 24 vs 1 EMPIRE` means 24 tool calls worked and 1 failed. Only what the main thread runs counts. A helper's own tool calls don't, and neither does a call you refused at a permission prompt.
- **Each helper (subagent) is one more rebel fighter**, listed with its model and how long it has been running.
- **A double-bladed lightsaber gauge.** The left blade is your context window. The right blade is your 5-hour usage limit, with what the current turn has cost so far (`+0.4`). Blue while it's calm, purple from 50 %, flickering red when it gets unstable (70 % of the context, 80 % of the quota).
- **A live line** with the tool Claude is running now, and how many tools and files it has used so far.
- The spinner keeps its line, and its words become *Jumping to hyperspace*, *Negotiating with the Hutts*… The elapsed time and token count stay.
- A blaster sound on explosions, one every 2.5 s at most, and optional music that loops during a turn.
- English and French.
- No model calls and no tokens spent. The animation runs on the terminal's own frame clock, about 14 fps.

### What it can't show

Claude Code doesn't give mods the tokens or cost of each helper, so there are no per-helper numbers: only its model and running time. The quota blade needs an account that reports a 5-hour limit; without one it stays retracted and says `?`.

## Install

In a Claude Code terminal session:

```
/plugin marketplace add DarkVelours/claude-code-galactic-battle
/plugin install galactic-battle@galactic-battle
```

Pick the user scope, then answer the four options (language, music file, volume, info shown). You can change them later in `/config`. Run `/reload-plugins` if the battle doesn't show on your next prompt.

Requires a Claude Code version with mods (function hooks). Tested on **Claude Code 2.1.296**. Mods are early access, so their API can change between releases. If the battle stops showing after an update, please open an issue.

## Commands

There's one command, with keywords:

| Command | What it does |
|---|---|
| `/battle` | Turns the battle on or off |
| `/battle on` · `/battle off` | Sets it explicitly |
| `/battle sound [on\|off]` | Blaster sound on explosions |
| `/battle music [on\|off]` | Music during a turn (needs a music file, see below) |
| `/battle lang [auto\|en\|fr]` | Language (writes the same setting as `/config`) |
| `/battle info [tool\|full]` | What the live line shows: tool names only, or file names and commands too |
| `/battle status` | Shows the current settings |

A keyword with no `on`/`off` toggles. French keywords work too (`son`, `musique`, `langue`, `statut`). The command also runs mid-turn, so `/battle music off` cuts the music right away. Your settings are kept across sessions.

## Settings (`/config`)

| Option | Default | |
|---|---|---|
| Language | `auto` | `auto` follows `LC_ALL`/`LANG`; otherwise `en` or `fr` |
| Music file | *(empty)* | Absolute path or `~/…`. Empty means `~/.claude/galactic-battle/music.mp3` |
| Volume | `40` | 0–100, for both the blaster and the music |
| Info shown | `tool` | `tool` shows tool names only. `full` also shows file names and shell commands, so switch back before you record your screen |

## Sounds

- **Blaster**: a synthesized sound ships with the plugin, MIT like the code. To use your own, put a `blaster.wav` in `~/.claude/galactic-battle/`.
- **Music**: none ships with the plugin, because good space-battle music is rarely free to redistribute. Put an mp3 at `~/.claude/galactic-battle/music.mp3` (or set *Music file*), then run `/battle music on`. Royalty-free sites like Pixabay Music or Freesound have plenty of "space battle" tracks. Check the license of whatever you pick.

The music starts with the turn, loops, and stops at the end of the turn, when you interrupt it (Esc), when you run `/battle music off`, or when the session ends. In case a stop is ever missed, the player also has a hard 30-minute cap.

## Platform support

| | Battle | Blaster | Music |
|---|---|---|---|
| Linux / WSL2 (WSLg) | ✅ tested | ✅ `paplay` (or `ffplay`) | ✅ `ffplay` |
| macOS | ⚠️ untested | ⚠️ `afplay` (untested) | ⚠️ `ffplay` or an `afplay` loop (untested) |
| Windows (native terminal) | ⚠️ untested | ❌ | ❌ |
| Claude desktop / IDE | the normal spinner, no battle | – | – |

The engine's own audio player (`$.audio.play`) only plays on macOS, so the plugin calls shell players itself. On Linux, install `pulseaudio-utils` (`paplay`) and/or `ffmpeg` (`ffplay`). If you've tested on macOS, a report is welcome.

## How it works

- `hooks/register.tsx` hooks `ui.render` twice. On `Spinner` it rewrites the words. On `AbovePrompt` it draws the `Client` under the other bands, so the battle is the nearest thing to the input box, and only while Claude works. It also watches `tool.call` to count results, errors and running helpers, reads `$.session.usage()` for the two gauges, answers `/battle`, and starts and stops sounds on `turn.start`, `turn.complete` and `ui.message`.
- `hooks/battle.tsx` is the `Client` surface module. The fight and the drawing run on the terminal's frame clock (`surface.every`), so no hook is dispatched per frame. It reads the numbers the hooks module sends as props, and posts `{ boom: true }` back for the blaster.
- `locales/*.ts` hold every text, one file per language.

## What it touches

A mod isn't sandboxed, so here is what this one does. `claude plugin validate .` lists the same calls.

- It hooks **every tool call**, but only to count it: it never changes a call or its result, and if the hook fails the call goes through. It reads no file contents and makes no network request.
- It reads your context and usage numbers, `HOME`, `LANG` and `LC_ALL`, and whether the music and blaster files exist.
- It runs `sh` to play a sound (`paplay`, `afplay` or `ffplay`) and to stop the music it started, and nothing else.
- With `info full`, file names and shell commands appear on screen. They aren't stored or sent anywhere.

## Develop

```bash
claude plugin validate .        # manifest, marketplace, hooks module
claude plugin test .            # tests/*.test.ts
npx tsx docs/make-demo.tsx docs/demo.svg   # redraws the demo from the real code
npm i --no-save playwright-core && CHROME=/path/to/chrome node docs/make-video.mjs   # re-encodes the MP4 into the current folder (needs ffmpeg; attach it to a release, it is not kept in the repo)
claude --plugin-dir .           # a session running this folder, reloaded on edit
npx -p typescript tsc -p .      # type-check (after one load writes .claude-plugin/types/)
```

To add a language, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Uninstall

```
/plugin uninstall galactic-battle
```

## Disclaimer

A fan-made, non-commercial parody inspired by a certain galaxy far, far away. It isn't affiliated with, endorsed by or sponsored by Lucasfilm Ltd. or The Walt Disney Company. All trademarks belong to their owners. No film footage, logo, sound or music is included.

## License

[MIT](LICENSE) © 2026 Dark Velours
