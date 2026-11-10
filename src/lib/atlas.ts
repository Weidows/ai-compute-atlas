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
  provenance?: Record<string, Provenance>
}

/**
 * 字段级补录记录。官方规格里没写、或只精确到年份的，才用二手资料补，
 * 所以每个补过的字段都单独记「来自哪篇文章 / 把握多大」。
 */
export interface Provenance {
  src: string
  conf: string
  override?: boolean
  quote?: string | null
}

/** 一份二手来源：生效了哪些字段、和本地冲突了什么（冲突项一律以本地为准）。 */
export interface SupplementSource {
  id: string
  title: string | null
  url: string | null
  author: string | null
  publishedAt: string | null
  retrievedAt: string | null
  level: string
  note: string | null
  applied: { id: string; name: string | null; field: string; value: unknown; conf: string; override: boolean }[]
  conflicts: {
    id: string
    name?: string | null
    field: string
    local: unknown
    article: unknown
    resolution: string
    quote?: string | null
    reason?: string
  }[]
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
  /** external = 来自「模型年鉴」的基础技术（Transformer / MoE / RLHF…），不是本地三家的独门突破 */
  origin?: 'external'
  /** external 节点的原始记录链接（论文 / 官方博客） */
  source?: { url?: string | null; name?: string | null; title?: string | null }
  review?: Review
}

/** 模型 → 技术 的一条连线；evidence 是模型档案里那句「用了它」的原话 */
export interface TechLink {
  model: string
  tech: string
  evidence: string
  src: 'model-profile' | 'introducer'
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

export interface IndustryRow {
  id: string
  name: string
  year: number
  note?: string
  source?: string
  status?: string
  review?: Review
}

export interface HbmRow extends IndustryRow {
  stackGb: number
  maxStackGb: number
  bandwidthGbs: number
  busBits: number
  firstUse: string
  suppliers: string[]
}

export interface InterconnectRow extends IndustryRow {
  scope: 'scale-up' | 'scale-out' | 'optics'
  gbs: number
  firstUse: string
}

export interface PowerRow extends IndustryRow {
  rackKw: number
  gpus: number | null
  gpuType: string
  cooling: string
}

export interface ProcessRow extends IndustryRow {
  vendor: string
  nm: number
  archs: string[]
  transistorsB: number
}

export interface ClusterRow extends IndustryRow {
  operator: string
  gpus: number | null
  gpuType: string
  powerMw: number | null
}

/** 产业链五类维度：算力之外配套能力的公开口径。 */
export interface Industry {
  asOf: string | null
  note: string | null
  hbm: HbmRow[]
  interconnect: InterconnectRow[]
  power: PowerRow[]
  process: ProcessRow[]
  clusters: ClusterRow[]
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
  industry?: Industry
  supplements?: SupplementSource[]
  techLinks?: TechLink[]
  techSource?: { id?: string; title?: string; url?: string; author?: string; retrievedAt?: string }
  counts: Record<string, number>
}

export const atlas = raw as unknown as AtlasData

const SUPPLEMENT_BY_ID = new Map<string, SupplementSource>(
  (atlas.supplements ?? []).map((s) => [s.id, s]),
)

/** 某个字段是不是二手来源补的；是的话返回来源，否则 null。 */
export function provenanceOf(item: { provenance?: Record<string, Provenance> } | null | undefined, field: string) {
  const p = item?.provenance?.[field]
  if (!p) return null
  return { ...p, source: SUPPLEMENT_BY_ID.get(p.src) ?? null }
}

/** 这条数据被哪个来源补过（去重，用于档案卡脚注）。 */
export function supplantedBy(item: { provenance?: Record<string, Provenance> } | null | undefined) {
  const map = item?.provenance
  if (!map) return []
  const ids = [...new Set(Object.values(map).map((p) => p.src))]
  return ids.map((id) => ({ id, fields: Object.keys(map).filter((f) => map[f].src === id), source: SUPPLEMENT_BY_ID.get(id) ?? null }))
}

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

/** 产业链数据缺失时的空壳，保证页面不炸。 */
export function industryOf(): Industry {
  return (
    atlas.industry ?? {
      asOf: null,
      note: null,
      hbm: [],
      interconnect: [],
      power: [],
      process: [],
      clusters: [],
    }
  )
}

/** 首尾倍数，用来把「涨了多少」写成一句话而不是堆数字。 */
export function timesBetween(rows: { value: number }[]): number | null {
  const nums = rows.map((r) => r.value).filter((v) => v > 0)
  if (nums.length < 2) return null
  return nums[nums.length - 1] / nums[0]
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

/** 模型 → 它用到的技术（含证据句） */
export function techsOfModel(data: AtlasData, modelId: string): { tech: Breakthrough; evidence: string }[] {
  const byId = new Map(data.breakthroughs.map((b) => [b.id, b]))
  return (data.techLinks ?? [])
    .filter((l) => l.model === modelId)
    .map((l) => ({ tech: byId.get(l.tech)!, evidence: l.evidence }))
    .filter((x) => x.tech)
}

/** 技术 → 用到它的模型 */
export function modelsUsingTech(data: AtlasData, techId: string): Model[] {
  const byId = new Map(data.models.map((m) => [m.id, m]))
  return (data.techLinks ?? [])
    .filter((l) => l.tech === techId)
    .map((l) => byId.get(l.model)!)
    .filter(Boolean)
}
