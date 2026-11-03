import { ArrowUpRight, Database, ExternalLink } from 'lucide-react'

import { atlas, chinaProducts } from '../lib/atlas'

const SOURCES = [
  {
    name: 'NVIDIA 显卡历代产品全览',
    note: 'Word 文档 · 10 张表 · 7 个世代 + 附录（Maxwell / Kepler / Fermi）',
    href: '',
  },
  {
    name: 'gpu-server-compare',
    note: '41 款卡 · 15 台整机/超节点 · 现货行情快照',
    href: 'https://github.com/Weidows/gpu-server-compare',
  },
  {
    name: 'model-chronicle',
    note: 'Hugging Face 官方 API 快照 · DeepSeek / GLM / Kimi',
    href: 'https://github.com/Weidows/model-chronicle',
  },
]

export function Footer() {
  return (
    <footer className="relative mx-auto max-w-[1680px] border-t border-edge/50 px-4 py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="label-hud mb-3">07 / METHOD & SOURCES</div>
          <h3 className="font-display text-[15px] tracking-wide text-snow">口径与边界</h3>
          <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-fog/80">
            <li className="flex gap-2">
              <span className="text-cyan">·</span>
              <span>
                芯片规格取全览文档原文：FP32 标「约」的为按「CUDA 核心 × 2 × Boost」估算；数据中心卡张量算力按稀疏值记录，
                约为稠密 2 倍。<span className="text-amber/80">不同架构的浮点与张量指标不可直接跨代相比。</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan">·</span>
              <span>
                价格是 {atlas.market.updatedAt} 的中国区参考价与卖方报价快照，含渠道溢价；整机价按「套」计，单卡折算是机械除法，不代表可单独购买。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan">·</span>
              <span>
                整机上市时间未在行情数据中记录，图上按所用 GPU 平台的首发日推断，档案里标注「随某平台上市」，不当作产品发布日。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan">·</span>
              <span>
                模型侧全部来自 Hugging Face 官方 API 与模型卡；下载量是滚动 30 天口径。{chinaProducts().length} 款中国特供按文档「中国特供」字段标注。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber">·</span>
              <span>
                本页只做数据整理与可视化，不构成采购或投资建议。型号规格以 NVIDIA 官方最新公布为准。
              </span>
            </li>
          </ul>
        </div>

        <div>
          <div className="label-hud mb-3 flex items-center gap-1.5">
            <Database size={11} /> 三份原始资料
          </div>
          <div className="space-y-2">
            {SOURCES.map((s) => (
              <div key={s.name} className="border border-edge/50 bg-hull/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] text-snow/90">{s.name}</span>
                  {s.href ? (
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-fog/60 transition-colors hover:text-cyan"
                      aria-label={`打开 ${s.name}`}
                    >
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="font-mono text-[9px] text-fog/40">本地</span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[9.5px] leading-relaxed text-fog/60">{s.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[9px] text-fog/50">
            <span>{atlas.counts.docxProducts} NVIDIA SKU</span>
            <span>·</span>
            <span>{atlas.counts.extraProducts} 其他厂商</span>
            <span>·</span>
            <span>{atlas.counts.models} 模型</span>
            <span>·</span>
            <span>{atlas.counts.breakthroughs} 突破</span>
          </div>

          <div className="mt-5 border-t border-edge/40 pt-3">
            <div className="label-hud mb-2">文本版 · 可检索</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
              <a href={`${import.meta.env.BASE_URL}data/`} className="text-fog hover:text-cyan">
                完整数据总表 →
              </a>
              <a href={`${import.meta.env.BASE_URL}china/`} className="text-fog hover:text-cyan">
                中国特供 GPU →
              </a>
              <a href={`${import.meta.env.BASE_URL}sitemap.xml`} className="text-fog hover:text-cyan">
                sitemap
              </a>
              <a href={`${import.meta.env.BASE_URL}data/atlas.json`} className="text-fog hover:text-cyan">
                atlas.json
              </a>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9.5px] text-fog/50">
              {['blackwell', 'hopper', 'ada-lovelace', 'ampere', 'turing', 'volta', 'pascal'].map((s) => (
                <a key={s} href={`${import.meta.env.BASE_URL}generations/${s}/`} className="hover:text-cyan">
                  {s}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-edge/40 pt-4 font-mono text-[9px] text-fog/40">
        <span>AI COMPUTE ATLAS · 静态站点 · 数据快照 {atlas.generatedAt}</span>
        <a href="#top" className="flex items-center gap-1 hover:text-cyan">
          回到顶部 <ArrowUpRight size={10} />
        </a>
      </div>
    </footer>
  )
}
