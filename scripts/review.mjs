#!/usr/bin/env node
/**
 * 复核台账 CLI —— 记录「这条数据被人工核对过几次、最近一次是什么时候」。
 *
 *   npm run review -- stats                        覆盖率汇总
 *   npm run review -- list --unreviewed            列出还没复核的条目
 *   npm run review -- mark blk-rtx5090             记一次复核（日期取今天）
 *   npm run review -- mark blk-rtx5090 --note "对照 NVIDIA 规格页核对显存/功耗"
 *   npm run review -- mark --arch Blackwell --tier datacenter
 *   npm run review -- undo blk-rtx5090             撤销最近一次（计数 -1）
 *
 * 写入 data/reviews.json；atlas.json 由 `npm run data` 重新合并生成。
 * id 必须能在 atlas.json 里找到，避免手滑写出幽灵记录。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ATLAS = resolve(ROOT, 'src/data/atlas.json')
const LEDGER = resolve(ROOT, 'data/reviews.json')

const KINDS = {
  product: 'NVIDIA 产品',
  extra: '其他厂商',
  server: '整机 / 超节点',
  model: '开源模型',
  breakthrough: '技术突破',
}

const atlas = JSON.parse(readFileSync(ATLAS, 'utf8'))
const rows = [
  ...atlas.products.map((r) => ({ ...r, kind: 'product' })),
  ...atlas.extras.map((r) => ({ ...r, kind: 'extra' })),
  ...atlas.servers.map((r) => ({ ...r, kind: 'server' })),
  ...atlas.models.map((r) => ({ ...r, kind: 'model' })),
  ...atlas.breakthroughs.map((r) => ({ ...r, kind: 'breakthrough' })),
]
const byId = new Map(rows.map((r) => [r.id, r]))

const ledger = existsSync(LEDGER)
  ? JSON.parse(readFileSync(LEDGER, 'utf8'))
  : { updatedAt: null, reviewer: null, note: '', items: {} }
ledger.items ??= {}

/* ---------------------------------------------------------------- args */
const argv = process.argv.slice(2)
const cmd = argv[0] ?? 'stats'
const ids = []
const flags = {}
for (let i = 1; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) {
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) flags[key] = true
    else {
      flags[key] = next
      i++
    }
  } else if (cmd === 'mark' || cmd === 'undo' || cmd === 'reset') ids.push(a)
  else if (!flags._) flags._ = a
}

const today = new Date().toISOString().slice(0, 10)
const date = typeof flags.date === 'string' ? flags.date : today
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`--date 需要 YYYY-MM-DD，收到 ${date}`)

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function save() {
  ledger.updatedAt = today
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n', 'utf8')
}

function label(r) {
  const bits = [r.kind, r.id]
  if (flags.verbose) bits.push(`${KINDS[r.kind]} · ${r.name}${r.arch ? ` · ${r.arch}` : ''}`)
  return bits.join('  ')
}

function matches(r) {
  if (flags.kind && r.kind !== flags.kind) return false
  if (flags.arch && r.arch !== flags.arch) return false
  if (flags.tier && r.tier !== flags.tier) return false
  if (typeof flags.year === 'string' && !String(r.date ?? '').startsWith(flags.year)) return false
  return true
}

function reviewOf(id) {
  const e = ledger.items[id]
  return { count: e?.count ?? 0, lastReviewedAt: e?.lastReviewedAt ?? null, note: e?.note ?? null }
}

function pct(a, b) {
  return b ? `${((a / b) * 100).toFixed(0)}%` : '—'
}

