import { ArrowUpRight, Database, FileText, GitBranch } from 'lucide-react'

import { atlas, chinaProducts, reviewCoverage } from '../lib/atlas'
import { hrefOf, Link } from '../lib/router'
import { Reveal } from '../components/motion'

const SOURCES = [
  {
    name: 'NVIDIA 显卡历代产品全览',
    kind: 'Word 文档 · 10 张表',
    note: '型号、类别、CUDA 核心、显存、FP32、首发时间与备注。解析结果快照在 vendor/docx-products.json。',
    icon: FileText,
    href: '',
  },
  {
    name: 'gpu-server-compare（已并入）',
    kind: '41 卡 · 15 台整机 · 现货报价',
    note: '行情、性能索引、整机规格与报价台账。数据在 vendor/gpu-server-compare。',
    icon: Database,
    href: 'https://github.com/Weidows/ai-compute-atlas/tree/main/vendor/gpu-server-compare',
  },
  {
    name: 'model-chronicle（已并入）',
    kind: 'Hugging Face 官方 API 快照',
    note: `DeepSeek / GLM / Kimi 共 ${atlas.models.length} 个发布节点与 ${atlas.breakthroughs.length} 项技术突破。`,
    icon: GitBranch,
    href: 'https://github.com/Weidows/ai-compute-atlas/tree/main/vendor/model-chronicle',
  },
]

const RULES = [
  'FP32 标「约」的是按「CUDA 核心 × 2 × Boost」估算；数据中心卡的张量算力按稀疏值记录，约为稠密 2 倍。',
  '不同架构的浮点与张量指标不可直接跨代相比，柱长只表达相对量级。',
  '价格是中国区参考价与卖方报价快照，含渠道溢价；整机价按「套」计，单卡折算是机械除法。',
  '整机没有独立发布日，按所用 GPU 平台的首发日推断，档案里写「随某平台上市」，不冒充产品发布日。',
  '模型下载量是 Hugging Face 滚动 30 天口径；模型卡没写的字段留空，不做推测。',
  '多 GPU 板卡同时记录「板卡总量」与「单卡容量」，时间轴与气泡用单卡容量。',
]

const TEXT_PAGES = [
  { href: hrefOf('/data/'), label: '数据总表', note: '154 款产品 / 84 个模型 / 15 台整机' },
  { href: hrefOf('/china/'), label: '中国特供', note: `${chinaProducts().length} 款与被削规格` },
  { href: hrefOf('/review/'), label: '复核清单', note: '逐条次数与日期' },
  { href: hrefOf('/generations/blackwell/'), label: '分世代档案', note: '10 个架构各一页' },
  { href: hrefOf('/models/deepseek/'), label: '实验室年表', note: 'DeepSeek / GLM / Kimi' },
  { href: hrefOf('/data/atlas.json'), label: 'atlas.json', note: '机器可读快照' },
]

