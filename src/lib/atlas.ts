import raw from '../data/atlas.json'

export type Tier = 'datacenter' | 'workstation' | 'consumer' | 'semi' | 'other'

/**
 * 人工复核记录。数据全部由人工抓取整理，没有自动校验，
 * 所以每条都带「核对过几次 / 最近一次是哪天」，0 次即「未复核」。
 */
export interface Review {
  count: number
  lastReviewedAt: string | null
  by?: string | null
  note?: string | null
}

export interface Product {
  id: string
  name: string
  arch: string
  archShort: string
  archYears: string
  archTech: string
  tier: Tier
  category: string
  cuda: number | null
  vramGb: number | null
  vramPerGpuGb?: number | null
  vramType: string | null
  vramLabel: string | null
  fp32: number | null
  date: string
  datePrecision: 'day' | 'month' | 'year' | 'unknown'
  dateText: string
  note: string
  china: boolean
  brand: string
  source: string
  marketId?: string
  msrpUsd?: number | null
  priceCny?: number | null
  regionAvail?: string | null
  perfAi?: number | null
  perfGaming?: number | null
  tdpW?: number | null
  bandwidthGbps?: number | null
  tensorTflops?: number | null
  nvlink?: boolean
  multiMax?: number | null
  fp16Note?: number
  review?: Review
}

export interface Server {
  id: string
  name: string
  vendor: string
  kind: 'server' | 'supernode'
  gpu: string
  gpuId: string
  gpuCount: number
  powerKw: number | null
  rackUnits: number | null
  segment: string
  priceUsd: number | null
  priceCny: number | null
  priceRaw: string | null
  date: string
  datePrecision: string
  dateNote: string
  review?: Review
}

export interface Model {
  id: string
  name: string
  org: string
  orgName: string
  family: string
  tier: 'flagship' | 'major' | 'minor'
  date: string
  totalParams: string | null
  paramsB: number | null
  activeB: number | null
  contextLength: string | null
  license: string | null
  downloads: number
  likes: number
  breakthrough: string | null
  innovations: string[]
  summary: string
  headline: { metric: string; score: number } | null
  paramsSource: string | null
  repo?: string
  review?: Review
}

export interface Breakthrough {
  id: string
  label: string
  name: string
  date: string
  lane: string
  org: string
  orgName: string
  releaseId: string | null
  impact: string | null
  magnitude: string | null
  mechanism: string | null
  review?: Review
}

export interface Arch {
  name: string
  short: string
  years: string
  tech: string
  first: string | null
  last: string | null
  count: number
}

export interface Org {
  id: string
  name: string
  short: string
  blurb: string
  hue: number
}

export interface ReviewBreakdown {
  total: number
  reviewed: number
  unreviewed: number
}

export interface AtlasReviews {
  updatedAt: string | null
  reviewer: string | null
  note: string | null
  stats: {
    total: number
    reviewed: number
    unreviewed: number
    lastReviewedAt: string | null
    byKind: Record<string, ReviewBreakdown>
  }
}

export interface AtlasData {
  generatedAt: string
  archs: Arch[]
  products: Product[]
  extras: Product[]
  servers: Server[]
  models: Model[]
  breakthroughs: Breakthrough[]
  orgs: Org[]
  market: { updatedAt: string; quotes: Record<string, unknown>[] }
  reviews: AtlasReviews
  counts: Record<string, number>
}

export const atlas = raw as unknown as AtlasData

/** 复核状态：缺失即 0 次（历史快照或旧数据）。 */
export function reviewOf(item: { review?: Review } | null | undefined): Review {
  return item?.review ?? { count: 0, lastReviewedAt: null, by: null, note: null }
}

export function isReviewed(item: { review?: Review } | null | undefined): boolean {
  return reviewOf(item).count > 0
}

/** `已复核 2 次 · 最近 2026-10-12` / `未复核` —— 档案卡与表格共用。 */
export function reviewText(item: { review?: Review } | null | undefined): string {
  const r = reviewOf(item)
  if (!r.count) return '未复核'
  const when = r.lastReviewedAt ? ` · 最近 ${r.lastReviewedAt}` : ''
  return `已复核 ${r.count} 次${when}`
}

export const REVIEW_TONE = { reviewed: '#2fe6a8', pending: '#ffb545' }

/** 全站复核覆盖率（含尚未生成 reviews 字段的旧快照兜底）。 */
export function reviewCoverage(): AtlasReviews['stats'] {
  return (
    atlas.reviews?.stats ?? {
      total: 0,
      reviewed: 0,
      unreviewed: 0,
      lastReviewedAt: null,
      byKind: {},
    }
  )
}

/* ------------------------------------------------------------------ *
 *  Time + numbers
 * ------------------------------------------------------------------ */

export const DOMAIN: [number, number] = [2010, 2027]

export function yearFraction(iso: string): number {
  const [y, m = 6, d = 15] = iso.split('-').map(Number)
  return y + (m - 1) / 12 + (d - 1) / 365
}

export function fmtDate(iso: string, precision = 'day'): string {
  const [y, m] = iso.split('-')
  if (precision === 'year') return `${y}`
  return `${y}.${m}`
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  return n.toFixed(digits)
}

export function fmtCny(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e8) return `¥${(n / 1e8).toFixed(2)}亿`
  if (n >= 1e4) return `¥${(n / 1e4).toFixed(1)}万`
  return `¥${n.toLocaleString('zh-CN')}`
}