/* ---------------------------------------------------------------- cmds */
if (cmd === 'stats') {
  const kinds = Object.keys(KINDS)
  console.log(`复核台账 ${LEDGER.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`)
  console.log(`更新 ${ledger.updatedAt ?? '—'} · 复核人 ${ledger.reviewer ?? '—'}\n`)
  let total = 0
  let reviewed = 0
  const dates = []
  for (const k of kinds) {
    const list = rows.filter((r) => r.kind === k)
    const ok = list.filter((r) => reviewOf(r.id).count > 0)
    for (const r of ok) if (reviewOf(r.id).lastReviewedAt) dates.push(reviewOf(r.id).lastReviewedAt)
    total += list.length
    reviewed += ok.length
    const pad = (s, n) => String(s).padEnd(n, ' ')
    console.log(
      `  ${pad(KINDS[k], 14)} ${pad(`${ok.length}/${list.length}`, 10)} ${pad(pct(ok.length, list.length), 5)} 未复核 ${list.length - ok.length}`,
    )
  }
  console.log(`\n合计 ${reviewed}/${total} 已复核（${pct(reviewed, total)}）`)
  console.log(`最近一次复核：${dates.sort().at(-1) ?? '—'}`)
  const unknown = Object.keys(ledger.items).filter((id) => !byId.has(id))
  if (unknown.length) console.log(`\n⚠ 台账里有 ${unknown.length} 个 id 在快照中已不存在：${unknown.join(', ')}`)
} else if (cmd === 'list') {
  let list = rows.filter(matches)
  if (flags.unreviewed || flags.stale) {
    list = list.filter((r) => {
      const { count, lastReviewedAt } = reviewOf(r.id)
      if (flags.unreviewed && count > 0) return false
      if (typeof flags.stale === 'string') {
        if (!lastReviewedAt) return true
        const days = (Date.parse(today) - Date.parse(lastReviewedAt)) / 86400000
        if (days < Number(flags.stale)) return false
      }
      return true
    })
  }
  list.sort((a, b) => {
    const ca = reviewOf(a.id).count
    const cb = reviewOf(b.id).count
    return ca - cb || String(a.date).localeCompare(String(b.date))
  })
  const limit = Number(flags.limit ?? 60)
  for (const r of list.slice(0, limit)) {
    const { count, lastReviewedAt } = reviewOf(r.id)
    console.log(
      `${(lastReviewedAt ?? '未复核').padEnd(11)} ${String(count + '次').padEnd(4)} ${r.id.padEnd(28)} ${flags.verbose ? (r.name ?? '') : ''}`,
    )
  }
  if (list.length > limit) console.log(`… 还有 ${list.length - limit} 条（--limit 调大或加过滤条件）`)
  console.log(`\n共 ${list.length} 条`)
} else if (cmd === 'mark' || cmd === 'undo') {
  let targets = ids.map((id) => {
    const r = byId.get(id)
    if (!r) {
      const near = rows.filter((x) => x.id.includes(id) || x.name?.toLowerCase().includes(id.toLowerCase())).slice(0, 5)
      die(`找不到 id「${id}」${near.length ? `；相近的有：${near.map((x) => x.id).join(', ')}` : ''}`)
    }
    return r
  })
  if (!targets.length) targets = rows.filter(matches)
  if (!targets.length) die('没有匹配任何条目：给几个 id，或用 --kind / --arch / --tier / --year 过滤')
  if (targets.length > 20 && !flags.force) {
    die(`这次会一次改动 ${targets.length} 条，确认无误请加 --force`)
  }
  const by = typeof flags.by === 'string' ? flags.by : ledger.reviewer
  const note = typeof flags.note === 'string' ? flags.note : undefined
  for (const r of targets) {
    const prev = reviewOf(r.id)
    if (cmd === 'undo') {
      const count = Math.max(0, prev.count - 1)
      if (count === 0) delete ledger.items[r.id]
      else ledger.items[r.id] = { ...ledger.items[r.id], count }
      console.log(`↺ ${label(r)}  →  ${count} 次`)
      continue
    }
    ledger.items[r.id] = {
      count: prev.count + 1,
      lastReviewedAt: date,
      ...(by ? { by } : {}),
      ...(note ?? prev.note ? { note: note ?? prev.note } : {}),
    }
    console.log(`✓ ${label(r)}  →  第 ${prev.count + 1} 次 · ${date}`)
  }
  save()
  console.log(`\n已写入 data/reviews.json。记得 npm run data 重新生成快照，再 npm run build。`)
} else if (cmd === 'reset') {
  if (flags.all) ledger.items = {}
  else {
    if (!ids.length) die('reset 需要显式给出 id，或加 --all 清空全部')
    for (const id of ids) delete ledger.items[id]
  }
  save()
  console.log('台账已清理')
} else {
  console.log(`用法：
  npm run review -- stats
  npm run review -- list [--unreviewed] [--kind product|extra|server|model|breakthrough] [--arch Blackwell] [--tier datacenter] [--stale 90] [--limit 100] [--verbose]
  npm run review -- mark <id...> [--note "…"] [--by 名字] [--date YYYY-MM-DD]
  npm run review -- mark --arch Blackwell --tier datacenter [--force]
  npm run review -- undo <id...>
  npm run review -- reset --all | reset <id...>`)
}
