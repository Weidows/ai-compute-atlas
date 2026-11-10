// 分辨率自适应验收：2K / FHD / 笔记本 三档下量测缩放系数、页面高度、横向铺满程度。
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = (process.argv[2] ?? 'http://localhost:5191').replace(/\/$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9364
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/atlas-zoom'
const SIZES = [
  { name: '2k', w: 2560, h: 1440 },
  { name: 'fhd', w: 1920, h: 1080 },
  { name: 'laptop', w: 1440, h: 900 },
  { name: 'small', w: 1280, h: 720 },
]

const edge = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`, 'about:blank'],
  { stdio: 'ignore' },
)
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/list`)).ok) break
  } catch {}
  await sleep(250)
}
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r, j) => {
  ws.onopen = r
  ws.onerror = j
})
let id = 0
const p = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && p.has(m.id)) {
    p.get(m.id)(m)
    p.delete(m.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id
    p.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
const ev = async (ex) => (await send('Runtime.evaluate', { expression: ex, returnByValue: true, awaitPromise: true })).result?.value

await send('Page.enable')
await send('Runtime.enable')

const out = []
for (const s of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/atlas' })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('#atlas .no-bar')`)) break
    await sleep(250)
  }
  await sleep(900)
  const m = await ev(`(() => {
    const sec = document.querySelector('#atlas')
    const plot = document.querySelector('#atlas .no-bar')
    const cs = getComputedStyle(sec)
    const fontPx = parseFloat(getComputedStyle(document.querySelector('#atlas .no-bar span.font-mono') || sec).fontSize) || 0
    return {
      zoom: cs.zoom,
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
      pageScroll: document.documentElement.scrollHeight - window.innerHeight,
      sectionVisualH: Math.round(sec.getBoundingClientRect().height),
      plotVisualH: Math.round(plot.getBoundingClientRect().height),
      yearsVisible: +(plot.clientWidth / (parseFloat((document.querySelector('#atlas .num')?.textContent || '0')) || 1)).toFixed(1),
      pxPerYear: document.querySelector('#atlas .num')?.textContent?.trim(),
      fontPx,
    }
  })()`)
  out.push({ name: s.name, ...s, ...m })
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const fs = await import('node:fs')
  fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(shot.data, 'base64'))
}
console.log(JSON.stringify(out, null, 2))
ws.close()
edge.kill()
