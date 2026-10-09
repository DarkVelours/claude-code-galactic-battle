# Contributing

Issues and pull requests are welcome, especially:

- **A new language.** Copy `locales/en.ts` to `locales/<code>.ts`, translate every string (the `labels` too, `{n}` stays where the count goes), and register it in `locales/index.ts`. Add the code to `userConfig.language.options` in `.claude-plugin/plugin.json`, then add a test like `French texts when the language option says fr`. Keep the quotes as parodies rather than verbatim film lines.
- **macOS audio reports.** The `afplay` paths are untested, so tell us whether the blaster and the music play, and whether the music stops at the end of a turn.
- **New ships or events** in `hooks/battle.tsx`. Every glyph must be one terminal column wide. Redraw the README demo with `npx tsx docs/make-demo.tsx docs/demo.svg` and look at it in a browser before you open the PR.

Before opening a PR:

```bash
claude plugin validate .
claude plugin test .
```

Don't add copyrighted sounds, music, logos or film quotes to the repository.
