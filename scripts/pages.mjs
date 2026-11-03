// 多页站点的冒烟检查：每个章节的标题、h1、控制台错误、横向溢出，各截一张图。
// Usage: node scripts/pages.mjs [baseUrl] [outDir]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = (process.argv[2] ?? 'http://localhost:5191').replace(/\/$/, '')
const OUT = process.env.OUT ?? 'C:/Users/weidows/.hermes/cache/scratch/atlas-pages'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9343
const ROUTES = ['/', '/atlas', '/charts', '/export', '/ledger', '/about']
mkdirSync(OUT, { recursive: true })

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

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      if (r.ok) return (await r.json())[0]
    } catch {}
    await sleep(250)
  }
  throw new Error('no CDP target')
}

const first = await target()
const created = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
).json()
const ws = new WebSocket(created.webSocketDebuggerUrl ?? first.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
let errors = []
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
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.value
}

const report = []
for (const route of ROUTES) {
  errors = []
  await send('Page.navigate', { url: BASE + route })
  await sleep(1400)
  const probe = await ev(`(() => {
    const h1 = document.querySelector('main h1')
    const vw = document.documentElement.clientWidth
    const wide = [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 60 || r.height < 10) return false
      if (r.right <= vw + 2) return false
      let p = el.parentElement
      while (p && p !== document.body) {
        if (getComputedStyle(p).overflowX !== 'visible') return false
        p = p.parentElement
      }
      return true
    }).slice(0, 4).map((el) => el.tagName + '.' + String(el.className).slice(0, 32))
    return {
      title: document.title,
      h1: h1 ? h1.innerText.replace(/\\s+/g, ' ').slice(0, 40) : null,
      h1count: document.querySelectorAll('h1').length,
      bodyH: Math.round(document.documentElement.scrollHeight),
      navActive: document.querySelector('nav a[aria-current="page"]')?.textContent ?? null,
      wide,
    }
  })()`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${route === '/' ? 'cover' : route.slice(1)}.png`, Buffer.from(shot.data, 'base64'))
  report.push({ route, ...probe, consoleErrors: [...errors] })
}

// 客户端导航 + 返回键：从封面点「进入时间轴」，再 back 回首屏
await send('Page.navigate', { url: BASE + '/' })
await sleep(1000)
const nav = await ev(`(async () => {
  const a = [...document.querySelectorAll('a')].find((el) => el.getAttribute('href')?.endsWith('/atlas'))
  if (!a) return { ok: false }
  a.click()
  await new Promise((r) => setTimeout(r, 800))
  const after = { path: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null }
  history.back()
  await new Promise((r) => setTimeout(r, 800))
  return { ok: true, after, back: { path: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null } }
})()`)

// 直接命中深层链接（200 的静态入口）
errors = []
await send('Page.navigate', { url: BASE + '/ledger/' })
await sleep(1200)
const deep = await ev(`({ path: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null })`)

console.log(JSON.stringify({ report, nav, deepLink: deep, deepErrors: errors, out: OUT }, null, 2))
ws.close()
edge.kill()
