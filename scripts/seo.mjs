#!/usr/bin/env node
/**
 * Static SEO surface for the atlas.
 *
 * The React app is client-rendered, so crawlers that do not execute JS see an
 * empty #root. This script emits real, data-backed HTML pages into `public/`:
 *   /data/                  full tables (154 SKUs, 84 models, 15 systems)
 *   /generations/<slug>/    one page per architecture
 *   /models/<org>/          one page per lab
 *   /china/                 the export-control SKUs
 * plus sitemap.xml, robots.txt and a fetchable copy of the snapshot.
 *
 * Everything is derived from src/data/atlas.json — no hand-written facts.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const atlas = JSON.parse(
  (await import('node:fs')).readFileSync(resolve(ROOT, 'src/data/atlas.json'), 'utf8'),
)

const SITE = (process.env.SITE_URL || 'https://blog.weidows.tech').replace(/\/$/, '')
const BASE = `/${(process.env.SITE_BASE || '/ai-compute-atlas/').replace(/^\/|\/$/g, '')}/`
const SNAPSHOT = atlas.generatedAt

const abs = (p = '') => `${SITE}${BASE}${p}`
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const n = (v, d = 0) => (v === null || v === undefined ? '—' : Number(v).toFixed(d).replace(/\.0$/, ''))
const cny = (v) => (!v ? '—' : v >= 1e8 ? `¥${(v / 1e8).toFixed(2)} 亿` : `¥${(v / 1e4).toFixed(1)} 万`)

const ARCH_SLUG = {
  Blackwell: 'blackwell',
  Hopper: 'hopper',
  'Ada Lovelace': 'ada-lovelace',
  Ampere: 'ampere',
  Turing: 'turing',
  Volta: 'volta',
  Pascal: 'pascal',
  Maxwell: 'maxwell',
  Kepler: 'kepler',
  Fermi: 'fermi',
}
const ORG_SLUG = { 'deepseek-ai': 'deepseek', 'zai-org': 'glm', moonshotai: 'kimi' }
const TIER_LABEL = {
  datacenter: '数据中心',
  workstation: '专业工作站',
  consumer: '消费级',
  semi: '半专业',
  other: '其他',
}

const CSS = `
:root{--void:#04060b;--hull:#0b1322;--edge:#1c2a44;--cyan:#38e2ff;--fog:#8b9dbd;--snow:#e9f2ff;--amber:#ffb545;--violet:#9270ff}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--snow);font:14px/1.7 "Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
header.site{position:sticky;top:0;z-index:5;display:flex;gap:16px;align-items:center;justify-content:space-between;
  padding:10px 20px;background:rgba(4,6,11,.9);border-bottom:1px solid var(--edge);backdrop-filter:blur(8px)}
header.site .brand{font-weight:600;letter-spacing:.06em;color:var(--snow)}
header.site nav{display:flex;gap:14px;font-size:12px;color:var(--fog)}
main{max-width:1160px;margin:0 auto;padding:28px 20px 60px}
.crumb{font-size:11px;color:var(--fog);margin-bottom:10px}
.crumb a{color:var(--fog)}
h1{font-size:26px;line-height:1.25;margin:0 0 10px;letter-spacing:.01em}
h2{font-size:16px;margin:32px 0 10px;padding-left:8px;border-left:2px solid var(--cyan)}
.lead{color:var(--fog);max-width:760px}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 8px}
.kpi{border:1px solid var(--edge);background:var(--hull);padding:8px 12px;min-width:120px}
.kpi b{display:block;font-size:17px;color:var(--snow)}
.kpi span{font-size:10px;color:var(--fog);letter-spacing:.12em;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:10px 0 6px;font-size:12px}
th,td{padding:6px 8px;border-bottom:1px solid rgba(28,42,68,.7);text-align:left;vertical-align:top}
th{color:var(--fog);font-weight:500;font-size:10px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
tbody tr:hover{background:rgba(11,19,34,.7)}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.tag{display:inline-block;font-size:9px;padding:1px 5px;border:1px solid var(--edge);color:var(--fog);white-space:nowrap}
.tag.cn{border-color:rgba(255,181,69,.6);color:var(--amber)}
.pager{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.pager a{border:1px solid var(--edge);padding:3px 8px;font-size:11px;color:var(--fog)}
.pager a[aria-current]{color:var(--cyan);border-color:rgba(56,226,255,.6)}
.note{font-size:11px;color:var(--fog);border-left:2px solid var(--edge);padding-left:10px;margin:14px 0}
footer.site{border-top:1px solid var(--edge);color:var(--fog);font-size:11px;padding:18px 20px;max-width:1160px;margin:0 auto}
@media(max-width:640px){h1{font-size:21px}td,th{padding:5px 5px}}
`

const nav = (current) => `
<header class="site">
  <a class="brand" href="${BASE}">◈ 算力全景 · AI Compute Atlas</a>
  <nav>
    <a href="${BASE}">交互全景</a>
    <a href="${BASE}data/">数据总表</a>
    <a href="${BASE}china/"${current === 'china' ? ' aria-current="page"' : ''}>中国特供</a>
  </nav>
</header>`

function page({ path, title, description, body, jsonld, h1, crumb }) {
  const url = path ? abs(path) : abs()
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:locale" content="zh_CN">
<meta property="og:site_name" content="算力全景 · AI Compute Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs('og.png')}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
${nav()}
<main>
<nav class="crumb">${crumb.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join(' › ')}</nav>
<h1>${esc(h1)}</h1>
${body}
</main>
<footer class="site">
  数据快照 ${SNAPSHOT} · 产品规格来自《NVIDIA 显卡历代产品全览》，行情来自 gpu-server-compare，模型数据来自 Hugging Face 官方 API ·
  <a href="${BASE}">返回交互版</a>
</footer>
</body>
</html>`
}

const products = atlas.products
const extras = atlas.extras
const models = atlas.models

function productTable(rows) {
  if (!rows.length) return '<p class="note">该分组没有收录型号。</p>'
  return `<table>
<thead><tr><th>型号</th><th>层级</th><th>CUDA</th><th>显存</th><th>FP32</th><th>首发</th><th>备注</th></tr></thead>
<tbody>
${rows
  .map(
    (p) => `<tr>
<td>${esc(p.name)}${p.china ? ' <span class="tag cn">中国特供</span>' : ''}${p.source !== 'docx' ? ` <span class="tag">${esc(p.brand)}</span>` : ''}</td>
<td>${esc(TIER_LABEL[p.tier] ?? p.category)}</td>
<td class="num">${p.cuda ? esc(n(p.cuda)) : '—'}</td>
<td>${esc(p.vramLabel ?? '—')}</td>
<td class="num">${p.fp32 ? `${n(p.fp32, 1)} TF` : '—'}</td>
<td class="num">${esc(p.dateText || p.date.slice(0, 7))}</td>
<td>${esc((p.note || '').slice(0, 120))}</td>
</tr>`,
  )
  .join('\n')}
</tbody></table>`
}

/* ------------------------------------------------------------------ *
 *  /generations/<slug>/
 * ------------------------------------------------------------------ */
