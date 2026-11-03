import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'motion/react'
import { GitBranch, Radio } from 'lucide-react'

import { Atlas, type Filters, type Selection } from './components/Atlas'
import { Analytics } from './components/Analytics'
import { DetailPanel } from './components/DetailPanel'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Starfield } from './components/Starfield'
import { atlas, type Tier } from './lib/atlas'

const NAV = [
  { href: '#atlas', label: '全景', id: '01' },
  { href: '#generations', label: '代际', id: '03' },
  { href: '#unit', label: '单价', id: '04' },
  { href: '#resonance', label: '共振', id: '05' },
]

export default function App() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 30, mass: 0.3 })
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
    <div id="top" className="relative min-h-screen overflow-x-clip bg-void text-snow">
      <Starfield />
      <div
        className="grid-floor pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          maskImage: 'radial-gradient(120% 80% at 50% 0%, black 10%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(120% 80% at 50% 0%, black 10%, transparent 78%)',
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-void via-void/70 to-transparent" />

      <motion.div
        style={{ scaleX: progress }}
        className="fixed left-0 top-0 z-[60] h-px w-full origin-left bg-gradient-to-r from-cyan via-mint to-amber"
      />

      <header className="fixed top-0 z-50 w-full border-b border-edge/40 bg-void/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 lg:px-8">
          <a href="#top" className="group flex items-center gap-2.5">
            <span className="relative flex h-6 w-6 items-center justify-center border border-cyan/60">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_10px_#38e2ff]" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-cyan/30" />
            </span>
            <span className="font-display text-[13px] font-semibold tracking-[0.18em] text-snow">
              算力全景
            </span>
            <span className="hidden font-mono text-[9px] tracking-[0.2em] text-fog/60 sm:inline">
              ATLAS / 2010—2026
            </span>
          </a>
          <div className="flex items-center gap-1 sm:gap-4">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="group flex items-baseline gap-1 px-1.5 py-1 font-mono text-[10px] tracking-wider text-fog transition-colors hover:text-snow"
              >
                <span className="text-[8px] text-cyan/50 group-hover:text-cyan">{n.id}</span>
                {n.label}
              </a>
            ))}
            <span className="mx-1 h-3 w-px bg-edge" />
            <span className="hidden font-mono text-[9px] text-fog/50 md:inline">
              快照 {atlas.generatedAt}
            </span>
          </div>
        </nav>
      </header>

      <Hero />
      <Atlas
        selection={selection}
        onSelect={setSelection}
        filters={filters}
        setFilters={setFilters}
      />
      <Analytics />
      <Footer />

      <DetailPanel selection={selection} onSelect={setSelection} onClose={() => setSelection(null)} />

      <div className="pointer-events-none fixed bottom-3 left-3 z-40 hidden items-center gap-3 font-mono text-[9px] text-fog/40 lg:flex">
        <span className="flex items-center gap-1">
          <GitBranch size={10} /> {atlas.counts.docxProducts} SKU
        </span>
        <span className="flex items-center gap-1">
          <Radio size={10} /> {atlas.counts.models} 模型
        </span>
      </div>
    </div>
  )
}
