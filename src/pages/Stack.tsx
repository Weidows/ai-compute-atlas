import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, CircuitBoard, Cpu, MemoryStick, Server, Thermometer } from 'lucide-react'

import {
  fmtCompact,
  fmtNum,
  industryOf,
  reviewCoverage,
} from '../lib/atlas'
import { Link } from '../lib/router'
import { EASE_OUT, Reveal } from '../components/motion'

/** 对数长度的条：128 GB/s 和 2.8 TB/s 放在同一列里也能看出量级差别。 */
function logWidth(value: number, min: number, max: number) {
  if (value <= 0) return 4
  const lo = Math.log10(Math.max(min, 1))
  const hi = Math.log10(Math.max(max, min * 10))
  return 8 + (84 * (Math.log10(value) - lo)) / (hi - lo)
}

function SourceLink({ href }: { href?: string }) {
  if (!href) return <span className="font-mono text-[9px] text-fog/30">无源</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="打开来源"
      className="inline-flex items-center gap-0.5 font-mono text-[9px] text-fog/45 transition-colors hover:text-cyan"
    >
      来源 <ArrowUpRight size={9} />
    </a>
  )
}

function Ratio({ from, to, unit }: { from: number; to: number; unit: string }) {
  const times = from > 0 ? to / from : null
  return (
    <span className="font-mono text-[10px] text-fog/60">
      {fmtNum(from, 0)} → {fmtNum(to, 0)} {unit}
      {times && <span className="ml-2 text-cyan/80">{times.toFixed(1)}×</span>}
    </span>
  )
}

const CHAIN = [
  { id: 'hbm', label: '存储', sub: 'HBM 代际', icon: MemoryStick, tone: '#9270ff' },
  { id: 'interconnect', label: '互联', sub: 'NVLink / IB', icon: CircuitBoard, tone: '#38e2ff' },
  { id: 'power', label: '供电散热', sub: '单柜功率', icon: Thermometer, tone: '#ff5d73' },
  { id: 'process', label: '制程', sub: '晶体管密度', icon: Cpu, tone: '#2fe6a8' },
  { id: 'clusters', label: '集群', sub: '需求端规模', icon: Server, tone: '#ffb545' },
]

