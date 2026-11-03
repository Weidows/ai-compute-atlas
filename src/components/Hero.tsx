import { ArrowDown, Layers } from 'lucide-react'

import { atlas, chinaProducts, TIER_META } from '../lib/atlas'

const LAYERS = [
  { id: '01', name: '架构世代', hint: 'Blackwell → Fermi', value: `${atlas.archs.filter((a) => a.count).length} 代` },
  { id: '02', name: '芯片 / SKU', hint: '数据中心 · 专业 · 消费', value: `${atlas.products.length + atlas.extras.length} 款` },
  { id: '03', name: '整机 · 超节点', hint: 'DGX / HGX / NVL72', value: `${atlas.servers.length} 台` },
  { id: '04', name: '开源模型', hint: 'DeepSeek · GLM · Kimi', value: `${atlas.models.length} 节点` },
  { id: '05', name: '技术突破', hint: '架构 / 训练 / 推理 / 多模态', value: `${atlas.breakthroughs.length} 项` },
]

export function Hero() {
  const kpis = [
    { k: '时间跨度', v: '2010—2026', s: '17 个年份' },
    { k: 'NVIDIA 产品', v: `${atlas.products.length}`, s: `${atlas.archs.length} 代架构` },
    { k: '整机 / 超节点', v: `${atlas.servers.length}`, s: '8 卡到 NVL72' },
    { k: '开源模型', v: `${atlas.models.length}`, s: '近 30 天下载口径' },
    { k: '技术突破', v: `${atlas.breakthroughs.length}`, s: '三项实验室' },
  ]

  return (
    <section className="relative mx-auto max-w-[1680px] px-4 pb-16 pt-28 lg:px-8 lg:pt-32">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px w-8 bg-cyan/60" />
            <span className="label-hud">AI COMPUTE ATLAS · 2010 — 2026</span>
          </div>
          <h1 className="font-display text-[42px] font-bold leading-[1.05] tracking-tight text-snow sm:text-[58px] lg:text-[68px]">
            算力
            <span className="text-glow text-cyan">全景</span>
            <span className="ml-2 align-top font-mono text-[12px] tracking-[0.3em] text-fog/70">ATLAS</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-fog">
            把三年里分散的三份资料接成一条线：<span className="text-snow/90">NVIDIA 七代产品全表</span>、
            <span className="text-snow/90">41 款卡的行情与能效</span>、
            <span className="text-snow/90">三家实验室 84 个开源发布</span>。
            同一根时间轴上，向上看算力被谁供给，向下看这些算力长出了什么模型。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#atlas"
              className="group flex items-center gap-2 border border-cyan/60 bg-cyan/10 px-4 py-2 font-mono text-[11px] tracking-wider text-cyan transition-colors hover:bg-cyan/20"
            >
              进入全景 <ArrowDown size={13} className="transition-transform group-hover:translate-y-0.5" />
            </a>
            <a
              href="#generations"
              className="flex items-center gap-2 border border-edge px-4 py-2 font-mono text-[11px] tracking-wider text-fog transition-colors hover:border-fog/60 hover:text-snow"
            >
              <Layers size={13} /> 代际跃迁
            </a>
            <span className="font-mono text-[10px] text-amber/80">
              ⚑ {chinaProducts().length} 款中国特供单独标注
            </span>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-2 gap-y-4 border-t border-edge/60 pt-5 sm:grid-cols-5">
            {kpis.map((x) => (
              <div key={x.k}>
                <div className="font-mono text-[9px] tracking-[0.18em] text-fog/60">{x.k}</div>
                <div className="num mt-1 text-[20px] font-medium text-snow">{x.v}</div>
                <div className="font-mono text-[9px] text-fog/50">{x.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* five-layer schematic */}
        <div className="relative">
          <div className="pointer-events-none absolute left-[26px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan/50 via-violet/40 to-amber/40" />
          <div className="space-y-2">
            {LAYERS.map((l, i) => (
              <a
                key={l.id}
                href="#atlas"
                className="group relative flex items-center gap-4 border border-edge/50 bg-hull/40 px-3 py-2.5 transition-colors hover:border-cyan/40 hover:bg-hull/70"
              >
                <span
                  className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border bg-void font-mono text-[9px]"
                  style={{
                    borderColor: ['#38e2ff', '#38e2ff', '#ff5d73', '#9270ff', '#ffb545'][i],
                    color: ['#38e2ff', '#38e2ff', '#ff5d73', '#9270ff', '#ffb545'][i],
                  }}
                >
                  {l.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-snow/90">{l.name}</span>
                  <span className="block font-mono text-[9px] text-fog/60">{l.hint}</span>
                </span>
                <span className="num shrink-0 text-[11px] text-fog">{l.value}</span>
              </a>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[9px] text-fog/50">
            <span>供给 ↑</span>
            <span>需求 ↓</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1">
            {(['datacenter', 'workstation', 'consumer'] as const).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_META[t].color }} />
                <span className="font-mono text-[8.5px] text-fog/60">{TIER_META[t].short}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose" />
              <span className="font-mono text-[8.5px] text-fog/60">SYS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
