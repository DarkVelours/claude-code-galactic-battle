// Renders galactic-battle-demo.mp4 (1920x1080, 30 fps, silent, ~1 MB) from the real battle
// module: it draws the full-rate scripted turn with make-demo.tsx, adds captions, then an end card.
// The MP4 is not kept in the repository (the Claude directory holds binary files for review):
// attach it to a GitHub release instead.
//
//   npm i --no-save playwright-core        # once (node_modules is git-ignored)
//   CHROME=/usr/bin/google-chrome node docs/make-video.mjs [out.mp4]   # default: ./galactic-battle-demo.mp4
//
// Needs ffmpeg and npx on the PATH, and a Chromium or Chrome binary (CHROME, or playwright's own).
// Captions follow the scripted turn of make-demo.tsx: a tool ends every 0.45 s, helpers run from
// 3.5 s to 10 s, the first failure lands at 7.5 s.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const DOCS = fileURLToPath(new URL('.', import.meta.url))
const FRAMES = mkdtempSync(join(tmpdir(), 'galactic-battle-'))
const FULL_SVG = join(FRAMES, 'demo-full.svg')
const draw = spawnSync('npx', ['--yes', 'tsx', join(DOCS, 'make-demo.tsx'), FULL_SVG], {
  env: { ...process.env, FRAMES: '120' },
  stdio: 'inherit',
})
if (draw.status !== 0) process.exit(draw.status ?? 1)
const SVG = readFileSync(FULL_SVG, 'utf8')
const CHROME = process.env.CHROME || chromium.executablePath()
const OUT = process.argv[2] || join(process.cwd(), 'galactic-battle-demo.mp4')

const FPS = 30
const HOOK = 2.5
const DEMO = 12
const END = 3.5
const TOTAL = HOOK + DEMO + END

const CAPTIONS = [
  { from: 0, to: 3.4, html: 'Tool succeeds <b style="color:#3bff6b">→ rebel shot</b>' },
  { from: 3.5, to: 7.4, html: 'Each subagent <b style="color:#6fd6ff">→ one more fighter</b>' },
  { from: 7.5, to: 9.5, html: 'Tool fails <b style="color:#ff4d4d">→ Empire shot</b>' },
  { from: 9.6, to: 12, html: 'Lightsaber <b style="color:#ff7a1f">→ context + 5-hour quota</b>' },
]

const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;background:#0d1b2a;overflow:hidden;font-family:'DejaVu Sans','Liberation Sans',sans-serif;color:#e8eef5;position:relative}
#glow{position:absolute;inset:0;background:radial-gradient(900px 500px at 50% 55%,rgba(255,122,31,.12),transparent 70%)}
#hook{position:absolute;top:200px;left:0;right:0;text-align:center;font-size:84px;font-weight:700;letter-spacing:-1px}
#hook em{font-style:normal;color:#ff7a1f}
#cap{position:absolute;top:200px;left:0;right:0;text-align:center;font-size:72px;font-weight:700;letter-spacing:-1px}
#card{position:absolute;left:110px;top:410px;width:1700px}
#card svg{width:1700px;height:auto;display:block;border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,.55)}
.f{display:none!important}
.f.on{display:inline!important;animation:none!important;visibility:visible!important}
.only-last .f.on text:not(:last-child){visibility:hidden}
#note{position:absolute;left:0;right:0;bottom:70px;text-align:center;font-size:26px;color:#778da9}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;opacity:0}
#end h1{font-size:120px;letter-spacing:-3px}
#end h1 span{color:#ff7a1f}
#end p{font-size:44px;color:#9fb2c8}
#end code{font-family:'DejaVu Sans Mono',monospace;font-size:34px;background:#05060d;border:2px solid #ff7a1f;border-radius:12px;padding:20px 32px;color:#e8eef5}
#end .url{font-family:'DejaVu Sans Mono',monospace;font-size:36px;color:#ff7a1f}
#end small{font-size:24px;color:#778da9;position:absolute;bottom:60px}
</style>
<div id="glow"></div>
<div id="hook">Your Claude Code spinner is <em>boring.</em></div>
<div id="cap"></div>
<div id="card">${SVG}</div>
<div id="note">Scripted turn, rendered from the mod's own code</div>
<div id="end">
<h1>Galactic <span>Battle</span></h1>
<p>Free · MIT · No tokens spent</p>
<code>/plugin marketplace add DarkVelours/claude-code-galactic-battle</code>
<div class="url">github.com/DarkVelours/claude-code-galactic-battle</div>
<small>Fan parody, not affiliated with Lucasfilm or Disney.</small>
</div>
<script>
const frames=[...document.querySelectorAll('.f')]
const ease=(x)=>Math.max(0,Math.min(1,x))
window.setT=(t,hookEnd,demoEnd,total,caps)=>{
  const card=document.getElementById('card'),hook=document.getElementById('hook'),cap=document.getElementById('cap'),end=document.getElementById('end'),note=document.getElementById('note')
  frames.forEach(f=>f.classList.remove('on'))
  const inHook=t<hookEnd, inDemo=t>=hookEnd&&t<demoEnd
  // card: spinner line only during the hook, then the whole battle
  card.classList.toggle('only-last',inHook)
  let idx=inHook?0:Math.min(frames.length-1,Math.floor((t-hookEnd)*10))
  frames[idx].classList.add('on')
  hook.style.opacity=inHook?ease((hookEnd-t)/0.3)*ease(t/0.35):0
  card.style.opacity=t<demoEnd?ease(t/0.4)*ease((demoEnd+0.3-t)/0.3):0
  note.style.opacity=inDemo?0.9:0
  const td=t-hookEnd
  const c=caps.find(c=>td>=c.from&&td<=c.to)
  cap.innerHTML=c&&inDemo?c.html:''
  cap.style.opacity=c&&inDemo?ease((td-c.from)/0.2)*ease((c.to-td)/0.2+0.5):0
  const te=t-demoEnd
  end.style.opacity=te>0?ease(te/0.4):0
}
</script>`

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.setContent(html)
await page.waitForTimeout(300)

const n = Math.round(TOTAL * FPS)
for (let i = 0; i < n; i++) {
  const t = i / FPS
  await page.evaluate(([t, a, b, c, caps]) => window.setT(t, a, b, c, caps), [t, HOOK, HOOK + DEMO, TOTAL, CAPTIONS])
  await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(4, '0')}.png`) })
}
await browser.close()

const ff = spawnSync(
  'ffmpeg',
  ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT],
  { stdio: 'inherit' },
)
rmSync(FRAMES, { recursive: true, force: true })
if (ff.status !== 0) process.exit(ff.status ?? 1)
console.log('frames', n, '->', OUT)
