import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minus, Plus, ScanLine, Tags } from 'lucide-react'

import {
  atlas,
  clamp,
  DOMAIN,
  fmtCny,
  fmtDate,
  fmtNum,
  fmtUsd,
  ORG_COLOR,
  packRows,
  SYSTEM_COLOR,
  TIER_META,
  yearFraction,
  type Model,
  type Product,
  type Server,
  type Tier,
} from '../lib/atlas'
import { cn } from '../lib/cn'

export type Selection =
  | { kind: 'product'; id: string }
  | { kind: 'server'; id: string }
  | { kind: 'model'; id: string }
  | { kind: 'breakthrough'; id: string }
  | null

export interface Filters {
  tiers: Set<Tier>
  orgs: Set<string>
  chinaOnly: boolean
  labels: boolean
}

const BAND = {
  era: { top: 0, h: 18 },
  arch: { top: 22, h: 44 },
  dc: { top: 68, h: 144 },
  ws: { top: 216, h: 92 },
  gc: { top: 312, h: 110 },
  sys: { top: 426, h: 80 },
  models: { top: 510, h: 100 },
  bt: { top: 614, h: 30 },
  ruler: { top: 648, h: 32 },
}
const H = 680
const MAXR = 15

const ERAS = [
  { from: 2010, to: 2016.4, label: 'GPGPU 探索', color: '#8b9dbd' },
  { from: 2016.4, to: 2020.2, label: '深度学习', color: '#38e2ff' },
  { from: 2020.2, to: 2022.6, label: '大模型', color: '#2fe6a8' },
  { from: 2022.6, to: 2024.2, label: '生成式 AI', color: '#9270ff' },
  { from: 2024.2, to: 2027, label: 'AI 工厂', color: '#ffb545' },
]

const PRESETS = [
  { id: 'fit', label: '全史', start: 2010, end: 2027 },
  { id: 'ai', label: 'AI 纪元', start: 2022, end: 2027 },
  { id: 'recent', label: '近两年', start: 2024.6, end: 2027 },
] as const

function radius(p: Product): number {
  const vram = p.vramPerGpuGb ?? p.vramGb ?? 4
  const base = 2.4 + Math.sqrt(vram) * 0.72
  return clamp(base, 2.8, MAXR)
}

function isAnchor(p: Product): boolean {
  if (p.tier === 'datacenter') return true
  if (/PRO 6000|6000 Ada|PRO 5000|A100|H100|H200/.test(p.name)) return true
  if (p.tier === 'consumer' && /(90|80 Ti|80 Super|Titan)/.test(p.name)) return true
  return false
}

interface Placed<T> {
  item: T
  x: number
  y: number
  r: number
  row: number
}

function layout<T extends { date: string }>(
  list: T[],
  band: { top: number; h: number },
  ppyear: number,
  rOf: (t: T) => number,
  opts: { padTop?: number; maxRows?: number; gap?: number } = {},
): Placed<T>[] {
  const padTop = opts.padTop ?? 12
  const gap = opts.gap ?? 4
  const rows = opts.maxRows ?? Math.max(1, Math.floor((band.h - padTop - 8) / 26))
  const items = list
    .map((item) => ({ item, x: (yearFraction(item.date) - DOMAIN[0]) * ppyear, r: rOf(item) }))
    .sort((a, b) => a.x - b.x)
  const packed = packRows(items, rows, gap)
  const rowH = Math.min(30, (band.h - padTop - 8) / Math.max(1, rows))
  return packed.map(({ item, row }) => ({
    item: item.item,
    x: item.x,
    y: band.top + padTop + rowH * (row + 0.5),
    r: item.r,
    row,
  }))
}

/* ------------------------------------------------------------------ */

