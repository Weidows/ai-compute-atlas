import { useEffect, useState } from 'react'

/**
 * 时间轴是固定画布（纵向 680px 的分层），在 2K / 4K 屏上按原尺寸渲染会显得小。
 * 这里按「视口高度 / 画布布局高度」算一个整体缩放系数，交给 CSS zoom：
 * 文字、圆点、条带一起等比放大，横向仍然是同一套 px/年 逻辑。
 *
 * 注意：offsetHeight 返回的是缩放前的布局高度，所以量一次就能定住，不会自己越滚越大。
 */
const CHROME = 80 // 顶栏 56 + 章节顶部内边距 8 + 尾部留白 8 + 4px 余量
const MAX = 1.6
const MIN = 1

export function useAtlasZoom(): number {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      const el = document.getElementById('atlas')
      if (!el) return
      const avail = window.innerHeight - CHROME
      const raw = avail / Math.max(1, el.offsetHeight)
      const next = Math.min(MAX, Math.max(MIN, raw))
      // 1.02 以下不缩放，避免 1px 级的抖动
      setZoom(next < 1.02 ? 1 : Math.round(next * 100) / 100)
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    const el = document.getElementById('atlas')
    if (el) ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
    }
  }, [])

  return zoom
}
