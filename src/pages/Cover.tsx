import { motion, useReducedMotion } from 'motion/react'
import { ArrowDownRight, ArrowRight, CheckCircle2 } from 'lucide-react'

import { atlas, chinaProducts, reviewCoverage, TIER_META } from '../lib/atlas'
import { hrefOf, Link } from '../lib/router'
import { CountUp, EASE_OUT, Reveal, SpotlightCard } from '../components/motion'

const LAYERS = [
  { name: '架构世代', hint: 'Blackwell → Fermi', value: '10 代', tone: '#38e2ff' },
  { name: '芯片 / SKU', hint: '数据中心 · 专业 · 消费', value: `${atlas.products.length + atlas.extras.length} 款`, tone: '#38e2ff' },
  { name: '整机 · 超节点', hint: 'DGX / HGX / NVL72', value: `${atlas.servers.length} 台`, tone: '#ff5d73' },
  { name: '开源模型', hint: 'DeepSeek · GLM · Kimi', value: `${atlas.models.length} 节点`, tone: '#9270ff' },
  { name: '技术突破', hint: '架构 / 训练 / 推理 / 多模态', value: `${atlas.breakthroughs.length} 项`, tone: '#ffb545' },
]

const CHAPTERS: {
  to: string
  kind: string
  title: string
  blurb: string
  metric: string
  span: string
  big?: boolean
  wide?: boolean
}[] = [
  {
    to: '/atlas',
    kind: '一条时间轴',
    title: '全景时间轴',
    blurb: '五层内容压在同一个 2010-2026 的横轴上。点任意节点，右侧打开它的档案。',
    metric: `${atlas.products.length + atlas.extras.length + atlas.servers.length + atlas.models.length + atlas.breakthroughs.length} 个节点`,
    span: 'md:col-span-3',
    big: true,
  },
  {
    to: '/charts',
    kind: '读数',
    title: '算力怎么变便宜',
    blurb: '代际峰值、单位算力价格、模型与显存的年度共振，三条曲线回答同一件事。',
    metric: '3 张图',
    span: 'md:col-span-3',
    big: true,
  },
  {
    to: '/stack',
    kind: '配套能力',
    title: '产业链',
    blurb: '存储、互联、供电散热、制程、集群。',
    metric: '5 个维度',
    span: 'md:col-span-2',
  },
  {
    to: '/export',
    kind: '出口管制',
    title: '特供版',
    blurb: '被削掉的那几刀。',
    metric: `${chinaProducts().length} 款`,
    span: 'md:col-span-2',
  },
  {
    to: '/ledger',
    kind: '可信度',
    title: '复核台账',
    blurb: '每条数据核对过几次、最近是哪天。',
    metric: `${reviewCoverage().reviewed}/${reviewCoverage().total}`,
    span: 'md:col-span-2',
  },
  {
    to: '/about',
    kind: '方法与边界',
    title: '口径',
    blurb: '三份来源、字段含义、能写到什么程度。',
    metric: '3 份来源',
    span: 'md:col-span-6',
    wide: true,
  },
]