const archOrder = atlas.archs.filter((a) => a.count > 0)
for (const arch of archOrder) {
  const slug = ARCH_SLUG[arch.name]
  if (!slug) continue
  const rows = products.filter((p) => p.arch === arch.name)
  const dc = rows.filter((p) => p.tier === 'datacenter')
  const peak = Math.max(0, ...dc.map((p) => p.fp32 ?? 0))
  const vram = Math.max(0, ...rows.map((p) => p.vramPerGpuGb ?? p.vramGb ?? 0))
  const cn = rows.filter((p) => p.china)
  const dates = rows.map((p) => p.date).sort()
  const from = dates[0]?.slice(0, 7)
  const to = dates[dates.length - 1]?.slice(0, 7)
  const near = models.filter((m) => m.date >= (arch.first ?? '2099') && m.date <= (arch.last ?? '2000'))
  const idx = archOrder.findIndex((a) => a.name === arch.name)
  const prev = archOrder[idx - 1]
  const next = archOrder[idx + 1]
  const title = `${arch.name} 架构显卡全表（${arch.years}）｜${rows.length} 款产品规格与算力`
  const description = `${arch.name} 世代 ${rows.length} 款 NVIDIA 产品：数据中心卡 FP32 峰值 ${peak ? n(peak, 1) : '未公开'} TFLOPS、单卡显存最高 ${vram || '—'} GB${cn.length ? `，含 ${cn.length} 款中国特供` : ''}。按层级列出型号、CUDA 核心、显存、首发时间与削减点。`
  const body = `
<p class="lead">${esc(arch.name)}（${esc(arch.years)}）在文档中收录 <b>${rows.length}</b> 款产品，其中数据中心卡 ${dc.length} 款、专业工作站 ${rows.filter((p) => p.tier === 'workstation').length} 款、消费级 ${rows.filter((p) => p.tier === 'consumer').length} 款。该世代的主要技术特征是 ${esc(arch.tech)}。</p>
<div class="kpis">
  <div class="kpi"><b>${rows.length}</b><span>收录型号</span></div>
  <div class="kpi"><b>${peak ? n(peak, 1) : '—'}</b><span>FP32 峰值 TFLOPS</span></div>
  <div class="kpi"><b>${vram || '—'}</b><span>单卡显存 GB</span></div>
  <div class="kpi"><b>${cn.length}</b><span>中国特供</span></div>
  <div class="kpi"><b>${esc(from ?? '—')} → ${esc(to ?? '—')}</b><span>首发区间</span></div>
</div>
<div class="pager">
${archOrder.map((a) => `<a href="${BASE}generations/${ARCH_SLUG[a.name]}/"${a.name === arch.name ? ' aria-current="page"' : ''}>${esc(a.name)}</a>`).join('\n')}
</div>
<h2>${esc(arch.name)} 产品全表</h2>
${productTable(rows)}
${cn.length ? `<h2>中国特供版本</h2>${productTable(cn)}` : ''}
${near.length ? `<h2>同期开源模型（${esc(near[0].date.slice(0, 7))} 起）</h2>
<ul>${near.slice(0, 8).map((m) => `<li>${esc(m.date)} · ${esc(m.name)}（${esc(m.orgName)}，${esc(m.totalParams ?? '参数量未公开')}）</li>`).join('')}</ul>` : ''}
<p class="note">口径：FP32 标「约」的为按 CUDA 核心 × 2 × Boost 估算；数据中心卡张量算力按稀疏值记录，约为稠密 2 倍。跨架构的浮点指标不可直接比较。完整字段见 <a href="${BASE}data/">数据总表</a>。</p>
<div class="pager">
  ${prev ? `<a href="${BASE}generations/${ARCH_SLUG[prev.name]}/">← 更早：${esc(prev.name)}</a>` : ''}
  ${next ? `<a href="${BASE}generations/${ARCH_SLUG[next.name]}/">更晚：${esc(next.name)} →</a>` : ''}
  <a href="${BASE}">在时间轴上查看 →</a>
</div>`
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: abs(`generations/${slug}/`),
    isPartOf: { '@type': 'WebSite', name: '算力全景 · AI Compute Atlas', url: abs() },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: rows.length,
      itemListElement: rows.slice(0, 40).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
      })),
    },
  }
  write(`generations/${slug}/index.html`, page({
    path: `generations/${slug}/`,
    title,
    description,
    h1: `${arch.name} 架构：${rows.length} 款产品全表`,
    crumb: [['算力全景', BASE], ['架构世代', `${BASE}data/#arch`], [arch.name, '']],
    body,
    jsonld,
  }))
}

