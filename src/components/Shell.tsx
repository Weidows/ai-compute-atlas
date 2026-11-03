import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Menu, X } from 'lucide-react'

import { atlas, reviewCoverage } from '../lib/atlas'
import { hrefOf, Link, ROUTES, useRoute } from '../lib/router'
import { cn } from '../lib/cn'
import { EASE_OUT } from './motion'
import { Starfield } from './Starfield'

/** 顶部导航：桌面一行，移动端整屏遮罩。 */
function SiteHeader({ path }: { path: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [path])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/40 bg-void/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-4 px-4 lg:px-8">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="算力全景 首页">
            <span className="relative flex h-6 w-6 items-center justify-center border border-cyan/60">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_10px_#38e2ff]" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-cyan/30" />
            </span>
            <span className="font-display text-[13px] font-semibold tracking-[0.18em] text-snow">
              算力全景
            </span>
            <span className="hidden font-mono text-[9px] tracking-[0.2em] text-fog/60 sm:inline">
              ATLAS / 2010-2026
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="主导航">
            {ROUTES.filter((r) => r.path !== '/').map((r) => {
              const active = path === r.path
              return (
                <Link
                  key={r.path}
                  to={r.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative rounded-sm px-3 py-2 font-mono text-[11px] tracking-[0.14em] transition-colors',
                    active ? 'text-snow' : 'text-fog hover:text-snow',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-sm border border-cyan/35 bg-cyan/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span className="relative">{r.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[9px] tracking-[0.16em] text-fog/50 lg:inline">
              快照 {atlas.generatedAt}
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? '关闭菜单' : '打开菜单'}
              aria-expanded={open}
              className="flex h-8 w-8 items-center justify-center border border-edge/80 text-fog transition-colors hover:border-cyan/40 hover:text-snow md:hidden"
            >
              {open ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[75] bg-void/95 backdrop-blur-xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex h-14 items-center justify-between border-b border-edge/40 px-4">
              <span className="font-display text-[13px] tracking-[0.18em] text-snow">算力全景</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭菜单"
                className="flex h-8 w-8 items-center justify-center border border-edge/80 text-fog"
              >
                <X size={15} />
              </button>
            </div>
            <nav className="px-4 py-6" aria-label="移动端导航">
              {ROUTES.filter((r) => r.path !== '/').map((r, i) => (
                <motion.div
                  key={r.path}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: EASE_OUT }}
                >
                  <Link
                    to={r.path}
                    className="flex items-baseline justify-between border-b border-edge/30 py-3.5"
                  >
                    <span className="text-[19px] text-snow">{r.label}</span>
                    <span className="font-mono text-[10px] text-fog/60">{r.path}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="px-4 font-mono text-[10px] leading-relaxed text-fog/50">
              数据快照 {atlas.generatedAt}
              <br />
              复核 {reviewCoverage().reviewed}/{reviewCoverage().total} 项
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** 路由切换时的一道扫描线：告诉用户「换了页面」，不抢内容。 */
function RouteSweep({ path }: { path: string }) {
  return (
    <motion.div
      key={path}
      initial={{ scaleX: 0, opacity: 0.9 }}
      animate={{ scaleX: 1, opacity: 0 }}
      transition={{ duration: 0.75, ease: EASE_OUT }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px origin-left bg-gradient-to-r from-cyan via-mint to-amber"
      aria-hidden
    />
  )
}

function SiteFooter() {
  const rev = reviewCoverage()
  const chapters = ROUTES.filter((r) => r.path !== '/')
  const text = [
    { href: hrefOf('/data/'), label: '数据总表' },
    { href: hrefOf('/china/'), label: '中国特供' },
    { href: hrefOf('/review/'), label: '复核清单' },
    { href: hrefOf('/data/atlas.json'), label: 'atlas.json' },
    { href: hrefOf('/sitemap.xml'), label: 'sitemap' },
    { href: 'https://github.com/Weidows/ai-compute-atlas', label: '源码' },
  ]

  return (
    <footer className="relative mx-auto mt-20 max-w-[1680px] border-t border-edge/50 px-4 pb-10 pt-10 lg:px-8">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="font-display text-[13px] tracking-[0.18em] text-snow">
            算力全景 · AI COMPUTE ATLAS
          </div>
          <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-fog/75">
            三份来源、一份快照。芯片规格来自 NVIDIA 全览文档，行情与整机来自
            gpu-server-compare，模型数据来自 Hugging Face 官方 API。
          </p>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-fog/50">
            人工复核 {rev.reviewed}/{rev.total}
            {rev.lastReviewedAt ? ` · 最近 ${rev.lastReviewedAt}` : ' · 尚无记录'}
          </p>
        </div>

        <div>
          <div className="label-hud mb-2">章节</div>
          <ul className="space-y-1.5">
            {chapters.map((r) => (
              <li key={r.path}>
                <Link to={r.path} className="text-[12px] text-fog transition-colors hover:text-cyan">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="label-hud mb-2">文本版 / 可检索</div>
          <ul className="space-y-1.5">
            {text.map((t) => (
              <li key={t.label}>
                <a
                  href={t.href}
                  className="inline-flex items-center gap-1 text-[12px] text-fog transition-colors hover:text-cyan"
                  {...(t.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {t.label}
                  {t.href.startsWith('http') && <ArrowUpRight size={10} />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-edge/40 pt-4 font-mono text-[9px] text-fog/40">
        <span>快照 {atlas.generatedAt} · 数据人工整理，不构成采购或投资建议</span>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-1 hover:text-cyan"
        >
          回到顶部 <ArrowUpRight size={10} />
        </button>
      </div>
    </footer>
  )
}

/** 全站外壳：固定背景、导航、转场，页面只负责内容。 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { path } = useRoute()
  return (
    <div id="top" className="relative min-h-[100dvh] overflow-x-clip bg-void text-snow">
      <Starfield />
      <div
        className="grid-floor pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          maskImage: 'radial-gradient(120% 80% at 50% 0%, black 10%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(120% 80% at 50% 0%, black 10%, transparent 78%)',
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-void via-void/70 to-transparent" />

      <RouteSweep path={path} />
      <SiteHeader path={path} />

      <main className="relative z-10 pt-14">{children}</main>
      <SiteFooter />
    </div>
  )
}
