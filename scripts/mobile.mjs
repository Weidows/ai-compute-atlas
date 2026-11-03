// Mobile + copy audit: viewport overflow at 390/768, key labels, KPI values.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.argv[2] ?? 'http://localhost:5178/'
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/atlas-mobile'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9351
mkdirSync(OUT, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`, 'about:blank'], { stdio: 'ignore' })
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/list`)).ok) break } catch {}
  await sleep(250)
}
const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })).json()
const ws = new WebSocket(created.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)))
  ws.send(JSON.stringify({ id: mid, method, params }))
})
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: URL })
await sleep(2600)

const out = []
for (const [w, h, name] of [[390, 844, 'mobile'], [768, 1024, 'tablet'], [1440, 900, 'laptop']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
  await sleep(700)
  const probe = await ev(`(() => {
    const doc = document.documentElement
    const wide = []
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 8) return
      if (r.right > doc.clientWidth + 2) {
        let p = el.parentElement, clipped = false
        while (p && p !== document.body) { if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break } p = p.parentElement }
        if (!clipped) wide.push({ tag: el.tagName, cls: String(el.className).slice(0, 30), right: Math.round(r.right) })
      }
    })
    return {
      docW: doc.clientWidth,
      scrollW: doc.scrollWidth,
      wide: wide.slice(0, 6),
      panel: (() => { const p = document.querySelector('#atlas .hud-panel'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width) } })(),
    }
  })()`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(shot.data, 'base64'))
  out.push({ name, ...probe })
}

const copy = await ev(`(() => ({
  nav: [...document.querySelectorAll('header a')].map(a => a.innerText.trim()).filter(Boolean),
  kpis: [...document.querySelectorAll('section')][0].innerText.replace(/\\n+/g, ' | ').slice(0, 400),
  layers: [...document.querySelectorAll('section a[href="#atlas"] span')].map(s => s.innerText.trim()).filter(Boolean).slice(0, 12)
}))()`)
console.log(JSON.stringify({ widths: out, copy }, null, 2))
ws.close(); edge.kill()