/* ------------------------------------------------------------------ *
 *  /models/<org>/
 * ------------------------------------------------------------------ */
const orgs = atlas.orgs.filter((o) => ORG_SLUG[o.id])
for (const org of orgs) {
  const slug = ORG_SLUG[org.id]
  const rows = models.filter((m) => m.org === org.id).sort((a, b) => b.date.localeCompare(a.date))
  const bts = atlas.breakthroughs.filter((b) => b.org === org.id)
  const maxParams = Math.max(0, ...rows.map((m) => m.paramsB ?? 0))
  const title = `${org.name} 开源模型编年（${rows[rows.length - 1]?.date.slice(0, 7)}—${rows[0]?.date.slice(0, 7)}）｜${rows.length} 个发布`
  const description = `${org.name} 在 Hugging Face 公开的 ${rows.length} 个模型发布与 ${bts.length} 项技术突破：参数量、上下文、许可、官方测评与下载量，按时间倒序，数据来自 HF 官方 API 快照。`
  const body = `
<p class="lead">${esc(org.blurb)}</p>
<div class="kpis">
  <div class="kpi"><b>${rows.length}</b><span>发布节点</span></div>
  <div class="kpi"><b>${bts.length}</b><span>技术突破</span></div>
  <div class="kpi"><b>${maxParams ? `${maxParams}B` : '—'}</b><span>最大参数量</span></div>
  <div class="kpi"><b>${esc(org.short)}</b><span>实验室</span></div>
</div>
<h2>发布年表</h2>
<table><thead><tr><th>日期</th><th>模型</th><th>参数</th><th>上下文</th><th>许可</th><th>测评</th><th>近 30 天下载</th></tr></thead><tbody>
${rows
  .map(
    (m) => `<tr>
<td class="num">${esc(m.date)}</td>
<td>${esc(m.name)}</td>
<td class="num">${esc(m.totalParams ?? '未公开')}${m.paramsSource === 'inferred' ? ' <span class="tag">推定</span>' : ''}</td>
<td>${esc(m.contextLength ?? '—')}</td>
<td>${esc(m.license ?? '—')}</td>
<td>${m.headline ? `${esc(m.headline.metric)} ${m.headline.score}` : '—'}</td>
<td class="num">${m.downloads ? m.downloads.toLocaleString('en-US') : '—'}</td>
</tr>`,
  )
  .join('\n')}
</tbody></table>
${bts.length ? `<h2>技术突破</h2>
<table><thead><tr><th>时间</th><th>缩写</th><th>名称</th><th>环节</th><th>幅度</th></tr></thead><tbody>
${bts
  .map(
    (b) => `<tr><td class="num">${esc(b.date)}</td><td>${esc(b.label)}</td><td>${esc(b.name)}</td><td>${esc(b.lane)}</td><td>${esc(b.magnitude ?? '—')}</td></tr>`,
  )
  .join('\n')}
</tbody></table>` : ''}
<p class="note">下载量为 Hugging Face 报告的滚动 30 天口径；模型卡未标注的字段一律留空，不做推测。</p>
<div class="pager">
  ${orgs.map((o) => `<a href="${BASE}models/${ORG_SLUG[o.id]}/"${o.id === org.id ? ' aria-current="page"' : ''}>${esc(o.short)}</a>`).join('\n')}
  <a href="${BASE}">在时间轴上查看 →</a>
</div>`
  write(`models/${slug}/index.html`, page({
    path: `models/${slug}/`,
    title,
    description,
    h1: `${org.name}：${rows.length} 个开源发布`,
    crumb: [['算力全景', BASE], ['开源模型', `${BASE}data/#models`], [org.short, '']],
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: abs(`models/${slug}/`),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: rows.length,
        itemListElement: rows.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name })),
      },
    },
  }))
}

