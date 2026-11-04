// 多页站点在 390 / 768 / 1440 三档下的横向溢出与首屏检查，外加移动端菜单开关。
// Usage: node scripts/mobile.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = (process.argv[2] ?? 'http://localhost:5191').replace(/\/$/, '')
const ROUTES = ['/', '/atlas', '/charts', '/stack', '/export', '/ledger', '/about']
const OUT = 'C:/Users/weidows/.hermes/cache/scratch/atlas-mobile'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9351
mkdirSync(OUT, { recursive: true })

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
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

const report = []
for (const route of ROUTES) {
  const widths = []
  for (const [w, h, name] of [
    [390, 844, 'mobile'],
    [768, 1024, 'tablet'],
    [1440, 900, 'laptop'],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await send('Page.navigate', { url: BASE + route })
    await sleep(1100)
    const probe = await ev(`(() => {
      const doc = document.documentElement
      const wide = []
      document.querySelectorAll('main *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width < 40) return
        if (r.right > doc.clientWidth + 2) {
          let p = el.parentElement, clipped = false
          while (p && p !== document.body) { if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break } p = p.parentElement }
          if (!clipped) wide.push(el.tagName + '.' + String(el.className).slice(0, 28))
        }
      })
      const nav = document.querySelector('nav[aria-label="主导航"]')
      return {
        docW: doc.clientWidth,
        scrollW: doc.scrollWidth,
        wide: wide.slice(0, 5),
        desktopNav: nav ? getComputedStyle(nav).display !== 'none' : false,
        menuButton: !!document.querySelector('button[aria-label="打开菜单"]'),
      }
    })()`)
    widths.push({ name, ...probe })
    if (w === 390) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${OUT}/${route === '/' ? 'cover' : route.slice(1)}-mobile.png`, Buffer.from(shot.data, 'base64'))
    }
  }
  report.push({ route, widths })
}

// 移动端菜单：打开 → 有链接 → 点一条 → 路由变化
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Page.navigate', { url: BASE + '/' })
await sleep(1100)
const menu = await ev(`(async () => {
  const btn = document.querySelector('button[aria-label="打开菜单"]')
  if (!btn) return { ok: false }
  btn.click()
  await new Promise((r) => setTimeout(r, 500))
  const overlay = document.querySelector('nav[aria-label="移动端导航"]')
  const links = overlay ? overlay.querySelectorAll('a').length : 0
  const before = location.pathname
  const target = overlay?.querySelector('a[href$="/ledger"]')
  target?.click()
  await new Promise((r) => setTimeout(r, 900))
  return { ok: true, links, before, after: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null }
})()`)

console.log(JSON.stringify({ report, menu }, null, 2))
ws.close()
edge.kill()
