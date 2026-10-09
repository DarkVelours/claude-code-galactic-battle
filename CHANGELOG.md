# Changelog

## 1.1.0 — 2026-10-09

First public release.

- Animated space battle in the band right above the prompt while Claude works (terminal), on the terminal's frame clock. The spinner keeps its line, with themed words.
- **The fight follows the session.** A tool that succeeds is a rebel shot, a tool that fails is an imperial shot, each running helper (subagent) is one more rebel fighter. The score is the real count.
- The score is per turn and counts the main thread only: helpers' own tool calls and calls refused at a permission prompt are left out.
- **Double-bladed lightsaber gauge**: context window (left) and 5-hour quota with the cost of the current turn (right), blue → purple → flickering red.
- A live line with the tool being run, and the tool, file and helper counts. `/battle info [tool|full]` chooses between tool names only and file names and commands too.
- One `/battle` command with keywords: `on|off`, `sound`, `music`, `lang`, `info`, `status` (English and French keywords).
- Blaster sound on explosions (synthesized, MIT), throttled to one every 2.5 s; your own `blaster.wav` overrides it.
- Optional music during a turn from your own file, stopped at the end of the turn (a helper's own turns never cut it).
- Helpers launched in the background (`Async agent launched`) stay on the battlefield until the turn ends.
- English and French, `auto` from `LC_ALL`/`LANG`, or the *Language* option in `/config`.
- Tested on Claude Code 2.1.296.
