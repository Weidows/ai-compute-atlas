// Focused atlas probe: clip screenshots + label/dot collision counts.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.argv[2] ?? 'http://localhost:5191/atlas'
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/atlas-probe'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9347
mkdirSync(OUT, { recursive: true })

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--window-size=1680,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`, 'about:blank'], { stdio: 'ignore' })

async function targets() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); if (r.ok) return r.json() } catch {}
    await sleep(250)
  }
  throw new Error('no targets')
}
await targets()
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
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: URL })
await sleep(2600)
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

await ev(`window.scrollTo({ top: document.querySelector('#atlas').getBoundingClientRect().top + scrollY - 60, behavior: 'instant' })`)
await sleep(800)

const box = await ev(`(() => { const b = document.querySelector('#atlas .hud-panel').getBoundingClientRect();
  return { x: Math.round(b.x + scrollX), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) } })()`)
const shot = async (name, clip) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'))
}
await shot('atlas-full', { x: box.x, y: box.y, width: box.w, height: box.h })
// left third / right two thirds as crops for readable review
await shot('atlas-left', { x: box.x, y: box.y, width: Math.round(box.w * 0.42), height: box.h })
await shot('atlas-right', { x: box.x + Math.round(box.w * 0.38), y: box.y, width: Math.round(box.w * 0.62), height: box.h })

await shot('strip', { x: box.x, y: box.y + box.h + 8, width: box.w, height: 74 })

await shot('band-sys', { x: box.x, y: box.y + 596, width: box.w, height: 130 })
await shot('band-models', { x: box.x, y: box.y + 724, width: box.w, height: 140 })
await shot('band-bt', { x: box.x, y: box.y + 850, width: box.w, height: 120 })

const probe = await ev(`(() => {
  const labels = [...document.querySelectorAll('#atlas span')].filter(s => s.className.includes('font-mono') && s.offsetWidth > 10)
  const dots = [...document.querySelectorAll('#atlas button[aria-label]')]
  const r = (el) => el.getBoundingClientRect()
  const inter = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    return w > 0 && h > 0 ? w * h : 0
  }
  let labelLabel = 0, labelDot = 0
  const samples = []
  for (let i = 0; i < labels.length; i++) {
    const a = r(labels[i])
    for (let j = i + 1; j < labels.length; j++) {
      const b = r(labels[j])
      const area = inter(a, b)
      if (area > 24) { labelLabel++; if (samples.length < 5) samples.push([labels[i].textContent, labels[j].textContent, Math.round(area)]) }
    }
    for (const d of dots) {
      const b = r(d)
      if (b.width > 24) continue
      if (inter(a, b) > 8) { labelDot++; break }
    }
  }
  const bands = [24, 88, 276, 416, 596, 724, 856, 914].map((top, i) => {
    const n = dots.filter((d) => { const b = r(d); return b.top >= top - 10 && b.top < top + 80 }).length
    return { band: i, nodes: n }
  })
  return {
    stripChildren: document.querySelector('#atlas .cursor-crosshair')?.querySelectorAll('span').length ?? 0,
    bands,
    labels: labels.length, dots: dots.length,
    labelLabelOverlaps: labelLabel, labelOnDot: labelDot, samples,
    scrollLeft: document.querySelector('#atlas .no-bar')?.scrollLeft,
    fontSize: labels[0] ? getComputedStyle(labels[0]).fontSize : null,
  }
})()`)
console.log(JSON.stringify({ box, probe }, null, 2))
ws.close()
edge.kill()