export function fmtUsd(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

export function fmtCompact(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return n.toLocaleString('zh-CN')
}

/* ------------------------------------------------------------------ *
 *  Palette
 * ------------------------------------------------------------------ */

export const TIER_META: Record<Tier, { label: string; short: string; color: string }> = {
  datacenter: { label: '数据中心 / 加速卡', short: 'DC', color: '#38e2ff' },
  workstation: { label: '专业工作站', short: 'WS', color: '#9270ff' },
  consumer: { label: '消费级', short: 'GC', color: '#2fe6a8' },
  semi: { label: '半专业 / 创客', short: 'SP', color: '#ffb545' },
  other: { label: '其他', short: 'OT', color: '#8b9dbd' },
}

export const ORG_COLOR: Record<string, string> = {
  'deepseek-ai': '#38e2ff',
  'zai-org': '#9270ff',
  moonshotai: '#ffb545',
}

export const SYSTEM_COLOR = '#ff5d73'

export function tierOf(p: Product): Tier {
  return p.tier
}

/* ------------------------------------------------------------------ *
 *  Derived series
 * ------------------------------------------------------------------ */

export const MODERN_ARCHS = ['Blackwell', 'Hopper', 'Ada Lovelace', 'Ampere', 'Turing', 'Volta', 'Pascal']

export function archPeaks() {
  return atlas.archs
    .filter((a) => a.count > 0)
    .map((a) => {
      const rows = atlas.products.filter((p) => p.arch === a.name)
      const dc = rows.filter((p) => p.tier === 'datacenter')
      const fp32 = Math.max(0, ...dc.map((p) => p.fp32 ?? 0))
      const vram = Math.max(0, ...dc.map((p) => p.vramGb ?? 0))
      return { ...a, fp32: fp32 || null, vram, dcCount: dc.length }
    })
    .reverse()
}

/** Pascal -> Blackwell gain, computed once for the copy and the section title. */
export function generationGain() {
  const rows = archPeaks()
  const from = rows.find((r) => r.name === 'Pascal')
  const to = rows.find((r) => r.name === 'Blackwell')
  return {
    fpFrom: from?.fp32 ?? null,
    fpTo: to?.fp32 ?? null,
    vramFrom: from?.vram ?? null,
    vramTo: to?.vram ?? null,
    fp: from?.fp32 && to?.fp32 ? to.fp32 / from.fp32 : null,
    vram: from?.vram && to?.vram ? to.vram / from.vram : null,
  }
}

export interface EffPoint {
  id: string
  name: string
  fp32: number
  priceCny: number
  cnyPerTflops: number
  china: boolean
  tier: Tier
  vram: number | null
}

export function priceEfficiency(): EffPoint[] {
  const rows: Product[] = [...atlas.products, ...atlas.extras]
  const seen = new Set<string>()
  const out: EffPoint[] = []
  for (const p of rows) {
    if (!p.fp32 || !p.priceCny) continue
    if (seen.has(p.marketId ?? p.id)) continue
    seen.add(p.marketId ?? p.id)
    out.push({
      id: p.id,
      name: p.name,
      fp32: p.fp32,
      priceCny: p.priceCny,
      cnyPerTflops: p.priceCny / p.fp32,
      china: p.china,
      tier: p.tier,
      vram: p.vramGb,
    })
  }
  return out.sort((a, b) => a.cnyPerTflops - b.cnyPerTflops)
}

export interface YearPoint {
  year: number
  fp32: number | null
  vram: number | null
  params: number | null
  models: number
  releases: number
}

export function yearlyResonance(start = 2016, end = 2026): YearPoint[] {
  const out: YearPoint[] = []
  for (let y = start; y <= end; y++) {
    const dc = atlas.products.filter(
      (p) => p.tier === 'datacenter' && Number(p.date.slice(0, 4)) === y && p.vramGb,
    )
    const ms = atlas.models.filter((m) => Number(m.date.slice(0, 4)) === y)
    const fps = dc.map((p) => p.fp32).filter((v): v is number => typeof v === 'number')
    out.push({
      year: y,
      fp32: fps.length ? Math.max(...fps) : null,
      vram: dc.length ? Math.max(...dc.map((p) => (p.vramPerGpuGb ?? p.vramGb) as number)) : null,
      params: ms.length ? Math.max(...ms.map((m) => m.paramsB ?? 0)) || null : null,
      models: ms.filter((m) => m.tier !== 'minor').length,
      releases: ms.length,
    })
  }
  return out
}

/** Products grouped by tier, sorted by date — the atlas lanes. */
export function laneRows(tier: Tier): Product[] {
  return [...atlas.products, ...atlas.extras]
    .filter((p) => tierOf(p) === tier)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function chinaProducts(): Product[] {
  return atlas.products.filter((p) => p.china).sort((a, b) => a.date.localeCompare(b.date))
}

/** Clamp helper used by the zoom + chart code. */
export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

/** Greedy row packing: items never overlap horizontally inside a row. */
export function packRows<T extends { x: number; r: number }>(
  items: T[],
  maxRows: number,
  gap = 6,
): { item: T; row: number }[] {
  const last: number[] = []
  const placed: { item: T; row: number }[] = []
  for (const item of items) {
    let row = last.findIndex((edge) => item.x - item.r - edge >= gap)
    if (row === -1) {
      if (last.length < maxRows) {
        row = last.length
        last.push(-Infinity)
      } else {
        row = last.indexOf(Math.min(...last))
      }
    }
    last[row] = item.x + item.r
    placed.push({ item, row })
  }
  return placed
}
