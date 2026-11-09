import { useEffect, useState } from 'react'

import { Atlas, type Filters, type Selection } from '../components/Atlas'
import { DetailPanel } from '../components/DetailPanel'
import { atlas, type Tier } from '../lib/atlas'

/**
 * 时间轴章节：整页控制在一屏内（1440x900 不需要竖向滚动），
 * 横向平移交给 Shift+滚轮 / 拖拽 / 触控板横划；子页面不设页脚。
 */
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
    <div className="pt-2">
      <Atlas selection={selection} onSelect={setSelection} filters={filters} setFilters={setFilters} />
      <DetailPanel selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />
    </div>
  )
}
