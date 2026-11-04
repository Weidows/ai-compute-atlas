import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Shell } from './components/Shell'
import { pageTransition, pageVariants } from './components/motion'
import { usePageMeta, useRoute, type RoutePath } from './lib/router'
import { AboutPage } from './pages/About'
import { ChartsPage } from './pages/Charts'
import { CoverPage } from './pages/Cover'
import { ExportPage } from './pages/Export'
import { LedgerPage } from './pages/Ledger'
import { StackPage } from './pages/Stack'
import { TimelinePage } from './pages/Timeline'

const PAGES: Record<RoutePath, () => React.JSX.Element> = {
  '/': CoverPage,
  '/atlas': TimelinePage,
  '/charts': ChartsPage,
  '/stack': StackPage,
  '/export': ExportPage,
  '/ledger': LedgerPage,
  '/about': AboutPage,
}

export default function App() {
  const { path, meta } = useRoute()
  const reduce = useReducedMotion()
  usePageMeta(meta)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [path])

  const Page = PAGES[path] ?? CoverPage

  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={path}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={reduce ? { duration: 0 } : pageTransition}
        >
          <Page />
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}