export function CoverPage() {
  const reduce = useReducedMotion()
  const rev = reviewCoverage()
  const coverage = rev.total ? Math.round((rev.reviewed / rev.total) * 1000) / 10 : 0

  return (
    <div className="mx-auto max-w-[1680px] px-4 lg:px-8">
      {/* ---------------------------------------------------------------- hero */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="mb-5 flex items-center gap-2"
          >
            <span className="h-px w-8 bg-cyan/60" />
            <span className="label-hud">AI COMPUTE ATLAS</span>
          </motion.div>

          <h1 className="font-display text-[46px] font-bold leading-[1.04] tracking-tight text-snow sm:text-[64px] lg:text-[76px]">
            <motion.span
              className="block"
              initial={reduce ? false : { opacity: 0, y: 26, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            >
              算力
            </motion.span>
            <motion.span
              className="block"
              initial={reduce ? false : { opacity: 0, y: 26, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.09, ease: EASE_OUT }}
            >
              <span className="text-glow text-cyan">全景</span>
              <span className="ml-3 align-top font-mono text-[11px] tracking-[0.32em] text-fog/60">
                ATLAS
              </span>
            </motion.span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT }}
            className="mt-5 max-w-lg text-[13.5px] leading-relaxed text-fog"
          >
            十代 NVIDIA 架构、{atlas.products.length + atlas.extras.length} 款芯片、
            {atlas.servers.length} 台整机与 {atlas.models.length} 个开源模型，
            压在同一条 2010-2026 的时间轴上。
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: EASE_OUT }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/atlas"
              className="group flex items-center gap-2 border border-cyan/60 bg-cyan/10 px-4 py-2.5 font-mono text-[11px] tracking-[0.14em] text-cyan transition-colors hover:bg-cyan/20 active:scale-[0.98]"
            >
              进入时间轴
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/charts"
              className="group flex items-center gap-2 border border-edge px-4 py-2.5 font-mono text-[11px] tracking-[0.14em] text-fog transition-colors hover:border-fog/60 hover:text-snow active:scale-[0.98]"
            >
              先看读数
              <ArrowDownRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* five-layer spine */}
        <div className="relative">
          <div className="pointer-events-none absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-cyan/50 via-violet/40 to-amber/40" />
          <div className="space-y-2">
            {LAYERS.map((l, i) => (
              <motion.div
                key={l.name}
                initial={reduce ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.24 + i * 0.07, ease: EASE_OUT }}
                className="group relative flex items-center gap-4 border border-edge/40 bg-hull/30 py-2.5 pl-3 pr-4 transition-colors hover:border-cyan/30 hover:bg-hull/60"
              >
                <span
                  className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border bg-void font-mono text-[9px]"
                  style={{ borderColor: `${l.tone}88`, color: l.tone }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] text-snow/90">{l.name}</span>
                  <span className="block font-mono text-[9px] text-fog/60">{l.hint}</span>
                </span>
                <span className="num shrink-0 text-[12px] text-fog transition-colors group-hover:text-snow">
                  {l.value}
                </span>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[9px] text-fog/45">
            <span>供给 ↑</span>
            <span>需求 ↓</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(['datacenter', 'workstation', 'consumer'] as const).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_META[t].color }} />
                <span className="font-mono text-[8.5px] text-fog/55">{TIER_META[t].short}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose" />
              <span className="font-mono text-[8.5px] text-fog/55">SYS</span>
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ chapters */}
      <section className="pb-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-edge/40 pb-3">
          <h2 className="font-display text-lg tracking-wide text-snow">目录</h2>
          <span className="font-mono text-[10px] text-fog/50">{CHAPTERS.length} 个章节，各自一页</span>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          {CHAPTERS.map((c, i) => (
            <Reveal key={c.to} delay={i * 0.05} className={c.span}>
              <Link to={c.to} className="block h-full">
                <SpotlightCard className="h-full border border-edge/50 bg-hull/30 hover:border-cyan/40">
                  {c.wide ? (
                    <div className="flex h-full flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
                      <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
                        <span className="label-hud">{c.kind}</span>
                        <h3 className="text-[16px] text-snow">{c.title}</h3>
                      </div>
                      <p className="flex-1 text-[11.5px] leading-relaxed text-fog/75">{c.blurb}</p>
                      <div className="flex items-center gap-4 font-mono text-[10px] text-cyan/80">
                        {c.metric}
                        <ArrowRight
                          size={13}
                          className="text-fog/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cyan"
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={
                        c.big
                          ? 'flex h-full min-h-[168px] flex-col p-5'
                          : 'flex h-full min-h-[136px] flex-col p-4'
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="label-hud">{c.kind}</span>
                        <ArrowRight
                          size={13}
                          className="mt-0.5 shrink-0 text-fog/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cyan"
                        />
                      </div>
                      <h3
                        className={
                          c.big
                            ? 'mt-3 font-display text-[26px] tracking-wide text-snow'
                            : 'mt-2 text-[16px] text-snow'
                        }
                      >
                        {c.title}
                      </h3>
                      <p className="mt-2 max-w-[38ch] flex-1 text-[11.5px] leading-relaxed text-fog/75">
                        {c.blurb}
                      </p>
                      <div className="mt-4 font-mono text-[10px] text-cyan/80">{c.metric}</div>
                    </div>
                  )}
                </SpotlightCard>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- status */}
      <section className="py-10">
        <Reveal>
          <div className="flex flex-col gap-4 border border-edge/50 bg-hull/25 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-amber" />
                <span className="font-mono text-[10px] tracking-[0.16em] text-amber/90">
                  数据可信度
                </span>
              </div>
              <p className="mt-2 max-w-xl text-[11.5px] leading-relaxed text-fog/80">
                全部数据由人工抓取整理，没有自动校验。每条记录都记着被核对过几次、最近一次是哪天，
                0 次就明写「未复核」。
              </p>
            </div>
            <div className="shrink-0 sm:min-w-[220px]">
              <div className="flex items-baseline justify-between font-mono text-[10px] text-fog/60">
                <span>复核覆盖</span>
                <span className="num text-[13px] text-snow">
                  <CountUp value={rev.reviewed} />/{rev.total}
                </span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden bg-edge/50">
                <motion.div
                  className="h-full bg-gradient-to-r from-mint to-cyan"
                  initial={reduce ? false : { width: 0 }}
                  whileInView={{ width: `${Math.max(coverage, 0.6)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: EASE_OUT }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-fog/45">
                <span>{coverage}%</span>
                <Link to="/ledger" className="text-cyan/80 hover:text-cyan">
                  看台账
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <div className="pb-4 text-center">
        <a
          href={hrefOf('/data/')}
          className="font-mono text-[10px] text-fog/45 transition-colors hover:text-cyan"
        >
          纯文本数据总表（供检索与对拍）
        </a>
      </div>
    </div>
  )
}
