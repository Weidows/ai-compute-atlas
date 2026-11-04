#!/usr/bin/env node
/**
 * 多页 SPA 的静态入口。
 *
 * 客户端路由（/atlas /charts /export /ledger /about）没有实体文件，直接访问会 404。
 * 构建后为每个章节生成 dist/<route>/index.html：200 状态、各自独立的
 * title/description/canonical，应用仍由同一份 JS 启动后按 pathname 渲染。
 * 另外写一份 dist/404.html 兜底未知路径（GitHub Pages 会伺服它）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const INDEX = resolve(DIST, 'index.html')
const SITE = (process.env.SITE_URL || 'https://ai-compute-atlas.weidows.tech').replace(/\/$/, '')

const ROUTES = [
  {
    path: 'atlas',
    title: '全景时间轴 · 算力全景',
    desc: '架构世代、芯片 SKU、整机与超节点、开源模型与技术突破压在同一条 2010-2026 时间轴上，点节点看档案。',
  },
  {
    path: 'charts',
    title: '读数：算力怎么变便宜 · 算力全景',
    desc: '代际跃迁、单位算力价格、模型与显存的年度共振：三张图看清算力怎么变便宜。',
  },
  {
    path: 'stack',
    title: '产业链五层配套 · 算力全景',
    desc: '存储、互联、供电散热、制程、集群：算力之外的配套能力，每条带来源。',
  },
  {
    path: 'export',
    title: '中国特供 GPU · 算力全景',
    desc: '出口管制下被削掉的那几刀：8 款中国特供型号的规格、首发时间与各自削减点。',
  },
  {
    path: 'ledger',
    title: '复核台账 · 算力全景',
    desc: '数据由人工抓取整理，逐条记录核对次数与最近复核时间；0 次即未复核。',
  },
  {
    path: 'about',
    title: '口径与来源 · 算力全景',
    desc: '三份原始资料、字段口径、已知边界，以及文本版与机器可读快照的入口。',
  },
]

if (!existsSync(INDEX)) {
  console.error('dist/index.html 不存在，先跑 vite build')
  process.exit(1)
}

const base = readFileSync(INDEX, 'utf8')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** 替换某个 <meta> 标签里的 content，不改其它属性。 */
function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta\\s+${attr}="${key}"[\\s\\S]*?>`)
  const tag = html.match(re)
  if (!tag) return html
  const next = tag[0].replace(/content="[\s\S]*?"/, `content="${esc(value)}"`)
  return html.replace(tag[0], next)
}

function setCanonical(html, url) {
  const re = /<link\s+rel="canonical"[\s\S]*?>/
  const tag = html.match(re)
  if (!tag) return html
  return html.replace(tag[0], `<link rel="canonical" href="${esc(url)}" />`)
}

for (const r of ROUTES) {
  const url = `${SITE}/${r.path}/`
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`)
    .replace(/(<meta\s+property="og:type"\s+content=")website(")/, '$1article$2')
  html = setMeta(html, 'name', 'description', r.desc)
  html = setMeta(html, 'property', 'og:title', r.title)
  html = setMeta(html, 'property', 'og:description', r.desc)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', r.title)
  html = setMeta(html, 'name', 'twitter:description', r.desc)
  html = setCanonical(html, url)

  const dir = resolve(DIST, r.path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html, 'utf8')
}

copyFileSync(INDEX, resolve(DIST, '404.html'))
console.log(`SPA routes: ${ROUTES.map((r) => '/' + r.path).join(' ')} · 404.html`)
