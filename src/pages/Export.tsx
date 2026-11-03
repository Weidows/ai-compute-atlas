import { motion, useReducedMotion } from 'motion/react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

import { chinaProducts, fmtDate, fmtNum, reviewOf, REVIEW_TONE, TIER_META } from '../lib/atlas'
import { Link } from '../lib/router'
import { EASE_OUT, Reveal } from '../components/motion'

export function ExportPage() {
  const rows = chinaProducts()
  const reduce = useReducedMotion()
  const archs = new Set(rows.map((r) => r.arch))
  const withFp32 = rows.filter((r) => r.fp32)
  const anyReviewed = rows.some((r) => reviewOf(r).count > 0)

  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 lg:px-8">
      <header className="pt-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-snow lg:text-[30px]">
          特供版：被削掉的那几刀
        </h1>
        <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-fog">
          出口管制之后专门为中国市场做的型号。每一款的削减点都直接来自全览文档的「类别 / 备注」字段，
          没有补推。
        </p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-y border-edge/40 py-3">
          {[
            { k: '型号', v: `${rows.length} 款` },
            { k: '涉及架构', v: `${archs.size} 代` },
            { k: '公开 FP32', v: `${withFp32.length} 款` },
            { k: '时间跨度', v: `${rows[0]?.date.slice(0, 4)} - ${rows[rows.length - 1]?.date.slice(0, 4)}` },
            { k: '复核', v: anyReviewed ? `${rows.filter((r) => reviewOf(r).count > 0).length} 款已核` : '全部未复核' },
          ].map((s) => (
            <div key={s.k} className="flex items-baseline gap-2">
              <span className="font-mono text-[9px] tracking-[0.16em] text-fog/55">{s.k}</span>
              <span className="num text-[14px] text-snow">{s.v}</span>
            </div>
          ))}
        </div>
      </header>

      <ol className="mt-8 divide-y divide-edge/25 border-y border-edge/40">
        {rows.map((p, i) => {
          const rv = reviewOf(p)
          const reviewed = rv.count > 0
          const tone = reviewed ? REVIEW_TONE.reviewed : REVIEW_TONE.pending
          const Icon = reviewed ? ShieldCheck : ShieldAlert
          return (
            <motion.li
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.3), ease: EASE_OUT }}
              className={`group grid gap-3 py-5 transition-colors hover:bg-deck/25 md:items-start md:gap-6 ${
                anyReviewed ? 'md:grid-cols-[1fr_260px_190px]' : 'md:grid-cols-[1fr_300px]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="num text-[10px] text-fog/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-[15px] text-snow">{p.name}</h2>
                  <span
                    className="rounded-full border px-1.5 py-0.5 font-mono text-[9px]"
                    style={{
                      borderColor: `${TIER_META[p.tier].color}55`,
                      color: TIER_META[p.tier].color,
                    }}
                  >
                    {TIER_META[p.tier].short}
                  </span>
                  <span className="font-mono text-[9px] text-fog/50">{p.arch}</span>
                </div>
                <p className="mt-2 max-w-[70ch] text-[11.5px] leading-relaxed text-fog/80">
                  {p.note || '文档未记录削减点'}
                </p>
              </div>

              <div className="flex gap-6 md:justify-end">
                <div>
                  <div className="font-mono text-[9px] tracking-[0.14em] text-fog/50">显存</div>
                  <div className="num mt-0.5 text-[12px] text-snow/90">{p.vramLabel ?? '-'}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[0.14em] text-fog/50">FP32</div>
                  <div className="num mt-0.5 text-[12px] text-snow/90">
                    {p.fp32 ? `${fmtNum(p.fp32, 1)} TF` : '未公开'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[0.14em] text-fog/50">首发</div>
                  <div className="num mt-0.5 text-[12px] text-snow/90">
                    {fmtDate(p.date, p.datePrecision)}
                  </div>
                </div>
              </div>

              {anyReviewed && (
                <div className="flex md:justify-end">
                  <span
                    className="inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px]"
                    style={{ borderColor: `${tone}40`, color: tone, background: `${tone}0d` }}
                  >
                    <Icon size={10} />
                    {reviewed ? `复核 ${rv.count} 次 · ${rv.lastReviewedAt ?? ''}` : '未复核'}
                  </span>
                </div>
              )}
            </motion.li>
          )
        })}
      </ol>

      <Reveal className="mt-6">
        <p className="max-w-[70ch] font-mono text-[10px] leading-relaxed text-fog/50">
          削减不只在算力：NVLink 带宽、显存容量、PCIe 形态与供货状态都可能被单独约束。
          采购前以当时生效的管制条款与厂商规格书为准。
        </p>
      </Reveal>

      <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5">
        <span className="font-mono text-[10px] text-fog/50">全文表版：/china/</span>
        <Link
          to="/ledger"
          className="group flex items-center gap-2 border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
        >
          下一章：复核台账
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </Reveal>
    </div>
  )
}