export function AboutPage() {
  const rev = reviewCoverage()
  const industryCount = atlas.counts.industry ?? 0
  const supplements = atlas.supplements ?? []
  const supplementFields = atlas.counts.supplements ?? 0
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 lg:px-8">
      <header className="pt-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-snow lg:text-[30px]">
          口径与来源
        </h1>
        <p className="mt-2 max-w-[64ch] text-[12.5px] leading-relaxed text-fog">
          这份图册只做资料整理与可视化，不构成采购或投资建议。下面写清楚每层数据从哪来、
          哪些字段是估算、哪些地方刻意留白。
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-lg tracking-wide text-snow">三份原始资料</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {SOURCES.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.name} delay={i * 0.06}>
                <div className="flex h-full flex-col border border-edge/50 bg-hull/30 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Icon size={14} className="text-cyan/80" />
                    {s.href && (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`打开 ${s.name}`}
                        className="text-fog/50 transition-colors hover:text-cyan"
                      >
                        <ArrowUpRight size={13} />
                      </a>
                    )}
                  </div>
                  <div className="mt-3 text-[13px] text-snow/90">{s.name}</div>
                  <div className="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-fog/55">{s.kind}</div>
                  <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-fog/75">{s.note}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
        <p className="mt-3 max-w-[70ch] text-[11px] leading-relaxed text-fog/60">
          产业链章节（HBM、互联、供电散热、制程、集群）不在上面三份文档里：那 {industryCount} 条是人工整理的公开口径，
          逐条附来源链接，存于 data/industry.json，页面标注为「外部口径」。
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-lg tracking-wide text-snow">
          二手补充来源 <span className="ml-1 font-mono text-[10px] text-fog/50">{supplements.length} 篇 · {supplementFields} 个字段</span>
        </h2>
        <p className="mt-2 max-w-[76ch] text-[11.5px] leading-relaxed text-fog/70">
          有些字段官方从没公开，或者只精确到年份（例如 PCIe 版的功耗、某张卡的发布日）。这类空白用行业汇总文章补，
          每补一个字段都记下「来自哪篇、把握多大」，档案卡里带「补」角标。
          <span className="text-fog/50">补录只填空，不覆盖；和文章冲突的地方一律保留本地口径，并把冲突记进来源文件。</span>
        </p>
        <div className="mt-4 grid gap-2">
          {supplements.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.05}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border border-edge/40 bg-hull/25 px-3 py-2">
                <a
                  href={s.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] text-snow/90 underline decoration-edge underline-offset-2 transition-colors hover:text-cyan"
                >
                  {s.title ?? s.id}
                  <ArrowUpRight size={11} className="ml-0.5 inline" />
                </a>
                <span className="font-mono text-[9px] text-fog/55">
                  {s.author ?? '佚名'} · {s.publishedAt ?? '—'} · 补 {s.applied.length} 字段
                  {s.conflicts.length > 0 && <span className="text-amber/70"> · 冲突 {s.conflicts.length}</span>}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h2 className="font-display text-lg tracking-wide text-snow">字段口径</h2>
          <ul className="mt-4 space-y-3">
            {RULES.map((r, i) => (
              <Reveal key={r} delay={i * 0.03} y={12}>
                <li className="flex gap-3 border-l border-edge/60 pl-3 text-[11.5px] leading-relaxed text-fog/80">
                  <span className="font-mono text-[9px] text-cyan/50">{String(i + 1).padStart(2, '0')}</span>
                  <span>{r}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg tracking-wide text-snow">可信度</h2>
          <Reveal>
            <div className="mt-4 border border-edge/50 bg-hull/25 p-4">
              <div className="flex items-baseline justify-between font-mono text-[10px] text-fog/60">
                <span>人工复核</span>
                <span className="num text-[13px] text-snow">
                  {rev.reviewed}/{rev.total}
                </span>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-fog/75">
                所有条目都是手工抓取整理，没有自动校验。每条记录带「复核次数 + 最近复核时间」，
                0 次就显示「未复核」。复核只表示有人按来源重新核对过，不代表所有字段都被独立验证。
              </p>
              <div className="mt-3 flex items-center gap-4 font-mono text-[10px]">
                <Link to="/ledger" className="text-cyan hover:underline">
                  复核台账 →
                </Link>
                <span className="text-fog/45">
                  {rev.lastReviewedAt ? `最近 ${rev.lastReviewedAt}` : '尚无记录'}
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-lg tracking-wide text-snow">文本版与快照</h2>
        <p className="mt-1 max-w-[60ch] text-[11.5px] leading-relaxed text-fog/70">
          交互版之外，同一份快照还有纯 HTML 的文本页与机器可读 JSON，方便检索、引用与对拍。
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_PAGES.map((t) => (
            <a
              key={t.label}
              href={t.href}
              className="flex items-baseline justify-between gap-3 border border-edge/50 bg-hull/25 px-3 py-2.5 transition-colors hover:border-cyan/40"
            >
              <span className="text-[12px] text-snow/90">{t.label}</span>
              <span className="font-mono text-[9px] text-fog/50">{t.note}</span>
            </a>
          ))}
        </div>
      </section>

      <Reveal className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5 font-mono text-[10px] text-fog/50">
        <span>
          数据快照 {atlas.generatedAt} · {atlas.counts.docxProducts} 款 NVIDIA SKU ·{' '}
          {atlas.counts.extraProducts} 款他厂 · {atlas.counts.servers} 台整机
        </span>
        <Link to="/atlas" className="text-cyan/80 hover:text-cyan">
          回到时间轴 →
        </Link>
      </Reveal>
    </div>
  )
}