/* ------------------------------------------------------------------ *
 *  /china/
 * ------------------------------------------------------------------ */
{
  const rows = products.filter((p) => p.china).sort((a, b) => a.date.localeCompare(b.date))
  const title = `中国特供 GPU 全表（${rows.length} 款）｜A800、H800、H20、4090D、5090D、6000D`
  const description = `出口管制下的 ${rows.length} 款 NVIDIA 中国特供型号：A800、H800、H20、L20、RTX 4090D、RTX 5090D、RTX 5090D V2、RTX 6000D 的规格、首发时间与原版差异。`
  const body = `
<p class="lead">受出口管制影响，NVIDIA 面向中国大陆推出多款削减规格的特供产品。下表 ${rows.length} 款的削减点全部来自《NVIDIA 显卡历代产品全览》原文的「类别 / 备注」字段，未做补充推断。</p>
<table><thead><tr><th>型号</th><th>层级</th><th>首发</th><th>显存</th><th>FP32</th><th>相对原版</th></tr></thead><tbody>
${rows
  .map(
    (p) => `<tr><td>${esc(p.name)}</td><td>${esc(TIER_LABEL[p.tier])}</td><td class="num">${esc(p.dateText || p.date)}</td><td>${esc(p.vramLabel ?? '—')}</td><td class="num">${p.fp32 ? `${n(p.fp32, 1)} TF` : '—'}</td><td>${esc(p.note || '—')}</td></tr>`,
  )
  .join('\n')}
</tbody></table>
<p class="note">特供版与全球版的差异不只在算力：NVLink 带宽、显存容量、PCIe 形态与供货状态都可能被单独约束，采购前应以当时生效的管制条款与厂商规格书为准。</p>
<div class="pager"><a href="${BASE}">在时间轴上查看 →</a><a href="${BASE}data/">完整数据总表</a></div>`
  write('china/index.html', page({
    path: 'china/',
    title,
    description,
    h1: `中国特供 GPU：${rows.length} 款与被削掉的规格`,
    crumb: [['算力全景', BASE], ['中国特供', '']],
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: rows.length,
      itemListElement: rows.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name })),
    },
  }))
}

