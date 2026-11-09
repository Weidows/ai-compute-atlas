// 时间轴交互验收：整页高度、Shift+滚轮横移、拖拽平移、拖拽后不误开档案、单击仍能开档案。
// Usage: node scripts/atlas-pan.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = (process.argv[2] ?? 'http://localhost:5191').replace(/\/$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9355
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/atlas-pan'

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--window-size=1440,900',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${OUT}/profile`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/list`)).ok) break
  } catch {}
  await sleep(250)
}
const created = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
).json()
const ws = new WebSocket(created.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id
    pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: BASE + '/atlas' })
await sleep(1500)

const fit = await ev(`(() => {
  const el = document.querySelector('#atlas .no-bar')
  const r = el.getBoundingClientRect()
  return {
    viewportH: window.innerHeight,
    docH: document.documentElement.scrollHeight,
    pageScroll: document.documentElement.scrollHeight - window.innerHeight,
    plot: { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) },
    scrollW: el.scrollWidth,
    scrollLeft: el.scrollLeft,
    footerInMain: !!document.querySelector('main footer'),
  }
})()`)

// 滚轮（Shift）
const wheelStart = await ev(`document.querySelector('#atlas .no-bar').scrollLeft`)
await send('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: 900,
  y: 480,
  deltaX: 0,
  deltaY: 240,
  modifiers: 8,
  pointerType: 'mouse',
})
await sleep(400)
const wheelEnd = await ev(`document.querySelector('#atlas .no-bar').scrollLeft`)

// 普通滚轮（页面已不需要竖滚，应转为横向）
await send('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: 900,
  y: 480,
  deltaX: 0,
  deltaY: -240,
  modifiers: 0,
  pointerType: 'mouse',
})
await sleep(400)
const plainEnd = await ev(`document.querySelector('#atlas .no-bar').scrollLeft`)

// 拖拽平移
const before = await ev(`document.querySelector('#atlas .no-bar').scrollLeft`)
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 470, button: 'left', clickCount: 1 })
for (let i = 1; i <= 6; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600 + i * 40, y: 470, button: 'left', buttons: 1 })
  await sleep(30)
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 840, y: 470, button: 'left', clickCount: 1 })
await sleep(400)
const afterDrag = await ev(`({
  scrollLeft: document.querySelector('#atlas .no-bar').scrollLeft,
  panelOpen: !!document.querySelector('.hud-panel.fixed'),
})`)

// 单击仍然要能开档案
const clickTest = await ev(`(() => {
  const btn = [...document.querySelectorAll('#atlas .no-bar button.rounded-full')].find((b) => {
    const r = b.getBoundingClientRect()
    return r.width >= 8 && r.width <= 26 && r.left > 200 && r.right < window.innerWidth - 40 && r.top > 200
  })
  if (!btn) return { ok: false }
  const r = btn.getBoundingClientRect()
  return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: btn.getAttribute('aria-label') }
})()`)
if (clickTest.ok) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickTest.x, y: clickTest.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickTest.x, y: clickTest.y, button: 'left', clickCount: 1 })
  await sleep(600)
}
const afterClick = await ev(`({
  panelOpen: !!document.querySelector('.hud-panel.fixed'),
  h: document.documentElement.scrollHeight,
})`)

console.log(
  JSON.stringify(
    { fit, wheel: { start: wheelStart, end: wheelEnd }, plainWheelEnd: plainEnd, drag: { before, ...afterDrag }, clickTest, afterClick },
    null,
    2,
  ),
)
ws.close()
edge.kill()