export function StackPage() {
  const reduce = useReducedMotion()
  const ind = industryOf()
  const hbm = [...ind.hbm].sort((a, b) => a.year - b.year)
  const links = [...ind.interconnect].sort((a, b) => a.year - b.year)
  const racks = [...ind.power].sort((a, b) => a.year - b.year)
  const nodes = [...ind.process].sort((a, b) => a.year - b.year)
  const clusters = [...ind.clusters].sort((a, b) => a.year - b.year)
  const rev = reviewCoverage()
  const industryReviewed = rev.byKind?.industry?.reviewed ?? 0
  const industryTotal = rev.byKind?.industry?.total ?? hbm.length + links.length + racks.length + nodes.length + clusters.length

  const hbmBw = hbm.map((r) => r.bandwidthGbs)
  const linkGbs = links.filter((r) => r.scope === 'scale-up').map((r) => r.gbs)
  const rackKw = racks.map((r) => r.rackKw)
  const trans = nodes.map((r) => r.transistorsB)

  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 lg:px-8">
      <header className="pt-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-snow lg:text-[30px]">
          算力之外，还有五层配套
        </h1>
        <p className="mt-2 max-w-[66ch] text-[12.5px] leading-relaxed text-fog">
          一张卡能跑多快，取决于它身边的存储、互联、供电散热、制程和最终落地的集群规模。
          这一页把五个维度的代际数字排在一起，看瓶颈是怎么从算力一路挪到带宽、功耗和电力的。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-edge/40 py-3 font-mono text-[10px] text-fog/55">
          <span>外部口径 {ind.asOf ?? '—'}</span>
          <span>·</span>
          <span>
            {hbm.length + links.length + racks.length + nodes.length + clusters.length} 条记录
          </span>
          <span>·</span>
          <span>复核 {industryReviewed}/{industryTotal}</span>
          <span className="text-amber/70">每行附来源，未复核的按未复核算</span>
        </div>
      </header>

      {/* chain strip */}
      <nav className="mt-6 grid gap-2 sm:grid-cols-5" aria-label="产业链维度">
        {CHAIN.map((c, i) => {
          const Icon = c.icon
          return (
            <motion.a
              key={c.id}
              href={`#${c.id}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: EASE_OUT }}
              className="group flex items-center gap-3 border border-edge/50 bg-hull/30 px-3 py-2.5 transition-colors hover:border-cyan/40"
            >
              <Icon size={14} style={{ color: c.tone }} />
              <span className="min-w-0">
                <span className="block text-[12px] text-snow/90">{c.label}</span>
                <span className="block font-mono text-[9px] text-fog/55">{c.sub}</span>
              </span>
            </motion.a>
          )
        })}
      </nav>

      {/* ------------------------------------------------------------------ HBM */}
      <section id="hbm" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-xl tracking-wide text-snow">存储：堆得更高，也更快</h2>
          <Ratio from={hbmBw[0]} to={hbmBw[hbmBw.length - 1]} unit="GB/s 单堆" />
        </div>
        <p className="mt-3 max-w-[64ch] text-[11.5px] leading-relaxed text-fog/70">
          单堆容量从 4GB 走到 48GB，靠的是层数（4 → 8 → 12 → 16）和位宽（1024 → 2048-bit）一起加，
          带宽再随引脚速率翻倍。GPU 侧的显存总量则由「用几个堆叠」决定。
        </p>

        <div className="mt-5 space-y-2">
          {hbm.map((r, i) => (
            <motion.div
              key={r.id}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.24), ease: EASE_OUT }}
              className="grid gap-2 border border-edge/30 bg-hull/20 px-3 py-3 sm:grid-cols-[150px_1fr_120px_170px] sm:items-center"
            >
              <div>
                <div className="text-[12.5px] text-snow">{r.name}</div>
                <div className="font-mono text-[9px] text-fog/50">{r.year}</div>
              </div>
              <div className="min-w-0">
                <div className="h-1.5 w-full bg-edge/40">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet/70 to-cyan"
                    initial={reduce ? false : { width: 0 }}
                    whileInView={{ width: `${logWidth(r.bandwidthGbs, Math.min(...hbmBw), Math.max(...hbmBw))}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
                  />
                </div>
                <div className="mt-1 font-mono text-[9px] text-fog/45">
                  {r.busBits}-bit · 单堆 {r.stackGb}GB（最高 {r.maxStackGb}GB）
                </div>
              </div>
              <div className="num text-[11.5px] text-snow/90">
                {fmtNum(r.bandwidthGbs, 0)} GB/s
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] leading-snug text-fog/60">{r.firstUse}</div>
                <SourceLink href={r.source} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- interconnect */}
      <section id="interconnect" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-xl tracking-wide text-snow">互联：把卡连成一台机器</h2>
          <Ratio from={linkGbs[0]} to={linkGbs[linkGbs.length - 1]} unit="GB/s 单卡" />
        </div>
        <p className="mt-3 max-w-[66ch] text-[11.5px] leading-relaxed text-fog/70">
          卡内靠 scale-up 总线（NVLink）连成域，域间靠 scale-out 网络（InfiniBand / 以太网 / 光模块）。
          NVLink 十年涨了 20 倍上下，scale-out 从 200G 走到 1.6T，光互联开始从可插拔模块往共封装走。
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <div className="label-hud">scale-up · 域内</div>
            {links
              .filter((r) => r.scope === 'scale-up')
              .map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.35, delay: i * 0.03, ease: EASE_OUT }}
                  className="grid grid-cols-[110px_1fr_96px] items-center gap-2 border border-edge/30 bg-hull/20 px-3 py-2"
                >
                  <span className="text-[12px] text-snow/90">
                    {r.name}
                    <span className="ml-1 font-mono text-[9px] text-fog/45">{r.year}</span>
                  </span>
                  <div className="h-1 w-full bg-edge/40">
                    <motion.div
                      className="h-full bg-cyan/70"
                      initial={reduce ? false : { width: 0 }}
                      whileInView={{
                        width: `${logWidth(r.gbs, Math.min(...linkGbs), Math.max(...linkGbs))}%`,
                      }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: EASE_OUT }}
                    />
                  </div>
                  <span className="num text-right text-[11px] text-snow/85">
                    {fmtNum(r.gbs, 0)} GB/s
                  </span>
                </motion.div>
              ))}
          </div>

          <div className="space-y-2">
            <div className="label-hud">scale-out · 域间</div>
            {links
              .filter((r) => r.scope !== 'scale-up')
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 border border-edge/30 bg-hull/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] text-snow/90">
                      {r.name}
                      <span className="ml-1.5 font-mono text-[9px] text-fog/45">{r.firstUse}</span>
                    </div>
                    <div className="font-mono text-[9px] text-fog/50">{r.note}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-[11px] text-snow/85">
                      {r.scope === 'optics'
                        ? `${fmtNum(r.gbs / 1000, 1)} Tb/s 整机`
                        : `${fmtNum(r.gbs, 0)} Gb/s`}
                    </div>
                    <SourceLink href={r.source} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- power */}
      <section id="power" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-xl tracking-wide text-snow">供电与散热：一柜一兆瓦</h2>
          <Ratio from={rackKw[0]} to={rackKw[rackKw.length - 1]} unit="kW 单柜" />
        </div>
        <p className="mt-3 max-w-[66ch] text-[11.5px] leading-relaxed text-fog/70">
          风冷机柜的上限在 15 到 20 kW 附近，120 kW 的 GB200 NVL72 只能上液冷；
          再往上走，800V 直流和液冷一起进场。功率曲线是散热与电源产业链最直接的驱动。
        </p>

        <div className="mt-5 space-y-2">
          {racks.map((r, i) => (
            <motion.div
              key={r.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.35, delay: i * 0.03, ease: EASE_OUT }}
              className="grid gap-2 border border-edge/30 bg-hull/20 px-3 py-2.5 sm:grid-cols-[190px_1fr_150px_90px] sm:items-center"
            >
              <div>
                <div className="text-[12px] text-snow/90">{r.name}</div>
                <div className="font-mono text-[9px] text-fog/50">
                  {r.year} · {r.gpus}× {r.gpuType}
                </div>
              </div>
              <div className="h-1.5 w-full bg-edge/40">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber/70 to-rose"
                  initial={reduce ? false : { width: 0 }}
                  whileInView={{
                    width: `${logWidth(r.rackKw, Math.min(...rackKw), Math.max(...rackKw))}%`,
                  }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
              </div>
              <div className="num text-[11.5px] text-snow/90">{fmtNum(r.rackKw, 0)} kW</div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="border border-edge/60 px-1.5 py-0.5 font-mono text-[9px] text-fog/60">
                  {r.cooling}
                </span>
                <SourceLink href={r.source} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- process */}
      <section id="process" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-xl tracking-wide text-snow">制程：一颗芯片塞进多少晶体管</h2>
          <Ratio from={trans[0]} to={trans[trans.length - 1]} unit="十亿晶体管" />
        </div>
        <p className="mt-3 max-w-[66ch] text-[11.5px] leading-relaxed text-fog/70">
          40nm 的 30 亿晶体管到 3nm 的 3360 亿，靠的不只是节点缩小：双 die 封装把两颗光罩级芯片接成一颗，
          台积电 3nm 产能里 AI 占比从 2025 年的 5% 涨到 2026 年的三成以上。
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((r, i) => (
            <motion.div
              key={r.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2), ease: EASE_OUT }}
              className="border border-edge/30 bg-hull/20 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[15px] text-snow">{r.name}</span>
                <span className="font-mono text-[9px] text-fog/50">
                  {r.vendor} · {r.year}
                </span>
              </div>
              <div className="mt-1 font-mono text-[9.5px] text-fog/55">{r.archs.join(' / ')}</div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="num text-[12px] text-snow/85">{fmtNum(r.transistorsB, 1)}B 晶体管</span>
                <SourceLink href={r.source} />
              </div>
              <div className="mt-2 h-1 w-full bg-edge/40">
                <motion.div
                  className="h-full bg-mint/70"
                  initial={reduce ? false : { width: 0 }}
                  whileInView={{
                    width: `${Math.max(6, (r.transistorsB / Math.max(...trans)) * 100)}%`,
                  }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- clusters */}
      <section id="clusters" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-xl tracking-wide text-snow">集群：把算力堆到电网门口</h2>
          <Ratio
            from={clusters[0]?.gpus ?? 0}
            to={Math.max(...clusters.map((c) => c.gpus ?? 0))}
            unit="卡"
          />
        </div>
        <p className="mt-3 max-w-[66ch] text-[11.5px] leading-relaxed text-fog/70">
          集群规模是最容易被夸大的维度，这里保留运营方口径并标注状态：已投运、扩建中、还是规划。
          数字变动的速度比规格书快得多，引用前请回到来源核对。
        </p>

        <div className="mt-5 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c, i) => (
            <motion.div
              key={c.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.25), ease: EASE_OUT }}
              className="flex flex-col border border-edge/30 bg-hull/20 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-snow">{c.name}</span>
                <span className="font-mono text-[9px] text-fog/50">{c.year}</span>
              </div>
              <div className="mt-0.5 font-mono text-[9px] text-fog/50">
                {c.operator} · {c.gpuType}
              </div>
              <div className="mt-3 flex items-baseline gap-4">
                <div>
                  <div className="font-mono text-[9px] text-fog/45">GPU</div>
                  <div className="num text-[15px] text-snow">
                    {c.gpus ? fmtCompact(c.gpus) : '未公开'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-fog/45">功率</div>
                  <div className="num text-[15px] text-snow">
                    {c.powerMw ? `${fmtNum(c.powerMw, 0)} MW` : '未公开'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="border border-amber/30 px-1.5 py-0.5 font-mono text-[9px] text-amber/80">
                  {c.status}
                </span>
                <SourceLink href={c.source} />
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-fog/65">{c.note}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Reveal className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5">
        <p className="max-w-[62ch] font-mono text-[10px] leading-relaxed text-fog/50">
          五个维度的数字来自公开报道与厂商规范页，和芯片表不是同一份文档，所以每条都带来源链接。
          核对后可在台账里逐条记账，来源失效或口径冲突时以官方规格书为准。
        </p>
        <div className="flex gap-2">
          <Link
            to="/ledger"
            className="border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
          >
            复核台账
          </Link>
          <Link
            to="/charts"
            className="border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
          >
            ← 回到读数
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