/* ------------------------------------------------------------------ *
 *  /data/
 * ------------------------------------------------------------------ */
{
  const byArch = archOrder.map((a) => ({ arch: a, rows: products.filter((p) => p.arch === a.name) }))
  const title = `完整数据总表：${products.length} 款 GPU、${models.length} 个开源模型、${atlas.servers.length} 台整机`
  const description = `算力全景的完整文本版数据：${products.length} 款 NVIDIA 产品按世代与层级列表（CUDA、显存、FP32、首发时间），${models.length} 个开源模型发布与 ${atlas.breakthroughs.length} 项技术突破，${atlas.servers.length} 台整机与报价。`
  const body = `
<p class="lead">这一页是交互全景的文本版：同样的快照，拆成可按 Ctrl+F 检索的表格。适合引用、对拍与检索，字段口径与交互版完全一致。</p>
<div class="kpis">
  <div class="kpi"><b>${products.length}</b><span>NVIDIA 产品</span></div>
  <div class="kpi"><b>${extras.length}</b><span>其他厂商</span></div>
  <div class="kpi"><b>${atlas.servers.length}</b><span>整机 / 超节点</span></div>
  <div class="kpi"><b>${models.length}</b><span>开源模型</span></div>
  <div class="kpi"><b>${atlas.breakthroughs.length}</b><span>技术突破</span></div>
</div>
<p class="note">机器可读版本：<a href="${BASE}data/atlas.json">/data/atlas.json</a>（字段与页面同源，UTF-8，可直接 fetch）。</p>
<h2 id="arch">按架构世代</h2>
${byArch
  .map(
    ({ arch, rows }) => `<h3 style="font-size:14px;margin:18px 0 6px">${esc(arch.name)}（${esc(arch.years)}，${rows.length} 款） · <a href="${BASE}generations/${ARCH_SLUG[arch.name]}/">单独查看</a></h3>
${productTable(rows)}`,
  )
  .join('\n')}
<h2 id="models">开源模型发布</h2>
<table><thead><tr><th>日期</th><th>模型</th><th>实验室</th><th>参数</th><th>上下文</th><th>许可</th><th>下载（30 天）</th></tr></thead><tbody>
${[...models]
  .sort((a, b) => b.date.localeCompare(a.date))
  .map(
    (m) => `<tr><td class="num">${esc(m.date)}</td><td>${esc(m.name)}</td><td>${esc(m.orgName)}</td><td class="num">${esc(m.totalParams ?? '未公开')}</td><td>${esc(m.contextLength ?? '—')}</td><td>${esc(m.license ?? '—')}</td><td class="num">${m.downloads ? m.downloads.toLocaleString('en-US') : '—'}</td></tr>`,
  )
  .join('\n')}
</tbody></table>
<h2>按实验室</h2>
<div class="pager">
${orgs.map((o) => `<a href="${BASE}models/${ORG_SLUG[o.id]}/">${esc(o.name)}（${models.filter((m) => m.org === o.id).length} 个发布）</a>`).join(String.fromCharCode(10))}
</div>
<h2>整机与超节点</h2>
<table><thead><tr><th>名称</th><th>形态</th><th>GPU</th><th>功耗</th><th>报价</th><th>上市口径</th></tr></thead><tbody>
${atlas.servers
  .map(
    (s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.kind === 'supernode' ? '超节点' : '整机')}</td><td class="num">${s.gpuCount}× ${esc(s.gpu)}</td><td class="num">${s.powerKw ? `${s.powerKw} kW` : '—'}</td><td class="num">${s.priceCny ? cny(s.priceCny) : s.priceUsd ? `$${s.priceUsd.toLocaleString('en-US')}` : '—'}</td><td>${esc(s.dateNote)}</td></tr>`,
  )
  .join('\n')}