export function Atlas({
  selection,
  onSelect,
  filters,
  setFilters,
}: {
  selection: Selection
  onSelect: (s: Selection) => void
  filters: Filters
  setFilters: (f: Filters) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ start?: number; center?: number } | null>(null)
  const [ppyear, setPpyear] = useState(92)
  const [preset, setPreset] = useState<string>('ai')
  const [hover, setHover] = useState<{ x: number; y: number; label: string; sub: string; tone: string } | null>(null)
  const [win, setWin] = useState({ left: 0, width: 1 })
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [dragging, setDragging] = useState(false)

  const plotW = Math.round((DOMAIN[1] - DOMAIN[0]) * ppyear) + 40

  const applyPreset = useCallback((id: string) => {
    const el = scrollRef.current
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[1]
    const avail = el ? el.clientWidth - 24 : 900
    const py = clamp(avail / (p.end - p.start), 34, 460)
    pending.current = { start: p.start }
    setPpyear(py)
    setPreset(p.id)
  }, [])

  /** Zoom around the year currently sitting at the viewport centre. */
  const zoomTo = useCallback((next: number) => {
    const el = scrollRef.current
    const py = clamp(next, 34, 460)
    if (el) pending.current = { center: DOMAIN[0] + (el.scrollLeft + el.clientWidth / 2) / ppyear }
    setPpyear(py)
    setPreset('custom')
  }, [ppyear])

  /** Scroll only after the plot has re-laid out at the new px-per-year. */
  useEffect(() => {
    const el = scrollRef.current
    const p = pending.current
    if (!el || !p) return
    pending.current = null
    const left =
      p.start !== undefined ? (p.start - DOMAIN[0]) * ppyear : (p.center! - DOMAIN[0]) * ppyear - el.clientWidth / 2
    el.scrollLeft = Math.max(0, left)
  }, [ppyear])

  useEffect(() => {
    applyPreset('ai')
  }, [applyPreset])

  /**
   * 横向平移：Shift + 滚轮、触控板横划、以及页面本身不可竖滚时的普通滚轮。
   * 用非 passive 监听才能 preventDefault，避免同时触发页面滚动。
   */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 4
      const wantPan = horizontal || e.shiftKey || !pageScrolls
      if (!wantPan) return
      const delta = horizontal ? e.deltaX : e.deltaY
      if (!delta) return
      e.preventDefault()
      el.scrollLeft = clamp(el.scrollLeft + delta, 0, max)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /** 按住拖动平移；位移超过 4px 才算拖拽，松手后吞掉这次 click，避免误开档案。 */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      const el = scrollRef.current
      if (!d || !el) return
      const dx = e.clientX - d.x
      if (!d.moved && Math.abs(dx) > 4) {
        d.moved = true
        setDragging(true)
        setHover(null)
      }
      if (!d.moved) return
      e.preventDefault()
      el.scrollLeft = clamp(d.left - dx, 0, el.scrollWidth - el.clientWidth)
    }
    const end = () => {
      if (drag.current?.moved) {
        suppressClick.current = true
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
      }
      drag.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  /** Overview strip: current window as a fraction of the full 2010—2027 span. */
  const syncWindow = () => {
    const el = scrollRef.current
    if (!el) return
    setWin({ left: el.scrollLeft / Math.max(1, el.scrollWidth), width: el.clientWidth / Math.max(1, el.scrollWidth) })
  }

  const jumpTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    const r = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - r.left) / r.width
    el.scrollLeft = Math.max(0, frac * el.scrollWidth - el.clientWidth / 2)
    syncWindow()
  }

  const dc = useMemo(
    () => layout(atlas.products.filter((p) => p.tier === 'datacenter'), BAND.dc, ppyear, radius),
    [ppyear],
  )
  const ws = useMemo(
    () => layout(atlas.products.filter((p) => p.tier === 'workstation'), BAND.ws, ppyear, radius),
    [ppyear],
  )
  const gc = useMemo(
    () =>
      layout(
        [...atlas.products, ...atlas.extras].filter(
          (p) => p.tier === 'consumer' || p.tier === 'semi' || p.tier === 'other',
        ),
        BAND.gc,
        ppyear,
        radius,
      ),
    [ppyear],
  )
  const systems = useMemo(
    () =>
      layout(
        atlas.servers,
        BAND.sys,
        ppyear,
        (s: Server) => (s.kind === 'supernode' ? 8 : 5.5),
        { maxRows: 4, gap: 8, padTop: 14 },
      ),
    [ppyear],
  )
  const models = useMemo(
    () =>
      layout(
        atlas.models,
        BAND.models,
        ppyear,
        (m: Model) => clamp(2.6 + Math.log10((m.paramsB ?? 1) + 1) * 3.1, 3, 11) + (m.tier === 'flagship' ? 1.4 : 0),
        { maxRows: 4, gap: 3, padTop: 10 },
      ),
    [ppyear],
  )
  const breakthroughs = useMemo(
    () =>
      layout(
        atlas.breakthroughs,
        BAND.bt,
        ppyear,
        () => 3,
        { maxRows: 3, gap: 3, padTop: 8 },
      ),
    [ppyear],
  )

  const selectedDate = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'product') {
      const p = atlas.products.find((x) => x.id === selection.id) ?? atlas.extras.find((x) => x.id === selection.id)
      return p?.date ?? null
    }
    if (selection.kind === 'server') return atlas.servers.find((x) => x.id === selection.id)?.date ?? null
    if (selection.kind === 'model') return atlas.models.find((x) => x.id === selection.id)?.date ?? null
    return atlas.breakthroughs.find((x) => x.id === selection.id)?.date ?? null
  }, [selection])

  const dimProduct = (p: Product) =>
    (filters.chinaOnly && !p.china) || !filters.tiers.has(p.tier) ? 0.14 : 1
  const dimModel = (m: Model) => (!filters.orgs.has(m.org) ? 0.12 : 1)

  const tooltip = (e: React.MouseEvent, label: string, sub: string, tone: string) => {
    setHover({ x: e.clientX, y: e.clientY, label, sub, tone })
  }

  /**
   * Greedy label placement with two hard rules: a label may not hit another
   * bubble, and may not hit a label already placed. Keeps the chart readable
   * at any zoom instead of relying on eyeballed offsets.
   */
  const labelFor = (placed: Placed<Product>[], anchor: (p: Product) => boolean) => {
    const out: { x: number; y: number; text: string; tone: string; opacity: number }[] = []
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
    for (const n of [...placed].sort((a, b) => a.x - b.x)) {
      if (!filters.labels && !anchor(n.item)) continue
      const text = n.item.name.replace(/^GeForce\s+|^Radeon\s+|^NVIDIA\s+/, '')
      const width = text.length * 5.4 + 6
      const lx = n.x + n.r + 4
      const rect = { x0: lx - 1, y0: n.y - 7, x1: lx + width, y1: n.y + 7 }
      const hitsDot = placed.some((o) => {
        if (o === n) return false
        return (
          o.x + o.r > rect.x0 - 2 && o.x - o.r < rect.x1 + 2 && o.y + o.r > rect.y0 && o.y - o.r < rect.y1
        )
      })
      if (hitsDot) continue
      if (boxes.some((b) => b.x1 > rect.x0 && b.x0 < rect.x1 && b.y1 > rect.y0 && b.y0 < rect.y1)) continue
      boxes.push(rect)
      out.push({
        x: lx,
        y: n.y + 3,
        text,
        tone: TIER_META[n.item.tier].color,
        opacity: dimProduct(n.item) === 1 ? 0.85 : 0.18,
      })
    }
    return out
  }

  const dcLabels = useMemo(() => labelFor(dc, () => true), [dc, filters.labels, filters.chinaOnly, filters.tiers])
  const gcLabels = useMemo(() => labelFor(gc, isAnchor), [gc, filters.labels, filters.chinaOnly, filters.tiers])
  const wsLabels = useMemo(() => labelFor(ws, () => true), [ws, filters.labels, filters.chinaOnly, filters.tiers])

  /** Systems + models carry longer labels, so they are suppressed entirely at
   *  wide zoom and packed greedily when zoomed in. */
  const systemsLabels = useMemo(() => {
    if (ppyear < 130) return []
    const out: { x: number; y: number; text: string; tone: string }[] = []
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
    for (const n of [...systems].sort((a, b) => a.x - b.x)) {
      const vendor = n.item.vendor.replace('NVIDIA', 'N家').replace('Supermicro', '超微').split(/[（(]/)[0].trim()
      const text = `${vendor} ${n.item.gpuCount}×${n.item.gpu.split(' ')[0]}`
      const width = text.length * 5.2 + 6
      const rect = { x0: n.x + n.r + 5, y0: n.y - 7, x1: n.x + n.r + 5 + width, y1: n.y + 7 }
      if (systems.some((o) => o !== n && o.x + o.r > rect.x0 - 2 && o.x - o.r < rect.x1 + 2 && o.y + o.r > rect.y0 && o.y - o.r < rect.y1)) continue
      if (boxes.some((b) => b.x1 > rect.x0 && b.x0 < rect.x1 && b.y1 > rect.y0 && b.y0 < rect.y1)) continue
      boxes.push(rect)
      out.push({ x: rect.x0, y: n.y + 3, text, tone: SYSTEM_COLOR })
    }
    return out
  }, [systems, ppyear])

  const modelLabels = useMemo(() => {
    if (ppyear < 120) return []
    const out: { x: number; y: number; text: string; tone: string }[] = []
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
    for (const n of [...models].sort((a, b) => a.x - b.x)) {
      if (n.item.tier === 'minor' || dimModel(n.item) < 1) continue
      const width = n.item.name.length * 5 + 6
      const rect = { x0: n.x + n.r + 4, y0: n.y - 6, x1: n.x + n.r + 4 + width, y1: n.y + 6 }
      if (models.some((o) => o !== n && o.x + o.r > rect.x0 - 2 && o.x - o.r < rect.x1 + 2 && o.y + o.r > rect.y0 && o.y - o.r < rect.y1)) continue
      if (boxes.some((b) => b.x1 > rect.x0 && b.x0 < rect.x1 && b.y1 > rect.y0 && b.y0 < rect.y1)) continue
      boxes.push(rect)
      out.push({ x: rect.x0, y: n.y + 3, text: n.item.name, tone: ORG_COLOR[n.item.org] })
    }
    return out
  }, [models, ppyear, filters.orgs])

  const breakthroughLabels = useMemo(() => {
    if (ppyear < 170) return []
    const out: { x: number; y: number; text: string }[] = []
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
    for (const n of [...breakthroughs].sort((a, b) => a.x - b.x)) {
      const text = n.item.label
      const width = text.length * 4.8 + 4
      const rect = { x0: n.x - width / 2, y0: n.y - 15, x1: n.x + width / 2, y1: n.y - 5 }
      const hitsDiamond = breakthroughs.some(
        (o) => o !== n && Math.abs(o.x - n.x) < width / 2 + 6 && o.y + 4 > rect.y0 && o.y - 4 < n.y,
      )
      if (hitsDiamond) continue
      if (boxes.some((b) => b.x1 > rect.x0 && b.x0 < rect.x1 && b.y1 > rect.y0 && b.y0 < rect.y1)) continue
      boxes.push(rect)
      out.push({ x: rect.x0, y: rect.y1 - 1, text })
    }
    return out
  }, [breakthroughs, ppyear])

  /** Quarterly density for the overview strip, so the full span is legible
   *  even when the main plot is zoomed into two years. */
  const density = useMemo(() => {
    const bins = Array.from({ length: (DOMAIN[1] - DOMAIN[0]) * 4 }, () => ({ p: 0, m: 0 }))
    const at = (iso: string) => {
      const t = yearFraction(iso) - DOMAIN[0]
      return Math.min(bins.length - 1, Math.max(0, Math.floor(t * 4)))
    }
    atlas.products.forEach((p) => (bins[at(p.date)].p += 1))
    atlas.models.forEach((m) => (bins[at(m.date)].m += 1))
    const maxP = Math.max(1, ...bins.map((b) => b.p))
    const maxM = Math.max(1, ...bins.map((b) => b.m))
    return { bins, maxP, maxM }
  }, [])

  const selectedX =
    selectedDate === null ? null : (yearFraction(selectedDate) - DOMAIN[0]) * ppyear

  return (
    <section id="atlas" className="relative mx-auto w-full max-w-[1680px] px-4 pb-2 lg:px-8">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-lg font-semibold tracking-wide text-snow lg:text-xl">
            算力产业全景
          </h1>
          <span className="hidden font-mono text-[10px] text-fog/55 md:inline">
            拖拽平移 · Shift + 滚轮横向 · 滚轮直接横拉
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-sm border border-edge/80 bg-hull/60 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  'px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors',
                  preset === p.id ? 'bg-cyan/15 text-cyan' : 'text-fog hover:text-snow',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-sm border border-edge/80 bg-hull/60 px-1.5 py-0.5">
            <button
              aria-label="缩小时间轴"
              onClick={() => zoomTo(ppyear / 1.35)}
              className="text-fog transition-colors hover:text-cyan"
            >
              <Minus size={12} />
            </button>
            <input
              aria-label="时间轴缩放"
              type="range"
              min={34}
              max={460}
              value={Math.round(ppyear)}
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="h-1 w-20 accent-cyan"
            />
            <button
              aria-label="放大时间轴"
              onClick={() => zoomTo(ppyear * 1.35)}
              className="text-fog transition-colors hover:text-cyan"
            >
              <Plus size={12} />
            </button>
            <span className="num w-11 text-right text-[9.5px] text-fog">{Math.round(ppyear)}px/年</span>
          </div>
          <button
            onClick={() => setFilters({ ...filters, labels: !filters.labels })}
            className={cn(
              'flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-wider transition-colors',
              filters.labels
                ? 'border-cyan/60 bg-cyan/10 text-cyan'
                : 'border-edge/80 bg-hull/60 text-fog hover:text-snow',
            )}
          >
            <Tags size={11} /> 全部标注
          </button>
        </div>
      </header>

      {/* filter bar */}
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-edge/50 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="label-hud">芯片</span>
          {(Object.keys(TIER_META) as Tier[]).filter((t) => t !== 'other').map((t) => {
            const on = filters.tiers.has(t)
            return (
              <button
                key={t}
                onClick={() => {
                  const next = new Set(filters.tiers)
                  if (on) next.delete(t)
                  else next.add(t)
                  setFilters({ ...filters, tiers: next.size ? next : new Set([t]) })
                }}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all',
                  on ? 'border-transparent text-void' : 'border-edge text-fog hover:text-snow',
                )}
                style={on ? { background: TIER_META[t].color } : undefined}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: on ? '#04060b' : TIER_META[t].color }}
                />
                {TIER_META[t].label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="label-hud">模型</span>
          {atlas.orgs.map((o) => {
            const on = filters.orgs.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => {
                  const next = new Set(filters.orgs)
                  if (on) next.delete(o.id)
                  else next.add(o.id)
                  setFilters({ ...filters, orgs: next.size ? next : new Set([o.id]) })
                }}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all',
                  on ? 'border-transparent' : 'border-edge text-fog hover:text-snow',
                )}
                style={
                  on
                    ? { background: `${ORG_COLOR[o.id]}22`, borderColor: `${ORG_COLOR[o.id]}88`, color: ORG_COLOR[o.id] }
                    : undefined
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ORG_COLOR[o.id] }} />
                {o.short}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setFilters({ ...filters, chinaOnly: !filters.chinaOnly })}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-all',
            filters.chinaOnly
              ? 'border-amber/70 bg-amber/15 text-amber'
              : 'border-edge text-fog hover:text-snow',
          )}
        >
          ⚑ 只看中国特供
        </button>
        <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-fog">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-amber" /> 特供版
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-fog/40" /> 无行情数据
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <ScanLine size={11} /> 圆点大小 = 显存
          </span>
        </span>
      </div>

      <div className="hud-panel hud-corners relative flex overflow-hidden">
        {/* left gutter */}
        <div className="relative z-20 w-[124px] shrink-0 border-r border-edge/60 bg-abyss/80 backdrop-blur-md lg:w-[158px]">
          <div className="relative" style={{ height: H }}>
            {[
              { ...BAND.era, id: '00', title: '时代', hint: '产业叙事' },
              { ...BAND.arch, id: '01', title: '架构世代', hint: '10 代 · 154 款' },
              { ...BAND.dc, id: '02', title: '数据中心', hint: '加速卡' },
              { ...BAND.ws, id: '03', title: '专业工作站', hint: '创作 / 仿真' },
              { ...BAND.gc, id: '04', title: '消费级', hint: 'GeForce / 其他' },
              { ...BAND.sys, id: '05', title: '整机 · 超节点', hint: '15 台' },
              { ...BAND.models, id: '06', title: '开源模型', hint: '3 家 · 84 节点' },
              { ...BAND.bt, id: '07', title: '技术突破', hint: '68 项' },
            ].map((b) => (
              <div
                key={b.id}
                className="absolute inset-x-0 px-3"
                style={{ top: b.top, height: b.h }}
              >
                <div className="flex h-full flex-col justify-center gap-0.5">
                  <div className="font-mono text-[9px] tracking-[0.18em] text-cyan/50">{b.id}</div>
                  <div className="text-[12px] font-medium leading-tight text-snow/90">{b.title}</div>
                  <div className="font-mono text-[9px] leading-tight text-fog/70">{b.hint}</div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px bg-edge/40" />
              </div>
            ))}
          </div>
        </div>

        {/* scrollable plot */}
        <div
          ref={scrollRef}
          className={cn(
            'no-bar relative flex-1 overflow-x-auto overflow-y-hidden',
            dragging ? 'cursor-grabbing select-none' : 'cursor-grab',
          )}
          onPointerDown={(e) => {
            const el = scrollRef.current
            if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
            if (el.scrollWidth <= el.clientWidth + 2) return
            drag.current = { x: e.clientX, left: el.scrollLeft, moved: false }
          }}
          onClickCapture={(e) => {
            if (!suppressClick.current) return
            suppressClick.current = false
            e.preventDefault()
            e.stopPropagation()
          }}
          onMouseLeave={() => setHover(null)}
          onScroll={syncWindow}
        >
          <div className="relative" style={{ width: plotW, height: H }}>
            {/* era strip + zone tint */}
            {ERAS.map((e) => (
              <div
                key={e.label}
                className="absolute top-0 overflow-hidden border-l"
                style={{
                  left: (e.from - DOMAIN[0]) * ppyear,
                  width: (e.to - e.from) * ppyear,
                  height: BAND.era.h,
                  borderColor: `${e.color}44`,
                  background: `linear-gradient(90deg, ${e.color}12, transparent)`,
                }}
              >
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 font-mono text-[9px] tracking-[0.2em]"
                  style={{ color: `${e.color}cc` }}
                >
                  {e.label}
                </span>
              </div>
            ))}

            {/* vertical year grid */}
            {Array.from({ length: DOMAIN[1] - DOMAIN[0] + 1 }, (_, i) => DOMAIN[0] + i).map((y) => (
              <div
                key={y}
                className="pointer-events-none absolute top-0 border-l border-edge/40"
                style={{ left: (y - DOMAIN[0]) * ppyear, height: BAND.ruler.top }}
              />
            ))}

            {/* band separators */}
            {[BAND.dc, BAND.ws, BAND.gc, BAND.sys, BAND.models, BAND.bt].map((b, i) => (
              <div
                key={i}
                className="pointer-events-none absolute inset-x-0 h-px bg-edge/35"
                style={{ top: b.top }}
              />
            ))}

            {/* selected slice */}
            {selectedX !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 animate-beam"
                style={{ left: selectedX, height: BAND.ruler.top }}
              >
                <div className="h-full w-px bg-gradient-to-b from-cyan/0 via-cyan/60 to-cyan/0" />
                <div className="absolute -top-0 -left-[2px] h-1 w-1 rounded-full bg-cyan" />
              </div>
            )}

            {/* architecture ribbons */}
            {atlas.archs
              .filter((a) => a.first && a.last)
              .map((a) => {
                const x0 = (yearFraction(a.first as string) - DOMAIN[0]) * ppyear
                const x1 = (yearFraction(a.last as string) - DOMAIN[0]) * ppyear
                const w = Math.max(28, x1 - x0)
                const active = selection?.kind === 'product' && atlas.products.some(
                  (p) => p.id === selection.id && p.arch === a.name,
                )
                return (
                  <button
                    key={a.name}
                    onClick={() => {
                      const p = atlas.products.find((x) => x.arch === a.name)
                      if (p) onSelect({ kind: 'product', id: p.id })
                    }}
                    onMouseEnter={(e) =>
                      tooltip(e, `${a.name} 架构`, `${a.years} · ${a.count} 款 · ${a.tech}`, '#38e2ff')
                    }
                    onMouseLeave={() => setHover(null)}
                    className="group absolute overflow-hidden rounded-[2px] border text-left transition-colors"
                    style={{
                      left: x0,
                      top: BAND.arch.top + 12,
                      width: w,
                      height: 30,
                      borderColor: active ? '#38e2ff' : 'rgba(56,226,255,0.28)',
                      background: active
                        ? 'linear-gradient(90deg, rgba(56,226,255,0.28), rgba(146,112,255,0.16))'
                        : 'linear-gradient(90deg, rgba(56,226,255,0.14), rgba(146,112,255,0.08))',
                    }}
                  >
                    <span className="absolute inset-0 flex items-center gap-1.5 px-2">
                      <span className="font-display text-[10px] font-semibold tracking-wider text-snow/90">
                        {a.short}
                      </span>
                      <span className="truncate font-mono text-[9px] text-cyan/70">{a.name}</span>
                    </span>
                  </button>
                )
              })}

            {/* datacenter nodes */}
            {dc.map((n) => (
              <Dot
                key={n.item.id}
                n={n}
                color={TIER_META.datacenter.color}
                dim={dimProduct(n.item)}
                active={selection?.kind === 'product' && selection.id === n.item.id}
                hollow={!n.item.marketId}
                china={n.item.china}
                onClick={() => onSelect({ kind: 'product', id: n.item.id })}
                onHover={(e) =>
                  tooltip(
                    e,
                    n.item.name,
                    `${fmtDate(n.item.date, n.item.datePrecision)} · ${n.item.vramLabel ?? '—'} · ${n.item.fp32 ? `${fmtNum(n.item.fp32, 1)} TFLOPS` : '算力未公开'}`,
                    TIER_META.datacenter.color,
                  )
                }
                onLeave={() => setHover(null)}
              />
            ))}
            {dcLabels.map((l, i) => (
              <span
                key={`dc-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px]"
                style={{ left: l.x, top: l.y, color: l.tone, opacity: l.opacity }}
              >
                {l.text}
              </span>
            ))}

            {/* workstation nodes */}
            {ws.map((n) => (
              <Dot
                key={n.item.id}
                n={n}
                color={TIER_META.workstation.color}
                dim={dimProduct(n.item)}
                active={selection?.kind === 'product' && selection.id === n.item.id}
                hollow={!n.item.marketId}
                china={n.item.china}
                onClick={() => onSelect({ kind: 'product', id: n.item.id })}
                onHover={(e) =>
                  tooltip(
                    e,
                    n.item.name,
                    `${fmtDate(n.item.date, n.item.datePrecision)} · ${n.item.vramLabel ?? '—'} · ${n.item.fp32 ? `${fmtNum(n.item.fp32, 1)} TFLOPS` : '算力未公开'}`,
                    TIER_META.workstation.color,
                  )
                }
                onLeave={() => setHover(null)}
              />
            ))}
            {wsLabels.map((l, i) => (
              <span
                key={`ws-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px]"
                style={{ left: l.x, top: l.y, color: l.tone, opacity: l.opacity }}
              >
                {l.text}
              </span>
            ))}

            {/* consumer + other nodes */}
            {gc.map((n) => (
              <Dot
                key={n.item.id}
                n={n}
                color={TIER_META[n.item.tier].color}
                dim={dimProduct(n.item)}
                active={selection?.kind === 'product' && selection.id === n.item.id}
                hollow={!n.item.marketId}
                china={n.item.china}
                onClick={() => onSelect({ kind: 'product', id: n.item.id })}
                onHover={(e) =>
                  tooltip(
                    e,
                    n.item.name,
                    `${fmtDate(n.item.date, n.item.datePrecision)} · ${n.item.vramLabel ?? '—'} · ${n.item.fp32 ? `${fmtNum(n.item.fp32, 1)} TFLOPS` : '算力未公开'}`,
                    TIER_META[n.item.tier].color,
                  )
                }
                onLeave={() => setHover(null)}
              />
            ))}
            {gcLabels.map((l, i) => (
              <span
                key={`gc-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px]"
                style={{ left: l.x, top: l.y, color: l.tone, opacity: l.opacity }}
              >
                {l.text}
              </span>
            ))}

            {/* systems */}
            {systems.map((n) => {
              const s = n.item
              const size = n.r * 2
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect({ kind: 'server', id: s.id })}
                  onMouseEnter={(e) =>
                    tooltip(
                      e,
                      s.name,
                      `${s.gpuCount}× ${s.gpu} · ${s.priceCny ? fmtCny(s.priceCny) : fmtUsd(s.priceUsd)}`,
                      SYSTEM_COLOR,
                    )
                  }
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'absolute z-20 -rotate-45 border transition-all',
                    selection?.kind === 'server' && selection.id === s.id
                      ? 'border-rose bg-rose/50'
                      : 'border-rose/70 bg-rose/15 hover:bg-rose/35',
                  )}
                  style={{ left: n.x - size / 2, top: n.y - size / 2, width: size, height: size }}
                  aria-label={s.name}
                />
              )
            })}
            {systemsLabels.map((l, i) => (
              <span
                key={`sl-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[9px] text-rose/85"
                style={{ left: l.x, top: l.y - 10 }}
              >
                {l.text}
              </span>
            ))}

            {/* models */}
            {models.map((n) => {
              const m = n.item
              const size = n.r * 2
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect({ kind: 'model', id: m.id })}
                  onMouseEnter={(e) =>
                    tooltip(
                      e,
                      `${m.name} · ${m.orgName}`,
                      `${fmtDate(m.date)} · ${m.totalParams ?? '参数量未公开'}${m.headline ? ` · ${m.headline.metric} ${m.headline.score}` : ''}`,
                      ORG_COLOR[m.org],
                    )
                  }
                  onMouseLeave={() => setHover(null)}
                  className="absolute z-20 rounded-full border transition-all"
                  style={{
                    left: n.x - size / 2,
                    top: n.y - size / 2,
                    width: size,
                    height: size,
                    borderColor: ORG_COLOR[m.org],
                    background: m.tier === 'flagship' ? ORG_COLOR[m.org] : `${ORG_COLOR[m.org]}33`,
                    opacity: (selection?.kind === 'model' && selection.id === m.id ? 1 : 0.95) * dimModel(m),
                    boxShadow: m.tier === 'flagship' ? `0 0 12px ${ORG_COLOR[m.org]}66` : undefined,
                  }}
                  aria-label={`${m.name} ${m.orgName}`}
                />
              )
            })}
            {modelLabels.map((l, i) => (
              <span
                key={`ml-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px]"
                style={{ left: l.x, top: l.y - 4, color: `${l.tone}dd` }}
              >
                {l.text}
              </span>
            ))}

            {/* breakthroughs */}
            {breakthroughs.map((n) => {
              const b = n.item
              const size = 6
              return (
                <button
                  key={b.id}
                  onClick={() => onSelect({ kind: 'breakthrough', id: b.id })}
                  onMouseEnter={(e) => tooltip(e, `${b.label} · ${b.name}`, `${fmtDate(b.date)} · ${b.magnitude ?? b.lane}`, '#ffb545')}
                  onMouseLeave={() => setHover(null)}
                  className="absolute z-20 rotate-45 border border-amber/80 bg-amber/40 transition-colors hover:bg-amber"
                  style={{ left: n.x - size / 2, top: n.y - size / 2, width: size, height: size }}
                  aria-label={`${b.label} ${b.name}`}
                />
              )
            })}

            {breakthroughLabels.map((l, i) => (
              <span
                key={`bt-${i}`}
                className="pointer-events-none absolute whitespace-nowrap font-mono text-[8.5px] text-amber/85"
                style={{ left: l.x, top: l.y }}
              >
                {l.text}
              </span>
            ))}

            {/* ruler */}
            <div
              className="absolute inset-x-0 border-t border-edge/70 bg-void/40"
              style={{ top: BAND.ruler.top }}
            >
              {Array.from({ length: DOMAIN[1] - DOMAIN[0] + 1 }, (_, i) => DOMAIN[0] + i).map((y) => (
                <div
                  key={y}
                  className="absolute top-0"
                  style={{ left: (y - DOMAIN[0]) * ppyear }}
                >
                  <div className="h-2 w-px bg-edge" />
                  <div className="mt-1 pl-1 font-mono text-[10px] text-fog/80">{y}</div>
                </div>
              ))}
              <div
                className="absolute top-0 flex flex-col items-center"
                style={{ left: (yearFraction('2026-11-03') - DOMAIN[0]) * ppyear }}
              >
                <div className="h-full w-px bg-cyan/40" />
                <div className="-mt-1 whitespace-nowrap rounded-sm bg-cyan/15 px-1 font-mono text-[9px] text-cyan">
                  NOW
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        <span className="label-hud hidden shrink-0 sm:block">全览条</span>
        <div
          className="group relative h-6 flex-1 cursor-crosshair overflow-hidden border border-edge/50 bg-abyss/60"
          onClick={jumpTo}
          role="presentation"
          title="点击跳到对应年份"
        >
          <div className="absolute inset-0 flex items-end gap-px opacity-70">
            {density.bins.map((b, i) => (
              <span key={i} className="flex h-full flex-1 items-end">
                <span
                  className="w-full bg-cyan/45"
                  style={{ height: `${(b.p / density.maxP) * 62}%` }}
                />
              </span>
            ))}
          </div>
          <div className="absolute inset-0 flex items-start gap-px opacity-80">
            {density.bins.map((b, i) => (
              <span key={i} className="flex h-full flex-1 items-start">
                <span
                  className="w-full bg-violet/40"
                  style={{ height: `${(b.m / density.maxM) * 52}%` }}
                />
              </span>
            ))}
          </div>
          {[2010, 2013, 2016, 2019, 2022, 2025].map((y) => (
            <span
              key={y}
              className="absolute top-0 h-full border-l border-edge/50 font-mono text-[7px] text-fog/40"
              style={{ left: `${((y - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100}%` }}
            >
              <span className="absolute left-0.5 top-0">{y}</span>
            </span>
          ))}
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-cyan/70 bg-cyan/10 transition-[left,width] duration-150"
            style={{ left: `${win.left * 100}%`, width: `${Math.max(2, win.width * 100)}%` }}
          />
        </div>
        <span className="num hidden shrink-0 font-mono text-[9px] text-fog/50 sm:block">
          {Math.round(ppyear)} px/年
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[9.5px] text-fog/60">
        <span className="flex items-center gap-1.5">
          <Crosshair size={10} /> Shift + 滚轮或直接拖拽横向平移；点节点看档案
        </span>
        <span className="flex items-center gap-1.5">
          <Maximize2 size={10} /> {atlas.products.length + atlas.extras.length} 款芯片 ·{' '}
          {atlas.servers.length} 台整机 · {atlas.models.length} 个模型
        </span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-[80] max-w-[300px] border border-cyan/30 bg-void/95 px-3 py-2 shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 320), top: hover.y + 16 }}
        >
          <div className="text-[12px] font-medium text-snow">{hover.label}</div>
          <div className="mt-0.5 font-mono text-[10px]" style={{ color: hover.tone }}>
            {hover.sub}
          </div>
        </div>
      )}
    </section>
  )
}

function Dot({
  n,
  color,
  dim,
  active,
  hollow,
  china,
  onClick,
  onHover,
  onLeave,
}: {
  n: Placed<Product>
  color: string
  dim: number
  active: boolean
  hollow: boolean
  china: boolean
  onClick: () => void
  onHover: (e: React.MouseEvent) => void
  onLeave: () => void
}) {
  const size = n.r * 2
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      aria-label={n.item.name}
      className="group absolute z-20 rounded-full transition-transform hover:scale-125"
      style={{
        left: n.x - n.r,
        top: n.y - n.r,
        width: size,
        height: size,
        opacity: dim,
        border: `1px ${hollow ? 'dashed' : 'solid'} ${active ? '#fff' : color}`,
        background: hollow ? `${color}18` : `${color}${active ? 'dd' : '8c'}`,
        boxShadow: active
          ? `0 0 0 3px ${color}33, 0 0 18px ${color}88`
          : china
            ? '0 0 0 1.5px rgba(255,181,69,0.7)'
            : undefined,
      }}
    >
      {china && (
        <span className="pointer-events-none absolute -right-1 -top-1.5 font-mono text-[7px] leading-none text-amber">
          ⚑
        </span>
      )}
    </button>
  )
}
