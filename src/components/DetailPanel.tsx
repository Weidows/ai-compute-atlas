import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, ShieldAlert, ShieldCheck, X } from 'lucide-react'

import {
  atlas,
  fmtCompact,
  fmtCny,
  fmtDate,
  fmtNum,
  fmtUsd,
  ORG_COLOR,
  REVIEW_TONE,
  reviewCoverage,
  provenanceOf,
  reviewOf,
  supplantedBy,
  SYSTEM_COLOR,
  TIER_META,
  yearFraction,
  type Model,
  type Product,
  type Review,
  type Server,
} from '../lib/atlas'
import { cn } from '../lib/cn'
import type { Selection } from './Atlas'

function Row({
  label,
  value,
  filled,
  title,
}: {
  label: string
  value: React.ReactNode
  /** 二手来源补录的字段：带一个「补」角标，hover 显示来源 */
  filled?: boolean
  title?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-edge/30 py-1.5 last:border-0">
      <span className="shrink-0 font-mono text-[10px] tracking-wider text-fog/70">
        {label}
        {filled && (
          <span
            title={title}
            className="ml-1 rounded-sm border border-violet/40 bg-violet/10 px-1 text-[8px] leading-[12px] text-violet/90"
          >
            补
          </span>
        )}
      </span>
      <span className="num text-right text-[12px] text-snow/90">{value}</span>
    </div>
  )
}

function Chip({ children, tone = '#38e2ff' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="rounded-full border px-1.5 py-0.5 font-mono text-[9px] leading-none"
      style={{ borderColor: `${tone}66`, color: tone, background: `${tone}12` }}
    >
      {children}
    </span>
  )
}

/**
 * 每一条记录的复核状态。数据是人工抓取整理的，这个条子明确告诉读者
 * 「这条被人工核对过几次、最近一次是哪天」，0 次就是没做过二次核对。
 */
function ReviewStrip({ review }: { review?: Review }) {
  const r = reviewOf({ review })
  const ok = r.count > 0
  const tone = ok ? REVIEW_TONE.reviewed : REVIEW_TONE.pending
  const Icon = ok ? ShieldCheck : ShieldAlert
  return (
    <div
      className="mb-3 border px-2 py-1.5"
      style={{ borderColor: `${tone}40`, background: `${tone}0c` }}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] leading-tight">
        <Icon size={11} style={{ color: tone }} className="shrink-0" />
        <span style={{ color: tone }}>{ok ? `已复核 ${r.count} 次` : '未复核'}</span>
        <span className="text-fog/60">·</span>
        <span className="text-fog">
          {ok ? `最近 ${r.lastReviewedAt ?? '日期缺失'}` : '单次抓取，尚未二次核对'}
        </span>
        {ok && r.by && <span className="text-fog/50">· {r.by}</span>}
      </div>
      {r.note && <p className="mt-1 text-[10px] leading-relaxed text-fog/80">{r.note}</p>}
    </div>
  )
}

/** Nearest open-weight releases to a hardware date, used to tie the two layers. */
function relatedModels(date: string, limit = 4): Model[] {
  const t = yearFraction(date)
  return [...atlas.models]
    .map((m) => ({ m, d: Math.abs(yearFraction(m.date) - t) + (m.tier === 'flagship' ? 0 : 0.12) }))
    // anything further than ~18 months is not "同期" and would mislead on old cards
    .filter((x) => x.d <= 1.6)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.m)
}

/** Highest-FP32 datacenter cards shipped around a model's release. */
function relatedHardware(date: string, limit = 3): Product[] {
  const t = yearFraction(date)
  return [...atlas.products]
    .filter((p) => p.tier === 'datacenter' && p.fp32 && p.date <= date)
    .sort((a, b) => yearFraction(b.date) - yearFraction(a.date))
    .slice(0, limit)
    .map((p) => p)
    .filter((p) => t - yearFraction(p.date) < 2.5)
}

