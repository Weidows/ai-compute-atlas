import { CircleDollarSign, GitBranch, Radio } from 'lucide-react'

import { GenerationLadder, PriceScatter, Resonance, SectionHead } from '../components/Analytics'
import { Reveal } from '../components/motion'
import { generationGain } from '../lib/atlas'
import { Link } from '../lib/router'

export function ChartsPage() {
  const gain = generationGain()
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 lg:px-8">
      <header className="pt-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-snow lg:text-[30px]">
          算力便宜得有多快
        </h1>
        <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-fog">
          三张图回答同一个问题：每一代硬件把单位算力推便宜了多少，模型又追得多快。
          图里的数都来自同一份快照，口径见「口径」页。
        </p>
      </header>

      <section className="mt-12">
        <Reveal>
          <SectionHead
            label="GENERATIONS"
            title={`代际跃迁：算力 ${gain.fp ? gain.fp.toFixed(1) : '—'}×，显存 ${gain.vram ? gain.vram.toFixed(1) : '—'}×`}
            note="同一世代按数据中心卡的最高规格取峰值；FP32 与显存不同量纲，柱长只表达相对量级。"
            icon={<GitBranch size={11} />}
          />
        </Reveal>
        <Reveal delay={0.06}>
          <GenerationLadder />
        </Reveal>
      </section>

      <section className="mt-16">
        <Reveal>
          <SectionHead
            label="UNIT ECONOMICS"
            title="一块 TFLOPS 要多少钱"
            note="横轴 FP32、纵轴中国区参考价，均为对数刻度；琥珀虚线是等价比线，越靠右下单位算力越贵。"
            icon={<CircleDollarSign size={11} />}
          />
        </Reveal>
        <Reveal delay={0.06}>
          <PriceScatter />
        </Reveal>
      </section>

      <section className="mt-16">
        <Reveal>
          <SectionHead
            label="RESONANCE"
            title="模型在追硬件，还是硬件在追模型"
            note="按年对齐：左轴是当年最大单卡显存，右轴是当年最大开源模型参数量，底柱是当年发布数量。"
            icon={<Radio size={11} />}
          />
        </Reveal>
        <Reveal delay={0.06}>
          <Resonance />
        </Reveal>
      </section>

      <Reveal className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5">
          <p className="max-w-md font-mono text-[10px] leading-relaxed text-fog/50">
            想看具体型号？回到时间轴点节点，或去「特供版」看被削掉的那几款。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/atlas"
              className="border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
            >
              ← 回到时间轴
            </Link>
            <Link
              to="/export"
              className="group flex items-center gap-2 border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
            >
              下一章：特供版
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
