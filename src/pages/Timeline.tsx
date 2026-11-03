import { useEffect, useState } from 'react'

import { Atlas, type Filters, type Selection } from '../components/Atlas'
import { DetailPanel } from '../components/DetailPanel'
import { Reveal } from '../components/motion'
import { atlas, type Tier } from '../lib/atlas'
import { Link } from '../lib/router'

export function TimelinePage() {
  const [selection, setSelection] = useState<Selection>(null)
  const [filters, setFilters] = useState<Filters>({
    tiers: new Set<Tier>(['datacenter', 'workstation', 'consumer', 'semi']),
    orgs: new Set(atlas.orgs.map((o) => o.id)),
    chinaOnly: false,
    labels: false,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="pt-6">
      <Atlas selection={selection} onSelect={setSelection} filters={filters} setFilters={setFilters} />
      <DetailPanel selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />

      <Reveal className="mx-auto mt-4 max-w-[1680px] px-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5">
          <p className="max-w-lg font-mono text-[10px] leading-relaxed text-fog/50">
            圆点大小 = 单卡显存；实心 = 有行情/性能数据；空心虚线 = 仅文档收录。缩放滑杆控制每年占宽，
            「全部标注」强制显示所有标签。
          </p>
          <Link
            to="/charts"
            className="group flex items-center gap-2 border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
          >
            下一章：四条读数
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
