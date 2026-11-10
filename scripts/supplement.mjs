#!/usr/bin/env node
/**
 * 二手来源补录台账的校验 / 预演工具。
 *
 * 数据里很多字段官方不公开或只精确到年份，只能靠文章、拆解贴、论坛汇总来补。
 * 每份来源放一个 JSON（data/supplements/<id>.json），构建时由 build_data.py 合并。
 * 这个脚本只读，用来在提交前把人名、字段名、id 和冲突情况过一遍。
 *
 *   npm run supplement -- list          列出所有来源及其生效/冲突数量
 *   npm run supplement -- check [id]    校验 JSON 结构 + 预演合并结果
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'data', 'supplements')
const ATLAS = path.join(ROOT, 'src', 'data', 'atlas.json')

/** 允许补的字段：其余字段要么由构建推导，要么是内部状态，不该手补。 */
const FIELDS = new Set([
  'fp32',
  'tdpW',
  'bandwidthGbps',
  'tensorTflops',
  'cuda',
  'vramGb',
  'vramLabel',
  'vramType',
  'date',
  'note',
  'msrpUsd',
  'priceCny',
  'category',
  'archTech',
])
const CONF = new Set(['high', 'medium', 'low'])

const [, , cmd = 'list', only] = process.argv

const atlas = JSON.parse(fs.readFileSync(ATLAS, 'utf8'))
const rows = [...atlas.products, ...atlas.extras, ...atlas.servers]
const byId = new Map(rows.map((r) => [r.id, r]))

function sources() {
  if (!fs.existsSync(DIR)) return []
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, doc: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }))
}

const datePrec = (v) => (v.length === 4 ? 'year' : v.length === 7 ? 'month' : 'day')
const prefix = (v, p) => (p === 'year' ? v.slice(0, 4) : p === 'month' ? v.slice(0, 7) : v.slice(0, 10))

/** 与 build_data.py 的合并规则保持一致：只填空白 / 细化日期；冲突不覆盖，除非显式 override。 */
function simulate(doc) {
  const applied = []
  const conflicts = []
  const problems = []
  for (const item of doc.items ?? []) {
    const row = byId.get(item.id)
    if (!row) {
      problems.push(`未知 id：${item.id}`)
      continue
    }
    for (const [field, raw] of Object.entries(item.fields ?? {})) {
      const spec = typeof raw === 'object' && raw !== null ? raw : { value: raw }
      if (!FIELDS.has(field)) problems.push(`${item.id}：字段 ${field} 不在允许清单里`)
      if (spec.confidence && !CONF.has(spec.confidence))
        problems.push(`${item.id}.${field}：confidence 只能是 high/medium/low`)
      if (!spec.quote) problems.push(`${item.id}.${field}：缺少 quote（原文出处）`)
      const cur = row[field]
      const value = spec.value
      // 构建后再跑：字段的 provenance 已指向本来源，说明已经入库
      if (row.provenance?.[field]?.src === doc.id) {
        applied.push({ id: item.id, field, value, conf: spec.confidence ?? 'medium', override: !!spec.override, merged: true })
        continue
      }
      let take = false
      if (cur === null || cur === undefined || cur === '') take = true
      else if (cur === value) continue
      else if (field === 'date' && typeof cur === 'string') {
        const p = row.datePrecision ?? datePrec(cur)
        take = prefix(String(value), p) === prefix(cur, p) && datePrec(String(value)) !== p
      }
      if (!take && !spec.override) {
        conflicts.push({ id: item.id, field, local: cur, article: value })
        continue
      }
      applied.push({ id: item.id, field, value, conf: spec.confidence ?? 'medium', override: !!spec.override })
    }
  }
  const declared = (doc.conflicts ?? []).length
  return { applied, conflicts, problems, declared }
}

if (cmd === 'list') {
  const all = sources()
  if (!all.length) {
    console.log('还没有补充来源。新建 data/supplements/<id>.json 后重跑本命令。')
    process.exit(0)
  }
  for (const { file, doc } of all) {
    const r = simulate(doc)
    console.log(
      `${doc.id ?? file}\n  ${doc.title ?? '(无标题)'} · ${doc.level ?? 'secondary'} · ${doc.publishedAt ?? '—'}\n` +
        `  ${doc.url ?? ''}\n  生效 ${r.applied.length} 字段 · 冲突 ${r.conflicts.length + r.declared} 条 · 问题 ${r.problems.length}`,
    )
  }
} else if (cmd === 'check') {
  const all = sources().filter(({ doc, file }) => !only || doc.id === only || file.startsWith(only))
  let bad = 0
  for (const { doc } of all) {
    const r = simulate(doc)
    console.log(`\n=== ${doc.id} ===`)
    console.log(`${doc.title}\n${doc.url}`)
    if (r.problems.length) {
      bad += r.problems.length
      console.log('\n✗ 文件问题：')
      for (const p of r.problems) console.log(`  - ${p}`)
    }
    if (r.applied.length) {
      console.log('\n✓ 会补进去的字段：')
      for (const a of r.applied) {
        const row = byId.get(a.id)
        console.log(
          `  - ${row?.name ?? a.id} · ${a.field} → ${JSON.stringify(a.value)}${a.override ? '（覆盖）' : ''} [${a.conf}]${a.merged ? '（已入库）' : ''}`,
        )
      }
    }
    if (r.conflicts.length) {
      console.log('\n! 与现有数据冲突（默认保留本地值）：')
      for (const c of r.conflicts) {
        const row = byId.get(c.id)
        console.log(`  - ${row?.name ?? c.id} · ${c.field}: 本地 ${JSON.stringify(c.local)} / 文章 ${JSON.stringify(c.article)}`)
      }
    }
    if (r.declared) console.log(`\n已登记冲突 ${r.declared} 条（写在文件的 conflicts 里）`)
  }
  process.exit(bad ? 1 : 0)
} else {
  console.log('用法：npm run supplement -- list | check [id]')
  process.exit(1)
}