</tbody></table>
<div class="pager"><a href="${BASE}">返回交互全景 →</a><a href="${BASE}china/">中国特供 →</a></div>`
  write('data/index.html', page({
    path: 'data/',
    title,
    description,
    h1: '完整数据总表',
    crumb: [['算力全景', BASE], ['数据总表', '']],
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'AI 算力产业全景数据快照',
      description,
      url: abs('data/'),
      temporalCoverage: '2010/2026',
      dateModified: SNAPSHOT,
      creator: { '@type': 'Organization', name: 'Weidows', url: 'https://github.com/Weidows' },
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: abs('data/atlas.json'),
        },
      ],
      variableMeasured: ['FP32 TFLOPS', '显存容量', '显存带宽', '功耗', '中国区参考价', '模型参数量'],
    },
  }))
}

/* ------------------------------------------------------------------ *
 *  sitemap / robots / data endpoint
 * ------------------------------------------------------------------ */
const urls = [
  { loc: abs(), priority: '1.0' },
  { loc: abs('data/'), priority: '0.9' },
  { loc: abs('china/'), priority: '0.8' },
  ...archOrder.map((a) => ({ loc: abs(`generations/${ARCH_SLUG[a.name]}/`), priority: '0.8' })),
  ...orgs.map((o) => ({ loc: abs(`models/${ORG_SLUG[o.id]}/`), priority: '0.7' })),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc}</loc><lastmod>${SNAPSHOT}</lastmod><changefreq>monthly</changefreq><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`
writeRaw('sitemap.xml', sitemap)
writeRaw('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`)

mkdirSync(resolve(ROOT, 'public/data'), { recursive: true })
copyFileSync(resolve(ROOT, 'src/data/atlas.json'), resolve(ROOT, 'public/data/atlas.json'))

console.log(`SEO pages: ${urls.length} urls, site ${SITE}, base ${BASE}`)

/* ------------------------------------------------------------------ */
function write(rel, html) {
  const file = resolve(ROOT, 'public', rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html, 'utf8')
}
function writeRaw(rel, text) {
  writeFileSync(resolve(ROOT, 'public', rel), text, 'utf8')
}
