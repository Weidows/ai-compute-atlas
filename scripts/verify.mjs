// Headless Edge + raw CDP driver: screenshots, console errors, geometry probes.
// Usage: node scripts/verify.mjs [url]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.argv[2] ?? 'http://localhost:5191/atlas'
const OUT = process.env.OUT ?? 'C:/Users/weidows/.hermes/cache/scratch/atlas-shots'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9341
mkdirSync(OUT, { recursive: true })

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--window-size=1680,1200',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${OUT}/profile`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      if (r.ok) return await r.json()
    } catch {}
    await sleep(250)
  }
  throw new Error('no CDP targets')
}

const list = await targets()
const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })).json()
const ws = new WebSocket(created.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
const errors = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description ?? 'exception')
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id
    pending.set(mid, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: URL })
await sleep(2500)

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.value
}

const waitFor = async (sel, min = 1) => {
  for (let i = 0; i < 50; i++) {
    const n = await ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
    if (n >= min) return n
    await sleep(200)
  }
  return 0
}

const shot = async (name, clipFull = false) => {
  let clip
  if (clipFull) {
    const h = await ev('document.documentElement.scrollHeight')
    clip = { x: 0, y: 0, width: 1680, height: Math.min(h, 4000), scale: 1 }
  }
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!clip, clip })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'))
  return `${OUT}/${name}.png`
}

const scrollTo = async (sel, offset = 76) => {
  await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - ${offset}, behavior: 'instant' }); return 1 })()`)
  await sleep(600)
}

const report = {}
report.nodes = await waitFor('#atlas button', 5)
report.counts = await ev(`({
  atlasButtons: document.querySelectorAll('#atlas button').length,
  svg: document.querySelectorAll('svg').length,
  sections: document.querySelectorAll('section').length,
  bodyH: document.documentElement.scrollHeight
})`)

await shot('01-hero')
await scrollTo('#atlas')
await shot('02-atlas')

// geometry: anything escaping the viewport (excluding the intentional scroller)
report.overflow = await ev(`(() => {
  const out = []
  const vw = document.documentElement.clientWidth
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 40 || r.height < 8) return
    if (r.right > vw + 2) {
      const cs = getComputedStyle(el)
      let p = el.parentElement, clipped = false
      while (p && p !== document.body) {
        const s = getComputedStyle(p)
        if (s.overflowX !== 'visible') { clipped = true; break }
        p = p.parentElement
      }
      if (!clipped && cs.position !== 'fixed')
        out.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), right: Math.round(r.right), w: Math.round(r.width) })
    }
  })
  return out.slice(0, 8)
})()`)

// click a node with a known label
report.clicked = await ev(`(() => {
  const b = [...document.querySelectorAll('#atlas button[aria-label]')].find(el => el.getAttribute('aria-label').includes('RTX 5090')) ||
            document.querySelector('#atlas button[aria-label]')
  if (!b) return null
  b.scrollIntoView({ block: 'center', inline: 'center' })
  b.click()
  return b.getAttribute('aria-label')
})()`)
await sleep(700)
report.panel = await ev(`(() => {
  const d = document.querySelector('[role="dialog"]')
  if (!d) return null
  const b = d.getBoundingClientRect()
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), text: d.innerText.slice(0, 120) }
})()`)
await shot('03-detail')

await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
await scrollTo('#generations')
await shot('04-generations')
await scrollTo('#unit')
await shot('05-unit')
await scrollTo('#resonance')
await shot('06-resonance')
await scrollTo('#china')
await shot('07-china')

// full page tall shot for composition review
await ev(`window.scrollTo(0, 0)`)
await sleep(400)

report.consoleErrors = errors
report.outDir = OUT
console.log(JSON.stringify(report, null, 2))
ws.close()
edge.kill()
