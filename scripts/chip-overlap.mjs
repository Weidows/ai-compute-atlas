// 检查芯片带圆点是否还有重叠、以及每个点能否被 hover 命中。
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const W = Number(process.argv[2] ?? 1440)
const Hh = Number(process.argv[3] ?? 900)
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9371
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/overlap'

const edge = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--window-size=${W},${Hh}`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`, 'about:blank'],
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
await send('Emulation.setDeviceMetricsOverride', { width: W, height: Hh, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://localhost:5191/atlas' })
for (let i = 0; i < 40; i++) {
  if (await ev(`!!document.querySelector('#atlas .no-bar')`)) break
  await sleep(250)
}
await sleep(1000)

const res = await ev(`(() => {
  const plot = document.querySelector('#atlas .no-bar')
  const box = plot.getBoundingClientRect()
  const base = box
  const dots = [...plot.querySelectorAll('button.rounded-full')].map((b) => {
    const r = b.getBoundingClientRect()
    return { name: b.getAttribute('aria-label'), cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, l: r.left, rt: r.right }
  }).filter((d) => d.cy - base.top > 250 && d.cy - base.top < 600)
  const visible = dots.filter((d) => d.l > box.left + 4 && d.rt < box.right - 4)
  // 真正测 hover：点中心能不能命中「自己」这个 button
  const misHover = []
  for (const p of plot.querySelectorAll('button.rounded-full')) {
    const r = p.getBoundingClientRect()
    if (r.left <= box.left + 4 || r.right >= box.right - 4) continue
    if (r.top - box.top < 250 || r.top - box.top > 600) continue
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (hit !== p) misHover.push([p.getAttribute('aria-label'), hit?.getAttribute?.('aria-label') ?? hit?.tagName])
  }
  const stats = (arr) => {
    let overlaps = 0, unhoverable = 0
    const bad = []
    const badPairs = []
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j]
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy)
      if (d < a.r + b.r) { overlaps++; badPairs.push([a.name, b.name, Math.round(d-(a.r+b.r))]); if (d < Math.max(a.r, b.r) + 3) { unhoverable++; bad.push([a.name, b.name, Math.round(d), Math.round(Math.max(a.r,b.r))]) } }
    }
    return { n: arr.length, overlaps, unhoverable, samples: bad.slice(0, 6), tightest: badPairs.sort((x,y)=>x[2]-y[2]).slice(0,6) }
  }
  return { all: stats(dots), visible: stats(visible), misHover: misHover.slice(0, 8), misHoverCount: misHover.length }
})()`)

const fs = await import('node:fs')
const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(`${OUT}/chip-${W}x${Hh}.png`, Buffer.from(shot.data, 'base64'))
console.log(JSON.stringify(res, null, 2))
ws.close()
edge.kill()