export function DetailPanel({
  selection,
  onSelect,
  onClose,
  zoom = 1,
}: {
  selection: Selection
  onSelect: (s: Selection) => void
  onClose: () => void
  zoom?: number
}) {
  // 面板跟着时间轴等比放大，但上限 1.35，避免在 2K 上占掉半屏
  const kz = Math.min(zoom, 1.35)
  const reduce = useReducedMotion()
  const data = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'product') {
      const p =
        atlas.products.find((x) => x.id === selection.id) ??
        atlas.extras.find((x) => x.id === selection.id)
      if (!p) return null
      return {
        kind: 'product' as const,
        p,
        quote: atlas.market.quotes.find(
          (q) => (q as { device_id: string }).device_id === p.marketId,
        ) as { price_cny?: number; raw?: string; unit?: string } | undefined,
        peers: atlas.products.filter((x) => x.arch === p.arch && x.tier === p.tier).length,
        sibs: atlas.products.filter((x) => x.arch === p.arch).slice(0, 5),
      }
    }
    if (selection.kind === 'server') {
      const s = atlas.servers.find((x) => x.id === selection.id)
      return s ? { kind: 'server' as const, s } : null
    }
    if (selection.kind === 'model') {
      const m = atlas.models.find((x) => x.id === selection.id)
      return m ? { kind: 'model' as const, m } : null
    }
    const b = atlas.breakthroughs.find((x) => x.id === selection.id)
    return b ? { kind: 'breakthrough' as const, b } : null
  }, [selection])

  if (!selection || !data) return null

  const current =
    data.kind === 'product'
      ? data.p
      : data.kind === 'server'
        ? data.s
        : data.kind === 'model'
          ? data.m
          : data.b
  const coverage = reviewCoverage()
  /** 二手来源补录的字段（官方规格没写或只到年份，靠文章补的），带上来源元信息 */
  const prov: Record<string, ReturnType<typeof provenanceOf>> =
    data.kind === 'product'
      ? Object.fromEntries(Object.keys(data.p.provenance ?? {}).map((f) => [f, provenanceOf(data.p, f)]))
      : {}
  const suppl = data.kind === 'product' ? supplantedBy(data.p) : []

  return (
    <motion.aside
      initial={reduce ? false : { x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduce ? undefined : { x: 24, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={
        kz === 1
          ? undefined
          : {
              zoom: kz,
              top: `${64 / kz}px`,
              right: `${12 / kz}px`,
              maxHeight: `calc((100dvh - 84px) / ${kz})`,
            }
      }
      className="hud-panel hud-corners fixed right-3 top-[64px] z-[70] flex max-h-[calc(100vh-84px)] w-[340px] flex-col overflow-hidden border-cyan/25 shadow-[0_20px_80px_rgba(0,0,0,0.55)] max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-2 max-sm:w-auto"
      role="dialog"
      aria-label="节点档案"
    >
      <div className="flex items-center justify-between border-b border-edge/60 px-3.5 py-2">
        <span className="label-hud">
          {data.kind === 'product'
            ? 'HARDWARE'
            : data.kind === 'server'
              ? 'SYSTEM'
              : data.kind === 'model'
                ? 'OPEN MODEL'
                : 'BREAKTHROUGH'}
        </span>
        <button onClick={onClose} aria-label="关闭档案" className="text-fog transition-colors hover:text-snow">
          <X size={14} />
        </button>
      </div>

      <div className="no-bar flex-1 overflow-y-auto px-3.5 py-3">
        <ReviewStrip review={current.review} />
        {data.kind === 'product' && (
          <>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[16px] font-semibold leading-snug text-snow">{data.p.name}</h3>
              {data.p.china && <Chip tone="#ffb545">中国特供</Chip>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone={TIER_META[data.p.tier].color}>{TIER_META[data.p.tier].label}</Chip>
              <Chip>{data.p.arch}</Chip>
              {data.p.brand !== 'NVIDIA' && <Chip tone="#8b9dbd">{data.p.brand}</Chip>}
            </div>
            <p className="mt-2 font-mono text-[10px] text-fog">
              {data.p.dateText || fmtDate(data.p.date)} 首发
              {prov.date && (
                <span
                  title={`补录自 ${prov.date.source?.title ?? prov.date.src}`}
                  className="ml-1 rounded-sm border border-violet/40 bg-violet/10 px-1 text-[8px] leading-[12px] text-violet/90"
                >
                  补
                </span>
              )}
            </p>

            <div className="mt-3">
              <Row label="CUDA 核心" value={data.p.cuda ? fmtNum(data.p.cuda) : '—'} />
              <Row label="显存" value={data.p.vramLabel ?? '—'} />
              <Row
                label="FP32 算力"
                value={data.p.fp32 ? `${fmtNum(data.p.fp32, 1)} TFLOPS` : '未公开'}
                filled={!!prov.fp32}
                title={prov.fp32?.source?.title ?? undefined}
              />
              <Row
                label="带宽"
                value={data.p.bandwidthGbps ? `${fmtNum(data.p.bandwidthGbps)} GB/s` : '—'}
                filled={!!prov.bandwidthGbps}
                title={prov.bandwidthGbps?.source?.title ?? undefined}
              />
              <Row
                label="功耗"
                value={data.p.tdpW ? `${fmtNum(data.p.tdpW)} W` : '—'}
                filled={!!prov.tdpW}
                title={prov.tdpW?.source?.title ?? undefined}
              />
              <Row
                label="多卡"
                value={data.p.nvlink ? `NVLink ×${data.p.multiMax ?? '?'}` : data.p.multiMax && data.p.multiMax > 1 ? `×${data.p.multiMax}` : '单卡'}
              />
            </div>

            {(data.p.priceCny || data.p.msrpUsd || data.quote) && (
              <div className="mt-3 rounded-sm border border-edge/60 bg-deck/40 p-2.5">
                <div className="label-hud mb-1.5">价格</div>
                <div className="flex items-baseline justify-between">
                  <span className="num text-[15px] text-amber">
                    {data.quote?.price_cny ? fmtCny(data.quote.price_cny) : fmtCny(data.p.priceCny)}
                  </span>
                  <span className="font-mono text-[10px] text-fog">
                    {data.p.msrpUsd ? `MSRP ${fmtUsd(data.p.msrpUsd)}` : '无官方 MSRP'}
                  </span>
                </div>
                {data.quote?.raw && (
                  <div className="mt-1 font-mono text-[9px] leading-relaxed text-fog/70">
                    现货：{data.quote.raw}
                  </div>
                )}
                {data.p.regionAvail && (
                  <div className="mt-1 font-mono text-[9px] text-fog/70">
                    中国区供货：{data.p.regionAvail === 'restricted' ? '受限' : data.p.regionAvail === 'limited' ? '紧张' : '正常'}
                  </div>
                )}
              </div>
            )}

            {suppl.length > 0 && (
              <div className="mt-2.5 rounded-sm border border-violet/25 bg-violet/[0.06] px-2 py-1.5">
                <div className="label-hud mb-1 text-violet/80">补录来源</div>
                {suppl.map((s) => (
                  <div key={s.id} className="font-mono text-[9px] leading-relaxed text-fog">
                    {s.source?.url ? (
                      <a
                        href={s.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet/90 underline decoration-dotted hover:text-violet"
                      >
                        {s.source.title ?? s.source.id}
                        <ArrowUpRight size={9} className="ml-0.5 inline" />
                      </a>
                    ) : (
                      (s.source?.title ?? s.id)
                    )}
                    <span className="text-fog/60">
                      {' '}
                      · {s.fields.join('/')}
                      {s.source?.publishedAt ? ` · ${s.source.publishedAt}` : ''}
                    </span>
                  </div>
                ))}
                <div className="mt-1 font-mono text-[8.5px] text-fog/50">
                  二手资料补录，未经官方确认；与官方冲突处以本地口径为准
                </div>
              </div>
            )}

            {data.p.note && (
              <p className="mt-3 border-l border-cyan/30 pl-2 text-[11px] leading-relaxed text-fog">
                {data.p.note}
              </p>
            )}

            <div className="mt-4">
              <div className="label-hud mb-1.5">同期开源模型</div>
              <div className="space-y-1">
                {relatedModels(data.p.date).length === 0 && (
                  <p className="text-[10px] text-fog/60">该时期没有收录开源模型（收录自 2023 年起）</p>
                )}
                {relatedModels(data.p.date).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelect({ kind: 'model', id: m.id })}
                    className="flex w-full items-baseline justify-between gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-deck/60"
                  >
                    <span className="truncate text-[11px] text-snow/85">{m.name}</span>
                    <span className="shrink-0 font-mono text-[9px]" style={{ color: ORG_COLOR[m.org] }}>
                      {fmtDate(m.date)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 font-mono text-[9px] leading-relaxed text-fog/50">
              同代同层 {data.peers} 款 · 数据：{data.p.source === 'docx' ? 'NVIDIA 全览文档' : 'gpu-server-compare'}
            </div>
          </>
        )}

        {data.kind === 'server' && (
          <>
            <h3 className="text-[15px] font-semibold leading-snug text-snow">{data.s.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone={SYSTEM_COLOR}>{data.s.kind === 'supernode' ? '超节点' : '整机'}</Chip>
              <Chip tone="#8b9dbd">{data.s.vendor}</Chip>
              <Chip>{data.s.segment}</Chip>
            </div>
            <p className="mt-2 font-mono text-[10px] text-fog">{data.s.dateNote}</p>
            <div className="mt-3">
              <Row label="GPU" value={`${data.s.gpuCount}× ${data.s.gpu}`} />
              <Row label="整机功耗" value={data.s.powerKw ? `${data.s.powerKw} kW` : '—'} />
              <Row label="机架" value={data.s.rackUnits ? `${data.s.rackUnits}U` : '—'} />
              <Row label="整机价" value={data.s.priceCny ? fmtCny(data.s.priceCny) : fmtUsd(data.s.priceUsd)} />
              <Row label="单卡折算" value={data.s.priceCny ? fmtCny(Math.round(data.s.priceCny / data.s.gpuCount)) : '—'} />
            </div>
            {data.s.priceRaw && (
              <p className="mt-2 font-mono text-[9px] text-amber/80">行情原文：{data.s.priceRaw}</p>
            )}
            <button
              onClick={() => {
                const gpu = atlas.products.find((p) => p.marketId === data.s.gpuId) ?? atlas.extras.find((p) => p.marketId === data.s.gpuId)
                if (gpu) onSelect({ kind: 'product', id: gpu.id })
              }}
              className="mt-3 flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
            >
              看这台的 GPU <ArrowUpRight size={11} />
            </button>
          </>
        )}

        {data.kind === 'model' && (
          <>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[16px] font-semibold leading-snug text-snow">{data.m.name}</h3>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px]"
                style={{ background: `${ORG_COLOR[data.m.org]}22`, color: ORG_COLOR[data.m.org] }}
              >
                {data.m.orgName}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone={ORG_COLOR[data.m.org]}>{data.m.family}</Chip>
              <Chip>{data.m.tier}</Chip>
              {data.m.paramsSource === 'inferred' && <Chip tone="#ffb545">家族推定</Chip>}
            </div>
            <p className="mt-2 font-mono text-[10px] text-fog">{fmtDate(data.m.date)} 发布</p>

            <div className="mt-3">
              <Row label="参数" value={data.m.totalParams ?? '未公开'} />
              <Row label="激活参数" value={data.m.activeB ? `${data.m.activeB}B` : '—'} />
              <Row label="上下文" value={data.m.contextLength ?? '—'} />
              <Row label="许可" value={data.m.license ?? '—'} />
              <Row label="近 30 天下载" value={fmtCompact(data.m.downloads)} />
              <Row label="点赞" value={fmtCompact(data.m.likes)} />
            </div>

            {data.m.headline && (
              <div className="mt-3 rounded-sm border border-edge/60 bg-deck/40 p-2.5">
                <div className="label-hud mb-1">官方测评</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-snow/85">{data.m.headline.metric}</span>
                  <span className="num text-[15px] text-cyan">{data.m.headline.score}</span>
                </div>
              </div>
            )}

            {data.m.breakthrough && (
              <p className="mt-3 border-l border-amber/50 pl-2 text-[11px] leading-relaxed text-amber/90">
                {data.m.breakthrough}
              </p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-fog">{data.m.summary}</p>

            {data.m.innovations.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {data.m.innovations.slice(0, 6).map((t) => (
                  <span key={t} className="rounded-sm bg-deck/70 px-1.5 py-0.5 text-[9px] text-fog">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4">
              <div className="label-hud mb-1.5">发布时可用算力</div>
              <div className="space-y-1">
                {relatedHardware(data.m.date).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelect({ kind: 'product', id: p.id })}
                    className="flex w-full items-baseline justify-between gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-deck/60"
                  >
                    <span className="truncate text-[11px] text-snow/85">{p.name}</span>
                    <span className="num shrink-0 text-[9px] text-cyan">{fmtNum(p.fp32, 1)} TF</span>
                  </button>
                ))}
                {relatedHardware(data.m.date).length === 0 && (
                  <p className="text-[10px] text-fog/60">该时间点之前没有收录数据中心卡</p>
                )}
              </div>
            </div>

            {data.m.repo && (
              <a
                href={`https://huggingface.co/${data.m.repo}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
              >
                {data.m.repo} <ArrowUpRight size={11} />
              </a>
            )}
          </>
        )}

        {data.kind === 'breakthrough' && (
          <>
            <h3 className="text-[16px] font-semibold text-snow">{data.b.label}</h3>
            <p className="mt-0.5 text-[12px] text-fog">{data.b.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone="#ffb545">{data.b.lane}</Chip>
              <Chip>{data.b.orgName}</Chip>
            </div>
            <p className="mt-2 font-mono text-[10px] text-fog">{fmtDate(data.b.date)}</p>
            <div className="mt-3 space-y-2">
              {data.b.mechanism && (
                <div>
                  <div className="label-hud mb-0.5">机理</div>
                  <p className="text-[11px] leading-relaxed text-snow/85">{data.b.mechanism}</p>
                </div>
              )}
              {data.b.impact && (
                <div>
                  <div className="label-hud mb-0.5">影响</div>
                  <p className="text-[11px] leading-relaxed text-fog">{data.b.impact}</p>
                </div>
              )}
              {data.b.magnitude && (
                <div className="rounded-sm border border-amber/30 bg-amber/5 p-2 font-mono text-[11px] text-amber">
                  {data.b.magnitude}
                </div>
              )}
            </div>
            {data.b.releaseId && (
              <button
                onClick={() => onSelect({ kind: 'model', id: data.b.releaseId as string })}
                className="mt-3 flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
              >
                首次出现于该版本 <ArrowUpRight size={11} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-edge/60 px-3.5 py-2 font-mono text-[9px] text-fog/50">
        <span>
          复核 {coverage.reviewed}/{coverage.total} 项 · 快照 {atlas.generatedAt}
        </span>
        <button onClick={onClose} className="hover:text-snow">
          ESC
        </button>
      </div>
    </motion.aside>
  )
}
