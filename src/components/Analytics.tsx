import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'

import {
  archPeaks,
  atlas,
  chinaProducts,
  fmtCny,
  fmtDate,
  fmtNum,
  generationGain,
  MODERN_ARCHS,
  priceEfficiency,
  TIER_META,
  yearlyResonance,
  type EffPoint,
} from '../lib/atlas'
import { cn } from '../lib/cn'

export function SectionHead({
  label,
  title,
  note,
  icon,
}: {
  label: string
  title: string
  note: string
  icon: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h2 className="font-display text-xl font-semibold tracking-wide text-snow lg:text-2xl">{title}</h2>
        <span className="inline-flex items-center gap-1 border border-edge/60 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-fog/60">
          {icon}
          {label}
        </span>
      </div>
      <p className="mt-2 max-w-[62ch] text-[11.5px] leading-relaxed text-fog/80">{note}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  01 · generation ladder
 * ------------------------------------------------------------------ */

export function GenerationLadder() {
  const rows = useMemo(() => archPeaks(), [])
  const max = Math.max(...rows.map((r) => r.fp32 ?? 0), 1)
  const deltas = rows.map((r, i) => {
    const prev = [...rows.slice(0, i)].reverse().find((x) => x.fp32)?.fp32
    if (!r.fp32 || !prev) return null
    return r.fp32 / prev - 1
  })
  const gain = generationGain()
  const fpRatio = gain.fp
  const vramRatio = gain.vram

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        {rows.map((r, i) => {
          const width = r.fp32 ? Math.max(4, (Math.log10(r.fp32 + 1) / Math.log10(max + 1)) * 100) : 2
          const modern = MODERN_ARCHS.includes(r.name)
          return (
            <div
              key={r.name}
              className={cn(
                'grid grid-cols-[92px_1fr_64px] items-center gap-3 border-b border-edge/30 py-2',
                !modern && 'opacity-55',
              )}
            >
              <div>
                <div className="text-[12px] text-snow/90">{r.name}</div>
                <div className="font-mono text-[9px] text-fog/50">{r.years}</div>
              </div>
              <div className="relative h-[18px]">
                <div className="absolute inset-y-0 left-0 w-full bg-deck/40" />
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${width}%`,
                    background: 'linear-gradient(90deg, rgba(56,226,255,0.75), rgba(146,112,255,0.55))',
                  }}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-1.5 font-mono text-[9px] text-void">
                  {r.fp32 ? `${fmtNum(r.fp32, 1)} TF` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[11px] text-fog">{r.vram} GB</div>
                <div className="font-mono text-[8.5px] text-fog/50">
                  {deltas[i] === null ? `${r.count} 款` : `${deltas[i]! >= 0 ? '+' : ''}${(deltas[i]! * 100).toFixed(0)}%`}
                </div>
              </div>
            </div>
          )
        })}
        <div className="mt-2 flex flex-wrap justify-between gap-1 font-mono text-[9px] text-fog/50">
          <span>柱长 = 数据中心卡 FP32 峰值（对数）</span>
          <span>右列 = 最大显存 · 代际增幅</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-amber/60">
          口径提醒：Turing 世代只有 T4 一张推理卡进入数据中心序列，因此出现下凹，不代表算力倒退。
        </p>
      </div>

      <div className="space-y-3">
        <div className="hud-panel p-4">
          <div className="label-hud mb-2">两个十年尺度</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                k: '数据中心卡 FP32 峰值',
                a: gain.fpFrom ? fmtNum(gain.fpFrom, 1) : '—',
                b: gain.fpTo ? fmtNum(gain.fpTo, 0) : '—',
                unit: 'TFLOPS',
                mult: fpRatio ? `${fpRatio.toFixed(1)}×` : '—',
              },
              {
                k: '单卡显存峰值',
                a: gain.vramFrom ?? '—',
                b: gain.vramTo ?? '—',
                unit: 'GB',
                mult: vramRatio ? `${vramRatio.toFixed(1)}×` : '—',
              },
            ].map((x) => (
              <div key={x.k} className="border border-edge/50 bg-deck/30 p-2.5">
                <div className="font-mono text-[9px] text-fog/60">{x.k}</div>
                <div className="num mt-1 flex items-baseline gap-1.5 text-snow">
                  <span className="text-[13px] text-fog/70">{x.a}</span>
                  <ArrowRight size={10} className="text-cyan" />
                  <span className="text-[18px]">{x.b}</span>
                </div>
                <div className="font-mono text-[9px] text-cyan/80">
                  {x.mult} · {x.unit}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fog/80">
            从 Pascal 到 Blackwell，数据中心卡的 FP32 涨了 {fpRatio ? fpRatio.toFixed(1) : '—'} 倍，
            显存涨了 {vramRatio ? vramRatio.toFixed(1) : '—'} 倍。
            <span className="text-snow/90">这一代 AI 的瓶颈，已经不是算得多快，而是能把多大的模型放进去。</span>
            数据中心卡的竞争重心因此从 TFLOPS 转向容量与带宽。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: '样本', v: `${atlas.products.length}`, s: 'NVIDIA SKU' },
            { k: '覆盖', v: '10', s: '代架构' },
            { k: '特供', v: `${chinaProducts().length}`, s: '受限型号' },
          ].map((x) => (
            <div key={x.k} className="border border-edge/40 bg-hull/30 p-2.5">
              <div className="font-mono text-[9px] text-fog/50">{x.k}</div>
              <div className="num text-[16px] text-snow">{x.v}</div>
              <div className="font-mono text-[8.5px] text-fog/50">{x.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  02 · price efficiency scatter
 * ------------------------------------------------------------------ */

export function PriceScatter() {
  const points = useMemo(() => priceEfficiency(), [])
  const W = 780
  const H = 380
  const pad = { l: 56, r: 24, t: 18, b: 42 }
  const x0 = 3
  const x1 = 140
  const y0 = 1500
  const y1 = 500000
  const lx = (v: number) =>
    pad.l + ((Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * (W - pad.l - pad.r)
  const ly = (v: number) =>
    H - pad.b - ((Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))) * (H - pad.t - pad.b)
  const iso = [100, 300, 1000]
  const labelled = new Set(
    [...points]
      .sort((a, b) => a.cnyPerTflops - b.cnyPerTflops)
      .slice(0, 3)
      .concat([...points].sort((a, b) => b.cnyPerTflops - a.cnyPerTflops).slice(0, 2))
      .map((p) => p.id),
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="hud-panel overflow-hidden p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
          {[3000, 10000, 30000, 100000, 300000].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={ly(v)} y2={ly(v)} stroke="#1c2a44" strokeDasharray="2 6" />
              <text x={pad.l - 8} y={ly(v) + 3} textAnchor="end" fontSize={9} fill="#8b9dbd">
                {v >= 10000 ? `${v / 10000}万` : v}
              </text>
            </g>
          ))}
          {[5, 10, 20, 40, 80, 120].map((v) => (
            <g key={v}>
              <line x1={lx(v)} x2={lx(v)} y1={pad.t} y2={H - pad.b} stroke="#1c2a44" strokeDasharray="2 6" />
              <text x={lx(v)} y={H - pad.b + 14} textAnchor="middle" fontSize={9} fill="#8b9dbd">
                {v}
              </text>
            </g>
          ))}
          {iso.map((k) => (
            <g key={k}>
              <line
                x1={lx(x0)}
                y1={ly(k * x0)}
                x2={lx(x1)}
                y2={ly(k * x1)}
                stroke="#ffb545"
                strokeOpacity={0.28}
                strokeDasharray="4 6"
              />
              <text x={lx(3.6)} y={ly(k * 3.6) - 4} fontSize={8.5} fill="#ffb545" opacity={0.6}>
                ¥{k}/TF
              </text>
            </g>
          ))}
          {points.map((p) => (
            <g key={p.id}>
              <circle
                cx={lx(Math.max(x0, p.fp32))}
                cy={ly(Math.min(y1, Math.max(y0, p.priceCny)))}
                r={p.china ? 5 : 4}
                fill={TIER_META[p.tier].color}
                fillOpacity={0.7}
                stroke={p.china ? '#ffb545' : TIER_META[p.tier].color}
                strokeWidth={p.china ? 1.6 : 0.6}
              >
                <title>{`${p.name} · ${fmtNum(p.fp32, 1)} TF · ${fmtCny(p.priceCny)} · ¥${p.cnyPerTflops.toFixed(0)}/TFLOPS`}</title>
              </circle>
              {labelled.has(p.id) && (
                <text
                  x={lx(Math.max(x0, p.fp32)) + 7}
                  y={ly(Math.min(y1, Math.max(y0, p.priceCny))) + 3}
                  fontSize={8.5}
                  fill="#cfe0f7"
                  opacity={0.8}
                >
                  {p.name.replace(/^GeForce\s+|^Radeon\s+/, '').slice(0, 18)}
                </text>
              )}
            </g>
          ))}
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#8b9dbd">
            FP32 算力 TFLOPS（对数） →
          </text>
          <text x={14} y={H / 2} fontSize={9} fill="#8b9dbd" transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">
            中国区参考价 CNY（对数）
          </text>
        </svg>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {(['datacenter', 'workstation', 'consumer'] as const).map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: TIER_META[t].color }} />
              <span className="font-mono text-[9px] text-fog/70">{TIER_META[t].label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-amber" />
            <span className="font-mono text-[9px] text-fog/70">中国特供</span>
          </div>
        </div>
        <div className="hud-panel p-3">
          <div className="label-hud mb-2">单位算力最便宜</div>
          {points.slice(0, 4).map((p, i) => (
            <div key={p.id} className="flex items-baseline justify-between border-b border-edge/30 py-1 last:border-0">
              <span className="truncate text-[11px] text-snow/85">
                {i + 1}. {p.name}
              </span>
              <span className="num shrink-0 text-[10px] text-cyan">¥{p.cnyPerTflops.toFixed(0)}/TF</span>
            </div>
          ))}
          <p className="mt-2 text-[10px] leading-relaxed text-fog/60">
            只比较有公开中国区价格的型号；整机采购价与单卡 MSRP 不可直接横比。
          </p>
        </div>
        <div className="border border-amber/25 bg-amber/5 p-3">
          <p className="text-[11px] leading-relaxed text-amber/85">
            {points.length} 款卡有可用价与算力。越靠右下，单位算力的溢价越高——旗舰与特供型号基本都在这一侧。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  03 · models × hardware resonance
 * ------------------------------------------------------------------ */

export function Resonance() {
  const data = useMemo(() => yearlyResonance(2016, 2026), [])
  const W = 800
  const H = 330
  const pad = { l: 46, r: 54, t: 22, b: 34 }
  const maxCount = Math.max(...data.map((d) => d.releases), 1)
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const vramScale = (v: number) =>
    H - pad.b - ((Math.log10(v) - Math.log10(8)) / (Math.log10(512) - Math.log10(8))) * (H - pad.t - pad.b)
  const paramScale = (v: number) =>
    H - pad.b - ((Math.log10(v) - Math.log10(1)) / (Math.log10(2000) - Math.log10(1))) * (H - pad.t - pad.b)
  const barW = Math.max(8, (W - pad.l - pad.r) / data.length - 10)

  const vramLine = data.filter((d) => d.vram)
  const paramLine = data.filter((d) => d.params)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="hud-panel overflow-hidden p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
          {[8, 16, 32, 64, 128, 256].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={vramScale(v)} y2={vramScale(v)} stroke="#1c2a44" strokeDasharray="2 6" />
              <text x={pad.l - 6} y={vramScale(v) + 3} textAnchor="end" fontSize={8.5} fill="#38e2ff" opacity={0.7}>
                {v}G
              </text>
            </g>
          ))}
          {[2, 10, 100, 1000].map((v) => (
            <text key={v} x={W - pad.r + 6} y={paramScale(v) + 3} fontSize={8.5} fill="#9270ff" opacity={0.8}>
              {v}B
            </text>
          ))}

          {data.map((d, i) => (
            <rect
              key={d.year}
              x={x(i) - barW / 2}
              y={H - pad.b - (d.releases / maxCount) * 46}
              width={barW}
              height={(d.releases / maxCount) * 46}
              fill="#2fe6a8"
              fillOpacity={0.18}
            />
          ))}

          <polyline
            points={vramLine.map((d) => `${x(data.indexOf(d))},${vramScale(d.vram!)}`).join(' ')}
            fill="none"
            stroke="#38e2ff"
            strokeWidth={1.6}
          />
          {vramLine.map((d) => (
            <circle key={`v-${d.year}`} cx={x(data.indexOf(d))} cy={vramScale(d.vram!)} r={2.4} fill="#38e2ff">
              <title>{`${d.year} · 当年最大单卡显存 ${d.vram} GB`}</title>
            </circle>
          ))}

          <polyline
            points={paramLine.map((d) => `${x(data.indexOf(d))},${paramScale(d.params!)}`).join(' ')}
            fill="none"
            stroke="#9270ff"
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
          {paramLine.map((d) => (
            <circle key={`p-${d.year}`} cx={x(data.indexOf(d))} cy={paramScale(d.params!)} r={2.4} fill="#9270ff">
              <title>{`${d.year} · 最大开源模型 ${d.params}B`}</title>
            </circle>
          ))}

          {data.map((d, i) => (
            <text key={`y-${d.year}`} x={x(i)} y={H - pad.b + 14} textAnchor="middle" fontSize={9} fill="#8b9dbd">
              {`'${String(d.year).slice(2)}`}
            </text>
          ))}
          <text x={pad.l} y={14} fontSize={8.5} fill="#38e2ff" opacity={0.8}>
            单卡最大显存（左轴）
          </text>
          <text x={W - pad.r} y={14} fontSize={8.5} fill="#9270ff" textAnchor="end" opacity={0.8}>
            最大开源模型参数（右轴）
          </text>
        </svg>
      </div>

      <div className="space-y-3">
        <div className="hud-panel p-3.5">
          <div className="label-hud mb-2">怎么读</div>
          <p className="text-[11px] leading-relaxed text-fog/85">
            青线是当年能买到的最大单卡显存，紫线是当年最大的开源模型。模型能不能装下，先由显存决定：
            <span className="text-snow/90">2023 年之后模型参数的增长明显快于单卡显存</span>
            ，差额被 MoE 稀疏激活、量化与多卡集群补上。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(() => {
            const first = data.find((d) => d.params)
            const last = [...data].reverse().find((d) => d.params)
            return [
              { k: '起始年最大模型', v: first ? `${first.params}B` : '—', s: first ? `${first.year}` : '' },
              { k: '最近年最大模型', v: last ? `${last.params}B` : '—', s: last ? `${last.year}` : '' },
              { k: '模型发布峰值', v: `${Math.max(...data.map((d) => d.releases))}`, s: '个 / 年' },
              { k: '收录突破', v: `${atlas.breakthroughs.length}`, s: '项技术' },
            ].map((x) => (
              <div key={x.k} className="border border-edge/40 bg-hull/30 p-2.5">
                <div className="font-mono text-[8.5px] text-fog/50">{x.k}</div>
                <div className="num text-[16px] text-snow">{x.v}</div>
                <div className="font-mono text-[8.5px] text-fog/40">{x.s}</div>
              </div>
            ))
          })()}
        </div>
        <div className="flex items-center gap-4 font-mono text-[9px] text-fog/60">
          <span className="flex items-center gap-1">
            <span className="h-px w-4 bg-cyan" /> 硬件
          </span>
          <span className="flex items-center gap-1">
            <span className="h-px w-4 border-t border-dashed border-violet" /> 模型
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 bg-mint/30" /> 发布数
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  04 · China specials
 * ------------------------------------------------------------------ */

export function ChinaTable() {
  const rows = useMemo(() => chinaProducts(), [])
  return (
    <div className="hud-panel overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-edge/60 font-mono text-[9px] tracking-wider text-fog/60">
            <th className="px-3 py-2 font-normal">型号</th>
            <th className="px-3 py-2 font-normal">层级</th>
            <th className="px-3 py-2 font-normal">时间</th>
            <th className="px-3 py-2 font-normal">规格</th>
            <th className="px-3 py-2 font-normal">相对原版</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-edge/25 text-[11px] last:border-0 hover:bg-deck/40">
              <td className="px-3 py-2 text-snow/90">{p.name}</td>
              <td className="px-3 py-2 font-mono text-[10px]" style={{ color: TIER_META[p.tier].color }}>
                {TIER_META[p.tier].short}
              </td>
              <td className="num px-3 py-2 text-fog/80">{fmtDate(p.date, p.datePrecision)}</td>
              <td className="px-3 py-2 text-fog/80">
                {p.vramLabel ?? '—'} · {p.fp32 ? `${fmtNum(p.fp32, 1)} TF` : '算力未公开'}
              </td>
              <td className="max-w-[320px] px-3 py-2 text-[10.5px] leading-relaxed text-fog/70">
                {p.note || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
